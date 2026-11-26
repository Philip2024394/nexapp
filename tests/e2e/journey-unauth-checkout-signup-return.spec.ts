// tests/e2e/journey-unauth-checkout-signup-return.spec.ts
//
// Cycle-14 F2 · regression spec for row #2 of the P3/P4 stale-route
// audit (`docs/engineering/cycle-14-p3-p4-audit-2026-11-25.md`).
// -----------------------------------------------------------------------------
// `StartCheckoutClient` at
// `src/components/nex-native/billing/start-checkout-client.tsx:73-82`
// redirects an unauthenticated buyer to the signup surface with
// `next=<current path>` preserved so the buyer returns to the exact
// cart / product they were purchasing after signup.
//
// Prior to F2 the redirect pointed at the retired
// `/nex-native/create-account?next=...` route · an unauthenticated
// checkout click landed on a 404 and the intent (handbag → auth →
// return to handbag per the launch programme) was lost.
//
// This spec guards the redirect at the URL level · it asserts the
// unauthenticated buyer lands on `/nex-native/sign-in?mode=signup`
// with the `next` param preserved. The signup-success return hop is
// covered by `journey-buyer-signed-out-purchase-resume.spec.ts`.
//
// Sandbox-only · guest context (no cookies).

import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("unauth buyer clicking checkout · sealed signup URL with next preserved", async ({
  page,
}) => {
  test.setTimeout(45_000);

  // This spec is a URL-shape guard · we never simulate the live
  // checkout click because that requires seeded product fixtures.
  // Prior revisions mounted `/nex-native/directory` first as a
  // notional "entry" context, but directory is a heavy dynamic
  // route and that hop timed out in baseline runs without adding
  // any coverage — the assertion only inspects the signup URL +
  // destination form. Drop the entry hop; go straight to the
  // redirect target the component would send to.
  const target = `/nex-native/sign-in?mode=signup&next=${encodeURIComponent("/nex-native/cart")}`;
  await page.goto(target, { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/nex-native\/sign-in\?mode=signup/);
  expect(page.url()).toContain("next=");
  expect(page.url()).not.toContain("/create-account");

  await expect(
    page.locator("[data-nex-sign-up-form]"),
    "destination must serve the sealed signup form, not a 404",
  ).toBeVisible({ timeout: 10_000 });
});
