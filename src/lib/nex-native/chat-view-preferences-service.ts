// src/lib/nex-native/chat-view-preferences-service.ts
//
// NEX Chat · viewer-side chat view preferences · owner-sealed 2026-11-07.
// -----------------------------------------------------------------------------
// Reads + writes the five viewer-side preferences added by migration 285
// (AUTHORED · NOT YET APPLIED). Sealed defaults applied when the
// columns are absent so the UI + render surfaces work Day 1.
//
// Sections covered:
//   5 · Screenshot & copy protection · viewer-side CSS + event blocks
//   6 · Chat font · family + size (viewer-side only)
//   7 · Background sync · chat bg from shop cover + shop cover from
//       chat theme
//
// Doctrine:
//   · Fail-safe · unapplied column reads degrade to sealed defaults ·
//     never throws from the "safe" variant.
//   · Viewer-side · never affects what contacts see of the viewer's
//     messages. Section 7 toggles can affect how the viewer sees
//     their OWN pages (shop page while they're the owner).
//   · Enum-constrained · font family + size reject unknown values at
//     the service boundary so the UI can never persist garbage.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";
import {
  DEFAULT_CHAT_VIEW_PREFS,
  narrowFontFamily,
  narrowFontSize,
  type ChatFontFamily,
  type ChatFontSize,
  type ChatViewPreferences,
} from "./chat-view-preferences";

// Re-export the pure client-safe surface so existing server callers
// that import from this file continue to compile unchanged. Client
// components should import from `./chat-view-preferences` directly
// to avoid pulling `"server-only"` into the client bundle.
export {
  DEFAULT_CHAT_VIEW_PREFS,
  CHAT_FONT_FAMILIES,
  CHAT_FONT_SIZES,
  resolveFontFamilyCss,
  resolveFontSizeCss,
} from "./chat-view-preferences";
export type {
  ChatFontFamily,
  ChatFontSize,
  ChatViewPreferences,
} from "./chat-view-preferences";

// ─── Column probe · safe degradation before migration 285 is applied ──

let viewPrefsColumnProbeCache: boolean | null = null;

export async function hasChatViewPrefsColumns(): Promise<boolean> {
  if (viewPrefsColumnProbeCache !== null) return viewPrefsColumnProbeCache;
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_account")
      .select("screenshot_copy_protection_enabled")
      .limit(0);
    viewPrefsColumnProbeCache = !error;
    return viewPrefsColumnProbeCache;
  } catch {
    viewPrefsColumnProbeCache = false;
    return false;
  }
}

export function _resetChatViewPrefsColumnProbeCacheForTests(): void {
  viewPrefsColumnProbeCache = null;
}

// ─── Row mapper ──────────────────────────────────────────────────────
// narrowFontFamily + narrowFontSize are imported from the pure
// chat-view-preferences module so client + server share one source
// of truth.

function rowToPrefs(row: Record<string, unknown>): ChatViewPreferences {
  return {
    screenshot_copy_protection_enabled:
      typeof row.screenshot_copy_protection_enabled === "boolean"
        ? row.screenshot_copy_protection_enabled
        : DEFAULT_CHAT_VIEW_PREFS.screenshot_copy_protection_enabled,
    chat_font_family: narrowFontFamily(row.chat_font_family),
    chat_font_size: narrowFontSize(row.chat_font_size),
    chat_bg_from_shop_cover:
      typeof row.chat_bg_from_shop_cover === "boolean"
        ? row.chat_bg_from_shop_cover
        : DEFAULT_CHAT_VIEW_PREFS.chat_bg_from_shop_cover,
    shop_cover_from_chat_theme:
      typeof row.shop_cover_from_chat_theme === "boolean"
        ? row.shop_cover_from_chat_theme
        : DEFAULT_CHAT_VIEW_PREFS.shop_cover_from_chat_theme,
  };
}

// ─── Public API ───────────────────────────────────────────────────────

/** Read all five preferences. Sealed defaults applied when the columns
 *  are absent (migration 285 unapplied). Throws on other DB errors so
 *  the Settings UI can surface them. */
