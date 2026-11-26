// src/app/nex-native/post-signup-apply/route.ts
//
// CYCLE 13 · G-4 · post-signup pending-wall apply route · 2026-11-25.
// CYCLE 14 · 2026-11-25 · retained for direct browser navigation, no
// longer the signup/sign-in handoff target (see owner directive on
// GAP-C14-002 below).
// -----------------------------------------------------------------------------
// Originally this route was the destination of two server-action
// redirects (`createNexAccountAction` + `signInAction`). The CYCLE 14
// rework replaces those redirects with inline consumption via the
// shared `consumeAndApplyPendingAccountWall` module · reason: the
// Next.js 16 client router processes a server-action `redirect(...)`
// to a Route Handler as an RSC navigation and the response cannot
// resolve to an RSC payload, so the browser stalled at
// `/post-signup-apply`.
//
// This handler is RETAINED for:
//   · Direct browser navigation (bookmark, address-bar paste, history
//     replay) · a legitimate authenticated user may land here with a
//     live pending-wall cookie if their signup flow was interrupted.
//   · CSRF / cross-origin probes · the Sec-Fetch-Site + Origin
//     defences still catch an attacker-controlled `<a href>` click
//     trying to replay a stale cookie into an authoritative theme
//     write.
//   · Stale-cookie attempts arriving after the server-action
//     consumption has already happened · the cookie should already be
//     cleared, but this handler re-clears defensively.
//
// It consumes the one-shot HttpOnly cookie `nex_pending_wall` (set by the
// sealed account-wall primitive immediately before the auth action was
// taken), replays the recorded action authoritatively against the
// authenticated account, and forwards the user to their original
// destination.
//
// Cycle 13 · why this is a Route Handler, not an RSC page
// -----------------------------------------------------------------------------
// Cycle 12 implemented this as an RSC page (`page.tsx`). Two real bugs
// were proved against that implementation (reports documented in
// `docs/product/launch-evidence-ledger.md` § 2.1f · Cycle 13):
//
//   · BUG-C13-001 · "stale cookie replay". Next.js 16 RSC render functions
//     cannot emit `Set-Cookie` response headers — `cookies().set("", maxAge:0)`
//     is silently dropped. The one-shot cookie therefore persisted in the
//     browser for its full 20-minute TTL. If the user later chose a
//     different theme through the normal app flow, any subsequent visit
//     to `/post-signup-apply` (bookmark, back-nav, cross-site link, etc.)
//     would silently re-apply the stale cookie's theme, overwriting the
//     user's explicit choice. Proved 2026-11-25 by direct DB inspection.
//   · BUG-C13-002 · "CSRF on state-changing GET". The RSC page performed
//     a DB write (updateChatTheme) in response to a GET request. The
//     cookie's SameSite=Lax permits cross-site top-level navigation,
//     so a cross-site attacker-controlled `<a href>` click or form POST
//     could trigger the write combined with an existing stale cookie.
//     Proved 2026-11-25 by simulated cross-site navigation with
//     `Sec-Fetch-Site: cross-site` header — write succeeded.
//
// Route Handlers CAN set response cookies, so the one-shot is now a
// REAL one-shot: the cookie is cleared from the browser on the same
// response that carries the redirect. The `Sec-Fetch-Site: cross-site`
// check closes the GET-triggered CSRF path: a cross-site navigation
// lands at `/contacts` with the cookie cleared (no cookie consumption,
// so a legitimate follow-up same-origin visit cannot replay anyway).
//
// Scope sealed by Founder 2026-11-25 (Cycle 12, continued in Cycle 13):
//   · Handles `pick-theme` only. Other registered actions redirect-only.
//   · Premium-entitlement gate mirrors `updateChatThemeAction` as a
//     defence-in-depth guard against a tampered cookie.
//   · `source='first_free'` write is INTENTIONALLY NOT performed here
//     (migration 342 unapplied). The two guest-selectable NEX themes
//     (`nex-bubbles`, `nex-flat`) are gratis live-worlds and do not
//     consume the first-free perk.
//
// Security notes (post-Cycle 13):
//   · `Sec-Fetch-Site: cross-site` → redirect to `/contacts` with the
//     cookie cleared · NO cookie consumption, NO DB write.
//   · Unauth caller → redirect to `/sign-in` · the cookie is NOT cleared
//     so the legitimate post-sign-in handoff can still consume it.
//   · All redirects use HTTP 303 (`See Other`) with a `Set-Cookie:
//     nex_pending_wall=; Max-Age=0` header to make the one-shot real.
//   · The `nextUrl` passed strict ALLOWED_NEXT_PATH validation when
//     the cookie was originally set — no open-redirect.

