import { test } from "@playwright/test";
test("full library 450 + no Chat Themes header", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3009/nex-native/chat-themes-library/all", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3000);
  const themesLine = await page.locator("text=/[0-9]+ themes · page/").textContent().catch(() => null);
  console.log("themes line:", themesLine);
  await page.screenshot({ path: `${info.outputDir}/top.png`, fullPage: false });
});
