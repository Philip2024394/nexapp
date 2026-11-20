#!/usr/bin/env node
// Journey v5 · Persistent-context variant.
//
// v4 proved the DeviceKeyHub fix REGISTERS keys correctly in sandbox DB
// (buyer +1, seller +1 on first landing). But Playwright's default
// chromium.newContext appears to lose IndexedDB across page reloads
// (each reload spawned a NEW buyer deviceId, orphaning the self-copy
// encrypted at send time). That's a test-harness behaviour, not a
// product behaviour — a real user's browser preserves IDB. To exercise
// a REAL user path, this run uses launchPersistentContext with a temp
// user-data-dir per role so IDB survives reloads exactly as it does
// for real users.
//
// Journey:
//   1. BUYER signs in → opens product → Ask Seller → conversation
//   2. SELLER signs in in a separate persistent context → opens same
//      conversation (DeviceKeyHub registers seller's device)
//   3. BUYER reloads to refresh cached device lists · sends BUYER_Q
//   4. BUYER reloads · must still read BUYER_Q (self-copy decrypt)
//   5. SELLER reloads · must read BUYER_Q · sends SELLER_R
//   6. BUYER reloads · must read SELLER_R
//   7. Separate "plain-chat" (no product) run to prove product-free
//      chat still works.

import { chromium } from "playwright";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
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
};
const BUYER = {
  email: env(CK5, "PLAYWRIGHT_CK5_B_EMAIL"),
  pw: env(CK5, "PLAYWRIGHT_CK5_B_PASSWORD"),
  accountId: env(CK5, "PLAYWRIGHT_CK5_B_ACCOUNT_ID"),
};
const PRODUCT_X_ID = env(CK5, "PLAYWRIGHT_CK5_PRODUCT_X_ID");
if (/hammerex|rosa|99901|99903/i.test(SELLER.email + BUYER.email)) throw new Error("REFUSE protected");

const BUYER_Q = `CPTEST-v5-${Date.now().toString(36)}-buyerQ`;
const SELLER_R = `CPTEST-v5-${Date.now().toString(36)}-sellerR`;
const PLAIN_Q = `CPTEST-v5-${Date.now().toString(36)}-plain`;
const j = { when: new Date().toISOString(), buyer_q: BUYER_Q, seller_r: SELLER_R, plain_q: PLAIN_Q };

const BUYER_UDD = path.join(os.tmpdir(), `nex-cp-buyer-${Date.now()}`);
const SELLER_UDD = path.join(os.tmpdir(), `nex-cp-seller-${Date.now()}`);
mkdirSync(BUYER_UDD, { recursive: true });
mkdirSync(SELLER_UDD, { recursive: true });

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
  await p.screenshot({ path: path.join(OUT, `v5-${name}.png`) }).catch(() => {});
}

async function readDeviceId(page) {
  // Read buyer's IDB device record directly from the browser.
  return page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open("nex-native-crypto", 1);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction("device", "readonly");
        const r = tx.objectStore("device").get("self");
        r.onsuccess = () => {
          const rec = r.result;
          resolve(rec ? rec.deviceId : null);
          db.close();
        };
        r.onerror = () => { resolve(null); db.close(); };
      } catch { resolve(null); db.close(); }
    };
    req.onerror = () => resolve(null);
  }));
}

const db = new pg.Client({ connectionString: DB_URL });
await db.connect();

const preBuyer = (await db.query(`SELECT count(*)::int AS n FROM nex_account_device_key WHERE account_id = $1`, [BUYER.accountId])).rows[0].n;
const preSeller = (await db.query(`SELECT count(*)::int AS n FROM nex_account_device_key WHERE account_id = $1`, [SELLER.accountId])).rows[0].n;
j.pre_buyer_device_count = preBuyer;
j.pre_seller_device_count = preSeller;

