#!/usr/bin/env node
// scripts/_tmp/review-demo-flag-off.mjs
//
// Owner-authorised 2026-11-16 · MOCK-ONLY.
// Proves the demo gate is off by default: hits /free-chat with a
// fresh browser context (no sessionStorage, no query param) and
// opens the notifications drawer. The "ORDERS · DEMO" section
// MUST NOT appear.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const OUT = "evidence/review-demo";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto("http://localhost:3008/nex-native/free-chat", {
  waitUntil: "domcontentloaded",
  timeout: 30_000,
});
await page.waitForTimeout(1500);

const trig = page.locator("[data-nex-notifications-trigger]").first();
await trig.click();
await page.waitForSelector("[data-nex-notifications-drawer][data-nex-notifications-drawer-visible='true']", { timeout: 5000 });
await page.waitForTimeout(400);

const demoSection = page.locator("[data-nex-notifications-section='review-demo-orders']");
const demoSectionCount = await demoSection.count();
const demoOrders = await page.locator("[data-nex-order-placed-row]").count();
console.log("demo-section count (expected 0):", demoSectionCount);
console.log("demo-order rows (expected 0):", demoOrders);

await page.screenshot({
  path: path.join(OUT, "10-drawer-flag-off-no-demo.png"),
  fullPage: false,
});

await ctx.close();
await browser.close();
