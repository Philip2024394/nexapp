// Capture the frame while it's actively scrolled so the orange thin
// scrollbar is visible in the shot.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "screenshots-redesign-2026-11-18");

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto("http://localhost:3008/nex-generated/buying-guides/rolex", {
  waitUntil: "networkidle",
});

// Scroll the inner frame (not the window).
await page.evaluate(() => {
  const frame = document.querySelector(".nex-native-frame");
  if (frame) frame.scrollTop = 400;
});
await page.waitForTimeout(400);
await page.screenshot({
  path: resolve(OUT, "vp-desktop-07-scrollbar.png"),
  fullPage: false,
});
await browser.close();
console.log("wrote vp-desktop-07-scrollbar.png");