// Persistent contexts for both roles — real IDB persistence.
const buyerCtx = await chromium.launchPersistentContext(BUYER_UDD, {
  headless: true,
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const sellerCtx = await chromium.launchPersistentContext(SELLER_UDD, {
  headless: true,
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});

const buyer = await buyerCtx.newPage();
const seller = await sellerCtx.newPage();

const buyerConsole = [], sellerConsole = [];
buyer.on("console", (m) => { if (m.type() === "error") buyerConsole.push(m.text().slice(0, 300)); });
buyer.on("pageerror", (e) => buyerConsole.push(String(e).slice(0, 300)));
seller.on("console", (m) => { if (m.type() === "error") sellerConsole.push(m.text().slice(0, 300)); });
seller.on("pageerror", (e) => sellerConsole.push(String(e).slice(0, 300)));

let convId = null;

try {
  // STEP 1 · buyer
  await signIn(buyer, BUYER.email, BUYER.pw, `/nex-native/product/${PRODUCT_X_ID}`);
  await buyer.waitForTimeout(1500);
  await buyer.locator("[data-nex-product-ask-seller]").first().click();
  await buyer.waitForURL(/\/conversations\//, { timeout: 30_000 }).catch(() => {});
  await buyer.waitForLoadState("networkidle").catch(() => {});
  await buyer.waitForTimeout(4000); // wait for DeviceKeyHub to register
  const m = buyer.url().match(/\/conversations\/([0-9a-f-]+)/);
  convId = m ? m[1] : null;
  const buyerDev1 = await readDeviceId(buyer);
  const buyerDbAfter1 = (await db.query(`SELECT count(*)::int AS n FROM nex_account_device_key WHERE account_id = $1`, [BUYER.accountId])).rows[0].n;
  j.step1 = { url: buyer.url(), conversation_id: convId, buyer_device_id_in_idb: buyerDev1, buyer_db_delta: buyerDbAfter1 - preBuyer };
  await shot(buyer, "01-buyer-conv");

  // STEP 2 · seller
  if (!convId) throw new Error("no convId");
  await signIn(seller, SELLER.email, SELLER.pw, `/nex-native/conversations/${convId}`);
  await seller.waitForLoadState("networkidle").catch(() => {});
  await seller.waitForTimeout(4000);
  const sellerDev1 = await readDeviceId(seller);
  const sellerDbAfter1 = (await db.query(`SELECT count(*)::int AS n FROM nex_account_device_key WHERE account_id = $1`, [SELLER.accountId])).rows[0].n;
  j.step2 = { url: seller.url(), seller_device_id_in_idb: sellerDev1, seller_db_delta: sellerDbAfter1 - preSeller };
  await shot(seller, "02-seller-lands");

  // STEP 3 · buyer reload → send
  await buyer.reload({ waitUntil: "domcontentloaded" });
  await buyer.waitForLoadState("networkidle").catch(() => {});
  await buyer.waitForTimeout(4000);
  const buyerDevAfterReload = await readDeviceId(buyer);
  j.step3 = { buyer_device_id_after_reload: buyerDevAfterReload, idb_persisted_across_reload: buyerDevAfterReload === buyerDev1 };

  await buyer.locator("input[placeholder='Message…']").first().waitFor({ state: "visible", timeout: 15_000 });
  await buyer.waitForFunction(
    () => {
      const el = document.querySelector("input[placeholder='Message…']");
      return el && !el.disabled;
    },
    null,
    { timeout: 20_000 },
  ).catch(() => {});
  await buyer.locator("input[placeholder='Message…']").first().fill(BUYER_Q);
  await buyer.waitForTimeout(300);
  await buyer.locator("[data-nex-business-conv-send]").first().click();
  await buyer.waitForTimeout(4000);
  j.step3.marker_in_buyer_dom_after_send = (await buyer.content()).includes(BUYER_Q);
  await shot(buyer, "03-buyer-after-send");

  // STEP 4 · buyer reload → still can read own message
  await buyer.reload({ waitUntil: "domcontentloaded" });
  await buyer.waitForLoadState("networkidle").catch(() => {});
  await buyer.waitForTimeout(5000); // give initial decrypt loop time
  const buyerDev3 = await readDeviceId(buyer);
  const body4 = await buyer.content();
  j.step4 = {
    buyer_device_id_after_2nd_reload: buyerDev3,
    idb_persisted_across_2_reloads: buyerDev3 === buyerDev1,
    buyer_can_read_own_msg_after_reload: body4.includes(BUYER_Q),
    buyer_msg_rows_count: await buyer.locator("[data-nex-business-conv-row]").count(),
  };
  await shot(buyer, "04-buyer-reload-reads-own");

  // STEP 5 · seller reload → should read BUYER_Q, then reply
  await seller.reload({ waitUntil: "domcontentloaded" });
  await seller.waitForLoadState("networkidle").catch(() => {});
  await seller.waitForTimeout(5000);
  const sellerDev2 = await readDeviceId(seller);
  const body5 = await seller.content();
  j.step5 = {
    seller_device_id_after_reload: sellerDev2,
    seller_idb_persisted: sellerDev2 === sellerDev1,
    seller_can_read_buyer_q: body5.includes(BUYER_Q),
    seller_msg_rows_count: await seller.locator("[data-nex-business-conv-row]").count(),
  };
  await shot(seller, "05-seller-reads-buyerQ");

  if (j.step5.seller_can_read_buyer_q) {
    await seller.locator("input[placeholder='Message…']").first().waitFor({ state: "visible", timeout: 15_000 });
    await seller.locator("input[placeholder='Message…']").first().fill(SELLER_R);
    await seller.waitForTimeout(300);
    await seller.locator("[data-nex-business-conv-send]").first().click();
    await seller.waitForTimeout(4000);
    j.step5.seller_sent_reply = (await seller.content()).includes(SELLER_R);
    await shot(seller, "06-seller-sent-reply");
  } else {
    j.step5.seller_sent_reply = "skipped-cant-read";
  }

  // STEP 6 · buyer reload → should read seller reply
  await buyer.reload({ waitUntil: "domcontentloaded" });
  await buyer.waitForLoadState("networkidle").catch(() => {});
  await buyer.waitForTimeout(5000);
  const body6 = await buyer.content();
  j.step6 = {
    buyer_sees_buyer_q: body6.includes(BUYER_Q),
    buyer_sees_seller_r: body6.includes(SELLER_R),
    buyer_msg_rows_count: await buyer.locator("[data-nex-business-conv-row]").count(),
  };
  await shot(buyer, "07-buyer-reads-reply");
} catch (e) {
  j.main_error = String(e).slice(0, 400);
}

j.buyer_console = buyerConsole.slice(0, 8);
j.seller_console = sellerConsole.slice(0, 8);

await buyerCtx.close();
await sellerCtx.close();

try { rmSync(BUYER_UDD, { recursive: true, force: true }); } catch {}
try { rmSync(SELLER_UDD, { recursive: true, force: true }); } catch {}

await db.end();
writeFileSync(path.join(OUT, "journey-v5-result.json"), JSON.stringify(j, null, 2));
console.log(JSON.stringify(j, null, 2));
console.log("\n[done]");
