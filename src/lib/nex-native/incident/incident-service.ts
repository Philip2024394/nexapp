// src/lib/nex-native/incident/incident-service.ts
//
// NEX Security & Recovery · incident recorder + lifecycle service.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Server-only · writes go through the sealed nexSupabaseAdmin. All
// operator-facing text is REDACTED by the caller · this service
// trusts its inputs are already free of secrets / stack traces /
// chat body / PII (see migration 300 content-safety comment).
//
// Lifecycle enforcement
//   Legal transitions:
//     DETECTED      → INVESTIGATING | PROTECTING | RECOVERING | NEEDS_ADMIN | CLOSED
//     INVESTIGATING → PROTECTING | RECOVERING | NEEDS_ADMIN | CLOSED
//     PROTECTING    → RECOVERING | RECOVERED | NEEDS_ADMIN | CLOSED
//     RECOVERING    → RECOVERED | MONITORING | NEEDS_ADMIN | CLOSED
//     RECOVERED     → MONITORING | CLOSED
//     MONITORING    → RECOVERED | CLOSED | NEEDS_ADMIN
//     NEEDS_ADMIN   → INVESTIGATING | RECOVERING | CLOSED
//     CLOSED        → (terminal · can only reopen via a NEW incident)
//
// Pre-migration-300 compat
//   Same probe pattern as the audit writer · if nex_incident is
//   unavailable, record() returns { ok: false, skipped: "table_not_
//   available" } and does NOT throw · the callers of this service
//   are observability code paths · they MUST NOT turn an incident
//   write failure into a user-visible fault.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

export type IncidentCategory =
  | "security"
  | "recovery"
  | "database"
  | "service"
  | "backend"
  | "storage"
  | "job"
  | "auth"
  | "rate_limit"
  | "attack"
  | "degraded";

export type IncidentSeverity = "info" | "warn" | "critical";

export type IncidentStatus =
  | "DETECTED"
  | "INVESTIGATING"
  | "PROTECTING"
  | "RECOVERING"
  | "RECOVERED"
  | "MONITORING"
  | "NEEDS_ADMIN"
  | "CLOSED";

export type IncidentScope =
  | "chat"
  | "shops"
  | "feed"
  | "live"
  | "directory"
  | "food"
  | "fashion"
  | "accommodation"
  | "property"
  | "hq"
  | "infra"
  | "auth"
  | "storage"
  | "db"
  | "cron";

export type IncidentCountry = "ireland" | "indonesia" | "worldwide" | "hq" | "global";

export interface CreateIncidentInput {
  readonly category: IncidentCategory;
  readonly severity: IncidentSeverity;
  readonly scope: IncidentScope;
  readonly country: IncidentCountry;
  readonly summary: string;
  readonly correlationId?: string | null;
  readonly usersAffectedCount?: number;
  readonly adminActionRequired?: boolean;
}

export interface CreateIncidentResult {
  readonly ok: boolean;
  readonly incidentId?: string;
  readonly skipped?: "table_not_available";
  readonly error?: string;
}

const REDACTION_PATTERNS: readonly RegExp[] = [
  /sk_live_[a-zA-Z0-9]+/g,
  /sk_test_[a-zA-Z0-9]+/g,
  /eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g, // JWT
  /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, // raw IPs
  /password[=:][^\s&]+/gi,
  /token[=:][^\s&]+/gi,
  /authorization:\s*bearer\s+[^\s]+/gi,
];

export function redactSummary(input: string): string {
  let out = input.slice(0, 400);
  for (const re of REDACTION_PATTERNS) {
    out = out.replace(re, "[REDACTED]");
  }
  return out;
}

// Pre-migration-300 probe cache
let INCIDENT_TABLE_READY: boolean | null = null;

async function ensureIncidentTableReady(): Promise<boolean> {
  if (INCIDENT_TABLE_READY !== null) return INCIDENT_TABLE_READY;
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_incident")
      .select("id")
      .limit(0);
    INCIDENT_TABLE_READY = !error;
    if (!INCIDENT_TABLE_READY) {
      // eslint-disable-next-line no-console
      console.warn(
        "[incident-service] nex_incident unavailable · writes will no-op until migration 300 is applied.",
        { error: error?.message ?? null },
      );
    }
    return INCIDENT_TABLE_READY;
  } catch {
    INCIDENT_TABLE_READY = false;
    return false;
  }
}

/** Exposed so tests can reset the probe between isolated runs. */
export function _resetIncidentProbeForTests(): void {
  INCIDENT_TABLE_READY = null;
}