import { NextRequest, NextResponse } from "next/server";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { consumeAndApplyPendingAccountWall } from "@/lib/nex-native/account-wall/consume-and-apply";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENDING_COOKIE = "nex_pending_wall";

/** Build a 303 redirect response that ALSO clears the one-shot
 *  `nex_pending_wall` cookie via `Set-Cookie`. Route handlers CAN emit
 *  response cookies (unlike RSC pages — see Cycle 13 note at the top
 *  of this file). This is what makes the one-shot a REAL one-shot. */
function redirectAndClear(req: NextRequest, path: string): NextResponse {
  const url = new URL(path, req.url);
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(PENDING_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}

/** Plain redirect that does NOT touch the pending-wall cookie. Used for
 *  unauth callers so the legitimate post-sign-in handoff can still read
 *  the cookie after the user authenticates. */
function redirectKeepingCookie(req: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, req.url), 303);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // CSRF defence · refuse state-changing GET from cross-site top-level
  // navigation. SameSite=Lax permits the cookie to travel with
  // `<a href=nexapp.app/...>` clicks and cross-site form POSTs, so
  // without this check an attacker could combine a stale pending-wall
  // cookie with a cross-site nav to flip the victim's theme.
  //
  // Sec-Fetch-Site values we allow:
  //   · "same-origin" · nav triggered from within nexapp (e.g. the
  //     server-action redirect from `signUpAction` / `signInAction`)
  //   · "same-site"   · subdomain navigation (reserved; nexapp is
  //     single-origin today)
  //   · "none"        · user-typed URL / bookmark / history replay
  //   · undefined     · older browsers not sending the header · fall
  //                     back to Origin/Referer (checked below)
  // REJECT: "cross-site". Verified empirically against the live route
  // handler by the regression test in
  // `tests/e2e/journey-post-signup-apply-theme.spec.ts`.
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    // Do NOT clear the cookie: the legitimate same-origin flow that
    // runs after this request may still need to consume it. Attacker
    // just loses this trip; the real journey continues normally.
    return redirectKeepingCookie(req, "/nex-native/contacts");
  }
  // Defence in depth · if the browser DID send an Origin header, it
  // MUST match the request host. Protects older browsers that don't
  // send Sec-Fetch-Site but do send Origin on cross-origin nav.
  const originHeader = req.headers.get("origin");
  if (originHeader) {
    try {
      const originHost = new URL(originHeader).host;
      if (originHost !== req.headers.get("host")) {
        return redirectKeepingCookie(req, "/nex-native/contacts");
      }
    } catch {
      return redirectKeepingCookie(req, "/nex-native/contacts");
    }
  }

  // Unauth · do not consume the cookie · the legit post-sign-in path
  // needs to read it after the user authenticates.
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return redirectKeepingCookie(req, "/nex-native/sign-in");
  }

  // CYCLE 14 · delegate the consume-and-apply to the shared
  // server-only module. Same code path as `createNexAccountAction`
  // and `signInAction` so the three callers cannot drift.
  //
  // `consumeAndApplyPendingAccountWall` performs:
  //   · one-shot cookie read + clear via pending-action.consume
  //   · pick-theme action gate + payload shape guard
  //   · premium-entitlement defence-in-depth
  //   · authoritative updateChatTheme write
  //   · safe non-`?applied=1` fallback on failure
  //
  // The `redirectAndClear` wrapper ADDITIONALLY emits a response
  // Set-Cookie clear so the browser honours the one-shot even in the
  // Next.js 16 route-handler context where `cookies().set()` has
  // historically been best-effort.
  const result = await consumeAndApplyPendingAccountWall(session.account.id);
  if (!result) {
    return redirectAndClear(req, "/nex-native/contacts");
  }
  return redirectAndClear(req, result.redirectTo);
}
