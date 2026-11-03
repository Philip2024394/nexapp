// src/lib/nex-native/billing/sell-listing-count.ts
//
// NEX Billing · Sell listing count query (D4 pattern).
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// Counts the number of NEX Sell listings an account has created THIS
// CALENDAR MONTH (UTC). Replaces the hard-coded `listingsUsedThisMonth:
// 0` placeholder in the sell-listing-charge route.
//
// Current NEX Sell listing surfaces:
//   · nex_watch_listing (migration 227) · the only Sell table today
//
// If/when other Sell categories ship (used electronics, fashion, etc.)
// each new listing table adds a UNION branch to this query. The function
// signature stays stable.
//
// Runs INSIDE withAccountLock when the caller needs atomic reservation
// (owner-recommended D4 · quota check + payment creation inside the
// same lock window).

import "server-only";
import type { SupabaseBillingStore } from "./supabase-store";

export interface CountListingsInput {
  readonly nexAccountId: string;
  /** Reference instant. The query filters created_at >= date_trunc('month', now).
   *  We pass `now` explicitly so tests + reconciliation jobs can be
   *  deterministic. Timezone semantics · see implementation note below. */
  readonly now: Date;
}

/** Count listings created this calendar month (UTC) by the given account.
 *  INCLUSIVE of the start of the month, EXCLUSIVE of the next month start.
 *
 *  Timezone note · the owner's monthly allowance is calendar month in UTC
 *  for billing simplicity. Switching to a different anchor (user's local
 *  timezone, calendar start-of-month in site timezone, 30-rolling-day
 *  window) is a future decision · update this function + the matching
 *  isoMonth parameter in sell-payment-intent.ts together.
 */
export async function countListingsThisMonth(
  input: CountListingsInput,
  txStore: SupabaseBillingStore,
): Promise<number> {
  const result = await (
    txStore as unknown as {
      _rawQuery: <R extends Record<string, unknown>>(
        text: string,
        values: readonly unknown[],
      ) => Promise<{ rows: R[]; rowCount: number }>;
    }
  )._rawQuery<{ count: string | number }>(
    `
      SELECT COUNT(*)::bigint AS count
      FROM nex_watch_listing
      WHERE owner_account_id = $1
        AND created_at >= date_trunc('month', $2::timestamptz AT TIME ZONE 'UTC')
        AND created_at <  date_trunc('month', $2::timestamptz AT TIME ZONE 'UTC')
                           + interval '1 month'
    `,
    [input.nexAccountId, input.now.toISOString()],
  );
  const raw = result.rows[0]?.count ?? 0;
  return typeof raw === "number" ? raw : Number(raw);
}

/** ISO calendar month in UTC · YYYY-MM. Matches
 *  sell-payment-intent.ts's isoMonth validator. */
export function isoMonthUtc(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
