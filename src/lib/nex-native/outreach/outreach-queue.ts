// src/lib/nex-native/outreach/outreach-queue.ts
//
// NEX Outreach · persistent dormant queue · Phase 1.4 · sealed 2026-10-16.
// --------------------------------------------------------------------
// Three capabilities · all dormant by default:
//
//   enqueueEligibleContacts({ template_id, limit })
//     Reads a batch of eligible rows (via outreach-eligibility.ts)
//     and INSERTs one queue row per eligible contact. Idempotent on
//     the active-per-business-template unique index.
//
//   claimForSend({ worker_id, max = 1 })
//     Atomic claim: CTE with SELECT ... FOR UPDATE SKIP LOCKED + lease
//     TTL. Mirrors the sealed `nex.delivery_jobs.leaseNextJob` pattern.
//     RE-RUNS the suppression check mid-claim · if the email was
//     suppressed between enqueue and send, status flips to 'suppressed'
//     without the ESP being contacted.
//
//   markSent / markFailed(queue_id, worker_id)
//     Completes a claimed row. CAS on lease_owner so a stale worker
//     cannot overwrite a fresh claim.
//
// All three return a `skipped_reason` instead of throwing when the
// pre-conditions are unmet (dormant env, migration absent, empty
// batch). The HQ dashboard surfaces every skip truthfully.
//
// SAFEGUARDS AT BOTH BOUNDARIES
//   · enqueue  · eligibility predicate (outreach-eligibility.ts) +
//                NOT EXISTS suppression (same WHERE) +
//                unique-active-row index (DB-side)
//   · claim    · lease-owner CAS +
//                re-check suppression via isSuppressed() AT send-time ·
//                flips to 'suppressed' if the email was added to the
//                suppression table between enqueue and claim
//
// NON-GOALS (Phase 1.4)
//   · We DO NOT send mail. The claim returns a payload the caller
//     passes to its ESP adapter. The caller then calls markSent or
//     markFailed. This file does zero network I/O.
//   · We DO NOT retry a 'failed' row. A separate cron will sweep
//     'failed' rows and requeue based on attempts<max_attempts. That
//     cron lives in a future phase.
//   · We DO NOT support batched sends. One claim = one recipient.
//     Templates are per-row.
//
// Dormancy · `NEX_OUTREACH_ENABLED=true` is required for ALL three
// entry points. The suppression layer is NOT dormant · see the
// comment in outreach-suppression.ts for why.

import "server-only";
import { withClient } from "@/lib/nex/db";
import { randomUUID } from "node:crypto";
import { buildEligibilityBatchSql } from "./outreach-eligibility";
import {
  isSuppressed,
  recordHardBounce,
  recordOptOut,
  recordComplaint,
  recordAdminBlock,
  type SuppressionReason,
} from "./outreach-suppression";

/** Lease duration · 5 minutes · matches nex.delivery_jobs. */
const DEFAULT_LEASE_MS = 5 * 60 * 1000;

/** Hard cap on batch size · prevents an accidentally-long enqueue
 *  from writing thousands of rows in a single tick. */
const BATCH_HARD_CAP = 100;

export type QueueStatus =
  | "pending"
  | "running"
  | "sent"
  | "failed"
  | "suppressed"
  | "dead_letter";

export interface EnqueueOutcome {
  readonly ok: boolean;
  readonly inserted: number;
  readonly skipped_eligible: number; // rows that passed eligibility but a UNIQUE conflict suppressed re-queue
  readonly skipped_reason?:
    | "disabled"
    | "migration_202_absent"
    | "migration_203_absent"
    | "no_eligible_rows";
}

export interface ClaimOutcome {
  readonly ok: boolean;
  readonly claim?: {
    readonly queue_id: string;
    readonly canonical_business_id: string;
    readonly email: string;
    readonly template_id: string;
    readonly payload: Record<string, unknown>;
    readonly lease_owner: string;
    readonly lease_expires_at: string;
  };
  readonly suppressed_at_claim?: {
    readonly queue_id: string;
    readonly email: string;
    readonly reason: SuppressionReason;
  };
  readonly skipped_reason?:
    | "disabled"
    | "migration_203_absent"
    | "no_claimable_rows";
}

export interface CompleteOutcome {
  readonly ok: boolean;
  readonly affected: number;
  readonly skipped_reason?: "disabled" | "migration_203_absent" | "lease_lost";
}

export interface EnqueueOptions {
  readonly template_id: string;
  readonly country?: string | null;
  readonly limit?: number;
  readonly bypassEnvGateForTests?: boolean;
}

