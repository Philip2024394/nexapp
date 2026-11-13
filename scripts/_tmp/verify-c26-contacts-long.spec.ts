import { test } from "@playwright/test";

test("C26 · contacts long wait", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: "http://localhost:3018" },
  ]);
  await page.goto("http://localhost:3018/nex-native/contacts", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  // Very long wait + poll for real content
  for (let i = 0; i < 30; i++) {
    const chars = await page.evaluate(() => {
      const r = document.querySelector('[data-nex-page-slide-root]');
      return r ? r.innerHTML.length : 0;
    });
    if (chars > 5000) {
      await page.waitForTimeout(500);
      break;
    }
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: `${testInfo.outputDir}/c26-long.png`, fullPage: true });
});
