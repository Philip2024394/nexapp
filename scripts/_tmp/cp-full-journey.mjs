#!/usr/bin/env node
// Full product-to-chat + cart-to-order journey · CP checkpoint
// Uses CURRENT CK5 fixture (seller A + buyer B) · sandbox-only
// No signup · no admin API · no new provisioning · reuses stored sessions

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const OUT = "evidence/product-chat-cart-checkpoint";
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3008";

function envValue(file, name) {
  const raw = readFileSync(file, "utf8");
  const m = raw.match(new RegExp(`^${name}=['"]?([^'"\\n]*)['"]?$`, "m"));
  return m ? m[1].trim() : null;
}

const DB_URL = envValue(".env.local", "DATABASE_URL");
if (!DB_URL || DB_URL.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("REFUSE · prod ref");
if (!DB_URL.includes("kdstoyyeygcopkogqsyv")) throw new Error("REFUSE · not sandbox");

const CK5 = ".env.playwright.vault-ck5";
const SELLER = {
  email: envValue(CK5, "PLAYWRIGHT_CK5_A_EMAIL"),
  pw: envValue(CK5, "PLAYWRIGHT_CK5_A_PASSWORD"),
  accountId: envValue(CK5, "PLAYWRIGHT_CK5_A_ACCOUNT_ID"),
  businessId: envValue(CK5, "PLAYWRIGHT_CK5_A_BUSINESS_ID"),
  businessSlug: envValue(CK5, "PLAYWRIGHT_CK5_A_BUSINESS_SLUG"),
};
const BUYER = {
  email: envValue(CK5, "PLAYWRIGHT_CK5_B_EMAIL"),
  pw: envValue(CK5, "PLAYWRIGHT_CK5_B_PASSWORD"),
  accountId: envValue(CK5, "PLAYWRIGHT_CK5_B_ACCOUNT_ID"),
};
const PRODUCT_X_ID = envValue(CK5, "PLAYWRIGHT_CK5_PRODUCT_X_ID");
const PRODUCT_X_NAME = envValue(CK5, "PLAYWRIGHT_CK5_PRODUCT_X_NAME");

const PROTECTED = /hammerex|rosa|99901|99903/i;
if (PROTECTED.test(SELLER.email) || PROTECTED.test(BUYER.email)) {
  throw new Error("REFUSE · protected identity");
}
if (!SELLER.email?.startsWith("e2e-vault-ck5-") || !BUYER.email?.startsWith("e2e-vault-ck5-")) {
  throw new Error("REFUSE · unexpected prefix");
}

const journey = { when: new Date().toISOString(), base: BASE, product_x_id: PRODUCT_X_ID };
const DISTINCTIVE = `CP-JOURNEY-${Date.now().toString(36)}-ships-to-portugal-question`;
journey.distinctive_marker = DISTINCTIVE;

async function signIn(page, email, pw, nextPath) {
  await page.goto(`${BASE}/nex-native/sign-in?next=${encodeURIComponent(nextPath)}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.locator("input[name='email']").fill(email);
  await page.locator("input[name='password']").fill(pw);
  await page.locator("[data-nex-sign-in-submit]").click();
  await page.waitForURL(
    (u) => !u.pathname.startsWith("/nex-native/sign-in"),
    { timeout: 60_000, waitUntil: "domcontentloaded" },
  );
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `journey-${name}.png`), fullPage: false }).catch(() => {});
}

const client = new pg.Client({ connectionString: DB_URL });
await client.connect();

// Baseline: messages from buyer about this product
const baseline = await client.query(
  `SELECT count(*)::int AS n FROM nex_peer_message
     WHERE sender_account_id = $1
       AND attachment_meta->'product'->>'product_id' = $2`,
  [BUYER.accountId, PRODUCT_X_ID],
);
journey.baseline_buyer_msgs_for_product = baseline.rows[0].n;
console.log("[baseline] buyer msgs for product:", journey.baseline_buyer_msgs_for_product);

// Baseline orders for seller business
const bOrders = await client.query(
  `SELECT count(*)::int AS n FROM nex_order WHERE business_id = $1`,
  [SELLER.businessId],
);
journey.baseline_seller_orders = bOrders.rows[0].n;
console.log("[baseline] seller orders:", journey.baseline_seller_orders);

const browser = await chromium.launch({ headless: true });

// -----------------------------------------------------------------
// BUYER CONTEXT · isolated, fresh storage
// -----------------------------------------------------------------
const buyerCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const buyer = await buyerCtx.newPage();
const buyerPageErrors = [];
buyer.on("pageerror", (e) => buyerPageErrors.push(String(e).slice(0, 200)));
buyer.on("console", (m) => { if (m.type() === "error") buyerPageErrors.push(m.text().slice(0, 200)); });

try {
  console.log("\n=== BUYER · sign in + product page ===");
  await signIn(buyer, BUYER.email, BUYER.pw, `/nex-native/product/${PRODUCT_X_ID}`);
  await buyer.waitForLoadState("networkidle").catch(() => {});
  await buyer.waitForTimeout(1500);

  const productUrl = buyer.url();
  journey.buyer_product_url = productUrl;
  await shot(buyer, "01-buyer-product-page");

  // Verify real product page (not preview)
  journey.buyer_product_page = {
    url: productUrl,
    product_image_count: await buyer.locator("[data-nex-product-image]").count(),
    add_to_cart_count: await buyer.getByRole("button", { name: /^add to cart$/i }).count(),
    ask_seller_count: await buyer.locator("[data-nex-product-ask-seller]").count(),
    ask_more_details_count: await buyer.getByRole("button", { name: /ask more details/i }).count(),
    back_button_count: await buyer.locator("[data-nex-product-header-back]").count(),
    cart_header_button_count: await buyer.locator("[data-nex-cart-header-button]").count(),
    // Verify this is the REAL product page (not mock preview)
    is_404: /404|not found/i.test(await buyer.content().then(c => c.slice(0, 2000))),
  };
  console.log("[buyer product page]", JSON.stringify(journey.buyer_product_page));

  // -------------------------------------------------------------
  // CART FLOW
  // -------------------------------------------------------------
  console.log("\n=== BUYER · cart flow ===");
  await buyer.evaluate(() => window.localStorage.removeItem("nex_cart_v1"));
  await buyer.reload({ waitUntil: "domcontentloaded" });
  await buyer.waitForTimeout(800);

  const addBtn = buyer.getByRole("button", { name: /^add to cart$/i }).first();
  const addVisible = await addBtn.count();
  journey.cart = { add_btn_visible: !!addVisible };
  if (addVisible) {
    await addBtn.click();
    await buyer.waitForTimeout(800);
    journey.cart.badge_visible = await buyer.locator("[data-nex-cart-header-button-badge]").count();
    journey.cart.badge_text = journey.cart.badge_visible
      ? await buyer.locator("[data-nex-cart-header-button-badge]").first().innerText().catch(() => null)
      : null;
    journey.cart.local_storage = await buyer.evaluate(() => {
      try { return JSON.parse(window.localStorage.getItem("nex_cart_v1") || "null"); } catch { return null; }
    });
    await shot(buyer, "02-buyer-after-add-to-cart");

    // Click cart icon → verify centered modal (our fix)
    const urlBeforeCart = buyer.url();
    await buyer.locator("[data-nex-cart-header-button]").first().click();
    await buyer.waitForTimeout(800);
    const urlAfterCart = buyer.url();
    const popup = buyer.locator("[data-nex-cart-popup]");
    const popupBox = await popup.first().boundingBox().catch(() => null);
    journey.cart.popup = {
      navigated: urlBeforeCart !== urlAfterCart,
      url_before: urlBeforeCart,
      url_after: urlAfterCart,
      popup_count: await popup.count(),
      popup_role_dialog: await buyer.locator("[data-nex-cart-popup][role='dialog']").count(),
      popup_line_count: await buyer.locator("[data-nex-cart-popup-line]").count(),
      backdrop_count: await buyer.locator("[data-nex-cart-popup-backdrop]").count(),
      popup_box: popupBox,
    };
    await shot(buyer, "03-buyer-cart-popup-open");

    // Readback snapshot inside popup
    journey.cart.snapshot_text = await buyer.locator("[data-nex-cart-popup]")
      .first().innerText().then((t) => t.replace(/\s+/g, " ").slice(0, 500)).catch(() => null);

    // Close via Escape
    await buyer.keyboard.press("Escape");
    await buyer.waitForTimeout(400);
    journey.cart.popup_after_escape = await buyer.locator("[data-nex-cart-popup]").count();

    // Reopen + qty bump + close + reopen persistence
    await buyer.locator("[data-nex-cart-header-button]").first().click();
    await buyer.waitForTimeout(500);
    const incBtn = buyer.locator("[data-nex-cart-popup]").locator("button[aria-label*='increase' i], button:has-text('+')").first();
    const incExists = await incBtn.count();
    if (incExists > 0) {
      await incBtn.click();
      await buyer.waitForTimeout(300);
      await incBtn.click();
      await buyer.waitForTimeout(300);
    }
    await buyer.keyboard.press("Escape");
    await buyer.waitForTimeout(400);
    journey.cart.after_inc_qty = (await buyer.evaluate(() => {
      try { return JSON.parse(window.localStorage.getItem("nex_cart_v1") || "[]"); } catch { return []; }
    }))?.[0]?.quantity ?? null;

    // Reload persistence
    await buyer.reload({ waitUntil: "domcontentloaded" });
    await buyer.waitForTimeout(800);
    journey.cart.after_reload_qty = (await buyer.evaluate(() => {
      try { return JSON.parse(window.localStorage.getItem("nex_cart_v1") || "[]"); } catch { return []; }
    }))?.[0]?.quantity ?? null;

    await shot(buyer, "04-buyer-cart-after-reload");
  }

  // -------------------------------------------------------------
  // PRODUCT-TO-CHAT FLOW (Ask Seller / Ask More Details)
  // -------------------------------------------------------------
  console.log("\n=== BUYER · product-to-chat ===");
  // Prefer the inquiry modal if present; fallback to Ask Seller form submit
  const inquiryBtn = buyer.getByRole("button", { name: /ask more details/i }).first();
  const askSellerBtn = buyer.locator("[data-nex-product-ask-seller]").first();
  const hasInquiry = await inquiryBtn.count();
  const hasAskSeller = await askSellerBtn.count();
  journey.chat = { has_inquiry_btn: !!hasInquiry, has_ask_seller_btn: !!hasAskSeller };

  if (hasInquiry) {
    await inquiryBtn.click();
    await buyer.waitForTimeout(600);
    const modal = buyer.locator("[data-nex-product-inquiry-modal]");
    journey.chat.modal_count = await modal.count();
    await shot(buyer, "05-buyer-inquiry-modal");
    if (journey.chat.modal_count) {
      await modal.locator("textarea").first().fill(DISTINCTIVE);
      await buyer.waitForTimeout(200);
      await modal.locator("[data-nex-product-inquiry-send]").first().click();
      await buyer.waitForURL(/\/chat\/peer\//, { timeout: 30_000 }).catch(() => {});
      await buyer.waitForTimeout(1500);
      journey.chat.url_after_send = buyer.url();
    }
  } else if (hasAskSeller) {
    // askSellerBtn is a submit button inside a form; submit fires server action
    await askSellerBtn.click();
    await buyer.waitForURL(/\/chat\/peer\//, { timeout: 30_000 }).catch(() => {});
    await buyer.waitForTimeout(1500);
    journey.chat.url_after_askseller = buyer.url();
    // Now type the message in the chat composer
    const composer = buyer.locator("textarea, [contenteditable='true']").first();
    if (await composer.count()) {
      await composer.fill(DISTINCTIVE);
      // Find a send button
      const sendBtn = buyer.locator("[data-nex-peer-chat-send], button[aria-label*='send' i], button:has-text('Send')").first();
      if (await sendBtn.count()) {
        await sendBtn.click();
        await buyer.waitForTimeout(2000);
      }
    }
  }
  await shot(buyer, "06-buyer-after-send");

  // Reload chat and verify message persists
  const chatUrl = buyer.url();
  journey.chat.chat_url = chatUrl;
  if (/\/chat\/peer\//.test(chatUrl)) {
    await buyer.reload({ waitUntil: "domcontentloaded" });
    await buyer.waitForTimeout(2000);
    // Count occurrences of distinctive marker in DOM
    const bodyText = await buyer.content().then(c => c);
    journey.chat.marker_occurrences_in_dom = (bodyText.match(new RegExp(DISTINCTIVE, "g")) || []).length;
    await shot(buyer, "07-buyer-chat-after-reload");
  }

  // DB-side: how many peer_message rows now reference the product + body has marker?
  const afterSend = await client.query(
    `SELECT id, body, attachment_meta, sent_at
       FROM nex_peer_message
       WHERE sender_account_id = $1
         AND attachment_meta->'product'->>'product_id' = $2
       ORDER BY sent_at DESC LIMIT 5`,
    [BUYER.accountId, PRODUCT_X_ID],
  );
  journey.chat.db_product_msgs_after = afterSend.rowCount;
  journey.chat.db_sample_latest = afterSend.rows.slice(0, 3).map(r => ({
    body: (r.body || "").slice(0, 200),
    has_marker: (r.body || "").includes(DISTINCTIVE) ||
                JSON.stringify(r.attachment_meta || {}).includes(DISTINCTIVE),
    product_id: r.attachment_meta?.product?.product_id,
    sent_at: r.sent_at,
  }));

  // Any msg with marker (regardless of product context)
  const markerQ = await client.query(
    `SELECT id, body, attachment_meta, sent_at
       FROM nex_peer_message
       WHERE sender_account_id = $1 AND body LIKE $2
       ORDER BY sent_at DESC LIMIT 5`,
    [BUYER.accountId, `%${DISTINCTIVE}%`],
  );
  journey.chat.marker_rows = markerQ.rowCount;
  journey.chat.marker_samples = markerQ.rows.slice(0, 3).map(r => ({
    body: (r.body || "").slice(0, 200),
    product_id: r.attachment_meta?.product?.product_id,
    product_match: r.attachment_meta?.product?.product_id === PRODUCT_X_ID,
    sent_at: r.sent_at,
  }));

} catch (e) {
  journey.buyer_error = String(e).slice(0, 500);
  console.log("[buyer ERROR]", journey.buyer_error);
} finally {
  journey.buyer_page_errors = buyerPageErrors.slice(0, 10);
  await buyerCtx.close();
}

// -----------------------------------------------------------------
// SELLER CONTEXT · isolated
// -----------------------------------------------------------------
const sellerCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const seller = await sellerCtx.newPage();
const sellerPageErrors = [];
seller.on("pageerror", (e) => sellerPageErrors.push(String(e).slice(0, 200)));

try {
  console.log("\n=== SELLER · recipient check ===");
  await signIn(seller, SELLER.email, SELLER.pw, `/nex-native/chat/peer/${BUYER.accountId}`);
  await seller.waitForLoadState("networkidle").catch(() => {});
  await seller.waitForTimeout(1500);
  journey.seller_chat_url = seller.url();

  const sellerContent = await seller.content();
  journey.seller_receives_marker = sellerContent.includes(DISTINCTIVE);
  journey.seller_product_chip_count = await seller.locator("[data-nex-peer-message-product-chip], [data-nex-product-context-chip]").count();
  await shot(seller, "08-seller-chat");
} catch (e) {
  journey.seller_error = String(e).slice(0, 500);
} finally {
  journey.seller_page_errors = sellerPageErrors.slice(0, 10);
  await sellerCtx.close();
}

// Final DB counts
const finalOrders = await client.query(
  `SELECT count(*)::int AS n FROM nex_order WHERE business_id = $1`,
  [SELLER.businessId],
);
journey.final_seller_orders = finalOrders.rows[0].n;
await client.end();

writeFileSync(path.join(OUT, "journey-result.json"), JSON.stringify(journey, null, 2));
console.log("\n=== SUMMARY ===");
console.log(JSON.stringify(journey, null, 2));

await browser.close();
console.log("\n[done]");
