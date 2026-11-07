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
  // Owner directive 2026-11-06 · emerald-green variants (th7–th12) ·
  // same 6 compositions in neon-green tones · paired tint is a
  // vivid green so the theme colour follows the image. Not country-
  // scoped · themes are worldwide (owner directive "we dont want
  // the word irish on the themes").
  [
    "/nex-brand/shop-themes/global-cart-glow-green.png",
    { tintHex: "#16D66B" },
  ],
  [
    "/nex-brand/shop-themes/nex-bag-electric-green.png",
    { tintHex: "#16D66B" },
  ],
  [
    "/nex-brand/shop-themes/best-deals-green.png",
    { tintHex: "#16D66B" },
  ],
  [
    "/nex-brand/shop-themes/electronics-showcase-green.png",
    { tintHex: "#16D66B" },
  ],
  [
    "/nex-brand/shop-themes/delivery-globe-green.png",
    { tintHex: "#16D66B" },
  ],
  [
    "/nex-brand/shop-themes/mobile-shop-now-green.png",
    { tintHex: "#16D66B" },
  ],
  // Owner directive 2026-11-06 · six new category-specific
  // backgrounds (th13–th18) introducing fashion, tools, sports,
  // food, and travel surfaces plus a second electronics option.
  // Each tint matches the dominant glow of the source image so
  // the applied theme colour tracks the dominant hue.
  [
    "/nex-brand/shop-themes/electronics-blue-glow.png",
    { tintHex: "#1E6DD9" },
  ],
  [
    "/nex-brand/shop-themes/fashion-beauty-purple.png",
    { tintHex: "#C62AD9" },
  ],
  [
    "/nex-brand/shop-themes/tools-trade-green.png",
    { tintHex: "#16D66B" },
  ],
  [
    "/nex-brand/shop-themes/sports-outdoors-orange.png",
    { tintHex: "#FF7A2B" },
  ],
  [
    "/nex-brand/shop-themes/food-grocery-red.png",
    { tintHex: "#D82A2A" },
  ],
  [
    "/nex-brand/shop-themes/travel-luggage-gold.png",
    { tintHex: "#F2B23A" },
  ],
  // Owner directive 2026-11-07 · phil1–phil19 + phil100–phil121 ·
  // 41 new portrait backgrounds spanning fashion / showcase /
  // online / travel / food / sale / electronics. Each tint matches
  // the dominant hue of the source image so the applied theme colour
  // tracks the composition (owner directive "with correct color theme").
  ["/nex-brand/shop-themes/phil1.png", { tintHex: "#F2B4D4" }],
  ["/nex-brand/shop-themes/phil2.png", { tintHex: "#E8A5C1" }],
  ["/nex-brand/shop-themes/phil3.png", { tintHex: "#C9A96B" }],
  ["/nex-brand/shop-themes/phil4.png", { tintHex: "#D9B86A" }],
  ["/nex-brand/shop-themes/phil5.png", { tintHex: "#F5B5C9" }],
  ["/nex-brand/shop-themes/phil6.png", { tintHex: "#7CB342" }],
  ["/nex-brand/shop-themes/phil7.png", { tintHex: "#F2A7C1" }],
  ["/nex-brand/shop-themes/phil8.png", { tintHex: "#4A6B8C" }],
  ["/nex-brand/shop-themes/phil9.png", { tintHex: "#5BA7D9" }],
  ["/nex-brand/shop-themes/phil10.png", { tintHex: "#D9B86A" }],
  ["/nex-brand/shop-themes/phil11.png", { tintHex: "#A0522D" }],
  ["/nex-brand/shop-themes/phil12.png", { tintHex: "#8B5A2B" }],
  ["/nex-brand/shop-themes/phil13.png", { tintHex: "#F08CA8" }],
  ["/nex-brand/shop-themes/phil14.png", { tintHex: "#D9C5A0" }],
  ["/nex-brand/shop-themes/phil15.png", { tintHex: "#E85A4F" }],
  ["/nex-brand/shop-themes/phil16.png", { tintHex: "#F2B4D4" }],
  ["/nex-brand/shop-themes/phil17.png", { tintHex: "#D9A86A" }],
  ["/nex-brand/shop-themes/phil18.png", { tintHex: "#E8A87C" }],
  ["/nex-brand/shop-themes/phil19.png", { tintHex: "#F279A1" }],
  ["/nex-brand/shop-themes/phil100.png", { tintHex: "#FF6A1F" }],
  ["/nex-brand/shop-themes/phil101.png", { tintHex: "#FF7A2B" }],
  ["/nex-brand/shop-themes/phil102.png", { tintHex: "#D9823B" }],
  ["/nex-brand/shop-themes/phil103.png", { tintHex: "#FF7A2B" }],
  ["/nex-brand/shop-themes/phil104.png", { tintHex: "#D9452A" }],
  ["/nex-brand/shop-themes/phil105.png", { tintHex: "#D97A2A" }],
  ["/nex-brand/shop-themes/phil106.png", { tintHex: "#E85A1F" }],
  ["/nex-brand/shop-themes/phil107.png", { tintHex: "#FF8A1F" }],
  ["/nex-brand/shop-themes/phil108.png", { tintHex: "#B13D8A" }],
  ["/nex-brand/shop-themes/phil109.png", { tintHex: "#D9BA2A" }],
  ["/nex-brand/shop-themes/phil110.png", { tintHex: "#D94D3A" }],
  ["/nex-brand/shop-themes/phil111.png", { tintHex: "#F2A82A" }],
  ["/nex-brand/shop-themes/phil112.png", { tintHex: "#B1203D" }],
  ["/nex-brand/shop-themes/phil113.png", { tintHex: "#D92A2A" }],
  ["/nex-brand/shop-themes/phil114.png", { tintHex: "#D92A2A" }],
  ["/nex-brand/shop-themes/phil115.png", { tintHex: "#D9B86A" }],
  ["/nex-brand/shop-themes/phil116.png", { tintHex: "#D9B86A" }],
  ["/nex-brand/shop-themes/phil117.png", { tintHex: "#D92A2A" }],
  ["/nex-brand/shop-themes/phil118.png", { tintHex: "#D9B86A" }],
  ["/nex-brand/shop-themes/phil119.png", { tintHex: "#2A6DD9" }],
  ["/nex-brand/shop-themes/phil120.png", { tintHex: "#D9B86A" }],
  ["/nex-brand/shop-themes/phil121.png", { tintHex: "#2A6DD9" }],
  // Owner directive 2026-11-07 (later same day) · 8 more portrait
  // backgrounds for shop template pages: 2 watch compositions + 6
  // vitamin/supplement product shots. Tints match dominant hue of
  // each source image. phil123 was supplied as .paint (Microsoft
  // Paint project) · not web-usable · owner asked to re-export as
  // PNG and that entry will be added when it lands.
  ["/nex-brand/shop-themes/phil122.png", { tintHex: "#D9B86A" }],
  ["/nex-brand/shop-themes/phil124.png", { tintHex: "#2A6DD9" }],
  ["/nex-brand/shop-themes/phil125.png", { tintHex: "#FF8A1F" }],
  ["/nex-brand/shop-themes/phil126.png", { tintHex: "#B13D8A" }],
  ["/nex-brand/shop-themes/phil127.png", { tintHex: "#F2A82A" }],
  ["/nex-brand/shop-themes/phil128.png", { tintHex: "#2A6DD9" }],
  ["/nex-brand/shop-themes/phil129.png", { tintHex: "#7CB342" }],
  ["/nex-brand/shop-themes/phil130.png", { tintHex: "#2A6DD9" }],
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
