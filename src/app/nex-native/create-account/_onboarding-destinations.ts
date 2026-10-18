// src/app/nex-native/create-account/_onboarding-destinations.ts
//
// NEX · S3 · post-signup onboarding destination map.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Plain server-safe module (not "use server") so both server
// components (pick-theme page, pick-cover page) and server actions
// (pick-cover action) read the same source of truth for where to
// route users next.
//
// The three sealed destinations:
//
//   WELCOME_LANDING   /nex-native/welcome
//     Post-signup celebratory orientation landing · owner directive
//     2026-10-18 moved the terminal from /create-account/welcome
//     to the top-level /welcome. /welcome mounts the install-home-
//     screen slider for signed-in visitors and renders the three
//     intent cards. The old /create-account/welcome page now 308-
//     redirects here so pre-flip bookmarks still work.
//
//   PICK_COVER        /nex-native/create-account/pick-cover
//     S1 picker · reached ONLY when the user tapped the Shop intent
//     card on Welcome (`nex_welcome_intent === "shop"`).
//
//   BUILDING          /nex-native/create-account/building
//     S2 Building step · reached after a shop-intent user has
//     recorded their Face Cover pick.
//
// Doctrine:
//   · Non-shop intents (`"themes"`, `"personalised"`, `null`, or any
//     tampered value) are byte-identical to the pre-S3 behaviour ·
//     they continue to WELCOME_LANDING. Owner directive 2026-10-18.
//   · Shop intent is the ONLY path that detours through pick-cover
//     and building. No other intent should be able to reach either
//     surface through the normal flow.
//   · The functions below are PURE · zero side effects. They do not
//     clear the intent cookie or write any state. Callers are
//     responsible for cookie lifecycle.

import type { WelcomeIntent } from "../welcome/_welcome-intent";

/** Post-signup celebratory orientation page · default onboarding
 *  terminal for non-shop intents. Mounts the install-home-screen
 *  slider for signed-in visitors. Owner directive 2026-10-18 moved
 *  the terminal from /create-account/welcome to top-level /welcome. */
export const WELCOME_LANDING = "/nex-native/welcome";

/** S1 · Face Cover picker · only reachable via the shop-intent path. */
export const PICK_COVER = "/nex-native/create-account/pick-cover";

/** S2 · Building Your NEX · only reachable after the shop-intent
 *  user has recorded a Face Cover pick. */
export const BUILDING = "/nex-native/create-account/building";

/** Resolve the next destination after a successful theme pick.
 *  Shop intent routes through the Face Cover picker · everyone
 *  else continues to the sealed Add-to-Home-Screen landing. */
export function postThemePickDestination(
  intent: WelcomeIntent | null,
): string {
  if (intent === "shop") return PICK_COVER;
  return WELCOME_LANDING;
}

/** Resolve the next destination after a successful Face Cover pick.
 *  The picker is only reachable via shop intent, so this always
 *  routes to the Building step. */
export function postCoverPickDestination(): string {
  return BUILDING;
}
