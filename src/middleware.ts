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
  isFounderUid,
  isPrelaunchModeOn,
} from "@/lib/nex-native/prelaunch/feature-flag";

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
    await supabase.auth.getUser();
  } catch {
    /* never block a page render on auth-refresh failure */
  }
  return res;
}

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
      if (!isFounderUid(uid)) {
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

  const base = NextResponse.next();
  // Owner directive 2026-10-18 · P1 · set/extend the directory seed
  // cookie BEFORE auth refresh so both run against the same `base`
  // response. Only touches `/nex-native/directory*` so other routes
  // aren't paying for cookie writes they don't use.
  if (pathname.startsWith("/nex-native/directory")) {
    ensureDirectorySeedCookie(req, base);
  }
  const refreshed = await refreshNexAuthSession(req, base);
  return attachCid(refreshed, cid);
}
