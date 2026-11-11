import { test } from "@playwright/test";
test("preview modal · full phone + black header + use theme/close footer", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3009/nex-native/chat-themes-library/all", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  // Wait for grid to render
  await page.waitForSelector("[data-nex-library-full-tile]", { timeout: 20_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${info.outputDir}/01-grid.png`, fullPage: false });

  // Click the small orange Preview button on the first tile
  const previewBtn = page.locator("[data-nex-library-tile-preview]").first();
  await previewBtn.scrollIntoViewIfNeeded();
  await previewBtn.click();
  await page.waitForSelector("[data-nex-library-phone-preview]", { timeout: 10_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${info.outputDir}/02-preview-modal.png`, fullPage: false });

  const modal = page.locator("[data-nex-library-phone-preview]");
  const title = await modal.locator("h2").first().textContent().catch(() => null);
  const buttons = await modal.locator("button").allTextContents();
  console.log("MODAL TITLE:", title);
  console.log("BUTTONS:", buttons);
});
