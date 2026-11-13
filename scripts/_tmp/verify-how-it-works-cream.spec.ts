import { test } from "@playwright/test";
test("how it works sheet · cream background", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3009/nex-native/free-chat?show-themes=1", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2500);

  // Try the info chip inside CHOOSE 1 FREE THEME panel
  const infoBtn = page.locator("button[aria-label*='How'], button[aria-label*='info'], [data-nex-how-it-works-trigger]").first();
  if (await infoBtn.count()) {
    await infoBtn.click();
  } else {
    // Fallback: try the circular `i` icon in the title area
    const titleArea = page.locator("text=/CHOOSE 1 FREE THEME/").first();
    const box = await titleArea.boundingBox();
    if (box) await page.mouse.click(box.x + box.width + 10, box.y + box.height / 2);
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${info.outputDir}/01-sheet.png`, fullPage: false });
});
