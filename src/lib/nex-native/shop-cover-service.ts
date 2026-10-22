// src/lib/nex-native/shop-cover-service.ts
//
// NEX Bisnis · Owner-authored shop face cover overrides.
// Owner-authorised 2026-10-20 · companion to migration 212.
// =============================================================================
// Lets a Bisnis account owner tune the public shop face cover at
// /nex-native/{businessSlug} on top of the sealed Cover-A theme:
//   · uploadShopCoverImage · stores a 5MB-max image in bucket
//     nex-user-wallpapers and persists the URL on
//     nex_business.shop_cover_image_url
//   · updateShopCoverTint · persists a `#RRGGBB` hex on
//     nex_business.shop_cover_tint_hex
//   · clearShopCoverImage / clearShopCoverTint · wipe either column
//     without touching the stored object (nightly janitor can prune)
//
// Precedence at render time (sealed · see [businessSlug]/page.tsx):
//   shop_cover_image_url → theme.hero_image_url → gradient fallback
//   shop_cover_tint_hex  → theme.accent_hex

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";

export const SHOP_COVER_MAX_BYTES = 5 * 1024 * 1024;
export const SHOP_COVER_MIME_ALLOWED = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const SHOP_COVER_BUCKET = "nex-user-wallpapers";
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export interface ShopCoverOverrides {
  readonly imageUrl: string | null;
  readonly tintHex: string | null;
}

/** Fail-soft read · returns null fields on error / missing columns.
 *  Callers fall back to the chat theme defaults. */
export async function getShopCoverOverrides(
  businessId: string,
): Promise<ShopCoverOverrides> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_business")
      .select("shop_cover_image_url, shop_cover_tint_hex")
      .eq("id", businessId)
      .maybeSingle();
    if (error || !data) return { imageUrl: null, tintHex: null };
    const row = data as unknown as {
      shop_cover_image_url?: string | null;
      shop_cover_tint_hex?: string | null;
    };
    return {
      imageUrl: row.shop_cover_image_url ?? null,
      tintHex: row.shop_cover_tint_hex ?? null,
    };
  } catch {
    return { imageUrl: null, tintHex: null };
  }
}

export async function uploadShopCoverImage(input: {
  businessId: string;
  file: File;
  mimeType: string;
}): Promise<{ publicUrl: string }> {
  if (!SHOP_COVER_MIME_ALLOWED.has(input.mimeType)) {
    throw new Error(
      `Mime "${input.mimeType}" not accepted · PNG · JPG · WebP only.`,
    );
  }
  if (input.file.size > SHOP_COVER_MAX_BYTES) {
    throw new Error(
      `Image is ${(input.file.size / 1024 / 1024).toFixed(2)} MB · max 5 MB.`,
    );
  }
  const bucket = nexSupabaseAdmin.storage.from(SHOP_COVER_BUCKET);
  const ext =
    input.mimeType === "image/png"
      ? "png"
      : input.mimeType === "image/webp"
        ? "webp"
        : "jpg";
  const objectPath = `shop/${input.businessId}/cover.${ext}`;
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const { error: upErr } = await bucket.upload(objectPath, buffer, {
    contentType: input.mimeType,
    upsert: true,
    cacheControl: "3600",
  });
  if (upErr) {
    throw new Error(`shop-cover-service.uploadShopCoverImage: ${upErr.message}`);
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  const publicUrl = pub.publicUrl;
  const { error: dbErr } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ shop_cover_image_url: publicUrl })
    .eq("id", input.businessId);
  if (dbErr) {
    throw new Error(
      `shop-cover-service.uploadShopCoverImage (db): ${dbErr.message}`,
    );
  }
  return { publicUrl };
}

export async function clearShopCoverImage(businessId: string): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ shop_cover_image_url: null })
    .eq("id", businessId);
  if (error) {
    throw new Error(`shop-cover-service.clearShopCoverImage: ${error.message}`);
  }
}

export async function updateShopCoverTint(
  businessId: string,
  hex: string,
): Promise<void> {
  if (!HEX_RE.test(hex)) {
    throw new Error(`Invalid hex "${hex}" · expected #RRGGBB.`);
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ shop_cover_tint_hex: hex })
    .eq("id", businessId);
  if (error) {
    throw new Error(`shop-cover-service.updateShopCoverTint: ${error.message}`);
  }
}

export async function clearShopCoverTint(businessId: string): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ shop_cover_tint_hex: null })
    .eq("id", businessId);
  if (error) {
    throw new Error(`shop-cover-service.clearShopCoverTint: ${error.message}`);
  }
}
