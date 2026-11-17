#!/usr/bin/env node
// scripts/_tmp/review-demo-shots.mjs
//
// Owner-authorised 2026-11-16 · MOCK-ONLY review-demo evidence.
// Captures the review journey at 390×844 (iPhone-class) viewport:
//   01 · preview product · rating row rendered from demo store
//   02 · reviews list popup open · 4 seed reviews visible
//   03 · post popup · stars selected, body filled
//   04 · product page after post · average updated
//   05 · chat home · notifications drawer open · 3 demo orders
//   06 · drawer · order 2 expanded (3 products · per-item review buttons)
//   07 · drawer · order 3 expanded (6+ products · scrolling inside drawer)
//   08 · drawer · post popup opened from a drawer row
//   09 · demo flag OFF · preview route renders (no reload loop)
//
// Mirrors the product-preview-shot.mjs pattern. No DB writes.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const OUT = "evidence/review-demo";
mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:3008";
const VIEWPORT = { width: 390, height: 844 };

async function shot(page, name) {
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(OUT, name),
    fullPage: false,
  });
  console.log("  shot:", name);
}

async function withPageAt(ctx, url, cb) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(600);
  try {
    await cb(page);
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
});

// Helper · wipe sessionStorage between scenarios so each script run
// is deterministic.
async function resetSession(page) {
  try {
    await page.evaluate(() => {
      try {
        sessionStorage.clear();
        // Keep the review store localStorage entry for state continuity
        // between related shots, but clear it at script start.
      } catch {}
    });
  } catch {}
}

console.log("[review-demo-shots] starting");

// ─── 01 · preview with reviews ────────────────────────────────────
await withPageAt(ctx, `${BASE}/nex-native/product/preview?reviewDemo=1`, async (page) => {
  // The PreviewDemoEnabler reloads once on first hit, so give it a
  // beat and wait for the product page to render.
  await page.waitForTimeout(1200);
  try {
    await page.waitForSelector("[data-nex-product-page-v2]", { timeout: 15_000 });
  } catch {
    // older marker · fall through
  }
  await shot(page, "01-preview-with-rating.png");

  // Tap the rating row to open the reviews list.
  const rating = page.locator("[data-nex-product-rating]").first();
  if ((await rating.count()) > 0) {
    await rating.click();
    await page.waitForSelector("[data-nex-reviews-list-popup]", { timeout: 5000 });
    await shot(page, "02-reviews-list-open.png");

    // Tap "Leave a review" to open the post popup.
    const leave = page.locator("[data-nex-reviews-list-leave]");
    await leave.click();
    await page.waitForSelector("[data-nex-review-post-popup]", { timeout: 5000 });

    // Select 5 stars, type a body.
    await page.locator("[data-nex-review-post-star='5']").click();
    await page.locator("[data-nex-review-post-body]").fill("Great piece — fits perfectly. Would recommend.");
    await shot(page, "03-post-popup-filled.png");

    // Submit.
    await page.locator("[data-nex-review-post-submit]").click();
    await page.waitForTimeout(900);
    await shot(page, "04-after-post-updated.png");
  } else {
    console.log("  [warn] rating row not found · demo flag may not be active");
  }
});

// ─── 05 · drawer open · 3 demo orders ─────────────────────────────
// The notifications drawer is mounted inside the chat shell. Use the
// chat home or free-chat landing surface to get at the bell trigger.
// Keep the reviewDemo flag set via the preview route navigation chain.
await withPageAt(ctx, `${BASE}/nex-native/free-chat?reviewDemo=1`, async (page) => {
  await page.waitForTimeout(1500);
  // Find the bell trigger.
  const trigger = page.locator("[data-nex-notifications-trigger]").first();
  const count = await trigger.count();
  if (count === 0) {
    console.log("  [warn] no notifications trigger on free-chat");
    return;
  }
  await trigger.click();
  await page.waitForSelector("[data-nex-notifications-drawer][data-nex-notifications-drawer-visible='true']", { timeout: 5000 });
  await shot(page, "05-drawer-open-with-orders.png");

  // Expand order 2 (the 3-product order).
  const toggles = page.locator("[data-nex-order-placed-toggle]");
  const n = await toggles.count();
  console.log("  drawer toggles found:", n);
  if (n >= 2) {
    await toggles.nth(1).click();
    await page.waitForTimeout(350);
    await shot(page, "06-drawer-order2-expanded.png");
    // Collapse it, then expand order 3 (the 6+ product one).
    await toggles.nth(1).click();
    await page.waitForTimeout(200);
    if (n >= 3) {
      await toggles.nth(2).click();
      await page.waitForTimeout(400);
      // Scroll the drawer so the longest list is visible.
      await page.evaluate(() => {
        const el = document.querySelector("[data-nex-notifications-scroll]");
        if (el) el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(200);
      await shot(page, "07-drawer-order3-scrolled.png");
    }
    // Open post popup from a drawer item review button.
    const btns = page.locator("[data-nex-order-item-review]");
    if ((await btns.count()) > 0) {
      await btns.first().click();
      await page.waitForSelector("[data-nex-review-post-popup]", { timeout: 5000 });
      await shot(page, "08-drawer-post-popup.png");
    } else {
      console.log("  [warn] no drawer-item review buttons found");
    }
  }
});

// ─── 09 · demo flag OFF · preview still renders cleanly ───────────
// Fresh context · no sessionStorage.
const ctx2 = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
});
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/nex-native/product/preview`, {
  waitUntil: "domcontentloaded",
  timeout: 30_000,
});
await p2.waitForTimeout(1500);
await shot(p2, "09-demo-flag-off-preview.png");
await ctx2.close();

console.log("[review-demo-shots] done");
await ctx.close();
await browser.close();
