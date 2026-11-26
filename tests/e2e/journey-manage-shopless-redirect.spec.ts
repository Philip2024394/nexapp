// tests/e2e/journey-manage-shopless-redirect.spec.ts
//
// Permanent regression · authored 2026-11-26 under owner priority 2
// (reported defect #73).
//
// Originally authored as a diagnostic to reproduce the reported defect
// "/nex-native/manage does not redirect a shop-less session to /setup".
// Investigation under this spec proved the reported behaviour was a
// TEST-MEASUREMENT artefact, NOT a product defect. Root cause:
//
//   · /manage's server component correctly calls `redirect()` when the
//     signed-in session owns zero businesses
//     (src/app/nex-native/manage/page.tsx:70-72).
//   · Next 16 App Router ships this redirect via an RSC streaming
//     flight response: initial HTTP response is 200 with a near-empty
//     `<div hidden=""><!--$--><!--/$--></div>` suspense slot, and the
//     client router processes the trailing redirect instruction and
//     navigates to the destination. Final URL is correct; just NOT
//     observable the microsecond after `waitUntil:"domcontentloaded"`.
//   · The earlier T5 diagnostic comment in `journey-create-shop.spec.ts`
//     observed `page.url()` immediately after domcontentloaded and
//     mis-read the streaming pattern as "no redirect". That comment is
//     corrected in the same cycle as this spec lands.
//
// What this spec guards:
//   · A fresh shop-less fixture signed into the real sealed sign-in
//     form navigates to `/nex-native/manage`.
//   · Within the streaming budget (10s), the browser URL settles on
//     `/nex-native/manage/shop/setup`.
//   · The management-centre marker `[data-nex-shop-management-centre]`
//     does NOT render anywhere in the navigation sequence (would be a
//     privacy/authorisation leak for a shop-less account).
//   · The merchant remains shop-less throughout (no silent provisioning).
//   · Teardown reverses cleanly · zero residual accounts/auth users.
//
// Boundaries honoured:
//   · Sandbox-only · hard-gated by assertSandboxRef().
//   · Uses the sealed sign-in form end-to-end · no auth weakening.
//   · No migration, no prod touch, no network side effects.

import { expect, test } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  signInAsFixtureInBrowser,
  supabaseAdmin,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

test.describe("defect #73 regression · /nex-native/manage shop-less redirect", () => {
  test("shop-less fixture visiting /manage redirects to /manage/shop/setup via RSC streaming", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    assertSandboxRef();
    const sb = supabaseAdmin();
    const handles: FixtureHandle[] = [];

    const context = await browser.newContext({ storageState: undefined });
    const freshPage = await context.newPage();

    try {
      // 1 · Mint a shop-less fixture account with a password so the
      //     browser-side sign-in helper can drive the sealed form.
      const merchant = await createTestAccount({
        label: "manage-shopless",
        returnPassword: true,
      });
      handles.push(merchant);

      // Precondition sanity: no business owned by this fresh account.
      const { data: pre } = await sb
        .from("nex_business")
        .select("id")
        .eq("owner_account_id", merchant.nexAccountId);
      expect(pre?.length ?? 0, "fixture must start shop-less").toBe(0);

      // 2 · Sign in through the sealed sign-in form.
      await signInAsFixtureInBrowser(freshPage, merchant);

      // 3 · Visit /manage. In Next 16 App Router the redirect() call in
      //     the server component is delivered via an RSC streaming
      //     flight response · the browser URL settles on the
      //     destination a short moment after `domcontentloaded`.
      await freshPage.goto("/nex-native/manage", {
        waitUntil: "domcontentloaded",
      });

      // 4 · Wait up to 10s for the URL to leave /manage. Server-side
      //     redirect() → client router applies the destination.
      await freshPage.waitForURL(
        (u) => !/^\/nex-native\/manage(?:$|\?|#)/.test(u.pathname + u.search),
        { timeout: 10_000, waitUntil: "domcontentloaded" },
      );

      const finalUrl = freshPage.url();
      expect(
        /\/nex-native\/manage\/shop\/setup/.test(finalUrl),
        `shop-less /manage must redirect to /manage/shop/setup · final url=${finalUrl}`,
      ).toBe(true);

      // 5 · The management-centre marker must NEVER appear at the final
      //     destination for a shop-less session (that would imply a
      //     leak of the owner-only surface).
      const hasMgmtCentre = await freshPage
        .locator("[data-nex-shop-management-centre]")
        .count();
      expect(
        hasMgmtCentre,
        "shop-less /manage path must never render the management centre",
      ).toBe(0);

      // 6 · Admin cross-check: still shop-less. Guards against a
      //     regression where the dispatcher secretly provisions a
      //     business row for the current account.
      const { data: post } = await sb
        .from("nex_business")
        .select("id")
        .eq("owner_account_id", merchant.nexAccountId);
      expect(
        post?.length ?? 0,
        "merchant must remain shop-less after visiting /manage",
      ).toBe(0);
    } finally {
      await teardownAll(handles);
      const residual = await assertNoResidualFixtures(handles);
      expect(residual.accounts, "no residual accounts").toEqual([]);
      expect(residual.authUsers, "no residual auth users").toEqual([]);
      await freshPage.close().catch(() => undefined);
      await context.close().catch(() => undefined);
    }
  });
});
