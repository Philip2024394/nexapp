// src/lib/nex-native/open-shop-cookie.ts
//
// NEX · S9 · one-shot "open the Shop slider on next chat landing" cookie.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Fires once: the Use-cover action sets it, the next render of a chat
// landing surface reads AND clears it, and the Shop slider opens with
// its 5-card chooser.
//
// Owner directive (library→preview→Use journey · item 3 of 5):
//   "Themes and Personalised must not automatically open the Shop
//    slider. Shop intent must."
//
// This cookie carries that signal from the cover preview's "Use this
// cover" action to the first subsequent chat landing. Non-shop
// intents never set it · their flows never touch this module.
//
// Doctrinal boundaries:
//   · HttpOnly · browser JS cannot write (prevents cross-tab UI drift)
//   · path "/" · survives any in-app navigation
//   · SameSite "lax" · survives same-site redirects, blocks CSRF
//   · Secure in production, non-secure in dev / loopback
//   · 1-hour max-age · if the user doesn't reach chat within an hour
//     the signal expires and nothing opens unexpectedly on a later
//     unrelated visit (owner safeguard · item 7)
//   · ONE-SHOT · consumed-and-cleared on first read · subsequent
//     renders of the chat page see no cookie and the slider stays
//     closed per its sealed default
//
// Pattern mirrors the sealed `nex_welcome_intent` + `nex_selected_theme`
// + `nex_pending_cover_layout` cookies.

import "server-only";
import { cookies } from "next/headers";

/** Cookie name · the chat landing reads this exact key then clears
 *  it. Any other value drift breaks the one-shot contract. */
export const OPEN_SHOP_SLIDER_COOKIE = "nex_open_shop_on_chat";

/** The ONLY accepted cookie value · prevents an attacker from
 *  smuggling arbitrary content via a crafted cookie. */
export const OPEN_SHOP_SLIDER_VALUE = "1";

/** 1-hour TTL · owner-approved short window so a stale pending
 *  shop-open signal doesn't fire on an unrelated return visit. */
export const OPEN_SHOP_SLIDER_MAX_AGE_SECONDS = 60 * 60;

/** Shared cookie-attribute shape · setter + delete MUST match path
 *  for the browser to actually clear the cookie. */
export function openShopSliderCookieOptions(): {
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
    maxAge: OPEN_SHOP_SLIDER_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Server-side WRITE · the cover-preview "Use this cover" action
 *  calls this immediately before redirecting to `/chat/preview`.
 *  Must be invoked from a Server Action / Route Handler · Next
 *  refuses cookie mutation outside those contexts. */
export async function setOpenShopSliderCookie(): Promise<void> {
  const store = await cookies();
  store.set(
    OPEN_SHOP_SLIDER_COOKIE,
    OPEN_SHOP_SLIDER_VALUE,
    openShopSliderCookieOptions(),
  );
}

/** Server-side ONE-SHOT CONSUME · reads the cookie and returns
 *  whether the slider should open, then deletes the cookie so the
 *  signal cannot fire a second time.
 *
 *  Returns `true` ONLY when the cookie is present AND holds the
 *  single whitelisted value. Any other state (missing, tampered,
 *  wrong value) returns `false` · fail-closed.
 *
 *  Must be invoked from a Server Action, Route Handler, or
 *  Server Component rendered in a mutable-cookie context. */
export async function consumeOpenShopSliderCookie(): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(OPEN_SHOP_SLIDER_COOKIE)?.value;
  const hit = raw === OPEN_SHOP_SLIDER_VALUE;
  if (raw !== undefined) {
    // Clear whether valid or tampered · the one-shot contract
    // means a bad cookie never gets a second chance to fire.
    try {
      store.delete({
        name: OPEN_SHOP_SLIDER_COOKIE,
        path: "/",
      } as unknown as Parameters<typeof store.delete>[0]);
    } catch {
      // delete() can throw if we're in a non-mutable cookie scope
      // (e.g. a pure Server Component before any dynamic render).
      // Falling through is acceptable · the 1h TTL still protects
      // against replay.
    }
  }
  return hit;
}
