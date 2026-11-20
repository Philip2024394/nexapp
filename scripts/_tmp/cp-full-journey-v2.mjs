#!/usr/bin/env node
// Full buyer-seller journey v2 · fixes v1 issues:
//   · cart flow: wait networkidle after reload
//   · chat flow: use real conversation composer + send selectors
//   · chat verification: nex_message row growth + DOM marker visibility
//   · seller verification: load conversation, confirm marker decrypts

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
if (!DB_URL || DB_URL.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("REFUSE prod ref");
if (!DB_URL.includes("kdstoyyeygcopkogqsyv")) throw new Error("REFUSE not sandbox");

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

if (/hammerex|rosa|99901|99903/i.test(SELLER.email + BUYER.email)) throw new Error("REFUSE protected");
if (!SELLER.email?.startsWith("e2e-vault-ck5-") || !BUYER.email?.startsWith("e2e-vault-ck5-")) {
  throw new Error("REFUSE bad prefix");
}

const DISTINCTIVE = `CPTEST-${Date.now().toString(36)}-portugal-shipping`;
const journey = {
  when: new Date().toISOString(),
  fixture: { seller: SELLER.email, buyer: BUYER.email, product_x: PRODUCT_X_ID },
  distinctive_marker: DISTINCTIVE,
};

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
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `v2-${name}.png`), fullPage: false }).catch(() => {});
}

const client = new pg.Client({ connectionString: DB_URL });
await client.connect();

// Baselines
const baseOrders = await client.query(
  `SELECT count(*)::int AS n FROM nex_order WHERE business_id = $1`,
  [SELLER.businessId],
);
journey.baseline_seller_orders = baseOrders.rows[0].n;

const browser = await chromium.launch({ headless: true });

// -----------------------------------------------------------------
// BUYER
// -----------------------------------------------------------------
const buyerCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const buyer = await buyerCtx.newPage();
const buyerErrs = [];
buyer.on("pageerror", (e) => buyerErrs.push(String(e).slice(0, 200)));
buyer.on("console", (m) => { if (m.type() === "error") buyerErrs.push(m.text().slice(0, 200)); });

