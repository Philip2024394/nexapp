// src/lib/nex-native/commercial/shop-entitlements.ts
//
// NEX Shop entitlement specification · owner-authorised 2026-11-08 (round 29).
// -----------------------------------------------------------------------------
// Single Shop tier model · supersedes the three-tier (entry /
// professional / professional_plus) structure in place until 2026-11-07.
// Reflects the sealed commercial model agreed 2026-11-08:
//
//   · One Shop package · €4.99/mo · 10 products · 3 videos · 1 GB
//     storage · 30 GB monthly bandwidth · Vault bundled · 0% commission.
//   · Pay-as-you-grow via separate STORAGE_PACKS + BANDWIDTH_PACKS
//     (see regional-pricing.ts).
//
// This file is a LOCAL REFERENCE SPECIFICATION only. It does NOT:
//   · drive production Stripe products or prices
//   · gate production entitlement decisions (sealed enforcement.ts is
//     still the live source of truth)
//
// Before anything here can be enforced in production:
//   1. Owner approves live Stripe product + prices for Shop + packs
//   2. Migration 308 applied to production Supabase (adds
//      storage_bytes_used · bandwidth_bytes_month · storage_pack_bytes
//      · bandwidth_pack_bytes · bandwidth_period_start on nex_business)
//   3. Upload + delete hooks wire into the metering counter
//   4. Monthly cron rollover resets bandwidth_bytes_month on the
//      1st of each month (preserves bandwidth_period_start)
//   5. Server-side video duration enforcement wired (ffprobe or Stream)
//
// Until all five land, this file is reference-only.

export type ShopTier = "entry" | "shop";

export interface ShopEntitlementSpec {
  readonly tier: ShopTier;
  readonly displayName: string;
  readonly isPaid: boolean;
  readonly products: {
    readonly maxActive: number;
    readonly imagesPerProduct: number;
    readonly imageMaxBytes: number;
    /** Max videos TOTAL across the shop (not per-product). Owner
     *  directive 2026-11-08: 3 videos total · not 3 per product. */
    readonly videosTotal: number;
    /** Max videos a single product can hold. On the single-tier
     *  Shop (2026-11-08) this equals videosTotal since one product
     *  can hold the shop's entire video allowance if the seller
     *  wants. Entry trial leaves it at 0 (no video uploads). */
    readonly videosPerProduct: number;
    readonly videoMaxSeconds: number;
    readonly videoMaxBytes: number;
  };
  readonly storage: {
    /** Total media storage allowed across all products for this shop,
     *  before pack add-ons. Owner-sealed 2026-11-08: 1 GB base. */
    readonly mediaBytes: number;
    /** Monthly egress / delivery allowance before pack add-ons. */
    readonly monthlyBandwidthBytes: number;
    /** Controlled overshoot multiplier · 1.10 = 10% grace before
     *  enforcement bites (owner-sealed 2026-11-08). */
    readonly graceMultiplier: number;
  };
  readonly features: {
    readonly chatThemesIncluded: boolean;
    readonly vaultIncluded: boolean;
    readonly salesCommission: number; // 0 = 0%
  };
}

// ─── Byte helpers ────────────────────────────────────────────────────
const MB = 1_000_000;
const GB = 1_000_000_000;

// ─── Entry allowance ────────────────────────────────────────────────
// Signed-in-but-unpaid trial surface. Owner directive 2026-11-06 kept
// into 2026-11-08: five-product entry allowance is NOT a free Shop
// subscription · it is the trial surface a business gets before
// committing to the paid Shop plan. Chat stays free regardless.
export const ENTRY_ENTITLEMENT: ShopEntitlementSpec = {
  tier: "entry",
  displayName: "Entry (trial)",
  isPaid: false,
  products: {
    maxActive: 5,
    imagesPerProduct: 3,
    imageMaxBytes: 4 * MB,
    videosTotal: 0,
    videosPerProduct: 0,
    videoMaxSeconds: 0,
    videoMaxBytes: 0,
  },
  storage: {
    mediaBytes: 50 * MB,
    monthlyBandwidthBytes: 3 * GB,
    graceMultiplier: 1.0,
  },
  features: {
    chatThemesIncluded: false,
    vaultIncluded: false,
    salesCommission: 0,
  },
};

