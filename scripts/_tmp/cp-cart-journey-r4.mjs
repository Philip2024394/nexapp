#!/usr/bin/env node
/**
 * R4 · Cart → Order non-gateway journey (buyer UI → seller dashboard).
 * Independent of the chat decryption blocker.
 *
 * Scope guards:
 *   · Sandbox DB only (DATABASE_URL must point at kdstoyyeygcopkogqsyv)
 *   · Protected UUIDs refused (Hammerex ...111, Rosa ...113)
 *   · No role mutation, no OTP bypass, no commits/pushes/deploys
 *   · Add-to-Cart via rendered UI button (NOT storage injection)
 *   · Seller order visibility via real seller sign-in → real dashboard URL
 *   · Verify truthful unpaid state (state !== 'paid')
 */

import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const EVIDENCE_DIR = "evidence/product-chat-cart-checkpoint";
mkdirSync(EVIDENCE_DIR, { recursive: true });

function envFromFile(file, key) {
  const m = readFileSync(file, "utf8").match(
    new RegExp(`^${key}=['"]?([^'"\\n]*)['"]?$`, "m"),
  );
  if (!m) throw new Error(`missing ${key} in ${file}`);
  return m[1].trim();
}

const DB_URL = envFromFile(".env.local", "DATABASE_URL");
if (!DB_URL.includes("kdstoyyeygcopkogqsyv")) {
  throw new Error("REFUSE · DATABASE_URL not sandbox");
}
if (DB_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  throw new Error("REFUSE · DATABASE_URL points at prod");
}

const ENV = ".env.playwright.vault-ck5";
const BUYER_EMAIL = envFromFile(ENV, "PLAYWRIGHT_CK5_B_EMAIL");
const BUYER_PASSWORD = envFromFile(ENV, "PLAYWRIGHT_CK5_B_PASSWORD");
const BUYER_ACCOUNT_ID = envFromFile(ENV, "PLAYWRIGHT_CK5_B_ACCOUNT_ID");
const SELLER_EMAIL = envFromFile(ENV, "PLAYWRIGHT_CK5_A_EMAIL");
const SELLER_PASSWORD = envFromFile(ENV, "PLAYWRIGHT_CK5_A_PASSWORD");
const SELLER_ACCOUNT_ID = envFromFile(ENV, "PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const BUSINESS_ID = envFromFile(ENV, "PLAYWRIGHT_CK5_A_BUSINESS_ID");
const BUSINESS_SLUG = envFromFile(ENV, "PLAYWRIGHT_CK5_A_BUSINESS_SLUG");
const PRODUCT_ID = envFromFile(ENV, "PLAYWRIGHT_CK5_PRODUCT_X_ID");
const PRODUCT_NAME = envFromFile(ENV, "PLAYWRIGHT_CK5_PRODUCT_X_NAME");

const HAMMEREX = "11111111-1111-4111-8111-111111111111";
const ROSA = "11111111-1111-4111-8111-111111111113";
for (const id of [BUYER_ACCOUNT_ID, SELLER_ACCOUNT_ID]) {
  if (id === HAMMEREX || id === ROSA) {
    throw new Error("REFUSE · protected account id");
  }
}

const BASE = "http://localhost:3008";
const UNIQUE_NOTE = `CP-R4-${Date.now()}`;

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
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, name),
      fullPage: false,
      timeout: 5_000,
    });
  } catch (e) {
    console.log(`  (shot skipped · ${name} · ${String(e.message || e).slice(0, 80)})`);
  }
}

const result = {
  when: new Date().toISOString(),
  unique_note: UNIQUE_NOTE,
  product_id: PRODUCT_ID,
  product_name: PRODUCT_NAME,
};

const browser = await chromium.launch({ headless: true });

