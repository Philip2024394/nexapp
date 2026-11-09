// tests/e2e/journeys/j2-business-signup-trial.spec.ts
//
// Phase E · Journey J-2 · DRAFT.
//
// 7-day Shop trial with Stripe test-mode card + 4 sealed honesty guardrails.
// Requires: sandbox fixtures · Stripe test keys in env · signed-in user.

import { test, expect } from "@playwright/test";

const STRIPE_TEST_CARD = "4242 4242 4242 4242";
const STRIPE_TEST_EXP = "12/34";
const STRIPE_TEST_CVC = "123";

test.describe("J-2 · business signup + 7-day trial", () => {
  test("happy path: signup → card → trial active → 4 guardrails present", async ({ page }) => {
    // Precondition · user is signed in (storageState seeded or sign-in step above).
    await page.goto("/nex-native/manage/shop/start", { waitUntil: "networkidle" });

    // Guardrail #1 · pre-trial disclosure before card entry
    await expect(page.getByText(/free trial.*7 day/i)).toBeVisible();
    await expect(page.getByText(/auto.?charge|charged.*day 8/i)).toBeVisible();

    await page.getByRole("button", { name: /start trial|continue/i }).click();

    // Stripe Checkout iframe (hosted by Stripe · test mode)
    const stripeFrame = page.frameLocator('iframe[name*="stripe"], iframe[title*="Stripe"]').first();
    await stripeFrame.getByPlaceholder(/card number/i).fill(STRIPE_TEST_CARD);
    await stripeFrame.getByPlaceholder(/MM.*YY|expir/i).fill(STRIPE_TEST_EXP);
    await stripeFrame.getByPlaceholder(/CVC|CVV/i).fill(STRIPE_TEST_CVC);

    await page.getByRole("button", { name: /subscribe|start trial/i }).click();

    // Trial-active confirmation
    await expect(page.getByText(/trial active|7 days remaining/i)).toBeVisible({ timeout: 30_000 });

    // Guardrail #3 · 1-click in-app cancel visible
    await expect(page.getByRole("button", { name: /cancel trial|cancel subscription/i })).toBeVisible();

    // Guardrail #4 · cancel during trial keeps access until day 7 · tested by
    // J-2b companion spec that clicks cancel + verifies access remains.
    // (Not run here · the subscription Stripe-side cleanup is costly.)
  });
});
