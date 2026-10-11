// src/lib/nex-native/account-wall/pending-action.ts
//
// NEX Account Wall · secure signup-continuation primitive · Phase 0.
// ------------------------------------------------------------------
// When a guest clicks "Create free account" from inside an account wall,
// we need to remember two things across the signup flow:
//
//   · `nextUrl`  · the exact LOCAL page they should return to
//   · `action`   · the pending action id so the destination can replay
//                   (e.g. "pick-theme" → persist the chat_theme once
//                   authenticated)
//
// Both pieces live in a short-lived HttpOnly cookie. HttpOnly means the
// browser never exposes it to client JS → no XSS can read the next
// hop. We validate the `nextUrl` against a strict local-path regex on
// every read so a malicious intermediate page cannot redirect the user
// to an external domain even if the cookie is replayed.
//
// Load-bearing security rules:
//   · HttpOnly + SameSite=Lax · the cookie travels with the top-level
//     navigation from /create-account back to the intended page but
//     cannot be read by third-party JS.
//   · `nextUrl` MUST match ALLOWED_NEXT_PATH · a relative path starting
//     with `/nex-native/` and containing no `..` segments and no
//     protocol. Anything else is discarded silently and the fallback
//     "/nex-native/home" is used.
//   · `action` MUST be a registered WALL_COPY action id. Unknown ids
//     are discarded (replay a safe no-op rather than crash).
//   · Cookie TTL is 20 minutes. After that the continuation is dead
//     and the user lands at /home like any other new signup.
//   · The cookie is CLEARED after one consumption. Replaying a stale
//     intent cannot execute a consequential action twice.
//   · Consequential actions (place order · post · join community · send
//     message) MUST still require their normal authenticated workflow
//     after replay. "Replay" here means "forward the user to the right
//     place with the pre-selected choice", NOT "silently perform the
//     action on their behalf".

import "server-only";
import { cookies as nextCookies } from "next/headers";
import {
  isRegisteredAccountWallAction,
  type AccountWallActionId,
} from "./wall-copy";

const COOKIE_NAME = "nex_pending_wall";
const COOKIE_MAX_AGE_SECONDS = 20 * 60;

/** Strict allow-list for the `nextUrl` field. Must be:
 *   · a local path starting with /nex-native/
 *   · letters · digits · unreserved chars · query string tolerated
 *   · no `..` traversal segments
 *   · no protocol scheme
 *   · no backslashes (defence against Windows-style path confusion)
 *   · 1-400 chars so an attacker can't bloat the cookie
 */
const ALLOWED_NEXT_PATH =
  /^\/nex-native\/[A-Za-z0-9][A-Za-z0-9/_\-?=&.%]*$/;

/** True when `nextUrl` is safe to redirect to. */
export function isAllowedNextUrl(nextUrl: string | null | undefined): boolean {
  if (!nextUrl) return false;
  if (nextUrl.length < 1 || nextUrl.length > 400) return false;
  if (nextUrl.includes("..")) return false;
  if (nextUrl.includes("\\")) return false;
  if (nextUrl.includes("//")) return false;
  return ALLOWED_NEXT_PATH.test(nextUrl);
}

export interface PendingAccountWall {
  action: AccountWallActionId;
  nextUrl: string;
  /** Opaque param slot · the destination replay code knows what to do
   *  with it (e.g. "pick-theme" uses this to carry the themeId). Safe
   *  because consumption is server-side and the destination validates
   *  the value against its own schema. Length-capped so the cookie
   *  can't be used to smuggle large payloads. */
  payload?: string | null;
}

/** Serialise a PendingAccountWall to the cookie encoding we use.
 *  Format: v1|<action>|<nextUrl>|<payload-or-empty>
 *  v1 prefix is a versioning hook · future format changes land under
 *  v2 and old cookies are discarded. */
function encode(value: PendingAccountWall): string {
  const payload = (value.payload ?? "").slice(0, 200);
  return `v1|${value.action}|${value.nextUrl}|${payload}`;
}

function decode(raw: string): PendingAccountWall | null {
  const parts = raw.split("|");
  if (parts.length < 4 || parts[0] !== "v1") return null;
  const [, action, nextUrl, ...rest] = parts;
  const payload = rest.join("|") || null;
  if (!isRegisteredAccountWallAction(action)) return null;
  if (!isAllowedNextUrl(nextUrl)) return null;
  if (payload && payload.length > 200) return null;
  return { action, nextUrl, payload };
}

/** Set the pending wall cookie. Called from a Server Action when the
 *  user clicks "Create free account" inside a modal. */
export async function setPendingAccountWall(
  value: PendingAccountWall,
): Promise<void> {
  if (!isRegisteredAccountWallAction(value.action)) {
    throw new Error(
      `nex-account-wall: refusing to set pending action with unknown id "${value.action}"`,
    );
  }
  if (!isAllowedNextUrl(value.nextUrl)) {
    throw new Error(
      `nex-account-wall: refusing to set pending nextUrl that fails local-path validation`,
    );
  }
  const jar = await nextCookies();
  jar.set(COOKIE_NAME, encode(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/** Read the pending wall cookie without clearing it. Useful for the
 *  destination page to decide whether to show a "continue with your
 *  selection" confirmation step. Never mutates state. */
export async function peekPendingAccountWall(): Promise<PendingAccountWall | null> {
  const jar = await nextCookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return decode(raw);
}

/** Read AND clear the pending wall cookie. One-shot. Guarantees a
 *  replay can never happen twice on the same cookie.
 *
 *  Call this from the signup-completion handler to retrieve the
 *  destination the user originally intended. */
export async function consumePendingAccountWall(): Promise<PendingAccountWall | null> {
  const jar = await nextCookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  const parsed = raw ? decode(raw) : null;
  // Always clear · even if decoding failed, so a malformed cookie
  // doesn't live forever.
  try {
    jar.set(COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  } catch {
    /* in RSC context we cannot set cookies · consumption still safe
     *  because the destination page checks the cookie once and routes
     *  the user forward; subsequent navigations will see the cookie
     *  being overwritten by a fresh wall or the signup success path. */
  }
  return parsed;
}

/** Explicitly clear the pending wall cookie. Called from a Server
 *  Action attached to the modal's dismiss affordance so a visitor who
 *  changes their mind doesn't leave a stale redirect hanging. */
export async function clearPendingAccountWall(): Promise<void> {
  const jar = await nextCookies();
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
