import { test, expect } from "@playwright/test";

test("category sheet · lucide icons · centered + smaller", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-5", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator("[data-nex-video-viewer-search]").click();
  await page.waitForTimeout(800);
  const tileCount = await page.locator("[data-nex-category-tile]").count();
  const iconSvgs = await page.locator("[data-nex-category-tile-icon] svg").count();
  const firstTileIconClass = await page.locator("[data-nex-category-tile-icon] svg").first().getAttribute("class");
  console.log(`tiles=${tileCount} svgs=${iconSvgs} firstSvgClass=${firstTileIconClass}`);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/category-lucide-after.png", fullPage: false });
  expect(tileCount).toBe(12);
  expect(iconSvgs).toBe(12);
  // lucide-react components ship with class names like `lucide lucide-utensils-crossed`
  expect(firstTileIconClass).toMatch(/lucide/);
});
