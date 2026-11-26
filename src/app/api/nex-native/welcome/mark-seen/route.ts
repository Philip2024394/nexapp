// src/app/api/nex-native/welcome/mark-seen/route.ts
//
// NEX-024 · L-008 (2026-11-26) · one-time-gate cookie writer.
//
// Why a Route Handler and not middleware:
//   Next.js 16 propagates `NextResponse.cookies.set(...)` back into
//   the CURRENT request's cookie jar for downstream Server Components.
//   Writing the "seen" cookie in middleware on the `/welcome/account-
//   active` request would make the page's `hasSeenAccountActive()`
//   read the middleware's just-written value and redirect every first-
//   ever visitor straight to /contacts (observed defect — SSR HTML
//   carried `<template data-dgst="NEXT_REDIRECT;replace;/nex-native/
//   contacts;307;">` on the first visit). Raw
//   `res.headers.append("set-cookie", ...)` in middleware is silently
//   stripped by Next.js (verified empirically against the dev server).
//
// A Route Handler runs as a separate HTTP transaction, so the
// Set-Cookie it emits lands in the browser without affecting the
// current page SSR. The `WelcomeShell` client component pings this
// endpoint on mount; the browser then has the signed cookie, and the
// NEXT visit to `/welcome/account-active` redirects as intended.
//
// Auth check: requires an authenticated session; anonymous callers
// get 401. This prevents a drive-by POST from stamping the cookie on
// a device that never saw the celebration.
//
// Forgery resistance: the cookie value is HMAC-SHA256-signed with a
// key derived from `NEX_SUPABASE_SERVICE_ROLE_KEY` + a per-purpose
// info string (see `src/lib/nex-native/onboarding/account-active-
// seen.ts`). A JS-set cookie of the same name cannot produce a
// matching signature, so the server treats it as unseen. If the
// signing key is unavailable the handler responds 503 with no
// cookie; the celebration will show again next visit (fail-closed).

import { NextResponse } from "next/server";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  ACCOUNT_ACTIVE_SEEN_COOKIE,
  ACCOUNT_ACTIVE_SEEN_MAX_AGE_SECONDS,
  signAccountActiveSeenValue,
} from "@/lib/nex-native/onboarding/account-active-seen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, {
      status: 401,
    });
  }

  const signed = await signAccountActiveSeenValue();
  if (signed === null) {
    // Signing key unavailable · fail closed. No cookie emitted.
    return NextResponse.json(
      { ok: false, reason: "signing_key_unavailable" },
      { status: 503 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: ACCOUNT_ACTIVE_SEEN_COOKIE,
    value: signed,
    maxAge: ACCOUNT_ACTIVE_SEEN_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res;
}
