// NEX app · edge middleware
//
// legacy marketplace routing (thenetworkers.app host-router, subdomain-
// per-trade rewrite, hammerex custom-domain DB lookup, /tc/* legacy
// redirects, merchant-referral cookie) was intentionally dropped —
// those product surfaces do not live in this fork.
//
// Responsibilities retained:
//   1. CID (correlation ID) header injection on every page response.
//   2. Supabase SSR auth session refresh so users stay signed in across
//      the 1-hour access-token expiry (Server Components cannot write
//      cookies — refresh MUST happen here).
//   3. Canonical /nex-native/home redirect for the legacy /nex and
//      /nex/chat deep-links.
//   4. NEX prelaunch gate · 2026-11-18 · default-OFF via
//      NEX_PRELAUNCH_MODE. When ON, every non-allowlisted path is
//      redirected to /nexcorner (page) or 404'd (API / server action)
//      unless the caller's authenticated Supabase user id is in
//      NEX_PRELAUNCH_FOUNDER_UIDS. The allowlist + flag live in pure
//      modules at src/lib/nex-native/prelaunch/.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
// Owner directive 2026-10-18 · P1 of the discovery system · the
// directory sort seed is a middleware-managed cookie so the order
// stays stable while browsing and shuffles after a real break.
// Server Components can't write cookies in Next 16+ · middleware
// is the correct layer.
import {
  DIRECTORY_SEED_COOKIE,
  DIRECTORY_SEED_MAX_AGE_SECONDS,
  pickOrMintDirectorySeed,
} from "@/lib/nex-native/directory/directory-seed";
// NEX prelaunch gate · default-OFF · 2026-11-18.
// Pure imports only · the three modules below have no I/O and no
// imports from `nexSupabaseAdmin` (which is Node-only).
import {
  isPrelaunchPublicApi,
  isPrelaunchPublicPath,
} from "@/lib/nex-native/prelaunch/allowlist";
import {
  FOUNDER_BYPASS_COOKIE_NAME,
  isFounderUid,
  isPrelaunchModeOn,
  isValidFounderBypassCookie,
} from "@/lib/nex-native/prelaunch/feature-flag";
// G-2 fix (NEX blueprint § 10 · 2026-11-23) · persist a durable
// "known device" marker whenever auth refresh resolves a real user, so
// the splash page can route State D/E to sign-in instead of the theme
// picker. See src/lib/nex-native/app/known-device-cookie.ts for rationale.
import {
  KNOWN_DEVICE_COOKIE,
  KNOWN_DEVICE_MAX_AGE_SECONDS,
  KNOWN_DEVICE_VALUE,
} from "@/lib/nex-native/app/known-device-cookie";
// Owner directive 2026-11-28 · XRATEDBELTS.COM vanity-domain setup.
// Pure imports only · no I/O · safe to run at the Edge. See
// src/lib/nex-native/vanity-domains/ for the host → shop mapping
// and the rewrite decision function.
import { findVanityByHost, isWwwHost } from "@/lib/nex-native/vanity-domains/map";
import { resolveVanityAction } from "@/lib/nex-native/vanity-domains/rewrite-path";
// L-008 (2026-11-26) · the NEX-024 "account-active seen" cookie is
// NOT written in middleware · see the comment block below where the
// handler was removed. The write lives in the Route Handler
// `/api/nex-native/welcome/mark-seen` so Set-Cookie is applied by a
// separate HTTP transaction, avoiding Next.js 16's same-request
// cookie propagation.

// ── CID injection ──────────────────────────────────────────────────
// Edge runtime cannot resolve node:async_hooks even transitively, so
// CID_PATTERN is inlined here instead of imported from
// src/lib/nex/observability/correlation.ts. Regex is identical.

const CID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

function resolveCorrelationId(req: NextRequest): string {
  const inbound = req.headers.get("x-request-id");
  if (typeof inbound === "string" && CID_PATTERN.test(inbound)) {
    return inbound;
  }
  return crypto.randomUUID();
}

