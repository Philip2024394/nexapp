// src/lib/nex-native/billing/shop-tier-guard.ts
//
// Server-side guards for the 3-tier Shop entitlement model
// (Entry / Professional / Professional Plus · owner-sealed 2026-11-07).
// Owner directive 2026-11-07 (post-review): FAIL-CLOSED on missing
// business / account / entitlement. Do not grant privileges silently
// when the resolver cannot establish the owner's tier.
// -----------------------------------------------------------------------------
// This module is the Supabase-reading sibling of the pure
// `shop-tier-enforcement.ts`. It fetches the current `shop_tier` and
// the current usage count directly, then delegates the decision to the
// pure enforcement functions.
//
// Fail-closed semantics:
//   · Business not found       → reject (code: "business-not-found")
//   · Owner account not found  → reject (code: "owner-not-found")
//   · Count query fails        → reject (code: "resolver-unavailable")
//   · Product not found (when
//     a productId is passed)   → reject (code: "product-not-found")
//
// Error messages are generic · they do NOT include internal DB error
// text to avoid leaking schema or infrastructure details to the caller.
//
// Coexistence with the legacy `tier-gate.ts`:
//   · `tier-gate.assertCanCreateProduct` still runs inside
//     product-service.createProduct and gates the old 10-product
//     GRATIS cap. Since the new Entry allowance is smaller (5), the
//     new guard trips first on new accounts. Old accounts without a
//     shop_tier see the new Entry 5-product cap.
//   · No legacy function is deleted; both gates compose.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import {
  enforceCreateProduct,
  enforceImageUpload,
  enforceVideoUpload,
  describeError,
  getSpecForDbTier,
  type EnforcementResult,
  type ShopEnforcementError,
} from "./shop-tier-enforcement";
import type { NexUuid } from "../types";

// ─── Internal · resolve shop_tier for the business owner ───────────────

interface OwnerResolution {
  readonly ownerAccountId: NexUuid;
  readonly shopTier: string | null;
}

type OwnerResolveOutcome =
  | { ok: true; value: OwnerResolution }
  | { ok: false; code: "business-not-found" | "owner-not-found" | "resolver-unavailable" };

async function resolveOwnerShopTier(
  businessId: NexUuid,
): Promise<OwnerResolveOutcome> {
  const biz = await nexSupabaseAdmin
    .from("nex_business")
    .select("owner_account_id")
    .eq("id", businessId)
    .maybeSingle();
  if (biz.error) return { ok: false, code: "resolver-unavailable" };
  if (!biz.data) return { ok: false, code: "business-not-found" };
  const ownerAccountId = (biz.data as { owner_account_id: string }).owner_account_id;
  if (!ownerAccountId) return { ok: false, code: "owner-not-found" };
  const acc = await nexSupabaseAdmin
    .from("nex_account")
    .select("shop_tier")
    .eq("id", ownerAccountId)
    .maybeSingle();
  if (acc.error) return { ok: false, code: "resolver-unavailable" };
  if (!acc.data) return { ok: false, code: "owner-not-found" };
  const row = acc.data as { shop_tier: string | null };
  return {
    ok: true,
    value: { ownerAccountId, shopTier: row.shop_tier ?? null },
  };
}

async function countActiveProducts(businessId: NexUuid): Promise<number | null> {
  const { count, error } = await nexSupabaseAdmin
    .from("nex_product")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .in("status", ["live", "draft"]);
  if (error) return null;
  return count ?? 0;
}

interface ProductImageSnapshot {
  readonly businessId: NexUuid;
  readonly heroCount: 0 | 1;
  readonly galleryCount: number;
}

async function readProductImageSnapshot(
  productId: NexUuid,
): Promise<ProductImageSnapshot | null> {
  const prod = await nexSupabaseAdmin
    .from("nex_product")
    .select("business_id, image_url, gallery_urls")
    .eq("id", productId)
    .maybeSingle();
  if (prod.error || !prod.data) return null;
  const row = prod.data as {
    business_id: string;
    image_url: string | null;
    gallery_urls: string[] | null;
  };
  const galleryCount = Array.isArray(row.gallery_urls) ? row.gallery_urls.length : 0;
  const heroCount: 0 | 1 = row.image_url ? 1 : 0;
  return { businessId: row.business_id, heroCount, galleryCount };
}

