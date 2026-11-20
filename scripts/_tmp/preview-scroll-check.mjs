import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto("http://localhost:3008/nex-native/product/preview", { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(600);
// find scroll container
const info = await p.evaluate(() => {
  const frame = document.querySelector(".nex-native-frame");
  const slideRoot = document.querySelector("[data-nex-page-slide-root]");
  return {
    frame: frame ? {
      scrollHeight: frame.scrollHeight,
      clientHeight: frame.clientHeight,
      overflowY: getComputedStyle(frame).overflowY,
      canScroll: frame.scrollHeight > frame.clientHeight,
    } : null,
    slideRoot: slideRoot ? {
      scrollHeight: slideRoot.scrollHeight,
      clientHeight: slideRoot.clientHeight,
    } : null,
  };
});
console.log("collapsed:", JSON.stringify(info, null, 2));
const t = p.locator("[data-nex-product-read-toggle]");
if (await t.count() > 0) {
  await t.click();
  await p.waitForTimeout(400);
  const after = await p.evaluate(() => {
    const frame = document.querySelector(".nex-native-frame");
    return frame ? { scrollHeight: frame.scrollHeight, clientHeight: frame.clientHeight, canScroll: frame.scrollHeight > frame.clientHeight } : null;
  });
  console.log("expanded:", JSON.stringify(after, null, 2));
  // try scrolling the frame
  await p.evaluate(() => {
    const frame = document.querySelector(".nex-native-frame");
    if (frame) frame.scrollTo(0, 500);
  });
  await p.waitForTimeout(200);
  const scrolled = await p.evaluate(() => {
    const frame = document.querySelector(".nex-native-frame");
    return frame ? frame.scrollTop : -1;
  });
  console.log("frame.scrollTop after scrollTo(0,500):", scrolled);
}
await b.close();
