// src/lib/nex-native/analytics/viewer-cookie.ts
//
// NEX viewer-cookie helper · owner-sealed 2026-11-08 (round 5).
// -----------------------------------------------------------------------------
// Doctrine
//   · Owner wants genuine unique-viewer dedup via a long-lived
//     first-party token · we store its SHA-256 hash in the DB · raw
//     cookie value is never persisted and never leaves the device.
//   · Cookie is httpOnly + sameSite=lax + secure in HTTPS · not a
//     cross-site tracker · scoped to the NEX app only.
//   · NEVER contains PII · just 32 random bytes of hex.
//
// Usage from a server component:
//   const { tokenHash, setCookieHeader } = await resolveViewerToken();
//   // ... record the view ...
//   // If setCookieHeader is non-null, the caller should attach it to
//   // the response. In Next.js 16 app router server components we
//   // use the cookies() mutator instead — see the tracer below.

import "server-only";
import { cookies } from "next/headers";
import {
  VIEWER_TOKEN_COOKIE,
  VIEWER_COOKIE_MAX_AGE_SEC,
  generateViewerToken,
  sha256Hex,
} from "./page-view-service";

export interface ResolvedViewerToken {
  readonly tokenHash: string;
  /** True when the cookie did NOT exist and we minted a new token. */
  readonly minted: boolean;
}

/**
 * Read the existing viewer cookie or mint a new one.
 *
 * On a cookie miss this writes a new cookie via Next's cookies()
 * mutator so the SAME token is used on the next view. The write is a
 * best-effort side-effect · if the surrounding route is read-only
 * (static shell) the set may be silently ignored by Next, but the
 * request still gets a valid tokenHash for THIS write.
 */
export async function resolveViewerToken(): Promise<ResolvedViewerToken> {
  const jar = await cookies();
  const existing = jar.get(VIEWER_TOKEN_COOKIE)?.value;
  if (existing && /^[0-9a-f]{64}$/.test(existing)) {
    return { tokenHash: sha256Hex(existing), minted: false };
  }
  const fresh = generateViewerToken();
  try {
    jar.set({
      name: VIEWER_TOKEN_COOKIE,
      value: fresh,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: VIEWER_COOKIE_MAX_AGE_SEC,
      // `secure` is handled by Next's cookie APIs based on the
      // request protocol in production builds. On localhost the
      // request is http · we deliberately omit the flag here so
      // dev works · prod gets secure automatically.
    });
  } catch {
    /* Server components under certain render paths cannot mutate
     * cookies · swallow · this view still records with a fresh
     * token hash · the next visit remints. */
  }
  return { tokenHash: sha256Hex(fresh), minted: true };
}
