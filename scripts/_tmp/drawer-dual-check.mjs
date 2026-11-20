// Drawer verification · desktop + mobile · scrollbar + full-height.
import { chromium } from "playwright";
import fs from "fs";
const OUT = "evidence/buying-guides/_drawer-verify";
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3008";

const browser = await chromium.launch();

// Desktop · drawer should stay inside 288x624 phone frame.
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/nex-generated/buying-guides/rolex`, { waitUntil: "networkidle" });
  await page.locator("[data-nex-control-drawer-trigger]").first().click();
  await page.waitForSelector('[data-nex-control-drawer][data-nex-control-drawer-visible="true"]', { timeout: 3000 });
  await page.waitForTimeout(400);
  const drawer = await page.locator("[data-nex-control-drawer]").boundingBox();
  const frame = await page.locator(".nex-native-frame").first().boundingBox();
  console.log("DESKTOP drawer:", JSON.stringify(drawer));
  console.log("DESKTOP frame :", JSON.stringify(frame));
  await page.screenshot({ path: `${OUT}/desktop-drawer-open.png`, fullPage: false });
  await ctx.close();
}

// Mobile · drawer should be full viewport height.
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/nex-generated/buying-guides/rolex`, { waitUntil: "networkidle" });
  await page.locator("[data-nex-control-drawer-trigger]").first().click();
  await page.waitForSelector('[data-nex-control-drawer][data-nex-control-drawer-visible="true"]', { timeout: 3000 });
  await page.waitForTimeout(400);
  const drawer = await page.locator("[data-nex-control-drawer]").boundingBox();
  const frame = await page.locator(".nex-native-frame").first().boundingBox();
  console.log("MOBILE  drawer:", JSON.stringify(drawer));
  console.log("MOBILE  frame :", JSON.stringify(frame));
  await page.screenshot({ path: `${OUT}/mobile-drawer-open-top.png`, fullPage: false });
  // Scroll page 2000px and screenshot · the drawer should still cover full viewport.
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/mobile-drawer-open-scrolled.png`, fullPage: false });
  await ctx.close();
}

await browser.close();
console.log("done");
