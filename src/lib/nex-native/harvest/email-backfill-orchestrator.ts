// src/lib/nex-native/harvest/email-backfill-orchestrator.ts
//
// Email backfill orchestrator · sealed 2026-10-16 · DORMANT by default.
// --------------------------------------------------------------------
// Reads existing `nex.business_canonical` rows that are still in
// `qualification_status='PENDING'` and attempts to find a public
// business email by (a) checking OSM tags we might have missed, then
// (b) walking the business's `website_apex` using the sealed six-method
// extractor (`src/lib/nex/discovery-world/email-extractor.ts`).
//
// RESUMABILITY
//   The partial index `idx_bc_email_backfill_cursor` from migration 202
//   is sorted on `email_last_attempted_at NULLS FIRST` within rows
//   where `qualification_status='PENDING'`. Each tick pulls the next
//   batch from that cursor and stamps `email_last_attempted_at = now()`
//   on every attempt (success or failure), so the next tick resumes
//   past the last batch cleanly.
//
//   REVISED 2026-10-16 Phase 1.3 · the cursor also picks up
//   `qualification_status='UNQUALIFIED'` rows whose last attempt is
//   older than UNQUALIFIED_RETRY_COOLDOWN_DAYS (7). This closes the
//   first-run retry gap · a transient DNS failure or Overpass glitch
//   that flipped a row to UNQUALIFIED is retried after a week rather
//   than being permanently abandoned. DISQUALIFIED (admin lock) is
//   NEVER picked up · it is excluded by the WHERE clause and by the
//   preservation guards in the UPDATE.
//
//   RETRY DEADLINE · when the orchestrator decides to abandon a row
//   permanently (3 UNQUALIFIED attempts spaced by the cooldown · ~21
//   days total), an admin can still manually flip it back to PENDING
//   to force a re-walk. Nothing in the orchestrator writes a "give-up"
//   flag · the cooldown is the only gate.
//
// IDEMPOTENCY + PRESERVATION
//   · Writing `email + email_status + qualification_status` is UPDATE
//     by canonical_business_id · reruns reach the same final state.
//   · A re-walk that discovers an email while one already exists
//     keeps the existing email UNLESS the new one has a better status
//     (VALIDATED beats FOUND; both beat INVALID).
//   · `email_last_attempted_at` monotonically advances · never
//     decreases.
//   · Preservation guarantees (REVISED 2026-10-16 per owner):
//     - `qualification_status='DISQUALIFIED'` is an ADMIN LOCK · never
//       overwritten by the backfill (even if we find a validated email
//       later · DISQUALIFIED-then-walked rows must be explicitly
//       re-qualified by admin).
//     - `qualification_status='QUALIFIED'` is NEVER DOWNGRADED by a
//       re-walk that finds FOUND or NOT_FOUND (user verification is
//       preserved · a later VALIDATED finding keeps it QUALIFIED, a
//       transient fetch failure never flips it back to PENDING).
//     - Existing non-null `email` + `email_source_url` are never
//       nulled on a NOT_FOUND re-walk (COALESCE).
//
// QUALIFICATION STATE MACHINE (sealed 2026-10-16 revision)
//   Observed email_status → qualification_status transition applied by
//   the orchestrator UPDATE:
//
//     'VALIDATED' → 'QUALIFIED'   (promotes · address is deliverable)
//     'FOUND'     → 'PENDING'     (address observed, awaiting validation)
//     'NOT_FOUND' → 'UNQUALIFIED' (walked, no email on the site)
//     'INVALID'   → 'UNQUALIFIED' (format rejected or bounced)
//
//   PRESERVATION guards (short-circuit the transitions above):
//     qualification_status='DISQUALIFIED'  → stays DISQUALIFIED (admin)
//     qualification_status='QUALIFIED' + new in {FOUND, NOT_FOUND}
//                                         → stays QUALIFIED (no downgrade)
//
// SAFETY / DORMANCY
//   · Gated behind env var NEX_EMAIL_BACKFILL_ENABLED=true · without
//     it, `runEmailBackfillBatch` returns `{ skipped_reason: "disabled" }`
//     immediately with zero DB touches and zero outbound HTTP.
//   · Legal doctrine stub lives at docs/doctrine/nex-harvester-email-
//     qualification-2026-10-16.md · owner MUST fill in the legal basis
//     + opt-out mechanism before enabling.
//   · Rate limits: default 1 req / 1500 ms per domain · defensive
//     against the walker's own fetcher governance (NULL_FETCHER
//     refuses by default so even an accidental enable can't walk).
//   · Hard cap: 50 rows per batch, 240 s per tick.
//
// LIVE ROLLOUT ORDER (owner-gated · do NOT skip ahead):
//   1. Apply migration 202 to the live DB (separate authorisation).
//   2. Author the legal doctrine stub · owner accepts.
//   3. Inject a real PageFetcher into the orchestrator (currently
//      NULL_FETCHER) · do a single-row dry-run against a known
//      domain · verify the one row flips to QUALIFIED cleanly.
//   4. Enable NEX_EMAIL_BACKFILL_ENABLED=true in staging.
//   5. Wire into the Vercel cron tick (or run as a periodic one-shot).
//   6. Monitor the HQ dashboard breakdown and the daily
//      pages_fetched / emails_captured counters.

