// src/app/nex-native/auth/confirm/route.ts
//
// Supabase email-confirmation callback · agreed-journey #1 (Signup →
// email confirmation → sign-in). Owner-authorised engineering pass
// 2026-11-15.
//
// Why a Route Handler (not a Page)
// -----------------------------------------------------------------
// Supabase's `auth.verifyOtp()` must write refreshed session cookies
// so the browser lands on `/contacts` already signed in. In Next.js
// Server Components the `cookies().set()` call is silently dropped,
// so a `page.tsx` calling verifyOtp would appear to succeed in
// Supabase's view but the user would still be unauthenticated. Route
// Handlers run in the same request lifecycle as Server Actions and
// CAN set cookies via the sealed @supabase/ssr `setAll` adapter.
//
// What this route does
// -----------------------------------------------------------------
//   1. Parses `?token_hash=&type=` from the URL · Supabase's standard
//      email-confirmation link format.
//   2. Calls `supabase.auth.verifyOtp({ type, token_hash })` using
//      the sealed `nexAppSsrServerClient` so the resulting session
//      cookies land on the response.
//   3. On success → redirect to `/nex-native/contacts` (owner
//      directive 2026-10-22 default landing after sign-in).
//   4. On failure → redirect to `/nex-native/sign-in` with the
//      sealed `?e=email_confirmation_failed&m=<human message>`
//      banner query that the sign-in page already renders.
//
// Honest limitations
// -----------------------------------------------------------------
//   · We trust Supabase's verifyOtp to validate the hash; we do not
//     re-check expiry or type whitelist here · verifyOtp does both.
//   · `type` accepts the standard Supabase email-flow values ·
//     signup, recovery, invite, magiclink, email_change · a value
//     outside this set is rejected by Supabase and surfaces as
//     verifyOtp error (surfaced honestly to the user).

import { NextResponse, type NextRequest } from "next/server";
import { nexAppSsrServerClient } from "@/lib/nex-native/app/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Supabase's EmailOtpType values · kept aligned with the sealed
// @supabase/ssr types. Unknown values fail verifyOtp and we surface
// the honest error.
type EmailOtpType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email";

const ALLOWED_TYPES: ReadonlySet<EmailOtpType> = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function originFromRequest(req: NextRequest): string {
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (req.nextUrl.protocol || "http:").replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    req.nextUrl.host;
  return `${proto}://${host}`;
}

function failureRedirect(origin: string, message: string): NextResponse {
  const url = new URL(
    `${origin}/nex-native/sign-in?e=email_confirmation_failed&m=${encodeURIComponent(message)}`,
  );
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const origin = originFromRequest(req);
  const url = req.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");
  const nextParam = url.searchParams.get("next");

  if (!tokenHash || !rawType) {
    return failureRedirect(
      origin,
      "The confirmation link is missing its token · please try signing up again.",
    );
  }

  if (!ALLOWED_TYPES.has(rawType as EmailOtpType)) {
    return failureRedirect(
      origin,
      "The confirmation link type is not supported · please try signing up again.",
    );
  }
  const type = rawType as EmailOtpType;

  const supabase = await nexAppSsrServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    // Honest surface · the user sees the Supabase-reported reason
    // (e.g. "Token has expired", "Invalid token") rather than a
    // generic "something went wrong".
    return failureRedirect(origin, error.message);
  }

  // Success · route to the agreed default landing. `next` is honoured
  // only if it stays inside the app's own routes (same safeNext
  // policy as the sign-in page).
  let dest = "/nex-native/contacts";
  if (
    typeof nextParam === "string" &&
    nextParam.startsWith("/nex-native/") &&
    !nextParam.includes("//") &&
    !nextParam.includes("\\") &&
    nextParam.length <= 1024
  ) {
    dest = nextParam;
  }
  return NextResponse.redirect(new URL(`${origin}${dest}`), { status: 303 });
}
