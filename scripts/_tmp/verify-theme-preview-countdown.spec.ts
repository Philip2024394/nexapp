import { test } from "@playwright/test";
test("theme preview · containers hide 5s + countdown appears", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3009/nex-native/free-chat?show-themes=1", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${info.outputDir}/01-before-pick.png`, fullPage: false });

  // Pick the 2nd tile (Teddy Bear slot · after NEX default)
  const tiles = page.locator("[data-nex-free-chat-first-visit-tile]");
  const count = await tiles.count();
  console.log("tile count:", count);
  if (count > 1) await tiles.nth(1).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${info.outputDir}/02-countdown-start.png`, fullPage: false });

  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${info.outputDir}/03-countdown-mid.png`, fullPage: false });

  // After ~6s the containers should have reappeared
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${info.outputDir}/04-containers-back.png`, fullPage: false });
});
