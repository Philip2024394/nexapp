// tests/e2e/journeys/j6-themes-purchase.spec.ts
//
// Phase E · Journey J-6 · DRAFT.
// Chat theme one-time purchase (sealed $3.99) + apply.

import { test, expect } from "@playwright/test";

test.describe("J-6 · chat themes purchase + apply", () => {
  test("happy path: library → purchase → apply → persists", async ({ page }) => {
    await page.goto("/nex-native/chat-themes-library", { waitUntil: "networkidle" });

    // Pick a theme that requires purchase (first paid tile)
    const paidThemeCard = page.locator("[data-nex-theme-paid]").first();
    if ((await paidThemeCard.count()) === 0) {
      test.skip(true, "no paid themes present in fixture · seed required");
    }
    await paidThemeCard.click();

    await page.getByRole("button", { name: /purchase|buy|unlock/i }).click();

    // Stripe test-mode checkout
    await page.waitForURL(/checkout\.stripe\.com|\/checkout/, { timeout: 30_000 });

    // After payment · expect theme owned + apply button
    await page.goto("/nex-native/chat-themes-library", { waitUntil: "networkidle" });
    await expect(paidThemeCard.getByRole("button", { name: /apply/i })).toBeVisible();

    await paidThemeCard.getByRole("button", { name: /apply/i }).click();

    // Theme persists across sign-out/in · deferred to J-6b companion.
  });
});