/** Enqueue up to `limit` eligible contacts for a given template.
 *  Returns the number actually inserted (0..limit). */
export async function enqueueEligibleContacts(
  opts: EnqueueOptions,
): Promise<EnqueueOutcome> {
  if (!opts.bypassEnvGateForTests && process.env.NEX_OUTREACH_ENABLED !== "true") {
    return {
      ok: true,
      inserted: 0,
      skipped_eligible: 0,
      skipped_reason: "disabled",
    };
  }
  const limit = Math.max(1, Math.min(BATCH_HARD_CAP, opts.limit ?? 25));

  const r = await withClient(async (client) => {
    const check = await client.query(
      `SELECT
         EXISTS(
           SELECT 1 FROM information_schema.columns
           WHERE table_schema='nex' AND table_name='business_canonical'
             AND column_name='qualification_status'
         ) AS mig202,
         EXISTS(
           SELECT 1 FROM information_schema.tables
           WHERE table_schema='nex' AND table_name='business_outreach_queue'
         ) AS mig203`,
    );
    const row = check.rows[0] as { mig202?: unknown; mig203?: unknown } | undefined;
    if (!row?.mig202) {
      return {
        ok: true,
        inserted: 0,
        skipped_eligible: 0,
        skipped_reason: "migration_202_absent" as const,
      };
    }
    if (!row?.mig203) {
      return {
        ok: true,
        inserted: 0,
        skipped_eligible: 0,
        skipped_reason: "migration_203_absent" as const,
      };
    }

    // Pull the eligible batch via the sealed predicate · no SQL built
    // inline here, so the five safeguards cannot drift.
    const { sql: batchSql, params } = buildEligibilityBatchSql({
      limit,
      country: opts.country ?? null,
    });
    const batch = await client.query(batchSql, [...params]);
    if (batch.rows.length === 0) {
      return {
        ok: true,
        inserted: 0,
        skipped_eligible: 0,
        skipped_reason: "no_eligible_rows" as const,
      };
    }

    let inserted = 0;
    let skipped_eligible = 0;
    for (const r of batch.rows) {
      const bcid = (r as { canonical_business_id?: string }).canonical_business_id!;
      const email = (r as { email?: string }).email!;
      // Idempotent INSERT · uq_boq_active_per_business_template
      // prevents a parallel active row for the same (business, template).
      const ins = await client.query(
        `INSERT INTO nex.business_outreach_queue
           (canonical_business_id, email, template_id, status, priority, scheduled_for, payload)
           VALUES ($1, $2, $3, 'pending', 100, now(), '{}'::jsonb)
         ON CONFLICT ON CONSTRAINT uq_boq_active_per_business_template
         DO NOTHING
         RETURNING queue_id`,
        [bcid, email, opts.template_id],
      );
      if ((ins.rows?.length ?? 0) > 0) inserted++;
      else skipped_eligible++;
    }
    return { ok: true, inserted, skipped_eligible };
  });
  return (
    r ?? {
      ok: true,
      inserted: 0,
      skipped_eligible: 0,
      skipped_reason: "disabled" as const,
    }
  );
}

export interface ClaimOptions {
  readonly worker_id: string;
  readonly bypassEnvGateForTests?: boolean;
  /** Clock injection for lease-expiry tests. */
  readonly now?: () => Date;
}

/** Claim the single next runnable row. Atomic via the sealed CTE +
 *  FOR UPDATE SKIP LOCKED pattern.
 *
 *  Mid-flight suppression · after the DB claim completes, this
 *  function re-queries `isSuppressed(email)`. If the email was added
 *  to the suppression table between enqueue and claim, the row is
 *  flipped to status='suppressed' and the function returns a
 *  `suppressed_at_claim` outcome. The ESP is NEVER contacted in
 *  this case · that's the belt-and-braces guarantee. */
