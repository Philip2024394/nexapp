// src/lib/nex-native/app/with-country-session.ts
//
// Owner-authorised 2026-10-31 (round 9 · build directive · implements
// the SET LOCAL discipline from Rev A plan §4.5 and the T-POOL-1..T-POOL-9
// test matrix).
//
// SET LOCAL nex.app_country = <country> is applied inside a transaction
// and lives only for the duration of that transaction. On COMMIT or
// ROLLBACK the setting disappears. This file provides the ONE sanctioned
// wrapper that opens the transaction, sets the GUC, runs the caller's
// work, and commits/rolls back.
//
// Three guarantees:
//   1. The GUC is set INSIDE the transaction (never before BEGIN).
//   2. On any exception, the transaction is explicitly rolled back
//      before the connection is released to the pool. The GUC does not
//      survive the ROLLBACK, so the next connection check-out sees no
//      leaked setting.
//   3. Fail-closed: if the resolver throws (no identity set) or the
//      country is null (HQ) or the pool is unavailable, the wrapper
//      refuses to run and the caller gets a typed error instead of a
//      silent fallback.
//
// Server pages + server actions wrap EVERY country-aware DB-backed
// request in this helper. HQ pages don't use this helper for ordinary
// admin reads (country is null) — they use the standard Supabase SSR
// client that honours country-aware RLS without needing SET LOCAL.
// Privileged HQ moderation uses a separate path per §8.6 of the plan.

import "server-only";
import { withClient, type PgClientLike } from "@/lib/nex/db";
import {
  resolveAppIdentityOrThrow,
  type AppCountryCode,
} from "./resolve-app-identity";

export type CountrySessionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: CountrySessionErrorCode; readonly message: string };

export type CountrySessionErrorCode =
  | "no-pool"
  | "no-country"
  | "identity-error"
  | "work-threw";

export class CountrySessionError extends Error {
  readonly code: CountrySessionErrorCode;
  constructor(code: CountrySessionErrorCode, message: string) {
    super(message);
    this.name = "CountrySessionError";
    this.code = code;
  }
}

export interface CountrySessionContext {
  readonly country: AppCountryCode;
  readonly client: PgClientLike;
}

/**
 * Open a transaction, SET LOCAL nex.app_country, run `work`, COMMIT.
 * On any exception, ROLLBACK then re-throw.
 *
 * Returns the caller's result. Throws CountrySessionError (not a
 * silent null) when preconditions fail, so routes can produce an
 * honest error page.
 *
 * Signature chosen for the common case: a route handler just needs the
 * value out, and the error path is explicit via try/catch.
 */
export async function withCountrySession<T>(
  work: (ctx: CountrySessionContext) => Promise<T>,
): Promise<T> {
  // 1. Resolve deployment identity (fail-closed).
  const identity = resolveAppIdentityOrThrow();
  if (identity.country === null) {
    throw new CountrySessionError(
      "no-country",
      `withCountrySession called from a deployment without a country (identity=${identity.identity}). This wrapper is only for country deployments (ireland, indonesia). HQ pages must not use it.`,
    );
  }

  // 2. Acquire a client from the shared pool.
  const result = await withClient(async (client) => {
    // 3. Open transaction.
    await client.query("BEGIN");
    try {
      // 4. SET LOCAL · parameterised so the country is quoted, not interpolated.
      //    set_config() is Postgres's parameterised equivalent of SET LOCAL.
      //    Third argument `true` = transaction-local (equivalent to SET LOCAL).
      await client.query(
        "SELECT set_config('nex.app_country', $1, true)",
        [identity.country],
      );

      // 5. Run work.
      const value = await work({
        country: identity.country as AppCountryCode,
        client,
      });

      // 6. Commit on success.
      await client.query("COMMIT");
      return { ok: true as const, value };
    } catch (err) {
      // 7. Rollback on any error. The GUC is cleared by ROLLBACK.
      //    We swallow a secondary rollback error so the original is reported.
      try { await client.query("ROLLBACK"); } catch { /* swallow */ }
      // Preserve original error with structured wrap.
      throw err instanceof Error
        ? err
        : new CountrySessionError("work-threw", String(err));
    }
  });

  if (result === null) {
    throw new CountrySessionError(
      "no-pool",
      "withCountrySession could not acquire a Postgres client. The pool is unavailable (NEX_POSTGRES_URL unset or pg module missing).",
    );
  }
  return result.value;
}

/**
 * Convenience: inspect-only variant that returns the current GUC value
 * for the open transaction. Used by SET LOCAL leakage tests to prove
 * the setting is scoped correctly.
 */
export async function readCurrentAppCountry(
  client: PgClientLike,
): Promise<string | null> {
  const r = await client.query("SELECT current_setting('nex.app_country', true) AS v");
  const row = r.rows[0] as { v: string | null } | undefined;
  const v = row?.v ?? null;
  return v === "" ? null : v;
}
