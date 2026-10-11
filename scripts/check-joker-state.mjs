#!/usr/bin/env node
import { chromium } from "playwright";
const EXE =
  "C:\\Users\\Victus\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto("http://localhost:3010/nex-native/themes/theme-0", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(1500);

// Header R1 cluster colour (should carry joker accent #8FFF6E)
const nativeCluster = page.locator('[data-nex-native-r1-cluster]');
console.log(`native R1 cluster present: ${(await nativeCluster.count()) > 0}`);
if ((await nativeCluster.count()) > 0) {
  const style = await nativeCluster.first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { display: cs.display, visibility: cs.visibility, color: cs.color };
  });
  console.log(`cluster style: ${JSON.stringify(style)}`);
  const buttons = await nativeCluster.locator('button, a').all();
  console.log(`buttons in cluster: ${buttons.length}`);
  for (const [i, b] of buttons.entries()) {
    const label = await b.getAttribute("aria-label");
    const bg = await b.evaluate((el) => getComputedStyle(el).backgroundColor);
    const border = await b.evaluate((el) => getComputedStyle(el).borderColor);
    console.log(`  [${i}] ${label}  bg=${bg}  border=${border}`);
  }
}

// Shop button detection
const shopBtn = page.locator('[aria-label*="hop"]');
console.log(`\nShop buttons: ${await shopBtn.count()}`);

// Emoji picker trigger
const emojiBtn = page.locator('[aria-label="Open emoji picker"], [aria-label="Insert emoji"]');
console.log(`Emoji picker triggers: ${await emojiBtn.count()}`);

// Try opening the shop
if ((await shopBtn.count()) > 0) {
  console.log("\n[opening Shop]");
  await shopBtn.first().click();
  await page.waitForTimeout(1200);
  const sheet = await page.locator('[role="dialog"][aria-label*="product"]').first();
  const sheetBox = await sheet.boundingBox().catch(() => null);
  console.log(`shop sheet bounding box: ${JSON.stringify(sheetBox)}`);
  const viewportWidth = 390;
  if (sheetBox) {
    console.log(
      `  sheet width ${sheetBox.width}px vs viewport ${viewportWidth}px · ${
        Math.abs(sheetBox.width - viewportWidth) < 2 ? "FITS" : "MISMATCH"
      }`,
    );
  }
}

await browser.close();