export async function claimForSend(
  opts: ClaimOptions,
): Promise<ClaimOutcome> {
  if (!opts.bypassEnvGateForTests && process.env.NEX_OUTREACH_ENABLED !== "true") {
    return { ok: true, skipped_reason: "disabled" };
  }

  const r = await withClient(async (client) => {
    const check = await client.query(
      `SELECT EXISTS(
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='nex' AND table_name='business_outreach_queue'
       ) AS present`,
    );
    const present = Boolean(
      (check.rows[0] as { present?: unknown } | undefined)?.present,
    );
    if (!present) {
      return { ok: true, skipped_reason: "migration_203_absent" as const };
    }

    // Atomic claim · sealed CTE pattern mirroring nex.delivery_jobs.
    const res = await client.query(
      `WITH cte AS (
         SELECT queue_id
         FROM nex.business_outreach_queue
         WHERE (status = 'pending' AND scheduled_for <= now())
            OR (status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at < now()))
         ORDER BY priority ASC, scheduled_for ASC, queue_id
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE nex.business_outreach_queue q
          SET status = 'running',
              attempts = q.attempts + 1,
              started_at = COALESCE(q.started_at, now()),
              lease_owner = $1,
              lease_expires_at = now() + ($2::integer || ' milliseconds')::interval,
              updated_at = now()
         FROM cte
        WHERE q.queue_id = cte.queue_id
       RETURNING q.queue_id, q.canonical_business_id, q.email, q.template_id,
                 q.payload, q.lease_owner, q.lease_expires_at`,
      [opts.worker_id, DEFAULT_LEASE_MS],
    );
    const row = res.rows[0] as
      | {
          queue_id: string;
          canonical_business_id: string;
          email: string;
          template_id: string;
          payload: Record<string, unknown> | null;
          lease_owner: string;
          lease_expires_at: string;
        }
      | undefined;
    if (!row) {
      return { ok: true, skipped_reason: "no_claimable_rows" as const };
    }

    // Mid-flight suppression re-check. If the address was added to
    // the suppression table AFTER enqueue, we flip to 'suppressed'
    // WITHOUT contacting the ESP. The claim counts as consumed · the
    // caller will not re-claim this row because status is terminal.
    const sup = await isSuppressed(row.email);
    if (sup.suppressed) {
      await client.query(
        `UPDATE nex.business_outreach_queue
           SET status = 'suppressed',
               suppression_reason = $2,
               completed_at = now(),
               lease_owner = NULL,
               lease_expires_at = NULL,
               updated_at = now()
         WHERE queue_id = $1`,
        [row.queue_id, sup.reason ?? "opt_out"],
      );
      return {
        ok: true,
        suppressed_at_claim: {
          queue_id: row.queue_id,
          email: row.email,
          reason: sup.reason ?? "opt_out",
        },
      };
    }

    return {
      ok: true,
      claim: {
        queue_id: row.queue_id,
        canonical_business_id: row.canonical_business_id,
        email: row.email,
        template_id: row.template_id,
        payload: row.payload ?? {},
        lease_owner: row.lease_owner,
        lease_expires_at: row.lease_expires_at,
      },
    };
  });
  return r ?? { ok: true, skipped_reason: "disabled" };
}

export interface CompleteOptions {
  readonly queue_id: string;
  readonly worker_id: string;
  readonly bypassEnvGateForTests?: boolean;
}

/** Mark a claimed row as 'sent'. CAS on lease_owner so a stale
 *  worker whose lease expired cannot overwrite a fresh claim. */
export async function markSent(opts: CompleteOptions): Promise<CompleteOutcome> {
  if (!opts.bypassEnvGateForTests && process.env.NEX_OUTREACH_ENABLED !== "true") {
    return { ok: true, affected: 0, skipped_reason: "disabled" };
  }
  const r = await withClient(async (client) => {
    const check = await client.query(
      `SELECT EXISTS(
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='nex' AND table_name='business_outreach_queue'
       ) AS present`,
    );
    if (!Boolean((check.rows[0] as { present?: unknown } | undefined)?.present)) {
      return {
        ok: true,
        affected: 0,
        skipped_reason: "migration_203_absent" as const,
      };
    }
    const res = await client.query(
      `UPDATE nex.business_outreach_queue
          SET status = 'sent',
              completed_at = now(),
              lease_owner = NULL,
              lease_expires_at = NULL,
              last_error = NULL,
              updated_at = now()
        WHERE queue_id = $1
          AND lease_owner = $2
          AND status = 'running'`,
      [opts.queue_id, opts.worker_id],
    );
    const affected = res.rowCount ?? 0;
    if (affected === 0) {
      return { ok: true, affected, skipped_reason: "lease_lost" as const };
    }
    return { ok: true, affected };
  });
  return r ?? { ok: true, affected: 0, skipped_reason: "disabled" };
}

export interface MarkFailedOptions extends CompleteOptions {
  readonly error: string;
  /** If true · forces 'dead_letter' regardless of attempts/max_attempts. */
  readonly permanent?: boolean;
}

/** Mark a claimed row as 'failed'. If attempts >= max_attempts the
 *  row goes 'dead_letter' · otherwise 'failed' and a future retry
 *  sweep will reset it to 'pending'. */
