import { test } from "@playwright/test";
test("visual library · no header, dropdown, gray count, modal + magnifier", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3009/nex-native/library/backgrounds?context=chat", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${info.outputDir}/01-library.png`, fullPage: false });

  // Open the first tile preview
  const firstTile = page.locator("[data-nex-library-tile]").first();
  if (await firstTile.count()) {
    await firstTile.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${info.outputDir}/02-preview-modal.png`, fullPage: false });

    // Click magnifier
    const zoomBtn = page.locator("[data-nex-library-zoom]").first();
    if (await zoomBtn.count()) {
      await zoomBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${info.outputDir}/03-lightbox.png`, fullPage: false });
    }
  }
});
