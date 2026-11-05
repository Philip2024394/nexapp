// src/lib/nex-native/business-trial/service.ts
//
// G1 · Business Trial service layer with SELECT ... FOR UPDATE row lock.
// =======================================================================
//
// Sealed per owner authorisation 2026-10-22 · G1 Design Package §4 + §6.
//
// S1 PRIMARY concurrency defence: this module performs every state-changing
// operation inside a Postgres transaction that holds `SELECT ... FOR UPDATE`
// on the account row. Combined with:
//   · UPDATE WHERE clause (belt-and-braces · catches races the lock should
//     prevent)
//   · BEFORE UPDATE trigger `tr_nex_account_trial_coexistence` (fail-safe
//     for direct SQL that forgets the lock · migration 214)
//
// Why direct `pg` instead of @supabase/supabase-js:
//   `SELECT ... FOR UPDATE` requires an explicit transaction with the SELECT
//   and the UPDATE on the same connection. The REST client (`.from().update()`)
//   does not expose this transaction semantics. Direct pg via DATABASE_URL
//   (the sealed pooler for `ijvqdvsvwtwxzcqmoqit`) is the correct primitive.
//   Pattern precedent: src/lib/nex-native/trust/trust-score-service.ts.
//
// This module reads/writes ONLY the 4 trial columns on nex_account. It does
// NOT read or write `tier`, `bisnis_expires_at`, `tier_activated_at`,
// `payment_provider*`, or any payment-attempt state (B1: payment conversion
// is deferred to G3).

import "server-only";
import { Pool, type PoolClient } from "pg";
import type { NexBusinessTrialStatus } from "../types";
import {
  recordTrialRateLimit,
  NexBusinessTrialRateLimitError,
  type NexBusinessTrialRateLimitAction,
} from "./rate-limit";

// ---------------------------------------------------------------------------
// Lazy singleton pool · same pattern as trust-score-service.ts
// ---------------------------------------------------------------------------

let _pool: Pool | null = null;
function pool(): Pool {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "nex-business-trial/service: missing DATABASE_URL env var. " +
        "DATABASE_URL must point at the sealed NEX Supabase pooler " +
        "(project ijvqdvsvwtwxzcqmoqit).",
    );
  }
  _pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
  });
  return _pool;
}

// ---------------------------------------------------------------------------
// Feature flag · owner-sealed 2026-11-06 scope-reduction LOCK · default TRUE
// ---------------------------------------------------------------------------
// Original Q3 approval (2026-10-18) set default FALSE as a deliberate hold
// at signup. Shop Entitlement Contract § K-3 LOCK (2026-11-06) retires that
// hold: "7-day trial auto-fires on first business signup. No card required."
// Phase 4 flag flip aligns the runtime default with the locked contract.
// Env var remains an opt-out escape hatch (set to "false" to disable).

/** Returns true unless the env var is explicitly set to 'false'. All
 *  state-changing endpoints MUST call this and 403 when false. */
export function isBusinessTrialEnabled(): boolean {
  return process.env.NEX_BUSINESS_TRIAL_ENABLED !== "false";
}

// ---------------------------------------------------------------------------
// Error types · caller maps to HTTP status
// ---------------------------------------------------------------------------

export type BusinessTrialErrorCode =
  | "business_trial_not_available" // flag disabled
  | "already_used" // K1 one-trial-per-lifetime violation
  | "themes_trial_still_active" // D1 coexistence violation
  | "trial_not_active" // operation requires status='active'
  | "already_opted_out" // opt-out called when opt_out=true
  | "not_opted_out" // resume called when opt_out=false
  | "within_24h_of_expiry"; // D2-a reversal cutoff

export class NexBusinessTrialError extends Error {
  constructor(readonly code: BusinessTrialErrorCode, message?: string) {
    super(message ?? code);
    this.name = "NexBusinessTrialError";
  }
}

export { NexBusinessTrialRateLimitError };

// ---------------------------------------------------------------------------
// Shape returned to API callers
// ---------------------------------------------------------------------------

export interface NexBusinessTrialStateView {
  readonly status: NexBusinessTrialStatus | null;
  readonly start_at: string | null;
  readonly end_at: string | null;
  readonly hours_remaining: number | null;
  readonly conversion_opt_out: boolean;
}

interface RowShape {
  business_trial_status: NexBusinessTrialStatus | null;
  business_trial_start_at: Date | null;
  business_trial_end_at: Date | null;
  business_trial_conversion_opt_out: boolean;
  themes_trial_used_at: Date | null;
}

