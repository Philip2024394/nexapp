// tests/e2e/journey-kind-select-signup.spec.ts
//
// Cycle-14 F2 · regression spec for row #5 of the P3/P4 stale-route
// audit (`docs/engineering/cycle-14-p3-p4-audit-2026-11-25.md`).
// -----------------------------------------------------------------------------
// The kind-select branch's error handler at
// `src/app/nex-native/_actions.ts:8164-8168` (`redirectToKindStepWithError`)
// redirects to the sealed one-URL signup surface and preserves the
// error code (`e`) + message (`m`) query params so the signup form
// can render a contextual error banner.
//
// Prior to F2 the redirect pointed at the retired
// `/nex-native/create-account/kind?...` path · a user hitting a
// validation failure in kind-select landed on a 404 and the error
// context was lost.
//
// This spec asserts:
//   · The sealed destination URL is live (not 404).
//   · The `e` and `m` query params are preserved and reach the signup
//     surface.
//
// End-to-end kind-select → signup → business creation is a wider
// journey; this regression is narrowly scoped to the redirect target.
//
// Sandbox-only · guest context (no cookies).

import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("kind-select error handler · sealed signup URL serves and preserves (e,m) params", async ({
  page,
}) => {
  test.setTimeout(30_000);

  const target =
    "/nex-native/sign-in?mode=signup&e=kind_invalid&m=Please+pick+a+business+kind";
  await page.goto(target, { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/nex-native\/sign-in\?mode=signup/);
  expect(page.url()).toContain("e=kind_invalid");
  expect(page.url()).toContain("m=Please");
  expect(page.url()).not.toContain("/create-account");

  await expect(
    page.locator("[data-nex-sign-up-form]"),
    "signup form must render · destination must not be 404",
  ).toBeVisible({ timeout: 10_000 });
});