async function countVideosOnProduct(productId: NexUuid): Promise<number | null> {
  const prod = await nexSupabaseAdmin
    .from("nex_product")
    .select("spec")
    .eq("id", productId)
    .maybeSingle();
  if (prod.error || !prod.data) return null;
  const row = prod.data as { spec: Record<string, unknown> | null };
  const spec = row.spec ?? {};
  const cover = (spec as Record<string, unknown>).__cover_video;
  return cover ? 1 : 0;
}

// ─── Result shape returned by every guard ──────────────────────────────

export type ShopTierGuardCode =
  | ShopEnforcementError
  | "business-not-found"
  | "owner-not-found"
  | "resolver-unavailable"
  | "product-not-found";

export interface ShopTierGuardDecision {
  readonly ok: boolean;
  readonly code?: ShopTierGuardCode;
  readonly message?: string;
  readonly upgradeCta?: string;
}

const OK: ShopTierGuardDecision = { ok: true };

function denyFromResult(result: EnforcementResult): ShopTierGuardDecision {
  const firstError = result.errors[0];
  if (!firstError) return OK;
  const message = describeError(firstError, result.spec);
  const upgrade = result.spec.displayName.includes("Plus")
    ? undefined
    : "Upgrade in /pricing to raise this limit.";
  return { ok: false, code: firstError, message, upgradeCta: upgrade };
}

function denyResolver(code: "business-not-found" | "owner-not-found" | "resolver-unavailable"): ShopTierGuardDecision {
  switch (code) {
    case "business-not-found":
      return {
        ok: false,
        code,
        message: "We couldn't find this shop · please reload and try again.",
      };
    case "owner-not-found":
      return {
        ok: false,
        code,
        message:
          "We couldn't resolve your account · please sign out, sign back in and try again.",
      };
    case "resolver-unavailable":
      return {
        ok: false,
        code,
        message:
          "We couldn't verify your plan limits right now · please try again in a moment.",
      };
  }
}

// ─── Public guards · one per route / action ────────────────────────────

/** Assert the business owner's shop_tier permits creating another
 *  product. Fail-closed on resolver errors. */
export async function guardCreateProduct(
  businessId: NexUuid,
): Promise<ShopTierGuardDecision> {
  const owner = await resolveOwnerShopTier(businessId);
  if (!owner.ok) return denyResolver(owner.code);
  const count = await countActiveProducts(businessId);
  if (count === null) return denyResolver("resolver-unavailable");
  const result = enforceCreateProduct(owner.value.shopTier, count);
  if (result.ok) return OK;
  return denyFromResult(result);
}

/** Assert the business owner's shop_tier permits restoring an
 *  archived product back to `draft`. Transition is archived → draft ·
 *  the product will re-count against the active cap once restored, so
 *  we gate on `enforceCreateProduct`. Fail-closed on resolver errors. */
export async function guardRestoreProduct(
  businessId: NexUuid,
): Promise<ShopTierGuardDecision> {
  return guardCreateProduct(businessId);
}

/** Assert the business owner's shop_tier permits adding another image
 *  to the given product (with the submitted byte size). A productId is
 *  required · fresh-upload flows that have not yet created a product
 *  should use `guardUploadImageForNew` instead. Fail-closed when the
 *  product cannot be found. */
export async function guardUploadImage(
  businessId: NexUuid,
  productId: NexUuid,
  uploadedBytes: number,
): Promise<ShopTierGuardDecision> {
  const owner = await resolveOwnerShopTier(businessId);
  if (!owner.ok) return denyResolver(owner.code);
  const snapshot = await readProductImageSnapshot(productId);
  if (!snapshot) {
    return { ok: false, code: "product-not-found", message: "Product not found." };
  }
  if (snapshot.businessId !== businessId) {
    return {
      ok: false,
      code: "product-not-found",
      message: "Product does not belong to this shop.",
    };
  }
  const currentImageCount = snapshot.heroCount + snapshot.galleryCount;
  const result = enforceImageUpload(
    owner.value.shopTier,
    currentImageCount,
    uploadedBytes,
  );
  if (result.ok) return OK;
  return denyFromResult(result);
}

