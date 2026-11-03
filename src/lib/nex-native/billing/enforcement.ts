// src/lib/nex-native/billing/enforcement.ts
//
// NEX Billing Foundation · entitlement enforcement helpers.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// Pure functions that convert entitlement decisions into per-feature caps
// and gate decisions. These helpers do NOT touch Supabase · they consume
// counts/sizes a caller fetched and return a decision + the configured cap.
//
// Shop Standard  €19.99/mo · 50 active products · 10 video slots · 20s max video · 10 shop templates
// Shop Unlimited €29.99/mo · unlimited products (fair-use) · video on every product · 20s max video
// Vault base     €9.99/mo  · 5 GB · 50 MB max per file
// Vault 25gb                 · 25 GB · 50 MB max per file   (PROPOSAL · not approved for publication)
// Vault 50gb                 · 50 GB · 50 MB max per file   (PROPOSAL · not approved for publication)
// Vault 100gb                · 100 GB · 50 MB max per file  (PROPOSAL · not approved for publication)
// NEX Sell                   · 3 free listings/month · €1.30 per additional listing (Ireland pricing)
//
// All byte-sizes are DECIMAL (1 GB = 1,000,000,000 bytes) per owner lock
// 2026-10-20 (Vault entitlements policy B2).

import type {
  AccessLevel,
  NexProduct,
  ShopTier,
  VaultTier,
  AccountEntitlementView,
} from "./types";
import { accessLevel } from "./entitlement";

// ---------------------------------------------------------------------------
// Constants · owner-locked
// ---------------------------------------------------------------------------

/** NEX Sell free listings per calendar month. */
export const NEX_SELL_FREE_LISTINGS_PER_MONTH = 3;

/** Additional-listing fee in euro cents (Ireland). */
export const NEX_SELL_EXTRA_LISTING_CENTS_EUR = 130; // €1.30

/** Shop video max duration in seconds. */
export const SHOP_VIDEO_MAX_SECONDS = 20;

/** Shop Standard · active product cap. */
export const SHOP_STANDARD_PRODUCT_CAP = 50;

/** Shop Standard · number of product slots that may have video attached. */
export const SHOP_STANDARD_VIDEO_SLOT_CAP = 10;

/** Shop Standard · theme templates available. (10 shop templates per owner
 *  decision 2026-10-20 Package Contract DRAFT D1-D4.) */
export const SHOP_STANDARD_TEMPLATE_COUNT = 10;

/** Vault max file size: 50 MB · decimal (50,000,000 bytes). */
export const VAULT_FILE_MAX_BYTES = 50_000_000;

/** Vault storage cap per tier · decimal bytes (1 GB = 1e9 bytes). */
export const VAULT_STORAGE_CAP_BYTES: Record<VaultTier, number> = {
  gratis: 0,
  "5gb": 5_000_000_000,
  "25gb": 25_000_000_000,
  "50gb": 50_000_000_000,
  "100gb": 100_000_000_000,
};

// ---------------------------------------------------------------------------
// Shared decision shapes
// ---------------------------------------------------------------------------

export interface EnforceOk {
  readonly ok: true;
}

export interface EnforceDenied {
  readonly ok: false;
  readonly code:
    | "no_entitlement"
    | "read_only"
    | "cap_exceeded"
    | "unsupported_tier"
    | "value_out_of_range";
  readonly reason: string;
  readonly cap?: number;
}

export type EnforceDecision = EnforceOk | EnforceDenied;

// ---------------------------------------------------------------------------
// Shop · product cap
// ---------------------------------------------------------------------------

export interface ShopProductLimitInput {
  readonly view: AccountEntitlementView;
  readonly now: Date;
  readonly currentActiveProductCount: number;
  readonly addingCount: number;
}

