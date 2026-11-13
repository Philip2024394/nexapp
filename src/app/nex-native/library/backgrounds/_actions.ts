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
  canClaimFirstFreeTheme,
  claimFirstFreeTheme,
  loadThemesPlusUntil,
} from "@/lib/nex-native/library/entitlement-service";

type ActionResult =
  | { ok: true; assetId: string; firstFreeClaimed?: boolean }
  | { ok: false; error: string };

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

  const asset = await getBackgroundAsset(assetId);
  if (!asset) return { ok: false, error: "asset-not-found" };

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
  options?: { readonly claimFirstFree?: boolean },
): Promise<ActionResult> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, error: "not-signed-in" };

  const asset = await getBackgroundAsset(assetId);
  if (!asset) return { ok: false, error: "asset-not-found" };

  // Owner directive 2026-11-11 · all 450 assets browsable in both
  // pickers. Translate the catalog id to a valid nex_chat_theme id.
  // The nex_chat_theme CHECK constraint enforces
  // `^[a-z][a-z0-9_-]{1,30}$` (max 31 chars, no colons).
  //
  //   · chat-native assets keep their bare id (stripped "chat:" prefix,
  //     already compliant e.g. library-ireland-1)
  //   · shop-native assets get a short "s-" prefix + first 29 chars
  //     of the slug so they fit within the 31-char limit and never
  //     collide with chat-native ids
  const chatThemeId = asset.id.startsWith("chat:")
    ? asset.id.replace(/^chat:/, "")
    : asset.id.startsWith("shop:")
      ? `s-${asset.id.replace(/^shop:/, "").slice(0, 29)}`
      : asset.id;

  // Load or lazy-insert the nex_chat_theme row so the existing chat
  // shell + updateChatThemeAction validator find it.
  let themeRow = (await nexSupabaseAdmin
    .from("nex_chat_theme")
    .select("id, is_active, tier")
    .eq("id", chatThemeId)
    .maybeSingle<{ id: string; is_active: boolean; tier: "gratis" | "bisnis" | "pro" }>()).data;

  if (!themeRow || themeRow.is_active !== true) {
    // Shop-origin asset chosen for chat · create the chat_theme row
    // with tier='bisnis' so the Themes Plus gate still applies (Shop
    // subscription must NOT unlock premium chat themes · owner-sealed
    // commercial separation). This preserves the entitlement model
    // while allowing all 450 to be browsable.
    const { error: upsertErr } = await nexSupabaseAdmin
      .from("nex_chat_theme")
      .upsert(
        {
          id: chatThemeId,
          name: asset.label,
          accent_hex: asset.tintHex ?? "#C6A15B",
          tier: "bisnis",
          category: "premium",
          hero_image_url: asset.storageUrl,
          is_active: true,
          sort_order: 400,
        },
        { onConflict: "id" },
      );
    if (upsertErr) return { ok: false, error: upsertErr.message };
    themeRow = { id: chatThemeId, is_active: true, tier: "bisnis" };
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

  // Owner directive 2026-11-13 · first-free perk. When the standard
  // gate denies because the viewer has no Themes+ access AND the
  // caller explicitly requested the first-free grant AND the viewer
  // is still eligible (no prior first_free row), claim the ownership
  // row and continue to apply. Single theme per account, permanent.
  let firstFreeClaimed = false;
  if (
    !decision.allow &&
    decision.reason === "themes_plus_required" &&
    options?.claimFirstFree === true
  ) {
    const eligible = await canClaimFirstFreeTheme(session.account.id);
    if (!eligible) {
      return { ok: false, error: "first_free_already_claimed" };
    }
    const claim = await claimFirstFreeTheme(session.account.id, themeRow.id);
    if (!claim.ok) {
      return { ok: false, error: `first_free_${claim.reason}` };
    }
    firstFreeClaimed = true;
  } else if (!decision.allow) {
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
  return { ok: true, assetId: asset.id, firstFreeClaimed };
}
