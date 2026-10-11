import { chromium } from "playwright";
const EXE =
  "C:\\Users\\Victus\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:3010/nex-native/themes/theme-0", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(1200);
const shop = page.locator('[aria-label*="hop"]').first();
await shop.click();
await page.waitForTimeout(1200);
const buttons = await page.locator('a:has-text("Sell"), a:has-text("Affiliate")').all();
console.log(`setup buttons found: ${buttons.length}`);
for (const btn of buttons) {
  const box = await btn.boundingBox();
  const style = await btn.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      backgroundImage: s.backgroundImage.slice(0, 100),
      borderTopColor: s.borderTopColor,
      width: s.width,
    };
  });
  console.log(" ", JSON.stringify({ ...box, ...style }));
}
await browser.close();
