// src/lib/nex-native/auth/google-oauth.ts
//
// NEX Google OAuth · pure decision helpers.
// Authored 2026-11-19 · Prompt-7 round 3 (owner-authorised local
// implementation · provider enablement + client-id + redirect-URL
// configuration remain BLOCKED and must be set by the operator before
// any live journey is attempted).
//
// Why this module is pure
// -----------------------------------------------------------------
// The callback-route I/O (code exchange, cookie writes, signOut,
// account lookup, redirect) is NOT the hard part. The hard part is
// deciding what should happen for each (provider-outcome · prelaunch-
// state · founder-flag · account-exists · linking-conflict · return-
// path) combination. Keeping the decision in a pure function means:
//   · the entire decision tree is offline-testable with no network, no
//     Supabase client, and no Next.js runtime boundary mocking.
//   · a regression in the decision tree fails a unit test, not a live
//     login attempt.
//   · the route handler becomes a thin "perform the outcome" shell
//     with no branching of its own.
//
// Safety contract (owner-sealed 2026-11-19 r3)
// -----------------------------------------------------------------
//   · Redirects honour SAFE return paths only: same-origin, relative,
//     starting with `/nex-native/`, max 1024 chars, no `//` or `\`,
//     no CR/LF. Anything else falls back to the default landing.
//   · Prelaunch gate: when the flag is on AND the authenticated UID
//     is NOT a founder, the outcome is ALWAYS `signout_then_redirect`
//     to `/nexcorner`. A non-founder Google identity CANNOT reach any
//     NEX-native surface while the flag is on.
//   · Safe account linking: when the caller indicates a collision
//     between the Google identity and an unrelated password-only
//     account (same email, different supabase_user_id), the outcome
//     is `signout_then_redirect` to sign-in with a recoverable error
//     banner. We NEVER call a linking API from app code; linking is
//     Supabase-provider policy.
//   · Honest error surfaces: provider_error and code_exchange_failed
//     outcomes land on `/nex-native/sign-in?e=<code>&m=<msg>` so the
//     user sees a recoverable state, not a false success.

const DEFAULT_NEW_USER_LANDING = "/nex-native/welcome";
const DEFAULT_RETURNING_USER_LANDING = "/nex-native/contacts";
const PRELAUNCH_REDIRECT = "/nexcorner";
const SIGN_IN_PATH = "/nex-native/sign-in";

export const GOOGLE_OAUTH_CALLBACK_PATH = "/nex-native/auth/callback";

/**
 * Pure, same-origin-only path sanitiser for OAuth `next=` parameters.
 * A pass here is a STRONG claim that the value is safe to redirect to
 * without hitting an open-redirect vulnerability.
 *
 * Rules (identical doctrine to `safeNext` in sign-in/page.tsx):
 *   · must be a non-empty string
 *   · must start with `/nex-native/` (same app + known lane)
 *   · must NOT contain `//`, `\`, CR, or LF
 *   · must NOT be longer than 1024 chars
 *   · must NOT be a scheme (absolute URLs are rejected by the
 *     leading-slash requirement and the `//` check)
 */
export function sanitiseOAuthReturnPath(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > 1024) return null;
  if (!raw.startsWith("/nex-native/")) return null;
  if (raw.includes("//")) return null;
  if (raw.includes("\\")) return null;
  if (raw.includes("\n") || raw.includes("\r")) return null;
  return raw;
}

/**
 * Compose the `redirectTo` URL that gets handed to Supabase at the
 * start of the OAuth flow. Supabase will append `?code=...` and bring
 * the user back to this URL after Google consent. The optional `next`
 * parameter is embedded so the callback knows where to land after a
 * successful exchange.
 *
 * `origin` must already be a well-formed `scheme://host[:port]` with
 * no trailing slash and no path. The caller derives it from request
 * headers (see originFromRequest in the route handler).
 */
export function buildGoogleOAuthRedirectUrl(
  origin: string,
  nextSanitised: string | null,
): string {
  const base = `${origin}${GOOGLE_OAUTH_CALLBACK_PATH}`;
  if (!nextSanitised) return base;
  const q = new URLSearchParams({ next: nextSanitised });
  return `${base}?${q.toString()}`;
}

// ---------------------------------------------------------------------------
// Callback decision model
// ---------------------------------------------------------------------------

export type CallbackInput =
  // Provider redirected back with `?error=...` (user cancelled consent,
  // provider rejected, or admin disabled the provider).
  | {
      kind: "provider_error";
      error: string;
      errorDescription?: string | null;
    }
  // We reached the callback with a `code` but Supabase rejected the
  // exchange (expired, replayed, misconfigured client, network).
  | { kind: "code_exchange_failed"; reason: string }
  // Code exchange succeeded · cookies set · we know who the user is.
  | {
      kind: "code_exchange_ok";
      supabaseUserId: string;
      email: string | null;
      // Is this user already tied to a nex_account row? (Returning
      // user path when true; new user path when false.)
      hasExistingAccount: boolean;
      // True iff the authenticated Google identity collides with a
      // pre-existing password-only auth.users row for the SAME email
      // but a DIFFERENT supabase_user_id. Caller computes this by
      // comparing user.identities against a lookup in nex_account.
      // False in the overwhelming majority of flows.
      providerEmailCollidesWithUnlinkedAccount: boolean;
      prelaunchOn: boolean;
      isFounder: boolean;
      nextPathSanitised: string | null;
    };

