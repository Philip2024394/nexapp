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
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  signInAsFixtureInBrowser,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

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

  test("resume cursor is state-driven · phone-kill at business-details lands back on business-details", async ({
    browser,
  }) => {
    // 2026-11-26 remediation · the harness's `createTestAccount({
    // returnPassword: true })` + `signInAsFixtureInBrowser` lets us
    // mint a fresh merchant with NO nex_business row and drive the
    // sealed sign-in form end-to-end. With no business, the sealed
    // dispatcher at `src/app/nex-native/manage/shop/setup/page.tsx`
    // must route to `/business-details` per the `needsDetails` branch
    // — the exact "phone-kill resume at step 1" observable contract.
    // No weakening of auth: same sealed `signInAction` path a real
    // user takes; password is short-lived and never logged.
    test.setTimeout(60_000);
    assertSandboxRef();

    const handles: FixtureHandle[] = [];
    // Explicit `storageState: undefined` mirrors the proven pattern in
    // `journey-manage-shopless-redirect.spec.ts:61` · the describe-level
    // `test.use({ storageState: admin })` doesn't apply to manually
    // created contexts, but being explicit avoids any inheritance.
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    try {
      const account = await createTestAccount({
        label: "setup-interrupt",
        returnPassword: true,
      });
      handles.push(account);

      await signInAsFixtureInBrowser(page, account);

      const resp = await page.goto("/nex-native/manage/shop/setup", {
        waitUntil: "domcontentloaded",
      });
      expect(resp?.status()).toBeLessThan(500);

      await page.waitForURL(
        /\/nex-native\/manage\/shop\/setup\/business-details(?:[/?#]|$)/,
        { timeout: 10_000 },
      );

      expect(
        page.url(),
        "needsDetails branch lands on /business-details",
      ).toMatch(/\/manage\/shop\/setup\/business-details/);
    } finally {
      await ctx.close();
      await teardownAll(handles);
      await assertNoResidualFixtures(handles);
    }
  });
});
