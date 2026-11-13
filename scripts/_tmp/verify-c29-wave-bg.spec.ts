import { test } from "@playwright/test";

test("C29 · contacts with wave bg", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: "http://localhost:3025" },
  ]);
  await page.goto("http://localhost:3025/nex-native/contacts", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${testInfo.outputDir}/c29-top.png`, fullPage: false });

  const main = await page.evaluate(() => {
    const m = document.querySelector('[data-nex-contacts-root]') as HTMLElement | null;
    if (!m) return null;
    m.scrollTop = 600;
    return { scrollTop: m.scrollTop, scrollHeight: m.scrollHeight };
  });
  console.log("scroll:", main);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${testInfo.outputDir}/c29-scrolled.png`, fullPage: false });
});
