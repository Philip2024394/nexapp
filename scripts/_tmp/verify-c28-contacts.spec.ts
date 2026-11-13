import { test } from "@playwright/test";

const BASE = "http://localhost:3022";

test("C28 · contacts header + scroll", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: BASE },
  ]);
  await page.goto(`${BASE}/nex-native/contacts`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${testInfo.outputDir}/c28-top.png`, fullPage: false });

  // Try to scroll the phone frame and capture the lower rows.
  const scrolled = await page.evaluate(() => {
    const frame = document.querySelector('.nex-native-frame') as HTMLElement | null;
    if (!frame) return { ok: false, scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
    frame.scrollTop = 800;
    return {
      ok: true,
      scrollTop: frame.scrollTop,
      scrollHeight: frame.scrollHeight,
      clientHeight: frame.clientHeight,
    };
  });
  console.log(`\n=== scroll state ===`);
  console.log(`  frame scrollHeight: ${scrolled.scrollHeight}`);
  console.log(`  frame clientHeight: ${scrolled.clientHeight}`);
  console.log(`  frame scrollTop (after setting 800): ${scrolled.scrollTop}`);
  console.log(`  scrollable: ${scrolled.scrollHeight > scrolled.clientHeight}`);
  console.log(`  scrolled successfully: ${scrolled.scrollTop > 0}`);

  await page.waitForTimeout(500);
  await page.screenshot({ path: `${testInfo.outputDir}/c28-scrolled.png`, fullPage: false });
});
