// src/lib/nex-native/creator/creator-badges.ts
//
// Phase 1c Batch 3 · Music surface deleted · Q8 KEEP STUBBED
// (phase-1a-deletion-list-2026-11-06 §7 Q8).
//
// Owner-authorised 2026-10-31 origin of this module (Creator Programme
// Stage 1) is preserved · the public API (`resolveCreatorBadges` +
// re-exported client-safe types from `creator-badges-common`) is
// unchanged so CreatorBadgeStrip, CreatorWelcomePanel, and the creator
// dashboard continue to type-check and render.
//
// Body now returns an empty EarnedBadges on every call. The music
// section counter (which was the only live section counter in this
// release) is removed because `src/lib/nex-native/music/*` is
// deleted. Shop + Video counters had `createHref` entries in the
// dashboard but no earned-badge gate had shipped — they're folded
// into the stub so the full tree deletes cleanly. When a future
// section earns a counter, reinstate the resolver body.

import "server-only";

export {
  CREATOR_QUALIFYING_THRESHOLD,
  sectionBadgeLabel,
} from "./creator-badges-common";
export type {
  CreatorSection,
  SectionProgress,
  EarnedBadges,
} from "./creator-badges-common";

import type { EarnedBadges } from "./creator-badges-common";

/** Phase 1c Batch 3 stub · always returns an empty badges set. The
 *  signature matches the pre-stub resolver so every caller keeps
 *  compiling. `_accountId` is retained (and prefixed `_` so the
 *  linter accepts it) to preserve the public shape for when a real
 *  resolver reinstates. */
export async function resolveCreatorBadges(
  _accountId: string,
): Promise<EarnedBadges> {
  return { all: [], earned: [] };
}

export const EMPTY_EARNED_BADGES: EarnedBadges = { all: [], earned: [] };
