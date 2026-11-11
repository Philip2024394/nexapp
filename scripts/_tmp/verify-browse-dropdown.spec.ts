import { test } from "@playwright/test";
test("browse dropdown visual check", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3009/nex-native/chat-themes-library/all", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("[data-nex-chat-library-cta]", { timeout: 20_000 });
  await page.screenshot({ path: `${info.outputDir}/closed.png`, fullPage: false });
  // click the pill
  await page.locator("[data-nex-chat-library-cta] button").click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${info.outputDir}/open.png`, fullPage: false });
});
