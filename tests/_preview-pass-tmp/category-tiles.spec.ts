import { test, expect } from "@playwright/test";

test("category sheet · moon shape + white icons", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-5", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator("[data-nex-video-viewer-search]").click();
  await page.waitForTimeout(800);
  const tileCount = await page.locator("[data-nex-category-tile]").count();
  const moonCount = await page.locator("[data-nex-category-tile-moon]").count();
  const iconCount = await page.locator("[data-nex-category-tile-icon] svg").count();
  console.log(`tiles=${tileCount} moons=${moonCount} svgs=${iconCount}`);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/category-tiles-new.png", fullPage: false });
  expect(tileCount).toBe(12);
  expect(moonCount).toBe(12);
  expect(iconCount).toBe(12);
});
