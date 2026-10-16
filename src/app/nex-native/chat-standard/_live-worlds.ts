// src/app/nex-native/chat-standard/_live-worlds.ts
//
// Production registry of Standard-Experience-backed worlds.
//
// This is the single source of truth for "which theme ids map to a
// code-side Theme Engine package" and is consumed by:
//
//   - /nex-native/themes/[id]/page.tsx           (live-chat route)
//   - /nex-native/dev/standard-experience-preview/_registry.ts
//     (which extends this with developer-only test fixtures)
//
// RULE (sealed 2026-10-05):
//   Any world listed here is reachable at `/nex-native/themes/<id>` as
//   a full live-chat surface — Standard Experience chrome, header
//   icons, bubbles, composer, shop sheet, call actions, + menu — with
//   the theme applied. Adding a new Standard-Experience world is a
//   one-line edit here.

import type { ThemePackage } from "./_engine/types";
import { WATERWORLD_PACKAGE } from "./packages/waterworld.package";
import { COFFEE_PACKAGE } from "./packages/coffee.package";
import { BOTANICAL_CAFE_PACKAGE } from "./packages/botanical-cafe.package";
import { MIDNIGHT_CAFE_PACKAGE } from "./packages/midnight-cafe.package";
import { FRENCH_CAFE_PACKAGE } from "./packages/french-cafe.package";
import { FOOD_PACKAGE } from "./packages/food.package";
import { PIZZA_PACKAGE } from "./packages/pizza.package";
import { BIKE_RENTAL_PACKAGE } from "./packages/bike-rental.package";
import { AC_SERVICE_PACKAGE } from "./packages/ac-service.package";
import { NEX_BUBBLES_PACKAGE } from "./packages/nex-bubbles.package";
import { NEX_FLAT_PACKAGE } from "./packages/nex-flat.package";
import { PROPERTY1_PACKAGE } from "./packages/property1.package";
import { CRISPY_CHICKEN_PACKAGE } from "./packages/crispy-chicken.package";
import { TEDDY_PLAY_PACKAGE } from "./packages/teddy-play.package";
import { LULU_PACKAGE } from "./packages/lulu.package";
import { PINK_DREAM_PACKAGE } from "./packages/pink-dream.package";
import { HOLLYWOOD_PACKAGE } from "./packages/hollywood.package";
import { VITAMIN_FRUIT_PACKAGE } from "./packages/vitamin-fruit.package";
import { WATCHES_ROLEX_PACKAGE } from "./packages/watches-rolex.package";
// Pink Dream registration note (2026-10-11):
//   · Registered here so the Theme Library shows it under Teddy
//     with the authentic pink/plum palette.
//   · The actual live chat remains the SEALED bespoke page at
//     `/nex-native/themes/pink-dream/page.tsx` · Next.js static-page
//     routing wins over the dynamic `[id]` route, so visitors who
//     tap the Pink Dream tile land on the original "bubbles
//     connected to the sides of the screen" design.
//   · The Library mini-phone tile paints a Standard Experience
//     APPROXIMATION of the palette (pink bubbles + plum stage).
//     This is a known, acknowledged scale-down · the mini-phone
//     cannot reproduce the full-viewport-edge bubble layout at
//     tile scale. Clicking through takes the viewer to the real
//     bespoke design.

export const LIVE_WORLD_PACKAGES = {
  "nex-bubbles": NEX_BUBBLES_PACKAGE,
  "nex-flat": NEX_FLAT_PACKAGE,
  waterworld: WATERWORLD_PACKAGE,
  coffee: COFFEE_PACKAGE,
  "botanical-cafe": BOTANICAL_CAFE_PACKAGE,
  "midnight-cafe": MIDNIGHT_CAFE_PACKAGE,
  "french-cafe": FRENCH_CAFE_PACKAGE,
  food: FOOD_PACKAGE,
  pizza: PIZZA_PACKAGE,
  "crispy-chicken": CRISPY_CHICKEN_PACKAGE,
  "bike-rental": BIKE_RENTAL_PACKAGE,
  "ac-service": AC_SERVICE_PACKAGE,
  property1: PROPERTY1_PACKAGE,
  "teddy-play": TEDDY_PLAY_PACKAGE,
  lulu: LULU_PACKAGE,
  "pink-dream": PINK_DREAM_PACKAGE,
  hollywood: HOLLYWOOD_PACKAGE,
  "vitamin-fruit": VITAMIN_FRUIT_PACKAGE,
  "watches-rolex": WATCHES_ROLEX_PACKAGE,
} as const satisfies Record<string, ThemePackage>;

export type LiveWorldId = keyof typeof LIVE_WORLD_PACKAGES;

export const LIVE_WORLD_IDS = Object.keys(LIVE_WORLD_PACKAGES) as LiveWorldId[];

export function isLiveWorldId(id: string | undefined): id is LiveWorldId {
  return !!id && id in LIVE_WORLD_PACKAGES;
}

export function getLiveWorldPackage(id: LiveWorldId): ThemePackage {
  return LIVE_WORLD_PACKAGES[id];
}

/** Human-readable name for a Standard-Experience world. */
export function getLiveWorldDisplayName(id: LiveWorldId): string {
  return LIVE_WORLD_PACKAGES[id].identity.name;
}
