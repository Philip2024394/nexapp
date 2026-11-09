// tests/e2e/journeys/j9-account-deletion.spec.ts
//
// Phase E · Journey J-9 · DRAFT.
// Account self-deletion with 30-day recovery window.
// 30-day final-delete must be tested via test-env time acceleration ·
// deferred to J-9b.

import { test, expect } from "@playwright/test";

test.describe("J-9 · account deletion", () => {
  test("user initiates deletion · account status pending_deletion", async ({ page }) => {
    await page.goto("/nex-native/settings/security/delete-account", { waitUntil: "networkidle" });

    // Double-confirm per constitution (destructive action)
    await page.getByRole("button", { name: /delete account/i }).click();
    await expect(page.getByText(/this action|cannot be undone|confirm/i)).toBeVisible();

    await page.getByRole("button", { name: /yes.*delete|confirm delete/i }).click();

    // Expect redirect to a confirmation surface + 30-day window note
    await expect(page.getByText(/scheduled|30 day|recoverable/i)).toBeVisible({ timeout: 15_000 });
  });
});
