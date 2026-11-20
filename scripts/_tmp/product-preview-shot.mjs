#!/usr/bin/env node
// scripts/_tmp/product-preview-shot.mjs · one-shot preview screenshot.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
mkdirSync("evidence/product-page", { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto("http://localhost:3008/nex-native/product/preview", {
  waitUntil: "domcontentloaded",
  timeout: 30_000,
});
await page.waitForSelector("[data-nex-product-page-v2]", { timeout: 15_000 });
await page.waitForTimeout(800);
await page.screenshot({
  path: path.join("evidence/product-page", "PREVIEW-collapsed.png"),
  fullPage: false,
});
// Expand description to show specs.
const toggle = page.locator("[data-nex-product-read-toggle]");
if ((await toggle.count()) > 0) {
  await toggle.click();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join("evidence/product-page", "PREVIEW-expanded.png"),
    fullPage: true,
  });
}
// Demo toast
await page.locator("[data-nex-product-ask-seller]").click();
await page.waitForTimeout(400);
await page.screenshot({
  path: path.join("evidence/product-page", "PREVIEW-demo-toast.png"),
  fullPage: false,
});
console.log("[preview-shot] done");
await ctx.close();
await browser.close();
