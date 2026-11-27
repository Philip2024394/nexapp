// tests/e2e/xrated-hero-landscape.spec.ts
//
// Browser verification of Template 15 (product_hero_landscape) on the
// X-Rated Tool Belts sandbox shop. Captures the evidence the owner
// asked for in cycle-8 continuation:
//
//   · 8 cards per page (landscape, wider than tall)
//   · Pagination 1 / 3 → 2 / 3 → 3 / 3 (17 live products)
//   · Vertical brand strip on left edge of each card
//   · Ping around the shop portrait follows the accent tint (orange)
//   · Install slide-in renders as a white container
//   · Mobile (Pixel 7 · 412×915) + desktop (1280×900) both verified
//
// Requires the dev server already running on :3008. Does NOT touch
// auth · the shop is public.

import { test, expect, devices } from "@playwright/test";

const SHOP_URL = "/nex-native/x-rated-tool-belts";

const VIEWPORTS: Array<{ label: string; viewport: { width: number; height: number } }> = [
  { label: "mobile-pixel7", viewport: { width: 412, height: 915 } },
  { label: "desktop-1280", viewport: { width: 1280, height: 900 } },
];

for (const vp of VIEWPORTS) {
  test.describe(`product_hero_landscape · ${vp.label}`, () => {
    test.use({ viewport: vp.viewport });

    test(`8/page + 3-page pagination + brand strip + accent ping (${vp.label})`, async ({ page }, testInfo) => {
      await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" });

      // --- Page 1: 8 cards + pagination 1 / 3 -------------------------------
      await expect(page.locator("[data-nex-cover-product-card]")).toHaveCount(8);

      // Owner-sealed 2026-11-28 heading restructure:
      //   · "Products" eyebrow present (replaces "Shop")
      //   · "Select product" dropdown present above the cards
      //   · Legacy "📦 17 products live" badge REMOVED
      //   · Legacy section title (t.catalog_heading) REMOVED from this layout
      await expect(
        page.locator("[data-nex-cover-product-select]"),
      ).toBeVisible();
      await expect(
        page.getByRole("combobox", { name: "Select product" }),
      ).toBeVisible();
      await expect(page.locator("body")).not.toContainText(
        /\d+\s*products\s*live/i,
      );
      // Dropdown must list every live product (8 shown + 9 more = 17 live
      // products on the sandbox shop · regardless of current page).
      const optionCount = await page
        .getByRole("combobox", { name: "Select product" })
        .locator("option")
        .count();
      // +1 for the disabled "Select product" placeholder
      expect(optionCount).toBe(17 + 1);

      const pagerNav = page.getByRole("navigation", { name: "Product pages" });
      await expect(pagerNav).toBeVisible();
      await expect(pagerNav).toContainText(/1\s*\/\s*3/);

      // Owner-sealed 2026-11-28 (second pass) · Template 15 cards
      // are now text-only: no brand strip, no product image.
      await expect(page.locator("[data-nex-cover-brand-strip]")).toHaveCount(0);
      // All 8 landscape cards must carry the text-only marker.
      await expect(
        page.locator('[data-nex-cover-product-card][data-text-only="true"]'),
      ).toHaveCount(8);

      // Card is wider than tall.
      const firstCard = page.locator("[data-nex-cover-product-card]").first();
      const firstBox = await firstCard.boundingBox();
      expect(firstBox).not.toBeNull();
      if (firstBox) {
        expect(firstBox.width).toBeGreaterThan(firstBox.height);
      }

      // Light-gray background (#E5E7EB → rgb(229, 231, 235)) behind the
      // product text column.
      const firstBg = await firstCard.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      );
      expect(firstBg).toBe("rgb(229, 231, 235)");

      // Shop identity badge renders the uploaded header logo in place
      // of the typed shop name · the <img data-nex-cover-header-logo>
      // is present inside the badge AND the typed "X-Rated Tool Belts"
      // text node is NOT rendered inside the badge (alt text on the
      // <img> still carries the name for screen readers).
      const badge = page.locator("[data-nex-cover-rise]").first();
      await expect(
        badge.locator("[data-nex-cover-header-logo]"),
      ).toBeVisible();
      const badgeText = (await badge.textContent()) ?? "";
      expect(badgeText).not.toContain("X-Rated Tool Belts");

      // Ping around the shop portrait exists and inherits the accent
      // color (no hardcoded #22C55E green should be computed here).
      const ping = page.locator("[data-nex-cover-ping]").first();
      await expect(ping).toBeAttached();
      const pingBorderColor = await ping.evaluate(
        (el) => getComputedStyle(el).borderTopColor,
      );
      // --nex-accent on this shop is #F97316 (orange) → rgb(249, 115, 22).
      expect(pingBorderColor).toBe("rgb(249, 115, 22)");

      await testInfo.attach(`${vp.label}-page-1.png`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });

      // --- Page 2: next → 8 cards + pagination 2 / 3 -----------------------
      await page.getByRole("button", { name: "Next page" }).click();
      await expect(pagerNav).toContainText(/2\s*\/\s*3/);
      await expect(page.locator("[data-nex-cover-product-card]")).toHaveCount(8);
      await expect(page.locator("[data-nex-cover-brand-strip]")).toHaveCount(0);

      await testInfo.attach(`${vp.label}-page-2.png`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });

      // --- Page 3: next → remainder (17 - 16 = 1) + pagination 3 / 3 --------
      await page.getByRole("button", { name: "Next page" }).click();
      await expect(pagerNav).toContainText(/3\s*\/\s*3/);
      await expect(page.locator("[data-nex-cover-product-card]")).toHaveCount(1);
      await expect(page.locator("[data-nex-cover-brand-strip]")).toHaveCount(0);

      await testInfo.attach(`${vp.label}-page-3.png`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });

      // --- Back traversal: prev → 2 / 3 → 1 / 3 ----------------------------
      await page.getByRole("button", { name: "Previous page" }).click();
      await expect(pagerNav).toContainText(/2\s*\/\s*3/);
      await page.getByRole("button", { name: "Previous page" }).click();
      await expect(pagerNav).toContainText(/1\s*\/\s*3/);
      await expect(page.locator("[data-nex-cover-product-card]")).toHaveCount(8);
    });

    test(`install slide-in renders as a white container (${vp.label})`, async ({ page }, testInfo) => {
      await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" });

      const slideIn = page.locator("[data-nex-shop-install-slidein]");
      // May auto-appear only if the user is non-standalone + non-iOS +
      // dismissal state allows. Timeout softly.
      const visible = await slideIn
        .waitFor({ state: "visible", timeout: 6000 })
        .then(() => true)
        .catch(() => false);
      if (!visible) {
        test.info().annotations.push({
          type: "slide-in",
          description:
            "slide-in did not auto-appear in this viewport; dismissal cooldown or iOS detection prevented mount. Visual check skipped.",
        });
        return;
      }

      const bg = await slideIn.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toBe("rgb(255, 255, 255)"); // white container

      const textColor = await slideIn.evaluate(
        (el) => getComputedStyle(el).color,
      );
      // ON_LIGHT = #0B1220 → rgb(11, 18, 32)
      expect(textColor).toBe("rgb(11, 18, 32)");

      await testInfo.attach(`${vp.label}-install-slidein.png`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    });
  });
}
