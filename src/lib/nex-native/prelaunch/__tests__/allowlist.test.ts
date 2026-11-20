// src/lib/nex-native/prelaunch/__tests__/allowlist.test.ts
//
// Authored 2026-11-18 · NEX prelaunch · public path allowlist tests.

import { describe, expect, it } from "vitest";
import {
  isPrelaunchPublicApi,
  isPrelaunchPublicPath,
  listPublicAllowlistSnapshot,
} from "../allowlist";

describe("isPrelaunchPublicPath", () => {
  it("returns false for non-string / empty input", () => {
    // @ts-expect-error — defensive
    expect(isPrelaunchPublicPath(undefined)).toBe(false);
    // @ts-expect-error — defensive
    expect(isPrelaunchPublicPath(null)).toBe(false);
    expect(isPrelaunchPublicPath("")).toBe(false);
  });

  it("matches exact-public paths", () => {
    expect(isPrelaunchPublicPath("/")).toBe(true);
    expect(isPrelaunchPublicPath("/nexcorner")).toBe(true);
    expect(isPrelaunchPublicPath("/nex-native/privacy")).toBe(true);
    expect(isPrelaunchPublicPath("/nex-native/terms")).toBe(true);
    expect(isPrelaunchPublicPath("/robots.txt")).toBe(true);
    expect(isPrelaunchPublicPath("/sitemap.xml")).toBe(true);
    expect(isPrelaunchPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isPrelaunchPublicPath("/nex-manifest.json")).toBe(true);
    expect(isPrelaunchPublicPath("/favicon.ico")).toBe(true);
    expect(isPrelaunchPublicPath("/apple-touch-icon.png")).toBe(true);
    expect(isPrelaunchPublicPath("/favicon-16.png")).toBe(true);
    expect(isPrelaunchPublicPath("/favicon-32.png")).toBe(true);
  });

  // 2026-11-19 · Prompt-7 round 2 · owner-stated access-policy.
  // The sign-in surface is allowlisted during prelaunch so a signed-
  // OUT founder has a re-entry path. Authentication remains the gate
  // check (typing an email in the public form grants NO access);
  // createNexAccountAction carries a companion server-side guard
  // that refuses non-founder signups while the flag is on.
  it("allowlists the sign-in re-entry surfaces (owner-stated 2026-11-19)", () => {
    expect(isPrelaunchPublicPath("/nex-native/sign-in")).toBe(true);
    expect(isPrelaunchPublicPath("/nex-native/sign-in/forgot")).toBe(true);
    expect(isPrelaunchPublicPath("/nex-native/sign-in/new-password")).toBe(true);
  });

  // 2026-11-19 · Prompt-7 round 3 · Google OAuth + email-confirmation
  // callbacks. Middleware MUST let anonymous inbound hits through so
  // the route handlers can run the authoritative gate (signOut +
  // redirect for non-founder; honest error banners for provider
  // errors or cancellations). Owner-sealed 2026-11-19 r3.
  it("allowlists the OAuth and email-confirmation callback routes (owner-authorised 2026-11-19 r3)", () => {
    expect(isPrelaunchPublicPath("/nex-native/auth/callback")).toBe(true);
    expect(isPrelaunchPublicPath("/nex-native/auth/confirm")).toBe(true);
  });

  it("does NOT allowlist arbitrary /nex-native/auth/* paths", () => {
    // Defence-in-depth: only the two named callbacks are allowlisted;
    // a future /nex-native/auth/anything-else is NOT reachable anon.
    expect(isPrelaunchPublicPath("/nex-native/auth/other")).toBe(false);
    expect(isPrelaunchPublicPath("/nex-native/auth/callback/extra")).toBe(
      false,
    );
  });

  it("matches /nexcorner/ prefix family", () => {
    expect(isPrelaunchPublicPath("/nexcorner/anything")).toBe(true);
    expect(isPrelaunchPublicPath("/nexcorner/launch/thank-you")).toBe(true);
  });

  it("matches buying-guides prefix family", () => {
    expect(isPrelaunchPublicPath("/nex-generated/buying-guides")).toBe(true);
    expect(
      isPrelaunchPublicPath("/nex-generated/buying-guides/outdoor-table"),
    ).toBe(true);
  });

  it("matches framework asset prefixes", () => {
    expect(isPrelaunchPublicPath("/_next/static/chunks/main.js")).toBe(true);
    expect(isPrelaunchPublicPath("/icons/app-192.png")).toBe(true);
  });

  it("does NOT match /nex-corner (hyphenated near-miss) against /nexcorner", () => {
    // trailing-slash prefix guard
    expect(isPrelaunchPublicPath("/nex-corner")).toBe(false);
    expect(isPrelaunchPublicPath("/nex-corner/anything")).toBe(false);
  });

  it("rejects private surfaces", () => {
    expect(isPrelaunchPublicPath("/nex-native/home")).toBe(false);
    expect(isPrelaunchPublicPath("/nex-native/contacts")).toBe(false);
    expect(isPrelaunchPublicPath("/nex-native/manage/shop/start")).toBe(false);
    // 2026-11-19 · /nex-native/sign-in is now allowlisted per owner
    // access-policy; see the preceding re-entry test. Other private
    // routes remain denied.
    expect(isPrelaunchPublicPath("/nex-native/manage/shop")).toBe(false);
    expect(isPrelaunchPublicPath("/directory")).toBe(false);
    expect(isPrelaunchPublicPath("/chat-themes-library")).toBe(false);
  });

  it("normalises missing leading slash", () => {
    expect(isPrelaunchPublicPath("nexcorner")).toBe(true);
    expect(isPrelaunchPublicPath("robots.txt")).toBe(true);
  });
});

describe("isPrelaunchPublicApi", () => {
  it("returns false for non-string / empty", () => {
    expect(isPrelaunchPublicApi("")).toBe(false);
  });

  it("allows only the launch-notify endpoint", () => {
    expect(isPrelaunchPublicApi("/api/nex-native/prelaunch/notify")).toBe(true);
  });

  it("rejects every other API path", () => {
    expect(isPrelaunchPublicApi("/api/nex-native/anything-else")).toBe(false);
    expect(isPrelaunchPublicApi("/api/nex-native/prelaunch/notify/extra")).toBe(
      false,
    );
    expect(isPrelaunchPublicApi("/api/nex-native/directory/list")).toBe(false);
    expect(isPrelaunchPublicApi("/api/nex-native/auth/session")).toBe(false);
  });
});

describe("listPublicAllowlistSnapshot", () => {
  it("returns a stable snapshot shape", () => {
    const snap = listPublicAllowlistSnapshot();
    expect(Array.isArray(snap.exactPaths)).toBe(true);
    expect(Array.isArray(snap.prefixPaths)).toBe(true);
    expect(Array.isArray(snap.exactApis)).toBe(true);
    expect(snap.exactPaths).toContain("/nexcorner");
    expect(snap.prefixPaths).toContain("/nexcorner/");
    expect(snap.exactApis).toContain("/api/nex-native/prelaunch/notify");
  });
});
