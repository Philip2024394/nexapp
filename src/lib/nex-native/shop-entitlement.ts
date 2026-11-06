// src/lib/nex-native/shop-entitlement.ts
//
// Phase 4 Batch 4.5 · 2026-11-06 · Shop Entitlement Contract § B2 LOCK.
// -------------------------------------------------------------------------
// Single-source server-side entitlement authority for Shop membership.
//
// Shim phase: reads `nex_account.tier`, `bisnis_expires_at`,
// `themes_trial_used_at`, `business_trial_status` and delegates the
// predicate to the sealed `hasShopAccess` helper (K14 Option β ·
// 2026-10-22). When migration 282 (or the equivalent B3 schema)
// lands adding `nex_business.membership_active` + `membership_period_end`,
// this helper upgrades to read those columns instead. Call sites
// DO NOT change.
//
// Honours § H-B2: all Shop-gated entitlements call this helper, not
// inline tier checks.
//
// Reader contract:
//   `getShopEntitlement(accountId)` returns a minimal `{ hasShop,
//    periodEnd }` tuple. `periodEnd` is derived from `bisnis_expires_at`
//   today (null when no paid tier or when trial-only). When `hasShop`
//   is true but `periodEnd` is null, the entitlement is coming from
//   a trial path (Business Trial active, or themes-trial active) ·
//   callers that care about "N days left" should inspect the trial
//   state separately until the B3 schema lands.
//
// Error handling: fails CLOSED on any DB read failure (`{ hasShop:
// false, periodEnd: null }`). Errors are console.error'd so they are
// not invisible in production logs. Matches the fail-closed posture
// already used by thumbnail-entitlement and tier-gate.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import { hasShopAccess } from "./business-trial/entitlements";
import type { NexAccountRow, NexUuid } from "./types";

/** Minimal Shop entitlement shape. `hasShop` is the authoritative
 *  "may this account use Shop surfaces right now?" boolean.
 *  `periodEnd` is the paid-tier expiry when known · null for trial-only
 *  entitlements or when no expiry is on file (e.g. pro tier without
 *  expires_at). Callers rendering "cancel-anytime" / "N days left"
 *  copy should inspect `periodEnd`. */
export type ShopEntitlement = {
  readonly hasShop: boolean;
  readonly periodEnd: Date | null;
};

const DENY: ShopEntitlement = { hasShop: false, periodEnd: null } as const;

/** Resolve the Shop entitlement for a single account. Fail-closed on
 *  any read error or missing row. */
export async function getShopEntitlement(
  accountId: NexUuid,
): Promise<ShopEntitlement> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_account")
      .select(
        "tier, bisnis_expires_at, themes_trial_used_at, business_trial_status",
      )
      .eq("id", accountId)
      .maybeSingle();

    if (error) {
      console.error("shop-entitlement.getShopEntitlement: db error", error);
      return DENY;
    }
    if (!data) return DENY;

    const account = data as Pick<
      NexAccountRow,
      | "tier"
      | "bisnis_expires_at"
      | "themes_trial_used_at"
      | "business_trial_status"
    >;

    const periodEnd = parseIsoDate(account.bisnis_expires_at);
    const hasShop = hasShopAccess(account);

    return { hasShop, periodEnd };
  } catch (err) {
    console.error(
      "shop-entitlement.getShopEntitlement: unexpected error",
      err,
    );
    return DENY;
  }
}

/** Batch-fetch Shop entitlements for a list of accounts. Returns a
 *  Map keyed by accountId. Missing/errored accounts map to the deny
 *  shape. Preserves the fail-closed posture of the single-account
 *  form. Used by list surfaces (directory, picker) so they do one
 *  SELECT per render instead of N round-trips. */
export async function getShopEntitlements(
  accountIds: readonly NexUuid[],
): Promise<Map<NexUuid, ShopEntitlement>> {
  const out = new Map<NexUuid, ShopEntitlement>();
  if (accountIds.length === 0) return out;

  // Seed every id with DENY so missing rows preserve fail-closed.
  for (const id of accountIds) out.set(id, DENY);

  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_account")
      .select(
        "id, tier, bisnis_expires_at, themes_trial_used_at, business_trial_status",
      )
      .in("id", accountIds as string[]);

    if (error) {
      console.error(
        "shop-entitlement.getShopEntitlements: db error",
        error,
      );
      return out;
    }
    const rows =
      (data as
        | Array<
            Pick<
              NexAccountRow,
              | "id"
              | "tier"
              | "bisnis_expires_at"
              | "themes_trial_used_at"
              | "business_trial_status"
            >
          >
        | null) ?? [];
    for (const row of rows) {
      out.set(row.id, {
        hasShop: hasShopAccess(row),
        periodEnd: parseIsoDate(row.bisnis_expires_at),
      });
    }
    return out;
  } catch (err) {
    console.error(
      "shop-entitlement.getShopEntitlements: unexpected error",
      err,
    );
    return out;
  }
}

function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
