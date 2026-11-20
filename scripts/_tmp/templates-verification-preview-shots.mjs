#!/usr/bin/env node
// scripts/_tmp/templates-verification-preview-shots.mjs
//
// Master checkpoint · bounded preview capture across all 11 shop
// templates at 2 viewport widths. Safe surface only:
//   /nex-native/cover/preview/<layoutId>
//
// Guards:
//   · Unauthenticated (fresh Playwright context · no founder session)
//   · READ-ONLY (preview surface renders mock content when no session;
//     the preview page is `dynamic = "force-dynamic"` server-render +
//     client paint, no DB mutations)
//   · Protected accounts (Hammerex / Rosa / 99901) never signed in
//   · Nothing is uploaded, created, deleted or persisted
//
// Output: PNGs into evidence/shop-templates-verification/
// Report:  LAYOUT_SHOT lines + aggregate summary

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const EVIDENCE_DIR = "evidence/shop-templates-verification";
mkdirSync(EVIDENCE_DIR, { recursive: true });

const LAYOUT_IDS = [
  "cafe",
  "cafe_landscape",
  "cafe_round",
  "product",
  "product_landscape",
  "product_round",
  "product_landscape_round",
  "personal_brand",
  "personal_brand_landscape",
  "personal_brand_round",
  "accommodation",
];

const BASE = "http://localhost:3008";
const VIEWPORTS = [
  { label: "mobile-390", width: 390, height: 844 },
  { label: "desktop-1024", width: 1024, height: 900 },
];

async function captureLayout(browser, layoutId, viewport) {
  const ctx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    // No storage state · fresh anonymous context.
  });
  const page = await ctx.newPage();
  const url = `${BASE}/nex-native/cover/preview/${layoutId}`;
  const startedAt = Date.now();
  let status = "OK";
  let httpCode = 0;
  let overflow = null;
  let hasBurger = false;
  let hasFab = false;
  let productCards = 0;
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
    httpCode = resp?.status() ?? 0;
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    // Give the client paint a moment.
    await page.waitForTimeout(600);
    hasBurger = (await page.locator('[aria-label*="menu" i], button:has-text("☰"), [data-nex-burger]').count()) > 0
      || (await page.getByRole("button", { name: /menu|☰/i }).count()) > 0
      || (await page.locator('button:has(svg)').first().isVisible().catch(() => false));
    hasFab = (await page.locator('a[href*="/nex-native/chat/peer/"], [data-nex-shop-chat-fab]').count()) > 0;
    productCards = await page
      .locator('a[href*="/nex-native/chat/peer/"]')
      .count();
    // Detect horizontal overflow.
    overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
      };
    });
  } catch (err) {
    status = `ERR:${String(err).slice(0, 120)}`;
  }
  const shotPath = path.join(
    EVIDENCE_DIR,
    `preview-${layoutId}-${viewport.label}.png`,
  );
  try {
    await page.screenshot({ path: shotPath, fullPage: false });
  } catch (err) {
    status = `${status} / SHOT_ERR:${String(err).slice(0, 80)}`;
  }
  const elapsed = Date.now() - startedAt;
  await ctx.close();
  return {
    layoutId,
    viewport: viewport.label,
    status,
    httpCode,
    elapsedMs: elapsed,
    hasBurger,
    hasFab,
    productCardLinks: productCards,
    overflow,
    shotPath,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  for (const layoutId of LAYOUT_IDS) {
    for (const vp of VIEWPORTS) {
      const r = await captureLayout(browser, layoutId, vp);
      rows.push(r);
      const horizOverflow =
        r.overflow && r.overflow.scrollWidth > r.overflow.clientWidth + 2
          ? "HSCROLL"
          : "-";
      console.log(
        `[LAYOUT_SHOT] ${r.layoutId.padEnd(26)} ${r.viewport.padEnd(12)} http=${r.httpCode} ${r.status} burger=${r.hasBurger} fab=${r.hasFab} cards=${r.productCardLinks} ${horizOverflow} ${r.elapsedMs}ms`,
      );
    }
  }
  await browser.close();
  const okCount = rows.filter((r) => r.status === "OK" && r.httpCode === 200).length;
  console.log("");
  console.log(`[SUMMARY] shots=${rows.length} ok=${okCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
