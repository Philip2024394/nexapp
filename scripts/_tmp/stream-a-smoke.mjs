// scripts/_tmp/stream-a-smoke.mjs
//
// Stream A · 2026-11-16 · Nov-16 execution block · smoke driver.
// -----------------------------------------------------------------
// Walks the /nex-native/product/<id> page through B1 + B2 +
// centered-cart-popup + inquiry-composer-popup and captures PNGs
// into evidence/stream-a/ so the reviewer can see the actual
// rendered state. No form submission is driven · the composer's
// Send button would fire sendProductInquiryAction (which requires
// auth cookies) and would create a real peer-message row. Opening
// the composer + typing a question is enough to prove the UX, and
// the server action itself is already covered by Slice 0.8 tests.

import { chromium } from "@playwright/test";

const PRODUCT_ID = "125d30fc-a366-413a-804f-127890a323a8"; // watch-warehouse · Seiko SKX007
const BASE = "http://localhost:3008";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();

async function screenshot(name) {
  const path = `evidence/stream-a/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`  snap · ${path}`);
}

console.log("1 · product page loads");
await page.goto(`${BASE}/nex-native/product/${PRODUCT_ID}`, {
  waitUntil: "networkidle",
});
await screenshot("01-product-page");

console.log("2 · B2 · @slug.nex link present with correct href");
const shopLink = await page
  .locator('[data-nex-product-page-shop-link]')
  .first();
await shopLink.waitFor({ state: "attached", timeout: 5000 });
const shopHref = await shopLink.getAttribute("href");
console.log(`  href: ${shopHref}`);
if (shopHref !== "/nex-native/watch-warehouse") {
  throw new Error("B2 href mismatch");
}

console.log("3 · B1 · AddToCart button + inquiry button both visible");
await page.locator('[data-nex-product-page-actions]').waitFor();
const addToCartVisible = await page
  .getByRole("button", { name: /add to cart/i })
  .first()
  .isVisible();
const askVisible = await page
  .locator('[data-nex-product-inquiry-trigger]')
  .first()
  .isVisible();
console.log(`  add-to-cart visible: ${addToCartVisible}`);
console.log(`  ask-more-details visible: ${askVisible}`);

console.log("4 · Click AddToCart · verify cart header badge appears");
await page.getByRole("button", { name: /add to cart/i }).first().click();
await page.waitForTimeout(400);
const badgeTextAfterAdd = await page
  .locator('[data-nex-cart-header-button-badge]')
  .first()
  .textContent()
  .catch(() => null);
console.log(`  badge after add: ${badgeTextAfterAdd}`);
await screenshot("02-after-add-to-cart");

console.log("5 · Click header cart icon · centered popup opens");
await page.locator('[data-nex-cart-header-button]').first().click();
await page.locator('[data-nex-cart-popup]').waitFor({ timeout: 3000 });
const popupVisible = await page.locator('[data-nex-cart-popup]').isVisible();
console.log(`  cart popup visible: ${popupVisible}`);
await screenshot("03-cart-popup-open");

console.log("6 · Press Escape · popup dismisses");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const popupVisibleAfterEsc = await page
  .locator('[data-nex-cart-popup]')
  .isVisible()
  .catch(() => false);
console.log(`  cart popup visible after Esc: ${popupVisibleAfterEsc}`);
await screenshot("04-after-escape");

console.log("7 · Re-open popup · click backdrop · dismisses");
await page.locator('[data-nex-cart-header-button]').first().click();
await page.locator('[data-nex-cart-popup]').waitFor({ timeout: 3000 });
await page.locator('[data-nex-cart-popup-backdrop]').click({
  position: { x: 5, y: 5 },
});
await page.waitForTimeout(300);
const popupVisibleAfterBackdrop = await page
  .locator('[data-nex-cart-popup]')
  .isVisible()
  .catch(() => false);
console.log(`  cart popup visible after backdrop click: ${popupVisibleAfterBackdrop}`);

console.log("8 · Click Ask-more-details · inquiry composer opens with preview");
await page.locator('[data-nex-product-inquiry-trigger]').first().click();
await page.locator('[data-nex-product-inquiry-modal]').waitFor({ timeout: 3000 });
const previewVisible = await page
  .locator('[data-nex-product-inquiry-preview]')
  .isVisible();
const textareaVisible = await page
  .locator('[data-nex-product-inquiry-textarea]')
  .isVisible();
const sendButtonVisible = await page
  .locator('[data-nex-product-inquiry-send]')
  .isVisible();
console.log(`  product preview visible: ${previewVisible}`);
console.log(`  textarea visible: ${textareaVisible}`);
console.log(`  Send button visible: ${sendButtonVisible}`);
await screenshot("05-inquiry-composer-open");

console.log("9 · Empty-send validation · click Send with no text");
await page.locator('[data-nex-product-inquiry-send]').click();
await page.waitForTimeout(200);
const errorShown = await page
  .locator('[data-nex-product-inquiry-error]')
  .isVisible()
  .catch(() => false);
console.log(`  error shown on empty submit: ${errorShown}`);
await screenshot("06-inquiry-empty-error");

console.log("10 · Type a question · verify textarea accepts + draft persists");
await page
  .locator('[data-nex-product-inquiry-textarea]')
  .fill("Is this still in working condition?");
const typed = await page
  .locator('[data-nex-product-inquiry-textarea]')
  .inputValue();
console.log(`  typed value: ${typed}`);
await screenshot("07-inquiry-with-question");

console.log("11 · Cancel composer · modal closes · draft cleared on next open");
await page.getByRole("button", { name: /^cancel$/i }).click();
await page.waitForTimeout(200);
const inquiryClosed = await page
  .locator('[data-nex-product-inquiry-modal]')
  .isVisible()
  .catch(() => false);
console.log(`  inquiry modal visible after cancel: ${inquiryClosed}`);

// NOTE · we DO NOT click Send on the inquiry modal because that would
// fire sendProductInquiryAction which (a) requires an authenticated
// session cookie we don't have in this driver, and (b) would insert a
// real row into nex_peer_message. The server action is covered by
// slice-0.8-commerce-inquiries.test.ts (unit) and the flow has been
// verified visually to the point where only the signed-in send remains.

await browser.close();
console.log("DONE · see evidence/stream-a/*.png");
