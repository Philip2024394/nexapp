import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto("http://localhost:3008/nex-native/product/preview", { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(600);
const t = await p.locator("[data-nex-product-read-toggle]");
if (await t.count() > 0) await t.click();
await p.waitForTimeout(400);
const info = await p.evaluate(() => {
  // Walk from the deepest child upward and record heights/overflow
  const target = document.querySelector("[data-nex-product-specs]") || document.querySelector("[data-nex-product-page-v2]");
  const chain = [];
  let el = target;
  while (el && el !== document.documentElement) {
    const cs = getComputedStyle(el);
    chain.push({
      tag: el.tagName,
      cls: el.className?.toString()?.slice(0, 60) || "",
      data: Array.from(el.attributes).filter(a => a.name.startsWith("data-")).map(a => a.name).join(","),
      h: el.clientHeight,
      sh: el.scrollHeight,
      ovY: cs.overflowY,
      hRule: cs.height,
      maxH: cs.maxHeight,
      pos: cs.position,
    });
    el = el.parentElement;
  }
  return chain;
});
console.log(JSON.stringify(info, null, 2));
await b.close();
