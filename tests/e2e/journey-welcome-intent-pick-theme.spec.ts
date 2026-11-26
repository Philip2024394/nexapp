// tests/e2e/journey-welcome-intent-pick-theme.spec.ts
//
// Cycle-14 F2 · regression spec for row #4 of the P3/P4 stale-route
// audit (`docs/engineering/cycle-14-p3-p4-audit-2026-11-25.md`).
// -----------------------------------------------------------------------------
// The welcome-intent server-action branch at
// `src/app/nex-native/_actions.ts:744-751` redirects a guest with the
// WELCOME_INTENT_COOKIE set to the sealed one-URL signup surface with
// `intent=pick-theme` preserved so the signup-success handler can
// resume the pick-theme flow.
//
// Prior to F2 the redirect pointed at the retired
// `/nex-native/create-account/pick-theme` · a guest arriving via this
// branch landed on a 404. F2 retargeted the redirect; this spec asserts
// the sealed URL is served live and that the intent param is preserved.
//
// This spec asserts the destination surface at the URL level. End-to-
// end pick-theme signup is already covered by
// `journey-full-guest-signup-pick-theme.spec.ts` and
// `journey-selected-theme-cookie-signup.spec.ts`.
//
// Sandbox-only · guest context (no cookies).

import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("welcome-intent branch · redirect target serves sealed signup URL with intent=pick-theme", async ({
  page,
}) => {
  test.setTimeout(30_000);

  const target = "/nex-native/sign-in?mode=signup&intent=pick-theme";
  await page.goto(target, { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/nex-native\/sign-in\?mode=signup/);
  expect(page.url()).toContain("intent=pick-theme");
  expect(page.url()).not.toContain("/create-account");

  await expect(
    page.locator("[data-nex-sign-up-form]"),
    "signup form must render (destination must not be 404)",
  ).toBeVisible({ timeout: 10_000 });
});
