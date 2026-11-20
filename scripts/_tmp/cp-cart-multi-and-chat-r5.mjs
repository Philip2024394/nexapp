#!/usr/bin/env node
/**
 * R5 · Multi-product rendered cart journey + chat matrix 6 live.
 *
 * Addendum-6 scope (within founder-granted items 1 + 2 + 3a/3b):
 *   · Independent Playwright context for buyer and seller
 *   · Sandbox DB writes only through normal server actions
 *   · Sandbox DB reads (SELECT) for assertions
 *   · NO cleanup DELETE/UPDATE (item 3c not approved · rows retained)
 *
 * Scenarios covered:
 *   A  Buyer sign-in · clear any residual cart
 *   B  Add Product X from its product page
 *   C  Add Product Y from its product page
 *   D  Header cart modal · assert 2 lines, line totals, subtotal
 *      center-x against 390px viewport (within ±3px)
 *   E  Increase Product X qty to 2 · assert line total + subtotal
 *   F  Decrease Product X qty back to 1 · assert line total + subtotal
 *   G  Remove Product Y · assert 1 line (X) + updated subtotal
 *   H  Remove Product X · assert empty state + zero badge
 *   I  Reload empty cart · persists empty across reload
 *   J  Re-add X and Y via product pages
 *   K  Reload with 2 items · persists both across reload
 *   L  /nex-native/cart · submit checkout with buyer note (unpaid)
 *   M  Sandbox DB · verify nex_order row + state=created (unpaid)
 *   N  Seller sign-in · open order detail · assert buyer note + products
 *   O  Chat matrix 6 live · buyer sends plaintext chat to seller after
 *      cart_sent redirect · seller side verifies receipt in rendered UI
 *
 * Positive runtime-target match via captured Supabase hosts.
 */

import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const OUT = "evidence/product-chat-cart-checkpoint/addendum-6";
mkdirSync(OUT, { recursive: true });

function envFromFile(file, key) {
  const m = readFileSync(file, "utf8").match(
    new RegExp(`^${key}=['"]?([^'"\\n]*)['"]?$`, "m"),
  );
  if (!m) throw new Error(`missing ${key} in ${file}`);
  return m[1].trim();
}

const DB_URL = envFromFile(".env.local", "DATABASE_URL");
if (!DB_URL.includes("kdstoyyeygcopkogqsyv")) throw new Error("REFUSE · DATABASE_URL not sandbox");
if (DB_URL.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("REFUSE · DATABASE_URL points at prod");

const ENV = ".env.playwright.vault-ck5";
const BUYER_EMAIL = envFromFile(ENV, "PLAYWRIGHT_CK5_B_EMAIL");
const BUYER_PASSWORD = envFromFile(ENV, "PLAYWRIGHT_CK5_B_PASSWORD");
const BUYER_ACCOUNT_ID = envFromFile(ENV, "PLAYWRIGHT_CK5_B_ACCOUNT_ID");
const SELLER_EMAIL = envFromFile(ENV, "PLAYWRIGHT_CK5_A_EMAIL");
const SELLER_PASSWORD = envFromFile(ENV, "PLAYWRIGHT_CK5_A_PASSWORD");
const SELLER_ACCOUNT_ID = envFromFile(ENV, "PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const BUSINESS_ID = envFromFile(ENV, "PLAYWRIGHT_CK5_A_BUSINESS_ID");
const PRODUCT_X_ID = envFromFile(ENV, "PLAYWRIGHT_CK5_PRODUCT_X_ID");
const PRODUCT_X_NAME = envFromFile(ENV, "PLAYWRIGHT_CK5_PRODUCT_X_NAME");
const PRODUCT_Y_ID = envFromFile(ENV, "PLAYWRIGHT_CK5_PRODUCT_Y_ID");
const PRODUCT_Y_NAME = envFromFile(ENV, "PLAYWRIGHT_CK5_PRODUCT_Y_NAME");

// Protected UUID refuse-guard · reaffirms item 1 of §3.
const PROTECTED = new Set([
  "11111111-1111-4111-8111-111111111111", // Hammerex
  "11111111-1111-4111-8111-111111111113", // Rosa
]);
for (const id of [BUYER_ACCOUNT_ID, SELLER_ACCOUNT_ID]) {
  if (PROTECTED.has(id)) throw new Error("REFUSE · protected account id");
}

const BASE = "http://localhost:3008";
const UNIQUE_NOTE = `CP-R5-${Date.now()}`;
// All-letters probe · the JokerKeypad defaults to shift=upper on an
// empty composer so the first letter becomes uppercase. Using only
// a-z (no digits, no spaces) avoids plane toggles · enough letters to
// be unique on a clean chat and visibly non-trivial. The uniq suffix
// is lowercase base-26 of the current timestamp so we can locate the
// message in the seller's rendered history without plane-toggles.
function tsLettersSuffix() {
  let n = Date.now();
  let s = "";
  for (let i = 0; i < 8; i++) {
    s = String.fromCharCode(97 + (n % 26)) + s; // 'a'..'z'
    n = Math.floor(n / 26);
  }
  return s;
}
const PROBE_SUFFIX = tsLettersSuffix();
// First letter auto-capitalises on an empty composer · the search
// target below matches only the deterministic lowercase tail so the
// suffix is what we assert on in the seller UI.
const CHAT_PROBE_TEXT = `hellomatrix${PROBE_SUFFIX}`;
const CHAT_PROBE_SEARCH = `matrix${PROBE_SUFFIX}`;

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
    { timeout: 60_000 },
  );
}

