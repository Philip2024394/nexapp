// tests/e2e/journey-theme-viewer-organic-signup.spec.ts
//
// Cycle-14 F2 · regression spec for row #8 of the P3/P4 stale-route
// audit (`docs/engineering/cycle-14-p3-p4-audit-2026-11-25.md`).
// -----------------------------------------------------------------------------
// The organic in-page signup CTA on the theme-preview viewer is the
// `GuestSignupBanner`. Prior to 2026-11-25 its default `signupHref`
// pointed at the retired `/nex-native/create-account` route · a guest
// who clicked the CTA landed on a 404. F2 retargeted the default at
// the sealed one-URL auth signup mode.
//
// This spec guards the CTA at the DOM level and verifies the delivered
// URL is live (i.e. the new destination serves the signup surface with
// a 200, not the 404 the old destination produced). It does NOT run a
// full signup; the end-to-end signup flow from the sealed signup URL
// is already proven by `journey-selected-theme-cookie-signup.spec.ts`
// and `journey-full-guest-signup-pick-theme.spec.ts`.
//
// Sandbox-only · guest context (no cookies).

import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("guest on theme viewer · GuestSignupBanner CTA targets sealed signup URL · destination is live", async ({
  page,
}) => {
  test.setTimeout(30_000);

  await page.goto("/nex-native/themes/nex-bubbles", {
    waitUntil: "domcontentloaded",
  });

  const cta = page.locator("[data-nex-theme-guest-banner-cta]");
  await expect(
    cta,
    "GuestSignupBanner CTA must render for a guest viewer",
  ).toBeVisible({ timeout: 10_000 });

  const href = await cta.getAttribute("href");
  expect(href, "CTA href must point at the sealed one-URL signup mode").toBe(
    "/nex-native/sign-in?mode=signup",
  );
  expect(
    href,
    "CTA href must not regress back to the retired /create-account route",
  ).not.toContain("/create-account");

  // Follow the link · the destination must serve the signup surface,
  // not the 404 that the retired route produced.
  await cta.click();
  await page.waitForURL(/\/nex-native\/sign-in\?mode=signup/, {
    timeout: 15_000,
  });
  await expect(
    page.locator("[data-nex-sign-up-form]"),
    "Sealed signup form must mount on the destination",
  ).toBeVisible({ timeout: 10_000 });
});
