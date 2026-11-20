#!/usr/bin/env node
// scripts/_tmp/cp4-fix-screenshot.mjs
//
// CP4-fix · Step B visual evidence capture.
// Disposable identities only (CK5 A seller · CK5 B buyer).
// NEVER signs into or mutates Hammerex / Rosa.
// Writes screenshots to evidence/master-flow/CP4-fix/.

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";

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

const SELLER_EMAIL = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_EMAIL");
const SELLER_PASSWORD = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_PASSWORD");
const BUYER_EMAIL = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_B_EMAIL");
const BUYER_PASSWORD = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_B_PASSWORD");
const BUSINESS_SLUG = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_BUSINESS_SLUG");
const SELLER_ACCOUNT_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const PRODUCT_X_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_PRODUCT_X_ID");
const PRODUCT_X_NAME = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_PRODUCT_X_NAME");

// Protected-account guard: refuse if CK5 resolves to Hammerex or Rosa.
const HAMMEREX = "11111111-1111-4111-8111-111111111111";
const ROSA = "11111111-1111-4111-8111-111111111113";
if ([SELLER_ACCOUNT_ID].includes(HAMMEREX) || [SELLER_ACCOUNT_ID].includes(ROSA)) {
  throw new Error("refuses · CK5 fixtures resolved to a protected account id");
}

const BASE = "http://localhost:3008";

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

try {
  // ── Seller context · just visit /manage/orders to prove list surface.
  console.log("\n[1/4] seller context · /manage/orders list");
  const sellerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const sellerPage = await sellerCtx.newPage();
  await signIn(sellerPage, SELLER_EMAIL, SELLER_PASSWORD, "/nex-native/manage/orders");
  await sellerPage.waitForTimeout(1500);
  await shot(sellerPage, "step-B-01-seller-manage-orders-list.png");

  // Pick first visible order row (if any) and open it.
  const firstRow = sellerPage.locator('a[data-nex-order-row]').first();
  const rowCount = await sellerPage.locator('a[data-nex-order-row]').count();
  console.log(`  seller sees ${rowCount} order row(s) on list`);

  if (rowCount > 0) {
    console.log("\n[2/4] seller · open order detail for first row");
    const href = await firstRow.getAttribute("href");
    console.log(`  opening ${href}`);
    await firstRow.click();
    await sellerPage.waitForLoadState("domcontentloaded");
    await sellerPage.waitForTimeout(1500);
    await shot(sellerPage, "step-B-02-seller-order-detail.png");

    console.log("\n[3/4] seller · reload detail · persistence");
    await sellerPage.reload({ waitUntil: "domcontentloaded" });
    await sellerPage.waitForTimeout(1500);
    await shot(sellerPage, "step-B-03-seller-order-detail-reloaded.png");
  } else {
    console.log("  (no orders on list; captures still save as baseline)");
  }
  await sellerCtx.close();

  // ── Buyer context · attempt to access seller /manage/orders (denial expected).
  console.log("\n[4/4] buyer context · denial check on /manage/orders");
  const buyerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const buyerPage = await buyerCtx.newPage();
  await signIn(buyerPage, BUYER_EMAIL, BUYER_PASSWORD, "/nex-native/manage/orders");
  await buyerPage.waitForTimeout(1500);
  const buyerUrl = buyerPage.url();
  console.log(`  buyer at ${buyerUrl}`);
  // A buyer landing on /manage/orders sees "no shop found" placeholder (not seller's orders).
  await shot(buyerPage, "step-B-04-buyer-denied-at-manage-orders.png");
  await buyerCtx.close();

  console.log("\n✅ screenshots saved to", EVIDENCE_DIR);
} finally {
  await browser.close();
}