try {
  // ── BUYER context ──
  const buyerCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const buyer = await buyerCtx.newPage();
  const buyerConsole = [];
  buyer.on("console", (m) => {
    if (m.type() === "error") buyerConsole.push(m.text().slice(0, 240));
  });

  // Runtime target capture · record every Supabase host the live app
  // directs the browser to call. Used as positive runtime proof that
  // :3008 is bound to the sandbox project kdstoyyeygcopkogqsyv.
  const supabaseHosts = new Set();
  const nonSandboxHosts = new Set();
  const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
  const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
  buyer.on("request", (req) => {
    try {
      const u = new URL(req.url());
      if (u.host.endsWith(".supabase.co") || u.host.endsWith(".supabase.in")) {
        supabaseHosts.add(u.host);
        if (!u.host.startsWith(`${SANDBOX_REF}.`) && !u.host.startsWith(`realtime.`)) {
          nonSandboxHosts.add(u.host);
        }
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

  console.log("STEP A · buyer sign-in");
  await signIn(buyer, BUYER_EMAIL, BUYER_PASSWORD, `/nex-native/product/${PRODUCT_ID}`);

  // Clear any leftover cart so delta reasoning is clean.
  await buyer.evaluate(() => localStorage.removeItem("nex_cart_v1"));
  await buyer.reload({ waitUntil: "domcontentloaded" });
  await buyer.waitForTimeout(1000);

  console.log("STEP B · open product page");
  await buyer.waitForLoadState("networkidle").catch(() => {});
  await buyer.waitForTimeout(1500);
  result.step_B = {
    url: buyer.url(),
    product_title_visible: await buyer.locator(`text=${PRODUCT_NAME}`).first().isVisible().catch(() => false),
    body_includes_product_name: ((await buyer.locator("body").innerText().catch(() => "")) || "").includes(PRODUCT_NAME),
  };
  await shot(buyer, "r4-cart-01-product-page.png");

  console.log("STEP C · click Add to Cart (rendered button)");
  // The add-to-cart button renders as aria-label starting with "Add" by default.
  // Fall back: any button containing "Add" text that's not disabled.
  let addBtn = buyer.locator('button[aria-label*="Add" i]').first();
  if (!(await addBtn.count())) {
    addBtn = buyer.locator('button:has-text("Add")').first();
  }
  const addBtnFound = (await addBtn.count()) > 0;
  result.step_C = { add_btn_found: addBtnFound };
  if (!addBtnFound) {
    throw new Error("add-to-cart button not found on product page");
  }
  await addBtn.click();
  await buyer.waitForTimeout(600);

  // Confirm cart has one item in localStorage.
  const cartRaw = await buyer.evaluate(() => localStorage.getItem("nex_cart_v1"));
  const cartItems = cartRaw ? JSON.parse(cartRaw) : [];
  result.step_C.cart_items_after_click = cartItems.length;
  result.step_C.cart_first_product_id = cartItems[0]?.id ?? cartItems[0]?.product_id ?? null;
  result.step_C.cart_first_qty = cartItems[0]?.quantity ?? null;
  await shot(buyer, "r4-cart-02-after-add.png");

  console.log("STEP D · open cart via header cart icon");
  // Header cart button data attribute from the earlier cart-fix work.
  const cartHeaderBtn = buyer.locator("[data-nex-cart-header-button]").first();
  const hasHeaderBtn = (await cartHeaderBtn.count()) > 0;
  result.step_D = { header_cart_btn_present: hasHeaderBtn };
  if (hasHeaderBtn) {
    await cartHeaderBtn.click();
    await buyer.waitForTimeout(700);
    const dialogCount = await buyer.locator("[role='dialog']").count();
    result.step_D.dialog_count = dialogCount;
    if (dialogCount > 0) {
      const box = await buyer.locator("[role='dialog']").first().boundingBox();
      if (box) {
        result.step_D.dialog_center_x = Math.round(box.x + box.width / 2);
        result.step_D.viewport_mid = 195;
        result.step_D.off_center_px = Math.abs(195 - Math.round(box.x + box.width / 2));
      }
    }
    await shot(buyer, "r4-cart-03-cart-modal.png");
    // Close modal before navigating to full cart page (so Checkout flow starts fresh).
    await buyer.keyboard.press("Escape").catch(() => {});
    await buyer.waitForTimeout(300);
  }

  console.log("STEP E · persistence after reload");
  await buyer.reload({ waitUntil: "domcontentloaded" });
  await buyer.waitForTimeout(800);
  const cartAfterReload = await buyer.evaluate(() => localStorage.getItem("nex_cart_v1"));
  const persistItems = cartAfterReload ? JSON.parse(cartAfterReload) : [];
  result.step_E = {
    cart_items_after_reload: persistItems.length,
    persisted: persistItems.length > 0 && (persistItems[0]?.id === PRODUCT_ID || persistItems[0]?.product_id === PRODUCT_ID),
  };

  console.log("STEP F · go to full cart page + submit no-gateway order");
  await buyer.goto(`${BASE}/nex-native/cart`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  console.log("  cart page loaded · waiting for Checkout button");
  // Wait for the Checkout button specifically — more direct than body text match.
  let checkoutReady = false;
  try {
    await buyer.locator('button:has-text("Checkout")').first().waitFor({
      state: "visible",
      timeout: 25_000,
    });
    checkoutReady = true;
  } catch (e) {
    console.log("  Checkout button never appeared · capturing diagnostic");
  }
  const bodyText = ((await buyer.locator("body").innerText().catch(() => "")) || "");
  result.step_F = {
    checkout_btn_present: checkoutReady,
    body_includes_product: bodyText.includes(PRODUCT_NAME),
    body_sample: bodyText.slice(0, 400).replace(/\s+/g, " "),
    cart_localstorage_items: (await buyer.evaluate(() => {
      try { return JSON.parse(localStorage.getItem("nex_cart_v1") || "[]").length; }
      catch { return -1; }
    })),
  };
  await shot(buyer, "r4-cart-04-cart-page.png");
  if (!checkoutReady) {
    throw new Error("Checkout button never became visible on /nex-native/cart within 25s · body sample saved");
  }
  const checkoutBtn = buyer.locator('button:has-text("Checkout")').first();
  const t0 = new Date().toISOString();
  await checkoutBtn.click();
  await buyer.waitForTimeout(900);

  // Fill checkout sheet (no payment — this is the no-gateway path).
  const sheet = buyer.locator(`[data-nex-checkout-sheet="${BUSINESS_ID}"]`);
  await sheet.locator("#co-name").fill("CP R4 Buyer");
  await sheet.locator('input[placeholder="Street + number"]').fill("CP R4 Street 1");
  await sheet.locator('input[placeholder="City"]').fill("CP R4 City");
  await sheet.locator("#co-notes").fill(UNIQUE_NOTE);
  await shot(buyer, "r4-cart-05-checkout-sheet.png");
  await sheet.locator('button[type="submit"]').click();
  await buyer.waitForURL(/\/chat\/peer\//, { timeout: 60_000 });
  result.step_F.redirected_to = buyer.url();
  await shot(buyer, "r4-cart-06-post-submit.png");

  // ── DB VERIFICATION ──
  console.log("STEP G · DB verify nex_order row");
  const db = new pg.Client({ connectionString: DB_URL });
  await db.connect();
  const row = await db.query(
    `SELECT id, state, product_id, price_pence, currency,
            customer_account_id, business_id, created_at,
            customer_note
       FROM nex_order
      WHERE customer_account_id = $1
        AND business_id = $2
        AND created_at >= $3::timestamptz
      ORDER BY created_at DESC
      LIMIT 1`,
    [BUYER_ACCOUNT_ID, BUSINESS_ID, t0],
  );
  if (row.rowCount === 0) {
    await db.end();
    throw new Error("no nex_order row created");
  }
  const order = row.rows[0];
  result.step_G = {
    order_id: order.id,
    state: order.state,
    is_truthful_unpaid: order.state !== "paid",
    product_id: order.product_id,
    product_id_matches: order.product_id === PRODUCT_ID,
    price_pence: order.price_pence,
    currency: order.currency,
    customer_note_matches: order.customer_note === UNIQUE_NOTE,
    customer_note: order.customer_note,
  };
  await db.end();
  result.order_id = order.id;

  await buyerCtx.close();

  // ── SELLER context ──
  console.log("STEP H · seller sign-in + open order detail");
  const sellerCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const seller = await sellerCtx.newPage();
  const sellerConsole = [];
  seller.on("console", (m) => {
    if (m.type() === "error") sellerConsole.push(m.text().slice(0, 240));
  });
  await signIn(seller, SELLER_EMAIL, SELLER_PASSWORD, `/nex-native/manage/orders/${order.id}`);
  await seller.waitForTimeout(1500);

  // Confirm order detail rendered.
  const detailMain = seller.locator("[data-nex-order-detail]").first();
  const detailAttached = await detailMain.count();
  result.step_H = {
    url: seller.url(),
    detail_rendered: detailAttached > 0,
  };
  if (detailAttached > 0) {
    result.step_H.match_tier = await detailMain.getAttribute("data-nex-order-cart-match-tier");
  }

  // Check buyer-visible fields.
  const body = (await seller.locator("body").innerText().catch(() => "")) || "";
  result.step_H.body_includes_unique_note = body.includes(UNIQUE_NOTE);
  result.step_H.body_includes_product_name = body.includes(PRODUCT_NAME);
  // NOTE · a prior assertion here used /paid/i against body text to detect
  // "wrongly shown as paid". That is unsafe · the Actions strip renders a
  // "Mark paid" button while state is created|pending, so the substring
  // "paid" is present on every unpaid order and the assertion was
  // effectively a no-op. Authoritative state for an order lives in the
  // database, so we re-read it rather than inferring from body text.
  await shot(seller, "r4-cart-07-seller-order-detail.png");

  console.log("STEP I · seller reload · persistence");
  await seller.reload({ waitUntil: "domcontentloaded" });
  await seller.waitForTimeout(1200);
  const body2 = (await seller.locator("body").innerText().catch(() => "")) || "";
  // Re-read order.state from the sandbox DB (authoritative source) rather
  // than substring-matching the rendered body · see note above.
  const db2 = new pg.Client({ connectionString: DB_URL });
  await db2.connect();
  const after = await db2.query(
    `SELECT state FROM nex_order WHERE id = $1 LIMIT 1`,
    [order.id],
  );
  await db2.end();
  const stateAfter = after.rowCount > 0 ? after.rows[0].state : null;
  result.step_I = {
    detail_still_rendered: (await seller.locator("[data-nex-order-detail]").count()) > 0,
    unique_note_still_visible: body2.includes(UNIQUE_NOTE),
    db_state_after_reload: stateAfter,
    is_truthful_unpaid_after_reload: stateAfter !== null && stateAfter !== "paid",
  };
  await shot(seller, "r4-cart-08-seller-reload.png");

  await sellerCtx.close();

  result.buyer_console = buyerConsole.slice(0, 5);
  result.seller_console = sellerConsole.slice(0, 5);
  result.runtime_target = {
    supabase_hosts_observed: Array.from(supabaseHosts).sort(),
    non_sandbox_hosts: Array.from(nonSandboxHosts).sort(),
    positive_sandbox_match: Array.from(supabaseHosts).some((h) =>
      h.startsWith(`${SANDBOX_REF}.`),
    ),
    any_prod_contact: Array.from(supabaseHosts).some((h) =>
      h.startsWith(`${PROD_REF}.`),
    ),
  };
} catch (e) {
  result.error = String(e.message || e);
  console.error("ERR:", e);
} finally {
  await browser.close();
  writeFileSync(
    path.join(EVIDENCE_DIR, "cart-journey-r4-result.json"),
    JSON.stringify(result, null, 2),
  );
  console.log("\nDONE");
  console.log(JSON.stringify(result, null, 2));
}