import "server-only";
import { randomUUID } from "node:crypto";
import { withClient } from "@/lib/nex/db";
import {
  validateEmailForBusiness,
  type ValidationResult,
} from "./email-validation";

/** Phase 1.3 · UNQUALIFIED retry cooldown · a row that failed its
 *  previous walk is eligible again after this many days. Keeps retry
 *  volume bounded (one re-walk per row per week) while still giving
 *  transient failures a path back. */
const UNQUALIFIED_RETRY_COOLDOWN_DAYS = 7;

/** Phase 1.4 · atomic lease TTL in milliseconds. A tick holds the
 *  lease for this long · if the walker crashes without clearing, the
 *  next tick reclaims the row via the `lease_expires_at < now()`
 *  clause in the claim CTE. Mirrors `nex.delivery_jobs.leaseNextJob`. */
const WALKER_LEASE_MS = 5 * 60 * 1000;

/** The sealed per-domain rate limit in milliseconds. Enforced in-
 *  process · the orchestrator pauses between fetches to the same
 *  domain. Different domains proceed in parallel up to the batch size.
 *  Owner can override via env NEX_EMAIL_BACKFILL_RATE_MS (never below
 *  500 ms · hard floor). */
const DEFAULT_RATE_MS = 1500;
const RATE_MS_HARD_FLOOR = 500;

/** Hard cap per tick · prevents an accidentally-long batch from
 *  swamping the Vercel 300s ceiling or outbound-rate budgets. */
const BATCH_HARD_CAP = 50;

/** Overall tick deadline · stays comfortably under Vercel's 300s
 *  serverless ceiling. Mirrors the discovery tick's maxDuration. */
const TICK_DEADLINE_MS = 240_000;

export interface EmailBackfillBatchResult {
  readonly ok: boolean;
  readonly attempted: number;
  readonly email_found: number;
  readonly email_not_found: number;
  readonly email_invalid: number;
  readonly errors: number;
  readonly skipped_reason?:
    | "disabled"
    | "deadline"
    | "no_pending_rows"
    | "migration_202_absent";
  readonly batch_ms: number;
}

/** A candidate email the fetcher produced for one business · the
 *  orchestrator still runs it through the validator before any DB
 *  write. Phase 4 of the rollout wires a real fetcher in; today the
 *  default is DORMANT_FETCHER (returns null). */
export interface EmailCandidate {
  readonly email: string;
  readonly sourceUrl: string;
}

export interface FetchCandidateContext {
  readonly canonicalBusinessId: string;
  readonly websiteApex: string;
}

export type FetchCandidate = (
  ctx: FetchCandidateContext,
) => Promise<EmailCandidate | null>;

/** The validator the orchestrator runs on every fetched candidate ·
 *  injectable for tests, defaults to the sealed `validateEmailForBusiness`
 *  (format gate + authoritative-source attribution + DNS MX check). */
export type ValidateCandidate = (
  email: string,
  websiteApex: string | null,
) => Promise<ValidationResult>;

/** Default fetcher · DORMANT · never produces a candidate. The real
 *  fetcher is wired in Phase 4 of the rollout. Keeping the default
 *  explicitly dormant means an accidental env flag flip cannot start
 *  outbound HTTP. */
export const DORMANT_FETCHER: FetchCandidate = async () => null;

