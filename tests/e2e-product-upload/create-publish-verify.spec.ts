// tests/e2e-product-upload/create-publish-verify.spec.ts
//
// Owner-authorised 2026-10-31 · first E2E journey for the Product
// Upload World-Class brief · Technical Point 3.
//
// Journey (owner-selected scope):
//   1. Sign in as the seeded test seller (dev-impersonation cookie
//      pointing at a dedicated test Supabase project).
//   2. Navigate /nex-native/create/product.
//   3. Pick the Fashion & Clothing department → womens category.
//   4. Fill name + price + stock + Market=Local + one zone.
//   5. Publish Live.
//   6. Open /nex-native/{slug}/{productId} and assert the product
//      renders in the public shop.
//
// Skip posture:
//   This spec is SKIP-SAFE. If the required env vars are missing
//   (because the dedicated test Supabase project is not yet
//   provisioned) each test logs the reason and skips. This lets the
//   scaffold land now; the tests activate once owner provisions the
//   test project and wires TEST_SUPABASE_URL +
//   TEST_SUPABASE_SERVICE_ROLE_KEY + TEST_SELLER_ACCOUNT_ID +
//   TEST_BUSINESS_ID in the environment.

import { test, expect } from "@playwright/test";

const REQUIRED_ENV = [
  "TEST_SUPABASE_URL",
  "TEST_SUPABASE_SERVICE_ROLE_KEY",
  "TEST_SELLER_ACCOUNT_ID",
  "TEST_BUSINESS_ID",
] as const;

function requireTestEnv(): Record<(typeof REQUIRED_ENV)[number], string> | null {
  const out: Record<string, string> = {};
  for (const k of REQUIRED_ENV) {
    const v = process.env[k];
    if (!v || v.trim() === "") return null;
    out[k] = v.trim();
  }
  return out as Record<(typeof REQUIRED_ENV)[number], string>;
}

test.describe("Product Upload · Create → publish → verify in shop", () => {
  test("golden path · Fashion → womens → Local → publish live", async ({ page }) => {
    const env = requireTestEnv();
    test.skip(!env, `Required env vars absent: ${REQUIRED_ENV.join(", ")}. Provision the dedicated test Supabase project per tests/e2e-product-upload/README.md to run this spec.`);
    if (!env) return; // narrow for the type-checker

    // Dev-impersonation cookie · the server supports this via
    // resolveSessionWithDevOverride in src/lib/nex-native/app/dev-
    // impersonation.ts. The exact cookie-name + payload shape is
    // sealed in that module; the test is deliberately pinned to the
    // dev-impersonation flow because the real sign-in path (WebAuthn
    // / face unlock) is not Playwright-driveable without the auth-
    // fixture gap documented in the sealed B2 config comments.
    //
    // When this spec first runs against a real test env, the
    // dev-impersonation cookie-set helper will live in
    // ./fixtures/dev-session.ts and will be imported here.
    await page.goto("/nex-native/create/product");

    // The business picker auto-forwards to the category picker when
    // the seller owns exactly one business. Our seeded test seller is
    // configured to own exactly TEST_BUSINESS_ID, so we expect the
    // forward.
    await expect(page).toHaveURL(/\/nex-native\/create\/product\/category/);
    await expect(page).toHaveURL(new RegExp(`business=${env.TEST_BUSINESS_ID}`));

    // Fashion & Clothing department tile.
    await page.getByRole("link", { name: /Fashion & Clothing/i }).first().click();

    // Women's Clothing sub-category tile.
    await page.getByRole("link", { name: /Women'?s Clothing/i }).first().click();

    // Fill the shared form.
    await expect(page).toHaveURL(/\/nex-native\/create\/product\/form\?/);
    await page.getByLabel(/Product name/i).fill("E2E · Fashion test shirt");
    await page.getByLabel(/^Description$/i).fill("Smoke test for the product-upload E2E harness.");
    await page.getByLabel(/^Price$/i).fill("150000");

    // Scope defaults to Local; add a local zone.
    await page.getByRole("button", { name: /^\+ Add local zone$/i }).click();
    await page.getByLabel(/^Zone name$/i).fill("Yogyakarta city");
    await page.getByLabel(/^Delivery price$/i).fill("15000");
    await page.getByLabel(/^Dispatch time \(days\)$/i).fill("1");
    const minDeliveryInputs = page.getByPlaceholder("min");
    const maxDeliveryInputs = page.getByPlaceholder("max");
    await minDeliveryInputs.first().fill("1");
    await maxDeliveryInputs.first().fill("3");

    // Publish live.
    await page.getByRole("button", { name: /^Publish live$/i }).click();

    // After publish, the client routes to /manage/products/{id}.
    await page.waitForURL(/\/nex-native\/manage\/products\/[0-9a-f-]{36}($|\?)/, { timeout: 15_000 });
    const url = new URL(page.url());
    const productId = url.pathname.split("/").filter(Boolean).pop();
    expect(productId).toMatch(/^[0-9a-f-]{36}$/);

    // Verify shop detail page renders the product.
    // The business slug is derivable from the TEST env via the seed
    // helper; the fixtures module exports it alongside the account id.
    // Direct call here is a Phase-1 shortcut using a known-seeded
    // slug fetched via REST (not implemented in this scaffold).
    // Once the fixture is written, the final line becomes:
    //   await page.goto(`/nex-native/${testBusinessSlug}/${productId}`);
    //   await expect(page.getByText("E2E · Fashion test shirt")).toBeVisible();
    //
    // For the scaffold, we assert the manage detail page is live
    // (which proves the publish succeeded) and leave the shop
    // round-trip to the fixtures PR.
    await expect(page.getByText("E2E · Fashion test shirt")).toBeVisible({ timeout: 10_000 });
  });
});
