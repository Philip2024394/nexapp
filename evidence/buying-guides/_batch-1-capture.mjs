// evidence/buying-guides/_batch-1-capture.mjs
//
// Batch 1 verification screenshots · 2026-11-17
// Captures viewport screenshots of the 6 Batch-1 guides + the index
// page at desktop (1440×900) and mobile (390×844) viewports.
//
// Run from the nexapp repo root with the dev server already up
// at http://localhost:3008:
//   node evidence/buying-guides/_batch-1-capture.mjs
//
// Pattern follows evidence/rolex-buying-guide/capture-viewport-screenshots.mjs
// (sealed utility — do not modify that file; this is Batch-1-specific).

import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "_batch-1-verification-screenshots");
fs.mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:3008";

const ROUTES = [
  { slug: "index", url: "/nex-generated/buying-guides" },
  { slug: "rolex", url: "/nex-generated/buying-guides/rolex" },
  { slug: "mobile-phones", url: "/nex-generated/buying-guides/mobile-phones" },
  { slug: "handbags", url: "/nex-generated/buying-guides/handbags" },
  { slug: "laptops", url: "/nex-generated/buying-guides/laptops" },
  { slug: "running-shoes", url: "/nex-generated/buying-guides/running-shoes" },
  { slug: "leather-wallets", url: "/nex-generated/buying-guides/leather-wallets" },
];

async function run() {
  const browser = await chromium.launch();

  // Desktop viewport
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();

    for (const route of ROUTES) {
      await page.goto(`${BASE}${route.url}`, { waitUntil: "networkidle" });
      await page.screenshot({
        path: resolve(OUT, `desktop-${route.slug}.png`),
        fullPage: false,
      });
      console.log(`desktop  ${route.slug} ✓`);
    }

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

    for (const route of ROUTES) {
      await page.goto(`${BASE}${route.url}`, { waitUntil: "networkidle" });
      await page.screenshot({
        path: resolve(OUT, `mobile-${route.slug}.png`),
        fullPage: false,
      });
      console.log(`mobile   ${route.slug} ✓`);
    }

    await ctx.close();
  }

  await browser.close();
  console.log("Batch-1 viewport screenshots in", OUT);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
