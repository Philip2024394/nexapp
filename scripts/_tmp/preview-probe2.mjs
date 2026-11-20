import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto("http://localhost:3008/nex-native/product/preview", { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(600);
const t = p.locator("[data-nex-product-read-toggle]");
await t.click();
await p.waitForTimeout(400);
const root = await p.evaluate(() => {
  const r = document.querySelector("[data-nex-product-page].nex-native-root");
  return r ? { sh: r.scrollHeight, h: r.clientHeight, ov: getComputedStyle(r).overflowY, canScroll: r.scrollHeight > r.clientHeight } : null;
});
console.log("preview root:", JSON.stringify(root));
// Try scrolling it
await p.evaluate(() => {
  const r = document.querySelector("[data-nex-product-page].nex-native-root");
  if (r) r.scrollTo(0, 500);
});
await p.waitForTimeout(200);
const scrolled = await p.evaluate(() => {
  const r = document.querySelector("[data-nex-product-page].nex-native-root");
  return r ? r.scrollTop : -1;
});
console.log("scrollTop after scrollTo(0,500):", scrolled);
await b.close();