const LEGAL_TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  DETECTED: ["INVESTIGATING", "PROTECTING", "RECOVERING", "NEEDS_ADMIN", "CLOSED"],
  INVESTIGATING: ["PROTECTING", "RECOVERING", "NEEDS_ADMIN", "CLOSED"],
  PROTECTING: ["RECOVERING", "RECOVERED", "NEEDS_ADMIN", "CLOSED"],
  RECOVERING: ["RECOVERED", "MONITORING", "NEEDS_ADMIN", "CLOSED"],
  RECOVERED: ["MONITORING", "CLOSED"],
  MONITORING: ["RECOVERED", "CLOSED", "NEEDS_ADMIN"],
  NEEDS_ADMIN: ["INVESTIGATING", "RECOVERING", "CLOSED"],
  CLOSED: [],
};

export function isLegalTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

/** Create a new incident. Idempotency is NOT provided here · if the
 *  caller wants dedup, it must check for an existing open incident
 *  with the same (scope, category, correlationId) first. */
export async function createIncident(
  input: CreateIncidentInput,
): Promise<CreateIncidentResult> {
  const ready = await ensureIncidentTableReady();
  if (!ready) {
    return { ok: false, skipped: "table_not_available" };
  }

  const redactedSummary = redactSummary(input.summary);

  const { data, error } = await nexSupabaseAdmin
    .from("nex_incident")
    .insert({
      category: input.category,
      severity: input.severity,
      scope: input.scope,
      country: input.country,
      summary: redactedSummary,
      correlation_id: input.correlationId ?? null,
      users_affected_count: Math.max(0, input.usersAffectedCount ?? 0),
      admin_action_required: input.adminActionRequired ?? false,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.warn("[incident-service] insert failed · observability-only · no user impact", {
      error: error?.message ?? "no data",
    });
    return { ok: false, error: error?.message ?? "no data returned" };
  }

  const row = data as { id: string };
  // Companion event · creation marker.
  await nexSupabaseAdmin.from("nex_incident_event").insert({
    incident_id: row.id,
    kind: "created",
    to_status: "DETECTED",
    note: `${input.category}/${input.scope}`,
  });

  return { ok: true, incidentId: row.id };
}

export interface TransitionInput {
  readonly incidentId: string;
  readonly toStatus: IncidentStatus;
  readonly actorAccountId?: string | null;
  readonly note?: string | null;
  readonly recoveryActionTaken?: string | null;
}

export interface TransitionResult {
  readonly ok: boolean;
  readonly error?:
    | "not_found"
    | "illegal_transition"
    | "write_failed"
    | "table_not_available";
  readonly fromStatus?: IncidentStatus;
}

export async function transitionIncident(
  input: TransitionInput,
): Promise<TransitionResult> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return { ok: false, error: "table_not_available" };

  const current = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id, status")
    .eq("id", input.incidentId)
    .maybeSingle();
  if (current.error || !current.data) return { ok: false, error: "not_found" };

  const fromStatus = (current.data as { status: IncidentStatus }).status;
  if (!isLegalTransition(fromStatus, input.toStatus)) {
    return { ok: false, error: "illegal_transition", fromStatus };
  }

  const patch: Record<string, unknown> = {
    status: input.toStatus,
    updated_at: new Date().toISOString(),
  };
  if (input.recoveryActionTaken) {
    patch.recovery_action_taken = input.recoveryActionTaken.slice(0, 400);
  }
  if (input.toStatus === "RECOVERED" || input.toStatus === "CLOSED") {
    patch.resolved_at = new Date().toISOString();
  }

  const upd = await nexSupabaseAdmin
    .from("nex_incident")
    .update(patch)
    .eq("id", input.incidentId)
    .eq("status", fromStatus); // Optimistic concurrency guard
  if (upd.error) return { ok: false, error: "write_failed", fromStatus };

  await nexSupabaseAdmin.from("nex_incident_event").insert({
    incident_id: input.incidentId,
    kind: "status_transition",
    actor_account_id: input.actorAccountId ?? null,
    from_status: fromStatus,
    to_status: input.toStatus,
    note: input.note ? redactSummary(input.note) : null,
  });

  return { ok: true, fromStatus };
}

export interface RecoveryAttemptInput {
  readonly incidentId: string;
  readonly success: boolean;
  readonly note?: string | null;
  readonly actorAccountId?: string | null;
}

