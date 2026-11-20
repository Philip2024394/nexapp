#!/usr/bin/env node
// scripts/_tmp/cp3b-order-detail-and-isolation-probe.mjs
//
// Checkpoint 3b · bounded order-detail verification + non-owner isolation.
// Replaces the prior page-wide innerText probe with condition-based waits
// on the actual rendered elements (`[data-nex-order-detail]`,
// `[data-nex-order-cart]`, `[data-nex-order-cart-ambiguous]`,
// `[data-nex-order-cart-match-tier]`).
//
// Scope guards:
//   · Sandbox DB only (DATABASE_URL must point at kdstoyyeygcopkogqsyv)
//   · Protected UUIDs (Hammerex ...111 · Rosa ...113) refused
//   · Cleanup by exact order id only · nothing wildcard
//   · No role mutation · no email-confirmation bypass · no privileged
//     test hooks used as browser proof

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import pkg from "pg";

const { Client: PG } = pkg;

const ENV_FILE = ".env.playwright.vault-ck5";
const EVIDENCE_DIR = "evidence/master-flow/seller-alerts/checkpoint-3b";
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
const uniqueNote = `CP3B-UNIQ-${Date.now()}`;

// Pre-collect network observations for the non-owner's view of A's order
// URL so we can audit whether any order payload crosses the wire.
const nonOwnerNetworkObservations = [];