export async function markFailed(
  opts: MarkFailedOptions,
): Promise<CompleteOutcome> {
  if (!opts.bypassEnvGateForTests && process.env.NEX_OUTREACH_ENABLED !== "true") {
    return { ok: true, affected: 0, skipped_reason: "disabled" };
  }
  const r = await withClient(async (client) => {
    const check = await client.query(
      `SELECT EXISTS(
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='nex' AND table_name='business_outreach_queue'
       ) AS present`,
    );
    if (!Boolean((check.rows[0] as { present?: unknown } | undefined)?.present)) {
      return {
        ok: true,
        affected: 0,
        skipped_reason: "migration_203_absent" as const,
      };
    }
    const res = await client.query(
      `UPDATE nex.business_outreach_queue
          SET status = CASE
                         WHEN $3::boolean THEN 'dead_letter'
                         WHEN attempts >= max_attempts THEN 'dead_letter'
                         ELSE 'failed'
                       END,
              last_error = LEFT($4, 4000),
              completed_at = now(),
              lease_owner = NULL,
              lease_expires_at = NULL,
              updated_at = now()
        WHERE queue_id = $1
          AND lease_owner = $2
          AND status = 'running'`,
      [opts.queue_id, opts.worker_id, Boolean(opts.permanent), opts.error],
    );
    const affected = res.rowCount ?? 0;
    if (affected === 0) {
      return { ok: true, affected, skipped_reason: "lease_lost" as const };
    }
    return { ok: true, affected };
  });
  return r ?? { ok: true, affected: 0, skipped_reason: "disabled" };
}

// ────────────────────────────────────────────────────────────────────
// Phase 1.4.1 · send-boundary suppression · sanctioned Phase 1.5
// interface. The Phase 1.5 send-worker MUST call this function (not
// a bespoke SQL path) whenever it discovers an email is suppressed
// AFTER the row has already been claimed with `claimForSend`.
//
// Design intent · see docs/doctrine/nex-outreach-eligibility-2026-10-16.md
// §10 (the final-check-vs-ESP-accept race).
//
//   · Dormant-gated · identical to the rest of the queue layer.
//   · Fail-safe for migration 203 absent.
//   · DEFENCE-IN-DEPTH · re-checks `isSuppressed(email)` as the
//     FIRST act. If the caller passes an email that is NOT actually
//     suppressed, the function refuses the state transition and
//     returns `skipped_reason='not_suppressed'`. Callers cannot
//     weaponise this function to mark a legitimate recipient
//     'suppressed' without the suppression table backing it up.
//   · CAS on BOTH `lease_owner` AND `status='running'`. A stale
//     worker whose lease was reclaimed cannot overwrite a newer
//     state (sent/failed/suppressed/dead_letter) with 'suppressed'.
//   · ALSO writes the suppression table (idempotent via
//     outreach-suppression's ON CONFLICT DO NOTHING) · catches the
//     case where the caller observed the opt-out via an ESP webhook
//     payload that bypassed `recordHardBounce` / `recordComplaint`
//     (defensive · in production the webhook handler should write
//     the suppression first, this is belt-and-braces).
//   · NEVER sends email. NEVER calls the ESP.
// ────────────────────────────────────────────────────────────────────

export interface MarkSuppressedAtSendBoundaryOptions {
  readonly queue_id: string;
  readonly worker_id: string;
  /** The email the caller observed as suppressed. The function
   *  re-verifies this against the suppression table before any
   *  state change · defence against caller error. */
  readonly email: string;
  /** The suppression reason the caller observed (e.g. the ESP
   *  webhook payload said hard_bounce). Used to populate
   *  `suppression_reason` on the queue row AND to insert a
   *  suppression-table row if one does not already exist. */
  readonly reason: SuppressionReason;
  /** Optional webhook / caller-side evidence. Written into the
   *  suppression table only if a fresh insert happens there. */
  readonly evidence?: Record<string, unknown>;
  /** The source string recorded alongside the suppression table
   *  insert (if fresh). Default 'send_boundary'. */
  readonly source?: string;
  readonly bypassEnvGateForTests?: boolean;
}

export interface MarkSuppressedAtSendBoundaryOutcome {
  readonly ok: boolean;
  readonly affected: number;
  readonly recorded_suppression?: {
    readonly inserted: boolean;
    readonly reason: SuppressionReason;
  };
  readonly skipped_reason?:
    | "disabled"
    | "migration_203_absent"
    | "lease_lost"
    | "not_suppressed";
}

