// src/app/nex-native/_shop-auto-open-cookie.ts
//
// NEX one-shot shop auto-open signal · owner-authorised 2026-10-20
// (Track B of the Shop Journey authorisation).
// -----------------------------------------------------------------
// Purpose:
//   After `saveBusinessActivationAction` succeeds for a shop-intent
//   owner, write a short-lived cookie carrying the newly-activated
//   business's slug. On the owner's next arrival at /nex-native/contacts,
//   the server redirects ONCE to /nex-native/<slug> and clears the
//   cookie. If the owner reaches /contacts after the TTL expires, the
//   redirect never fires.
//
// Design constraints (per owner authorisation Track B):
//   · 300s max-age · the "return from setup" window is small · stale
//     intent cannot haunt the user past a few minutes.
//   · HttpOnly · never readable from JS · never used for anything
//     other than this one-shot redirect.
//   · Secure in production · SameSite=lax · Path=/ · matches the
//     cookie posture of nex_welcome_intent / nex_welcome_vertical.
//   · Reader returns the slug or null · null on absent, malformed,
//     or invalid-shape value. No throws.
//   · Writer takes a slug string · must have been just-verified by
//     the caller (the authenticated owner's just-activated business).
//   · Clearer is independent · its failure never blocks any sealed
//     Phase A1 clear.
//
// What this cookie DOES NOT do:
//   · Does NOT touch nex_welcome_intent or nex_welcome_vertical ·
//     those have independent sealed clearing blocks in
//     saveBusinessActivationAction + createBusinessAction.
//   · Does NOT carry any product id, item count, or payload beyond
//     the business slug (used as the redirect destination).
//   · Does NOT auto-open the FocusedShopSheet · that is a customer-
//     chat primitive. The redirect lands the owner on their own
//     /[businessSlug]/ production shop page where this session's
//     Add Listing CTA already lives.

import { cookies } from "next/headers";

/** Cookie key · stable across setter + reader + clearer. */
export const SHOP_AUTO_OPEN_COOKIE = "nex_shop_auto_open_eligible";

/** 300-second max-age · the one-shot window. */
export const SHOP_AUTO_OPEN_MAX_AGE_SECONDS = 300;

/** Allow only `[a-z0-9-]{1,64}` slugs · defensive input validation
 *  so a malformed cookie value can never route a redirect to an
 *  attacker-controlled URL. */
const SLUG_SHAPE = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;

/** Cookie options · one source of truth so SET and DELETE match
 *  path/sameSite (a delete only removes a cookie set with matching
 *  attributes). */
export function shopAutoOpenCookieOptions(): {
  httpOnly: true;
  path: "/";
  sameSite: "lax";
  maxAge: number;
  secure: boolean;
} {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: SHOP_AUTO_OPEN_MAX_AGE_SECONDS,
    secure,
  };
}

/** Parse a raw cookie value into a validated slug or null. */
export function parseShopAutoOpenSlug(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!SLUG_SHAPE.test(trimmed)) return null;
  return trimmed;
}

/** WRITE · called ONLY from `saveBusinessActivationAction` success
 *  path, inside its own independent try/catch so a failure here
 *  cannot block the sealed Phase A1 welcome-cookie clears. */
export async function writeShopAutoOpenEligible(
  businessSlug: string,
): Promise<void> {
  const parsed = parseShopAutoOpenSlug(businessSlug);
  if (!parsed) return; // defensive · never write a malformed slug
  const jar = await cookies();
  jar.set(SHOP_AUTO_OPEN_COOKIE, parsed, shopAutoOpenCookieOptions());
}

/** READ · safe-fail · returns null on absent / malformed cookie. */
export async function readShopAutoOpenEligible(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(SHOP_AUTO_OPEN_COOKIE)?.value ?? null;
  return parseShopAutoOpenSlug(raw);
}

/** CLEAR · must be called exactly once per consumption, inside its
 *  own independent try/catch so a clear failure cannot block the
 *  intended redirect-and-render flow at /contacts arrival. */
export async function clearShopAutoOpenEligible(): Promise<void> {
  const jar = await cookies();
  jar.delete({
    name: SHOP_AUTO_OPEN_COOKIE,
    path: "/",
  });
}
