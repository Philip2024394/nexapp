// src/app/nex-native/dev/emoji-inventory/_loader.ts
//
// Dev-only Supabase emoji + sticker inventory loader.
// --------------------------------------------------
// Reads every row from `nex_theme_emoji` + `nex_theme_sticker`, groups
// by `theme_id`, and tags each group as either:
//
//   · `registered`  · the theme_id maps to a live-world package or
//                      an active DB-registered theme
//   · `legacy`      · theme_id has rows in Supabase but is NOT
//                      currently registered in NEX
//   · `empty`       · no rows (not surfaced in UI; here for the
//                      inverse-view "which registered themes have no
//                      emoji yet")
//
// Pure server-only · the page component renders the result.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { LIVE_WORLD_IDS } from "@/app/nex-native/chat-standard/_live-worlds";

export interface EmojiRow {
  id: string;
  theme_id: string;
  slug: string;
  label: string | null;
  image_url: string;
  sort_order: number | null;
}

export interface StickerRow {
  id: string;
  theme_id: string;
  slug: string;
  label: string | null;
  image_url: string;
  sticker_type: string | null;
  aspect_ratio: string | null;
  sort_order: number | null;
}

export interface ThemeGroup {
  theme_id: string;
  registrationStatus: "live-world" | "db-registered" | "legacy";
  display_name: string | null;
  emoji: EmojiRow[];
  stickers: StickerRow[];
}

export interface EmptyRegisteredTheme {
  theme_id: string;
  display_name: string;
  source: "live-world" | "db-registered";
}

export interface InventoryResult {
  groups: ThemeGroup[];
  emptyRegistered: EmptyRegisteredTheme[];
  totalEmoji: number;
  totalStickers: number;
}

export async function loadEmojiInventory(): Promise<InventoryResult> {
  const [emojiRes, stickerRes, dbThemes] = await Promise.all([
    nexSupabaseAdmin
      .from("nex_theme_emoji")
      .select("id, theme_id, slug, label, image_url, sort_order")
      .order("theme_id", { ascending: true })
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("slug", { ascending: true }),
    nexSupabaseAdmin
      .from("nex_theme_sticker")
      .select(
        "id, theme_id, slug, label, image_url, sticker_type, aspect_ratio, sort_order",
      )
      .order("theme_id", { ascending: true })
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("slug", { ascending: true }),
    chatThemeService.listActiveThemes().catch(() => []),
  ]);

  const emoji = (emojiRes.data as EmojiRow[]) ?? [];
  const stickers = (stickerRes.data as StickerRow[]) ?? [];

  const liveWorldSet = new Set(LIVE_WORLD_IDS as readonly string[]);
  const dbThemeMap = new Map<string, string>();
  for (const t of dbThemes) {
    dbThemeMap.set(t.id, t.name);
  }

  // Group by theme_id · merge emoji + stickers · attach registration
  // status + a display name.
  const groupMap = new Map<string, ThemeGroup>();
  const touch = (themeId: string): ThemeGroup => {
    let g = groupMap.get(themeId);
    if (!g) {
      const liveName = liveWorldSet.has(themeId) ? themeId : null;
      const dbName = dbThemeMap.get(themeId) ?? null;
      g = {
        theme_id: themeId,
        registrationStatus: liveWorldSet.has(themeId)
          ? "live-world"
          : dbThemeMap.has(themeId)
            ? "db-registered"
            : "legacy",
        display_name: liveName ?? dbName,
        emoji: [],
        stickers: [],
      };
      groupMap.set(themeId, g);
    }
    return g;
  };

  for (const row of emoji) touch(row.theme_id).emoji.push(row);
  for (const row of stickers) touch(row.theme_id).stickers.push(row);

  // Deterministic order: registered first (live-world, then db-registered,
  // alphabetical within each), legacy last.
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    const rank = (s: ThemeGroup["registrationStatus"]) =>
      s === "live-world" ? 0 : s === "db-registered" ? 1 : 2;
    const r = rank(a.registrationStatus) - rank(b.registrationStatus);
    if (r !== 0) return r;
    return a.theme_id.localeCompare(b.theme_id);
  });

  // Inverse view: registered themes with ZERO emoji + stickers · so
  // the founder can see which worlds still need an emoji set.
  const covered = new Set(groupMap.keys());
  const emptyRegistered: EmptyRegisteredTheme[] = [];
  for (const id of LIVE_WORLD_IDS) {
    if (!covered.has(id)) {
      emptyRegistered.push({ theme_id: id, display_name: id, source: "live-world" });
    }
  }
  for (const t of dbThemes) {
    if (!covered.has(t.id) && !liveWorldSet.has(t.id)) {
      emptyRegistered.push({
        theme_id: t.id,
        display_name: t.name,
        source: "db-registered",
      });
    }
  }
  emptyRegistered.sort((a, b) => a.theme_id.localeCompare(b.theme_id));

  return {
    groups,
    emptyRegistered,
    totalEmoji: emoji.length,
    totalStickers: stickers.length,
  };
}
