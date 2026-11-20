#!/usr/bin/env node
// Round 4 journey · prove the DeviceKeyHub fix:
//   1. Buyer signs in · opens product · Ask Seller → creates conversation
//      → DeviceKeyHub on conversation page registers buyer's fresh key
//   2. Seller signs in · opens same conversation
//      → DeviceKeyHub registers seller's fresh key
//   3. Buyer sends distinctive question → fan-out includes seller's new device
//   4. Seller reads buyer's message (decrypt) · replies
//   5. Buyer reads seller's reply (decrypt)
//   6. Both reload · verify messages persist decrypted
//   7. Plain-chat (no product) via a SECOND conversation · verify unchanged
//
// Sandbox only · reuses pre-authorised CK5 disposable identities.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const OUT = "evidence/product-chat-cart-checkpoint";
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3008";

function env(f, n) {
  const r = readFileSync(f, "utf8");
  const m = r.match(new RegExp(`^${n}=['"]?([^'"\\n]*)['"]?$`, "m"));
  return m ? m[1].trim() : null;
}

const DB_URL = env(".env.local", "DATABASE_URL");
if (!DB_URL || DB_URL.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("REFUSE prod");
if (!DB_URL.includes("kdstoyyeygcopkogqsyv")) throw new Error("REFUSE not sandbox");

const CK5 = ".env.playwright.vault-ck5";
const SELLER = {
  email: env(CK5, "PLAYWRIGHT_CK5_A_EMAIL"),
  pw: env(CK5, "PLAYWRIGHT_CK5_A_PASSWORD"),
  accountId: env(CK5, "PLAYWRIGHT_CK5_A_ACCOUNT_ID"),
  businessId: env(CK5, "PLAYWRIGHT_CK5_A_BUSINESS_ID"),
};
const BUYER = {
  email: env(CK5, "PLAYWRIGHT_CK5_B_EMAIL"),
  pw: env(CK5, "PLAYWRIGHT_CK5_B_PASSWORD"),
  accountId: env(CK5, "PLAYWRIGHT_CK5_B_ACCOUNT_ID"),
};
const PRODUCT_X_ID = env(CK5, "PLAYWRIGHT_CK5_PRODUCT_X_ID");
if (/hammerex|rosa|99901|99903/i.test(SELLER.email + BUYER.email)) throw new Error("REFUSE protected");

const BUYER_Q = `CPTEST-v4-${Date.now().toString(36)}-buyerQ`;
const SELLER_R = `CPTEST-v4-${Date.now().toString(36)}-sellerR`;
const j = { when: new Date().toISOString(), buyer_q: BUYER_Q, seller_r: SELLER_R };

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

async function shot(p, name) {
  await p.screenshot({ path: path.join(OUT, `v4-${name}.png`) }).catch(() => {});
}

const db = new pg.Client({ connectionString: DB_URL });
await db.connect();

const preBuyerDev = (await db.query(
  `SELECT count(*)::int AS n FROM nex_account_device_key WHERE account_id = $1`,
  [BUYER.accountId],
)).rows[0].n;
const preSellerDev = (await db.query(
  `SELECT count(*)::int AS n FROM nex_account_device_key WHERE account_id = $1`,
  [SELLER.accountId],
)).rows[0].n;
j.pre_buyer_device_count = preBuyerDev;
j.pre_seller_device_count = preSellerDev;

const browser = await chromium.launch({ headless: true });

// ─────────────────────────────────────────────────────────────
// STEP 1 · BUYER signs in · asks seller about product X
// ─────────────────────────────────────────────────────────────
const buyerCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const buyer = await buyerCtx.newPage();
const buyerConsole = [];
buyer.on("console", (m) => { if (m.type() === "error") buyerConsole.push(m.text().slice(0, 300)); });
buyer.on("pageerror", (e) => buyerConsole.push(String(e).slice(0, 300)));

let convId = null;
try {
  await signIn(buyer, BUYER.email, BUYER.pw, `/nex-native/product/${PRODUCT_X_ID}`);
  await buyer.waitForTimeout(1500);
  await shot(buyer, "01-buyer-product");
  const askBtn = buyer.locator("[data-nex-product-ask-seller]").first();
  await askBtn.click();
  await buyer.waitForURL(/\/conversations\//, { timeout: 30_000 }).catch(() => {});
  await buyer.waitForLoadState("networkidle").catch(() => {});
  // DeviceKeyHub mounts in useEffect after hydration · give it time to
  // fire ensureDeviceKey + upsertDeviceKeyAction + clearDeviceKeyCache
  await buyer.waitForTimeout(3500);
  const m = buyer.url().match(/\/conversations\/([0-9a-f-]+)/);
  convId = m ? m[1] : null;
  j.step1 = { url: buyer.url(), conversation_id: convId };
  await shot(buyer, "02-buyer-conversation");

  const buyerDevAfter = (await db.query(
    `SELECT count(*)::int AS n FROM nex_account_device_key WHERE account_id = $1`,
    [BUYER.accountId],
  )).rows[0].n;
  j.step1.buyer_device_count_after_mount = buyerDevAfter;
  j.step1.buyer_device_delta = buyerDevAfter - preBuyerDev;
} catch (e) {
  j.step1_error = String(e).slice(0, 400);
}

// ─────────────────────────────────────────────────────────────
// STEP 2 · SELLER signs in · opens same conversation (DeviceKeyHub)
// ─────────────────────────────────────────────────────────────
const sellerCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const seller = await sellerCtx.newPage();
const sellerConsole = [];
seller.on("console", (m) => { if (m.type() === "error") sellerConsole.push(m.text().slice(0, 300)); });
seller.on("pageerror", (e) => sellerConsole.push(String(e).slice(0, 300)));

try {
  if (!convId) throw new Error("no convId from step1");
  await signIn(seller, SELLER.email, SELLER.pw, `/nex-native/conversations/${convId}`);
  await seller.waitForLoadState("networkidle").catch(() => {});
  await seller.waitForTimeout(3500);
  j.step2 = { url: seller.url() };
  await shot(seller, "03-seller-landed");

  const sellerDevAfter = (await db.query(
    `SELECT count(*)::int AS n FROM nex_account_device_key WHERE account_id = $1`,
    [SELLER.accountId],
  )).rows[0].n;
  j.step2.seller_device_count_after_mount = sellerDevAfter;
  j.step2.seller_device_delta = sellerDevAfter - preSellerDev;
} catch (e) {
  j.step2_error = String(e).slice(0, 400);
}

// ─────────────────────────────────────────────────────────────
// STEP 3 · BUYER reloads (fresh cache fetch) · sends BUYER_Q
// ─────────────────────────────────────────────────────────────
try {
  if (!convId || buyer.isClosed()) throw new Error("buyer unavailable");
  await buyer.reload({ waitUntil: "domcontentloaded" });
  await buyer.waitForLoadState("networkidle").catch(() => {});
  await buyer.waitForTimeout(3500);

  const dbPre = (await db.query(
    `SELECT count(*)::int AS n FROM nex_message WHERE conversation_id = $1`,
    [convId],
  )).rows[0].n;
  j.step3 = { db_msgs_before_send: dbPre };

  const composer = buyer.locator("input[placeholder='Message…']").first();
  await buyer.waitForFunction(
    () => {
      const el = document.querySelector("input[placeholder='Message…']");
      return el && !el.disabled;
    },
    null,
    { timeout: 20_000 },
  ).catch(() => {});
  await composer.fill(BUYER_Q);
  await buyer.waitForTimeout(300);
  await buyer.locator("[data-nex-business-conv-send]").first().click();
  await buyer.waitForTimeout(3500);
  await shot(buyer, "04-buyer-after-send");

  const dbPost = (await db.query(
    `SELECT count(*)::int AS n FROM nex_message WHERE conversation_id = $1`,
    [convId],
  )).rows[0].n;
  j.step3.db_msgs_after_send = dbPost;
  j.step3.db_rows_delta = dbPost - dbPre;

  const bodyAfterSend = await buyer.content();
  j.step3.marker_in_buyer_dom_after_send = bodyAfterSend.includes(BUYER_Q);

  // Reload buyer · verify buyer can decrypt own copy
  await buyer.reload({ waitUntil: "domcontentloaded" });
  await buyer.waitForLoadState("networkidle").catch(() => {});
  await buyer.waitForTimeout(3500);
  const bodyAfterReload = await buyer.content();
  j.step3.marker_in_buyer_dom_after_reload = bodyAfterReload.includes(BUYER_Q);
  j.step3.marker_occurrences_after_reload = (bodyAfterReload.match(new RegExp(BUYER_Q, "g")) || []).length;
  await shot(buyer, "05-buyer-reload-decrypt");
} catch (e) {
  j.step3_error = String(e).slice(0, 400);
}

// ─────────────────────────────────────────────────────────────
// STEP 4 · SELLER reloads · reads BUYER_Q · replies SELLER_R
// ─────────────────────────────────────────────────────────────
try {
  if (!convId || seller.isClosed()) throw new Error("seller unavailable");
  await seller.reload({ waitUntil: "domcontentloaded" });
  await seller.waitForLoadState("networkidle").catch(() => {});
  await seller.waitForTimeout(3500);
  const sellerContent = await seller.content();
  j.step4 = {
    marker_in_seller_dom: sellerContent.includes(BUYER_Q),
    message_rows_count: await seller.locator("[data-nex-business-conv-row]").count(),
    product_card_count: await seller.locator("[data-nex-business-conv-product-card]").count(),
  };
  await shot(seller, "06-seller-reads-buyerQ");

  if (j.step4.marker_in_seller_dom) {
    const sComposer = seller.locator("input[placeholder='Message…']").first();
    await seller.waitForFunction(
      () => {
        const el = document.querySelector("input[placeholder='Message…']");
        return el && !el.disabled;
      },
      null,
      { timeout: 20_000 },
    ).catch(() => {});
    await sComposer.fill(SELLER_R);
    await seller.waitForTimeout(300);
    await seller.locator("[data-nex-business-conv-send]").first().click();
    await seller.waitForTimeout(3500);
    j.step4.seller_sent = true;
    await shot(seller, "07-seller-after-reply");
  } else {
    j.step4.seller_sent = false;
  }
} catch (e) {
  j.step4_error = String(e).slice(0, 400);
}

// ─────────────────────────────────────────────────────────────
// STEP 5 · BUYER reloads · reads SELLER_R
// ─────────────────────────────────────────────────────────────
try {
  if (!convId || buyer.isClosed()) throw new Error("buyer unavailable");
  await buyer.reload({ waitUntil: "domcontentloaded" });
  await buyer.waitForLoadState("networkidle").catch(() => {});
  await buyer.waitForTimeout(3500);
  const bodyFinal = await buyer.content();
  j.step5 = {
    buyer_sees_buyer_q: bodyFinal.includes(BUYER_Q),
    buyer_sees_seller_r: bodyFinal.includes(SELLER_R),
    message_rows_count: await buyer.locator("[data-nex-business-conv-row]").count(),
    product_card_count: await buyer.locator("[data-nex-business-conv-product-card]").count(),
  };
  await shot(buyer, "08-buyer-reads-sellerR");
} catch (e) {
  j.step5_error = String(e).slice(0, 400);
}

// ─────────────────────────────────────────────────────────────
// Final · DB snapshot of this conversation
// ─────────────────────────────────────────────────────────────
try {
  if (convId) {
    const rows = await db.query(
      `SELECT id, sender_account_id, encrypted,
              octet_length(ciphertext)::int AS ct_bytes,
              created_at, message_group_id
         FROM nex_message
        WHERE conversation_id = $1
        ORDER BY created_at ASC`,
      [convId],
    );
    j.final_db_rows = rows.rows.length;
    j.final_distinct_groups = new Set(rows.rows.map((r) => r.message_group_id)).size;
    j.final_senders = Array.from(new Set(rows.rows.map((r) => r.sender_account_id)));
  }
} catch (e) {
  j.final_db_error = String(e).slice(0, 400);
}

j.buyer_console = buyerConsole.slice(0, 10);
j.seller_console = sellerConsole.slice(0, 10);

await buyerCtx.close();
await sellerCtx.close();
await db.end();
writeFileSync(path.join(OUT, "journey-v4-result.json"), JSON.stringify(j, null, 2));
console.log(JSON.stringify(j, null, 2));

await browser.close();
console.log("\n[done]");
