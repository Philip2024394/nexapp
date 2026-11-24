// src/lib/nex-native/onboarding/account-active-seen.ts
//
// NEX-024 · one-time gate for the /welcome/account-active celebration
// screen. Owner-sealed 2026-11-24.
//
// HONEST SCOPE:
//   · This is a device-local cookie, not an account-level flag. Clearing
//     site data or signing in on a different device re-shows the page.
//     That is deliberate for now · account-level persistence requires a
//     `nex_account.onboarding_seen_at` column which is NOT yet applied.
//     When that column lands, this helper can be replaced in place.
//   · The cookie is HttpOnly + SameSite=Lax so client JS cannot forge it
//     to permanently skip onboarding for a user who hasn't seen it yet.
//   · "Seen" means the user was shown the celebration shell ONCE after
//     landing on /welcome/account-active while authenticated. On every
//     subsequent visit to that URL the server redirects to contacts.

import { cookies } from "next/headers";

export const ACCOUNT_ACTIVE_SEEN_COOKIE = "nex_account_active_seen";

// 30 days is long enough that a user re-signing in on the same device
// within a month does not get the celebration again, but short enough
// that a long-dormant account coming back feels welcomed on return.
// The ceiling is a cookie · it never forecloses the user from seeing
// the welcome again on another device, which is correct.
const SEEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function hasSeenAccountActive(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(ACCOUNT_ACTIVE_SEEN_COOKIE)?.value === "1";
}

export async function markAccountActiveSeen(): Promise<void> {
  const jar = await cookies();
  jar.set({
    name: ACCOUNT_ACTIVE_SEEN_COOKIE,
    value: "1",
    maxAge: SEEN_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
