// src/lib/nex-native/vertical-presets/types.ts
//
// NEX Vertical Presets · type contract.
// Owner-authorised 2026-10-20 · Phase A1 Accommodation.
// -----------------------------------------------------------------------------
// Business-type is the keystone of a user's identity on NEX. When
// the user picks a vertical on /welcome, the resulting preset says:
//   · which chat themes to surface first (writes to nex_account.chat_theme)
//   · which shop face cover layout to use (writes to nex_business.cover_layout_id)
//   · which setup fields the wizard asks (branches in /business-setup)
//   · which non-interactive design examples the owner sees on their /{slug}
//     face cover until they create real products
//
// Phase A1 scope: Accommodation vertical only · Villa + Homestay +
// Kost. Phase B/C will add Services + refine Food + add Products
// attribute presets. The preset catalogue is intentionally a JSON-
// shaped TypeScript file · no DB table · no migration · no schema
// change.
//
// Doctrine guard-rails:
//   · Phase A1 demo content is OWNER-ONLY visual guidance · it does
//     NOT persist, does NOT become real inventory, does NOT imply
//     availability or booking.
//   · The cookie-based intent flow uses an ADDITIVE second cookie
//     (nex_welcome_vertical) · the sealed nex_welcome_intent cookie
//     is untouched.

import type { CoverLayoutId } from "@/app/nex-native/cover/layout-ids";

/** The categories a NEX business can declare. Phase A1 only wires
 *  "accommodation". The others are enumerated here so the vertical-
 *  picker UI can show them with "coming soon" treatment until their
 *  presets ship. */
export const VERTICAL_CATEGORIES = [
  "accommodation",
  "services",
  "food",
  "products",
  "affiliate",
  "personal",
] as const;

export type VerticalCategory = (typeof VERTICAL_CATEGORIES)[number];

/** All sub-type ids the preset catalogue knows about. Extending this
 *  union is the only way to add a preset · the lookup is strict and
 *  will return null for anything else. */
export const VERTICAL_SUBTYPES = [
  // Accommodation · Phase A1
  "villa",
  "homestay",
  "kost",
] as const;

export type VerticalSubtype = (typeof VERTICAL_SUBTYPES)[number];

/** Guard narrows arbitrary strings to the sealed VerticalCategory
 *  union · used by the cookie-parse code path. */
export function isVerticalCategory(
  v: string | null | undefined,
): v is VerticalCategory {
  return (
    typeof v === "string" &&
    (VERTICAL_CATEGORIES as readonly string[]).includes(v)
  );
}

/** Guard narrows arbitrary strings to the sealed VerticalSubtype
 *  union · used by the cookie-parse code path. */
export function isVerticalSubtype(
  v: string | null | undefined,
): v is VerticalSubtype {
  return (
    typeof v === "string" &&
    (VERTICAL_SUBTYPES as readonly string[]).includes(v)
  );
}

/** The vertical-intent payload the cookie carries · {category, subtype}
 *  JSON-encoded. The runtime validator in _welcome-intent.ts enforces
 *  this exact shape and returns null on any mismatch. */
export interface VerticalIntent {
  readonly category: VerticalCategory;
  readonly subtype: VerticalSubtype;
}

/** A single demo room design shown to the owner only when their
 *  /{slug} face cover has zero live products. These are PURE visual
 *  guidance · they do NOT persist as nex_product rows · they imply
 *  no booking, no availability, no verified claim.
 *
 *  Prices are illustrative-only numbers in IDR · displayed as
 *  "Example" alongside explicit honest-copy footer. */
export interface DemoRoomDesign {
  readonly nameId: string;    // Bahasa Indonesia label
  readonly nameEn: string;    // English label
  readonly priceIdr: number;  // illustrative price per night
}

/** A single preset entry in the catalogue. One per (category, subtype)
 *  pair · the preset owns the mapping from the user's declared
 *  business type to the chat / cover / wizard experience. */
export interface VerticalPreset {
  readonly category: VerticalCategory;
  readonly subtype: VerticalSubtype;
  readonly labelId: string;    // Bahasa Indonesia display label
  readonly labelEn: string;    // English display label
  /** Chat theme ids (must exist in LIVE_WORLD_PACKAGES) to surface
   *  first on /create-account/pick-theme · ordered. The user may
   *  still pick any theme · suggestion is a sort, not a lock. */
  readonly suggestedChatThemes: readonly string[];
  /** Shop face cover layout id (must exist in COVER_LAYOUT_IDS) ·
   *  pre-selected on /create-account/pick-cover · also drives the
   *  nex_business.cover_layout_id write in createBusinessAction when
   *  this preset is active. */
  readonly suggestedCoverLayout: CoverLayoutId;
  /** Static demo room designs rendered on the owner's own /{slug}
   *  face cover ONLY when products.length === 0 · never shown to
   *  guests or non-owner viewers (server-side gate). */
  readonly demoRooms: readonly DemoRoomDesign[];
  /** Amenity labels used by the wizard multi-select · also surface
   *  as read-only chips in the demo-room-designs panel. */
  readonly amenities: readonly string[];
}
