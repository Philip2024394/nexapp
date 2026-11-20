// Quick probe · capture the right-side drawer open at mobile viewport.
import { chromium } from "playwright";
const BASE = "http://localhost:3008";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
await page.goto(`${BASE}/nex-generated/buying-guides/rolex`, { waitUntil: "networkidle" });
const trigger = await page.locator("[data-nex-control-drawer-trigger]").first();
await trigger.click();
await page.waitForSelector('[data-nex-control-drawer][data-nex-control-drawer-visible="true"]', { timeout: 3000 });
await page.waitForTimeout(400);
await page.screenshot({ path: "C:/tmp/drawer-mobile-current.png", fullPage: false });
const box = await page.locator("[data-nex-control-drawer]").boundingBox();
const frameBox = await page.locator(".nex-native-frame").first().boundingBox();
console.log("drawer:", JSON.stringify(box));
console.log("frame :", JSON.stringify(frameBox));
await browser.close();
