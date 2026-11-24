// src/lib/nex-native/app/known-device-cookie.ts
//
// G-2 fix · owner-sealed 2026-11-23 (NEX blueprint § 10)
// -----------------------------------------------------------------------
// Durable "this device has signed in to NEX at least once" marker. Used
// by src/app/nex-native/page.tsx to distinguish between:
//
//   State A · first-time visitor (no cookie, no session)
//     → theme picker at /nex-native/free-chat?show-themes=1
//
//   State D/E · returning signed-out / expired session (cookie, no session)
//     → sign-in at /nex-native/sign-in
//
//   State C · returning signed-in (cookie AND session)
//     → /nex-native/contacts
//
// Previously the splash page had only a two-way branch (session vs no
// session), which sent State D/E users through the theme picker on every
// PWA reopen — against the owner's intent ("returning user who is not
// signed in → show sign-in or account recovery").
//
// Semantics
// ---------
//   · Set in middleware whenever `supabase.auth.getUser()` resolves a
//     real user. One-year TTL. Every successful authenticated request
//     refreshes the TTL, so active users effectively keep the cookie
//     until they stop using the app for a year.
//
//   · NEVER cleared on sign-out. The owner's directive is that a user
//     who signs out and comes back must still land on sign-in (not the
//     theme picker). Clearing would make the next visit look like a
//     first-time user.
//
//   · Opaque single value. The cookie carries no identity information
//     and no PII. It is a device-scoped boolean marker only.
//
//   · HttpOnly + SameSite=Lax + Secure (in production). Matches the
//     security posture of the directory-seed cookie already set in the
//     same middleware.
//
// This module is pure — no I/O, no process.env reads. Safe to import
// from the edge runtime.

export const KNOWN_DEVICE_COOKIE = "nex_known_device";

/** One year. Active users refresh this TTL on every authenticated request
 *  (middleware calls `setKnownDeviceCookieOnResponse` when getUser resolves
 *  a real user). The upper bound is "a year of total inactivity resets
 *  the device to first-time." */
export const KNOWN_DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** The only value this cookie ever carries. Any other value is treated
 *  as absent (defence against tampering). */
export const KNOWN_DEVICE_VALUE = "1";

/** True iff the supplied cookie value is the canonical known-device
 *  marker. Everything else (undefined, null, "", "0", stray text) is
 *  treated as "unknown device". */
export function isKnownDeviceCookieValue(
  value: string | undefined | null,
): boolean {
  return value === KNOWN_DEVICE_VALUE;
}
