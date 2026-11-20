#!/usr/bin/env node
// Exercise the actual drawer controls on guest /free-chat and record
// which drawer each trigger opens. No signed-in session used.

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

const perr = [];
page.on("pageerror", (e) => perr.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") perr.push(m.text()); });

await page.goto(`${BASE}/nex-native/free-chat`, { waitUntil: "networkidle", timeout: 30_000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, "drawer-00-baseline.png") });

async function findSide(selector) {
  const el = page.locator(selector).first();
  if (!(await el.count())) return null;
  const box = await el.boundingBox();
  if (!box) return null;
  const viewportW = 390;
  const centerX = box.x + box.width / 2;
  // Classify into left/right/centered by center-x position.
  if (centerX < viewportW * 0.35) return { side: "left", box };
  if (centerX > viewportW * 0.65) return { side: "right", box };
  return { side: "center", box };
}

const findings = {};

// === TRIGGER 1 · bell (notifications-trigger) ===
console.log("\n[bell]");
const bell = page.locator("[data-nex-notifications-trigger]").first();
findings.bell_trigger_count = await bell.count();
if (findings.bell_trigger_count) {
  await bell.click();
  await page.waitForTimeout(600);
  const drawer = page.locator("[data-nex-notifications-drawer][data-nex-notifications-drawer-visible='true']").first();
  findings.bell_opens_notifications_drawer = !!(await drawer.count());
  if (findings.bell_opens_notifications_drawer) {
    findings.bell_drawer_position = await findSide("[data-nex-notifications-drawer][data-nex-notifications-drawer-visible='true']");
  }
  await page.screenshot({ path: path.join(OUT, "drawer-01-bell-click.png") });
  // Close by Esc
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}
console.log("  trigger count:", findings.bell_trigger_count);
console.log("  opens notifications-drawer:", findings.bell_opens_notifications_drawer);
console.log("  position:", JSON.stringify(findings.bell_drawer_position));

// === TRIGGER 2 · header `+` (ControlDrawer) ===
console.log("\n[header-plus]");
// Try several selectors for the three-dot/plus control
const selectors = [
  "[data-nex-control-drawer-trigger]",
  "[data-nex-control-drawer-open]",
  "[aria-label*='control' i]",
  "[aria-label*='menu' i]",
  "[aria-label*='more' i]",
  "button[data-nex-header-plus]",
];
let plusSel = null;
for (const s of selectors) {
  const c = await page.locator(s).first().count();
  if (c) { plusSel = s; break; }
}
findings.plus_trigger_selector = plusSel;
if (plusSel) {
  await page.locator(plusSel).first().click();
  await page.waitForTimeout(600);
  const anyDrawer = {
    control_drawer: await page.locator("[data-nex-control-drawer]").count(),
    notifications_drawer_visible: await page.locator("[data-nex-notifications-drawer][data-nex-notifications-drawer-visible='true']").count(),
  };
  findings.plus_result = anyDrawer;
  // Try to find a drawer visible after plus click and classify side
  const vis = page.locator("[data-nex-control-drawer][data-nex-control-drawer-visible='true']").first();
  if (await vis.count()) {
    findings.plus_drawer_position = await findSide("[data-nex-control-drawer][data-nex-control-drawer-visible='true']");
  } else {
    // Fallback: any element with the role of a drawer / dialog visible
    findings.plus_drawer_position = null;
  }
  await page.screenshot({ path: path.join(OUT, "drawer-02-plus-click.png") });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}
console.log("  plus-selector:", plusSel);
console.log("  result:", JSON.stringify(findings.plus_result));
console.log("  position:", JSON.stringify(findings.plus_drawer_position));

// === TRIGGER 3 · cart icon ===
console.log("\n[cart]");
// Any header cart icon / link to /nex-native/cart
const cartSelectors = [
  "[data-nex-header-cart-icon]",
  "[data-nex-cart-header-button]",
  "a[href*='/nex-native/cart']",
  "[aria-label*='cart' i]",
];
let cartSel = null;
for (const s of cartSelectors) {
  const c = await page.locator(s).first().count();
  if (c) { cartSel = s; break; }
}
findings.cart_trigger_selector = cartSel;
if (cartSel) {
  const cartEl = page.locator(cartSel).first();
  const posBefore = await cartEl.boundingBox();
  await cartEl.click();
  await page.waitForTimeout(800);
  const url = page.url();
  // Determine: did it navigate (link to /cart) or open an overlay?
  const navigated = /\/nex-native\/cart/.test(url) && !/\/free-chat/.test(url);
  findings.cart_navigated = navigated;
  findings.cart_post_url = url;
  // If overlay instead, check for centered modal
  const popupC = await page.locator("[data-nex-cart-popup-overlay], [role='dialog'][data-nex-cart], [data-nex-cart-modal]").count();
  findings.cart_popup_count = popupC;
  await page.screenshot({ path: path.join(OUT, "drawer-03-cart-click.png") });
}
console.log("  cart-selector:", cartSel);
console.log("  navigated to /cart:", findings.cart_navigated);
console.log("  post url:", findings.cart_post_url);
console.log("  popup count:", findings.cart_popup_count);

// === TRIGGER 4 · any shop/product-side icon (lower-right)? ===
// On guest /free-chat there's usually no shop context, but check anyway.
findings.feed_shop_drawer_trigger_count = await page.locator("[data-nex-feed-shop-drawer-trigger], [data-nex-seller-shop-drawer-trigger]").count();

writeFileSync(path.join(OUT, "drawer-map-probe.json"), JSON.stringify({ when: new Date().toISOString(), viewport: { w: 390, h: 844 }, findings, pageErrors: perr }, null, 2));

await ctx.close();
await browser.close();
console.log("\n[done]");
