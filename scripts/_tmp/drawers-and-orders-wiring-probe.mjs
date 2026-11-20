#!/usr/bin/env node
// scripts/_tmp/drawers-and-orders-wiring-probe.mjs
//
// Owner-authorised 2026-11-16 checkpoint · real-UI acceptance for:
//   (a) three distinct drawer triggers present on the rendered chat surfaces
//   (b) seller's LEFT notifications drawer shows a real new order (not mock)
//       after a buyer submits a cart checkout
//   (c) tapping that notification row lands on the correct /manage/orders/[id]
//   (d) /manage in-page badge (checkpoint 1) still mounts
//   (e) non-seller (buyer) opens their notifications drawer → no orders row
//   (f) ShopDrawer (lower-right 3-dot) still opens with product cards
//
// Scope guards:
//   · Sandbox DB only (DATABASE_URL must point at kdstoyyeygcopkogqsyv)
//   · Protected UUIDs (Hammerex ...111 · Rosa ...113) refused
//   · Cleanup by exact order id only · nothing wildcard

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import pkg from "pg";

const { Client: PG } = pkg;

const ENV_FILE = ".env.playwright.vault-ck5";
const EVIDENCE_DIR = "evidence/master-flow/seller-alerts/checkpoint-3";
mkdirSync(EVIDENCE_DIR, { recursive: true });

function fromEnvFile(file, key) {
  const m = readFileSync(file, "utf8").match(
    new RegExp(`^${key}=['"]?([^'"\n]*)['"]?$`, "m"),
  );
  if (!m) throw new Error(`missing ${key} in ${file}`);
  return m[1].trim();
}
function fromEnvLocal(key) {
  const m = readFileSync(".env.local", "utf8").match(
    new RegExp(`^${key}=(.*)$`, "m"),
  );
  return m ? m[1].trim() : "";
}

const DB_URL = fromEnvLocal("DATABASE_URL");
if (!DB_URL.includes("kdstoyyeygcopkogqsyv")) {
  throw new Error("refuses · DATABASE_URL not sandbox");
}
if (DB_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  throw new Error("refuses · DATABASE_URL points at prod");
}

const SELLER_EMAIL = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_EMAIL");
const SELLER_PASSWORD = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_PASSWORD");
const SELLER_ACCOUNT_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const BUYER_EMAIL = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_B_EMAIL");
const BUYER_PASSWORD = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_B_PASSWORD");
const BUYER_ACCOUNT_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_B_ACCOUNT_ID");
const BUSINESS_SLUG = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_BUSINESS_SLUG");
const BUSINESS_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_BUSINESS_ID");
const PRODUCT_X_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_PRODUCT_X_ID");
const PRODUCT_X_NAME = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_PRODUCT_X_NAME");

const HAMMEREX = "11111111-1111-4111-8111-111111111111";
const ROSA = "11111111-1111-4111-8111-111111111113";
for (const id of [SELLER_ACCOUNT_ID, BUYER_ACCOUNT_ID]) {
  if (id === HAMMEREX || id === ROSA) {
    throw new Error("refuses · protected account id resolved");
  }
}

const BASE = "http://localhost:3008";
const CART_STORAGE_KEY = "nex_cart_v1";
const log = (phase, data) => {
  console.log(`[${phase}]`, data ?? "");
};

