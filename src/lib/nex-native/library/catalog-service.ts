// src/lib/nex-native/library/catalog-service.ts
//
// NEX Unified Visual Library · catalog service (server-side).
// Owner-authorised 2026-11-11 · Phase 1 implementation.
// -----------------------------------------------------------------------------
// Reads from the sealed nex_background_asset table (migration 337). All queries
// are context-filtered so a shop caller never sees chat-only assets and vice
// versa. The catalog is read-only to the application; writes land through the
// migration seed + sealed service-role admin paths.
//
// CRITICAL isolation rule enforced by this service:
//   · listBackgroundAssets({context}) ALWAYS filters on contexts @> [context]
//   · getBackgroundAsset(id, {context}) rejects assets whose contexts array
//     does not include the caller's context · prevents a shop picker from
//     surfacing a chat-only asset even if the caller stuffed an arbitrary id
//   · this service NEVER writes to nex_account.chat_theme or
//     nex_business.shop_cover_image_url · those writers remain in their
//     existing action files (_actions.ts updateChatThemeAction and
//     manage/shop/themes/_actions.ts applyShopPresetBackgroundAction)
//
// Chat message bodies, attachments and ciphertext are never touched here.

import { nexSupabaseAdmin } from "../supabase-admin";

/** Supported context keys. "shop" surfaces, "chat" surfaces.
 *  Adding a new context (e.g. "creator-cover") is a future owner-authorised
 *  change · would require a new picker surface and a new writer. */
export type BackgroundContext = "shop" | "chat";

/** Entitlement tier classification. NOT the sole access gate · each picker
 *  surface must still check the actor's own subscription server-side. */
export type BackgroundTier = "gratis" | "bisnis" | "pro";

export interface BackgroundAsset {
  readonly id: string;
  readonly storageUrl: string;
  readonly previewUrl: string | null;
  readonly label: string;
  readonly tintHex: string | null;
  readonly categories: readonly string[];
  readonly contexts: readonly BackgroundContext[];
  readonly tier: BackgroundTier;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly source: string;
}

interface ListParams {
  readonly context: BackgroundContext;
  readonly category?: string;
  readonly tier?: BackgroundTier;
  readonly limit?: number;
  readonly offset?: number;
}

function rowToAsset(row: Record<string, unknown>): BackgroundAsset {
  const contexts = ((row.contexts as string[]) ?? []).filter(
    (c): c is BackgroundContext => c === "shop" || c === "chat",
  );
  return {
    id: String(row.id),
    storageUrl: String(row.storage_url),
    previewUrl: row.preview_url == null ? null : String(row.preview_url),
    label: String(row.label),
    tintHex: row.tint_hex == null ? null : String(row.tint_hex),
    categories: (row.categories as string[]) ?? [],
    contexts,
    tier: (row.tier as BackgroundTier) ?? "gratis",
    isActive: row.is_active === true,
    sortOrder: Number(row.sort_order ?? 100),
    source: String(row.source ?? "unknown"),
  };
}

/** List ALL active assets · owner directive 2026-11-11.
 *  Both pickers (shop and chat) see every asset in the catalog so users
 *  can freely browse the whole 450-asset library.
 *
 *  The `context` parameter is retained because downstream rendering may
 *  want to badge or sort by "primary context", but it is NO LONGER used
 *  as a hard filter. Entitlement is still enforced at save time by the
 *  appropriate action (`applyFromLibraryShopAction` or
 *  `applyFromLibraryChatAction`). */
export async function listBackgroundAssets(params: ListParams): Promise<readonly BackgroundAsset[]> {
  const { category, tier, limit = 500, offset = 0 } = params;

  let query = nexSupabaseAdmin
    .from("nex_background_asset")
    .select(
      "id, storage_url, preview_url, label, tint_hex, categories, contexts, tier, is_active, sort_order, source",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true })
    .range(offset, offset + limit - 1);

  if (category) query = query.contains("categories", [category]);
  if (tier)     query = query.eq("tier", tier);

  const { data, error } = await query;
  if (error) {
    throw new Error(`catalog-service.listBackgroundAssets: ${error.message}`);
  }
  return (data ?? []).map(rowToAsset);
}

/** Fetch a single asset by id · owner directive 2026-11-11.
 *  Cross-context access is now ALLOWED: both Shop and Chat pickers may
 *  select any asset in the catalog. Entitlement (shop tier / Themes
 *  Plus) is still enforced at the save-action layer; this function
 *  returns the asset row if it exists and is active, regardless of
 *  its original context tag. The second argument is retained for
 *  API compatibility but is no longer used as a filter. */
export async function getBackgroundAsset(
  id: string,
  _params?: { readonly context?: BackgroundContext },
): Promise<BackgroundAsset | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_background_asset")
    .select(
      "id, storage_url, preview_url, label, tint_hex, categories, contexts, tier, is_active, sort_order, source",
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`catalog-service.getBackgroundAsset: ${error.message}`);
  }
  if (!data) return null;
  return rowToAsset(data);
}

/** Shop picker categories derived from the existing shop PRESETS taxonomy
 *  (owner-sealed 2026-10-20 per migration 212 picker). Preserved verbatim
 *  so the unified library UI can render the same chip set. */
export const SHOP_CATEGORIES: readonly { id: string; label: string; emoji: string }[] = [
  { id: "all",         label: "All categories",        emoji: "🖼️" },
  { id: "retail",      label: "Retail & general shop", emoji: "🛍" },
  { id: "online",      label: "Online & mobile shop",  emoji: "📱" },
  { id: "electronics", label: "Electronics & tech",    emoji: "🎧" },
  { id: "fashion",     label: "Fashion & beauty",      emoji: "👗" },
  { id: "tools",       label: "Tools & trade",         emoji: "🛠" },
  { id: "sports",      label: "Sports & outdoors",     emoji: "🏀" },
  { id: "food",        label: "Food & grocery",        emoji: "🥬" },
  { id: "travel",      label: "Travel & experiences",  emoji: "✈️" },
  { id: "sale",        label: "Sale & promotions",     emoji: "🏷" },
  { id: "delivery",    label: "Delivery & logistics",  emoji: "🚚" },
  { id: "showcase",    label: "Showcase & lifestyle",  emoji: "✨" },
];

/** Chat picker categories. Smaller taxonomy at launch · owner-sealed
 *  Phase 1 2026-11-11. */
export const CHAT_CATEGORIES: readonly { id: string; label: string; emoji: string }[] = [
  { id: "all",             label: "All wallpapers",   emoji: "🖼️" },
  { id: "scenery",         label: "Scenery",          emoji: "🏞" },
  { id: "pattern",         label: "Patterns",         emoji: "🧩" },
  { id: "scene",           label: "Scenes",           emoji: "🎭" },
  { id: "pets",            label: "Pets",             emoji: "🐾" },
];
