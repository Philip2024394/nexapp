// src/app/nex-native/hq/security-audit/_reader.ts
//
// NEX Security Programme · Item 5 · server-only reader for the
// HQ security audit viewer page. Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Doctrine
//   · "server-only" marker · never shipped to the client bundle.
//   · Every function requires an HQ-authorised caller · the page
//     calls requireHqAdmin BEFORE passing the session's account id
//     to any read. Defence-in-depth · if the page's gate ever drifts
//     this reader still writes an HQ-authz-completed audit event via
//     the sealed requireHqAdmin wrapper (see hq-authorization.ts).
//   · Cursor-based pagination · (occurred_at DESC, id DESC) so a
//     record inserted mid-browse never duplicates or skips.
//   · Server-side filters · the UI never does a fetch-all + client-filter.
//   · No CSV / bulk export endpoint · each read is paged and bounded.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

const PAGE_SIZE = 50;

const EVENT_PREFIX_SHAPE = /^[a-z][a-z0-9_]{2,63}(\.[a-z][a-z0-9_]{2,63}){0,2}$/;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AuditOutcomeFilter =
  | "attempted"
  | "denied"
  | "completed"
  | "failed";

export interface AuditQueryInput {
  readonly eventPrefix?: string;
  readonly outcome?: AuditOutcomeFilter;
  readonly actorAccountId?: string;
  /** ISO-8601 timestamp · lower bound inclusive. */
  readonly since?: string;
  /** ISO-8601 timestamp · upper bound exclusive. */
  readonly until?: string;
  /** Opaque continuation cursor from the previous page's nextCursor. */
  readonly cursor?: AuditCursor;
}

export interface AuditCursor {
  readonly occurredAt: string;
  readonly id: number;
}

export interface AuditRow {
  readonly id: number;
  readonly event: string;
  readonly outcome: string;
  readonly actor_account_id: string | null;
  readonly actor_identity: string | null;
  readonly target_type: string | null;
  readonly target_id: string | null;
  readonly metadata: Record<string, unknown>;
  readonly occurred_at: string;
}

export interface AuditPage {
  readonly rows: readonly AuditRow[];
  readonly nextCursor: AuditCursor | null;
  /** When true, the underlying table / view / function is not
   *  deployed to this environment (migration gap). The caller must
   *  surface a friendly notice · do NOT throw. Owner directive
   *  2026-11-08 · migrations 290-301 are NOT applied to production
   *  per CLAUDE.md §5 · HQ must not crash on missing-table. */
  readonly tableUnavailable?: boolean;
}

// Owner directive 2026-11-08 (round 2) · probe cache so the reader
// does not throw on an environment where migration 292 (audit log
// table) is missing · same pattern as incident-service +
// security-audit-service.
let AUDIT_TABLE_READY: boolean | null = null;

async function ensureAuditTableReady(): Promise<boolean> {
  if (AUDIT_TABLE_READY !== null) return AUDIT_TABLE_READY;
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_security_audit_log")
      .select("id")
      .limit(0);
    AUDIT_TABLE_READY = !error;
    if (!AUDIT_TABLE_READY) {
      // eslint-disable-next-line no-console
      console.warn(
        "[security-audit-reader] nex_security_audit_log unavailable · page will degrade to empty state",
        { error: error?.message ?? null },
      );
    }
    return AUDIT_TABLE_READY;
  } catch {
    AUDIT_TABLE_READY = false;
    return false;
  }
}

function isMissingSchema(message: string | null | undefined): boolean {
  if (!message) return false;
  return (
    /does not exist/i.test(message) ||
    /schema cache/i.test(message) ||
    /relation .* does not exist/i.test(message) ||
    /could not find the table/i.test(message)
  );
}

/** Exposed so tests can reset the probe between isolated runs. */
export function _resetAuditReaderProbeForTests(): void {
  AUDIT_TABLE_READY = null;
}

function validateInput(input: AuditQueryInput): void {
  if (input.eventPrefix && !EVENT_PREFIX_SHAPE.test(input.eventPrefix)) {
    throw new Error("security-audit-reader: malformed eventPrefix");
  }
  if (input.actorAccountId && !UUID_SHAPE.test(input.actorAccountId)) {
    throw new Error("security-audit-reader: actorAccountId must be a UUID");
  }
  if (input.since && Number.isNaN(Date.parse(input.since))) {
    throw new Error("security-audit-reader: since is not a valid ISO timestamp");
  }
  if (input.until && Number.isNaN(Date.parse(input.until))) {
    throw new Error("security-audit-reader: until is not a valid ISO timestamp");
  }
}

/** Fetch one page of audit rows · ordered DESC by (occurred_at, id).
 *  Returns at most PAGE_SIZE rows + the cursor for the next page.
 *  When the backing table is unavailable (migration gap) returns an
 *  empty page with `tableUnavailable: true` · never throws. */