const defaultValidator: ValidateCandidate = (email, apex) =>
  validateEmailForBusiness(email, apex);

export interface RunEmailBackfillBatchOptions {
  /** Owner-controlled override of per-domain rate · min 500 ms. */
  readonly rateMsPerDomain?: number;
  /** Owner-controlled batch size · 1..BATCH_HARD_CAP. */
  readonly batchSize?: number;
  /** Injectable clock for tests. */
  readonly now?: () => Date;
  /** Hard-override of the dormant gate · tests only. */
  readonly bypassEnvGateForTests?: boolean;
  /** Injectable candidate fetcher · default is DORMANT_FETCHER. Phase 4
   *  rollout wires a real page-walker here. */
  readonly fetchCandidate?: FetchCandidate;
  /** Injectable validator · default is `validateEmailForBusiness`.
   *  Tests pass a stub to exercise VALIDATED / FOUND / INVALID paths
   *  without hitting DNS. */
  readonly validate?: ValidateCandidate;
}

/**
 * Run one backfill tick. Returns totals · never throws · a complete
 * tick always produces a report so the HQ dashboard can show the
 * cadence truthfully.
 */
export async function runEmailBackfillBatch(
  opts: RunEmailBackfillBatchOptions = {},
): Promise<EmailBackfillBatchResult> {
  const started = (opts.now?.() ?? new Date()).getTime();

  if (!opts.bypassEnvGateForTests) {
    if (process.env.NEX_EMAIL_BACKFILL_ENABLED !== "true") {
      return emptyResult("disabled", started, opts.now);
    }
  }

  const rateMs = Math.max(
    RATE_MS_HARD_FLOOR,
    opts.rateMsPerDomain ?? DEFAULT_RATE_MS,
  );
  const batchSize = Math.max(
    1,
    Math.min(BATCH_HARD_CAP, opts.batchSize ?? 25),
  );

  const result = await withClient(async (client) => {
    // Fast fail-safe · if migration 202 has not landed, the column
    // does not exist and the backfill cursor index is absent. Detect
    // and skip rather than throw into the void. Also detect migration
    // 203 (Phase 1.4 lease columns) · when absent, we fall back to the
    // Phase 1.3 cursor pattern (no atomic lease · best-effort
    // email_last_attempted_at advance).
    const colCheck = await client.query(
      `SELECT
         EXISTS(
           SELECT 1 FROM information_schema.columns
           WHERE table_schema='nex' AND table_name='business_canonical'
             AND column_name='qualification_status'
         ) AS mig202,
         EXISTS(
           SELECT 1 FROM information_schema.columns
           WHERE table_schema='nex' AND table_name='business_canonical'
             AND column_name='email_lease_token'
         ) AS mig203`,
    );
    const mstate = (colCheck.rows[0] as
      | { mig202?: unknown; mig203?: unknown }
      | undefined) ?? {};
    const mig202 = Boolean(mstate.mig202);
    const mig203 = Boolean(mstate.mig203);
    if (!mig202) {
      return emptyResult("migration_202_absent", started, opts.now);
    }

    // Fresh per-tick claim token · identifies rows this tick leased
    // when migration 203 is present. CAS'd on both the result UPDATE
    // and the recovery UPDATE so a stale (expired-lease) walker never
    // overwrites a fresh claim's work.
    const claimToken = mig203 ? randomUUID() : null;

    // Pull the next batch of eligible rows ordered by cursor.
    //
    // Phase 1.3 WHERE clause:
    //   · qualification_status='PENDING'  → never-walked rows
    //   · qualification_status='UNQUALIFIED' AND
    //     (email_last_attempted_at IS NULL
    //      OR email_last_attempted_at < now() - 7 days)
    //                                     → retry transient failures
    //
    //   DISQUALIFIED is DELIBERATELY excluded · admin lock, see the
    //   preservation guards in the UPDATE and the doctrine header.
    //   QUALIFIED is excluded too · once a human verified the address,
    //   the backfill walker does not touch it.
    //
    // NULLS FIRST ensures never-attempted rows run before retry
    // candidates on the same tick. The partial index
    // `idx_bc_email_backfill_cursor` is sized for the PENDING subset ·
    // UNQUALIFIED retry candidates will fall back to a sequential scan
    // on first run which is acceptable at expected table sizes (OSM
    // seed ~35k rows). If retry volume ever matters, migration 203
    // can widen the partial index predicate.
    // Two SELECT paths · branched on migration 203 presence:
    //
    //   mig203 PRESENT  · atomic CTE claim · stamps lease_token +
    //                     lease_expires_at inside FOR UPDATE SKIP LOCKED.
    //                     Two overlapping ticks never see the same rows.
    //                     Mirrors nex.delivery_jobs.leaseNextJob (sealed).
    //
    //   mig203 ABSENT   · Phase 1.3 cursor-only SELECT · best-effort.
    //                     Concurrent ticks CAN pick the same rows (owner
    //                     accepts the trade-off until 203 is applied).
    //
    // In both paths the WHERE clause carries the same eligibility
    // predicate · PENDING OR (UNQUALIFIED AND cooldown satisfied).
    // DISQUALIFIED and QUALIFIED are excluded by design.
    const batch = mig203
      ? await client.query(
          `
          WITH cte AS (
            SELECT canonical_business_id
            FROM nex.business_canonical
            WHERE (
              qualification_status = 'PENDING'
              OR (
                qualification_status = 'UNQUALIFIED'
                AND (
                  email_last_attempted_at IS NULL
                  OR email_last_attempted_at < now() - ($2 || ' days')::interval
                )
              )
            )
            AND (
              email_lease_token IS NULL
              OR email_lease_expires_at < now()
            )
            ORDER BY email_last_attempted_at NULLS FIRST, canonical_business_id
            LIMIT $1
            FOR UPDATE SKIP LOCKED
          )
          UPDATE nex.business_canonical bc
             SET email_lease_token      = $3::uuid,
                 email_lease_expires_at = now() + ($4::integer || ' milliseconds')::interval
            FROM cte
           WHERE bc.canonical_business_id = cte.canonical_business_id
          RETURNING bc.canonical_business_id, bc.website_apex, bc.country
          `,
          [batchSize, UNQUALIFIED_RETRY_COOLDOWN_DAYS, claimToken, WALKER_LEASE_MS],
        )
      : await client.query(
          `
          SELECT canonical_business_id, website_apex, country
          FROM nex.business_canonical
          WHERE qualification_status = 'PENDING'
             OR (
                  qualification_status = 'UNQUALIFIED'
                  AND (
                    email_last_attempted_at IS NULL
                    OR email_last_attempted_at < now() - ($2 || ' days')::interval
                  )
                )
          ORDER BY email_last_attempted_at NULLS FIRST, canonical_business_id
          LIMIT $1
          `,
          [batchSize, UNQUALIFIED_RETRY_COOLDOWN_DAYS],
        );

    if (batch.rows.length === 0) {
      return emptyResult("no_pending_rows", started, opts.now);
    }

    let attempted = 0;
    let email_found = 0;
    let email_not_found = 0;
    let email_invalid = 0;
    let errors = 0;

    // Per-domain in-process throttle · tracks the next earliest ms at
    // which another fetch to this domain is permitted. Different
    // domains proceed in parallel · same domain serialises.
    const nextSlotByDomain = new Map<string, number>();

    // Narrow each row to the shape our SELECT produced. `withClient`'s
    // sealed client type returns `Record<string, unknown>` rows · we
    // apply the narrow once at the loop boundary.
    const batchRows = batch.rows as unknown as ReadonlyArray<{
      canonical_business_id: string;
      website_apex: string | null;
      country: string;
    }>;

    for (const row of batchRows) {
      // Deadline check · leaves time to UPDATE the attempt timestamp
      // and return a honest report rather than being killed mid-write.
      const nowMs = (opts.now?.() ?? new Date()).getTime();
      if (nowMs - started > TICK_DEADLINE_MS - 15_000) {
        return finalReport(
          "deadline",
          attempted,
          email_found,
          email_not_found,
          email_invalid,
          errors,
          started,
          opts.now,
        );
      }

      attempted++;

      // Attempt timestamp is written regardless of outcome so the
      // cursor advances deterministically.
      let newStatus: "FOUND" | "VALIDATED" | "INVALID" | "NOT_FOUND" =
        "NOT_FOUND";
      let newEmail: string | null = null;
      let newSourceUrl: string | null = null;

      try {
        // If there's no website_apex, the website walker cannot help ·
        // mark NOT_FOUND and advance.
        if (!row.website_apex) {
          newStatus = "NOT_FOUND";
        } else {
          // Rate limit per domain. Compute the domain from the apex
          // (which is already an apex per the sealed canonical shape).
          const domain = row.website_apex;
          const next = nextSlotByDomain.get(domain) ?? 0;
          const delta = Math.max(0, next - Date.now());
          if (delta > 0) await sleep(delta);
          nextSlotByDomain.set(domain, Date.now() + rateMs);

          // Walk the website · the sealed executor is at
          // src/lib/nex/harvest/website-walk-executor.ts. It currently
          // defaults to NULL_FETCHER (refuses every URL) so this call
          // returns `not_found` until the owner wires a real fetcher ·
          // gated by Phase-4 of the rollout order above.
          //
          // Phase 1.3: the walker now routes any candidate through the
          // sealed validator (`validateEmailForBusiness`) · the
          // orchestrator never persists an email that failed the format
          // gate and never promotes to QUALIFIED without the full
          // three-layer VALIDATED contract (format + authoritative
          // source attribution + DNS MX).
          const walked = await walkOneRowSafe(
            row.canonical_business_id,
            domain,
            opts.fetchCandidate ?? DORMANT_FETCHER,
            opts.validate ?? defaultValidator,
          );
          if (walked.kind === "found") {
            newEmail = walked.email;
            newSourceUrl = walked.sourceUrl;
            newStatus = walked.status;
          } else if (walked.kind === "invalid_format") {
            newStatus = "INVALID";
          } else {
            newStatus = "NOT_FOUND";
          }
        }
      } catch {
        errors++;
        // Phase 1.3 cursor-advance recovery · if the walker threw, we
        // stamp email_last_attempted_at = now() on this row (and nothing
        // else) so the next tick does not immediately re-select the
        // same errored row. The 7-day cooldown handles the long path ·
        // this just unsticks the inner cursor. Preserves email /
        // email_status / qualification_status.
        //
        // Phase 1.4 · when migration 203 is present, this recovery
        // ALSO releases the atomic lease (clears lease_token +
        // expiry) with a CAS on the current claim token · a stale
        // walker whose lease expired cannot release a fresh claim.
        try {
          if (mig203) {
            // Phase 1.4.1 · CAS on BOTH token AND unexpired lease. A
            // walker whose lease has already expired cannot clear
            // another worker's claim, EVEN WHEN its token still
            // happens to match (expired-without-reclaim window).
            await client.query(
              `UPDATE nex.business_canonical
                  SET email_last_attempted_at = now(),
                      email_lease_token = NULL,
                      email_lease_expires_at = NULL
                WHERE canonical_business_id = $1
                  AND email_lease_token = $2::uuid
                  AND email_lease_expires_at > now()`,
              [row.canonical_business_id, claimToken],
            );
          } else {
            await client.query(
              `UPDATE nex.business_canonical
                  SET email_last_attempted_at = now()
                WHERE canonical_business_id = $1`,
              [row.canonical_business_id],
            );
          }
        } catch {
          // Even the cursor-only UPDATE failed · DB is unhappy. We've
          // counted the error · let the tick finish and surface the
          // count to the dashboard. Next tick will reselect this row
          // once the lease expires (mig203) or on NULLS FIRST (legacy).
        }
        continue;
      }

      // Idempotent write with sealed preservation guarantees:
      //   · email / email_source_url · COALESCE so a NOT_FOUND
      //     re-walk never nulls a previously-known address.
      //   · email_status · never downgrade VALIDATED → FOUND on a
      //     re-walk that merely saw the string again.
      //   · qualification_status · (owner directive 2026-10-16)
      //     only VALIDATED promotes to QUALIFIED · FOUND stays
      //     PENDING · NOT_FOUND / INVALID → UNQUALIFIED · but
      //     DISQUALIFIED is an admin lock we never overwrite and
      //     QUALIFIED is never downgraded by FOUND/NOT_FOUND.
      // Phase 1.4 · the result UPDATE carries a CAS on
      // email_lease_token when migration 203 is present. If the lease
      // expired (walker took longer than WALKER_LEASE_MS) and another
      // tick re-claimed this row, the CAS matches zero rows and the
      // older walker's result is DROPPED on the floor rather than
      // overwriting fresh work. The lease columns are cleared on
      // success so a future re-walk can claim cleanly.
      //
      // Phase 1.4.1 · the CAS now also requires `email_lease_expires_at
      // > now()`. Previously, a walker that hung past its 5-min lease
      // and whose row was NOT yet reclaimed could still write a stale
      // result (token unchanged, nothing else bounced it). The expiry
      // check closes that window · an expired walker is dropped even
      // without a concurrent reclaim.
      try {
        if (mig203) {
          await client.query(
            `
            UPDATE nex.business_canonical
               SET email                   = COALESCE($2, email),
                   email_source_url        = COALESCE($3, email_source_url),
                   email_verified_at       = CASE
                                              WHEN $2 IS NOT NULL THEN now()
                                              ELSE email_verified_at
                                            END,
                   email_status            = CASE
                                              WHEN email_status = 'VALIDATED'
                                                AND $4 IN ('FOUND','NOT_FOUND')
                                                THEN email_status
                                              ELSE $4
                                            END,
                   qualification_status    = CASE
                                              WHEN qualification_status = 'DISQUALIFIED'
                                                THEN qualification_status
                                              WHEN qualification_status = 'QUALIFIED'
                                                AND $4 IN ('FOUND','NOT_FOUND')
                                                THEN qualification_status
                                              WHEN $4 = 'VALIDATED'
                                                THEN 'QUALIFIED'
                                              WHEN $4 = 'FOUND'
                                                THEN 'PENDING'
                                              WHEN $4 IN ('NOT_FOUND','INVALID')
                                                THEN 'UNQUALIFIED'
                                              ELSE qualification_status
                                            END,
                   email_last_attempted_at = now(),
                   email_lease_token       = NULL,
                   email_lease_expires_at  = NULL
             WHERE canonical_business_id = $1
               AND email_lease_token = $5::uuid
               AND email_lease_expires_at > now()
            `,
            [row.canonical_business_id, newEmail, newSourceUrl, newStatus, claimToken],
          );
        } else {
          await client.query(
            `
            UPDATE nex.business_canonical
               SET email                   = COALESCE($2, email),
                   email_source_url        = COALESCE($3, email_source_url),
                   email_verified_at       = CASE
                                              WHEN $2 IS NOT NULL THEN now()
                                              ELSE email_verified_at
                                            END,
                   email_status            = CASE
                                              WHEN email_status = 'VALIDATED'
                                                AND $4 IN ('FOUND','NOT_FOUND')
                                                THEN email_status
                                              ELSE $4
                                            END,
                   qualification_status    = CASE
                                              WHEN qualification_status = 'DISQUALIFIED'
                                                THEN qualification_status
                                              WHEN qualification_status = 'QUALIFIED'
                                                AND $4 IN ('FOUND','NOT_FOUND')
                                                THEN qualification_status
                                              WHEN $4 = 'VALIDATED'
                                                THEN 'QUALIFIED'
                                              WHEN $4 = 'FOUND'
                                                THEN 'PENDING'
                                              WHEN $4 IN ('NOT_FOUND','INVALID')
                                                THEN 'UNQUALIFIED'
                                              ELSE qualification_status
                                            END,
                   email_last_attempted_at = now()
             WHERE canonical_business_id = $1
            `,
            [row.canonical_business_id, newEmail, newSourceUrl, newStatus],
          );
        }
        // Counter semantics (REVISED): "email_found" means an address
        // was observed (FOUND or VALIDATED), NOT that qualification
        // promoted to QUALIFIED. The dashboard's email-status
        // breakdown is the source of truth for status counts; the
        // qualification counts are a separate section.
        if (newStatus === "FOUND" || newStatus === "VALIDATED") email_found++;
        else if (newStatus === "INVALID") email_invalid++;
        else email_not_found++;
      } catch {
        errors++;
        // Phase 1.3 cursor-advance recovery · the main UPDATE threw ·
        // run a cursor-only UPDATE so this row doesn't block the next
        // tick's batch head. If this also fails, we accept that next
        // tick will reselect · do not swallow further.
        //
        // Phase 1.4 · lease release path (mig203) · CAS on the current
        // claim token so a stale walker cannot clear a fresh claim.
        //
        // Phase 1.4.1 · CAS also requires an unexpired lease ·
        // closes the expired-without-reclaim window.
        try {
          if (mig203) {
            await client.query(
              `UPDATE nex.business_canonical
                  SET email_last_attempted_at = now(),
                      email_lease_token = NULL,
                      email_lease_expires_at = NULL
                WHERE canonical_business_id = $1
                  AND email_lease_token = $2::uuid
                  AND email_lease_expires_at > now()`,
              [row.canonical_business_id, claimToken],
            );
          } else {
            await client.query(
              `UPDATE nex.business_canonical
                  SET email_last_attempted_at = now()
                WHERE canonical_business_id = $1`,
              [row.canonical_business_id],
            );
          }
        } catch {
          /* reselect next tick · see note above */
        }
      }
    }

    return finalReport(
      undefined,
      attempted,
      email_found,
      email_not_found,
      email_invalid,
      errors,
      started,
      opts.now,
    );
  });

  return (
    result ??
    emptyResult("no_pending_rows", started, opts.now)
  );
}

