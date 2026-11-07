// src/lib/nex-native/commercial/shop-entitlements.ts
//
// NEX Shop entitlement specification · owner-approved 2026-11-07.
// -----------------------------------------------------------------------------
// This file is a LOCAL REFERENCE SPECIFICATION only. It does NOT:
//   · drive production Stripe products or prices
//   · gate production entitlement decisions (sealed enforcement.ts is still
//     the live source of truth)
//   · replace the existing SHOP_STANDARD_* constants in enforcement.ts
//
// Purpose: give every subsequent commit a single source of truth for the
// three-tier model (Entry allowance · Professional · Professional Plus)
// so that when the owner authorises production rollout, the numbers in
// one place match the numbers everywhere else.
//
// Before anything here can be enforced in production:
//   1. Owner approves live Stripe product + prices for Pro + Pro Plus
//   2. Migrations 257 + 258 applied to production Supabase
//   3. nex_business.storage_bytes_used + bandwidth_bytes_month columns added
//   4. Server-side video duration enforcement wired (ffprobe or Stream)
//   5. R2 + Cloudflare Images + Stream production accounts provisioned
//
// Until all five land, this file is reference-only.

export type ShopTier = "entry" | "professional" | "professional_plus";

export interface ShopEntitlementSpec {
  readonly tier: ShopTier;
  readonly displayName: string;
  readonly isPaid: boolean;
  readonly products: {
    readonly maxActive: number;
    readonly imagesPerProduct: number;
    readonly imageMaxBytes: number;
    readonly videosPerProduct: number;
    readonly videoMaxSeconds: number;
    readonly videoMaxBytes: number;
  };
  readonly storage: {
    /** Total media storage allowed across all products for this shop. */
    readonly mediaBytes: number;
    /** Monthly egress / delivery allowance. */
    readonly monthlyBandwidthBytes: number;
    /** Multiplier at which we throttle but do not disconnect. */
    readonly softThrottleMultiplier: number;
  };
  readonly features: {
    readonly directoryBoost: boolean;
    readonly analyticsDashboard: boolean;
    readonly prioritySupport: boolean;
  };
}

// ─── Byte helpers ────────────────────────────────────────────────────
const MB = 1_000_000;
const GB = 1_000_000_000;

// ─── Entry allowance ────────────────────────────────────────────────
// Owner's sealed decision 2026-11-06: five-product entry allowance is
// NOT a free Shop subscription · it is the trial surface a business
// gets before committing to a paid plan. Chat stays free regardless.
export const ENTRY_ENTITLEMENT: ShopEntitlementSpec = {
  tier: "entry",
  displayName: "Entry (trial)",
  isPaid: false,
  products: {
    maxActive: 5,
    imagesPerProduct: 3,
    imageMaxBytes: 4 * MB,
    videosPerProduct: 0,
    videoMaxSeconds: 0,
    videoMaxBytes: 0,
  },
  storage: {
    mediaBytes: 50 * MB,
    monthlyBandwidthBytes: 3 * GB,
    softThrottleMultiplier: 2,
  },
  features: {
    directoryBoost: false,
    analyticsDashboard: false,
    prioritySupport: false,
  },
};

// ─── NEX Shop Professional · €9.99/mo or €99/yr ─────────────────────
export const PROFESSIONAL_ENTITLEMENT: ShopEntitlementSpec = {
  tier: "professional",
  displayName: "NEX Shop Professional",
  isPaid: true,
  products: {
    maxActive: 50,
    imagesPerProduct: 6,
    imageMaxBytes: 4 * MB,
    videosPerProduct: 1,
    videoMaxSeconds: 30,
    videoMaxBytes: 40 * MB,
  },
  storage: {
    mediaBytes: 1 * GB,
    monthlyBandwidthBytes: 30 * GB,
    softThrottleMultiplier: 2,
  },
  features: {
    directoryBoost: false,
    analyticsDashboard: false,
    prioritySupport: false,
  },
};

// ─── NEX Shop Professional Plus · €19.99/mo or €199/yr ──────────────
export const PROFESSIONAL_PLUS_ENTITLEMENT: ShopEntitlementSpec = {
  tier: "professional_plus",
  displayName: "NEX Shop Professional Plus",
  isPaid: true,
  products: {
    maxActive: 500,
    imagesPerProduct: 10,
    imageMaxBytes: 8 * MB,
    videosPerProduct: 3,
    videoMaxSeconds: 60,
    videoMaxBytes: 100 * MB,
  },
  storage: {
    mediaBytes: 10 * GB,
    monthlyBandwidthBytes: 300 * GB,
    softThrottleMultiplier: 2,
  },
  features: {
    directoryBoost: true,
    analyticsDashboard: true,
    prioritySupport: true,
  },
};

export const ALL_ENTITLEMENTS: Readonly<Record<ShopTier, ShopEntitlementSpec>> = {
  entry: ENTRY_ENTITLEMENT,
  professional: PROFESSIONAL_ENTITLEMENT,
  professional_plus: PROFESSIONAL_PLUS_ENTITLEMENT,
};

/** Pure reader · returns the spec for a tier string. Caller validates
 *  input · unknown tier returns the entry allowance. */
export function getShopEntitlement(tier: string | null): ShopEntitlementSpec {
  if (tier === "professional") return PROFESSIONAL_ENTITLEMENT;
  if (tier === "professional_plus") return PROFESSIONAL_PLUS_ENTITLEMENT;
  return ENTRY_ENTITLEMENT;
}

/** Pure predicate · owner-visible usage check. Caller passes current
 *  product/storage/bandwidth usage · result indicates whether the shop
 *  is within entitlement. Does NOT touch DB or network. */
export interface ShopUsageSnapshot {
  readonly activeProducts: number;
  readonly mediaBytesUsed: number;
  readonly monthlyBandwidthBytes: number;
}

export interface EntitlementCheckResult {
  readonly withinLimits: boolean;
  readonly violations: ReadonlyArray<string>;
  readonly spec: ShopEntitlementSpec;
}

export function checkShopAgainstEntitlement(
  usage: ShopUsageSnapshot,
  tier: string | null,
): EntitlementCheckResult {
  const spec = getShopEntitlement(tier);
  const violations: string[] = [];
  if (usage.activeProducts > spec.products.maxActive) {
    violations.push(
      `products:${usage.activeProducts}/${spec.products.maxActive}`,
    );
  }
  if (usage.mediaBytesUsed > spec.storage.mediaBytes) {
    violations.push(
      `storage:${usage.mediaBytesUsed}/${spec.storage.mediaBytes}`,
    );
  }
  if (
    usage.monthlyBandwidthBytes >
    spec.storage.monthlyBandwidthBytes *
      spec.storage.softThrottleMultiplier
  ) {
    violations.push(
      `bandwidth:${usage.monthlyBandwidthBytes}/${spec.storage.monthlyBandwidthBytes}`,
    );
  }
  return {
    withinLimits: violations.length === 0,
    violations,
    spec,
  };
}
