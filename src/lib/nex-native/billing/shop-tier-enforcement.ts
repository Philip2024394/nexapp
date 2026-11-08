// src/lib/nex-native/billing/shop-tier-enforcement.ts
//
// Shop tier enforcement · Entry / Professional / Professional Plus.
// Local-only implementation · owner-authorised 2026-11-07 engineering phase.
// -----------------------------------------------------------------------------
// This module is a pure, side-effect-free extension of the sealed
// enforcement.ts. It reads the agreed 3-tier entitlement spec from
// commercial/shop-entitlements.ts and returns enforcement decisions
// for creation + upload actions.
//
// Design goals:
//   · No DB calls here · caller passes usage snapshot
//   · No throws on violation · returns structured result so callers
//     can decide whether to 403 the API or surface an upgrade prompt
//   · Composable with existing enforcement.ts · does NOT replace it
//     until owner approves cutover (sealed SHOP_STANDARD_* constants
//     remain live source-of-truth)
//
// Integration points (NOT yet wired · documented for subsequent
// commits once owner approves):
//
//   src/app/api/nex-native/product/upload-image/route.ts
//     · currently checks file size + MIME · needs check for
//       current image count on the target product + tier cap
//
//   src/app/api/nex-native/product/upload-cover-video/route.ts
//     · currently checks file size + MIME · needs check for
//       current video count + tier cap + server-side duration
//
//   src/app/nex-native/create/product/_actions.ts
//     · currently calls enforceShopProductLimit from
//       enforcement.ts · needs to also honor Entry tier (5
//       products) when nex_account.shop_tier is null or 'entry'

import {
  ENTRY_ENTITLEMENT,
  SHOP_ENTITLEMENT,
  PROFESSIONAL_ENTITLEMENT,
  PROFESSIONAL_PLUS_ENTITLEMENT,
  type ShopEntitlementSpec,
  type ShopTier,
} from "@/lib/nex-native/commercial/shop-entitlements";

// ─── Tier resolver ──────────────────────────────────────────────────
// Maps the nex_account.shop_tier column value to the entitlement spec.
// Null or unknown values fall back to the Entry allowance so a
// brand-new owner gets the 5-product trial experience without any
// DB write.
//
// Round 30 (owner-approved direction 2026-11-08) · canonical paid
// value is 'shop'. Grandfathered aliases preserved for pre-reduction
// rows that may still carry 'standard' / 'unlimited' (migration 257
// original enum) or 'professional' / 'professional_plus' (round
// 29b test labels). All paid aliases resolve to the single sealed
// SHOP_ENTITLEMENT per the 2026-11-08 Scope Reduction.

/** Set of DB values that mean "paid Shop subscription". Kept here as
 *  the single source of truth so future callers can audit membership
 *  without re-hunting through the resolver code. */
const PAID_SHOP_DB_VALUES: ReadonlySet<string> = new Set([
  "shop",            // canonical · owner-sealed 2026-11-08
  "standard",        // grandfathered · migration 257 original enum
  "unlimited",       // grandfathered · migration 257 original enum
  "professional",    // grandfathered · round 29b alias label
  "professional_plus", // grandfathered · round 29b alias label
]);

/** Normalise the DB column value to the current two-tier enum
 *  ('entry' trial · 'shop' paid). */
export function resolveShopTier(
  dbShopTier: string | null | undefined,
): ShopTier {
  if (typeof dbShopTier === "string" && PAID_SHOP_DB_VALUES.has(dbShopTier)) {
    return "shop";
  }
  // Legacy values from migration 090 (bisnis / plus / ringan) + any
  // other unrecognised string fall through to Entry. Owner-directive
  // post-2026-11-07 review · fail-closed with conservative limits.
  return "entry";
}

export function getSpecForDbTier(
  dbShopTier: string | null | undefined,
): ShopEntitlementSpec {
  const tier = resolveShopTier(dbShopTier);
  if (tier === "shop") return SHOP_ENTITLEMENT;
  return ENTRY_ENTITLEMENT;
}

// ─── Enforcement decisions ──────────────────────────────────────────

export type ShopEnforcementError =
  | "product-cap"
  | "image-cap-per-product"
  | "image-size"
  | "video-not-allowed-on-tier"
  | "video-cap-per-product"
  | "video-size"
  | "video-duration";

