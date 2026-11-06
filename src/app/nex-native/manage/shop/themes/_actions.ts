"use server";

// src/app/nex-native/manage/shop/themes/_actions.ts
//
// Server actions for the Shop Themes surface. All three writes
// delegate to the sealed shop-cover-service / business-service so
// RLS + hex-regex validation + 5 MB image cap stay in one place.

import { revalidatePath } from "next/cache";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  updateShopCoverTint,
  uploadShopCoverImage,
  clearShopCoverTint,
  clearShopCoverImage,
  SHOP_COVER_MAX_BYTES,
  SHOP_COVER_MIME_ALLOWED,
} from "@/lib/nex-native/shop-cover-service";
import {
  COVER_LAYOUT_IDS,
  type CoverLayoutId,
} from "@/app/nex-native/cover/layout-ids";

async function requireOwnedBusiness(businessId: string): Promise<string> {
  const session = await resolveSessionWithDevOverride();
  if (!session) throw new Error("not-authenticated");
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("id,owner_account_id")
    .eq("id", businessId)
    .maybeSingle<{ id: string; owner_account_id: string | null }>();
  if (error || !data) throw new Error("business-not-found");
  if (data.owner_account_id !== session.account.id) throw new Error("not-owner");
  return session.account.id;
}

export async function applyShopLayoutAction(
  businessId: string,
  layoutId: CoverLayoutId,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(COVER_LAYOUT_IDS as readonly string[]).includes(layoutId)) {
    return { ok: false, error: "invalid-layout-id" };
  }
  try {
    await requireOwnedBusiness(businessId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ cover_layout_id: layoutId })
    .eq("id", businessId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/nex-native/manage/shop/themes");
  return { ok: true };
}

export async function applyShopTintAction(
  businessId: string,
  tintHex: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireOwnedBusiness(businessId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const result = tintHex
    ? await updateShopCoverTint(businessId, tintHex)
    : await clearShopCoverTint(businessId);
  if (!result.ok) return { ok: false, error: result.error ?? "update-failed" };
  revalidatePath("/nex-native/manage/shop/themes");
  return { ok: true };
}

export async function applyShopBackgroundAction(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const businessId = String(formData.get("businessId") ?? "");
  const file = formData.get("file");
  if (!businessId) return { ok: false, error: "missing-business-id" };
  if (!(file instanceof File)) {
    return { ok: false, error: "missing-file" };
  }
  if (file.size > SHOP_COVER_MAX_BYTES) {
    return { ok: false, error: "file-too-large" };
  }
  if (!SHOP_COVER_MIME_ALLOWED.has(file.type)) {
    return { ok: false, error: "invalid-mime-type" };
  }
  try {
    await requireOwnedBusiness(businessId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const result = await uploadShopCoverImage(businessId, file);
  if (!result.ok) return { ok: false, error: result.error ?? "upload-failed" };
  revalidatePath("/nex-native/manage/shop/themes");
  return { ok: true, url: result.url };
}

/** Owner directive 2026-11-06 · each preset background carries a
 *  paired tint colour tuned to the image's dominant accent · when
 *  the owner picks a background the server also applies the matching
 *  tint so the shop theme feels cohesive (no manual colour pick
 *  needed per directive "theme color must be set to suit back ground
 *  image"). Keeping both the whitelist AND the tint mapping on the
 *  server prevents client-side URL injection or tint mis-matches. */
const PRESET_BACKGROUND_META: ReadonlyMap<
  string,
  { tintHex: string | null }
> = new Map([
  [
    "/nex-brand/shop-themes/dynamic-nex-shopping-showcase.png",
    { tintHex: "#C6A15B" },
  ],
  [
    "/nex-brand/shop-themes/global-cart-glow.png",
    { tintHex: "#FF7A2B" },
  ],
  [
    "/nex-brand/shop-themes/nex-bag-electric.png",
    { tintHex: "#2A6DD9" },
  ],
  [
    "/nex-brand/shop-themes/sale-best-deals.png",
    { tintHex: "#FF6600" },
  ],
  [
    "/nex-brand/shop-themes/electronics-showcase.png",
    { tintHex: "#1E4A8C" },
  ],
  [
    "/nex-brand/shop-themes/delivery-globe.png",
    { tintHex: "#FF7A2B" },
  ],
  [
    "/nex-brand/shop-themes/mobile-shop-now.png",
    { tintHex: "#FF6B2B" },
  ],
]);

export async function applyShopPresetBackgroundAction(
  businessId: string,
  presetUrl: string,
): Promise<
  { ok: true; url: string; tintHex: string | null } | { ok: false; error: string }
> {
  const meta = PRESET_BACKGROUND_META.get(presetUrl);
  if (!meta) {
    return { ok: false, error: "unknown-preset" };
  }
  try {
    await requireOwnedBusiness(businessId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ shop_cover_image_url: presetUrl })
    .eq("id", businessId);
  if (error) return { ok: false, error: error.message };

  // Apply the paired tint (best-effort · a failure here doesn't roll
  // back the image · the owner can re-pick the preset to retry).
  if (meta.tintHex) {
    await updateShopCoverTint(businessId, meta.tintHex).catch(() => {
      /* ignore · tint will stay as-is */
    });
  }
  revalidatePath("/nex-native/manage/shop/themes");
  return { ok: true, url: presetUrl, tintHex: meta.tintHex };
}

export async function clearShopBackgroundAction(
  businessId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireOwnedBusiness(businessId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const result = await clearShopCoverImage(businessId);
  if (!result.ok) return { ok: false, error: result.error ?? "clear-failed" };
  revalidatePath("/nex-native/manage/shop/themes");
  return { ok: true };
}