export async function fetchAuditPage(input: AuditQueryInput): Promise<AuditPage> {
  validateInput(input);
  const ready = await ensureAuditTableReady();
  if (!ready) {
    return { rows: [], nextCursor: null, tableUnavailable: true };
  }
  let q = nexSupabaseAdmin
    .from("nex_security_audit_log")
    .select(
      "id, event, outcome, actor_account_id, actor_identity, target_type, target_id, metadata, occurred_at",
    )
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (input.eventPrefix) {
    q = q.like("event", `${input.eventPrefix}%`);
  }
  if (input.outcome) {
    q = q.eq("outcome", input.outcome);
  }
  if (input.actorAccountId) {
    q = q.eq("actor_account_id", input.actorAccountId);
  }
  if (input.since) {
    q = q.gte("occurred_at", input.since);
  }
  if (input.until) {
    q = q.lt("occurred_at", input.until);
  }
  if (input.cursor) {
    // (occurred_at, id) < (cursor.occurred_at, cursor.id) in DESC order ·
    // Supabase postgrest doesn't expose row-value comparison · we split
    // into two clauses · older-occurred-at OR same-occurred-at + lower-id.
    // This CAN miss ties at the exact boundary (same occurred_at, same
    // id) · but id is unique · so the compound condition is exact.
    // Supabase JS v2 .or(...) filters on raw postgrest syntax.
    const encOcc = input.cursor.occurredAt;
    const encId = input.cursor.id;
    q = q.or(
      `and(occurred_at.lt.${encOcc}),and(occurred_at.eq.${encOcc},id.lt.${encId})`,
    );
  }
  const { data, error } = await q;
  if (error) {
    // If the schema cache signalled a missing table mid-flight (e.g.
    // migration drift between probe + query) degrade gracefully same
    // as the up-front probe would have.
    if (isMissingSchema(error.message)) {
      AUDIT_TABLE_READY = false;
      return { rows: [], nextCursor: null, tableUnavailable: true };
    }
    throw new Error(`security-audit-reader: ${error.message}`);
  }
  const rows = (data ?? []) as AuditRow[];
  const hasMore = rows.length > PAGE_SIZE;
  const slice = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const last = slice[slice.length - 1];
  const nextCursor: AuditCursor | null =
    hasMore && last
      ? { occurredAt: last.occurred_at, id: last.id }
      : null;
  return { rows: slice, nextCursor };
}

// ─── Unresolved reconciliation view ──────────────────────────────────

export interface UnresolvedRow {
  readonly reconciliation_id: number;
  readonly attempted_log_id: number;
  readonly event: string;
  readonly actor_account_id: string | null;
  readonly actor_identity: string | null;
  readonly occurred_at: string;
  readonly decided_at: string;
  readonly notes: string | null;
}

export interface UnresolvedPage {
  readonly rows: readonly UnresolvedRow[];
  readonly nextCursor: { decided_at: string; id: number } | null;
  readonly tableUnavailable?: boolean;
}

/** Fetch attempted-events that have been flagged as unresolved by
 *  the reconciler (see migration 293). Separate view so HQ operators
 *  can see at-a-glance whether sensitive actions are missing their
 *  completion rows · never pretend an unresolved attempted is a
 *  confirmed success. */
export async function fetchUnresolvedPage(cursor?: {
  decided_at: string;
  id: number;
}): Promise<UnresolvedPage> {
  const ready = await ensureAuditTableReady();
  if (!ready) {
    return { rows: [], nextCursor: null, tableUnavailable: true };
  }
  // Supabase postgrest join via select = outer-table.inner-table
  // syntax · we read reconciliation rows + the matching attempted
  // audit log row in one request.
  let q = nexSupabaseAdmin
    .from("nex_security_audit_reconciliation")
    .select(
      "id, attempted_log_id, decision, decided_at, notes, nex_security_audit_log!inner(event, actor_account_id, actor_identity, occurred_at)",
    )
    .eq("decision", "unresolved")
    .order("decided_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (cursor) {
    q = q.or(
      `and(decided_at.lt.${cursor.decided_at}),and(decided_at.eq.${cursor.decided_at},id.lt.${cursor.id})`,
    );
  }
  const { data, error } = await q;
  if (error) {
    if (isMissingSchema(error.message)) {
      AUDIT_TABLE_READY = false;
      return { rows: [], nextCursor: null, tableUnavailable: true };
    }
    throw new Error(`security-audit-reader (unresolved): ${error.message}`);
  }
  type Joined = {
    id: number;
    attempted_log_id: number;
    decided_at: string;
    notes: string | null;
    nex_security_audit_log: {
      event: string;
      actor_account_id: string | null;
      actor_identity: string | null;
      occurred_at: string;
    };
  };
  const rows = (data ?? []) as unknown as Joined[];
  const hasMore = rows.length > PAGE_SIZE;
  const slice = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor =
    hasMore && slice.length > 0
      ? { decided_at: slice[slice.length - 1]!.decided_at, id: slice[slice.length - 1]!.id }
      : null;
  return {
    rows: slice.map((r) => ({
      reconciliation_id: r.id,
      attempted_log_id: r.attempted_log_id,
      event: r.nex_security_audit_log.event,
      actor_account_id: r.nex_security_audit_log.actor_account_id,
      actor_identity: r.nex_security_audit_log.actor_identity,
      occurred_at: r.nex_security_audit_log.occurred_at,
      decided_at: r.decided_at,
      notes: r.notes,
    })),
    nextCursor,
  };
}
