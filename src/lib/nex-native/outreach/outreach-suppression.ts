// src/lib/nex-native/outreach/outreach-suppression.ts
//
// NEX Outreach · suppression layer · Phase 1.4 · sealed 2026-10-16.
// --------------------------------------------------------------------
// Global do-not-contact list backed by `nex.business_outreach_
// suppression` (migration 203). Every write path lowercases + trims
// the email before INSERT; every read path lowercases + trims before
// SELECT. Both sides matching ensures the unique index on
// `lower(email)` performs the exact match without a sequence scan.
//
// Three write entry points · one per legitimate reason:
//
//   · recordOptOut(email)       · user clicked an unsubscribe link
//   · recordHardBounce(email)   · ESP webhook reported permanent fail
//   · recordComplaint(email)    · ESP webhook reported spam complaint
//   · recordAdminBlock(email)   · HQ admin manually excluded a contact
//
// A fifth path (`isSuppressed`) is the read API every caller must
// use at BOTH queue-time and send-time. The queue layer at
// `outreach-queue.ts` performs both checks.
//
// Fail-safe · if migration 203 has not been applied, every read
// returns `{ suppressed: false, migration_203_absent: true }` and
// every write returns `{ ok: false, migration_203_absent: true }`.
// Nothing throws · the caller decides whether to proceed (queue layer
// DOES NOT proceed when a check cannot run · it skips).
//
// Dormancy · unlike the queue + enqueue layers, this module does NOT
// require `NEX_OUTREACH_ENABLED=true` because the write paths are
// safety-oriented. An unsubscribe handler should be able to record
// a user's opt-out EVEN BEFORE the outreach feature flag flips on.
// The checks are cheap and the table is sparse.

import "server-only";
import { withClient } from "@/lib/nex/db";

export type SuppressionReason =
  | "hard_bounce"
  | "opt_out"
  | "admin_block"
  | "complaint";

export interface IsSuppressedResult {
  readonly suppressed: boolean;
  readonly reason?: SuppressionReason;
  readonly migration_203_absent?: boolean;
}

export interface RecordSuppressionResult {
  readonly ok: boolean;
  readonly migration_203_absent?: boolean;
  /** True on fresh insert · false when the email was already in the
   *  table (idempotent re-call). */
  readonly inserted: boolean;
}

/** Normalise an email for suppression lookup / write. Same rule the
 *  DB trigger applies · so the two sides always agree. */
function canonicaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Check whether migration 203 has been applied. Used by every entry
 *  point as a cheap preamble. */
async function migration203Present(
  client: { query: typeof import("@/lib/nex/db").withClient extends never ? never : (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
): Promise<boolean> {
  const res = await client.query(
    `SELECT EXISTS(
       SELECT 1 FROM information_schema.tables
       WHERE table_schema='nex' AND table_name='business_outreach_suppression'
     ) AS present`,
  );
  return Boolean((res.rows[0] as { present?: unknown } | undefined)?.present);
}

/** READ · is this email on the do-not-contact list? Must be called at
 *  BOTH enqueue and send boundaries. */
export async function isSuppressed(email: string): Promise<IsSuppressedResult> {
  const canonical = canonicaliseEmail(email);
  if (!canonical) return { suppressed: false };
  const r = await withClient(async (client) => {
    if (!(await migration203Present(client))) {
      return { suppressed: false, migration_203_absent: true } as const;
    }
    const res = await client.query(
      `SELECT reason FROM nex.business_outreach_suppression
         WHERE lower(email) = $1
         LIMIT 1`,
      [canonical],
    );
    const row = res.rows[0] as { reason?: SuppressionReason } | undefined;
    if (!row) return { suppressed: false } as const;
    return {
      suppressed: true,
      reason: row.reason,
    } as const;
  });
  return r ?? { suppressed: false };
}

/** WRITE · internal · consolidates the four public record* functions. */
async function recordSuppression(
  email: string,
  reason: SuppressionReason,
  source: string,
  evidence: Record<string, unknown>,
): Promise<RecordSuppressionResult> {
  const canonical = canonicaliseEmail(email);
  if (!canonical) {
    return { ok: false, inserted: false };
  }
  const r = await withClient(async (client) => {
    if (!(await migration203Present(client))) {
      return {
        ok: false,
        migration_203_absent: true,
        inserted: false,
      } as const;
    }
    // Idempotent · ON CONFLICT DO NOTHING on the unique lower(email)
    // index. Repeat suppressions do not duplicate rows. If the row
    // already exists with a different reason (e.g. previously opt_out,
    // now hard_bounce), we leave the original reason intact · the
    // sender's responsibility is "do not contact," which the first
    // suppression already satisfies. Audit evidence of the second
    // event lives in evidence (per-event webhook payload history is
    // not stored in-row · a future audit table may add it).
    const res = await client.query(
      `INSERT INTO nex.business_outreach_suppression (email, reason, source, evidence)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT ((lower(email))) DO NOTHING
         RETURNING suppression_id`,
      [canonical, reason, source, JSON.stringify(evidence)],
    );
    const inserted = (res.rows?.length ?? 0) > 0;
    return { ok: true, inserted } as const;
  });
  return r ?? { ok: false, inserted: false };
}

export function recordOptOut(
  email: string,
  source = "user_opt_out",
  evidence: Record<string, unknown> = {},
): Promise<RecordSuppressionResult> {
  return recordSuppression(email, "opt_out", source, evidence);
}

export function recordHardBounce(
  email: string,
  source = "webhook:esp",
  evidence: Record<string, unknown> = {},
): Promise<RecordSuppressionResult> {
  return recordSuppression(email, "hard_bounce", source, evidence);
}

export function recordComplaint(
  email: string,
  source = "webhook:esp",
  evidence: Record<string, unknown> = {},
): Promise<RecordSuppressionResult> {
  return recordSuppression(email, "complaint", source, evidence);
}

export function recordAdminBlock(
  email: string,
  source = "owner_admin",
  evidence: Record<string, unknown> = {},
): Promise<RecordSuppressionResult> {
  return recordSuppression(email, "admin_block", source, evidence);
}

// Exposed for test anchors · the canonical form is a semantic
// surface, not an implementation detail.
export const __canonicaliseEmailForTests = canonicaliseEmail;
