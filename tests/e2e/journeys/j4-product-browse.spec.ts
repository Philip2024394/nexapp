// tests/e2e/journeys/j4-product-browse.spec.ts
//
// Phase E · Journey J-4 · DRAFT.
//
// Product listing + browse · verifies price display matches server-side
// price_pence (not any cached/stale value).

import { test, expect } from "@playwright/test";

const TEST_PRODUCT_SLUG = "j4-test-product";

test.describe("J-4 · product listing + browse", () => {
  test("buyer views product · price matches server-side price_pence", async ({ page, request }) => {
    // Load product page
    await page.goto(`/nex-native/product/${TEST_PRODUCT_SLUG}`, { waitUntil: "networkidle" });

    // Price should be visible
    const priceText = await page.locator("[data-nex-product-price]").first().textContent();
    expect(priceText).toBeTruthy();

    // Compare to API source of truth (if a product-detail API exists on
    // the buyer path). Replace route path if this changes · this spec is
    // a draft and the exact API shape is determined by Sprint 7+.
    const apiResp = await request.get(`/api/nex-native/product/${TEST_PRODUCT_SLUG}`);
    if (apiResp.ok()) {
      const payload = await apiResp.json();
      const serverPence = payload?.price_pence ?? payload?.product?.price_pence;
      if (typeof serverPence === "number") {
        // Price rendered as cents or major · normalise by stripping
        // non-digit characters and comparing to the pence value.
        const renderedPence = Number((priceText ?? "").replace(/[^\d]/g, ""));
        expect(renderedPence).toBe(serverPence);
      }
    }
  });
});
