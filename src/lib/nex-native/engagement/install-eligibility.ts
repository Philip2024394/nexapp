// src/lib/nex-native/engagement/install-eligibility.ts
//
// NEX install-promotion engagement gate · owner-sealed 2026-11-24
// (Option A · decisions B1-B4). See sealed memory
// `project_nexapp_pwa_install_and_location_timing_sealed_2026_11_24.md`.
//
// Purpose
// -------
// PWA install promotion must NEVER appear on first load, splash, theme
// picker or straight after registration. The owner's rule: the user has
// to have experienced enough of NEX to understand the benefit. The
// qualifying signal is "reached Contacts AND completed at least one
// meaningful interaction" — whichever qualifying event happens first
// wins:
//
//   · first contact successfully added   (saveAsFriendAction OR
//                                         sendFriendInviteAction)
//   · first message successfully sent    (sendPeerMessageAction)
//
// Once marked eligible, the install promotion may be rendered. Before
// that it must not. The flag is durable so returning signed-in users
// who have already qualified see the promotion on later visits
// (subject to the dismiss cooldown handled by the install UI itself).
//
// Semantics
// ---------
//   · Cookie is idempotent set-once. Reading before writing is a cheap
//     short-circuit so the hot paths don't incur a repeat cookie write
//     on every message sent.
//   · Opaque single value "1". No PII. Device-scoped.
//   · One-year TTL matches the known-device cookie posture — users who
//     have already seen the app know how it works; a longer memory is
//     fine but there's no reason to make it eternal.
//   · Set from Server Actions only (where `cookies().set` is legal).
//   · HttpOnly + SameSite=Lax + Secure-in-production to match the
//     known-device + directory-seed cookies already in the tree.
//
// This module is pure helpers — the install UI (gated mount points)
// reads it via `isInstallEligible()`, and three server actions call
// `markInstallEligible()` on their success paths.

import { cookies as nextCookies } from "next/headers";

export const NEX_INSTALL_ELIGIBLE_COOKIE = "nex_install_eligible";

/** One year. Matches the known-device cookie. */
export const NEX_INSTALL_ELIGIBLE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Canonical "eligible" value. Any other value is treated as absent. */
export const NEX_INSTALL_ELIGIBLE_VALUE = "1";

/** True iff the supplied cookie value is the canonical eligibility
 *  marker. Everything else (undefined, null, "", "0", stray text) is
 *  treated as "not yet eligible". */
export function isInstallEligibleCookieValue(
  value: string | undefined | null,
): boolean {
  return value === NEX_INSTALL_ELIGIBLE_VALUE;
}

/**
 * Server-side read. Safe from RSCs and Server Actions.
 *
 * Returns true once the user has completed at least one qualifying
 * engagement event (first contact added OR first message sent).
 */
export async function isInstallEligible(): Promise<boolean> {
  const store = await nextCookies();
  return isInstallEligibleCookieValue(
    store.get(NEX_INSTALL_ELIGIBLE_COOKIE)?.value ?? null,
  );
}

/**
 * Idempotent set-once marker. MUST be called from a Server Action
 * (not an RSC) because `cookies().set(...)` is only allowed there.
 *
 * Call sites (owner-approved, sealed 2026-11-24):
 *   · src/app/nex-native/_actions.ts — sendPeerMessageAction success
 *   · src/app/nex-native/_actions.ts — sendFriendInviteAction success
 *   · src/app/nex-native/contacts/_save-as-friend-action.ts — success
 *
 * Never throws — failure to write the cookie downgrades to "promotion
 * stays hidden this visit" which is the safe side of the gate.
 */
export async function markInstallEligible(): Promise<void> {
  try {
    const store = await nextCookies();
    const current = store.get(NEX_INSTALL_ELIGIBLE_COOKIE)?.value ?? null;
    if (isInstallEligibleCookieValue(current)) {
      return; // already marked — no-op
    }
    store.set(NEX_INSTALL_ELIGIBLE_COOKIE, NEX_INSTALL_ELIGIBLE_VALUE, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: NEX_INSTALL_ELIGIBLE_MAX_AGE_SECONDS,
    });
  } catch {
    // Fail closed: promotion simply does not appear this visit.
  }
}