try {
  console.log("\n=== BUYER · sign in + product page ===");
  await signIn(buyer, BUYER.email, BUYER.pw, `/nex-native/product/${PRODUCT_X_ID}`);
  await buyer.waitForTimeout(2000);
  await shot(buyer, "01-product-page");

  journey.product_page = {
    url: buyer.url(),
    add_to_cart: await buyer.getByRole("button", { name: /^add to cart$/i }).count(),
    ask_seller: await buyer.locator("[data-nex-product-ask-seller]").count(),
    cart_header_button: await buyer.locator("[data-nex-cart-header-button]").count(),
  };
  console.log("[product page]", JSON.stringify(journey.product_page));

  // --- CART ---
  console.log("\n=== BUYER · cart ===");
  await buyer.evaluate(() => window.localStorage.removeItem("nex_cart_v1"));
  await buyer.reload({ waitUntil: "domcontentloaded" });
  await buyer.waitForLoadState("networkidle").catch(() => {});
  await buyer.waitForTimeout(1500);

  const addBtn = buyer.getByRole("button", { name: /^add to cart$/i }).first();
  const addBtnCount = await addBtn.count();
  journey.cart = { add_btn_count_after_reload: addBtnCount };

  if (addBtnCount > 0) {
    await addBtn.click();
    await buyer.waitForTimeout(1200);
    const ls1 = await buyer.evaluate(() => {
      try { return JSON.parse(window.localStorage.getItem("nex_cart_v1") || "null"); } catch { return null; }
    });
    journey.cart.after_add = ls1;
    journey.cart.badge_count = await buyer.locator("[data-nex-cart-header-button-badge]").count();
    journey.cart.badge_text = journey.cart.badge_count
      ? await buyer.locator("[data-nex-cart-header-button-badge]").first().innerText().catch(() => null)
      : null;
    await shot(buyer, "02-added-to-cart");

    // Click cart → centered modal
    const urlBefore = buyer.url();
    await buyer.locator("[data-nex-cart-header-button]").first().click();
    await buyer.waitForTimeout(1000);
    journey.cart.popup = {
      url_changed: buyer.url() !== urlBefore,
      popup_count: await buyer.locator("[data-nex-cart-popup]").count(),
      popup_dialog_count: await buyer.locator("[data-nex-cart-popup][role='dialog']").count(),
      backdrop_count: await buyer.locator("[data-nex-cart-popup-backdrop]").count(),
      line_count: await buyer.locator("[data-nex-cart-popup-line]").count(),
    };
    journey.cart.snapshot_text = await buyer.locator("[data-nex-cart-popup]")
      .first().innerText().then((t) => t.replace(/\s+/g, " ").slice(0, 400)).catch(() => null);
    await shot(buyer, "03-cart-popup");

    // Verify the snapshot contains the real product name
    journey.cart.snapshot_contains_product = (journey.cart.snapshot_text || "").includes(PRODUCT_X_NAME);

    // Escape closes
    await buyer.keyboard.press("Escape");
    await buyer.waitForTimeout(500);
    journey.cart.popup_after_escape = await buyer.locator("[data-nex-cart-popup]").count();

    // Reload persists cart
    await buyer.reload({ waitUntil: "domcontentloaded" });
    await buyer.waitForLoadState("networkidle").catch(() => {});
    await buyer.waitForTimeout(1200);
    const lsReload = await buyer.evaluate(() => {
      try { return JSON.parse(window.localStorage.getItem("nex_cart_v1") || "null"); } catch { return null; }
    });
    journey.cart.after_reload = lsReload;
    journey.cart.badge_after_reload = await buyer.locator("[data-nex-cart-header-button-badge]").count();
    await shot(buyer, "04-cart-after-reload");
  }

  // --- CHAT ---
  console.log("\n=== BUYER · product-to-chat ===");
  // Click Ask Seller form submit → navigates to conversation
  const askSellerBtn = buyer.locator("[data-nex-product-ask-seller]").first();
  if (await askSellerBtn.count()) {
    await askSellerBtn.click();
    // Wait for navigation to conversation page
    await buyer.waitForURL(/\/nex-native\/(conversations|chat\/peer)\//, { timeout: 30_000 }).catch(() => {});
    await buyer.waitForLoadState("networkidle").catch(() => {});
    await buyer.waitForTimeout(2500);
    const chatUrl = buyer.url();
    journey.chat = { url: chatUrl };
    const convMatch = chatUrl.match(/\/conversations\/([0-9a-f-]+)/);
    const convId = convMatch ? convMatch[1] : null;
    journey.chat.conversation_id = convId;
    await shot(buyer, "05-conversation-landing");

    // Verify product chip present
    journey.chat.product_chip_count = await buyer.locator(
      "[data-nex-biz-conv-pending-product], [data-nex-business-conv-product-card]"
    ).count();

    // DB baseline for this conversation
    if (convId) {
      const baseMsg = await client.query(
        `SELECT count(*)::int AS n FROM nex_message
           WHERE conversation_id = $1 AND sender_account_id = $2`,
        [convId, BUYER.accountId],
      );
      journey.chat.db_msgs_before = baseMsg.rows[0].n;
    }

    // Find composer input
    const composer = buyer.locator("input[placeholder='Message…'], input[placeholder*='Message']").first();
    const composerC = await composer.count();
    journey.chat.composer_count = composerC;

    if (composerC > 0) {
      // Wait for peer to be ready (input is disabled with placeholder "Loading…" until peerReady)
      await buyer.waitForFunction(
        () => {
          const el = document.querySelector("input[placeholder='Message…']");
          return el && !el.disabled;
        },
        null,
        { timeout: 20_000 },
      ).catch((e) => { journey.chat.peer_ready_err = String(e).slice(0, 200); });

      await composer.fill(DISTINCTIVE);
      await buyer.waitForTimeout(400);

      const sendBtn = buyer.locator("[data-nex-business-conv-send]").first();
      journey.chat.send_btn_count = await sendBtn.count();
      if (await sendBtn.count()) {
        await sendBtn.click();
        await buyer.waitForTimeout(3500);
      }

      // DOM check: did the marker appear in the message list?
      const bodyText = await buyer.content();
      journey.chat.marker_in_dom_after_send = bodyText.includes(DISTINCTIVE);
      await shot(buyer, "06-after-send");

      // Reload persists
      await buyer.reload({ waitUntil: "domcontentloaded" });
      await buyer.waitForLoadState("networkidle").catch(() => {});
      await buyer.waitForTimeout(3000);
      const afterReload = await buyer.content();
      journey.chat.marker_in_dom_after_reload = afterReload.includes(DISTINCTIVE);
      journey.chat.marker_occurrences_after_reload = (afterReload.match(new RegExp(DISTINCTIVE, "g")) || []).length;
      await shot(buyer, "07-reload-persist");

      if (convId) {
        const afterMsg = await client.query(
          `SELECT count(*)::int AS n FROM nex_message
             WHERE conversation_id = $1 AND sender_account_id = $2`,
          [convId, BUYER.accountId],
        );
        journey.chat.db_msgs_after = afterMsg.rows[0].n;

        // List recent rows for analysis
        const rows = await client.query(
          `SELECT id, sender_account_id, encrypted, attachment_type,
                  attachment_meta, created_at
             FROM nex_message
             WHERE conversation_id = $1
             ORDER BY created_at DESC LIMIT 10`,
          [convId],
        );
        journey.chat.db_sample = rows.rows.map(r => ({
          sender: r.sender_account_id === BUYER.accountId ? "buyer" : (r.sender_account_id === SELLER.accountId ? "seller" : "other"),
          encrypted: r.encrypted,
          attachment_type: r.attachment_type,
          product_id_in_meta: r.attachment_meta?.product?.product_id || r.attachment_meta?.product_id || null,
          created_at: r.created_at,
        }));
      }
    }
  }
} catch (e) {
  journey.buyer_fatal = String(e).slice(0, 500);
} finally {
  journey.buyer_page_errors = buyerErrs.slice(0, 10);
  await buyerCtx.close();
}

// -----------------------------------------------------------------
// SELLER
// -----------------------------------------------------------------
const sellerCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const seller = await sellerCtx.newPage();
const sellerErrs = [];
seller.on("pageerror", (e) => sellerErrs.push(String(e).slice(0, 200)));

try {
  console.log("\n=== SELLER · verify receipt ===");
  const convId = journey.chat?.conversation_id;
  if (convId) {
    await signIn(seller, SELLER.email, SELLER.pw, `/nex-native/conversations/${convId}`);
    await seller.waitForTimeout(3500);
    journey.seller = { url: seller.url() };
    const content = await seller.content();
    journey.seller.marker_in_dom = content.includes(DISTINCTIVE);
    journey.seller.product_card_count = await seller.locator("[data-nex-business-conv-product-card]").count();
    journey.seller.message_rows = await seller.locator("[data-nex-business-conv-row]").count();
    await shot(seller, "08-seller-view");
  } else {
    journey.seller = { skipped: "no conversation_id" };
  }
} catch (e) {
  journey.seller_fatal = String(e).slice(0, 500);
} finally {
  journey.seller_page_errors = sellerErrs.slice(0, 10);
  await sellerCtx.close();
}

await client.end();
writeFileSync(path.join(OUT, "journey-v2-result.json"), JSON.stringify(journey, null, 2));
console.log("\n=== SUMMARY ===");
console.log(JSON.stringify(journey, null, 2));

await browser.close();
console.log("\n[done]");
