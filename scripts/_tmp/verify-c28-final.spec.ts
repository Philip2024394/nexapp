import { test } from "@playwright/test";

test("C28 final · black drawer + white plus", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: "http://localhost:3024" },
  ]);
  await page.goto("http://localhost:3024/nex-native/contacts", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${testInfo.outputDir}/c28-final-top.png`, fullPage: false });

  // Verify the inner button's computed background.
  const bg = await page.evaluate(() => {
    const btn = document.querySelector('[data-nex-contacts-global-drawer] button') as HTMLElement | null;
    return btn ? getComputedStyle(btn).backgroundColor : null;
  });
  console.log("drawer button bg:", bg);
});