export function enforceShopProductLimit(
  input: ShopProductLimitInput,
): EnforceDecision {
  if (input.view.product !== "shop") {
    return {
      ok: false,
      code: "unsupported_tier",
      reason: "Shop product cap enforcement requires a shop view",
    };
  }

  const level = accessLevel(input.view, input.now);
  if (level === "none") {
    return {
      ok: false,
      code: "no_entitlement",
      reason: "Shop subscription required to add products",
    };
  }
  if (level === "read-only") {
    return {
      ok: false,
      code: "read_only",
      reason:
        "Shop is in read-only grace · existing products remain visible but no new products",
    };
  }

  const tier = input.view.snapshot.tier as ShopTier | null;
  if (tier === "unlimited") {
    // Fair-use enforced out-of-band; soft cap not applied here.
    return { ok: true };
  }
  if (tier !== "standard") {
    return {
      ok: false,
      code: "unsupported_tier",
      reason: `Shop tier '${tier}' is not recognised`,
    };
  }

  const projected = input.currentActiveProductCount + input.addingCount;
  if (projected > SHOP_STANDARD_PRODUCT_CAP) {
    return {
      ok: false,
      code: "cap_exceeded",
      reason: `Shop Standard allows ${SHOP_STANDARD_PRODUCT_CAP} active products · adding ${input.addingCount} would reach ${projected}`,
      cap: SHOP_STANDARD_PRODUCT_CAP,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Shop · video slot cap
// ---------------------------------------------------------------------------

export interface ShopVideoSlotInput {
  readonly view: AccountEntitlementView;
  readonly now: Date;
  readonly currentVideoProductCount: number;
  readonly addingCount: number;
}

export function enforceVideoSlotLimit(
  input: ShopVideoSlotInput,
): EnforceDecision {
  if (input.view.product !== "shop") {
    return {
      ok: false,
      code: "unsupported_tier",
      reason: "Video slot cap requires a shop view",
    };
  }

  const level = accessLevel(input.view, input.now);
  if (level === "none") {
    return {
      ok: false,
      code: "no_entitlement",
      reason: "Shop subscription required to attach video to products",
    };
  }
  if (level === "read-only") {
    return {
      ok: false,
      code: "read_only",
      reason:
        "Shop is in read-only grace · existing videos remain visible but no new videos",
    };
  }

  const tier = input.view.snapshot.tier as ShopTier | null;
  if (tier === "unlimited") {
    return { ok: true }; // every product may have video
  }
  if (tier !== "standard") {
    return {
      ok: false,
      code: "unsupported_tier",
      reason: `Shop tier '${tier}' is not recognised`,
    };
  }

  const projected = input.currentVideoProductCount + input.addingCount;
  if (projected > SHOP_STANDARD_VIDEO_SLOT_CAP) {
    return {
      ok: false,
      code: "cap_exceeded",
      reason: `Shop Standard allows ${SHOP_STANDARD_VIDEO_SLOT_CAP} video-enabled product slots · adding ${input.addingCount} would reach ${projected}`,
      cap: SHOP_STANDARD_VIDEO_SLOT_CAP,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Shop · video length cap (tier-agnostic · applies to both Standard & Unlimited)
// ---------------------------------------------------------------------------

export function enforceVideoLengthLimit(seconds: number): EnforceDecision {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return {
      ok: false,
      code: "value_out_of_range",
      reason: `Video length must be a positive number of seconds · got ${seconds}`,
    };
  }
  if (seconds > SHOP_VIDEO_MAX_SECONDS) {
    return {
      ok: false,
      code: "cap_exceeded",
      reason: `Shop videos must be ≤ ${SHOP_VIDEO_MAX_SECONDS}s · submitted ${seconds}s`,
      cap: SHOP_VIDEO_MAX_SECONDS,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Vault · per-file size cap (tier-agnostic · 50 MB decimal)
// ---------------------------------------------------------------------------

export function enforceVaultFileSize(byteSize: number): EnforceDecision {
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return {
      ok: false,
      code: "value_out_of_range",
      reason: `Vault file byte-size must be positive · got ${byteSize}`,
    };
  }
  if (byteSize > VAULT_FILE_MAX_BYTES) {
    return {
      ok: false,
      code: "cap_exceeded",
      reason: `Vault files must be ≤ ${VAULT_FILE_MAX_BYTES} bytes (50 MB decimal) · submitted ${byteSize} bytes`,
      cap: VAULT_FILE_MAX_BYTES,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Vault · total storage cap per tier
// ---------------------------------------------------------------------------

export interface VaultStorageQuotaInput {
  readonly view: AccountEntitlementView;
  readonly now: Date;
  readonly currentUsedBytes: number;
  readonly addingBytes: number;
}

export function enforceVaultStorageQuota(
  input: VaultStorageQuotaInput,
): EnforceDecision {
  if (input.view.product !== "vault") {
    return {
      ok: false,
      code: "unsupported_tier",
      reason: "Vault storage cap enforcement requires a vault view",
    };
  }

  const level = accessLevel(input.view, input.now);
  if (level === "none") {
    return {
      ok: false,
      code: "no_entitlement",
      reason: "Vault subscription required to add files",
    };
  }
  if (level === "read-only") {
    return {
      ok: false,
      code: "read_only",
      reason:
        "Vault is in read-only grace · existing files remain accessible but no new uploads",
    };
  }

  const tier = input.view.snapshot.tier as VaultTier | null;
  if (!tier || !(tier in VAULT_STORAGE_CAP_BYTES)) {
    return {
      ok: false,
      code: "unsupported_tier",
      reason: `Vault tier '${tier}' is not recognised`,
    };
  }
  const cap = VAULT_STORAGE_CAP_BYTES[tier];
  if (cap === 0) {
    return {
      ok: false,
      code: "no_entitlement",
      reason: "Vault 'gratis' has no storage allocation",
    };
  }

  const projected = input.currentUsedBytes + input.addingBytes;
  if (projected > cap) {
    return {
      ok: false,
      code: "cap_exceeded",
      reason: `Vault ${tier} caps storage at ${cap} bytes (decimal) · adding ${input.addingBytes} would reach ${projected}`,
      cap,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// NEX Sell · free listing allowance + extra listing payment
// ---------------------------------------------------------------------------

export interface SellListingAllowanceInput {
  readonly listingsUsedThisMonth: number;
  readonly addingCount: number;
}

export interface SellListingAllowanceDecision {
  readonly freeCovered: number;
  readonly extraCovered: number;
  readonly extraCostCents: number;
  readonly extraCurrency: "EUR";
  readonly ok: true;
}

/** Pure decomposition · how many of the requested listings are inside the
 *  monthly 3-free allowance and how many must be billed at €1.30 each.
 *  Does NOT execute payment · the caller handles payment separately. */
export function enforceFreeListingAllowance(
  input: SellListingAllowanceInput,
): SellListingAllowanceDecision {
  const used = Math.max(0, Math.floor(input.listingsUsedThisMonth));
  const adding = Math.max(0, Math.floor(input.addingCount));

  const remainingFree = Math.max(
    0,
    NEX_SELL_FREE_LISTINGS_PER_MONTH - used,
  );
  const freeCovered = Math.min(adding, remainingFree);
  const extraCovered = adding - freeCovered;
  const extraCostCents = extraCovered * NEX_SELL_EXTRA_LISTING_CENTS_EUR;

  return {
    ok: true,
    freeCovered,
    extraCovered,
    extraCostCents,
    extraCurrency: "EUR",
  };
}

/** Companion to the allowance decomposer · entitlement boundary for the
 *  €1.30 extra-listing fee. Returns the amount that must be collected (or
 *  reports that no payment is due). Does NOT contact a payment processor
 *  · the caller orchestrates Stripe/collection separately. */
export interface AdditionalListingPaymentInput {
  readonly extraCovered: number;
}
export interface AdditionalListingPaymentDecision {
  readonly ok: true;
  readonly payCents: number;
  readonly currency: "EUR";
  readonly perListingCents: number;
}
export function enforceAdditionalListingPayment(
  input: AdditionalListingPaymentInput,
): AdditionalListingPaymentDecision {
  const extra = Math.max(0, Math.floor(input.extraCovered));
  return {
    ok: true,
    payCents: extra * NEX_SELL_EXTRA_LISTING_CENTS_EUR,
    perListingCents: NEX_SELL_EXTRA_LISTING_CENTS_EUR,
    currency: "EUR",
  };
}

// ---------------------------------------------------------------------------
// Access-level projection (used by downgrade cap checks + UI)
// ---------------------------------------------------------------------------

/** Pure helper · thin pass-through of accessLevel() for consistency. */
export function entitlementAccessLevel(
  view: AccountEntitlementView,
  now: Date,
): AccessLevel {
  return accessLevel(view, now);
}
