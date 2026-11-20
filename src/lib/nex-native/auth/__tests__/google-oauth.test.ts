// src/lib/nex-native/auth/__tests__/google-oauth.test.ts
//
// Pure-decision tests for the Google OAuth helpers.
// Authored 2026-11-19 · Prompt-7 round 3.
//
// Scope: offline, pure, NO network, NO Supabase client created.
// These tests exercise every branch of decideCallbackOutcome +
// sanitiseOAuthReturnPath + buildGoogleOAuthRedirectUrl +
// decideSignOutRedirect. Live provider flow is NOT exercised and
// remains BLOCKED/UNVERIFIED until the operator enables Google on
// the Supabase project, sets the client ID + secret, and registers
// the authorised redirect URL.

import { describe, expect, it } from "vitest";
import {
  buildGoogleOAuthRedirectUrl,
  decideCallbackOutcome,
  decideSignOutRedirect,
  GOOGLE_OAUTH_CALLBACK_PATH,
  GOOGLE_OAUTH_CONSTANTS,
  sanitiseOAuthReturnPath,
  type CallbackInput,
} from "../google-oauth";

const BASE_OK: Extract<CallbackInput, { kind: "code_exchange_ok" }> = {
  kind: "code_exchange_ok",
  supabaseUserId: "00000000-0000-0000-0000-000000000001",
  email: "user@example.com",
  hasExistingAccount: true,
  providerEmailCollidesWithUnlinkedAccount: false,
  prelaunchOn: false,
  isFounder: false,
  nextPathSanitised: null,
};

describe("sanitiseOAuthReturnPath", () => {
  it("rejects non-string, empty, and overlong values", () => {
    expect(sanitiseOAuthReturnPath(null)).toBe(null);
    expect(sanitiseOAuthReturnPath(undefined)).toBe(null);
    expect(sanitiseOAuthReturnPath("")).toBe(null);
    expect(sanitiseOAuthReturnPath("/nex-native/" + "a".repeat(2000))).toBe(
      null,
    );
  });

  it("rejects paths outside the /nex-native/ lane", () => {
    expect(sanitiseOAuthReturnPath("/")).toBe(null);
    expect(sanitiseOAuthReturnPath("/nexcorner")).toBe(null);
    expect(sanitiseOAuthReturnPath("/api/foo")).toBe(null);
    expect(sanitiseOAuthReturnPath("nex-native/contacts")).toBe(null);
  });

  it("rejects obvious open-redirect shapes", () => {
    // Scheme-relative open redirect
    expect(sanitiseOAuthReturnPath("//evil.example/x")).toBe(null);
    // Absolute URL
    expect(sanitiseOAuthReturnPath("https://evil.example/x")).toBe(null);
    // Backslash tricks
    expect(sanitiseOAuthReturnPath("/nex-native/\\evil")).toBe(null);
    // Protocol-relative inside an otherwise-valid-looking path
    expect(sanitiseOAuthReturnPath("/nex-native//evil")).toBe(null);
    // CR/LF injection (header smuggling)
    expect(sanitiseOAuthReturnPath("/nex-native/contacts\r\nX-Evil:1")).toBe(
      null,
    );
    expect(sanitiseOAuthReturnPath("/nex-native/contacts\nfoo")).toBe(null);
  });

  it("accepts clean same-origin /nex-native/* paths", () => {
    expect(sanitiseOAuthReturnPath("/nex-native/contacts")).toBe(
      "/nex-native/contacts",
    );
    expect(
      sanitiseOAuthReturnPath("/nex-native/manage/shop/start"),
    ).toBe("/nex-native/manage/shop/start");
    // Query strings are allowed — the dest uses them as-is.
    expect(
      sanitiseOAuthReturnPath("/nex-native/contacts?welcome=1"),
    ).toBe("/nex-native/contacts?welcome=1");
  });
});

describe("buildGoogleOAuthRedirectUrl", () => {
  it("returns the bare callback URL when next is null", () => {
    expect(
      buildGoogleOAuthRedirectUrl("https://nexcorner.com", null),
    ).toBe(`https://nexcorner.com${GOOGLE_OAUTH_CALLBACK_PATH}`);
  });

  it("embeds a sanitised next as ?next=... url-encoded", () => {
    const u = buildGoogleOAuthRedirectUrl(
      "https://nexcorner.com",
      "/nex-native/contacts?welcome=1",
    );
    // URLSearchParams always encodes `?` and `=` inside the value.
    expect(u).toBe(
      `https://nexcorner.com${GOOGLE_OAUTH_CALLBACK_PATH}?next=%2Fnex-native%2Fcontacts%3Fwelcome%3D1`,
    );
  });

  it("does not add a trailing slash when origin has none", () => {
    const u = buildGoogleOAuthRedirectUrl("http://localhost:3008", null);
    expect(u).toBe(`http://localhost:3008${GOOGLE_OAUTH_CALLBACK_PATH}`);
  });
});

