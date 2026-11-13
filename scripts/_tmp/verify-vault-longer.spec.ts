import { test } from "@playwright/test";

test("vault · longer wait for streaming", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: "http://localhost:3015" },
  ]);
  await page.goto("http://localhost:3015/nex-native/vault/intro", { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(3000);
  console.log("URL:", page.url());
  await page.screenshot({ path: `${testInfo.outputDir}/vault-settled.png`, fullPage: false });
});
