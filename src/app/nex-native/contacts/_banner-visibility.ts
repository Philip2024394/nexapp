// src/app/nex-native/contacts/_banner-visibility.ts
//
// NEX · S4 · pure visibility helper + cookie constants for the
// NEX1 welcome banner.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Plain module (no "use server") · exists so vitest can import the
// pure helper without pulling in the sealed peer-service chain
// (which runs supabase-admin env checks at module load).
//
// Keep this module import-light · ONLY type imports from sealed
// shape modules. No service imports. No cookie IO.

import { shouldShowFirstContact } from "../home/_first-contact-predicate";
import type { FirstContactSignals } from "../home/_first-contact-predicate";

/** Cookie name · dismissal is a UX override on top of the sealed
 *  first-contact predicate. httpOnly so browser JS cannot set it
 *  (prevents accidental client state desync). */
export const NEX1_BANNER_DISMISSED_COOKIE = "nex_welcome_banner_dismissed";

/** Max-age for the dismissal cookie · 90 days (owner-approved
 *  compromise between "feels permanent" and "re-appears if the
 *  user never actually replied to NEX1 for a long time"). */
export const NEX1_BANNER_DISMISS_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

/** Pure visibility helper · testable in isolation.
 *  Returns true only when BOTH gates pass:
 *    1 · sealed first-contact predicate (user is genuinely new AND
 *        hasn't replied to NEX1 yet)
 *    2 · dismissal cookie absent
 *  Dismissal is a hard override · if the user dismissed, we hide
 *  regardless of signals (owner directive 2026-10-18). */
export function shouldShowNex1WelcomeBanner(
  signals: FirstContactSignals,
  dismissed: boolean,
): boolean {
  if (dismissed) return false;
  return shouldShowFirstContact(signals);
}
