import { test } from "@playwright/test";

test("feed · central discovery · post-fix", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  const resp = await page.goto("http://localhost:3008/nex-native/live-commerce/feed", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  console.log("FEED_HTTP_STATUS=" + (resp?.status() ?? "n/a"));
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: "tests/e2e-screenshots/preview-pass-2026-10-25/04-feed-after-fix.png",
    fullPage: true,
  });
  const videoCount = await page.locator("video").count();
  const liveChips = await page.locator("text=/^LIVE$/").count();
  console.log("FEED_VIDEO_ELEMENTS=" + videoCount);
  console.log("FEED_LIVE_CHIPS=" + liveChips);
});

test("feed · after scroll · more cards", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/live-commerce/feed", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: "tests/e2e-screenshots/preview-pass-2026-10-25/05-feed-scrolled.png",
    fullPage: false,
  });
});
