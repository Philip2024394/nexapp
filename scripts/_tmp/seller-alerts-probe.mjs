#!/usr/bin/env node
// scripts/_tmp/seller-alerts-probe.mjs
//
// Seller-alerts checkpoint · real-browser probe.
// Verifies: after a buyer submits a cart through the actual buyer UI,
// does the seller's open /manage surface learn about it without a
// manual reload?
//
// Measured surfaces (all three polled in parallel during 120s observe):
//   1. `/api/nex-native/unread-count` endpoint `orders` field · the
//      source of truth that both the OS app-badge sync and the (not
//      yet mounted) in-page badge read from.
//   2. The in-page badge `[data-nex-manage-inbox-unread]` pill ·
//      mounted by `ManageInboxUnreadBadgeClient`. If the client
//      component is not wired into the /manage page it will stay
//      count=0 for the full observation window.
//   3. The seller /manage/orders list row count (second tab, also
//      without reload).
//
// Honest safety fence:
//   · Sandbox DB only (kdstoyyeygcopkogqsyv). Prod ref refused.
//   · CK5 A (seller) + CK5 B (buyer). Hammerex / Rosa refused.
//   · Real cart UI: writes NEX_CART_STORAGE_KEY ("nex_cart_v1") as a
//     flat array matching `NexCartItem`, dispatches the
//     `nex-cart-changed` event, then drives the Checkout→ button,
//     the [data-nex-checkout-sheet=<shopId>] form, and the real
//     `sendCartOrderAction` (NOT a fixture insert, NOT a manual
//     notification dispatch, NOT a direct DB write).
//   · Cleanup is exact-id scoped on nex_order + time/sender scoped on
//     nex_peer_message.

import { chromium } from "playwright";
import { readFileSync, mkdirSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import pkg from "pg";

const { Client: PG } = pkg;

const ENV_FILE = ".env.playwright.vault-ck5";
const EV_DIR = "evidence/master-flow/seller-alerts";
mkdirSync(EV_DIR, { recursive: true });

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
if (!DB_URL.includes("kdstoyyeygcopkogqsyv") || DB_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  throw new Error("refuses · DATABASE_URL not sandbox");
}

const SELLER_EMAIL = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_EMAIL");
const SELLER_PASSWORD = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_PASSWORD");
const SELLER_ACCOUNT_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const BUYER_EMAIL = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_B_EMAIL");
const BUYER_PASSWORD = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_B_PASSWORD");
const BUYER_ACCOUNT_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_B_ACCOUNT_ID");
const BUSINESS_SLUG = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_BUSINESS_SLUG");
const BUSINESS_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_BUSINESS_ID");
const BUSINESS_NAME = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_BUSINESS_NAME");
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
// Truth: NEX_CART_STORAGE_KEY = "nex_cart_v1" (see src/lib/nex-native/cart-types.ts:9).
const CART_STORAGE_KEY = "nex_cart_v1";
// Product X denomination verified from sandbox DB (EUR / 1799 pence).
const PRODUCT_X_PRICE_PENCE = 1799;
const PRODUCT_X_CURRENCY = "EUR";

const LOG_PATH = path.join(EV_DIR, "probe-observations.jsonl");
writeFileSync(LOG_PATH, "");
function log(obj) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...obj });
  appendFileSync(LOG_PATH, line + "\n");
  console.log(line);
}

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
  const p = path.join(EV_DIR, name);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`  📸 ${p}`);
}

const browser = await chromium.launch({ headless: true });
const createdOrderIds = new Set();
const t0 = new Date().toISOString();
const stamp = Date.now();
const UNIQUE_NOTE = `seller-alerts-probe-${stamp}`;

