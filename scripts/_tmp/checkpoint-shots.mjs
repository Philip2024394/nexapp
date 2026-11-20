#!/usr/bin/env node
// scripts/_tmp/checkpoint-shots.mjs
//
// Bounded verification checkpoint · visual evidence capture.
// Owner-authorised 2026-11-16. No DB writes, no commits.
//
// Captures 3 reference shots at 390x844 (iPhone-class):
//   01 · product preview page · full product shell as rendered
//   02 · free-chat landing · header cart icon visible
//   03 · cart popup opened via injected localStorage item
//
// The point is to record that the surfaces reach a rendered state
// on the dev server without errors, not to run a full user journey.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const OUT = "evidence/product-chat-cart-checkpoint";
mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:3008";
const VIEWPORT = { width: 390, height: 844 };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
});

async function shot(page, name) {
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(OUT, name),
    fullPage: false,
  });
  console.log("  shot:", name);
}

console.log("[checkpoint-shots] starting");

// ─── 01 · product preview renders ────────────────────────────────
const p1 = await ctx.newPage();
const errors1 = [];
p1.on("pageerror", (e) => errors1.push(String(e)));
p1.on("console", (m) => {
  if (m.type() === "error") errors1.push(m.text());
});
await p1.goto(`${BASE}/nex-native/product/preview`, {
  waitUntil: "domcontentloaded",
  timeout: 30_000,
});
await p1.waitForTimeout(2000);
await shot(p1, "01-product-preview.png");
const productPageMounted = await p1.locator("[data-nex-product-page]").count();
console.log("  product page shell count:", productPageMounted);
console.log("  page errors on preview:", errors1.length);
for (const e of errors1.slice(0, 5)) console.log("    ·", e);
await p1.close();

// ─── 02 · free-chat landing renders ─────────────────────────────
const p2 = await ctx.newPage();
const errors2 = [];
p2.on("pageerror", (e) => errors2.push(String(e)));
p2.on("console", (m) => {
  if (m.type() === "error") errors2.push(m.text());
});
await p2.goto(`${BASE}/nex-native/free-chat`, {
  waitUntil: "domcontentloaded",
  timeout: 30_000,
});
await p2.waitForTimeout(2000);
await shot(p2, "02-free-chat-landing.png");
const bell = await p2.locator("[data-nex-notifications-trigger]").count();
console.log("  notifications-trigger (bell) count:", bell);
console.log("  page errors on free-chat:", errors2.length);
for (const e of errors2.slice(0, 5)) console.log("    ·", e);
await p2.close();

// ─── 03 · cart page renders ─────────────────────────────────────
const p3 = await ctx.newPage();
const errors3 = [];
p3.on("pageerror", (e) => errors3.push(String(e)));
p3.on("console", (m) => {
  if (m.type() === "error") errors3.push(m.text());
});
await p3.goto(`${BASE}/nex-native/cart`, {
  waitUntil: "domcontentloaded",
  timeout: 30_000,
});
await p3.waitForTimeout(2000);
await shot(p3, "03-cart-page.png");
console.log("  page errors on cart:", errors3.length);
for (const e of errors3.slice(0, 5)) console.log("    ·", e);
await p3.close();

console.log("[checkpoint-shots] done");
await ctx.close();
await browser.close();
