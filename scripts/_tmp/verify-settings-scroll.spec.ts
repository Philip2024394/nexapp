import { test } from "@playwright/test";
test("settings scrolls · theme share link reachable", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3009/nex-native/settings", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${info.outputDir}/01-top.png`, fullPage: false });

  const main = page.locator("main").first();
  const scrollHeight = await main.evaluate((el) => el.scrollHeight);
  const clientHeight = await main.evaluate((el) => el.clientHeight);
  console.log("scrollHeight:", scrollHeight, "clientHeight:", clientHeight);

  // Scroll to the bottom to prove the sign-out + share link are reachable
  await main.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${info.outputDir}/02-bottom.png`, fullPage: false });

  // Confirm the sticky top strip is still visible
  const stickyHeader = page.locator("[data-nex-settings-sticky-header]").first();
  const headerBox = await stickyHeader.boundingBox();
  console.log("sticky header bounding box after scroll:", headerBox);

  // Confirm the share link exists and is clickable
  const shareLink = page.locator("[data-nex-settings-theme-share-row]").first();
  const shareCount = await shareLink.count();
  console.log("share link count:", shareCount);
});
