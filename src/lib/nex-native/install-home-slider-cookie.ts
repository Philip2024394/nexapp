// src/lib/nex-native/install-home-slider-cookie.ts
//
// NEX · "Add NEX to your home screen" slider dismissal cookie.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Discreet footer slider shown on:
//   · the sealed post-signup welcome landing (Bridge 42)
//   · (future) after a genuine paid Bisnis membership upgrade
//
// Dismissal is persistent · once the user taps the × the slider
// stays hidden across visits on the same device for 365 days. If
// they clear cookies or switch devices, the slider can re-appear
// (same honest-cookie semantics as every other NEX dismissal signal).

import "server-only";
import { cookies } from "next/headers";

/** Cookie name · sealed · do not drift. */
export const INSTALL_HOME_SLIDER_DISMISSED_COOKIE =
  "nex_install_home_dismissed";

/** Only accepted value · prevents an attacker from smuggling data
 *  via a crafted cookie. Presence of exactly "1" means dismissed. */
export const INSTALL_HOME_SLIDER_DISMISSED_VALUE = "1";

/** 1-year TTL · effectively permanent for most users while still
 *  letting the browser expire the signal if the user hasn't come
 *  back for a very long time. */
export const INSTALL_HOME_SLIDER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function installHomeSliderCookieOptions(): {
  httpOnly: true;
  path: "/";
  sameSite: "lax";
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: INSTALL_HOME_SLIDER_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Server-side READ · returns true when the user has previously
 *  dismissed the slider on this device. Fail-closed · any tampered
 *  value is treated as "not dismissed" so the slider still has a
 *  chance to appear (but the next render would clear the bad
 *  cookie via its own one-shot discipline if we wanted that;
 *  dismissal is not a one-shot, so we simply ignore bad values). */
export async function isInstallHomeSliderDismissed(): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(INSTALL_HOME_SLIDER_DISMISSED_COOKIE)?.value;
  return raw === INSTALL_HOME_SLIDER_DISMISSED_VALUE;
}

/** Server-side WRITE · set when the user taps the × on the slider.
 *  Must be called from a Server Action / Route Handler. */
export async function setInstallHomeSliderDismissed(): Promise<void> {
  const store = await cookies();
  store.set(
    INSTALL_HOME_SLIDER_DISMISSED_COOKIE,
    INSTALL_HOME_SLIDER_DISMISSED_VALUE,
    installHomeSliderCookieOptions(),
  );
}