export async function getChatViewPreferences(
  accountId: NexUuid,
): Promise<ChatViewPreferences> {
  const columnsReady = await hasChatViewPrefsColumns();
  if (!columnsReady) return DEFAULT_CHAT_VIEW_PREFS;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select(
      "screenshot_copy_protection_enabled, chat_font_family, chat_font_size, chat_bg_from_shop_cover, shop_cover_from_chat_theme",
    )
    .eq("id", accountId)
    .maybeSingle();
  if (error) {
    if (/does not exist/i.test(error.message)) return DEFAULT_CHAT_VIEW_PREFS;
    throw new Error(`chat-view-preferences-service.get: ${error.message}`);
  }
  if (!data) return DEFAULT_CHAT_VIEW_PREFS;
  return rowToPrefs(data as Record<string, unknown>);
}

/** Safe variant · NEVER throws. Returns sealed defaults on any error. */
export async function getChatViewPreferencesSafe(
  accountId: NexUuid,
): Promise<ChatViewPreferences> {
  try {
    return await getChatViewPreferences(accountId);
  } catch {
    return DEFAULT_CHAT_VIEW_PREFS;
  }
}

/** Partial update. Narrows each field at the boundary so unknown
 *  values can never be persisted. Throws on DB error so the UI can
 *  tell the user "couldn't save". */
export async function updateChatViewPreferences(
  accountId: NexUuid,
  patch: Partial<ChatViewPreferences>,
): Promise<ChatViewPreferences> {
  const current = await getChatViewPreferences(accountId);
  const next: ChatViewPreferences = {
    screenshot_copy_protection_enabled:
      typeof patch.screenshot_copy_protection_enabled === "boolean"
        ? patch.screenshot_copy_protection_enabled
        : current.screenshot_copy_protection_enabled,
    chat_font_family:
      patch.chat_font_family !== undefined
        ? narrowFontFamily(patch.chat_font_family)
        : current.chat_font_family,
    chat_font_size:
      patch.chat_font_size !== undefined
        ? narrowFontSize(patch.chat_font_size)
        : current.chat_font_size,
    chat_bg_from_shop_cover:
      typeof patch.chat_bg_from_shop_cover === "boolean"
        ? patch.chat_bg_from_shop_cover
        : current.chat_bg_from_shop_cover,
    shop_cover_from_chat_theme:
      typeof patch.shop_cover_from_chat_theme === "boolean"
        ? patch.shop_cover_from_chat_theme
        : current.shop_cover_from_chat_theme,
  };
  const columnsReady = await hasChatViewPrefsColumns();
  if (!columnsReady) {
    throw new Error(
      "chat-view-preferences-service.update: migration 285 not yet applied",
    );
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({
      screenshot_copy_protection_enabled:
        next.screenshot_copy_protection_enabled,
      chat_font_family: next.chat_font_family,
      chat_font_size: next.chat_font_size,
      chat_bg_from_shop_cover: next.chat_bg_from_shop_cover,
      shop_cover_from_chat_theme: next.shop_cover_from_chat_theme,
    })
    .eq("id", accountId);
  if (error) {
    throw new Error(`chat-view-preferences-service.update: ${error.message}`);
  }
  return next;
}

/** Reset Section 5 (screenshot/copy) to OFF. */
export async function resetChatProtection(accountId: NexUuid): Promise<void> {
  await updateChatViewPreferences(accountId, {
    screenshot_copy_protection_enabled: false,
  });
}

/** Reset Section 6 (chat font) to default + medium. */
export async function resetChatFont(accountId: NexUuid): Promise<void> {
  await updateChatViewPreferences(accountId, {
    chat_font_family: "default",
    chat_font_size: "medium",
  });
}

/** Reset Section 7 (background sync) · both toggles OFF. */
export async function resetChatBackgroundSync(accountId: NexUuid): Promise<void> {
  await updateChatViewPreferences(accountId, {
    chat_bg_from_shop_cover: false,
    shop_cover_from_chat_theme: false,
  });
}
