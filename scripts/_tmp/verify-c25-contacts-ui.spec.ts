import { test } from "@playwright/test";

test("c25 · contacts UI snapshot", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: "http://localhost:3017" },
  ]);
  await page.goto("http://localhost:3017/nex-native/contacts", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  // Long wait for the destination retry loop (pre-existing bug) to stabilise.
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${testInfo.outputDir}/contacts-c25.png`, fullPage: true });
});
