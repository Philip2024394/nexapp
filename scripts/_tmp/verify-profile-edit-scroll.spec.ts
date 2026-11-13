import { test } from "@playwright/test";
test("profile edit mode · header visible, scrolling works", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3009/nex-native/profile/nex-99901?mode=edit", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${info.outputDir}/01-top.png`, fullPage: false });

  const main = page.locator("main[data-nex-profile-root]").first();
  const scrollHeight = await main.evaluate((el) => el.scrollHeight);
  const clientHeight = await main.evaluate((el) => el.clientHeight);
  console.log("scrollHeight:", scrollHeight, "clientHeight:", clientHeight);

  // Scroll to the bottom to prove it moves
  await main.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${info.outputDir}/02-bottom.png`, fullPage: false });

  // Scroll back to top
  await main.evaluate((el) => el.scrollTo({ top: 0 }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${info.outputDir}/03-top-again.png`, fullPage: false });
});