function toView(row: RowShape, nowMs: number = Date.now()): NexBusinessTrialStateView {
  const endMs = row.business_trial_end_at
    ? row.business_trial_end_at.getTime()
    : null;
  const hoursRemaining =
    endMs !== null && row.business_trial_status === "active"
      ? Math.max(0, (endMs - nowMs) / (60 * 60 * 1000))
      : null;
  return {
    status: row.business_trial_status,
    start_at: row.business_trial_start_at
      ? row.business_trial_start_at.toISOString()
      : null,
    end_at: row.business_trial_end_at
      ? row.business_trial_end_at.toISOString()
      : null,
    hours_remaining: hoursRemaining,
    conversion_opt_out: row.business_trial_conversion_opt_out,
  };
}

// ---------------------------------------------------------------------------
// Service functions · each wraps in a transaction with SELECT ... FOR UPDATE
// ---------------------------------------------------------------------------

async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    client.release();
  }
}

/** Read current trial state. Non-transactional (status endpoint is read-only). */
export async function getTrialStatus(
  accountId: string,
): Promise<NexBusinessTrialStateView> {
  const { rows } = await pool().query<RowShape>(
    `SELECT business_trial_status, business_trial_start_at, business_trial_end_at,
            business_trial_conversion_opt_out, themes_trial_used_at
       FROM nex_account WHERE id = $1`,
    [accountId],
  );
  if (rows.length === 0) {
    // Caller already verified session; account must exist. If not, treat as never-used.
    return {
      status: null,
      start_at: null,
      end_at: null,
      hours_remaining: null,
      conversion_opt_out: false,
    };
  }
  return toView(rows[0]);
}

/**
 * K1 one-shot activation. Enforces K1 + D1 under row lock.
 *
 * Preconditions:
 *   · feature flag enabled (Q3)
 *   · business_trial_status IS NULL (K1)
 *   · themes_trial_used_at is NULL or older than 168h (D1)
 *
 * On success: sets business_trial_status='active', timestamps set per K9.
 */
export async function startBusinessTrial(
  accountId: string,
): Promise<NexBusinessTrialStateView> {
  if (!isBusinessTrialEnabled()) {
    throw new NexBusinessTrialError("business_trial_not_available");
  }

  // Advisory rate limit (DB preconditions remain authoritative · see
  // rate-limit.ts header comment).
  recordTrialRateLimit(accountId, "trial_start");

  return withTx(async (client) => {
    // S1 PRIMARY · acquire exclusive row lock on the account row
    const { rows: lockRows } = await client.query<RowShape>(
      `SELECT business_trial_status, business_trial_start_at, business_trial_end_at,
              business_trial_conversion_opt_out, themes_trial_used_at
         FROM nex_account WHERE id = $1 FOR UPDATE`,
      [accountId],
    );
    if (lockRows.length === 0) {
      throw new NexBusinessTrialError(
        "already_used",
        "account not found during trial start",
      );
    }
    const current = lockRows[0];

    // K1 precondition: business_trial_status must be NULL (lifetime one-shot)
    if (current.business_trial_status !== null) {
      throw new NexBusinessTrialError("already_used");
    }

    // D1 precondition: themes trial must not be currently active (within 168h window)
    if (current.themes_trial_used_at) {
      const themesEndMs =
        current.themes_trial_used_at.getTime() + 168 * 60 * 60 * 1000;
      if (Date.now() < themesEndMs) {
        throw new NexBusinessTrialError("themes_trial_still_active");
      }
    }

    // Belt-and-braces conditional UPDATE · WHERE preconditions double-check
    // what the row lock already guarantees. The DB CHECK constraint
    // `nex_account_business_trial_end_matches_start` enforces K9 exact-168h.
    const { rows: updated, rowCount } = await client.query<RowShape>(
      `UPDATE nex_account
          SET business_trial_status = 'active',
              business_trial_start_at = now(),
              business_trial_end_at = now() + interval '168 hours'
        WHERE id = $1
          AND business_trial_status IS NULL
      RETURNING business_trial_status, business_trial_start_at, business_trial_end_at,
                business_trial_conversion_opt_out, themes_trial_used_at`,
      [accountId],
    );
    if (rowCount !== 1) {
      // The WHERE precondition was already satisfied under lock · 0 rows
      // means a race the lock should have prevented. Promote to typed error.
      throw new NexBusinessTrialError(
        "already_used",
        "update affected 0 rows under lock (unexpected race)",
      );
    }
    return toView(updated[0]);
  });
}

