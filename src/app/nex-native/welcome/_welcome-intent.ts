// src/app/nex-native/welcome/_welcome-intent.ts
//
// NEX welcome · intent constants and pure helpers.
// -----------------------------------------------------------------------------
// Plain module (NOT "use server") so it can be imported from both
// server components (welcome/page.tsx · pick-theme/page.tsx) AND
// the vitest intent-persistence suite.
//
// The "use server" module _remember-intent-action.ts imports from
// this file to use the token list + guard inside its async action.
//
// Owner-authorised intent persistence · 2026-10-15.

/** The three intent tokens that match the welcome card keys. The
 *  array is exported so a new intent can only be added by extending
 *  this canonical list. */
export const WELCOME_INTENT_TOKENS = [
  "themes",
  "shop",
  "personalised",
] as const;

export type WelcomeIntent = (typeof WELCOME_INTENT_TOKENS)[number];

/** Cookie key · stable string so pick-theme reads the same name. */
export const WELCOME_INTENT_COOKIE = "nex_welcome_intent";

/** Guard · narrows arbitrary strings to the WelcomeIntent union. */
export function isWelcomeIntent(
  value: string | null | undefined,
): value is WelcomeIntent {
  return (
    typeof value === "string" &&
    (WELCOME_INTENT_TOKENS as readonly string[]).includes(value)
  );
}

/** Human-friendly label per welcome-intent token · surfaces the user's
 *  earlier card tap on the welcome page. Pure mapping · consumed by
 *  pick-theme/page.tsx and pinned by the intent-persistence vitest.
 *
 *  Owner-authorised 2026-10-20 · the three welcome cards were
 *  re-labelled to (Free NEX Chat · Chat Themes · Business NEX Chat).
 *  The INTERNAL token names ("themes" · "shop" · "personalised") are
 *  kept so the sealed cookie contract and the Phase A1 vertical-
 *  picker chain (which gates on `intent === "shop"`) are untouched.
 *  Only the user-facing copy below is updated. */
export function pickThemeIntentCopy(intent: WelcomeIntent): string {
  switch (intent) {
    case "themes":
      // Card 1 · Free NEX Chat · the user chose the free, personal-chat journey.
      return "Based on your Free NEX Chat choice · pick one of the standard NEX themes below. They stay yours forever at no cost.";
    case "shop":
      // Card 3 · Business NEX Chat · the user chose the Bisnis journey ·
      // next step after theme is business-kind (Phase A1 vertical picker).
      return "Based on your Business NEX Chat choice · pick a chat theme first, then your shop cover. We'll ask your business type on the next step.";
    case "personalised":
      // Card 2 · Chat Themes (PURCHASE THEMES) · the user chose the
      // paid-themes journey · keeps ordinary chat functionality, no
      // Business features implied. "premium" stays so downstream
      // honesty regex guards continue to pass.
      return "Based on your Chat Themes purchase choice · preview any premium theme live below before you decide to buy. Ordinary NEX chat is kept.";
  }
}

// ─── NEX Vertical Intent · Phase A1 (owner-authorised 2026-10-20) ──
//
// Additive second cookie that carries the user's declared business
// (category, subtype) across the signup chain. The sealed
// `nex_welcome_intent` cookie above is 100% untouched by this code.
//
// Lifecycle:
//   · Written on /welcome when the user picks a vertical.
//   · Read on /create-account/pick-theme (to sort theme suggestions).
//   · Read on /create-account/pick-cover (to pre-select cover).
//   · Read in createBusinessAction (to set cover_layout_id + the
//     profile.primary.subtype on the newly created business).
//   · CLEARED ONLY after saveBusinessActivationAction successfully
//     persists the subtype · if the user abandons mid-flow the cookie
//     expires at 24h max-age.
//
// Safety invariants:
//   · Validation on READ: JSON parse failure, enum mismatch, or
//     cookie absence all return null. No throws. Every consumer must
//     fall back to sealed defaults on null.
//   · HTTP-only + SameSite=lax + Path=/ · same cookie posture as the
//     sealed `nex_welcome_intent` cookie above.
//   · Max-Age 24h · bounded so a stale pick can't haunt the user
//     past a plausible signup window.

import { cookies } from "next/headers";
import {
  isVerticalCategory,
  isVerticalSubtype,
  type VerticalIntent,
} from "@/lib/nex-native/vertical-presets";

/** Cookie name · stable string across setter + readers + clearer. */
export const WELCOME_VERTICAL_COOKIE = "nex_welcome_vertical";

/** 24-hour max-age in seconds · matches the sealed welcome-intent
 *  cookie doctrine. */
export const WELCOME_VERTICAL_MAX_AGE_SECONDS = 60 * 60 * 24;

/** Cookie options used on write · kept in one place so set + clear
 *  stay in lockstep on path/sameSite (which must match for a .delete
 *  call to actually remove the cookie). */
