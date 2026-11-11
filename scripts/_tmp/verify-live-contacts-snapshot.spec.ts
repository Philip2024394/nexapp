import { test } from "@playwright/test";

test("live contacts snapshot", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: "https://nex-ireland-preview.vercel.app" },
  ]);
  await page.goto("https://nex-ireland-preview.vercel.app/nex-native/contacts", { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${testInfo.outputDir}/contacts-live.png`, fullPage: true });
});