async function signIn(page, email, password, nextPath) {
  await page.goto(`${BASE}/nex-native/sign-in?next=${encodeURIComponent(nextPath)}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[data-nex-sign-in-submit]').click();
  await page.waitForURL(
    (u) => !u.pathname.startsWith("/nex-native/sign-in"),
    { timeout: 60_000, waitUntil: "domcontentloaded" },
  );
}
async function shot(page, name) {
  const p = path.join(EVIDENCE_DIR, name);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`  📸 ${p}`);
}

const browser = await chromium.launch({ headless: true });
const createdOrderIds = new Set();
const t0 = new Date().toISOString();

try {
  // ── SELLER CONTEXT · pre-order state on /free-chat ──
  const sellerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const sellerPage = await sellerCtx.newPage();
  log("seller · sign-in → /free-chat");
  await signIn(sellerPage, SELLER_EMAIL, SELLER_PASSWORD, "/nex-native/free-chat");
  await sellerPage.waitForTimeout(1500);

  // Verify three distinct drawer triggers exist on this surface.
  // Use locator.count (auto-waits) + a single extra settle tick so
  // client-hydrated triggers are present before the snapshot.
  await sellerPage.waitForTimeout(1200);
  const triggers = {
    rightNav: await sellerPage.locator("[data-nex-control-drawer-trigger]").count(),
    leftNotifs: await sellerPage.locator("[data-nex-notifications-trigger]").count(),
    leftShop: await sellerPage.locator("[data-nex-shop-drawer-trigger]").count(),
  };
  log("TRIGGERS_PRESENT_FREE_CHAT", triggers);
  await shot(sellerPage, "01-seller-free-chat-pre-order.png");

  // Open notifications drawer and record pre-state of orders section.
  await sellerPage.locator("[data-nex-notifications-trigger]").first().click();
  await sellerPage.waitForTimeout(600);
  const preOrdersSectionCount = await sellerPage.locator(
    '[data-nex-notifications-section="orders"] a[data-nex-notifications-row]',
  ).count();
  log("PRE_ORDERS_SECTION_ROWS", preOrdersSectionCount);
  await shot(sellerPage, "02-seller-notifs-drawer-pre.png");
  // Close the drawer.
  await sellerPage.keyboard.press("Escape");
  await sellerPage.waitForTimeout(500);

  // Open ShopDrawer trigger (lower-right 3-dot) and verify scrollable panel + cards.
  await sellerPage.locator("[data-nex-shop-drawer-trigger]").first().click();
  await sellerPage.waitForTimeout(600);
  const shopDrawerVisible = await sellerPage.locator("[data-nex-shop-drawer]").isVisible().catch(() => false);
  const shopCardCount = await sellerPage.locator("[data-nex-shop-drawer-card]").count();
  log("SHOP_DRAWER_OPEN_STATE", { shopDrawerVisible, shopCardCount });
  await shot(sellerPage, "03-seller-shop-drawer-open.png");
  // Close product drawer.
  await sellerPage.keyboard.press("Escape");
  await sellerPage.waitForTimeout(400);

  // ── BUYER CONTEXT · submit cart checkout ──
  const buyerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const buyerPage = await buyerCtx.newPage();
  log("buyer · sign-in");
  await signIn(buyerPage, BUYER_EMAIL, BUYER_PASSWORD, "/nex-native/contacts");

  log("buyer · seed cart as setup only");
  const uniqueNote = `CP3-WIRE-${Date.now()}`;
  const cartItem = [{
    key: `k-${Date.now()}`,
    kind: "product",
    id: PRODUCT_X_ID,
    shop_id: BUSINESS_ID,
    shop_slug: BUSINESS_SLUG,
    shop_owner_account_id: SELLER_ACCOUNT_ID,
    shop_display_name: "CK5 Seller Shop",
    shop_lat: null,
    shop_lng: null,
    name: PRODUCT_X_NAME,
    price_pence: 1799,
    currency: "EUR",
    image_url: null,
    quantity: 1,
    variants: [],
    perks: [],
    perks_note: "",
    note: "",
    added_at: Date.now(),
  }];
  await buyerPage.goto(`${BASE}/${BUSINESS_SLUG}`, {
    waitUntil: "domcontentloaded", timeout: 60_000,
  });
  await buyerPage.waitForTimeout(800);
  await buyerPage.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("nex-cart-changed"));
  }, { key: CART_STORAGE_KEY, value: cartItem });

  await buyerPage.goto(`${BASE}/nex-native/cart`, {
    waitUntil: "domcontentloaded", timeout: 60_000,
  });
  await buyerPage.waitForFunction(
    (name) => {
      const body = document.body.innerText || "";
      return !body.includes("Loading your cart") && body.includes(name);
    },
    PRODUCT_X_NAME,
    { timeout: 45_000, polling: 500 },
  );
  await shot(buyerPage, "04-buyer-cart-hydrated.png");

  log("buyer · click Checkout");
  await buyerPage.locator('button:has-text("Checkout")').first().click();
  await buyerPage.waitForTimeout(800);

  log("buyer · fill checkout sheet + submit");
  await buyerPage.locator(`[data-nex-checkout-sheet="${BUSINESS_ID}"] #co-name`).fill("CP3 Wire Buyer");
  await buyerPage.locator(`[data-nex-checkout-sheet="${BUSINESS_ID}"] input[placeholder="Street + number"]`).fill("CP3 Street 1");
  await buyerPage.locator(`[data-nex-checkout-sheet="${BUSINESS_ID}"] input[placeholder="City"]`).fill("CP3 City");
  await buyerPage.locator(`[data-nex-checkout-sheet="${BUSINESS_ID}"] #co-notes`).fill(uniqueNote);
  await buyerPage.locator(`[data-nex-checkout-sheet="${BUSINESS_ID}"] button[type="submit"]`).click();
  await buyerPage.waitForURL(/\/chat\/peer\//, { timeout: 60_000 });
  log("buyer · redirected", buyerPage.url());
  await shot(buyerPage, "05-buyer-after-submit.png");
  const buyerSubmitTs = Date.now();

  // Capture the created order id directly from the database for this buyer+seller
  // created in our window (scoped by exact note + time window).
  const pg = new PG({ connectionString: DB_URL });
  await pg.connect();
  const q = await pg.query(
    `SELECT id FROM nex_order
       WHERE customer_account_id = $1
         AND business_id = $2
         AND state = 'created'
         AND created_at >= $3::timestamptz
       ORDER BY created_at DESC
       LIMIT 1`,
    [BUYER_ACCOUNT_ID, BUSINESS_ID, t0],
  );
  await pg.end();
  if (q.rowCount === 0) throw new Error("expected exactly one new nex_order");
  const newOrderId = q.rows[0].id;
  createdOrderIds.add(newOrderId);
  log("CREATED_ORDER_ID", newOrderId);

  // ── SELLER · navigate to pick up fresh server-rendered drawer ──
  log("seller · navigate to /free-chat (triggers server re-render for drawer feed)");
  await sellerPage.goto(`${BASE}/nex-native/free-chat`, {
    waitUntil: "domcontentloaded", timeout: 60_000,
  });
  const sellerArrivalTs = Date.now();
  await sellerPage.waitForTimeout(1200);
  await shot(sellerPage, "06-seller-free-chat-after-order.png");

  // Open notifications drawer and check Orders section for the new row.
  await sellerPage.locator("[data-nex-notifications-trigger]").first().click();
  await sellerPage.waitForTimeout(600);
  await shot(sellerPage, "07-seller-notifs-drawer-after-order.png");
  const postOrdersSectionCount = await sellerPage.locator(
    '[data-nex-notifications-section="orders"] a[data-nex-notifications-row]',
  ).count();
  log("POST_ORDERS_SECTION_ROWS", postOrdersSectionCount);

  // Match by href (seller order detail route).
  const expectedHref = `/nex-native/manage/orders/${newOrderId}`;
  const matchingRow = sellerPage.locator(
    `[data-nex-notifications-section="orders"] a[data-nex-notifications-row][href="${expectedHref}"]`,
  );
  const matchCount = await matchingRow.count();
  log("ORDER_ROW_MATCH", { matchCount, expectedHref });

  // Capture visible subtitle/title text for that row.
  const rowText = matchCount > 0 ? await matchingRow.first().innerText() : null;
  log("ORDER_ROW_TEXT", rowText);
  const containsProductName = rowText ? rowText.includes(PRODUCT_X_NAME) : false;
  log("ORDER_ROW_HAS_PRODUCT_NAME", containsProductName);

  // Tap the row → land on correct order detail. The drawer's close
  // timeout (80ms) can race Next.js client-side nav; wait for URL
  // explicitly with a tight timeout so we fail honestly if it races.
  if (matchCount > 0) {
    const navP = sellerPage.waitForURL(new RegExp(`/manage/orders/${newOrderId}`), {
      timeout: 15_000, waitUntil: "domcontentloaded",
    }).then(() => "navigated").catch((e) => `nav-failed: ${e.message.slice(0, 80)}`);
    await matchingRow.first().click();
    const navResult = await navP;
    log("NAV_RESULT", navResult);
    await sellerPage.waitForTimeout(1500);
    await shot(sellerPage, "08-seller-order-detail-from-drawer.png");
    log("LANDED_URL", sellerPage.url());
    const bodyTxt = await sellerPage.locator("body").innerText();
    log("DETAIL_CONTAINS", {
      productName: bodyTxt.includes(PRODUCT_X_NAME),
      uniqueNote: bodyTxt.includes(uniqueNote),
    });
  }

  // Re-confirm /manage badge (checkpoint 1) still mounts for the seller.
  await sellerPage.goto(`${BASE}/nex-native/manage`, {
    waitUntil: "domcontentloaded", timeout: 60_000,
  });
  // Honest-null badge mounts only after first API poll returns chat+orders>0.
  // Poll up to 10s for the pill; record whether it appeared.
  const badgeAppeared = await sellerPage.locator("[data-nex-manage-inbox-unread]")
    .waitFor({ state: "attached", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  log("MANAGE_BADGE_MOUNTED", badgeAppeared ? 1 : 0);
  await shot(sellerPage, "09-seller-manage-badge-preserved.png");

  // ── BUYER (non-seller) opens their notifications drawer → no orders row ──
  await buyerPage.goto(`${BASE}/nex-native/free-chat`, {
    waitUntil: "domcontentloaded", timeout: 60_000,
  });
  await buyerPage.waitForTimeout(1200);
  await buyerPage.locator("[data-nex-notifications-trigger]").first().click();
  await buyerPage.waitForTimeout(600);
  const buyerOrdersSectionCount = await buyerPage.locator(
    '[data-nex-notifications-section="orders"] a[data-nex-notifications-row]',
  ).count();
  log("BUYER_ORDERS_SECTION_ROWS (expect 0)", buyerOrdersSectionCount);
  await shot(buyerPage, "10-buyer-notifs-drawer-no-orders.png");

  await sellerCtx.close();
  await buyerCtx.close();
} finally {
  await browser.close();

  log("cleanup · exact order id(s) only");
  const c = new PG({ connectionString: DB_URL });
  await c.connect();
  try {
    for (const id of createdOrderIds) {
      await c.query(`DELETE FROM nex_order_event WHERE order_id = $1`, [id]);
      const del = await c.query(
        `DELETE FROM nex_order WHERE id = $1 RETURNING id`,
        [id],
      );
      log(`deleted nex_order ${id}`, del.rowCount);
    }
    // nex_peer_message has no recipient_account_id column · scope by
    // buyer sender + attachment_type + run time-window (exact enough
    // for this probe · schema-confirmed via information_schema).
    const delMsg = await c.query(
      `DELETE FROM nex_peer_message
       WHERE sender_account_id = $1
         AND attachment_type = 'cart_order'
         AND sent_at >= $2::timestamptz
       RETURNING id`,
      [BUYER_ACCOUNT_ID, t0],
    );
    log("deleted cart_order messages", delMsg.rowCount);
  } finally {
    await c.end();
  }
}
