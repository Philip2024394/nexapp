// tests/e2e/journey-mid-shop-setup-interrupt-resume.spec.ts
//
// T-4.4 · mid-shop-setup interrupt and resume · authored under Stage A
// Conditional Approval 2026-11-24.
//
// Observable behaviour (sealed dispatcher at
// src/app/nex-native/manage/shop/setup/page.tsx):
//   The dispatcher resolves the resume step from the actual state of
//   nex_business + nex_product (NOT from a "has visited" cookie):
//     · needsDetails  → /setup/business-details
//     · no cover URL  → /setup/appearance
//     · no products   → /setup/first-product
//     · otherwise     → /setup/review
//
// Spec approach:
//   · Confirm the dispatcher is state-driven by probing /manage/shop/setup
//     for a signed-in account.
//   · The actual phone-kill mid-flow + resume at exact step requires
//     a seeded account in a known partial state · we SKIP honestly.
//
// Classification: SPEC AUTHORED.

import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/state.json" });

test.describe.serial("T-4.4 · mid-shop-setup resume", () => {
  test("dispatcher routes to ONE of the four known steps", async ({ page }) => {
    // Remediation 2026-11-24 cycle 3 · the dispatcher at
    // `src/app/nex-native/manage/shop/setup/page.tsx` calls
    // `redirect()` to one of the four sealed subpaths. Next.js 16's
    // RSC streaming commits the parent layout response before the
    // page's `redirect()` resolves, so the redirect arrives in the
    // HTML body as a `<meta http-equiv="refresh">` rather than an
    // HTTP 307. Therefore `page.url()` is still `/manage/shop/setup`
    // at `domcontentloaded`; we must wait for the meta refresh to
    // fire (empirically ~1s). Assertion strength preserved: the test
    // still requires the final URL to be one of the four sealed
    // destinations · we are ONLY giving the redirect time to land.
    const response = await page.goto("/nex-native/manage/shop/setup", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBeLessThan(500);

    await page.waitForURL(
      /\/nex-native\/manage\/shop\/setup\/(business-details|appearance|first-product|review)/,
      { timeout: 10_000 },
    );

    expect(
      page.url(),
      "dispatcher lands on one of the four sealed resume steps",
    ).toMatch(
      /\/nex-native\/manage\/shop\/setup\/(business-details|appearance|first-product|review)/,
    );
  });

  test("resume cursor is state-driven · phone-kill at business-details lands back on business-details", async () => {
    test.skip(
      true,
      "BLOCKED-PENDING-SEED · fully exercising the phone-kill branch " +
        "requires a seeded account at a known partial state · owner must " +
        "approve the seed fixture before mutating the test account",
    );
  });
});
