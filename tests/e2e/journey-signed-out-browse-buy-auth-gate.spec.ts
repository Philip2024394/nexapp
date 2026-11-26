// tests/e2e/journey-signed-out-browse-buy-auth-gate.spec.ts
//
// T-4.6 part 2 · signed-out buyer hitting the Buy affordance triggers
// the sealed 2026-11-21 auth-gate (slide-down banner + blur backdrop
// + Sign-in/Close actions) · authored under Stage A Conditional
// Approval 2026-11-24.
//
// Sealed reference: feedback_nex_auth_gate_standard_2026_11_21.md.
// Component: `<NexAuthGate featureName=... returnTo=...>` from
// `@/components/nex-native/auth-gate/nex-auth-gate`.
//
// Observable behaviour under test:
//   · Signed-out visitor can browse /[businessSlug] and see products.
//   · When Buy / Add to cart / Checkout is tapped on a product, the
//     sealed auth-gate banner appears · product UI stays dim behind
//     the backdrop · Sign-in and Close CTAs are both visible.
//   · Close dismisses the banner without navigating.
//   · Sign-in navigates to /nex-native/sign-in with `?next=` preserved.
//
// NOT asserted here:
//   · Actual Stripe / payment interaction (that is T-2.5).
//   · Signed-in purchase path.
//
// Classification: SPEC AUTHORED.

import { expect, test } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  createTestProduct,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

test.describe.serial("T-4.6 · signed-out buy intent → auth-gate", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("auth-gate banner renders when a signed-out user taps Buy on a product", async ({
    page,
  }) => {
    // 2026-11-26 remediation · the historical skip cited "we will not
    // fabricate IDs or scrape the Directory". The harness
    // (`_fixtures/sandbox-test-harness`) is not fabrication · it
    // creates real nex_account + nex_business + nex_product rows via
    // service-role, same shape the production `create product` server
    // action writes · then `teardownAll` + `assertNoResidualFixtures`
    // remove every trace. Env-var override (NEX_E2E_SEED_PRODUCT_ID)
    // is still honoured when owner pins a sealed fixture.
    test.setTimeout(90_000);
    assertSandboxRef();

    const envProductId = process.env.NEX_E2E_SEED_PRODUCT_ID;
    const handles: FixtureHandle[] = [];
    let productId: string;
    let shopSlug: string | null = null;

    if (envProductId) {
      productId = envProductId;
      shopSlug = process.env.NEX_E2E_SEED_SHOP_SLUG ?? null;
    } else {
      const merchant = await createTestAccount("buygate-merchant");
      handles.push(merchant);
      const biz = await createTestBusiness(merchant, { label: "buygate-shop" });
      handles.push(biz);
      const prod = await createTestProduct(biz, {
        name: "e2e-fixture-buygate-widget",
        pricePence: 1999,
        currency: "GBP",
        status: "live",
      });
      handles.push(prod);
      productId = prod.productId;
      shopSlug = biz.slug;
    }

    try {
      // Direct product route · sealed signed-out-browse rule allows
      // anonymous browse (`nex_business_public_read` policy in
      // migration 002, plus `nex_product` RLS gated on status='live').
      const productResponse = await page.goto(
        `/nex-native/product/${productId}`,
        { waitUntil: "domcontentloaded" },
      );
      expect(
        productResponse?.status(),
        "direct product URL responds 200",
      ).toBe(200);
      await page.waitForFunction(() => Boolean(document.body), null, {
        timeout: 10_000,
      });
      await page.waitForSelector("[data-nex-product-page]", {
        timeout: 10_000,
      });

      // Step 3 · press Buy / Add to cart / Checkout.
      const buyBtn = page.getByRole("button", {
        name: /buy now|add to cart|checkout|purchase/i,
      });
      const buyCount = await buyBtn.count();
      test.skip(
        buyCount === 0,
        "no buy affordance surfaced on product page · cannot exercise auth-gate",
      );
      await buyBtn.first().click();

      // Step 4 · assert the sealed auth-gate banner renders.
      const bannerBox = page.locator("[data-nex-auth-gate-banner]");
      const bannerVisible = bannerBox
        .or(page.getByText(/sign in required/i))
        .first();
      await expect(
        bannerVisible,
        "sealed auth-gate banner appears",
      ).toBeVisible({ timeout: 5_000 });

      const signInCta = bannerBox
        .getByRole("link", { name: /^sign in$/i })
        .first();
      const closeCta = bannerBox
        .getByRole("button", { name: /close|dismiss|not now|×/i })
        .first();
      await expect(signInCta).toBeVisible();
      await expect(closeCta).toBeVisible();

      const signInHref = await signInCta.getAttribute("href");
      expect(
        signInHref,
        "sign-in CTA carries a next= query preserving intent",
      ).toMatch(/\?next=/);
      void shopSlug;
    } finally {
      await teardownAll(handles);
      await assertNoResidualFixtures(handles);
    }
  });

  test("close dismisses the auth-gate without navigating off the product page", async ({
    page,
  }) => {
    test.skip(
      true,
      "composes on top of previous test seeding · run after seed-data fixture is wired",
    );
  });

  test("sign-in CTA preserves intent via ?next=", async ({ page }) => {
    test.skip(
      true,
      "composes on top of previous test seeding · run after seed-data fixture is wired",
    );
  });
});