describe("decideCallbackOutcome · provider-error branch", () => {
  it("treats Google's access_denied as a user cancellation", () => {
    const out = decideCallbackOutcome({
      kind: "provider_error",
      error: "access_denied",
      errorDescription: "The user denied the request.",
    });
    expect(out.kind).toBe("error_redirect");
    if (out.kind === "error_redirect") {
      expect(out.signInErrorCode).toBe("oauth_cancelled");
      expect(out.message).toMatch(/cancelled/i);
    }
  });

  it("surfaces any other provider error honestly, not as success", () => {
    const out = decideCallbackOutcome({
      kind: "provider_error",
      error: "server_error",
      errorDescription: "Internal error",
    });
    expect(out.kind).toBe("error_redirect");
    if (out.kind === "error_redirect") {
      expect(out.signInErrorCode).toBe("oauth_provider_error");
      expect(out.message).toContain("Internal error");
    }
  });
});

describe("decideCallbackOutcome · exchange-failure branch", () => {
  it("routes to sign-in with a recoverable banner", () => {
    const out = decideCallbackOutcome({
      kind: "code_exchange_failed",
      reason: "expired token",
    });
    expect(out.kind).toBe("error_redirect");
    if (out.kind === "error_redirect") {
      expect(out.signInErrorCode).toBe("oauth_exchange_failed");
      expect(out.message).toContain("expired token");
    }
  });
});

describe("decideCallbackOutcome · prelaunch gate", () => {
  it("signs out a non-founder Google identity during prelaunch", () => {
    const out = decideCallbackOutcome({
      ...BASE_OK,
      prelaunchOn: true,
      isFounder: false,
      // Even when the user has a valid account + a safe next, the
      // prelaunch gate wins.
      hasExistingAccount: true,
      nextPathSanitised: "/nex-native/contacts",
    });
    expect(out.kind).toBe("signout_then_redirect");
    if (out.kind === "signout_then_redirect") {
      expect(out.reason).toBe("non_founder_during_prelaunch");
      expect(out.path).toBe(GOOGLE_OAUTH_CONSTANTS.PRELAUNCH_REDIRECT);
    }
  });

  it("allows a founder Google identity during prelaunch", () => {
    const out = decideCallbackOutcome({
      ...BASE_OK,
      prelaunchOn: true,
      isFounder: true,
    });
    expect(out.kind).toBe("redirect");
  });
});

describe("decideCallbackOutcome · safe linking refusal", () => {
  it("refuses an unsafe email-collision auto-merge by signing out", () => {
    const out = decideCallbackOutcome({
      ...BASE_OK,
      providerEmailCollidesWithUnlinkedAccount: true,
    });
    expect(out.kind).toBe("signout_then_redirect");
    if (out.kind === "signout_then_redirect") {
      expect(out.reason).toBe("unsafe_linking_refused");
      expect(out.path).toMatch(/^\/nex-native\/sign-in\?e=oauth_linking_refused/);
      // The user-visible message explains the next step.
      expect(decodeURIComponent(out.path)).toContain(
        "email + password",
      );
    }
  });

  it("prelaunch gate wins over linking refusal if both apply", () => {
    // Defence-in-depth check: if both conditions are true (e.g. a
    // non-founder with a colliding email), the prelaunch denial fires
    // first — we must never expose the linking-refused page to a
    // non-founder because that path is sign-in-based which is public.
    const out = decideCallbackOutcome({
      ...BASE_OK,
      prelaunchOn: true,
      isFounder: false,
      providerEmailCollidesWithUnlinkedAccount: true,
    });
    expect(out.kind).toBe("signout_then_redirect");
    if (out.kind === "signout_then_redirect") {
      expect(out.reason).toBe("non_founder_during_prelaunch");
    }
  });
});

describe("decideCallbackOutcome · new-vs-returning routing", () => {
  it("returning user with a sanitised next lands on next", () => {
    const out = decideCallbackOutcome({
      ...BASE_OK,
      hasExistingAccount: true,
      nextPathSanitised: "/nex-native/manage/shop/start",
    });
    expect(out).toEqual({
      kind: "redirect",
      path: "/nex-native/manage/shop/start",
    });
  });

  it("returning user without next lands on the default returning landing", () => {
    const out = decideCallbackOutcome({
      ...BASE_OK,
      hasExistingAccount: true,
      nextPathSanitised: null,
    });
    expect(out).toEqual({
      kind: "redirect",
      path: GOOGLE_OAUTH_CONSTANTS.DEFAULT_RETURNING_USER_LANDING,
    });
  });

  it("new user is sent to onboarding even if `next` was provided", () => {
    // Owner rule: new users go to onboarding. A deep-link next on a
    // first-time sign-in would skip the welcome flow.
    const out = decideCallbackOutcome({
      ...BASE_OK,
      hasExistingAccount: false,
      nextPathSanitised: "/nex-native/manage/shop/start",
    });
    expect(out).toEqual({
      kind: "redirect",
      path: GOOGLE_OAUTH_CONSTANTS.DEFAULT_NEW_USER_LANDING,
    });
  });
});

describe("decideSignOutRedirect", () => {
  it("always returns the sign-in path", () => {
    expect(decideSignOutRedirect()).toBe(
      GOOGLE_OAUTH_CONSTANTS.SIGN_IN_PATH,
    );
  });
});