export type CallbackOutcome =
  // Normal success · redirect to the given same-origin path.
  | { kind: "redirect"; path: string }
  // Must call supabase.auth.signOut() to drop the cookies we just set
  // BEFORE redirecting. Used for gate-denied + unsafe-linking paths.
  | {
      kind: "signout_then_redirect";
      path: string;
      reason:
        | "non_founder_during_prelaunch"
        | "unsafe_linking_refused";
    }
  // User-recoverable error · redirects to sign-in with a banner.
  | {
      kind: "error_redirect";
      signInErrorCode:
        | "oauth_cancelled"
        | "oauth_provider_error"
        | "oauth_exchange_failed";
      message: string;
    };

/**
 * The entire callback-route decision tree, offline-testable.
 * The route handler calls this with inputs it has already resolved,
 * then performs the outcome's I/O (redirect / signOut / error banner).
 *
 * Order of evaluation matters: safety checks take precedence over
 * preference-level decisions (e.g. a non-founder during prelaunch is
 * signed out even if they had a valid `next` path).
 */
export function decideCallbackOutcome(input: CallbackInput): CallbackOutcome {
  // 1) Provider-reported error (user cancelled or provider rejected).
  //    Treat the common Google `access_denied` as "cancelled" — this
  //    is the user tapping Cancel on the consent screen.
  if (input.kind === "provider_error") {
    if (input.error === "access_denied") {
      return {
        kind: "error_redirect",
        signInErrorCode: "oauth_cancelled",
        message:
          "Google sign-in was cancelled · nothing was signed in · try again any time.",
      };
    }
    return {
      kind: "error_redirect",
      signInErrorCode: "oauth_provider_error",
      message:
        `Google reported an error while signing in: ${input.errorDescription || input.error}. Please try again or sign in with your email and password.`,
    };
  }

  // 2) Code exchange failed (expired code, replayed, misconfigured
  //    client, Supabase outage). Recoverable: back to sign-in.
  if (input.kind === "code_exchange_failed") {
    return {
      kind: "error_redirect",
      signInErrorCode: "oauth_exchange_failed",
      message:
        `We couldn't finish the Google sign-in: ${input.reason}. Please try again.`,
    };
  }

  // From here on: code_exchange_ok.
  // 3) Prelaunch gate · HIGHEST PRIORITY after exchange succeeds.
  //    A non-founder Google identity must be signed OUT before any
  //    NEX-native surface is reachable. The exchange already wrote
  //    cookies; signout_then_redirect clears them.
  if (input.prelaunchOn && !input.isFounder) {
    return {
      kind: "signout_then_redirect",
      path: PRELAUNCH_REDIRECT,
      reason: "non_founder_during_prelaunch",
    };
  }

  // 4) Safe-linking refusal. If the Google identity's email collides
  //    with an UNRELATED existing password-only account, do NOT merge.
  //    Sign the user out (we accidentally created / resumed a
  //    half-state via exchange) and send them back to sign-in with a
  //    recoverable message. The operator can enable Supabase identity
  //    linking server-side if they want this to auto-merge.
  if (input.providerEmailCollidesWithUnlinkedAccount) {
    return {
      kind: "signout_then_redirect",
      path:
        `${SIGN_IN_PATH}?e=oauth_linking_refused&m=${encodeURIComponent(
          "This Google account's email is already linked to a password account. Please sign in with your email + password, then connect Google from account settings.",
        )}`,
      reason: "unsafe_linking_refused",
    };
  }

  // 5) Success · pick destination.
  //    · Returning users: honour `next` when provided, else contacts.
  //    · New users: force onboarding regardless of `next` so no first-
  //      time user ever lands in the middle of a deep-link they haven't
  //      finished account setup for.
  if (input.hasExistingAccount) {
    return {
      kind: "redirect",
      path: input.nextPathSanitised ?? DEFAULT_RETURNING_USER_LANDING,
    };
  }
  return { kind: "redirect", path: DEFAULT_NEW_USER_LANDING };
}

// ---------------------------------------------------------------------------
// Sign-out decision (pure)
// ---------------------------------------------------------------------------

/**
 * Where sign-out should land the user. Owner directive: sign-out
 * ALWAYS returns to the normal sign-in surface so the user re-enters
 * through the normal gate. During prelaunch, sign-in is still
 * allowlisted (see allowlist.ts), so this path is reachable; the
 * public gate remains enforced (typing an email there grants NO
 * access, and the signup action is server-guarded).
 */
export function decideSignOutRedirect(): string {
  return SIGN_IN_PATH;
}

// ---------------------------------------------------------------------------
// Constants · exposed for tests + for the sign-in page UI
// ---------------------------------------------------------------------------

export const GOOGLE_OAUTH_CONSTANTS = Object.freeze({
  DEFAULT_NEW_USER_LANDING,
  DEFAULT_RETURNING_USER_LANDING,
  PRELAUNCH_REDIRECT,
  SIGN_IN_PATH,
  GOOGLE_OAUTH_CALLBACK_PATH,
});