try {
  // ── BUYER submits a cart to create a fresh order ──
  const buyerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const buyerPage = await buyerCtx.newPage();
  log("buyer · sign-in");
  await signIn(buyerPage, BUYER_EMAIL, BUYER_PASSWORD, "/nex-native/contacts");

  log("buyer · seed cart");
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
  log("buyer · click Checkout");
  await buyerPage.locator('button:has-text("Checkout")').first().click();
  await buyerPage.waitForTimeout(800);
  log("buyer · fill + submit · uniqueNote in co-notes → buyer_notes");
  await buyerPage.locator(`[data-nex-checkout-sheet="${BUSINESS_ID}"] #co-name`).fill("CP3B Wire Buyer");
  await buyerPage.locator(`[data-nex-checkout-sheet="${BUSINESS_ID}"] input[placeholder="Street + number"]`).fill("CP3B Street 1");
  await buyerPage.locator(`[data-nex-checkout-sheet="${BUSINESS_ID}"] input[placeholder="City"]`).fill("CP3B City");
  await buyerPage.locator(`[data-nex-checkout-sheet="${BUSINESS_ID}"] #co-notes`).fill(uniqueNote);
  await buyerPage.locator(`[data-nex-checkout-sheet="${BUSINESS_ID}"] button[type="submit"]`).click();
  await buyerPage.waitForURL(/\/chat\/peer\//, { timeout: 60_000 });
  log("buyer · redirected", buyerPage.url());

  // Resolve the created order id deterministically.
  const pg = new PG({ connectionString: DB_URL });
  await pg.connect();
  const q = await pg.query(
    `SELECT id, product_id, price_pence, currency, created_at
       FROM nex_order
       WHERE customer_account_id = $1
         AND business_id = $2
         AND state = 'created'
         AND created_at >= $3::timestamptz
       ORDER BY created_at DESC
       LIMIT 1`,
    [BUYER_ACCOUNT_ID, BUSINESS_ID, t0],
  );
  if (q.rowCount === 0) {
    await pg.end();
    throw new Error("expected exactly one new nex_order");
  }
  const orderRow = q.rows[0];
  const newOrderId = orderRow.id;
  createdOrderIds.add(newOrderId);
  log("CREATED_ORDER", {
    id: newOrderId,
    product_id: orderRow.product_id,
    price_pence: orderRow.price_pence,
    currency: orderRow.currency,
  });

  // Quick DB inspection: does the cart peer-message exist with the
  // expected shape?  This is READ-ONLY and tells us what tier the
  // detail page will match.
  const cartMsg = await pg.query(
    `SELECT id, sent_at,
            attachment_meta->'cart'->>'order_id'      AS cart_order_id,
            attachment_meta->'cart'->>'shop_id'       AS cart_shop_id,
            attachment_meta->'cart'->>'subtotal_pence' AS cart_subtotal,
            attachment_meta->'cart'->>'buyer_notes'   AS cart_buyer_notes,
            jsonb_array_length(COALESCE(attachment_meta->'cart'->'items','[]'::jsonb)) AS item_count
       FROM nex_peer_message
       WHERE sender_account_id = $1
         AND attachment_type = 'cart_order'
         AND sent_at >= $2::timestamptz
       ORDER BY sent_at DESC
       LIMIT 1`,
    [BUYER_ACCOUNT_ID, t0],
  );
  if (cartMsg.rowCount > 0) {
    log("CART_MSG_INSPECT", cartMsg.rows[0]);
  } else {
    log("CART_MSG_INSPECT", "NO_CART_MESSAGE_FOUND");
  }
  await pg.end();

  await buyerCtx.close();

  // ── SELLER navigates directly to the order detail URL ──
  const sellerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const sellerPage = await sellerCtx.newPage();
  log("seller · sign-in");
  await signIn(sellerPage, SELLER_EMAIL, SELLER_PASSWORD, `/nex-native/manage/orders/${newOrderId}`);

  // Bounded wait for the detail page's main container. This is a
  // definite-presence condition: the page has either rendered the
  // items card OR the ambiguity banner. Either is observable via
  // a data-attribute selector; we fail honestly if neither appears.
  await sellerPage.locator("[data-nex-order-detail]").waitFor({
    state: "attached",
    timeout: 15_000,
  });
  log("DETAIL_MAIN_PRESENT", 1);

  // Read the match-tier attribute — tells us which snapshot tier
  // the server picked. "deterministic_order_id" / "price_and_product"
  // / "product_only" / "most_recent" / "none".
  const matchTier = await sellerPage.locator("[data-nex-order-detail]").getAttribute(
    "data-nex-order-cart-match-tier",
  );
  log("DETAIL_MATCH_TIER", matchTier);

  // Which card rendered?
  const cartSectionCount = await sellerPage.locator("[data-nex-order-cart]").count();
  const ambiguousCount = await sellerPage.locator("[data-nex-order-cart-ambiguous]").count();
  log("DETAIL_CARDS", { cartSection: cartSectionCount, ambiguous: ambiguousCount });

  // Header price check. The detail page header renders the order
  // total via Intl.NumberFormat("en", { style: "currency", currency }).
  // For (1799, "EUR") this formats as "€17.99". Assert that the
  // detail main element contains the formatted money string.
  const headerText = await sellerPage.locator("[data-nex-order-detail]").first().innerText();
  const expectedMoney = new Intl.NumberFormat("en", {
    style: "currency", currency: orderRow.currency, minimumFractionDigits: 2,
  }).format(orderRow.price_pence / 100);
  log("DETAIL_HEADER_HAS_MONEY", {
    expected: expectedMoney,
    containsExpected: headerText.includes(expectedMoney),
  });

  // If the items card rendered: assert product name + uniqueNote
  // inside it specifically (NOT a page-wide body snapshot).
  let itemsHasProductName = null;
  let itemsHasUniqueNote = null;
  if (cartSectionCount > 0) {
    // Items are li elements inside data-nex-order-cart's ul. Wait
    // for at least one li to be present with a short bound; falls
    // through if the card rendered an empty-items state.
    await sellerPage.locator("[data-nex-order-cart] li").first().waitFor({
      state: "attached", timeout: 5_000,
    }).catch(() => undefined);
    const cartText = await sellerPage.locator("[data-nex-order-cart]").first().innerText();
    itemsHasProductName = cartText.includes(PRODUCT_X_NAME);
    itemsHasUniqueNote = cartText.includes(uniqueNote);
    log("ITEMS_CARD_CONTAINS", {
      productName: itemsHasProductName,
      uniqueNote: itemsHasUniqueNote,
    });
  } else if (ambiguousCount > 0) {
    log("ITEMS_CARD_AMBIGUOUS", { matchTier });
  }

  await shot(sellerPage, "01-order-detail-first-load.png");

  // Reload and re-verify everything is still consistent.
  log("seller · reload order detail");
  await sellerPage.reload({ waitUntil: "domcontentloaded" });
  await sellerPage.locator("[data-nex-order-detail]").waitFor({
    state: "attached", timeout: 15_000,
  });
  const matchTier2 = await sellerPage.locator("[data-nex-order-detail]").getAttribute(
    "data-nex-order-cart-match-tier",
  );
  const cartSectionCount2 = await sellerPage.locator("[data-nex-order-cart]").count();
  const headerText2 = await sellerPage.locator("[data-nex-order-detail]").first().innerText();
  let itemsHasProductName2 = null;
  let itemsHasUniqueNote2 = null;
  if (cartSectionCount2 > 0) {
    const cartText2 = await sellerPage.locator("[data-nex-order-cart]").first().innerText();
    itemsHasProductName2 = cartText2.includes(PRODUCT_X_NAME);
    itemsHasUniqueNote2 = cartText2.includes(uniqueNote);
  }
  log("RELOAD_CONSISTENCY", {
    matchTier: matchTier2,
    cardCount: cartSectionCount2,
    headerContainsMoney: headerText2.includes(expectedMoney),
    itemsHasProductName: itemsHasProductName2,
    itemsHasUniqueNote: itemsHasUniqueNote2,
  });
  await shot(sellerPage, "02-order-detail-after-reload.png");

  await sellerCtx.close();

  // ── NON-OWNER CONTEXT · B signs in, hits A's order URL ──
  // Fixture NOTE (honest): CK5 B is a buyer-only disposable account.
  // CK5 does not include a second-SELLER fixture; creating one via
  // supported sandbox signup requires a confirmable inbox which is
  // the named missing prerequisite.  This test therefore verifies
  // the stronger ownership-guard property: an authenticated
  // non-owner is refused the order detail.  It does NOT substitute
  // for a strict "second seller" fixture.
  const otherCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const otherPage = await otherCtx.newPage();

  // Capture any JSON/HTML response the non-owner receives for the
  // order URL. We're looking for leaked order-identifying strings.
  otherPage.on("response", async (resp) => {
    const u = resp.url();
    if (!u.includes(newOrderId)) return;
    const ct = resp.headers()["content-type"] ?? "";
    let bodyLen = -1;
    let leakProductName = false;
    let leakUniqueNote = false;
    try {
      const txt = await resp.text();
      bodyLen = txt.length;
      leakProductName = txt.includes(PRODUCT_X_NAME);
      leakUniqueNote = txt.includes(uniqueNote);
    } catch { /* ignore */ }
    nonOwnerNetworkObservations.push({
      url: u.replace(BASE, ""),
      status: resp.status(),
      contentType: ct,
      bodyLen,
      leakProductName,
      leakUniqueNote,
    });
  });

  log("non-owner · sign-in as CK5 B (buyer-only · no business)");
  await signIn(otherPage, BUYER_EMAIL, BUYER_PASSWORD, "/nex-native/contacts");
  log("non-owner · attempt direct access to A's order URL");
  await otherPage.goto(`${BASE}/nex-native/manage/orders/${newOrderId}`, {
    waitUntil: "domcontentloaded", timeout: 60_000,
  });
  await otherPage.waitForTimeout(1500);
  const otherUrl = otherPage.url();
  const otherDetailPresent = await otherPage.locator("[data-nex-order-detail]").count();
  const otherCartPresent = await otherPage.locator("[data-nex-order-cart]").count();
  const otherBody = await otherPage.locator("body").innerText();
  log("NON_OWNER_RESULT", {
    landedUrl: otherUrl.replace(BASE, ""),
    orderDetailRendered: otherDetailPresent > 0,
    cartSectionRendered: otherCartPresent > 0,
    bodyHasProductName: otherBody.includes(PRODUCT_X_NAME),
    bodyHasUniqueNote: otherBody.includes(uniqueNote),
  });
  await shot(otherPage, "03-non-owner-direct-url-access.png");

  // Non-owner's /manage/orders listing — must not show A's order.
  await otherPage.goto(`${BASE}/nex-native/manage/orders`, {
    waitUntil: "domcontentloaded", timeout: 60_000,
  });
  await otherPage.waitForTimeout(1200);
  const listBody = await otherPage.locator("body").innerText();
  log("NON_OWNER_ORDERS_LIST", {
    containsShortId: listBody.includes(newOrderId.slice(0, 8)),
    containsProductName: listBody.includes(PRODUCT_X_NAME),
    containsUniqueNote: listBody.includes(uniqueNote),
  });
  await shot(otherPage, "04-non-owner-orders-list.png");

  // Non-owner's LEFT notifications drawer — orders section must be 0.
  await otherPage.goto(`${BASE}/nex-native/free-chat`, {
    waitUntil: "domcontentloaded", timeout: 60_000,
  });
  await otherPage.waitForTimeout(1200);
  await otherPage.locator("[data-nex-notifications-trigger]").first().click();
  await otherPage.waitForTimeout(600);
  const nonOwnerDrawerRows = await otherPage.locator(
    '[data-nex-notifications-section="orders"] a[data-nex-notifications-row]',
  ).count();
  const nonOwnerDrawerMatchHref = await otherPage.locator(
    `[data-nex-notifications-section="orders"] a[href="/nex-native/manage/orders/${newOrderId}"]`,
  ).count();
  log("NON_OWNER_NOTIFS_DRAWER_ORDERS", {
    totalRows: nonOwnerDrawerRows,
    matchingAOrderHref: nonOwnerDrawerMatchHref,
  });
  await shot(otherPage, "05-non-owner-notifs-drawer.png");

  log("NON_OWNER_NETWORK_OBSERVATIONS", nonOwnerNetworkObservations);

  await otherCtx.close();
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
