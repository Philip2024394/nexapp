"use server";

// src/app/nex-native/contacts/_dismiss-nex1-banner-action.ts
//
// NEX · S4 · dismiss the NEX1 welcome banner on /nex-native/contacts.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// This server action sets the httpOnly `nex_welcome_banner_dismissed`
// cookie and nothing else. It MUST NOT:
//
//   · Delete the NEX1 conversation or any messages inside it.
//   · Touch the sealed `nex_peer_conversation` or `nex_peer_message`
//     tables.
//   · Redirect the user away from /contacts.
//   · Clear the `nex_pending_cover_layout` or any other onboarding
//     cookie.
//   · Write any analytics / telemetry.
//
// Dismissal is a UX override on top of the sealed first-contact
// predicate. The predicate still owns the authoritative "has the
// user replied?" signal. Dismissal just suppresses the surface
// when the user says "I know, I'll open it later."

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  NEX1_BANNER_DISMISSED_COOKIE,
  NEX1_BANNER_DISMISS_MAX_AGE_SECONDS,
} from "./_banner-visibility";

export async function dismissNex1WelcomeBannerAction(): Promise<void> {
  const jar = await cookies();
  jar.set(NEX1_BANNER_DISMISSED_COOKIE, "1", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: NEX1_BANNER_DISMISS_MAX_AGE_SECONDS,
    // Secure in production so the cookie never leaks over HTTP ·
    // disabled in dev / loopback so local http://localhost sessions
    // still work. Mirrors the sealed selected-theme-cookie pattern.
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/nex-native/contacts");
}
