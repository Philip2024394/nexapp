// src/app/nex-native/library/backgrounds/_actions.ts
//
// NEX Unified Visual Library · save actions (server-side).
// Owner-authorised 2026-11-11 · Phase 1 implementation.
// -----------------------------------------------------------------------------
// Two STRICTLY INDEPENDENT save paths. The dispatch is driven by an explicit
// `context` parameter the client supplies; shop and chat never cross-write.
//
// Shop context (`applyFromLibraryShopAction`):
//   · validates the asset in nex_background_asset (contexts contains 'shop')
//   · verifies the viewer owns the business
//   · writes nex_business.shop_cover_image_url + shop_cover_tint_hex
//   · DOES NOT touch nex_account.chat_theme
//
// Chat context (`applyFromLibraryChatAction`):
//   · validates the asset in nex_background_asset (contexts contains 'chat')
//   · strips the "chat:" id prefix to get the canonical chat_theme id
//   · verifies the chat_theme row exists in nex_chat_theme (seeded by mig 337)
//   · writes nex_account.chat_theme
//   · DOES NOT touch nex_business.shop_cover_image_url or shop_cover_tint_hex
//
// Zero shared code path between the two · zero accidental coupling.

"use server";

import { revalidatePath } from "next/cache";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { updateShopCoverTint } from "@/lib/nex-native/shop-cover-service";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { effectiveTier } from "@/lib/nex-native/account-service";
import { getBackgroundAsset } from "@/lib/nex-native/library/catalog-service";
import {
  canAccessChatTheme,
  loadThemesPlusUntil,
} from "@/lib/nex-native/library/entitlement-service";

type ActionResult = { ok: true; assetId: string } | { ok: false; error: string };

// Replicates the local requireOwnedBusiness check pattern from
// src/app/nex-native/manage/shop/themes/_actions.ts. Kept local so the
// library's shop action enforces the SAME ownership guarantee as the
// legacy shop writer · prevents one owner from applying a background
// to another owner's business.
async function assertOwnsBusiness(businessId: string, actorAccountId: string): Promise<void> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("id,owner_account_id")
    .eq("id", businessId)
    .maybeSingle<{ id: string; owner_account_id: string | null }>();
  if (error || !data) throw new Error("business-not-found");
  if (data.owner_account_id !== actorAccountId) throw new Error("not-owner");
}

/** SHOP CONTEXT · writes nex_business.shop_cover_image_url + shop_cover_tint_hex.
 *  Never touches chat_theme. Entitlement: viewer must own the target business
 *  AND effectiveTier must be 'bisnis' (same gate as the existing shop picker). */
export async function applyFromLibraryShopAction(
  businessId: string,
  assetId: string,
): Promise<ActionResult> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, error: "not-signed-in" };

  if (effectiveTier(session.account) !== "bisnis") {
    return { ok: false, error: "shop-tier-required" };
  }

  const asset = await getBackgroundAsset(assetId, { context: "shop" });
  if (!asset) return { ok: false, error: "asset-not-found-or-wrong-context" };

  try {
    await assertOwnsBusiness(businessId, session.account.id);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ shop_cover_image_url: asset.storageUrl })
    .eq("id", businessId);
  if (error) return { ok: false, error: error.message };

  if (asset.tintHex) {
    await updateShopCoverTint(businessId, asset.tintHex).catch(() => {
      /* ignore · tint failure doesn't roll back the image */
    });
  }
  revalidatePath("/nex-native/manage/shop/backgrounds");
  revalidatePath("/nex-native/manage/shop/themes");
  revalidatePath("/nex-native/library/backgrounds");
  return { ok: true, assetId: asset.id };
}

/** CHAT CONTEXT · writes nex_account.chat_theme.
 *  Never touches nex_business.
 *
 *  Entitlement gate · matches the existing updateChatThemeAction
 *  (_actions.ts:5888) so this library save path is not a weaker surface:
 *   · If the chat_theme row has tier='gratis' · any signed-in viewer
 *     may set it.
 *   · If the chat_theme row has tier='bisnis' · the viewer's
 *     effectiveTier must be 'bisnis'.
 *  When Themes Plus Phase 1 introduces canAccessTheme(), swap the gate
 *  here to call that service for the 5-gate contract. */
export async function applyFromLibraryChatAction(
  assetId: string,
): Promise<ActionResult> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, error: "not-signed-in" };

  const asset = await getBackgroundAsset(assetId, { context: "chat" });
  if (!asset) return { ok: false, error: "asset-not-found-or-wrong-context" };

  // Strip the "chat:" prefix to get the canonical chat_theme id that
  // nex_account.chat_theme stores and chatThemeService.getThemeById reads.
  const chatThemeId = asset.id.replace(/^chat:/, "");

  // Verify the chat theme row exists (seeded by mig 337). Read tier so
  // the premium gate can enforce correctly.
  const { data: themeRow, error: themeErr } = await nexSupabaseAdmin
    .from("nex_chat_theme")
    .select("id, is_active, tier")
    .eq("id", chatThemeId)
    .maybeSingle<{ id: string; is_active: boolean; tier: "gratis" | "bisnis" | "pro" }>();
  if (themeErr) return { ok: false, error: themeErr.message };
  if (!themeRow || themeRow.is_active !== true) {
    return { ok: false, error: "chat-theme-not-seeded" };
  }

  // Premium gate · owner-sealed commercial separation.
  // Does NOT consult effectiveTier() · shop subscribers must NOT
  // automatically unlock premium chat themes. Reads only Themes Plus
  // signals (themes_plus_until + legacy ownership).
  const themesPlusUntil = await loadThemesPlusUntil(session.account.id);
  const decision = await canAccessChatTheme(
    { id: themeRow.id, tier: themeRow.tier },
    { id: session.account.id, themes_plus_until: themesPlusUntil },
  );
  if (!decision.allow) {
    return { ok: false, error: decision.reason };
  }

  const { error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({ chat_theme: chatThemeId })
    .eq("id", session.account.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nex-native/chat-themes-library");
  revalidatePath("/nex-native/chat-themes-library/all");
  revalidatePath("/nex-native/library/backgrounds");
  return { ok: true, assetId: asset.id };
}