export async function markSuppressedAtSendBoundary(
  opts: MarkSuppressedAtSendBoundaryOptions,
): Promise<MarkSuppressedAtSendBoundaryOutcome> {
  if (!opts.bypassEnvGateForTests && process.env.NEX_OUTREACH_ENABLED !== "true") {
    return { ok: true, affected: 0, skipped_reason: "disabled" };
  }

  // ─── Defence-in-depth · re-verify the email is suppressed ───────
  //
  // This runs BEFORE any state change. If the caller is wrong (bug ·
  // webhook race · misconfigured ESP payload parser), we refuse to
  // transition the queue row. The right failure mode is "the send
  // retries later" not "we silently drop a legitimate recipient."
  const sup = await isSuppressed(opts.email);
  if (sup.migration_203_absent) {
    return {
      ok: true,
      affected: 0,
      skipped_reason: "migration_203_absent",
    };
  }
  if (!sup.suppressed) {
    // The caller observed something that looks like suppression but
    // the suppression table disagrees. We insert the caller's claim
    // (idempotent · ON CONFLICT DO NOTHING via the public write
    // helpers) so a future `isSuppressed` call will see it, then
    // retry the check once. This closes the webhook-first race
    // where the ESP's suppression webhook arrived at the queue
    // worker but the suppression-recording webhook handler hasn't
    // written yet.
    const recorded = await recordSuppressionBoundary(
      opts.email,
      opts.reason,
      opts.source ?? "send_boundary",
      opts.evidence ?? {},
    );
    if (!recorded.ok) {
      return {
        ok: true,
        affected: 0,
        skipped_reason: "not_suppressed",
      };
    }
    const sup2 = await isSuppressed(opts.email);
    if (!sup2.suppressed) {
      return {
        ok: true,
        affected: 0,
        skipped_reason: "not_suppressed",
      };
    }
  }

  // Resolved reason · prefer whatever the suppression table says ·
  // the caller's claim may be stale.
  const resolvedReason: SuppressionReason =
    sup.reason ?? opts.reason;

  const r = await withClient(async (client) => {
    const check = await client.query(
      `SELECT EXISTS(
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='nex' AND table_name='business_outreach_queue'
       ) AS present`,
    );
    if (
      !Boolean((check.rows[0] as { present?: unknown } | undefined)?.present)
    ) {
      return {
        ok: true,
        affected: 0,
        skipped_reason: "migration_203_absent" as const,
      };
    }
    // CAS · ONLY the current lease owner can flip the row AND only
    // if the row is still in `running`. A stale worker whose lease
    // expired and whose row was already markSent / markFailed /
    // suppressed cannot overwrite the newer state.
    const res = await client.query(
      `UPDATE nex.business_outreach_queue
          SET status = 'suppressed',
              suppression_reason = $3,
              completed_at = now(),
              lease_owner = NULL,
              lease_expires_at = NULL,
              updated_at = now()
        WHERE queue_id = $1
          AND lease_owner = $2
          AND status = 'running'`,
      [opts.queue_id, opts.worker_id, resolvedReason],
    );
    const affected = res.rowCount ?? 0;
    if (affected === 0) {
      return { ok: true, affected, skipped_reason: "lease_lost" as const };
    }
    // Ensure the suppression table has a row for this email · the
    // claim-time check will catch future enqueues cleanly. Idempotent
    // via the public helper (ON CONFLICT DO NOTHING).
    const inserted = await recordSuppressionBoundary(
      opts.email,
      resolvedReason,
      opts.source ?? "send_boundary",
      opts.evidence ?? {},
    );
    return {
      ok: true,
      affected,
      recorded_suppression: {
        inserted: inserted.inserted,
        reason: resolvedReason,
      },
    };
  });
  return r ?? { ok: true, affected: 0, skipped_reason: "disabled" };
}

/** Internal · dispatches to the appropriate public recorder in
 *  outreach-suppression. Keeps all suppression writes routed through
 *  the four sanctioned reason-tagged helpers rather than inlining a
 *  bespoke INSERT here. */
async function recordSuppressionBoundary(
  email: string,
  reason: SuppressionReason,
  source: string,
  evidence: Record<string, unknown>,
): Promise<{ ok: boolean; inserted: boolean }> {
  switch (reason) {
    case "hard_bounce":
      return recordHardBounce(email, source, evidence);
    case "opt_out":
      return recordOptOut(email, source, evidence);
    case "complaint":
      return recordComplaint(email, source, evidence);
    case "admin_block":
      return recordAdminBlock(email, source, evidence);
  }
}

/** Fresh worker id · one per process. Prefix with hostname when
 *  available so the HQ dashboard can see which worker is leading. */
export function newWorkerId(hostname = "nex-worker"): string {
  return `${hostname}:${randomUUID()}`;
}