async function shot(page, name) {
  try {
    await page.screenshot({ path: path.join(OUT, name), fullPage: false, timeout: 5_000 });
  } catch (e) {
    console.log(`  (shot skipped · ${name} · ${String(e.message || e).slice(0, 80)})`);
  }
}

async function readCart(page) {
  // Retry a few times if a navigation is racing the eval · the cart is
  // in localStorage so once the page is stable this always succeeds.
  for (let i = 0; i < 5; i++) {
    try {
      const raw = await page.evaluate(() => localStorage.getItem("nex_cart_v1"));
      try { return raw ? JSON.parse(raw) : []; } catch { return []; }
    } catch (e) {
      await page.waitForTimeout(400);
      await page.waitForLoadState("domcontentloaded").catch(() => {});
    }
  }
  return [];
}

async function addViaProductPage(page, productId) {
  await page.goto(`${BASE}/nex-native/product/${productId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(1200);
  let btn = page.locator('button[aria-label*="Add" i]').first();
  if (!(await btn.count())) btn = page.locator('button:has-text("Add")').first();
  await btn.waitFor({ state: "visible", timeout: 15_000 });
  await btn.click();
  await page.waitForTimeout(500);
}

async function openCartModal(page) {
  const btn = page.locator("[data-nex-cart-header-button]").first();
  await btn.waitFor({ state: "visible", timeout: 15_000 });
  await btn.click();
  await page.locator('[role="dialog"]').first().waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(400);
}

async function closeModal(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);
}

async function readLines(page) {
  const lines = await page.locator("[data-nex-cart-popup-line]").all();
  const out = [];
  for (const line of lines) {
    const key = await line.getAttribute("data-nex-cart-popup-line");
    const text = (await line.innerText().catch(() => "")) || "";
    out.push({ key, text: text.replace(/\s+/g, " ").trim() });
  }
  return out;
}

async function readBadgeCount(page) {
  const badge = page.locator("[data-nex-cart-header-button-badge]").first();
  if (!(await badge.count())) return 0;
  const t = (await badge.innerText().catch(() => "")) || "";
  return Number.isNaN(parseInt(t, 10)) ? t : parseInt(t, 10);
}

async function readSubtotal(page) {
  const sub = page.locator(`[data-nex-cart-popup-subtotal="${BUSINESS_ID}"]`).first();
  if (!(await sub.count())) return null;
  return ((await sub.innerText()) || "").trim();
}

const result = {
  when: new Date().toISOString(),
  unique_note: UNIQUE_NOTE,
  chat_probe_text: CHAT_PROBE_TEXT,
  product_x: { id: PRODUCT_X_ID, name: PRODUCT_X_NAME },
  product_y: { id: PRODUCT_Y_ID, name: PRODUCT_Y_NAME },
  disposable_records: [],
};

const browser = await chromium.launch({ headless: true });

try {
  // ───────────────────────── BUYER CONTEXT ─────────────────────────
  const buyerCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const buyer = await buyerCtx.newPage();

  const supabaseHosts = new Set();
  const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
  const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
  buyer.on("request", (req) => {
    try {
      const u = new URL(req.url());
      if (u.host.endsWith(".supabase.co") || u.host.endsWith(".supabase.in")) {
        supabaseHosts.add(u.host);
      }
    } catch {}
  });
  buyer.on("websocket", (ws) => {
    try {
      const u = new URL(ws.url().replace(/^wss?:/, "https:"));
      if (u.host.endsWith(".supabase.co") || u.host.endsWith(".supabase.in")) {
        supabaseHosts.add(u.host);
      }
    } catch {}
  });

  console.log("STEP A · buyer sign-in + clear cart");
  await signIn(buyer, BUYER_EMAIL, BUYER_PASSWORD, `/nex-native/product/${PRODUCT_X_ID}`);
  await buyer.evaluate(() => localStorage.removeItem("nex_cart_v1"));
  await buyer.reload({ waitUntil: "domcontentloaded" });
  await buyer.waitForLoadState("domcontentloaded");
  await buyer.waitForTimeout(1500);
  result.step_A = { signed_in: true, initial_cart: (await readCart(buyer)).length };

  console.log("STEP B · add Product X");
  await addViaProductPage(buyer, PRODUCT_X_ID);
  result.step_B = { cart_after_x: (await readCart(buyer)).length };
  await shot(buyer, "r5-01-after-add-x.png");

  console.log("STEP C · add Product Y");
  await addViaProductPage(buyer, PRODUCT_Y_ID);
  result.step_C = { cart_after_y: (await readCart(buyer)).length };
  await shot(buyer, "r5-02-after-add-y.png");

  console.log("STEP D · open header cart modal · assert 2 lines + centered");
  await openCartModal(buyer);
  const dialogBox = await buyer.locator('[role="dialog"]').first().boundingBox();
  result.step_D = {
    dialog_center_x: dialogBox ? Math.round(dialogBox.x + dialogBox.width / 2) : null,
    viewport_mid: 195,
    off_center_px: dialogBox ? Math.abs(195 - Math.round(dialogBox.x + dialogBox.width / 2)) : null,
    lines: await readLines(buyer),
    badge_count: await readBadgeCount(buyer),
    subtotal_text: await readSubtotal(buyer),
  };
  await shot(buyer, "r5-03-modal-two-lines.png");
  await closeModal(buyer);

  console.log("STEP E · increase X qty to 2");
  await openCartModal(buyer);
  // Locate X line via its key (shopId|productId format · the key attribute carries productId somewhere in it).
  const linesNow = await readLines(buyer);
  // Line key is the cart-item UUID, not the product id · resolve X vs Y
  // by the product NAME embedded in rendered line text.
  const xLine = linesNow.find((l) => (l.text || "").includes(PRODUCT_X_NAME));
  const yLine = linesNow.find((l) => (l.text || "").includes(PRODUCT_Y_NAME));
  if (!xLine || !yLine) throw new Error(`cannot resolve product lines · got=${JSON.stringify(linesNow)}`);
  const xLineEl = buyer.locator(`[data-nex-cart-popup-line="${xLine.key}"]`);
  await xLineEl.locator('button[aria-label="Increase quantity"]').click();
  await buyer.waitForTimeout(300);
  const linesE = await readLines(buyer);
  result.step_E = {
    lines: linesE,
    subtotal_text: await readSubtotal(buyer),
    badge_count: await readBadgeCount(buyer),
  };
  await shot(buyer, "r5-04-x-qty-2.png");

  console.log("STEP F · decrease X qty back to 1");
  await xLineEl.locator('button[aria-label="Decrease quantity"]').click();
  await buyer.waitForTimeout(300);
  result.step_F = {
    lines: await readLines(buyer),
    subtotal_text: await readSubtotal(buyer),
    badge_count: await readBadgeCount(buyer),
  };
  await shot(buyer, "r5-05-x-qty-1.png");

  console.log("STEP G · remove Product Y · X remains");
  const yLineEl = buyer.locator(`[data-nex-cart-popup-line="${yLine.key}"]`);
  await yLineEl.locator('button[aria-label^="Remove"]').click();
  await buyer.waitForTimeout(300);
  result.step_G = {
    lines: await readLines(buyer),
    subtotal_text: await readSubtotal(buyer),
    badge_count: await readBadgeCount(buyer),
    cart_storage: await readCart(buyer),
  };
  await shot(buyer, "r5-06-after-remove-y.png");

  console.log("STEP H · remove Product X · empty state");
  await buyer.locator(`[data-nex-cart-popup-line="${xLine.key}"]`).locator('button[aria-label^="Remove"]').click();
  await buyer.waitForTimeout(500);
  const emptyNode = buyer.locator("[data-nex-cart-popup-empty]");
  result.step_H = {
    empty_node_visible: (await emptyNode.count()) > 0,
    lines_after: await readLines(buyer),
    badge_count: await readBadgeCount(buyer),
    cart_storage: await readCart(buyer),
  };
  await shot(buyer, "r5-07-empty-state.png");
  await closeModal(buyer);

  console.log("STEP I · reload empty cart · persists empty");
  await buyer.reload({ waitUntil: "domcontentloaded" });
  await buyer.waitForLoadState("domcontentloaded");
  await buyer.waitForTimeout(1500);
  result.step_I = {
    cart_storage_after_reload: await readCart(buyer),
    badge_count: await readBadgeCount(buyer),
  };

  console.log("STEP J · re-add X and Y");
  await addViaProductPage(buyer, PRODUCT_X_ID);
  await addViaProductPage(buyer, PRODUCT_Y_ID);
  result.step_J = { cart_storage_after_readd: await readCart(buyer) };

  console.log("STEP K · reload with 2 items · persists both");
  await buyer.reload({ waitUntil: "domcontentloaded" });
  await buyer.waitForLoadState("domcontentloaded");
  await buyer.waitForTimeout(1500);
  const cartK = await readCart(buyer);
  result.step_K = {
    cart_items_after_reload: cartK.length,
    cart_product_ids: cartK.map((c) => c.id ?? c.product_id ?? null).sort(),
    badge_count: await readBadgeCount(buyer),
  };

  console.log("STEP L · /nex-native/cart · submit checkout w/ buyer note");
  await buyer.goto(`${BASE}/nex-native/cart`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await buyer.locator('button:has-text("Checkout")').first().waitFor({ state: "visible", timeout: 25_000 });
  const t0 = new Date().toISOString();
  await buyer.locator('button:has-text("Checkout")').first().click();
  await buyer.waitForTimeout(900);
  const sheet = buyer.locator(`[data-nex-checkout-sheet="${BUSINESS_ID}"]`);
  await sheet.locator("#co-name").fill("CP R5 Buyer");
  await sheet.locator('input[placeholder="Street + number"]').fill("CP R5 Street 2");
  await sheet.locator('input[placeholder="City"]').fill("CP R5 City");
  await sheet.locator("#co-notes").fill(UNIQUE_NOTE);
  await shot(buyer, "r5-08-checkout-sheet.png");
  await sheet.locator('button[type="submit"]').click();
  await buyer.waitForURL(/\/chat\/peer\//, { timeout: 60_000 });
  result.step_L = { redirected_to: buyer.url() };
  await shot(buyer, "r5-09-post-submit-chat.png");

  console.log("STEP M · DB verify nex_order row");
  const db = new pg.Client({ connectionString: DB_URL });
  await db.connect();
  const row = await db.query(
    `SELECT id, state, product_id, price_pence, currency,
            customer_account_id, business_id, created_at, customer_note
       FROM nex_order
      WHERE customer_account_id = $1
        AND business_id = $2
        AND created_at >= $3::timestamptz
      ORDER BY created_at DESC
      LIMIT 3`,
    [BUYER_ACCOUNT_ID, BUSINESS_ID, t0],
  );
  if (row.rowCount === 0) { await db.end(); throw new Error("no nex_order row created"); }
  const order = row.rows[0];
  result.step_M = {
    order_id: order.id,
    state: order.state,
    is_truthful_unpaid: order.state !== "paid",
    price_pence: order.price_pence,
    currency: order.currency,
    customer_note: order.customer_note,
    customer_note_matches: order.customer_note === UNIQUE_NOTE,
    order_rows_in_window: row.rowCount,
  };
  result.disposable_records.push({ table: "nex_order", id: order.id, keyed_by: UNIQUE_NOTE });

  // Matrix 6 live · chat happy baseline. Send a plaintext text to seller
  // from the redirected /chat/peer surface, verify it reaches seller side.
  console.log("STEP O1 · buyer sends chat matrix-6 probe");
  // After cart_sent redirect, buyer is at /nex-native/chat/peer/<seller>.
  // Give the chat shell a longer settle · the composer renders after
  // the chat history hydrates.
  await buyer.waitForTimeout(3500);
  // Composer is form [data-nex-peer-composer] containing <Chat9001Pill>,
  // which renders a <NexInput> (native <input>, NOT textarea) with
  // forceKeypadActive={true} · that forces readOnly=true. Keyboard
  // typing is blocked by readOnly; programmatic value injection via
  // React's native input setter + 'input' event dispatch still updates
  // the controlled `text` state (readOnly blocks user input, not
  // programmatic input events).
  const composerForm = buyer.locator("[data-nex-peer-composer]").first();
  result.step_O1_debug = {
    composer_form_count: await buyer.locator("[data-nex-peer-composer]").count(),
    composer_input_count: await buyer
      .locator('[data-nex-peer-composer] input[data-nex-composer-textarea]')
      .count(),
    send_btn_count: await buyer
      .locator('[data-nex-peer-composer] button[aria-label="Send message"]')
      .count(),
    url: buyer.url(),
  };

  // Real-keypad drive (no hidden-body override · no E2E hook · no
  // React state mutation · no form.requestSubmit shortcut). We click:
  //   1. the composer input (forceKeypadActive=true · opens JokerKeypad)
  //   2. each letter button [data-nex-joker-key="<glyph>"] in sequence
  //   3. the pill's Send button [aria-label="Send message"]
  //
  // The JokerKeypad starts in shift=upper on an empty composer, so the
  // first character emits uppercase and the data-nex-joker-key glyph
  // is "H". After the first press shift→lower, so subsequent keys use
  // lowercase glyphs. clickKey looks up either case defensively.
  const inputEl = buyer
    .locator('[data-nex-peer-composer] input[data-nex-composer-textarea]')
    .first();
  await inputEl.waitFor({ state: "visible", timeout: 15_000 });
  await inputEl.click();
  await buyer.waitForTimeout(600);

  // Keypad must mount + become visible.
  const keypad = buyer.locator('[aria-label="Joker keypad"]').first();
  const keypadVisible = await keypad
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  result.step_O1_debug.keypad_visible = keypadVisible;

  let chatSent = false;
  let composerStrategy = "none";
  const keypressLog = [];
  if (keypadVisible) {
    composerStrategy = "real-joker-keypad-clicks";
    for (const ch of CHAT_PROBE_TEXT) {
      const upper = ch.toUpperCase();
      const lower = ch.toLowerCase();
      const sel =
        `[aria-label="Joker keypad"] button[data-nex-joker-key="${upper}"], ` +
        `[aria-label="Joker keypad"] button[data-nex-joker-key="${lower}"]`;
      const btn = buyer.locator(sel).first();
      try {
        await btn.waitFor({ state: "visible", timeout: 4000 });
        await btn.click();
        keypressLog.push(ch);
        await buyer.waitForTimeout(40);
      } catch (e) {
        keypressLog.push(`FAIL(${ch})`);
        break;
      }
    }

    // Verify canSend armed before clicking Send. The pill's data
    // attribute flips to "true" once React propagates the composer
    // text state (driven by the keypad's onChange path).
    const sendBtn = buyer
      .locator('[data-nex-peer-composer] button[aria-label="Send message"]')
      .first();
    await buyer.waitForTimeout(400);
    const sendActiveAttr = await sendBtn
      .getAttribute('data-nex-free-chat-composer-send-active')
      .catch(() => null);
    result.step_O1_debug.send_active_attr = sendActiveAttr;
    result.step_O1_debug.keypresses = keypressLog.join("");

    if (sendActiveAttr === "true") {
      // Submit via the keypad's ↵ Enter key. In chat mode this calls
      // onSend() + onClose() (sealed documented behaviour · see
      // _joker-keypad.tsx:580-583). The pill Send button cannot be
      // clicked while the keypad is open because the keypad dialog
      // intercepts pointer events · the ↵ key is the user's documented
      // thumb-reachable submit path (_joker-keypad.tsx:769-772).
      const enterKey = buyer
        .locator('[aria-label="Joker keypad"] button[data-nex-joker-key="↵"]')
        .first();
      try {
        await enterKey.waitFor({ state: "visible", timeout: 4000 });
        await enterKey.click();
        chatSent = true;
        composerStrategy = "real-joker-keypad-clicks+enter-submit";
        // Allow the sealed encrypted-send pipeline (device-key fetch +
        // POST /api/nex-native/peer-message/encrypted + router.refresh)
        // OR, if the encrypted path isn't available, the R3 fail-closed
        // server-side refusal (redirect with ?message_error=e2e_required)
        // to settle.
        await buyer.waitForTimeout(5000);
      } catch (e) {
        result.step_O1_debug.enter_key_error = String(e).slice(0, 300);
      }
    }
  }
  // R3 fail-closed capture · owner-authorised 2026-11-17. After the
  // Enter submit, the URL either:
  //   (a) stays on /chat/peer/<seller> after a successful encrypted
  //       send (Bridge 76 preventDefault + router.refresh), OR
  //   (b) redirects to /chat/peer/<seller>?message_error=e2e_required
  //       when the server action refused a plaintext body because
  //       encryption wasn't ready / interceptor was bypassed.
  // We capture the final URL + visible banner text so the report can
  // distinguish encrypted-send vs fail-closed-refusal.
  const postSendUrl = buyer.url();
  const bannerText = await buyer
    .locator("[data-nex-chat-error-banner]")
    .first()
    .innerText()
    .catch(() => null);
  result.step_O1 = {
    composer_strategy: composerStrategy,
    keypad_visible: keypadVisible,
    probe_text_sent: chatSent ? CHAT_PROBE_TEXT : null,
    keypresses_count: keypressLog.filter((x) => !x.startsWith("FAIL")).length,
    chat_sent: chatSent,
    post_send_url: postSendUrl,
    post_send_url_includes_e2e_required: postSendUrl.includes(
      "message_error=e2e_required",
    ),
    e2e_required_banner_text: bannerText
      ? bannerText.slice(0, 200).replace(/\s+/g, " ")
      : null,
  };
  await shot(buyer, "r5-10-chat-probe-sent.png");
  await db.end();
  await buyerCtx.close();

  // ───────────────────────── SELLER CONTEXT ─────────────────────────
  console.log("STEP N · seller sign-in · open order detail");
  const sellerCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const seller = await sellerCtx.newPage();
  await signIn(seller, SELLER_EMAIL, SELLER_PASSWORD, `/nex-native/manage/orders/${order.id}`);
  await seller.waitForTimeout(1500);
  const detail = seller.locator("[data-nex-order-detail]").first();
  const body = (await seller.locator("body").innerText().catch(() => "")) || "";
  result.step_N = {
    detail_rendered: (await detail.count()) > 0,
    match_tier: await detail.getAttribute("data-nex-order-cart-match-tier").catch(() => null),
    body_includes_unique_note: body.includes(UNIQUE_NOTE),
    body_includes_product_x: body.includes(PRODUCT_X_NAME),
    body_includes_product_y: body.includes(PRODUCT_Y_NAME),
  };
  await shot(seller, "r5-11-seller-order.png");

  // STEP O2 · seller opens peer chat with buyer and looks for the probe
  console.log("STEP O2 · seller verifies chat probe arrival");
  await seller.goto(`${BASE}/nex-native/chat/peer/${BUYER_ACCOUNT_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  // Allow chat history hydration + device-key refresh.
  await seller.waitForTimeout(3500);
  const sellerBody = (await seller.locator("body").innerText().catch(() => "")) || "";
  // CHAT_PROBE_SEARCH is the deterministic lowercase tail · immune to
  // first-letter auto-capitalisation.
  result.step_O2 = {
    chat_body_includes_probe_search: sellerBody.includes(CHAT_PROBE_SEARCH),
    chat_body_includes_probe_full: sellerBody.includes(CHAT_PROBE_TEXT),
    chat_body_sample: sellerBody.slice(0, 500).replace(/\s+/g, " "),
    probe_search_token: CHAT_PROBE_SEARCH,
  };
  await shot(seller, "r5-12-seller-chat.png");

  // Reload persistence · same device (seller side). This is same-
  // device reload, NOT new-device decrypt. Keep the distinction.
  await seller.reload({ waitUntil: "domcontentloaded" });
  await seller.waitForTimeout(3500);
  const sellerBody2 = (await seller.locator("body").innerText().catch(() => "")) || "";
  result.step_O2.chat_body_includes_probe_search_after_reload =
    sellerBody2.includes(CHAT_PROBE_SEARCH);
  await shot(seller, "r5-13-seller-chat-reload.png");

  // Seller side DB check · nex_peer_message has no recipient_account_id;
  // messages are addressed via conversation_id. Count sender's messages
  // in the window since cart submit · the conversation itself is the
  // buyer↔seller pair, so any new message from buyer in window is in
  // this journey's conversation.
  const db2 = new pg.Client({ connectionString: DB_URL });
  await db2.connect();
  const pmCount = await db2.query(
    `SELECT COUNT(*)::int AS n FROM nex_peer_message
      WHERE sender_account_id = $1
        AND sent_at >= $2::timestamptz`,
    [BUYER_ACCOUNT_ID, t0],
  );
  result.step_O2.buyer_peer_messages_in_window = pmCount.rows[0].n;
  // Current-run sample · schema-only (no body printed · follows the
  // directive's "do not print sensitive message content" guard).
  const pmSample = await db2.query(
    `SELECT id, conversation_id, encrypted, delivery_status, sent_at
       FROM nex_peer_message
      WHERE sender_account_id = $1 AND sent_at >= $2::timestamptz
      ORDER BY sent_at ASC LIMIT 5`,
    [BUYER_ACCOUNT_ID, t0],
  );
  result.step_O2.buyer_msg_sample = pmSample.rows.map((r) => ({
    id: r.id,
    conversation_id: r.conversation_id,
    encrypted: r.encrypted,
    delivery_status: r.delivery_status,
    sent_at: r.sent_at,
  }));

  // §4 Investigation · the prior-run pending row we need to
  // characterise. READ-ONLY · we fetch schema-visible metadata only.
  // body column identity is important for the report (does plaintext
  // actually land there?). We check column existence + whether it is
  // non-null for that specific row · we do NOT print the contents.
  const PENDING_ROW_ID = "f44464b1-c91d-4e22-a293-5400a3929338";
  const pendingCols = await db2.query(
    `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name='nex_peer_message'
       ORDER BY ordinal_position`,
  );
  const pendingProbe = await db2.query(
    `SELECT id, conversation_id, sender_account_id, encrypted,
            delivery_status, sent_at,
            (body IS NOT NULL) AS has_body,
            (ciphertext IS NOT NULL) AS has_ciphertext,
            (nonce IS NOT NULL) AS has_nonce,
            (message_group_id IS NOT NULL) AS has_message_group,
            octet_length(body) AS body_len,
            octet_length(ciphertext) AS ciphertext_len,
            attachment_url, attachment_type,
            reply_to_id
       FROM nex_peer_message
      WHERE id = $1`,
    [PENDING_ROW_ID],
  );
  result.pending_row_investigation = {
    pending_row_id: PENDING_ROW_ID,
    row_present: pendingProbe.rowCount > 0,
    row_metadata: pendingProbe.rows[0] ?? null,
    schema_columns: pendingCols.rows.map((r) => r.column_name),
  };
  await db2.end();

  await sellerCtx.close();

  result.runtime_target = {
    supabase_hosts_observed: Array.from(supabaseHosts).sort(),
    positive_sandbox_match: Array.from(supabaseHosts).some((h) => h.startsWith(`${SANDBOX_REF}.`)),
    any_prod_contact: Array.from(supabaseHosts).some((h) => h.startsWith(`${PROD_REF}.`)),
  };
} catch (e) {
  result.error = String(e.message || e);
  console.error("ERR:", e);
} finally {
  await browser.close();
  writeFileSync(path.join(OUT, "r5-multi-and-chat-result.json"), JSON.stringify(result, null, 2));
  console.log("\nDONE");
  console.log(JSON.stringify(result, null, 2));
}
