// src/lib/nex-native/pending-cover-cookie.ts
//
// NEX · "pending Face Cover" cookie · owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Carries the Face Cover layout a user picked during Shop-intent
// onboarding, BEFORE they have an eligible nex_business row. The
// cookie survives the signup chain so the "Building Your NEX" step
// can read it, and so a later Bisnis activation can apply the choice
// to the real nex_business.cover_layout_id column via the sealed
// `businessService.updateCoverLayoutId` primitive.
//
// Owner directive 2026-10-18 (D1):
//   · HTTP-only · path "/" · SameSite "lax"
//   · Secure cookie in production, non-secure in dev / 127.0.0.1
//   · 24-hour max-age (long enough for a signup session, short
//     enough that a stale pick doesn't haunt the user forever)
//   · HARDCODED whitelist of the 10 sealed cover layout ids via the
//     sealed `isValidCoverLayoutId` helper · any other value is
//     treated as absent (cookie ignored) · hard-blocks arbitrary
//     value injection via a crafted guest flow
//   · Validate on BOTH write and read · fail-closed on parse error
//
// What this cookie is NOT:
//   · Not a saved business setting · the cookie is a PENDING choice
//     only. No code anywhere may interpret a cookie-only presence
//     as "the user's business has a cover layout set." The real
//     persistence happens via `nex_business.cover_layout_id` after
//     the user activates a legitimate business.
//   · Not an upgrade signal · tapping the Shop intent card during
//     onboarding does NOT auto-create a `nex_business` row.
//
// Same architectural pattern as sealed:
//   · `src/lib/nex-native/selected-theme-cookie.ts` (2026-10-15)
//   · `src/app/nex-native/welcome/_welcome-intent.ts` (2026-10-15)
//
// Zero migration · pure cookie-based state.

import type { CookieListItem } from "next/dist/compiled/@edge-runtime/cookies";
import { cookies } from "next/headers";
import {
  isValidCoverLayoutId,
  type CoverLayoutId,
} from "@/app/nex-native/cover/layout-ids";

/** Cookie name · stable string so pick-cover sets + building reads
 *  + activation clears the same name. */
export const PENDING_COVER_COOKIE = "nex_pending_cover_layout";

/** 24-hour max-age in seconds · matches `nex_welcome_intent` and
 *  `nex_selected_theme` doctrine. */
export const PENDING_COVER_MAX_AGE_SECONDS = 60 * 60 * 24;

/** Compose the exact cookie options we set on writes. Keeping the
 *  shape in one place prevents drift between the setter and the
 *  clearer (which must match path to actually remove the cookie). */
export function pendingCoverCookieOptions(): {
  httpOnly: true;
  path: "/";
  sameSite: "lax";
  maxAge: number;
  secure: boolean;
} {
  // Secure in production so the cookie never leaks over HTTP ·
  // disabled in dev / loopback so local http://localhost sessions
  // still work. Mirrors the sealed selected-theme-cookie pattern.
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: PENDING_COVER_MAX_AGE_SECONDS,
    secure,
  };
}

/** Narrow an untrusted string to one of the 10 sealed cover layout
 *  ids or null. Delegates to the sealed `isValidCoverLayoutId`
 *  helper so the whitelist can only ever be extended by changing
 *  the sealed `COVER_LAYOUT_IDS` list. */
export function parsePendingCoverLayoutId(
  value: string | null | undefined,
): CoverLayoutId | null {
  if (typeof value !== "string") return null;
  return isValidCoverLayoutId(value) ? value : null;
}

/** Server-side READ. Returns the current pending cover layout id, or
 *  null if the cookie is unset OR carries a non-whitelisted value.
 *  Validation runs on every read · corrupt / tampered / stale cookie
 *  values are silently ignored, never passed through to callers. */
export async function readPendingCoverLayoutId(): Promise<CoverLayoutId | null> {
  const store = await cookies();
  const raw = store.get(PENDING_COVER_COOKIE)?.value;
  return parsePendingCoverLayoutId(raw);
}

/** Server-side WRITE. Validates against the sealed whitelist BEFORE
 *  writing · returns the id that was written, or null when the input
 *  was invalid (caller may choose to redirect-with-error).
 *
 *  Must be called from a Server Action / Route Handler · Next refuses
 *  cookie mutation outside those contexts. The caller composes the
 *  Server Action and this helper runs inside it. */
export async function writePendingCoverLayoutId(
  value: string | null | undefined,
): Promise<CoverLayoutId | null> {
  const parsed = parsePendingCoverLayoutId(value);
  if (parsed === null) return null;
  const store = await cookies();
  store.set(PENDING_COVER_COOKIE, parsed, pendingCoverCookieOptions());
  return parsed;
}

/** Server-side CLEAR. Deletes the cookie by setting the same name +
 *  path with Max-Age 0. Called when the pending choice has been
 *  successfully persisted to a legitimate business (via the sealed
 *  `businessService.updateCoverLayoutId`), or when the user
 *  explicitly discards their pick.
 *
 *  Must be called from a Server Action / Route Handler. Also safe
 *  to call when the cookie is already absent · the delete is a
 *  no-op in that case. */
export async function clearPendingCoverLayoutId(): Promise<void> {
  const store = await cookies();
  // Use delete with the matching path so the browser clears the
  // cookie it originally set. Older Edge-runtime versions require
  // the path explicitly · passing it is a safe no-op elsewhere.
  store.delete({
    name: PENDING_COVER_COOKIE,
    path: "/",
  } as unknown as CookieListItem);
}
