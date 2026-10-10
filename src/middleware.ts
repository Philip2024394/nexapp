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
  const refreshed = await refreshNexAuthSession(req, base);
  return attachCid(refreshed, cid);
}
