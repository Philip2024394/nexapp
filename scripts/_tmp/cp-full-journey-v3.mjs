#!/usr/bin/env node
// Journey v3 · realistic sequencing:
//   1. BUYER: sign in, open product, click Ask Seller → creates conversation
//   2. SELLER: sign in, OPEN the same conversation → registers device key
//      via ensureDeviceKey on ConversationClient mount
//   3. BUYER: back on conversation page, send distinctive message
//   4. Verify DB persistence + seller DOM visibility
//
// Also adds network capture for the /api/nex-native/chat/encrypted POST.

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

const DISTINCTIVE = `CPTEST-v3-${Date.now().toString(36)}-portugal`;
const j = { when: new Date().toISOString(), marker: DISTINCTIVE };

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
  await p.screenshot({ path: path.join(OUT, `v3-${name}.png`) }).catch(() => {});
}

const db = new pg.Client({ connectionString: DB_URL });
await db.connect();

// Pre-check: seller's device key count NOW (before any journey)
const preDevSellerQ = await db.query(
  `SELECT count(*)::int AS n FROM nex_account_device_key WHERE account_id = $1`,
  [SELLER.accountId],
);
j.pre_seller_device_count = preDevSellerQ.rows[0].n;
const preDevBuyerQ = await db.query(
  `SELECT count(*)::int AS n FROM nex_account_device_key WHERE account_id = $1`,
  [BUYER.accountId],
);
j.pre_buyer_device_count = preDevBuyerQ.rows[0].n;

const browser = await chromium.launch({ headless: true });

// -----------------------------------------------------------------
// STEP 1 · BUYER opens product + Ask Seller → creates conversation
// -----------------------------------------------------------------
const buyerCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const buyer = await buyerCtx.newPage();
const buyerConsole = [], buyerNet = [];
buyer.on("console", (m) => buyerConsole.push([m.type(), m.text().slice(0, 300)]));
buyer.on("pageerror", (e) => buyerConsole.push(["pageerror", String(e).slice(0, 300)]));
buyer.on("response", (r) => {
  const url = r.url();
  if (url.includes("/api/nex-native/chat/encrypted") || url.includes("/device-key")) {
    buyerNet.push({ status: r.status(), url });
  }
});

