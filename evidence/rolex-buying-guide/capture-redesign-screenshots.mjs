// Screenshot capture · Rolex buying-guide redesign (2026-11-18).
// Captures: desktop guides index + rolex, 390px guides index + rolex,
// desktop with drawer open, 390px with drawer open.

import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "screenshots-redesign-2026-11-18");

const BASE = "http://localhost:3008";

async function shot(page, name) {
  const file = resolve(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("  →", name + ".png");
}

async function run() {
  const fs = await import("fs");
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();

  // ── Desktop ──────────────────────────────────────────────
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    console.log("Desktop @ 1280x900");

    await page.goto(`${BASE}/nex-generated/buying-guides`, {
      waitUntil: "networkidle",
    });
    await shot(page, "desktop-01-guides-index");

    await page.goto(`${BASE}/nex-generated/buying-guides/rolex`, {
      waitUntil: "networkidle",
    });
    await shot(page, "desktop-02-rolex-top");

    // Open drawer
    const trigger = page.locator('[data-nex-control-drawer-trigger="true"]');
    if ((await trigger.count()) > 0) {
      await trigger.first().click();
      await page.waitForTimeout(400);
      await shot(page, "desktop-03-drawer-open");
      // Close
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(200);
    } else {
      console.log("  ! drawer trigger not found on desktop");
    }

    // Scroll to show timeline + market value
    await page.goto(`${BASE}/nex-generated/buying-guides/rolex#history`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(200);
    await shot(page, "desktop-04-rolex-history");

    await page.goto(`${BASE}/nex-generated/buying-guides/rolex#market-value`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(200);
    await shot(page, "desktop-05-rolex-market-value");

    await page.goto(`${BASE}/nex-generated/buying-guides/rolex#for-sellers`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(200);
    await shot(page, "desktop-06-rolex-seller-block");

    await ctx.close();
  }

  // ── 390px (iPhone 14 Pro width) ──────────────────────────
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    console.log("Mobile @ 390x844");

    await page.goto(`${BASE}/nex-generated/buying-guides`, {
      waitUntil: "networkidle",
    });
    await shot(page, "mobile-01-guides-index");

    await page.goto(`${BASE}/nex-generated/buying-guides/rolex`, {
      waitUntil: "networkidle",
    });
    await shot(page, "mobile-02-rolex-top");

    // Open drawer on mobile
    const trigger = page.locator('[data-nex-control-drawer-trigger="true"]');
    if ((await trigger.count()) > 0) {
      await trigger.first().click();
      await page.waitForTimeout(400);
      await shot(page, "mobile-03-drawer-open");
    } else {
      console.log("  ! drawer trigger not found on mobile");
    }

    await ctx.close();
  }

  await browser.close();
  console.log("\nDone. Screenshots in", OUT);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
