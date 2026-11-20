#!/usr/bin/env node
// Click the real header cart icon on the product preview page and record
// what actually happens. Storage-injected cart to make the badge non-zero
// (overlay-type probe, NOT an order-flow claim).

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = "evidence/product-chat-cart-checkpoint";
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3008";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

// Seed a mock cart item into localStorage BEFORE navigating, so the badge
// renders. This is OVERLAY-TYPE evidence only — NOT an order-flow test.
await page.goto(`${BASE}/nex-native/`, { waitUntil: "domcontentloaded", timeout: 15_000 });
await page.evaluate(() => {
  localStorage.setItem(
    "nex.cart.v1", // best-guess key; verified against NEX_CART_STORAGE_KEY below
    JSON.stringify([
      { product_id: "test-p1", quantity: 2, name: "PROBE", price_pence: 999, currency: "EUR", shop_id: "test-s1", shop_display_name: "PROBE SHOP", shop_slug: "probe", shop_owner_account_id: "test-o1", image_url: null },
    ]),
  );
});

await page.goto(`${BASE}/nex-native/product/preview`, {
  waitUntil: "networkidle",
  timeout: 30_000,
});
await page.waitForTimeout(2000);

// Find header cart icon
const cartLink = page.locator("a[href*='/nex-native/cart']").first();
const cartBtn = page.locator("[data-nex-cart-header-button]").first();
const cartIcon = page.locator("[data-nex-header-cart-icon]").first();

const results = {
  cartLink_count: await cartLink.count(),
  cartBtn_count: await cartBtn.count(),
  cartIcon_count: await cartIcon.count(),
};
console.log("selectors:", results);

// Click whichever exists
let clickTarget = null;
if (await cartLink.count()) clickTarget = cartLink;
else if (await cartBtn.count()) clickTarget = cartBtn;
else if (await cartIcon.count()) clickTarget = cartIcon;

await page.screenshot({ path: path.join(OUT, "cart-click-00-before.png") });

if (!clickTarget) {
  console.log("no cart trigger on product/preview");
} else {
  const beforeUrl = page.url();
  const tagName = await clickTarget.evaluate((el) => el.tagName.toLowerCase());
  const href = await clickTarget.evaluate((el) => el.getAttribute && el.getAttribute("href"));
  console.log("clicking cart trigger · tag:", tagName, "· href:", href);

  const navP = page.waitForNavigation({ timeout: 10_000 }).catch(() => null);
  await clickTarget.click();
  const nav = await navP;
  await page.waitForTimeout(1500);
  const afterUrl = page.url();
  console.log("before:", beforeUrl);
  console.log("after:", afterUrl);
  console.log("navigated:", beforeUrl !== afterUrl);

  // Check if a centered popup overlay is now in the DOM
  const popupOverlay = await page.locator("[role='dialog']").count();
  const cartPopup = await page.locator("[data-nex-cart-popup]").count();
  console.log("role=dialog count:", popupOverlay);
  console.log("data-nex-cart-popup count:", cartPopup);

  await page.screenshot({ path: path.join(OUT, "cart-click-01-after.png") });

  results.click = { tagName, href, beforeUrl, afterUrl, navigated: beforeUrl !== afterUrl, popupOverlay, cartPopup };
}

writeFileSync(path.join(OUT, "cart-click-probe.json"), JSON.stringify({ when: new Date().toISOString(), results }, null, 2));

await ctx.close();
await browser.close();
console.log("\n[done]");
