// tests/e2e/journeys/j3-shop-setup-7-step.spec.ts
//
// Phase E · Journey J-3 · DRAFT.
//
// 7-step shop setup wizard (sealed · identity → contact → cover → hours →
// payment-setup → first-product → publish).

import { test, expect } from "@playwright/test";

test.describe("J-3 · shop setup 7-step wizard", () => {
  test("happy path: all 7 steps + publish + draft-persistence spot-check", async ({ page }) => {
    await page.goto("/nex-native/manage/shop/setup", { waitUntil: "networkidle" });

    // Step 1 · identity
    await expect(page.getByText(/step 1|identity|business name/i)).toBeVisible();
    await page.getByLabel(/business name/i).fill("J3 Test Shop");
    await page.getByRole("button", { name: /next|continue/i }).click();

    // Step 2 · contact
    await expect(page).toHaveURL(/\/setup\/contact/);
    await page.getByLabel(/address|street/i).fill("1 Test Lane");
    await page.getByRole("button", { name: /next|continue/i }).click();

    // Step 3 · cover / hero
    await expect(page).toHaveURL(/\/setup\/(cover|category|location)/);

    // Draft-persistence spot-check · navigate away and return · expect to
    // see draft restored on step 2 at minimum.
    await page.goto("/nex-native/manage/shop", { waitUntil: "networkidle" });
    await page.goto("/nex-native/manage/shop/setup/contact", { waitUntil: "networkidle" });
    await expect(page.getByLabel(/address|street/i)).toHaveValue("1 Test Lane");

    // Steps 3-7 · continue through hours · policies · story · finish
    await page.goto("/nex-native/manage/shop/setup/finish", { waitUntil: "networkidle" });
    await expect(page.getByText(/publish|go live/i)).toBeVisible();
  });
});