export async function recordRecoveryAttempt(
  input: RecoveryAttemptInput,
): Promise<{ ok: boolean; error?: string }> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return { ok: false, error: "table_not_available" };
  const { error } = await nexSupabaseAdmin.from("nex_incident_event").insert({
    incident_id: input.incidentId,
    kind: input.success ? "recovery_success" : "recovery_failure",
    actor_account_id: input.actorAccountId ?? null,
    note: input.note ? redactSummary(input.note) : null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function acknowledgeIncident(
  incidentId: string,
  byAccountId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return { ok: false, error: "table_not_available" };
  const { error } = await nexSupabaseAdmin
    .from("nex_incident")
    .update({
      acknowledged_by: byAccountId,
      acknowledged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", incidentId);
  if (error) return { ok: false, error: error.message };
  await nexSupabaseAdmin.from("nex_incident_event").insert({
    incident_id: incidentId,
    kind: "acknowledged",
    actor_account_id: byAccountId,
  });
  return { ok: true };
}

// ─── Readers for HQ dashboard ────────────────────────────────────────

export interface IncidentRow {
  readonly id: string;
  readonly category: IncidentCategory;
  readonly severity: IncidentSeverity;
  readonly scope: IncidentScope;
  readonly country: IncidentCountry;
  readonly status: IncidentStatus;
  readonly summary: string | null;
  readonly recovery_action_taken: string | null;
  readonly users_affected_count: number;
  readonly admin_action_required: boolean;
  readonly detected_at: string;
  readonly resolved_at: string | null;
  readonly correlation_id: string | null;
}

export interface IncidentSummaryCounts {
  readonly open: number;
  readonly open_critical: number;
  readonly needs_admin: number;
  readonly recovered_last_24h: number;
  readonly by_country: Readonly<Record<IncidentCountry, number>>;
  readonly by_scope: Readonly<Record<string, number>>;
}

export async function fetchRecentIncidents(limit = 100): Promise<readonly IncidentRow[]> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return [];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_incident")
    .select(
      "id, category, severity, scope, country, status, summary, recovery_action_taken, users_affected_count, admin_action_required, detected_at, resolved_at, correlation_id",
    )
    .order("detected_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as IncidentRow[];
}

export async function fetchIncidentSummary(): Promise<IncidentSummaryCounts> {
  const ready = await ensureIncidentTableReady();
  const empty: IncidentSummaryCounts = {
    open: 0,
    open_critical: 0,
    needs_admin: 0,
    recovered_last_24h: 0,
    by_country: { ireland: 0, indonesia: 0, worldwide: 0, hq: 0, global: 0 },
    by_scope: {},
  };
  if (!ready) return empty;
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const open = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id", { count: "exact", head: true })
    .not("status", "in", "(RECOVERED,CLOSED)");
  const openCrit = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id", { count: "exact", head: true })
    .not("status", "in", "(RECOVERED,CLOSED)")
    .eq("severity", "critical");
  const needsAdmin = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id", { count: "exact", head: true })
    .eq("status", "NEEDS_ADMIN");
  const rec = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id", { count: "exact", head: true })
    .eq("status", "RECOVERED")
    .gte("resolved_at", yesterday);

  // Country + scope breakdowns via list query (open only)
  const openList = await nexSupabaseAdmin
    .from("nex_incident")
    .select("country, scope")
    .not("status", "in", "(RECOVERED,CLOSED)");
  const by_country: Record<IncidentCountry, number> = {
    ireland: 0,
    indonesia: 0,
    worldwide: 0,
    hq: 0,
    global: 0,
  };
  const by_scope: Record<string, number> = {};
  for (const row of (openList.data ?? []) as Array<{ country: IncidentCountry; scope: string }>) {
    by_country[row.country] = (by_country[row.country] ?? 0) + 1;
    by_scope[row.scope] = (by_scope[row.scope] ?? 0) + 1;
  }
  return {
    open: open.count ?? 0,
    open_critical: openCrit.count ?? 0,
    needs_admin: needsAdmin.count ?? 0,
    recovered_last_24h: rec.count ?? 0,
    by_country,
    by_scope,
  };
}

export interface IncidentEventRow {
  readonly id: number;
  readonly kind: string;
  readonly at: string;
  readonly actor_account_id: string | null;
  readonly from_status: string | null;
  readonly to_status: string | null;
  readonly note: string | null;
}

export async function fetchIncidentEvents(
  incidentId: string,
): Promise<readonly IncidentEventRow[]> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return [];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_incident_event")
    .select("id, kind, at, actor_account_id, from_status, to_status, note")
    .eq("incident_id", incidentId)
    .order("at", { ascending: true });
  if (error) return [];
  return (data ?? []) as IncidentEventRow[];
}
