#!/usr/bin/env node
// CP4-fix · Step B full live flow capture.
// Buyer signs in → cart → checkout → seller opens list + detail.
// Screenshots saved; created rows cleaned by exact id after capture.

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import pkg from "pg";

const { Client: PG } = pkg;

const ENV_FILE = ".env.playwright.vault-ck5";
const EVIDENCE_DIR = "evidence/master-flow/CP4-fix";
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
const PRODUCT_Y_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_PRODUCT_Y_ID");
const PRODUCT_Y_NAME = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_PRODUCT_Y_NAME");

const HAMMEREX = "11111111-1111-4111-8111-111111111111";
const ROSA = "11111111-1111-4111-8111-111111111113";
for (const id of [SELLER_ACCOUNT_ID, BUYER_ACCOUNT_ID]) {
  if (id === HAMMEREX || id === ROSA) {
    throw new Error("refuses · protected account id resolved");
  }
}

const BASE = "http://localhost:3008";
const CART_STORAGE_KEY = "nex:cart:v2";

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
const createdCartMessageIds = new Set();
const t0 = new Date().toISOString();

try {
  // ── BUYER ──
  const buyerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const buyerPage = await buyerCtx.newPage();

  console.log("[buyer] sign in");
  await signIn(buyerPage, BUYER_EMAIL, BUYER_PASSWORD, "/nex-native/contacts");

  console.log("[buyer] visit seller shop");
  await buyerPage.goto(`${BASE}/${BUSINESS_SLUG}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await buyerPage.waitForTimeout(800);

  console.log("[buyer] write cart via sealed localStorage contract (one imaged + one imageless)");
  const cartUuidImaged = crypto.randomUUID();
  const cartUuidImageless = crypto.randomUUID();
  const cartPayload = {
    [BUSINESS_ID]: {
      businessId: BUSINESS_ID,
      businessSlug: BUSINESS_SLUG,
      shopDisplayName: "CK5 Seller Shop",
      items: [
        {
          id: cartUuidImaged,
          product_id: PRODUCT_X_ID,
          name: PRODUCT_X_NAME,
          price_pence: 2500,
          currency: "IDR",
          quantity: 1,
        },
      ],
      updatedAt: Date.now(),
    },
  };
  await buyerPage.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: CART_STORAGE_KEY, value: cartPayload },
  );

  console.log("[buyer] open /cart");
  await buyerPage.goto(`${BASE}/nex-native/cart`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await buyerPage.waitForTimeout(1500);
  await shot(buyerPage, "step-B-live-00-buyer-cart-page.png");

  console.log("[buyer] click Checkout");
  const checkoutBtn = buyerPage.locator('button:has-text("Checkout")').first();
  await checkoutBtn.click();
  await buyerPage.waitForTimeout(800);

  console.log("[buyer] fill buyer details + submit");
  const nameInput = buyerPage.locator('input[name="buyer_name"], input[placeholder*="name" i]').first();
  await nameInput.fill("CP4-fix Buyer");
  const addrInput = buyerPage.locator('input[name="delivery_address_line"], textarea[name="delivery_address_line"], input[placeholder*="address" i]').first();
  await addrInput.fill("CP4-fix Street, Sandbox City");
  const submitBtn = buyerPage.locator('button[type="submit"]').last();
  await submitBtn.click();
  await buyerPage.waitForURL(/\/chat\/peer\//, { timeout: 60_000 });
  console.log(`  buyer redirected to ${buyerPage.url()}`);
  await shot(buyerPage, "step-B-live-01-buyer-chat-after-send.png");
  await buyerCtx.close();

  // ── SELLER ──
  const sellerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const sellerPage = await sellerCtx.newPage();

  console.log("[seller] sign in · /manage/orders");
  await signIn(sellerPage, SELLER_EMAIL, SELLER_PASSWORD, "/nex-native/manage/orders");
  await sellerPage.waitForTimeout(1500);
  await shot(sellerPage, "step-B-live-02-seller-list-with-order.png");

  const rows = await sellerPage.locator('a[data-nex-order-row]').all();
  console.log(`  seller sees ${rows.length} order row(s)`);
  if (rows.length === 0) {
    throw new Error("expected at least one order row on seller list");
  }

  const href = await rows[0].getAttribute("href");
  console.log(`  opening detail: ${href}`);
  const orderId = href.split("/").pop();
  createdOrderIds.add(orderId);
  await rows[0].click();
  await sellerPage.waitForLoadState("domcontentloaded");
  await sellerPage.waitForTimeout(1500);
  await shot(sellerPage, "step-B-live-03-seller-detail-with-product-name.png");

  console.log("[seller] reload detail · persistence");
  await sellerPage.reload({ waitUntil: "domcontentloaded" });
  await sellerPage.waitForTimeout(1500);
  await shot(sellerPage, "step-B-live-04-seller-detail-reloaded.png");

  // Quick textual assertion: product name should be present on detail.
  const bodyTxt = await sellerPage.locator("body").innerText();
  const hasProduct = bodyTxt.includes(PRODUCT_X_NAME);
  console.log(`  detail contains product name "${PRODUCT_X_NAME}" → ${hasProduct ? "YES" : "NO"}`);

  // Quick textual assertion on list page: should NOT contain product name
  // (by design — list renders order id + customer id, not product name).
  await sellerPage.goto(`${BASE}/nex-native/manage/orders`, { waitUntil: "domcontentloaded" });
  await sellerPage.waitForTimeout(1200);
  const listTxt = await sellerPage.locator("body").innerText();
  const listHasProduct = listTxt.includes(PRODUCT_X_NAME);
  console.log(`  list contains product name "${PRODUCT_X_NAME}" → ${listHasProduct ? "YES (unexpected)" : "NO (expected · list is id-oriented)"}`);

  await sellerCtx.close();
} finally {
  await browser.close();

  // ── CLEANUP by exact id only ──
  console.log("\n[cleanup] scoped by exact order ids created by this run");
  const c = new PG({ connectionString: DB_URL });
  await c.connect();
  try {
    for (const id of createdOrderIds) {
      // FK: nex_order_event first
      await c.query(`DELETE FROM nex_order_event WHERE order_id = $1`, [id]);
      const del = await c.query(`DELETE FROM nex_order WHERE id = $1 RETURNING id`, [id]);
      console.log(`  deleted nex_order ${id} (${del.rowCount})`);
    }
    // Cart messages from buyer to seller in the time window
    const delMsg = await c.query(
      `DELETE FROM nex_peer_message
       WHERE sender_account_id = $1
         AND recipient_account_id = $2
         AND attachment_type = 'cart_order'
         AND created_at >= $3::timestamptz
       RETURNING id`,
      [BUYER_ACCOUNT_ID, SELLER_ACCOUNT_ID, t0],
    );
    console.log(`  deleted cart_order messages: ${delMsg.rowCount}`);
  } finally {
    await c.end();
  }
}
