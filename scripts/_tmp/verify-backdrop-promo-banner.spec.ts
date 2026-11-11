import { test } from "@playwright/test";

test("desktop · new promotional banner backdrop", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: "http://localhost:3017" },
  ]);
  await page.goto("http://localhost:3017/nex-native/free-chat", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${testInfo.outputDir}/desktop-promo-banner.png` });
});

test("tablet · new promotional banner backdrop", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: "http://localhost:3017" },
  ]);
  await page.goto("http://localhost:3017/nex-native/free-chat", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${testInfo.outputDir}/tablet-promo-banner.png` });
});
