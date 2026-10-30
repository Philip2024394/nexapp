// src/lib/nex-native/live-feed/feed-categories.ts
//
// Owner-authorised 2026-10-29 · extracted from the sealed client
// module `_live-feed-preferences.tsx` so BOTH server + client can
// import the catalogue safely. The original client module exported
// the same data behind a `"use client"` directive, which caused
// `FEED_CATEGORY_META is not iterable` on server render when the
// feed cookie parser iterated the array during RSC.
//
// Policy: this file holds ONLY the plain data + types that both
// sides need. React components, state helpers, DOM / localStorage
// code remain inside the client module. Changing a label here is a
// user-facing change · changing an ID is a BREAKING CHANGE (existing
// cookies + localStorage payloads reference IDs by exact string).

/** Owner directive 2026-10-25 · the 15-category feed-preferences
 *  catalogue. IDs are permanent · changing one breaks every
 *  persisted preference payload for every user. */
export type FeedCategoryId =
  | "ai"
  | "shopping"
  | "food"
  | "travel"
  | "music"
  | "dancing"
  | "work"
  | "subscriptions"
  | "gaming"
  | "education"
  | "sports"
  | "news"
  | "comedy"
  | "beauty"
  | "health";

export interface FeedCategoryMeta {
  readonly id: FeedCategoryId;
  readonly label: string;
  readonly description: string;
  /** Owner's two-tier design · "quick" renders above the fold,
   *  "expanded" renders only after the viewer taps "Show more". */
  readonly tier: "quick" | "expanded";
}

/** Owner-sealed catalogue · 15 categories · 4 quick + 11 expanded.
 *  Mirrors the ordering in the owner's 2026-10-25 brief. */
export const FEED_CATEGORY_META: ReadonlyArray<FeedCategoryMeta> = [
  // Quick tier · the 4 the owner explicitly called out as always-visible.
  { id: "ai",          label: "AI-generated",        description: "AI-created videos and broadcasts", tier: "quick" },
  { id: "shopping",    label: "Shopping & Business", description: "Products, shops and live selling", tier: "quick" },
  { id: "food",        label: "Food",                description: "Cooking, meals and food businesses", tier: "quick" },
  { id: "travel",      label: "Travel",              description: "Destinations and travel experiences", tier: "quick" },
  // Expanded tier.
  { id: "music",         label: "Music",                description: "Music and performances", tier: "expanded" },
  { id: "dancing",       label: "Dancing",              description: "Dance and choreography", tier: "expanded" },
  { id: "work",          label: "Work & Online Services", description: "Professional work and services", tier: "expanded" },
  { id: "subscriptions", label: "Subscriptions",        description: "Creators and subscription content", tier: "expanded" },
  { id: "gaming",        label: "Gaming",               description: "Games and live gameplay", tier: "expanded" },
  { id: "education",     label: "Education",            description: "Learning, tutorials and explainers", tier: "expanded" },
  { id: "sports",        label: "Sports",               description: "Fitness, workouts and events", tier: "expanded" },
  { id: "news",          label: "News & Current Affairs", description: "News, politics and current events", tier: "expanded" },
  { id: "comedy",        label: "Comedy",               description: "Jokes, sketches and stand-up", tier: "expanded" },
  { id: "beauty",        label: "Beauty & Lifestyle",   description: "Makeup, fashion and lifestyle", tier: "expanded" },
  { id: "health",        label: "Health & Fitness",     description: "Wellness and health advice", tier: "expanded" },
];

export type FeedCategoryToggleMap = Record<FeedCategoryId, boolean>;

/** Owner directive 2026-10-25 · tri-state control for creator-added
 *  text overlays on top of the video pixels. This is DIFFERENT from
 *  NEX's own chrome (product cards, header labels, AI chip) · the
 *  control affects ONLY the creator's in-video promotional text. */
export type OverlayPreference = "all" | "reduce" | "hide";

/** Persisted state shape (v2 · adds `overlayPref` next to `toggles`).
 *  Old v1 payloads were a flat toggle map · the reader handles that
 *  shape transparently so nothing resets on upgrade. */
export interface LiveFeedPreferencesState {
  readonly toggles: FeedCategoryToggleMap;
  readonly overlayPref: OverlayPreference;
}
