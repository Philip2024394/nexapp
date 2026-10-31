// src/lib/nex-native/creator/creator-badges-common.ts
//
// Client-safe types + the pure sectionBadgeLabel helper from the
// Creator Programme. Split out of creator-badges.ts so client
// components can import `SectionProgress` + `sectionBadgeLabel`
// without pulling the server-only Supabase admin chain into their
// bundle.
//
// NO `server-only` import in this file · NO Supabase client · NO
// runtime side-effects. Pure data + a switch statement.

/** Owner-authorised 2026-10-31 · the universal qualification floor.
 *  Changing this is a sealed-doctrine decision · do not vary per-
 *  section without owner authorisation. */
export const CREATOR_QUALIFYING_THRESHOLD = 5;

/** Section IDs are stable strings. They become URL slugs, badge
 *  labels, and database values if we ever persist earned-badges
 *  materialised state. Keep lowercase + underscored. */
export type CreatorSection =
  | "music"
  | "shop"
  | "video"
  | "images"
  | "food"
  | "fashion"
  | "property";

export interface SectionProgress {
  readonly section: CreatorSection;
  readonly count: number;
  readonly threshold: number;
  readonly earned: boolean;
}

export interface EarnedBadges {
  readonly all: readonly SectionProgress[];
  readonly earned: readonly SectionProgress[];
}

/** Human-readable label on the yellow chip. Capitalised + spaced so
 *  "MUSIC CREATOR" reads naturally. Preserves the sealed uppercase
 *  styling in `NexYellowChip`. */
export function sectionBadgeLabel(section: CreatorSection): string {
  switch (section) {
    case "music":    return "Music Creator";
    case "shop":     return "Shop Creator";
    case "video":    return "Video Creator";
    case "images":   return "Image Creator";
    case "food":     return "Food Creator";
    case "fashion":  return "Fashion Creator";
    case "property": return "Property Creator";
  }
}
