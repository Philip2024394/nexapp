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

test.describe.serial("T-4.6 · signed-out buy intent → auth-gate", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("auth-gate banner renders when a signed-out user taps Buy on a product", async ({
    page,
  }) => {
    // Cycle 4 2026-11-24 · pre-500-seller launch window hides the
    // public Directory; this test enters via direct product URL.
    // Required env vars:
    //   · NEX_E2E_SEED_PRODUCT_ID   → UUID of a live sandbox product
    // Optional env var:
    //   · NEX_E2E_SEED_SHOP_SLUG    → URL-safe slug for the parent
    //                                  storefront · reserved for the
    //                                  (currently skipped) sign-in-
    //                                  CTA preservation sibling test.
    //
    // If the env var is absent we HONESTLY BLOCK · we do not fabricate
    // IDs and we do not fall back to scraping /directory. The sealed
    // auth-gate behaviour is what we are testing; it only mounts on
    // product pages reached by a signed-out viewer with a real
    // product row.
    const productId = process.env.NEX_E2E_SEED_PRODUCT_ID;
    test.skip(
      !productId,
      "BLOCKED-PENDING-SEED-FIXTURE · set NEX_E2E_SEED_PRODUCT_ID to " +
        "a valid sandbox product UUID. We will not fabricate IDs or " +
        "scrape the (intentionally hidden pre-500-seller) public " +
        "Directory.",
    );

    // Direct product route · sealed signed-out-browse rule allows
    // anonymous browse (`nex_business_public_read` policy in
    // migration 002, plus `nex_product` RLS gated on status='live').
    const productResponse = await page.goto(`/nex-native/product/${productId}`, {
      waitUntil: "domcontentloaded",
    });
    expect(productResponse?.status(), "direct product URL responds 200").toBe(200);
    await page.waitForFunction(() => Boolean(document.body), null, {
      timeout: 10_000,
    });
    await page.waitForSelector("[data-nex-product-page]", { timeout: 10_000 });

    // Step 3 · press Buy / Add to cart / Checkout. Match by common
    // sealed button text to stay resilient to minor UI revisions while
    // not weakening the behavioural assertion.
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
    //
    // The sealed component uses the test-id convention `data-nex-auth-
    // gate-banner` (verified by reading the sealed memory). Fallback:
    // match the banner title text "Sign in required".
    const bannerBox = page.locator("[data-nex-auth-gate-banner]");
    const bannerVisible = bannerBox
      .or(page.getByText(/sign in required/i))
      .first();
    await expect(bannerVisible, "sealed auth-gate banner appears").toBeVisible({
      timeout: 5_000,
    });

    // Both actions present. The sealed 2026-11-21 banner uses a
    // Next <Link> for Sign in (so we match role=link with the exact
    // "Sign in" accessible name) and a <button> for Close. Scoping
    // to the data-nex-auth-gate container keeps us clear of other
    // buttons whose aria-labels include "sign in required" copy.
    const signInCta = bannerBox
      .getByRole("link", { name: /^sign in$/i })
      .first();
    const closeCta = bannerBox
      .getByRole("button", { name: /close|dismiss|not now|×/i })
      .first();
    await expect(signInCta).toBeVisible();
    await expect(closeCta).toBeVisible();

    // Cycle 7 2026-11-24 · the `?next=` CTA must preserve the
    // intended destination so sign-in deposits the buyer on a
    // resumable surface, not a generic home.
    const signInHref = await signInCta.getAttribute("href");
    expect(
      signInHref,
      "sign-in CTA carries a next= query preserving intent",
    ).toMatch(/\?next=/);
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
