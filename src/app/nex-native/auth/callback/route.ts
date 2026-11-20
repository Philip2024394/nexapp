// src/app/nex-native/auth/callback/route.ts
//
// NEX Google OAuth callback.
// Authored 2026-11-19 · Prompt-7 round 3. Owner-authorised local
// implementation. Provider enablement + client-id + redirect-URL
// configuration remain BLOCKED on the operator side. Until those are
// set, the pure helpers still refuse unsafe paths and the live
// journey simply surfaces an honest error banner.
//
// What this route does
// -----------------------------------------------------------------
//   1. Reads `?code=&next=&error=&error_description=` from the URL.
//   2. If `error` is present → no exchange is attempted; we surface
//      the error honestly via sign-in banner (cancel vs provider).
//   3. If `code` is present:
//      a. Exchange via `supabase.auth.exchangeCodeForSession` using
//         the SSR client so cookies land on the response.
//      b. Resolve the authenticated user directly via
//         `supabase.auth.getUser()` — DO NOT call
//         `resolveNexAppSessionFromContext()` yet, because it would
//         AUTO-CREATE a nex_account row before we've run the
//         prelaunch gate. Account provisioning happens AFTER the
//         gate allows the user through.
//      c. Check prelaunch gate: non-founder → signOut() + redirect
//         to /nexcorner. This clears the cookies the exchange just
//         set, so the non-founder is left in a fully-signed-out
//         state as if they had never attempted.
//      d. Look up nex_account by supabase_user_id to decide new-vs-
//         returning. For a new founder, provisioning still happens
//         downstream (resolveNexAppSessionFromContext on the landing
//         page) — this route stays lookup-only.
//      e. Hand the resolved state to decideCallbackOutcome and
//         perform the returned outcome.
//
// Safety contract
// -----------------------------------------------------------------
//   · ALL redirects use same-origin paths. Open-redirect protection
//     lives in sanitiseOAuthReturnPath.
//   · Prelaunch gate denial ALWAYS calls signOut() before redirect.
//   · This route NEVER calls a linking API (no updateUser / linkIdentity).
//     If the provider's identity collides with an unlinked password
//     account, the Supabase exchange itself surfaces the conflict and
//     we route to a recoverable banner.

import { NextResponse, type NextRequest } from "next/server";
import { nexAppSsrServerClient } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import {
  isFounderUid,
  isPrelaunchModeOn,
} from "@/lib/nex-native/prelaunch/feature-flag";
import {
  decideCallbackOutcome,
  sanitiseOAuthReturnPath,
  type CallbackInput,
} from "@/lib/nex-native/auth/google-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function errorBannerRedirect(
  origin: string,
  code: string,
  message: string,
): NextResponse {
  const qs = new URLSearchParams({ e: code, m: message });
  return NextResponse.redirect(
    new URL(`${origin}/nex-native/sign-in?${qs.toString()}`),
    { status: 303 },
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const origin = originFromRequest(req);
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const rawNext = url.searchParams.get("next");
  const nextSafe = sanitiseOAuthReturnPath(rawNext);

  // 1) Provider-reported error (user cancelled or provider rejected).
  if (errorParam) {
    const outcome = decideCallbackOutcome({
      kind: "provider_error",
      error: errorParam,
      errorDescription,
    } satisfies CallbackInput);
    if (outcome.kind === "error_redirect") {
      return errorBannerRedirect(origin, outcome.signInErrorCode, outcome.message);
    }
    // Defensive: a non-error outcome here would be a bug in
    // decideCallbackOutcome. Fall through to a generic failure.
    return errorBannerRedirect(
      origin,
      "oauth_provider_error",
      errorDescription || errorParam,
    );
  }

  // 2) Missing code AND no error → someone visited the callback by
  //    hand or Supabase misconfigured the redirect. Honest surface.
  if (!code) {
    return errorBannerRedirect(
      origin,
      "oauth_exchange_failed",
      "The sign-in link was missing its code. Please try again.",
    );
  }

  // 3) Exchange code for session.
  const supabase = await nexAppSsrServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );
  if (exchangeError) {
    const outcome = decideCallbackOutcome({
      kind: "code_exchange_failed",
      reason: exchangeError.message,
    });
    if (outcome.kind === "error_redirect") {
      return errorBannerRedirect(origin, outcome.signInErrorCode, outcome.message);
    }
    return errorBannerRedirect(
      origin,
      "oauth_exchange_failed",
      exchangeError.message,
    );
  }

  // 4) Resolve the authenticated user WITHOUT triggering account
  //    auto-provision (do not call resolveNexAppSessionFromContext
  //    before the prelaunch gate decision).
  const { data: userData, error: getUserError } = await supabase.auth.getUser();
  if (getUserError || !userData?.user) {
    await supabase.auth.signOut();
    return errorBannerRedirect(
      origin,
      "oauth_exchange_failed",
      getUserError?.message || "Signed-in user could not be read.",
    );
  }

  const authedUid = userData.user.id;
  const authedEmail = userData.user.email ?? null;

  // 5) Lookup-only account resolution. No auto-create here.
  const existingAccount = await accountService
    .getAccountBySupabaseUserId(authedUid)
    .catch(() => null);

  // 6) Decide.
  //    providerEmailCollidesWithUnlinkedAccount: we leave this as
  //    `false` in the overwhelming case. Supabase's own exchange
  //    error surface handles the collision — if Supabase's identity-
  //    linking policy allows auto-merge on a verified email match,
  //    the exchange succeeds and we honour it; if it refuses, we
  //    already landed in the exchangeError branch above. We do NOT
  //    compute collision ourselves to avoid a false-positive refusal
  //    on a legitimate same-user Google linking.
  const outcome = decideCallbackOutcome({
    kind: "code_exchange_ok",
    supabaseUserId: authedUid,
    email: authedEmail,
    hasExistingAccount: Boolean(existingAccount),
    providerEmailCollidesWithUnlinkedAccount: false,
    prelaunchOn: isPrelaunchModeOn(),
    isFounder: isFounderUid(authedUid),
    nextPathSanitised: nextSafe,
  });

  // 7) Perform outcome.
  if (outcome.kind === "signout_then_redirect") {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL(`${origin}${outcome.path}`), {
      status: 303,
    });
  }
  if (outcome.kind === "error_redirect") {
    return errorBannerRedirect(origin, outcome.signInErrorCode, outcome.message);
  }
  return NextResponse.redirect(new URL(`${origin}${outcome.path}`), {
    status: 303,
  });
}
