// src/lib/nex-native/outreach/outreach-eligibility.ts
//
// NEX Outreach · eligibility predicate · Phase 1.4 · sealed 2026-10-16.
// --------------------------------------------------------------------
// Single source of truth for "which rows in nex.business_canonical
// are safe to enqueue for HQ outreach." Every outreach surface (the
// enqueue tick, the dashboard count, the ad-hoc admin query) MUST
// route through this module. Writing a bespoke WHERE clause in
// another file bypasses the safeguards.
//
// FIVE SAFEGUARDS · the eligibility predicate is their intersection:
//
//   1. qualification_status = 'QUALIFIED'
//        → sealed via the Phase 1.3 validator pipeline: format +
//          authoritative source attribution + DNS MX.
//
//   2. email_status = 'VALIDATED'
//        → defence-in-depth · a qualified row without a validated
//          email_status is a shape mismatch that must never ship.
//
//   3. email IS NOT NULL
//        → trivially implied by (1) but written explicitly so the
//          query planner can use the email NOT NULL index without
//          relying on the qualification_status proxy.
//
//   4. NOT EXISTS (
//        SELECT 1 FROM nex.business_outreach_suppression s
//        WHERE lower(s.email) = lower(bc.email)
//      )
//        → opt-out, hard-bounce, admin-block, complaint suppression.
//          Checked at enqueue AND again at send (see outreach-queue.ts).
//
//   5. superseded_by_business_id IS NULL
//        → a row that was replaced by a canonical merge should not
//          be contacted · the superseding row carries the authority.
//
// All five are AND'd. Weakening ANY of them must break the test suite
// at `src/lib/nex-native/outreach/__tests__/outreach-eligibility.test.ts`.
//
// This module is PURE string construction + a thin DB wrapper. It
// does not write to the DB. The queue module (outreach-queue.ts) is
// responsible for every write path and performs the full suppression
// check a SECOND time at send-time.
//
// Dormancy · the only runtime surface, `countEligibleContacts`, is
// behind `NEX_OUTREACH_ENABLED=true` and additionally fails-safe when
// migration 202 (qualification columns) or 203 (suppression table) is
// absent. Default state is "disabled, zero DB touches."

import "server-only";
import { withClient } from "@/lib/nex/db";

/** The master WHERE clause fragment · composed from the five
 *  safeguards above. Parameterless · no user input is interpolated.
 *  Downstream callers prepend their own filters (country, limit)
 *  with their own bind parameters. */
export const ELIGIBILITY_WHERE_SQL = `
  bc.qualification_status = 'QUALIFIED'
  AND bc.email_status = 'VALIDATED'
  AND bc.email IS NOT NULL
  AND bc.superseded_by_business_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM nex.business_outreach_suppression s
    WHERE lower(s.email) = lower(bc.email)
  )
`.trim();

/** The five safeguard tokens · exposed so the regression suite can
 *  assert each is present in `ELIGIBILITY_WHERE_SQL`. Removing any
 *  token from the WHERE clause must fail those tests. */
export const ELIGIBILITY_REQUIRED_TOKENS = Object.freeze([
  "bc.qualification_status = 'QUALIFIED'",
  "bc.email_status = 'VALIDATED'",
  "bc.email IS NOT NULL",
  "bc.superseded_by_business_id IS NULL",
  "FROM nex.business_outreach_suppression s",
] as const);

/** Build the full COUNT SQL · for the dashboard. Takes an optional
 *  country filter. Country is passed as a bind parameter · never
 *  interpolated. */
export function buildEligibilityCountSql(opts: {
  readonly country?: string | null;
} = {}): { readonly sql: string; readonly params: readonly unknown[] } {
  const params: unknown[] = [];
  const where: string[] = [ELIGIBILITY_WHERE_SQL];
  if (opts.country) {
    params.push(opts.country);
    where.push(`bc.country = $${params.length}`);
  }
  const sql = `
    SELECT COUNT(*)::text AS n
    FROM nex.business_canonical bc
    WHERE ${where.join("\n      AND ")}
  `.trim();
  return { sql, params };
}

/** Build the SELECT that produces a batch of eligible rows for the
 *  enqueue tick. Ordered by canonical_business_id for stable paging.
 *  LIMIT is bind-parameterised. */
export function buildEligibilityBatchSql(opts: {
  readonly limit: number;
  readonly country?: string | null;
}): { readonly sql: string; readonly params: readonly unknown[] } {
  const params: unknown[] = [];
  const where: string[] = [ELIGIBILITY_WHERE_SQL];
  if (opts.country) {
    params.push(opts.country);
    where.push(`bc.country = $${params.length}`);
  }
  params.push(opts.limit);
  const limitIdx = params.length;
  const sql = `
    SELECT bc.canonical_business_id, bc.email, bc.country
    FROM nex.business_canonical bc
    WHERE ${where.join("\n      AND ")}
    ORDER BY bc.canonical_business_id
    LIMIT $${limitIdx}
  `.trim();
  return { sql, params };
}

export interface EligibilityCountOutcome {
  readonly ok: boolean;
  readonly count: number;
  readonly skipped_reason?:
    | "disabled"
    | "migration_202_absent"
    | "migration_203_absent";
}

/** Count eligible contacts · dormant by default (requires
 *  `NEX_OUTREACH_ENABLED=true`). Returns `skipped_reason='disabled'`
 *  with count=0 when the env flag is absent · never queries the DB.
 *
 *  Fail-safe for migrations:
 *    · migration 202 absent (no qualification_status column) →
 *      returns `skipped_reason='migration_202_absent'`.
 *    · migration 203 absent (no suppression table) →
 *      returns `skipped_reason='migration_203_absent'`.
 *
 *  Both fail-safes return count=0 so the dashboard shows an honest
 *  "0 eligible, migration not applied" state instead of a crash. */
export async function countEligibleContacts(opts: {
  readonly country?: string | null;
  readonly bypassEnvGateForTests?: boolean;
} = {}): Promise<EligibilityCountOutcome> {
  if (!opts.bypassEnvGateForTests) {
    if (process.env.NEX_OUTREACH_ENABLED !== "true") {
      return { ok: true, count: 0, skipped_reason: "disabled" };
    }
  }

  const result = await withClient(async (client) => {
    const check = await client.query(
      `SELECT
         EXISTS(
           SELECT 1 FROM information_schema.columns
           WHERE table_schema='nex' AND table_name='business_canonical'
             AND column_name='qualification_status'
         ) AS mig202,
         EXISTS(
           SELECT 1 FROM information_schema.tables
           WHERE table_schema='nex' AND table_name='business_outreach_suppression'
         ) AS mig203`,
    );
    const row = check.rows[0] as
      | { mig202?: unknown; mig203?: unknown }
      | undefined;
    if (!row?.mig202) {
      return { ok: true, count: 0, skipped_reason: "migration_202_absent" as const };
    }
    if (!row?.mig203) {
      return { ok: true, count: 0, skipped_reason: "migration_203_absent" as const };
    }

    const { sql, params } = buildEligibilityCountSql({ country: opts.country });
    const res = await client.query(sql, [...params]);
    const n = Number((res.rows[0] as { n?: string } | undefined)?.n ?? "0");
    return { ok: true, count: Number.isFinite(n) ? n : 0 };
  });

  return result ?? { ok: true, count: 0, skipped_reason: "disabled" };
}
