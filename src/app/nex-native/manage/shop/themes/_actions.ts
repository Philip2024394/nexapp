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
  // Owner fix 2026-11-12 · updateShopCoverTint / clearShopCoverTint
  // return `void` (service-layer throws on failure) · the prior code
  // treated the result as { ok, error } and crashed at runtime
  // (digest 4005073838 in the dev log). Wrap in try/catch and return
  // the discriminated union the client expects.
  try {
    if (tintHex) {
      await updateShopCoverTint(businessId, tintHex);
    } else {
      await clearShopCoverTint(businessId);
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message || "update-failed" };
  }
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
  // L-044 fix 2026-11-26 · `uploadShopCoverImage` was migrated to take
  // an object input `{ businessId, file, mimeType }` and return
  // `{ publicUrl }`, throwing on failure. This action still used the
  // legacy two-positional-arg / `{ ok, error, url }` shape, so tsc
  // flagged three TS2339 errors on the dead `result.ok / result.error /
  // result.url` accesses. Switch to the current contract + catch the
  // thrown error so the client sees the same `{ ok: false, error }`
  // envelope it has always received.
  let publicUrl: string;
  try {
    const result = await uploadShopCoverImage({
      businessId,
      file,
      mimeType: file.type,
    });
    publicUrl = result.publicUrl;
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "upload-failed" };
  }
  revalidatePath("/nex-native/manage/shop/themes");
  return { ok: true, url: publicUrl };
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
  // Owner directive 2026-11-07 (third batch) · 21 more portrait
  // backgrounds for shop page backgrounds · watches / vitamins /
  // teddy / theme / plastering trade / jewellery / door hardware.
  // Spaced filenames (vitamins 2 · teddy 2 · plasterers max ·
  // plastering 1) were hyphenated to avoid URL-encoding fragility.
  // VITAMINS.png lowercased to vitamins.png.
  ["/nex-brand/shop-themes/w1.png", { tintHex: "#4A6B8C" }],
  ["/nex-brand/shop-themes/w2.png", { tintHex: "#D9A83A" }],
  ["/nex-brand/shop-themes/watches.png", { tintHex: "#D9B86A" }],
  ["/nex-brand/shop-themes/watch1.png", { tintHex: "#6B9F3A" }],
  ["/nex-brand/shop-themes/vitamins.png", { tintHex: "#FF8A1F" }],
  ["/nex-brand/shop-themes/vitamins-2.png", { tintHex: "#F2A82A" }],
  ["/nex-brand/shop-themes/theme1.png", { tintHex: "#8B5FC9" }],
  ["/nex-brand/shop-themes/theme4.png", { tintHex: "#E880C9" }],
  ["/nex-brand/shop-themes/teddy1.png", { tintHex: "#F2A7C1" }],
  ["/nex-brand/shop-themes/teddy-2.png", { tintHex: "#F08CA8" }],
  ["/nex-brand/shop-themes/plasterers-max.png", { tintHex: "#FF7A2B" }],
  ["/nex-brand/shop-themes/plastering-1.png", { tintHex: "#E8A87C" }],
  ["/nex-brand/shop-themes/phil91.png", { tintHex: "#E8E8F0" }],
  ["/nex-brand/shop-themes/phil92.png", { tintHex: "#D9A83A" }],
  ["/nex-brand/shop-themes/phil93.png", { tintHex: "#F5E8D9" }],
  ["/nex-brand/shop-themes/phil94.png", { tintHex: "#8B3DD9" }],
  ["/nex-brand/shop-themes/phil95.png", { tintHex: "#D92A2A" }],
  ["/nex-brand/shop-themes/phil96.png", { tintHex: "#2AC9D9" }],
  ["/nex-brand/shop-themes/phil97.png", { tintHex: "#4A5A6B" }],
  ["/nex-brand/shop-themes/phil98.png", { tintHex: "#2A6DD9" }],
  ["/nex-brand/shop-themes/phil99.png", { tintHex: "#A0522D" }],
  // Owner directive 2026-11-07 (fourth batch) · 65 more portrait
  // backgrounds for shop pages · cakes/desserts, abstract color
  // backdrops, cruise/travel, international cuisine, baked goods,
  // tools/trade, baby clothing. Deduped against prior commits
  // (phil11-15 skipped · already present).
  ["/nex-brand/shop-themes/phil21.png", { tintHex: "#B88CD9" }],
  ["/nex-brand/shop-themes/phil22.png", { tintHex: "#7BC4C4" }],
  ["/nex-brand/shop-themes/phil23.png", { tintHex: "#F08CA8" }],
  ["/nex-brand/shop-themes/phil24.png", { tintHex: "#E8D5A8" }],
  ["/nex-brand/shop-themes/phil25.png", { tintHex: "#F08CB8" }],
  ["/nex-brand/shop-themes/phil26.png", { tintHex: "#A86A3A" }],
  ["/nex-brand/shop-themes/phil27.png", { tintHex: "#8B5FC9" }],
  ["/nex-brand/shop-themes/phil28.png", { tintHex: "#4FD1C5" }],
  ["/nex-brand/shop-themes/phil29.png", { tintHex: "#F08C7B" }],
  ["/nex-brand/shop-themes/phil30.png", { tintHex: "#F5E8D9" }],
  ["/nex-brand/shop-themes/phil31.png", { tintHex: "#F2A7C1" }],
  ["/nex-brand/shop-themes/phil32.png", { tintHex: "#6B3A1F" }],
  ["/nex-brand/shop-themes/phil33.png", { tintHex: "#C090F0" }],
  ["/nex-brand/shop-themes/phil34.png", { tintHex: "#90F0D0" }],
  ["/nex-brand/shop-themes/phil35.png", { tintHex: "#F0807B" }],
  ["/nex-brand/shop-themes/phil36.png", { tintHex: "#1F3A6B" }],
  ["/nex-brand/shop-themes/phil37.png", { tintHex: "#0FA8A8" }],
  ["/nex-brand/shop-themes/phil38.png", { tintHex: "#F08C1F" }],
  ["/nex-brand/shop-themes/phil39.png", { tintHex: "#BFBFBF" }],
  ["/nex-brand/shop-themes/phil40.png", { tintHex: "#C0001F" }],
  ["/nex-brand/shop-themes/phil41.png", { tintHex: "#0F5F2B" }],
  ["/nex-brand/shop-themes/phil42.png", { tintHex: "#F5E8C5" }],
  ["/nex-brand/shop-themes/phil43.png", { tintHex: "#D5D5D5" }],
  ["/nex-brand/shop-themes/phil44.png", { tintHex: "#F5EFE0" }],
  ["/nex-brand/shop-themes/phil45.png", { tintHex: "#B5D5F0" }],
  ["/nex-brand/shop-themes/phil46.png", { tintHex: "#E0C5F5" }],
  ["/nex-brand/shop-themes/phil47.png", { tintHex: "#F5B5D0" }],
  ["/nex-brand/shop-themes/phil48.png", { tintHex: "#E8D5A8" }],
  ["/nex-brand/shop-themes/phil49.png", { tintHex: "#7A9BC4" }],
  ["/nex-brand/shop-themes/phil50.png", { tintHex: "#F5E8C5" }],
  ["/nex-brand/shop-themes/phil51.png", { tintHex: "#F08CA8" }],
  ["/nex-brand/shop-themes/phil52.png", { tintHex: "#5BA7D9" }],
  ["/nex-brand/shop-themes/phil53.png", { tintHex: "#9B6DD9" }],
  ["/nex-brand/shop-themes/phil54.png", { tintHex: "#FF7A2B" }],
  ["/nex-brand/shop-themes/phil55.png", { tintHex: "#E8A82A" }],
  ["/nex-brand/shop-themes/phil61.png", { tintHex: "#D9452A" }],
  ["/nex-brand/shop-themes/phil62.png", { tintHex: "#FF7A2B" }],
  ["/nex-brand/shop-themes/phil63.png", { tintHex: "#D9823B" }],
  ["/nex-brand/shop-themes/phil64.png", { tintHex: "#2A6DD9" }],
  ["/nex-brand/shop-themes/phil65.png", { tintHex: "#E85AA8" }],
  ["/nex-brand/shop-themes/phil66.png", { tintHex: "#B1203D" }],
  ["/nex-brand/shop-themes/phil67.png", { tintHex: "#D97A2A" }],
  ["/nex-brand/shop-themes/phil68.png", { tintHex: "#D9452A" }],
  ["/nex-brand/shop-themes/phil69.png", { tintHex: "#D9BA2A" }],
  ["/nex-brand/shop-themes/phil70.png", { tintHex: "#1F6F2B" }],
  ["/nex-brand/shop-themes/phil71.png", { tintHex: "#2A6DD9" }],
  ["/nex-brand/shop-themes/phil72.png", { tintHex: "#8B5A2B" }],
  ["/nex-brand/shop-themes/phil73.png", { tintHex: "#E8A82A" }],
  ["/nex-brand/shop-themes/phil74.png", { tintHex: "#A0522D" }],
  ["/nex-brand/shop-themes/phil75.png", { tintHex: "#F08CA8" }],
  ["/nex-brand/shop-themes/phil76.png", { tintHex: "#1F6F2B" }],
  ["/nex-brand/shop-themes/phil77.png", { tintHex: "#2A6DD9" }],
  ["/nex-brand/shop-themes/phil78.png", { tintHex: "#F0A82A" }],
  ["/nex-brand/shop-themes/phil79.png", { tintHex: "#F0B82A" }],
  ["/nex-brand/shop-themes/phil80.png", { tintHex: "#2A6DD9" }],
  ["/nex-brand/shop-themes/phil81.png", { tintHex: "#A0522D" }],
  ["/nex-brand/shop-themes/phil82.png", { tintHex: "#B1203D" }],
  ["/nex-brand/shop-themes/phil83.png", { tintHex: "#F0931F" }],
  ["/nex-brand/shop-themes/phil84.png", { tintHex: "#1F7F3F" }],
  ["/nex-brand/shop-themes/phil85.png", { tintHex: "#5BA7D9" }],
  ["/nex-brand/shop-themes/phil86.png", { tintHex: "#F08CB8" }],
  ["/nex-brand/shop-themes/phil87.png", { tintHex: "#D9C5A0" }],
  ["/nex-brand/shop-themes/phil88.png", { tintHex: "#5FC97B" }],
  ["/nex-brand/shop-themes/phil89.png", { tintHex: "#F0C82A" }],
  ["/nex-brand/shop-themes/phil90.png", { tintHex: "#9B6DD9" }],
  // Owner directive 2026-11-07 (fifth batch) · 25 tt* portrait
  // backgrounds for shop templates · 6 interior/lighting scenes and
  // 19 luxury handbag compositions. Tints match dominant hue per
  // image. tt7/tt8 not supplied · gap preserved.
  ["/nex-brand/shop-themes/tt1.png", { tintHex: "#2E3B52" }],
  ["/nex-brand/shop-themes/tt2.png", { tintHex: "#D9C5A0" }],
  ["/nex-brand/shop-themes/tt3.png", { tintHex: "#1F3A6B" }],
  ["/nex-brand/shop-themes/tt4.png", { tintHex: "#8B5A2B" }],
  ["/nex-brand/shop-themes/tt5.png", { tintHex: "#6B7F3A" }],
  ["/nex-brand/shop-themes/tt6.png", { tintHex: "#8B939F" }],
  ["/nex-brand/shop-themes/tt9.png", { tintHex: "#C0001F" }],
  ["/nex-brand/shop-themes/tt10.png", { tintHex: "#1F3A6B" }],
  ["/nex-brand/shop-themes/tt11.png", { tintHex: "#D9C5A0" }],
  ["/nex-brand/shop-themes/tt12.png", { tintHex: "#0F5F2B" }],
  ["/nex-brand/shop-themes/tt13.png", { tintHex: "#8B3DD9" }],
  ["/nex-brand/shop-themes/tt14.png", { tintHex: "#C0821F" }],
  ["/nex-brand/shop-themes/tt15.png", { tintHex: "#1F3A6B" }],
  ["/nex-brand/shop-themes/tt16.png", { tintHex: "#C0001F" }],
  ["/nex-brand/shop-themes/tt17.png", { tintHex: "#D9C5A0" }],
  ["/nex-brand/shop-themes/tt18.png", { tintHex: "#0F5F2B" }],
  ["/nex-brand/shop-themes/tt19.png", { tintHex: "#8B3DD9" }],
  ["/nex-brand/shop-themes/tt20.png", { tintHex: "#D9C5A0" }],
  ["/nex-brand/shop-themes/tt21.png", { tintHex: "#D9C5A0" }],
  ["/nex-brand/shop-themes/tt22.png", { tintHex: "#D9C5A0" }],
  ["/nex-brand/shop-themes/tt23.png", { tintHex: "#D9A83A" }],
  ["/nex-brand/shop-themes/tt24.png", { tintHex: "#F08CB8" }],
  ["/nex-brand/shop-themes/tt25.png", { tintHex: "#1F3A6B" }],
  ["/nex-brand/shop-themes/tt26.png", { tintHex: "#C0001F" }],
  ["/nex-brand/shop-themes/tt27.png", { tintHex: "#0F5F2B" }],
  // Owner directive 2026-11-07 (sixth batch) · 15 bb* portrait
  // backgrounds · 10 travel/outdoors (backpacks + luggage) + 5
  // fashion (shoes).
  ["/nex-brand/shop-themes/bb1.png", { tintHex: "#FF7A2B" }],
  ["/nex-brand/shop-themes/bb2.png", { tintHex: "#1F6F2B" }],
  ["/nex-brand/shop-themes/bb3.png", { tintHex: "#2A6DD9" }],
  ["/nex-brand/shop-themes/bb4.png", { tintHex: "#5BA7D9" }],
  ["/nex-brand/shop-themes/bb5.png", { tintHex: "#D9A86A" }],
  ["/nex-brand/shop-themes/bb6.png", { tintHex: "#8B3DD9" }],
  ["/nex-brand/shop-themes/bb7.png", { tintHex: "#F0A82A" }],
  ["/nex-brand/shop-themes/bb8.png", { tintHex: "#2A6DD9" }],
  ["/nex-brand/shop-themes/bb9.png", { tintHex: "#D9452A" }],
  ["/nex-brand/shop-themes/bb10.png", { tintHex: "#4A6B8C" }],
  ["/nex-brand/shop-themes/bb11.png", { tintHex: "#C0821F" }],
  ["/nex-brand/shop-themes/bb12.png", { tintHex: "#2A6DD9" }],
  ["/nex-brand/shop-themes/bb13.png", { tintHex: "#D9823B" }],
  ["/nex-brand/shop-themes/bb14.png", { tintHex: "#8B5A2B" }],
  ["/nex-brand/shop-themes/bb15.png", { tintHex: "#D92A2A" }],
  // Owner directive 2026-11-08 · 5 kebab/shawarma portrait backgrounds
  // with vivid emerald-green ambient glow · tint matches the sealed
  // green variant (#16D66B) so the applied theme colour follows the
  // image. Category = food.
  ["/nex-brand/shop-themes/kebab-smoky-green.png", { tintHex: "#16D66B" }],
  ["/nex-brand/shop-themes/kebab-cascading.png", { tintHex: "#16D66B" }],
  ["/nex-brand/shop-themes/kebab-emerald-glow.png", { tintHex: "#16D66B" }],
  ["/nex-brand/shop-themes/shawarma-cinematic-emerald.png", { tintHex: "#16D66B" }],
  ["/nex-brand/shop-themes/kebab-green-kitchen.png", { tintHex: "#16D66B" }],
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
  try {
    await clearShopCoverImage(businessId);
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "clear-failed" };
  }
  revalidatePath("/nex-native/manage/shop/themes");
  return { ok: true };
}
