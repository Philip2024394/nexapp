import { test } from "@playwright/test";
test("ireland 6-theme picker · teddy bear in slot 2", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3009/nex-native/free-chat?show-themes=1", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${info.outputDir}/free-chat-themes.png`, fullPage: false });
});
