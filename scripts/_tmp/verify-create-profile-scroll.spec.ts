import { test } from "@playwright/test";
test("create profile scrolls · from=signup variant", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3009/nex-native/settings/profile/edit?from=signup", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2500);
  const main = page.locator("main[data-nex-profile-edit]").first();
  const sh = await main.evaluate((el) => el.scrollHeight);
  const ch = await main.evaluate((el) => el.clientHeight);
  console.log("scrollHeight:", sh, "clientHeight:", ch);
  await page.screenshot({ path: `${info.outputDir}/01-top.png`, fullPage: false });
  await main.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${info.outputDir}/02-bottom.png`, fullPage: false });
});