function attachCid<T extends NextResponse>(res: T, cid: string): T {
  res.headers.set("x-request-id", cid);
  return res;
}

const BYPASS_PATH_PREFIXES = ["/_next/", "/api/", "/favicon"];

// Matcher expanded 2026-11-18 for the NEX prelaunch gate. When the flag
// is OFF (default) the middleware function body early-exits for paths
// that weren't previously matched, so existing behaviour is unchanged.
// The expansion is required because the gate must inspect pages/APIs
// that live outside /nex-native/* (e.g. /, /directory, /chat-themes-
// library, /api/*). The exclusion keeps Next internals and static
// assets out of middleware execution entirely.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

// Paths the pre-prelaunch middleware already handled. When the gate
// is OFF, any OTHER matched path is early-exited to keep behaviour
// identical to the pre-2026-11-18 build.
function isLegacyMatchedPath(pathname: string): boolean {
  return (
    pathname === "/nex" ||
    pathname === "/nex/chat" ||
    pathname.startsWith("/nex-native/") ||
    pathname.startsWith("/nex/")
  );
}

// Read the authenticated NEX user id via the SSR Supabase client,
// returning null on any error so the gate falls through to the default
// deny path (never fail-open). Reuses the same `createServerClient`
// pattern as `refreshNexAuthSession` below.
async function readAuthedNexUidOrNull(
  req: NextRequest,
): Promise<string | null> {
  const nexUrl =
    process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;
  if (!nexUrl || !anon) return null;
  try {
    const supabase = createServerClient(nexUrl, anon, {
      cookies: {
        getAll() {
          return req.cookies
            .getAll()
            .map((c) => ({ name: c.name, value: c.value }));
        },
        setAll() {
          /* no-op · gate is read-only, no cookie writes */
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function refreshNexAuthSession(
  req: NextRequest,
  res: NextResponse,
): Promise<NextResponse> {
  const nexUrl =
    process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;
  if (!nexUrl || !anon) return res;

  try {
    const supabase = createServerClient(nexUrl, anon, {
      cookies: {
        getAll() {
          return req.cookies
            .getAll()
            .map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(list) {
          for (const c of list) {
            res.cookies.set(c.name, c.value, c.options);
          }
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    // G-2 (NEX blueprint § 10 · 2026-11-23) · refresh the known-device
    // marker on every request that resolves to a real user. The cookie
    // is durable (1 year) and intentionally NOT cleared on sign-out ·
    // the owner's rule is that a signed-out returning user must see
    // sign-in, not the theme picker. Behaviour unchanged for anonymous
    // users (cookie is never set).
    if (data.user) {
      res.cookies.set({
        name: KNOWN_DEVICE_COOKIE,
        value: KNOWN_DEVICE_VALUE,
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        maxAge: KNOWN_DEVICE_MAX_AGE_SECONDS,
        secure: process.env.NODE_ENV === "production",
      });
    }
  } catch {
    /* never block a page render on auth-refresh failure */
  }
  return res;
}

// L-008 (2026-11-26) · NEX-024 one-time-gate cookie writer moved
// OUT of middleware. Next.js 16 propagates `res.cookies.set` back
// into the current request's cookie jar for downstream Server
// Components; writing here would redirect every first-ever visitor
// straight to /contacts (observed defect · <template data-dgst="
// NEXT_REDIRECT;replace;/nex-native/contacts;307;"> in the SSR HTML).
// Raw `res.headers.append("set-cookie", ...)` is silently stripped by
// Next.js middleware (verified empirically). The write is now done
// by the Route Handler at
//   `src/app/api/nex-native/welcome/mark-seen/route.ts`
// which the `WelcomeShell` client component pings on mount. Route
// Handler responses are separate HTTP transactions, so their
// Set-Cookie headers land in the browser without affecting the
// current page's SSR.

/** Owner directive 2026-10-18 · P1 · ensure the directory sort seed
 *  cookie exists and extend its TTL on every directory render. The
 *  cookie is 15 minutes · active browsing keeps the same seed · a
 *  user who leaves and comes back after a longer break gets a fresh
 *  seed and therefore a fresh order (the "world-class discovery"
 *  behaviour sealed in the recommendation). */
function ensureDirectorySeedCookie(
  req: NextRequest,
  res: NextResponse,
): void {
  const existing = req.cookies.get(DIRECTORY_SEED_COOKIE)?.value ?? null;
  const seed = pickOrMintDirectorySeed(existing);
  res.cookies.set({
    name: DIRECTORY_SEED_COOKIE,
    value: seed,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: DIRECTORY_SEED_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const pathname = req.nextUrl.pathname;
  const flagOn = isPrelaunchModeOn();
  const cid = resolveCorrelationId(req);

  // ── Vanity-domain rewrite layer ───────────────────────────────────
  // Owner directive 2026-11-28 · when the request's Host header is a
  // registered vanity domain (e.g. xratedbelts.com), apply host-based
  // routing BEFORE every other decision so the customer sees the
  // vanity URL and the app renders the mapped NEX shop.
  //
  // Decisions:
  //   · www.xratedbelts.com/*  → 308 redirect to xratedbelts.com/*
  //   · xratedbelts.com/       → rewrite to /nex-native/x-rated-tool-belts
  //   · xratedbelts.com/our-story → rewrite to /nex-native/<slug>/our-story
  //   · xratedbelts.com/product/<id> → rewrite to /nex-native/product/<id>
  //   · framework internals and already-internal /nex-native paths
  //     pass through untouched.
  //
  // Rewrites preserve the browser URL (no location change). The
  // CoverThemeSkin + shop route render exactly as if the customer
  // had visited /nex-native/x-rated-tool-belts on the canonical host.
  const hostHeader = req.headers.get("host");
  const vanity = findVanityByHost(hostHeader);
  if (vanity) {
    const action = resolveVanityAction(
      pathname,
      vanity,
      isWwwHost(hostHeader, vanity),
    );
    if (action.kind === "www_redirect") {
      const target = req.nextUrl.clone();
      target.host = action.targetHost;
      // Preserve path + search as-is.
      return attachCid(NextResponse.redirect(target, 308), cid);
    }
    if (action.kind === "rewrite") {
      const target = req.nextUrl.clone();
      target.pathname = action.internalPath;
      // search preserved by clone()
      const rewrite = NextResponse.rewrite(target);
      // Mark the response so downstream can observe vanity context
      // (telemetry, canonical-URL polish). Harmless header for
      // non-vanity requests (never set).
      rewrite.headers.set("x-nex-vanity-host", vanity.host);
      rewrite.headers.set("x-nex-vanity-slug", vanity.shopSlug);
      // Still run the auth-refresh pass so sessions stay valid.
      const refreshed = await refreshNexAuthSession(req, rewrite);
      return attachCid(refreshed, cid);
    }
    // passthrough · fall through to the rest of the pipeline. The
    // auth refresh + CID attach at the end of this function will
    // still run for passthrough responses.
  }

  // Flag OFF · path was not matched by the pre-prelaunch matcher ·
  // return a clean pass-through. 2026-11-20 · route through attachCid
  // so every middleware response carries x-request-id (CADP4 contract) ·
  // the header set is a single map write and does not change behaviour.
  if (!flagOn && !isLegacyMatchedPath(pathname)) {
    return attachCid(NextResponse.next(), cid);
  }

  // ── NEX prelaunch gate ────────────────────────────────────────────
  // Runs BEFORE every other decision when the flag is ON. The two
  // allowlist calls are O(1) set / tiny-array lookups. Founder bypass
  // is a Supabase getUser() + env-list membership check.
  if (flagOn) {
    const pathAllowed = isPrelaunchPublicPath(pathname);
    const apiAllowed = isPrelaunchPublicApi(pathname);
    if (!pathAllowed && !apiAllowed) {
      const uid = await readAuthedNexUidOrNull(req);
      // Option B founder-email bypass · owner-sealed 2026-11-21.
      // When a visitor submits the founder email in the Nexcorner
      // notify form, the server action sets an opaque-token cookie;
      // middleware honours that cookie here as a UID-equivalent pass.
      // DELIBERATELY WEAKER than UID-based gate · owner acknowledged.
      const bypassCookie =
        req.cookies.get(FOUNDER_BYPASS_COOKIE_NAME)?.value ?? null;
      const bypassViaEmailCookie = isValidFounderBypassCookie(bypassCookie);
      if (!isFounderUid(uid) && !bypassViaEmailCookie) {
        const isApi = pathname.startsWith("/api/");
        // RSC server actions arrive as POST to the containing page
        // path with a `next-action` request header. Those paths are
        // not on the public allowlist, so the request would otherwise
        // be 302-redirected and the action body would be dropped.
        // 404 them instead · same shape as an unknown API.
        const isServerAction = req.headers.get("next-action") !== null;
        if (isApi || isServerAction) {
          return attachCid(
            new NextResponse("Not Found", { status: 404 }),
            cid,
          );
        }
        const target = req.nextUrl.clone();
        target.pathname = "/nexcorner";
        target.search = "";
        return attachCid(NextResponse.redirect(target, 302), cid);
      }
    }
  }

  for (const prefix of BYPASS_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return attachCid(NextResponse.next(), cid);
    }
  }

  if (pathname === "/nex" || pathname === "/nex/chat") {
    const target = req.nextUrl.clone();
    target.pathname = "/nex-native/home";
    return attachCid(NextResponse.redirect(target, 302), cid);
  }

  // Owner directive 2026-11-24 (Stage A Remediation Cycle 3) · retired
  // chat hub. `src/app/nex-native/chat/page.tsx` already calls
  // `redirect("/nex-native/contacts")`, but Next.js 16's parent-layout
  // RSC streaming commits response headers before the page's
  // `redirect()` resolves, so Next falls back to an HTML 200 with a
  // `<meta http-equiv="refresh">` payload rather than emitting a true
  // HTTP 307. Founder prefers a genuine server-side 307, so we emit
  // it here at the edge before any streaming begins. Exact match only:
  //   ·  /nex-native/chat/peer/[accountId]  — unchanged
  //   ·  /nex-native/chat/inbox             — unchanged
  //   ·  /nex-native/chat/preview/*         — unchanged
  //   ·  /nex-native/chat/prototypes/*      — unchanged
  //   ·  /nex-native/chat/guest/*           — unchanged
  //   ·  /nex-native/chat/first-visit/*     — unchanged
  // Legitimate query parameters on the hub URL are preserved via the
  // nextUrl clone.
  if (pathname === "/nex-native/chat") {
    const target = req.nextUrl.clone();
    target.pathname = "/nex-native/contacts";
    return attachCid(NextResponse.redirect(target, 307), cid);
  }

  const base = NextResponse.next();
  // Owner directive 2026-10-18 · P1 · set/extend the directory seed
  // cookie BEFORE auth refresh so both run against the same `base`
  // response. Only touches `/nex-native/directory*` so other routes
  // aren't paying for cookie writes they don't use.
  if (pathname.startsWith("/nex-native/directory")) {
    ensureDirectorySeedCookie(req, base);
  }
  // L-008 (2026-11-26) · set the NEX-024 one-time-gate cookie here
  // because Next.js 16 Server Components cannot write cookies. Exact
  // L-008 (2026-11-26) · the one-time-gate cookie write was moved to
  // the Route Handler `/api/nex-native/welcome/mark-seen` to escape
  // the middleware cookie-propagation pitfall. Nothing to do here.
  const refreshed = await refreshNexAuthSession(req, base);
  return attachCid(refreshed, cid);
}