// ─── helpers ────────────────────────────────────────────────────────

function emptyResult(
  reason: EmailBackfillBatchResult["skipped_reason"],
  started: number,
  now?: () => Date,
): EmailBackfillBatchResult {
  return {
    ok: true,
    attempted: 0,
    email_found: 0,
    email_not_found: 0,
    email_invalid: 0,
    errors: 0,
    skipped_reason: reason,
    batch_ms: (now?.() ?? new Date()).getTime() - started,
  };
}

function finalReport(
  reason: EmailBackfillBatchResult["skipped_reason"],
  attempted: number,
  email_found: number,
  email_not_found: number,
  email_invalid: number,
  errors: number,
  started: number,
  now?: () => Date,
): EmailBackfillBatchResult {
  return {
    ok: errors === 0,
    attempted,
    email_found,
    email_not_found,
    email_invalid,
    errors,
    ...(reason ? { skipped_reason: reason } : {}),
    batch_ms: (now?.() ?? new Date()).getTime() - started,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Thin wrapper around the sealed website-walk executor. Returns a
 * discriminated result the orchestrator can map onto `email_status`
 * without caring about the walker's internal shape.
 *
 * CURRENT BEHAVIOUR (sealed 2026-10-16 · Phase 1.3):
 *   The default fetcher (DORMANT_FETCHER) returns null · this wrapper
 *   returns `not_found`. When the owner wires a real fetcher (Phase 4
 *   of the rollout order via `opts.fetchCandidate`), this wrapper
 *   routes the candidate through the sealed VALIDATED-contract
 *   validator:
 *
 *     fetcher returns null              → kind: "not_found"
 *     fetcher returns a candidate ·
 *       validator: "INVALID"            → kind: "invalid_format"
 *       validator: "FOUND"              → kind: "found", status: "FOUND"
 *       validator: "VALIDATED"          → kind: "found", status: "VALIDATED"
 *
 *   The validator is the ONLY path that emits `status: "VALIDATED"` ·
 *   which the orchestrator's UPDATE CASE maps to
 *   `qualification_status = 'QUALIFIED'`. This closes the Phase 1.2
 *   audit's Finding 2 (VALIDATED had no runtime producer).
 *
 *   The wiring is intentionally gated so an accidental env-flag flip
 *   cannot start outbound HTTP today · the fetcher must be explicitly
 *   injected by the caller.
 */
async function walkOneRowSafe(
  canonicalId: string,
  domain: string,
  fetchCandidate: FetchCandidate,
  validate: ValidateCandidate,
): Promise<
  | { kind: "found"; email: string; sourceUrl: string; status: "FOUND" | "VALIDATED" }
  | { kind: "not_found" }
  | { kind: "invalid_format" }
> {
  const candidate = await fetchCandidate({
    canonicalBusinessId: canonicalId,
    websiteApex: domain,
  });
  if (!candidate) return { kind: "not_found" };

  const result = await validate(candidate.email, domain);
  if (result.status === "INVALID") return { kind: "invalid_format" };

  // Validator returned FOUND or VALIDATED · persist the address, let
  // the orchestrator UPDATE decide qualification_status via its CASE.
  return {
    kind: "found",
    email: candidate.email,
    sourceUrl: candidate.sourceUrl,
    status: result.status,
  };
}