/**
 * D2 Action 1 · opt out of paid conversion. Trial continues to full 168h.
 *
 * Preconditions:
 *   · business_trial_status = 'active'
 *   · business_trial_conversion_opt_out = false
 *
 * Does NOT end the trial early. Does NOT trigger shop read-only (S2).
 */
export async function optOutConversion(
  accountId: string,
): Promise<NexBusinessTrialStateView> {
  recordTrialRateLimit(accountId, "trial_opt_out_conversion");

  return withTx(async (client) => {
    const { rows: lockRows } = await client.query<RowShape>(
      `SELECT business_trial_status, business_trial_start_at, business_trial_end_at,
              business_trial_conversion_opt_out, themes_trial_used_at
         FROM nex_account WHERE id = $1 FOR UPDATE`,
      [accountId],
    );
    if (lockRows.length === 0) {
      throw new NexBusinessTrialError("trial_not_active", "account not found");
    }
    const current = lockRows[0];

    if (current.business_trial_status !== "active") {
      throw new NexBusinessTrialError("trial_not_active");
    }
    if (current.business_trial_conversion_opt_out) {
      throw new NexBusinessTrialError("already_opted_out");
    }

    const { rows: updated, rowCount } = await client.query<RowShape>(
      `UPDATE nex_account
          SET business_trial_conversion_opt_out = true
        WHERE id = $1
          AND business_trial_status = 'active'
          AND business_trial_conversion_opt_out = false
      RETURNING business_trial_status, business_trial_start_at, business_trial_end_at,
                business_trial_conversion_opt_out, themes_trial_used_at`,
      [accountId],
    );
    if (rowCount !== 1) {
      throw new NexBusinessTrialError(
        "trial_not_active",
        "update affected 0 rows under lock",
      );
    }
    return toView(updated[0]);
  });
}

/**
 * D2-a · reverse the opt-out (user changed mind). Allowed only while
 * `(end_at - now) > 24 hours`.
 *
 * Preconditions:
 *   · business_trial_status = 'active'
 *   · business_trial_conversion_opt_out = true
 *   · business_trial_end_at - now() > 24 hours
 */
export async function resumeConversionInterest(
  accountId: string,
): Promise<NexBusinessTrialStateView> {
  recordTrialRateLimit(accountId, "trial_resume_conversion_interest");

  return withTx(async (client) => {
    const { rows: lockRows } = await client.query<RowShape>(
      `SELECT business_trial_status, business_trial_start_at, business_trial_end_at,
              business_trial_conversion_opt_out, themes_trial_used_at
         FROM nex_account WHERE id = $1 FOR UPDATE`,
      [accountId],
    );
    if (lockRows.length === 0) {
      throw new NexBusinessTrialError("trial_not_active", "account not found");
    }
    const current = lockRows[0];

    if (current.business_trial_status !== "active") {
      throw new NexBusinessTrialError("trial_not_active");
    }
    if (!current.business_trial_conversion_opt_out) {
      throw new NexBusinessTrialError("not_opted_out");
    }
    if (!current.business_trial_end_at) {
      // Should be impossible given active status + CHECK · defensive
      throw new NexBusinessTrialError("trial_not_active");
    }
    const endMs = current.business_trial_end_at.getTime();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    if (endMs - Date.now() <= twentyFourHoursMs) {
      throw new NexBusinessTrialError("within_24h_of_expiry");
    }

    const { rows: updated, rowCount } = await client.query<RowShape>(
      `UPDATE nex_account
          SET business_trial_conversion_opt_out = false
        WHERE id = $1
          AND business_trial_status = 'active'
          AND business_trial_conversion_opt_out = true
          AND business_trial_end_at - now() > interval '24 hours'
      RETURNING business_trial_status, business_trial_start_at, business_trial_end_at,
                business_trial_conversion_opt_out, themes_trial_used_at`,
      [accountId],
    );
    if (rowCount !== 1) {
      throw new NexBusinessTrialError(
        "trial_not_active",
        "update affected 0 rows under lock",
      );
    }
    return toView(updated[0]);
  });
}

/** Testing helper · tears down the pool so tests can switch DATABASE_URL. */
export async function __closeBusinessTrialPoolForTests(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

// Re-export rate-limit action type for callers
export type { NexBusinessTrialRateLimitAction };