export interface EnforcementResult {
  readonly ok: boolean;
  readonly errors: ReadonlyArray<ShopEnforcementError>;
  readonly spec: ShopEntitlementSpec;
}

const OK = (spec: ShopEntitlementSpec): EnforcementResult => ({
  ok: true,
  errors: [],
  spec,
});

const FAIL = (
  spec: ShopEntitlementSpec,
  errors: ReadonlyArray<ShopEnforcementError>,
): EnforcementResult => ({
  ok: false,
  errors,
  spec,
});

/** Can this shop create another product?
 *  `currentActiveCount` is the count of products with
 *  status='live' or 'draft' on nex_product. Archived products do
 *  not count against the cap (archive is soft-delete). */
export function enforceCreateProduct(
  dbShopTier: string | null | undefined,
  currentActiveCount: number,
): EnforcementResult {
  const spec = getSpecForDbTier(dbShopTier);
  if (currentActiveCount >= spec.products.maxActive) {
    return FAIL(spec, ["product-cap"]);
  }
  return OK(spec);
}

/** Can this product accept another image?
 *  Call BEFORE the upload route writes the file. */
export function enforceImageUpload(
  dbShopTier: string | null | undefined,
  currentImageCountOnProduct: number,
  uploadedBytes: number,
): EnforcementResult {
  const spec = getSpecForDbTier(dbShopTier);
  const errors: ShopEnforcementError[] = [];
  if (currentImageCountOnProduct >= spec.products.imagesPerProduct) {
    errors.push("image-cap-per-product");
  }
  if (uploadedBytes > spec.products.imageMaxBytes) {
    errors.push("image-size");
  }
  return errors.length === 0 ? OK(spec) : FAIL(spec, errors);
}

/** Can this product accept another video?
 *  Caller must pass real duration in seconds (requires server-side
 *  ffprobe or Cloudflare Stream probe · client reports are not
 *  authoritative). Pass -1 if duration isn't yet measured to skip
 *  the duration check (caller MUST follow up with a duration gate). */
export function enforceVideoUpload(
  dbShopTier: string | null | undefined,
  currentVideoCountOnProduct: number,
  uploadedBytes: number,
  durationSeconds: number,
): EnforcementResult {
  const spec = getSpecForDbTier(dbShopTier);
  const errors: ShopEnforcementError[] = [];
  if (spec.products.videosPerProduct === 0) {
    errors.push("video-not-allowed-on-tier");
    return FAIL(spec, errors);
  }
  if (currentVideoCountOnProduct >= spec.products.videosPerProduct) {
    errors.push("video-cap-per-product");
  }
  if (uploadedBytes > spec.products.videoMaxBytes) {
    errors.push("video-size");
  }
  if (
    durationSeconds > 0 &&
    durationSeconds > spec.products.videoMaxSeconds
  ) {
    errors.push("video-duration");
  }
  return errors.length === 0 ? OK(spec) : FAIL(spec, errors);
}

/** Human-readable error messages · caller uses for 400/403 body +
 *  owner-facing copy in the shop editor. */
export function describeError(
  error: ShopEnforcementError,
  spec: ShopEntitlementSpec,
): string {
  switch (error) {
    case "product-cap":
      return `Product limit reached · ${spec.displayName} allows ${spec.products.maxActive} active products · upgrade to list more.`;
    case "image-cap-per-product":
      return `Image limit reached · ${spec.displayName} allows ${spec.products.imagesPerProduct} images per product.`;
    case "image-size":
      return `Image too large · max ${Math.round(spec.products.imageMaxBytes / 1_000_000)} MB on ${spec.displayName}.`;
    case "video-not-allowed-on-tier":
      return `Video not available on ${spec.displayName} · upgrade to add product video.`;
    case "video-cap-per-product":
      return `Video limit reached · ${spec.displayName} allows ${spec.products.videosPerProduct} video${
        spec.products.videosPerProduct === 1 ? "" : "s"
      } per product.`;
    case "video-size":
      return `Video too large · max ${Math.round(spec.products.videoMaxBytes / 1_000_000)} MB on ${spec.displayName}.`;
    case "video-duration":
      return `Video too long · max ${spec.products.videoMaxSeconds} seconds on ${spec.displayName}.`;
  }
}
