#!/usr/bin/env node
// Verify cart header icon on /product/preview now opens centered modal
// (was <Link href="/nex-native/cart">, now <CartHeaderButton> → CartPopupClient).
// No account required · public preview route · no live signup touched.

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

// Seed localStorage cart BEFORE navigating (overlay-type evidence only;
// the brief says storage-inject is acceptable for proving the overlay
// opens centered, but NOT for proving the real order-flow journey).
await page.goto(`${BASE}/nex-native/`, { waitUntil: "domcontentloaded", timeout: 15_000 });
await page.evaluate(() => {
  localStorage.setItem(
    "nex_cart_v1",
    JSON.stringify([
      { product_id: "test-p1", quantity: 2, name: "VERIFY", price_pence: 999, currency: "EUR", shop_id: "test-s1", shop_display_name: "VERIFY SHOP", shop_slug: "verify", shop_owner_account_id: "test-o1", image_url: null },
    ]),
  );
});

await page.goto(`${BASE}/nex-native/product/preview`, {
  waitUntil: "networkidle",
  timeout: 30_000,
});
await page.waitForTimeout(1500);

const results = {
  when: new Date().toISOString(),
  url_before: page.url(),
};

// Count selectors to prove CartHeaderButton rendered (data-nex-cart-header-button)
// and that HeaderCartIcon link (a[href*='/nex-native/cart']) is gone from this page.
results.link_count_before = await page.locator("a[href*='/nex-native/cart']").count();
results.button_count_before = await page.locator("[data-nex-cart-header-button]").count();

// Find the orange cart button in header
const btn = page.locator("[data-nex-cart-header-button]").first();
const hasBtn = await btn.count();
results.has_cart_button = !!hasBtn;

await page.screenshot({ path: path.join(OUT, "cart-fix-00-before.png") });

if (!hasBtn) {
  console.log("FAIL · no [data-nex-cart-header-button] on product/preview");
} else {
  const urlBeforeClick = page.url();
  await btn.click();
  await page.waitForTimeout(800);
  const urlAfterClick = page.url();

  // Centered modal should mount after click.
  // CartPopupClient renders inside a portal; check for role=dialog
  // AND a centered bounding box.
  const dialogC = await page.locator("[role='dialog']").count();
  const popupC = await page.locator("[data-nex-cart-popup]").count();
  let centered = null;
  if (dialogC) {
    const box = await page.locator("[role='dialog']").first().boundingBox();
    if (box) {
      const vw = 390;
      const cx = box.x + box.width / 2;
      centered = {
        box,
        center_x: cx,
        viewport_mid: vw / 2,
        offset_from_center: Math.abs(cx - vw / 2),
      };
    }
  }

  results.click = {
    url_before: urlBeforeClick,
    url_after: urlAfterClick,
    navigated: urlBeforeClick !== urlAfterClick,
    dialog_count: dialogC,
    popup_count: popupC,
    centered,
  };

  await page.screenshot({ path: path.join(OUT, "cart-fix-01-after-click.png") });

  // Close and reopen to prove no DOM leak + state resets.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const dialogAfterEsc = await page.locator("[role='dialog']").count();
  await btn.click();
  await page.waitForTimeout(500);
  const dialogAfterReopen = await page.locator("[role='dialog']").count();
  results.close_reopen = {
    dialog_after_escape: dialogAfterEsc,
    dialog_after_reopen: dialogAfterReopen,
  };
  await page.screenshot({ path: path.join(OUT, "cart-fix-02-reopen.png") });
}

console.log(JSON.stringify(results, null, 2));
writeFileSync(path.join(OUT, "cart-fix-verify.json"), JSON.stringify(results, null, 2));

await ctx.close();
await browser.close();
console.log("\n[done]");