export function welcomeVerticalCookieOptions(): {
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
    maxAge: WELCOME_VERTICAL_MAX_AGE_SECONDS,
    secure,
  };
}

/** Strict parse · returns null on JSON failure, shape mismatch, or
 *  any unknown enum value · never throws. */
export function parseVerticalIntent(
  raw: string | null | undefined,
): VerticalIntent | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const category = obj.category;
  const subtype = obj.subtype;
  if (typeof category !== "string" || typeof subtype !== "string") return null;
  if (!isVerticalCategory(category)) return null;
  if (!isVerticalSubtype(subtype)) return null;
  return { category, subtype };
}

/** Serialise an intent to the JSON string the cookie carries. */
export function serializeVerticalIntent(intent: VerticalIntent): string {
  return JSON.stringify({ category: intent.category, subtype: intent.subtype });
}

/** READ · safe-fail · returns null on absent / corrupted / stale
 *  cookie · every consumer must handle null as "no vertical choice ·
 *  use sealed defaults". */
export async function readVerticalIntent(): Promise<VerticalIntent | null> {
  const jar = await cookies();
  const raw = jar.get(WELCOME_VERTICAL_COOKIE)?.value ?? null;
  return parseVerticalIntent(raw);
}

/** CLEAR · called ONLY after the destination column(s) are persisted
 *  on nex_business · same cookie options as write so the delete
 *  actually removes the cookie. */
export async function clearVerticalIntent(): Promise<void> {
  const jar = await cookies();
  jar.delete({
    name: WELCOME_VERTICAL_COOKIE,
    path: "/",
  });
}

// ─── NEX Vertical Decline Sentinel · R1 fix (2026-10-20) ───────────
//
// The short-lived sentinel below records that a shop-intent user
// explicitly SKIPPED the business-kind picker. Its only purpose is
// to break the redirect loop in pick-theme (which otherwise forever
// sends shop-intent-no-vertical users back to business-kind).
//
// Design constraints (owner-authorised corrective patch 2026-10-20):
//   · Short-lived · 1h max-age so a stale decline cannot haunt the
//     user across sessions. The business-first journey resurfaces on
//     the next visit.
//   · Carries NO payload beyond "declined" · a single opaque "1"
//     value, strict parse on read, every unknown value treated as
//     "not declined." No chance of leaking into a subtype write.
//   · Cleared whenever the user actually picks a vertical (so a
//     revisit after declining → picking removes the sentinel) AND
//     when the business is successfully created (createBusinessAction
//     clears) AND on manual activation (saveBusinessActivationAction
//     clears).
//   · Scoped to shop-intent flow via the pick-theme redirect
//     condition · non-shop intents never consult it, so there is no
//     cross-flow bleed.

/** Cookie name for the decline sentinel. */
export const WELCOME_VERTICAL_DECLINE_COOKIE =
  "nex_welcome_vertical_declined";

/** 1-hour max-age · explicitly shorter than the 24h vertical cookie
 *  so the business-first journey resurfaces quickly. */
export const WELCOME_VERTICAL_DECLINE_MAX_AGE_SECONDS = 60 * 60;

/** The only accepted cookie value · strict allow-list, not a free
 *  text field. Any other value on read is treated as "not declined." */
export const WELCOME_VERTICAL_DECLINE_VALUE = "1";

/** Cookie options for write + clear symmetry. */
export function welcomeVerticalDeclineCookieOptions(): {
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
    maxAge: WELCOME_VERTICAL_DECLINE_MAX_AGE_SECONDS,
    secure,
  };
}

/** Strict parse · returns true ONLY when the cookie holds the exact
 *  sealed sentinel value. Any other string → false. */
export function parseVerticalDeclined(
  raw: string | null | undefined,
): boolean {
  return raw === WELCOME_VERTICAL_DECLINE_VALUE;
}

/** READ · safe-fail · returns false on absent / mismatched cookie. */
export async function readVerticalDeclined(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(WELCOME_VERTICAL_DECLINE_COOKIE)?.value ?? null;
  return parseVerticalDeclined(raw);
}

/** WRITE · called from the business-kind skip server action only. */
export async function writeVerticalDeclined(): Promise<void> {
  const jar = await cookies();
  jar.set({
    name: WELCOME_VERTICAL_DECLINE_COOKIE,
    value: WELCOME_VERTICAL_DECLINE_VALUE,
    ...welcomeVerticalDeclineCookieOptions(),
  });
}

/** CLEAR · fires whenever a vertical IS declared, when a business is
 *  successfully created, or when manual activation completes. */
export async function clearVerticalDeclined(): Promise<void> {
  const jar = await cookies();
  jar.delete({
    name: WELCOME_VERTICAL_DECLINE_COOKIE,
    path: "/",
  });
}