let convId = null;
try {
  await signIn(buyer, BUYER.email, BUYER.pw, `/nex-native/product/${PRODUCT_X_ID}`);
  await buyer.waitForTimeout(1500);
  await shot(buyer, "01-buyer-product");
  const askBtn = buyer.locator("[data-nex-product-ask-seller]").first();
  await askBtn.click();
  await buyer.waitForURL(/\/conversations\//, { timeout: 30_000 }).catch(() => {});
  await buyer.waitForLoadState("networkidle").catch(() => {});
  await buyer.waitForTimeout(2500);
  const m = buyer.url().match(/\/conversations\/([0-9a-f-]+)/);
  convId = m ? m[1] : null;
  j.step1 = { url: buyer.url(), conversation_id: convId };
  await shot(buyer, "02-buyer-conversation-landed");

  // After landing, buyer device key should now be registered.
  const buyerDevQ = await db.query(
    `SELECT count(*)::int AS n FROM nex_account_device_key WHERE account_id = $1`,
    [BUYER.accountId],
  );
  j.step1.buyer_device_count = buyerDevQ.rows[0].n;
} catch (e) {
  j.step1_error = String(e).slice(0, 400);
}

// -----------------------------------------------------------------
// STEP 2 · SELLER opens same conversation → registers device key
// -----------------------------------------------------------------
const sellerCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const seller = await sellerCtx.newPage();
const sellerConsole = [];
seller.on("console", (m) => sellerConsole.push([m.type(), m.text().slice(0, 300)]));
seller.on("pageerror", (e) => sellerConsole.push(["pageerror", String(e).slice(0, 300)]));

try {
  if (convId) {
    await signIn(seller, SELLER.email, SELLER.pw, `/nex-native/conversations/${convId}`);
    await seller.waitForTimeout(3500); // let ensureDeviceKey fire
    j.step2 = { url: seller.url() };
    await shot(seller, "03-seller-landed");

    const sellerDevQ = await db.query(
      `SELECT count(*)::int AS n FROM nex_account_device_key WHERE account_id = $1`,
      [SELLER.accountId],
    );
    j.step2.seller_device_count_after = sellerDevQ.rows[0].n;
  } else {
    j.step2 = { skipped: "no convId from step1" };
  }
} catch (e) {
  j.step2_error = String(e).slice(0, 400);
}

// -----------------------------------------------------------------
// STEP 3 · BUYER sends distinctive message
// -----------------------------------------------------------------
try {
  if (convId && !buyer.isClosed()) {
    // Reload buyer to pick up new seller device key via cached list refresh
    await buyer.reload({ waitUntil: "domcontentloaded" });
    await buyer.waitForLoadState("networkidle").catch(() => {});
    await buyer.waitForTimeout(2500);

    const dbPre = await db.query(
      `SELECT count(*)::int AS n FROM nex_message WHERE conversation_id = $1`,
      [convId],
    );
    j.step3 = { db_msgs_before_send: dbPre.rows[0].n };

    const composer = buyer.locator("input[placeholder='Message…']").first();
    await buyer.waitForFunction(
      () => {
        const el = document.querySelector("input[placeholder='Message…']");
        return el && !el.disabled;
      },
      null,
      { timeout: 20_000 },
    ).catch((e) => { j.step3.peer_ready_wait = String(e).slice(0, 200); });

    await composer.fill(DISTINCTIVE);
    await buyer.waitForTimeout(300);
    const sendBtn = buyer.locator("[data-nex-business-conv-send]").first();
    await sendBtn.click();
    await buyer.waitForTimeout(3500);
    await shot(buyer, "04-buyer-after-send");

    const dbPost = await db.query(
      `SELECT count(*)::int AS n FROM nex_message WHERE conversation_id = $1`,
      [convId],
    );
    j.step3.db_msgs_after_send = dbPost.rows[0].n;

    const bodyText = await buyer.content();
    j.step3.marker_in_dom_after_send = bodyText.includes(DISTINCTIVE);

    // Reload buyer, verify persistence
    await buyer.reload({ waitUntil: "domcontentloaded" });
    await buyer.waitForLoadState("networkidle").catch(() => {});
    await buyer.waitForTimeout(3000);
    const afterReload = await buyer.content();
    j.step3.marker_in_dom_after_reload = afterReload.includes(DISTINCTIVE);
    j.step3.marker_occurrences_after_reload = (afterReload.match(new RegExp(DISTINCTIVE, "g")) || []).length;
    await shot(buyer, "05-buyer-reload-persist");

    j.step3.buyer_net_encrypted_calls = buyerNet.filter(n => n.url.includes("/chat/encrypted"));
  }
} catch (e) {
  j.step3_error = String(e).slice(0, 400);
}

// -----------------------------------------------------------------
// STEP 4 · SELLER verifies receipt
// -----------------------------------------------------------------
try {
  if (convId && !seller.isClosed()) {
    await seller.reload({ waitUntil: "domcontentloaded" });
    await seller.waitForLoadState("networkidle").catch(() => {});
    await seller.waitForTimeout(3500);
    const content = await seller.content();
    j.step4 = {
      marker_in_seller_dom: content.includes(DISTINCTIVE),
      message_rows_count: await seller.locator("[data-nex-business-conv-row]").count(),
      product_card_count: await seller.locator("[data-nex-business-conv-product-card]").count(),
    };
    await shot(seller, "06-seller-after-reload");
  }
} catch (e) {
  j.step4_error = String(e).slice(0, 400);
}

j.buyer_console = buyerConsole.filter(c => c[0] === "error" || c[0] === "pageerror").slice(0, 10);
j.seller_console = sellerConsole.filter(c => c[0] === "error" || c[0] === "pageerror").slice(0, 10);

await buyerCtx.close();
await sellerCtx.close();
await db.end();
writeFileSync(path.join(OUT, "journey-v3-result.json"), JSON.stringify(j, null, 2));
console.log("\n=== SUMMARY ===");
console.log(JSON.stringify(j, null, 2));

await browser.close();
console.log("\n[done]");
