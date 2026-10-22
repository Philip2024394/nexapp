"use server";

// src/app/nex-native/cover-themes-library/edit/[layoutId]/_actions.ts
//
// NEX Shop Face Cover · owner-edit server actions.
// Owner-authorised 2026-10-20 · companion to migration 212.
// -----------------------------------------------------------------------------
// Three narrow actions callable only by the Bisnis account owner of
// the target business. Resolve session → confirm ownership → call
// the sealed service → return a thin result the client can render.
//
//   uploadShopCoverImageAction(formData)
//     file: File · stores in bucket nex-user-wallpapers · persists URL
//
//   updateShopCoverTintAction(formData)
//     hex: string · validates `#RRGGBB` · persists hex
//
//   resetShopCoverAction()
//     Clears BOTH shop_cover_image_url + shop_cover_tint_hex ·
//     returns the shop to the chat_theme defaults.

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as shopCoverService from "@/lib/nex-native/shop-cover-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { isValidCoverLayoutId } from "../../../cover/layout-ids";

export interface ShopCoverActionResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly imageUrl?: string | null;
  readonly tintHex?: string | null;
}

async function resolveViewerPrimaryBusinessId(): Promise<string | null> {
  const session = await resolveNexAppSessionFromContext().catch(() => null);
  if (!session) return null;
  const businesses = await businessService
    .listBusinessesByOwner(session.account.id)
    .catch(() => [] as Array<{ id: string }>);
  return businesses[0]?.id ?? null;
}

export async function uploadShopCoverImageAction(
  formData: FormData,
): Promise<ShopCoverActionResult> {
  const businessId = await resolveViewerPrimaryBusinessId();
  if (!businessId) {
    return { ok: false, error: "Sign in with a business account to upload." };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No image attached." };
  }
  const mimeType = file.type || "image/jpeg";
  try {
    const { publicUrl } = await shopCoverService.uploadShopCoverImage({
      businessId,
      file,
      mimeType,
    });
    return { ok: true, imageUrl: publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed." };
  }
}

export async function updateShopCoverTintAction(
  formData: FormData,
): Promise<ShopCoverActionResult> {
  const businessId = await resolveViewerPrimaryBusinessId();
  if (!businessId) {
    return { ok: false, error: "Sign in with a business account to edit." };
  }
  const hex = String(formData.get("hex") ?? "");
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return { ok: false, error: `Invalid colour "${hex}" · expected #RRGGBB.` };
  }
  try {
    await shopCoverService.updateShopCoverTint(businessId, hex);
    return { ok: true, tintHex: hex };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function resetShopCoverAction(): Promise<ShopCoverActionResult> {
  const businessId = await resolveViewerPrimaryBusinessId();
  if (!businessId) {
    return { ok: false, error: "Sign in with a business account to reset." };
  }
  try {
    await shopCoverService.clearShopCoverImage(businessId);
    await shopCoverService.clearShopCoverTint(businessId);
    return { ok: true, imageUrl: null, tintHex: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Reset failed." };
  }
}

/** Owner directive 2026-10-20 · Bisnis setup flow · "Apply + continue"
 *  button on the Edit Shop Cover page writes `nex_business.
 *  cover_layout_id` so the public shop face cover renders this layout,
 *  then returns the redirect target `/nex-native/themes/<chat-theme>?
 *  shop=open` so the client Link can route. */
export interface ApplyAndContinueResult {
  readonly ok: boolean;
  readonly error?: string;
  /** URL the client should navigate to on success. */
  readonly nextHref?: string;
}

export async function applyAndContinueAction(
  formData: FormData,
): Promise<ApplyAndContinueResult> {
  const session = await resolveNexAppSessionFromContext().catch(() => null);
  if (!session) {
    return { ok: false, error: "Sign in with a business account first." };
  }
  const layoutId = String(formData.get("layoutId") ?? "");
  if (!isValidCoverLayoutId(layoutId)) {
    return { ok: false, error: `Invalid cover layout "${layoutId}".` };
  }
  const businessId = await resolveViewerPrimaryBusinessId();
  if (!businessId) {
    return { ok: false, error: "No business linked to this account." };
  }
  // Persist the chosen cover layout · unlocks the Cover-A render path
  // on /{slug} which composes CoverThemeSkin + CoverLayoutSwitch.
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ cover_layout_id: layoutId })
    .eq("id", businessId);
  if (error) {
    return { ok: false, error: error.message };
  }
  // The chat_theme on the account is the destination. Fall back to
  // the sealed welcome page when the viewer has no chat theme set
  // (edge case · can't preview a theme that doesn't exist).
  const chatTheme = session.account.chat_theme ?? null;
  const nextHref = chatTheme
    ? `/nex-native/themes/${encodeURIComponent(chatTheme)}?shop=open`
    : "/nex-native/welcome";
  return { ok: true, nextHref };
}
