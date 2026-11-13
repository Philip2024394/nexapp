import { test } from "@playwright/test";

test("C27 · wait for real contacts content", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: "http://localhost:3019" },
  ]);
  await page.goto("http://localhost:3019/nex-native/contacts", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });

  // Poll for actual rendered text (not just skeleton HTML).
  let foundText = false;
  for (let i = 0; i < 40; i++) {
    const text = await page.evaluate(() => (document.body.textContent || "").replace(/\s+/g, " ").trim().slice(0, 500));
    if (text.includes("Contacts") || text.includes("Friends") || text.includes("Aoife") || text.includes("ALL")) {
      console.log(`  content at ~${500 * (i + 1)}ms:`, text.slice(0, 200));
      foundText = true;
      break;
    }
    await page.waitForTimeout(500);
  }
  if (!foundText) {
    const text = await page.evaluate(() => (document.body.textContent || "").slice(0, 300));
    console.log(`  TIMEOUT · body text:`, text);
  }
  await page.screenshot({ path: `${testInfo.outputDir}/c27-final.png`, fullPage: true });
});
