import { test } from "@playwright/test";

test("category sheet · icons sit directly above the label text", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-5", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator("[data-nex-video-viewer-search]").click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/category-icons-down.png", fullPage: false });
  const measure = await page.locator("[data-nex-category-tile]").first().evaluate((btn) => {
    const b = (btn as HTMLElement).getBoundingClientRect();
    const icon = btn.querySelector("[data-nex-category-tile-icon]") as HTMLElement | null;
    const moon = btn.querySelector("[data-nex-category-tile-moon]") as HTMLElement | null;
    const ir = icon?.getBoundingClientRect();
    const mr = moon?.getBoundingClientRect();
    return {
      tileH: Math.round(b.height),
      iconCenterPct: ir ? Math.round(((ir.top + ir.height / 2) - b.top) / b.height * 100) : null,
      moonTopPct: mr ? Math.round((mr.top - b.top) / b.height * 100) : null,
      gapPct: ir && mr ? Math.round((mr.top - (ir.top + ir.height)) / b.height * 100) : null,
    };
  });
  console.log(JSON.stringify(measure));
});
