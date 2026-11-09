// tests/e2e/journeys/j7-vault-pin.spec.ts
//
// Phase E · Journey J-7 · DRAFT.
// Vault 6-digit PIN setup + unlock (sealed Ireland auth model).

import { test, expect } from "@playwright/test";

const TEST_PIN = "483927";

test.describe("J-7 · vault PIN + unlock", () => {
  test("setup PIN → sign out effectively via lock → unlock", async ({ page }) => {
    await page.goto("/nex-native/vault", { waitUntil: "networkidle" });

    // Vault intro · set PIN
    const setPinButton = page.getByRole("button", { name: /set pin|create pin/i });
    if ((await setPinButton.count()) === 0) {
      test.skip(true, "vault PIN already set or intro screen not reached · fixture reset required");
    }
    await setPinButton.click();

    // Enter 6 digits
    for (const d of TEST_PIN) {
      await page.locator(`[data-nex-pin-key="${d}"]`).click();
    }

    await expect(page.getByText(/confirm pin|re.?enter/i)).toBeVisible();
    for (const d of TEST_PIN) {
      await page.locator(`[data-nex-pin-key="${d}"]`).click();
    }

    // Vault home accessible
    await expect(page).toHaveURL(/\/vault\/home/);

    // Lock vault
    await page.getByRole("button", { name: /lock vault/i }).click();

    // Try accessing vault home · expects PIN entry screen
    await page.goto("/nex-native/vault/home", { waitUntil: "networkidle" });
    await expect(page.getByText(/enter pin/i)).toBeVisible();

    for (const d of TEST_PIN) {
      await page.locator(`[data-nex-pin-key="${d}"]`).click();
    }

    await expect(page).toHaveURL(/\/vault\/home/);
  });
});
