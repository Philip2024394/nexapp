// src/lib/nex-native/vertical-presets/index.ts
//
// NEX Vertical Presets · public lookup.
// Owner-authorised 2026-10-20 · Phase A1.
// -----------------------------------------------------------------------------
// Thin facade over the per-category preset modules. Every lookup is
// strict · unknown (category, subtype) pairs return null. No throwing.
//
// Scope reminder · Phase A1 ships ACCOMMODATION only. Services,
// Food refinement, Products attribute presets ship in later phases
// with new per-category modules imported here.

import { ACCOMMODATION_PRESETS } from "./accommodation";
import type { VerticalPreset, VerticalCategory, VerticalSubtype } from "./types";

export type {
  VerticalPreset,
  VerticalCategory,
  VerticalSubtype,
  VerticalIntent,
  DemoRoomDesign,
} from "./types";
export {
  VERTICAL_CATEGORIES,
  VERTICAL_SUBTYPES,
  isVerticalCategory,
  isVerticalSubtype,
} from "./types";

/** All presets Phase A1 ships · readonly to prevent accidental
 *  mutation at import time. */
export const ALL_PRESETS: readonly VerticalPreset[] = [...ACCOMMODATION_PRESETS];

/** Strict lookup · returns null for any (category, subtype) pair the
 *  catalogue doesn't carry · never throws. Call sites must handle
 *  null as "no preset · fall through to sealed defaults". */
export function getPreset(
  category: string | null | undefined,
  subtype: string | null | undefined,
): VerticalPreset | null {
  if (!category || !subtype) return null;
  const found = ALL_PRESETS.find(
    (p) => p.category === category && p.subtype === subtype,
  );
  return found ?? null;
}

/** Returns the presets registered for a given category · empty array
 *  for unknown or still-pending categories. Powers the sub-type
 *  reveal on the vertical-picker. */
export function listPresetsForCategory(
  category: VerticalCategory,
): readonly VerticalPreset[] {
  return ALL_PRESETS.filter((p) => p.category === category);
}

/** Convenience · true when the catalogue has at least one preset for
 *  the given category. Used by the vertical-picker to mark categories
 *  as "coming soon" when their presets haven't shipped yet. */
export function categoryHasPresets(category: VerticalCategory): boolean {
  return ALL_PRESETS.some((p) => p.category === category);
}
