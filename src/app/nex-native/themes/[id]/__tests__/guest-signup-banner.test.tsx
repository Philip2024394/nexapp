// src/app/nex-native/themes/[id]/__tests__/guest-signup-banner.test.tsx
//
// Cycle-14 F2 · regression test for row #8 of the P3/P4 stale-route
// audit (`docs/engineering/cycle-14-p3-p4-audit-2026-11-25.md`).
//
// The retired `/nex-native/create-account` route was replaced
// 2026-11-25 by the sealed one-URL auth target
// `/nex-native/sign-in?mode=signup`. Theme-viewer guest-signup banner's
// default `signupHref` prop must point at the sealed URL · any
// regression that re-targets it at `/create-account` produces a 404
// on the organic signup path from the live theme preview.
//
// React Testing Library is NOT installed · tests use
// `renderToStaticMarkup` and assert on the HTML string.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// `next/link` returns a plain <a href> during SSR · no mock needed,
// but keep the vi.mock for consistency with the sibling test file.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  }),
}));

import { GuestSignupBanner } from "../_guest-signup-banner";

describe("GuestSignupBanner · Cycle-14 F2 · default signupHref", () => {
  it("default CTA href targets the sealed one-URL auth signup mode", () => {
    const html = renderToStaticMarkup(
      React.createElement(GuestSignupBanner, {}),
    );
    // The <Link href> is rendered as an <a href=...> during SSR.
    expect(html).toContain('href="/nex-native/sign-in?mode=signup"');
    // Guard against regression back to the retired route.
    expect(html).not.toContain("/nex-native/create-account");
    // Marker attribute used by Playwright journeys.
    expect(html).toContain("data-nex-theme-guest-banner-cta");
  });

  it("explicit signupHref prop overrides the default", () => {
    const html = renderToStaticMarkup(
      React.createElement(GuestSignupBanner, {
        signupHref: "/nex-native/sign-in?mode=signup&intent=pick-theme",
      }),
    );
    expect(html).toContain(
      'href="/nex-native/sign-in?mode=signup&amp;intent=pick-theme"',
    );
  });
});