/** Variant of `guardUploadImage` for the fresh-upload flow where the
 *  product row hasn't been created yet. Runs tier + byte-size checks
 *  only · caller is responsible for running `guardCreateProduct`
 *  separately before the row is inserted. */
export async function guardUploadImageForNew(
  businessId: NexUuid,
  uploadedBytes: number,
): Promise<ShopTierGuardDecision> {
  const owner = await resolveOwnerShopTier(businessId);
  if (!owner.ok) return denyResolver(owner.code);
  const result = enforceImageUpload(owner.value.shopTier, 0, uploadedBytes);
  if (result.ok) return OK;
  return denyFromResult(result);
}

/** Assert the business owner's shop_tier permits updating a product's
 *  gallery to the proposed URL count (including hero). Caller passes
 *  `proposedTotalImageCount` = (1 if new hero is non-null else 0) +
 *  new gallery_urls.length, so the guard rejects edits that would
 *  push total images beyond the per-tier cap even when callers skip
 *  the upload route. Fail-closed on resolver errors. */
export async function guardGalleryUpdate(
  businessId: NexUuid,
  productId: NexUuid,
  proposedTotalImageCount: number,
): Promise<ShopTierGuardDecision> {
  const owner = await resolveOwnerShopTier(businessId);
  if (!owner.ok) return denyResolver(owner.code);
  const snapshot = await readProductImageSnapshot(productId);
  if (!snapshot) {
    return { ok: false, code: "product-not-found", message: "Product not found." };
  }
  if (snapshot.businessId !== businessId) {
    return {
      ok: false,
      code: "product-not-found",
      message: "Product does not belong to this shop.",
    };
  }
  const spec = getSpecForDbTier(owner.value.shopTier);
  if (proposedTotalImageCount > spec.products.imagesPerProduct) {
    return {
      ok: false,
      code: "image-cap-per-product",
      message: describeError("image-cap-per-product", spec),
      upgradeCta: spec.displayName.includes("Plus")
        ? undefined
        : "Upgrade in /pricing to raise this limit.",
    };
  }
  return OK;
}

/** Assert the business owner's shop_tier permits adding another video
 *  to the given product (with the submitted byte size + duration). A
 *  productId is REQUIRED; fresh-upload flows must use
 *  `guardUploadVideoForNew`. Fail-closed on resolver errors. */
export async function guardUploadVideo(
  businessId: NexUuid,
  productId: NexUuid,
  uploadedBytes: number,
  durationSeconds: number,
): Promise<ShopTierGuardDecision> {
  const owner = await resolveOwnerShopTier(businessId);
  if (!owner.ok) return denyResolver(owner.code);
  const videoCount = await countVideosOnProduct(productId);
  if (videoCount === null) {
    return { ok: false, code: "product-not-found", message: "Product not found." };
  }
  const result = enforceVideoUpload(
    owner.value.shopTier,
    videoCount,
    uploadedBytes,
    durationSeconds,
  );
  if (result.ok) return OK;
  return denyFromResult(result);
}

/** Variant for fresh-upload (no productId yet). Gates on tier + byte
 *  + duration only. Caller runs guardCreateProduct separately. */
export async function guardUploadVideoForNew(
  businessId: NexUuid,
  uploadedBytes: number,
  durationSeconds: number,
): Promise<ShopTierGuardDecision> {
  const owner = await resolveOwnerShopTier(businessId);
  if (!owner.ok) return denyResolver(owner.code);
  const result = enforceVideoUpload(
    owner.value.shopTier,
    0,
    uploadedBytes,
    durationSeconds,
  );
  if (result.ok) return OK;
  return denyFromResult(result);
}
