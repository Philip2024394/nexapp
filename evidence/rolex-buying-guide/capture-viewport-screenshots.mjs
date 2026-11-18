// Viewport-only screenshots (readable detail) · Rolex redesign 2026-11-18.

import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "screenshots-redesign-2026-11-18");
fs.mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:3008";

async function run() {
  const browser = await chromium.launch();

  // Desktop viewport
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();

    // Rolex top (hero + TOC visible)
    await page.goto(`${BASE}/nex-generated/buying-guides/rolex`, {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      path: resolve(OUT, "vp-desktop-01-rolex-hero.png"),
      fullPage: false,
    });

    // Drawer open
    const trig = page.locator('[data-nex-control-drawer-trigger="true"]').first();
    await trig.scrollIntoViewIfNeeded();
    await trig.click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: resolve(OUT, "vp-desktop-02-drawer-open.png"),
      fullPage: false,
    });
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(200);

    // History (timeline)
    await page.evaluate(() =>
      document.getElementById("history")?.scrollIntoView({ block: "start" })
    );
    await page.waitForTimeout(200);
    await page.screenshot({
      path: resolve(OUT, "vp-desktop-03-history.png"),
      fullPage: false,
    });

    // Market value banner
    await page.evaluate(() =>
      document
        .getElementById("market-value")
        ?.scrollIntoView({ block: "start" })
    );
    await page.waitForTimeout(200);
    await page.screenshot({
      path: resolve(OUT, "vp-desktop-04-market-value.png"),
      fullPage: false,
    });

    // Seller CTA
    await page.evaluate(() =>
      document.getElementById("for-sellers")?.scrollIntoView({ block: "start" })
    );
    await page.waitForTimeout(200);
    await page.screenshot({
      path: resolve(OUT, "vp-desktop-05-seller-cta.png"),
      fullPage: false,
    });

    // Index page
    await page.goto(`${BASE}/nex-generated/buying-guides`, {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      path: resolve(OUT, "vp-desktop-06-index.png"),
      fullPage: false,
    });

    await ctx.close();
  }

  // Tablet viewport (iPad portrait · 820x1180)
  {
    const ctx = await browser.newContext({
      viewport: { width: 820, height: 1180 },
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: true,
    });
    const page = await ctx.newPage();

    // Rolex top (phone frame centered on tablet)
    await page.goto(`${BASE}/nex-generated/buying-guides/rolex`, {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      path: resolve(OUT, "vp-tablet-01-rolex-hero.png"),
      fullPage: false,
    });

    // Drawer open on tablet
    const trig = page.locator('[data-nex-control-drawer-trigger="true"]').first();
    await trig.scrollIntoViewIfNeeded();
    await trig.click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: resolve(OUT, "vp-tablet-02-drawer-open.png"),
      fullPage: false,
    });
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(200);

    // Index page on tablet
    await page.goto(`${BASE}/nex-generated/buying-guides`, {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      path: resolve(OUT, "vp-tablet-03-index.png"),
      fullPage: false,
    });

    await ctx.close();
  }

  // Mobile viewport
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/nex-generated/buying-guides/rolex`, {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      path: resolve(OUT, "vp-mobile-01-rolex-hero.png"),
      fullPage: false,
    });

    const trig = page.locator('[data-nex-control-drawer-trigger="true"]').first();
    await trig.click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: resolve(OUT, "vp-mobile-02-drawer-open.png"),
      fullPage: false,
    });

    await ctx.close();
  }

  await browser.close();
  console.log("Viewport screenshots in", OUT);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
