// NEX app · edge middleware
//
// Scope narrowed from the sealed D:/trades multi-product source:
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

export const config = {
  matcher: ["/nex-native/:path*", "/nex", "/nex/:path*"],
};

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
  const cid = resolveCorrelationId(req);
  const pathname = req.nextUrl.pathname;

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
