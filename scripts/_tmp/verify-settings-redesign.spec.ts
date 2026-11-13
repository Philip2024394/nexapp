import { test } from "@playwright/test";
test("settings redesign · landscape rows + white panel + no blue header", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3009/nex-native/settings", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${info.outputDir}/settings-top.png`, fullPage: false });
  await page.screenshot({ path: `${info.outputDir}/settings-full.png`, fullPage: true });
});
