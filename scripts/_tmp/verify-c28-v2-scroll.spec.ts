import { test, expect } from "@playwright/test";

test("C28 v2 · scroll works + visual", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: "http://localhost:3023" },
  ]);
  await page.goto("http://localhost:3023/nex-native/contacts", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(4000);

  await page.screenshot({ path: `${testInfo.outputDir}/c28-v2-top.png`, fullPage: false });

  // Scroll the contacts-root main (now its own scroll container).
  const scrolled = await page.evaluate(() => {
    const main = document.querySelector('[data-nex-contacts-root]') as HTMLElement | null;
    if (!main) return { ok: false };
    main.scrollTop = 500;
    return {
      ok: true,
      scrollTop: main.scrollTop,
      scrollHeight: main.scrollHeight,
      clientHeight: main.clientHeight,
    };
  });
  console.log(`\n=== main scroll ===`);
  console.log(`  scrollHeight: ${scrolled.scrollHeight}, clientHeight: ${scrolled.clientHeight}`);
  console.log(`  scrollTop after setting 500: ${scrolled.scrollTop}`);
  console.log(`  scrollable: ${(scrolled.scrollHeight ?? 0) > (scrolled.clientHeight ?? 0)}`);

  await page.waitForTimeout(500);
  await page.screenshot({ path: `${testInfo.outputDir}/c28-v2-scrolled.png`, fullPage: false });

  expect(scrolled.scrollTop, "scroll must work on contacts-root").toBeGreaterThan(0);
});
