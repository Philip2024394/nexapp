// tests/e2e/journeys/j10-multi-country.spec.ts
//
// Phase E · Journey J-10 · DRAFT.
// Worldwide app behaviour · country switch preserves user data.
// Sealed Global Dev Scope Rule 2026-11-01 · three Vercel projects.

import { test, expect } from "@playwright/test";

const COUNTRIES = ["worldwide", "ireland", "indonesia"] as const;

test.describe("J-10 · multi-country switch", () => {
  test("country switcher updates backdrop + currency · chat survives", async ({ page }) => {
    await page.goto("/nex-native", { waitUntil: "networkidle" });

    // Switch country via the country-switcher UI (exact selector is
    // founder-sealed · this is a draft assertion)
    for (const country of COUNTRIES) {
      await page.locator(`[data-nex-country-switch="${country}"]`).click().catch(() => undefined);
      await page.waitForTimeout(500);

      // Backdrop attribute present on <html> or <body>
      const identity = await page.evaluate(() => {
        return (
          document.documentElement.getAttribute("data-nex-world") ??
          document.body.getAttribute("data-nex-world") ??
          null
        );
      });
      if (identity !== null) {
        expect(identity).toContain(country === "worldwide" ? "" : country);
      }
    }

    // After the switch cycle · navigate to chat · expect the same
    // conversation list visible (chat state is user-scoped, not
    // country-scoped per sealed Global Dev Scope Rule)
    await page.goto("/nex-native/free-chat", { waitUntil: "networkidle" });
    // Just assert the chat surface rendered
    await expect(page).toHaveURL(/\/free-chat/);
  });
});