// ─── NEX Shop · €4.99/mo single tier ────────────────────────────────
// Owner-sealed 2026-11-08 commercial model. Same features for every
// subscriber globally · pay-as-you-grow handled via separate storage
// and bandwidth packs (see regional-pricing.ts STORAGE_PACKS and
// BANDWIDTH_PACKS).
export const SHOP_ENTITLEMENT: ShopEntitlementSpec = {
  tier: "shop",
  displayName: "NEX Shop",
  isPaid: true,
  products: {
    maxActive: 10,
    imagesPerProduct: 5,
    imageMaxBytes: 4 * MB,
    videosTotal: 3,
    videosPerProduct: 3,
    videoMaxSeconds: 30,
    videoMaxBytes: 40 * MB,
  },
  storage: {
    mediaBytes: 1 * GB,
    monthlyBandwidthBytes: 30 * GB,
    graceMultiplier: 1.10,
  },
  features: {
    chatThemesIncluded: true,
    vaultIncluded: true,
    salesCommission: 0,
  },
};

export const ALL_ENTITLEMENTS: Readonly<Record<ShopTier, ShopEntitlementSpec>> = {
  entry: ENTRY_ENTITLEMENT,
  shop: SHOP_ENTITLEMENT,
};

/** Pure reader · returns the spec for a tier string. Caller validates
 *  input · unknown tier (including the legacy 'professional' and
 *  'professional_plus' labels) maps to the current `shop` tier so
 *  existing callers keep working after the 2026-11-08 model change. */
export function getShopEntitlement(tier: string | null): ShopEntitlementSpec {
  if (tier === "shop") return SHOP_ENTITLEMENT;
  if (tier === "professional" || tier === "professional_plus") {
    // Backwards-compat alias · map any legacy paid tier label to the
    // current single Shop entitlement. Prevents a stale `tier` value
    // in DB or memory from falling back to the Entry trial surface.
    return SHOP_ENTITLEMENT;
  }
  return ENTRY_ENTITLEMENT;
}

/** Pure predicate · owner-visible usage check. Caller passes current
 *  product/storage/bandwidth usage + any pack add-ons · result
 *  indicates whether the shop is within entitlement. Does NOT touch DB
 *  or network. */
export interface ShopUsageSnapshot {
  readonly activeProducts: number;
  readonly totalVideos: number;
  readonly mediaBytesUsed: number;
  readonly monthlyBandwidthBytes: number;
  /** Optional capacity top-ups active on the shop. Defaults to zero. */
  readonly storagePackBytes?: number;
  readonly bandwidthPackBytes?: number;
}

export interface EntitlementCheckResult {
  readonly withinLimits: boolean;
  readonly violations: ReadonlyArray<string>;
  readonly spec: ShopEntitlementSpec;
  /** Effective capacity (base + packs) used by the caller when
   *  rendering progress bars + grace bands. */
  readonly effectiveStorageBytes: number;
  readonly effectiveBandwidthBytes: number;
}

export function checkShopAgainstEntitlement(
  usage: ShopUsageSnapshot,
  tier: string | null,
): EntitlementCheckResult {
  const spec = getShopEntitlement(tier);
  const storagePack = Math.max(0, usage.storagePackBytes ?? 0);
  const bandwidthPack = Math.max(0, usage.bandwidthPackBytes ?? 0);
  const effectiveStorageBytes = spec.storage.mediaBytes + storagePack;
  const effectiveBandwidthBytes =
    spec.storage.monthlyBandwidthBytes + bandwidthPack;

  const violations: string[] = [];
  if (usage.activeProducts > spec.products.maxActive) {
    violations.push(
      `products:${usage.activeProducts}/${spec.products.maxActive}`,
    );
  }
  if (usage.totalVideos > spec.products.videosTotal) {
    violations.push(
      `videos:${usage.totalVideos}/${spec.products.videosTotal}`,
    );
  }
  if (usage.mediaBytesUsed > effectiveStorageBytes) {
    violations.push(
      `storage:${usage.mediaBytesUsed}/${effectiveStorageBytes}`,
    );
  }
  // Bandwidth honours the 10% grace band · a controlled 10% overshoot
  // is permitted before enforcement bites (owner directive 2026-11-08).
  if (
    usage.monthlyBandwidthBytes >
    effectiveBandwidthBytes * spec.storage.graceMultiplier
  ) {
    violations.push(
      `bandwidth:${usage.monthlyBandwidthBytes}/${effectiveBandwidthBytes}`,
    );
  }
  return {
    withinLimits: violations.length === 0,
    violations,
    spec,
    effectiveStorageBytes,
    effectiveBandwidthBytes,
  };
}

// ─── Legacy aliases · deprecated 2026-11-08 ─────────────────────────
// The earlier 3-tier structure (professional / professional_plus) was
// superseded by the single `shop` tier. Preserved aliases keep any
// transient callers compiling · remove after a repo-wide sweep.
export const PROFESSIONAL_ENTITLEMENT = SHOP_ENTITLEMENT;
export const PROFESSIONAL_PLUS_ENTITLEMENT = SHOP_ENTITLEMENT;
