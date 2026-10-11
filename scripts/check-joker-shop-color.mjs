import { chromium } from "playwright";
const EXE =
  "C:\\Users\\Victus\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto("http://localhost:3010/nex-native/themes/theme-0", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(1500);
const shopBtn = page.locator('[aria-label*="hop"]').first();
await shopBtn.click();
await page.waitForTimeout(1200);

const sheet = page.locator('[role="dialog"][aria-label*="product"]').first();
const style = await sheet.evaluate((el) => {
  const cs = getComputedStyle(el);
  return {
    borderTopColor: cs.borderTopColor,
    boxShadow: cs.boxShadow,
    width: cs.width,
  };
});
console.log("shop sheet rim colour:", JSON.stringify(style, null, 2));
await browser.close();
