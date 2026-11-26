// src/app/nex-native/chat-themes-library/_category-classifier.ts
//
// NEX Chat Themes · three-category hub classifier.
// Owner-sealed 2026-11-26 (L-011) · design-direction locked:
//   · Plain Backgrounds       · solid colour / low-detail surfaces
//   · Small Designs           · repeating patterns · tiled motifs
//   · Full Image Backgrounds  · full-bleed photography / illustration
//
// This is a pure function layer. It derives the three-category kind
// from whatever tagging already exists on `BackgroundAsset.categories`
// in `nex_background_asset`. No migration is required to adopt it:
// if the sandbox catalog has no `plain` or `solid` rows yet, the Plain
// library correctly surfaces zero items (honest empty state rather
// than fabricated content).
//
// Promotion contract:
//   · `plain`  ← categories include "plain" OR "solid"
//   · `small`  ← categories include "pattern"
//   · `full-image` ← everything else (scenery, scene, pets, luxury,
//     and anything untagged)
//
// Keeping this layer in TypeScript rather than a view/function in the
// database means:
//   · no sandbox migration gate crossed to ship the hub screen,
//   · the sealed production database (`ijvqdvsvwtwxzcqmoqit`) is not
//     touched,
//   · a future owner-authorised migration can tighten the taxonomy
//     (add a `nex_background_asset.chat_category` column, backfill,
//     and constrain the tag set) without having to rebuild the UI.

import type { BackgroundAsset } from "@/lib/nex-native/library/catalog-service";

export type ChatCategoryKind = "plain" | "small" | "full-image";

export const CHAT_CATEGORY_KINDS: readonly ChatCategoryKind[] = [
  "plain",
  "small",
  "full-image",
] as const;

/** Human-readable label shown on the hub card and the library header. */
export const CHAT_CATEGORY_LABEL: Readonly<Record<ChatCategoryKind, string>> = {
  "plain": "Plain Backgrounds",
  "small": "Small Designs",
  "full-image": "Full Image Backgrounds",
};

/** One-line description on the hub card · plain-language, no marketing. */
export const CHAT_CATEGORY_HINT: Readonly<Record<ChatCategoryKind, string>> = {
  "plain": "Solid colours and quiet surfaces for a calm chat backdrop.",
  "small": "Repeating patterns and small motifs that tile across the screen.",
  "full-image": "Full-bleed photography and illustration — the classic library.",
};

/** Pure classifier. Given the `categories` tag array from a
 *  `nex_background_asset` row (or any array of lowercase strings),
 *  decide which of the three user-facing buckets the asset belongs in.
 *  Order of checks matters: a row tagged both "pattern" and some other
 *  scene category is still a Small Design to the user. */
export function classifyChatCategories(
  categories: readonly string[],
): ChatCategoryKind {
  const set = new Set(categories.map((c) => c.toLowerCase()));
  if (set.has("plain") || set.has("solid")) return "plain";
  if (set.has("pattern")) return "small";
  return "full-image";
}

/** Convenience wrapper on top of a full `BackgroundAsset`. */
export function classifyBackgroundAsset(asset: BackgroundAsset): ChatCategoryKind {
  return classifyChatCategories(asset.categories);
}

/** Filter a list of assets down to a single category. Stable: preserves
 *  the input order so the caller's `sort_order`/shuffle still applies. */
export function filterByChatCategory(
  assets: readonly BackgroundAsset[],
  kind: ChatCategoryKind,
): readonly BackgroundAsset[] {
  return assets.filter((a) => classifyBackgroundAsset(a) === kind);
}

/** Type guard used by route-level searchParams readers. */
export function isChatCategoryKind(value: unknown): value is ChatCategoryKind {
  return (
    value === "plain" || value === "small" || value === "full-image"
  );
}
