import { test } from "@playwright/test";

test("desktop · new golden backdrop behind phone frame", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: "http://localhost:3016" },
  ]);
  await page.goto("http://localhost:3016/nex-native/free-chat", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${testInfo.outputDir}/desktop-golden.png` });
});