try {
  // ── Phase 1 · SELLER on /manage BEFORE any order exists.
  const sellerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const sellerPage = await sellerCtx.newPage();
  log({ phase: "pre_signin_seller" });
  await signIn(sellerPage, SELLER_EMAIL, SELLER_PASSWORD, "/nex-native/manage");
  await sellerPage.waitForTimeout(1500);
  log({ phase: "seller_on_manage", url: sellerPage.url() });

  const ordersCardSelector = '[data-nex-manage-link="/nex-native/manage/orders"]';
  const preCardText = await sellerPage.locator(ordersCardSelector).innerText().catch(() => "(not found)");
  log({ phase: "pre_orders_card_text", text: preCardText.replace(/\s+/g, " ") });
  const preBadgePresent = await sellerPage.locator('[data-nex-manage-inbox-unread]').count();
  log({ phase: "pre_badge_mounted", count: preBadgePresent });
  await shot(sellerPage, "01-seller-manage-pre-order.png");

  // Second seller tab holds /manage/orders list (also no reload).
  const sellerOrdersTab = await sellerCtx.newPage();
  await sellerOrdersTab.goto(`${BASE}/nex-native/manage/orders`, { waitUntil: "domcontentloaded" });
  await sellerOrdersTab.waitForTimeout(1500);
  const preRowCount = await sellerOrdersTab.locator('a[data-nex-order-row]').count();
  log({ phase: "pre_orders_list_rows", rowCount: preRowCount });
  await shot(sellerOrdersTab, "02-seller-orders-list-pre.png");

  // Baseline endpoint snapshot.
  const preApi = await sellerPage.evaluate(async () => {
    try {
      const r = await fetch("/api/nex-native/unread-count", { credentials: "include", cache: "no-store" });
      return { status: r.status, body: await r.json() };
    } catch (e) { return { error: String(e) }; }
  });
  log({ phase: "pre_unread_count_endpoint", result: preApi });

  // ── Phase 2 · BUYER real UI journey.
  const buyerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const buyerPage = await buyerCtx.newPage();
  log({ phase: "pre_signin_buyer" });
  await signIn(buyerPage, BUYER_EMAIL, BUYER_PASSWORD, "/nex-native/contacts");
  log({ phase: "buyer_signed_in" });

  // Visit seller shop first so same-origin localStorage write applies
  // on a nex-native page.
  await buyerPage.goto(`${BASE}/nex-native/${BUSINESS_SLUG}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await buyerPage.waitForTimeout(600);

  // SETUP step (labelled as setup, not proof): seed a single-item cart
  // matching the real NexCartItem shape so /cart renders a line for
  // Product X. The checkout itself still runs through the real UI.
  const cartItem = {
    key: crypto.randomUUID(),
    kind: "product",
    id: PRODUCT_X_ID,
    shop_id: BUSINESS_ID,
    shop_slug: BUSINESS_SLUG,
    shop_owner_account_id: SELLER_ACCOUNT_ID,
    shop_display_name: BUSINESS_NAME,
    shop_lat: null,
    shop_lng: null,
    name: PRODUCT_X_NAME,
    price_pence: PRODUCT_X_PRICE_PENCE,
    currency: PRODUCT_X_CURRENCY,
    image_url: null,
    quantity: 1,
    variants: [],
    perks: [],
    perks_note: null,
    note: null,
    added_at: Date.now(),
  };
  await buyerPage.evaluate(
    ({ key, item }) => {
      window.localStorage.setItem(key, JSON.stringify([item]));
      window.dispatchEvent(new CustomEvent("nex-cart-changed"));
    },
    { key: CART_STORAGE_KEY, item: cartItem },
  );
  log({ phase: "cart_seeded_as_setup", key: CART_STORAGE_KEY, productId: PRODUCT_X_ID });

  // Open the actual cart page in the real buyer UI.
  await buyerPage.goto(`${BASE}/nex-native/cart`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  // Wait for client hydration to complete · the dev-mode Turbopack
  // first-paint ships "Loading your cart…" and only replaces it after
  // the useEffect fires and reads localStorage.
  try {
    await buyerPage.waitForFunction(
      (name) => {
        const txt = (document.body && document.body.innerText) || "";
        return !txt.includes("Loading your cart") && txt.includes(name);
      },
      PRODUCT_X_NAME,
      { timeout: 45_000 },
    );
  } catch (e) {
    await shot(buyerPage, "03a-buyer-cart-page-failed-hydrate.png");
    throw e;
  }
  await shot(buyerPage, "03a-buyer-cart-page.png");
  log({ phase: "cart_page_rendered", productVisible: true });

  // Click the real "Checkout →" button. Grounded in the passing
  // cart-order-deterministic spec selector.
  await buyerPage
    .locator("button", { hasText: /^Checkout\s*→$/ })
    .first()
    .click();

  // Scope every field interaction to the real checkout sheet.
  const sheet = buyerPage.locator(`[data-nex-checkout-sheet="${BUSINESS_ID}"]`);
  await sheet.waitFor({ state: "visible", timeout: 15_000 });
  await shot(buyerPage, "03b-buyer-checkout-sheet.png");

  await sheet.locator("#co-name").fill("Alerts Probe Buyer");
  // #co-phone + address fields are optional at submit (canSend only
  // requires buyerName), but we fill them to mirror a real flow.
  const phoneInput = sheet.locator("#co-phone");
  if (await phoneInput.count()) await phoneInput.fill("+353 1 234 5678");
  const streetInput = sheet.locator('input[placeholder="Street + number"]');
  if (await streetInput.count()) await streetInput.fill("1 Probe Lane");
  const cityInput = sheet.locator('input[placeholder="City"]');
  if (await cityInput.count()) await cityInput.fill("Testopolis");
  const notesInput = sheet.locator("#co-notes");
  if (await notesInput.count()) await notesInput.fill(UNIQUE_NOTE);

  const submit = sheet.locator('button[type="submit"]');
  await submit.waitFor({ state: "visible", timeout: 10_000 });
  // The checkout form posts via server action · the redirect may land
  // on /chat/peer/<seller>?cart_sent=1 for chat_only destinations.
  const submitTs = Date.now();
  await submit.click();
  log({ phase: "buyer_submit_clicked", submitTs });

  try {
    await buyerPage.waitForURL(/\/chat\/peer\//, { timeout: 60_000 });
    log({ phase: "buyer_redirected_to_chat", url: buyerPage.url() });
  } catch (e) {
    log({ phase: "buyer_redirect_timeout", err: String(e), url: buyerPage.url() });
  }
  await shot(buyerPage, "04-buyer-after-submit.png");

  // ── Phase 3 · Seller surface observation WITHOUT reload for 120s.
  log({ phase: "observation_begin", durationMs: 120000 });
  const obsStart = Date.now();
  let firstBadgeMountedAt = null;     // seconds until [data-nex-manage-inbox-unread] appears
  let firstApiOrdersPositiveAt = null; // seconds until endpoint returns orders > 0
  let firstListRowAt = null;           // seconds until /manage/orders list grows (without reload)

  while (Date.now() - obsStart < 120_000) {
    const elapsedS = Math.floor((Date.now() - obsStart) / 1000);

    const badgeCount = await sellerPage.locator('[data-nex-manage-inbox-unread]').count().catch(() => -1);
    const ordersIndicator = await sellerPage
      .locator('[data-nex-manage-link="/nex-native/manage/orders"] [data-nex-manage-link-indicator]')
      .getAttribute("data-nex-manage-link-indicator")
      .catch(() => null);
    const rowCount = await sellerOrdersTab.locator('a[data-nex-order-row]').count().catch(() => -1);

    const apiPoll = await sellerPage.evaluate(async () => {
      try {
        const r = await fetch("/api/nex-native/unread-count", { credentials: "include", cache: "no-store" });
        return { status: r.status, body: await r.json() };
      } catch (e) { return { error: String(e) }; }
    });

    log({
      phase: "observe",
      elapsedS,
      inPageBadgeMountedCount: badgeCount,
      ordersCardIndicator: ordersIndicator,
      listRowCount: rowCount,
      apiStatus: apiPoll.status,
      apiBody: apiPoll.body,
    });

    if (badgeCount > 0 && firstBadgeMountedAt === null) {
      firstBadgeMountedAt = elapsedS;
      log({ phase: "FIRST_IN_PAGE_BADGE_MOUNTED", elapsedS });
      await shot(sellerPage, `05-seller-manage-badge-mounted-at-${elapsedS}s.png`);
    }
    if (apiPoll.body && typeof apiPoll.body.orders === "number" && apiPoll.body.orders > 0 && firstApiOrdersPositiveAt === null) {
      firstApiOrdersPositiveAt = elapsedS;
      log({ phase: "FIRST_API_ORDERS_POSITIVE", elapsedS, apiOrders: apiPoll.body.orders });
    }
    if (rowCount > preRowCount && firstListRowAt === null) {
      firstListRowAt = elapsedS;
      log({ phase: "FIRST_LIST_ROW_APPEAR", elapsedS, rowCount });
      await shot(sellerOrdersTab, `06-seller-orders-list-new-row-at-${elapsedS}s.png`);
    }

    if (firstBadgeMountedAt !== null && firstApiOrdersPositiveAt !== null && firstListRowAt !== null) break;
    await sellerPage.waitForTimeout(5000);
  }
  log({
    phase: "observation_end",
    firstBadgeMountedAt,
    firstApiOrdersPositiveAt,
    firstListRowAt,
  });

  await shot(sellerPage, "07-seller-manage-post-observation.png");
  await shot(sellerOrdersTab, "08-seller-orders-post-observation.png");

  // Baseline reload to verify server-side pending count + exact order
  // linkage. Reload-based evidence is labelled: NOT proof of realtime.
  await sellerPage.reload({ waitUntil: "domcontentloaded" });
  await sellerPage.waitForTimeout(1500);
  const postReloadBadge = await sellerPage.locator('[data-nex-manage-inbox-unread]').count();
  const postReloadCardText = await sellerPage.locator(ordersCardSelector).innerText().catch(() => "");
  log({ phase: "POST_RELOAD_manage", badgeMountedCount: postReloadBadge, cardText: postReloadCardText.replace(/\s+/g, " ") });
  await shot(sellerPage, "09-seller-manage-after-reload.png");

  await sellerOrdersTab.reload({ waitUntil: "domcontentloaded" });
  await sellerOrdersTab.waitForTimeout(1500);
  const postReloadRows = await sellerOrdersTab.locator('a[data-nex-order-row]').count();
  log({ phase: "POST_RELOAD_list", rowCount: postReloadRows });
  await shot(sellerOrdersTab, "10-seller-orders-after-reload.png");

  // Identify exactly the order the probe created · pick the row whose
  // detail text contains UNIQUE_NOTE (not just "first row").
  if (postReloadRows > preRowCount) {
    const rows = sellerOrdersTab.locator('a[data-nex-order-row]');
    const rowCount2 = await rows.count();
    let matchedOrderId = null;
    for (let i = 0; i < rowCount2; i += 1) {
      const href = await rows.nth(i).getAttribute("href");
      if (!href) continue;
      const id = href.split("/").pop();
      // Open detail and check uniqueness.
      await sellerOrdersTab.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
      await sellerOrdersTab.waitForTimeout(800);
      const detailText = await sellerOrdersTab.locator("body").innerText();
      if (detailText.includes(UNIQUE_NOTE) && detailText.includes(PRODUCT_X_NAME)) {
        matchedOrderId = id;
        log({ phase: "EXACT_ORDER_LINKED", orderId: id, containsUniqueNote: true, containsProductName: true });
        await shot(sellerOrdersTab, "11-seller-order-detail-exact-match.png");
        createdOrderIds.add(id);
        break;
      }
    }
    if (!matchedOrderId) {
      log({ phase: "EXACT_ORDER_LINK_FAILED", note: "no row whose detail contained the unique note" });
    }
  }

  await sellerCtx.close();
  await buyerCtx.close();

  // ── Phase 4 · Second-account denial sub-probe.
  // Full "second disposable SELLER" isolation is BLOCKED (acceptance
  // vault = Hammerex/Rosa · protected). We can still prove the buyer
  // (non-shop-owner) cannot read the exact order via the list OR by
  // directly GET-ing the detail route.
  const probeCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const probePage = await probeCtx.newPage();
  await signIn(probePage, BUYER_EMAIL, BUYER_PASSWORD, "/nex-native/manage/orders");
  await probePage.waitForTimeout(1500);
  const probeUrl = probePage.url();
  const probeRowCount = await probePage.locator('a[data-nex-order-row]').count().catch(() => -1);
  log({ phase: "non_seller_denial_list", url: probeUrl, rowCount: probeRowCount });
  await shot(probePage, "12-non-seller-manage-orders.png");

  // Hit the actual authenticated underlying request · if an attacker
  // guesses the id, does the GET return details?
  if (createdOrderIds.size > 0) {
    const orderId = [...createdOrderIds][0];
    await probePage.goto(`${BASE}/nex-native/manage/orders/${orderId}`, { waitUntil: "domcontentloaded" });
    await probePage.waitForTimeout(1500);
    const probeDetailUrl = probePage.url();
    const probeDetailText = await probePage.locator("body").innerText();
    log({
      phase: "non_seller_direct_detail_get",
      attemptedOrderId: orderId,
      landedUrl: probeDetailUrl,
      containsUniqueNote: probeDetailText.includes(UNIQUE_NOTE),
      containsProductName: probeDetailText.includes(PRODUCT_X_NAME),
      bodyFirst200: probeDetailText.slice(0, 200).replace(/\s+/g, " "),
    });
    await shot(probePage, "13-non-seller-direct-detail-get.png");
  }

  // Also hit the `/api/nex-native/unread-count` as the buyer · as the
  // buyer isn't a shop-owner, their `orders` count should be 0.
  const probeApi = await probePage.evaluate(async () => {
    try {
      const r = await fetch("/api/nex-native/unread-count", { credentials: "include", cache: "no-store" });
      return { status: r.status, body: await r.json() };
    } catch (e) { return { error: String(e) }; }
  });
  log({ phase: "non_seller_unread_count_isolation", result: probeApi });

  await probeCtx.close();
} finally {
  await browser.close();

  // Cleanup created rows by exact id.
  console.log("\n[cleanup] scoped by exact order ids created by this run");
  const c = new PG({ connectionString: DB_URL });
  await c.connect();
  try {
    for (const id of createdOrderIds) {
      await c.query(`DELETE FROM nex_order_event WHERE order_id = $1`, [id]);
      const del = await c.query(`DELETE FROM nex_order WHERE id = $1 RETURNING id`, [id]);
      console.log(`  deleted nex_order ${id} (${del.rowCount})`);
    }
    // Belt + braces: catch any cart_order peer_messages this run added.
    const delMsg = await c.query(
      `DELETE FROM nex_peer_message
       WHERE sender_account_id = $1
         AND attachment_type = 'cart_order'
         AND sent_at >= $2::timestamptz
       RETURNING id`,
      [BUYER_ACCOUNT_ID, t0],
    );
    console.log(`  deleted cart_order messages: ${delMsg.rowCount}`);
    // Server-posted plain chat shadow ("Order placed · ..."), if any.
    const delChat = await c.query(
      `DELETE FROM nex_peer_message
       WHERE sender_account_id = $1
         AND attachment_type IS NULL
         AND body LIKE 'Order placed · %'
         AND sent_at >= $2::timestamptz
       RETURNING id`,
      [BUYER_ACCOUNT_ID, t0],
    );
    console.log(`  deleted plain cart chat messages: ${delChat.rowCount}`);
    // Catch orphan nex_order rows the exact-id search didn't match
    // (e.g. the UI couldn't link detail-by-note). Time + buyer scoped.
    const delOrphan = await c.query(
      `DELETE FROM nex_order
       WHERE customer_account_id = $1
         AND business_id = $2
         AND created_at >= $3::timestamptz
       RETURNING id`,
      [BUYER_ACCOUNT_ID, BUSINESS_ID, t0],
    );
    console.log(`  deleted orphan time-scoped orders: ${delOrphan.rowCount}`);
  } finally {
    await c.end();
  }
  console.log(`\nEvidence saved to ${EV_DIR}`);
}
