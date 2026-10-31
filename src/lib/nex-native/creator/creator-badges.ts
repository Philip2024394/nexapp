// src/lib/nex-native/creator/creator-badges.ts
//
// Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 1.
//
// Per-section qualification resolver. 5+ qualifying posts in a section
// earns that section's Creator badge. Each section's "qualifying post"
// definition is the section's own rule (not a one-size-fits-all).
//
// Current scope: music only. Shape generalised so future sections
// (shop, video, images, food, fashion, property) can plug in by
// adding a counter without touching the resolver signature.
//
// Qualification rule for Music (owner-authorised 2026-10-31):
//   · visibility != 'removed' · a user's non-removed library tracks
//   · threshold ≥ 5
//
// This matches the owner's "library content I own" mental model. It
// does NOT require the sealed M-2 Live Feed publish path (private
// tracks still count because the owner has "put them on the site").
// If/when a stricter rule is wanted (e.g. shared_live only), the
// counter below is the single place to change it.
//
// Shape is defensive · failures return `{} as EarnedBadges` so one
// broken section never breaks the rest of the profile render.

import "server-only";
import { getOwnerTrackCount } from "../music/music-repository";

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

/** Count qualifying posts in each supported section. Music is live;
 *  the others return 0 until each one gets its owner-count helper. */
async function countBySection(
  accountId: string,
): Promise<Record<CreatorSection, number>> {
  const [musicCount] = await Promise.all([
    getOwnerTrackCount(accountId).catch(() => 0),
  ]);
  return {
    music: musicCount,
    shop: 0,
    video: 0,
    images: 0,
    food: 0,
    fashion: 0,
    property: 0,
  };
}

/** Resolve earned Creator badges for an account. Pure server-side ·
 *  no caching · callers memoise upstream if needed (e.g. profile
 *  Promise.all). */
export async function resolveCreatorBadges(
  accountId: string,
): Promise<EarnedBadges> {
  const counts = await countBySection(accountId);
  const sections: readonly CreatorSection[] = [
    "music",
    "shop",
    "video",
    "images",
    "food",
    "fashion",
    "property",
  ];
  const all = sections.map<SectionProgress>((section) => {
    const count = counts[section];
    return {
      section,
      count,
      threshold: CREATOR_QUALIFYING_THRESHOLD,
      earned: count >= CREATOR_QUALIFYING_THRESHOLD,
    };
  });
  return {
    all,
    earned: all.filter((p) => p.earned),
  };
}

export const EMPTY_EARNED_BADGES: EarnedBadges = { all: [], earned: [] };
