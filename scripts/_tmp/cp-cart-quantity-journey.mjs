// scripts/_tmp/cp-cart-quantity-journey.mjs
//
// R4 cart-quantity journey · 2026-11-17
// -----------------------------------------------------------------
// Closes the cart gap from R4: increase, decrease, remove line while
// retaining another, last-item removal / empty state, badge + totals
// after each change, reload persistence. Uses the pre-authorised CK5
// disposable buyer identity. Sandbox only. No commits, no production.
//
// Tests the RENDERED cart UI · clicks visible buttons, reads visible
// text and localStorage. Does NOT inject cart state.
//
// Requires two real sandbox products on different shops · we take the
// first two that the directory lists, picking distinct business_ids so
// the "one shop · one checkout" rule exposes multi-line within a single
// shop by adding the same product twice (which exercises the +/− path
// on a single line) · then we also add a second product on the SAME
// shop if available to exercise remove-one-keep-another.

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ""), "..", "..");
const EV_DIR = path.join(ROOT, "evidence", "product-chat-cart-checkpoint");

const BASE = "http://localhost:3008";

const PROTECTED = /hammerex|rosa|99901|99903/i;
function assertNotProtected(label, value) {
  if (!value) return;
  if (PROTECTED.test(String(value))) {
    throw new Error(`[protected-identity-guard] refused · ${label}=${value}`);
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("missing supabase env · run with NEXT_PUBLIC_NEX_SUPABASE_URL + NEX_SUPABASE_SERVICE_ROLE_KEY set");
  process.exit(2);
}
if (!SUPABASE_URL.includes("kdstoyyeygcopkogqsyv")) {
  console.error("refused · not pointing at sandbox");
  process.exit(3);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const STORAGE_STATE = path.join(EV_DIR, "ck5-buyer-storage-state.json");
if (!fs.existsSync(STORAGE_STATE)) {
  console.error("missing buyer storage state · run cp-ck5-signin-probe.mjs first");
  process.exit(4);
}

async function shot(page, name) {
  try {
    await page.screenshot({
      path: path.join(EV_DIR, `r4-qty-${name}.png`),
      fullPage: false,
      timeout: 5000,
    });
  } catch (e) {
    console.log(`  [screenshot-skip] ${name} · ${e.message}`);
  }
}

async function readCartLocalStorage(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("nex.cart.v1");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  });
}

async function readBadgeCount(page) {
  // CartHeaderButton badge · data-nex-cart-header-button-badge
  const el = page.locator("[data-nex-cart-header-button-badge]").first();
  if (await el.count() === 0) return null;
  const t = (await el.textContent()) ?? "";
  return t.trim();
}

async function pickTwoCandidateProducts() {
  // Deterministic: oldest 2 products that belong to CK5 shops (exact
  // shop names published by earlier probes include "mwhyjc0c").
  const { data, error } = await sb
    .from("nex_product")
    .select("id, name, business_id, price_pence, currency, nex_business(display_name)")
    .ilike("nex_business.display_name", "E2E CK5 Seller Shop%")
    .limit(5);
  if (error) throw error;
  const rows = (data ?? []).filter((r) =>
    !PROTECTED.test(r.name ?? "") && !PROTECTED.test(r.nex_business?.display_name ?? ""),
  );
  if (rows.length === 0) throw new Error("no CK5 products available");
  return rows;
}

async function main() {
  const ctx = await chromium.launchPersistentContext(
    path.join(EV_DIR, ".qty-journey-profile"),
    {
      headless: true,
      viewport: { width: 390, height: 780 },
      storageState: STORAGE_STATE,
    },
  ).catch(async () => {
    const browser = await chromium.launch({ headless: true });
    return browser.newContext({
      viewport: { width: 390, height: 780 },
      storageState: STORAGE_STATE,
    });
  });
  const page = await ctx.newPage();

  const result = {
    when: new Date().toISOString(),
    picked: null,
    steps: {},
  };

  // STEP 0 · pick 2 products on the same shop.
  console.log("STEP 0 · pick products from sandbox");
  const candidates = await pickTwoCandidateProducts();
  const shopGroups = new Map();
  for (const c of candidates) {
    const key = c.business_id;
    if (!shopGroups.has(key)) shopGroups.set(key, []);
    shopGroups.get(key).push(c);
  }
  // Prefer a shop with 2+ products · fall back to adding the same
  // product twice.
  let p1 = null, p2 = null;
  for (const [, list] of shopGroups.entries()) {
    if (list.length >= 2) { p1 = list[0]; p2 = list[1]; break; }
  }
  if (!p1) { p1 = candidates[0]; p2 = candidates[0]; }
  assertNotProtected("p1", p1.name);
  assertNotProtected("p2", p2.name);
  result.picked = { p1: { id: p1.id, name: p1.name }, p2: { id: p2.id, name: p2.name } };
  console.log(`  picked p1=${p1.id} p2=${p2.id} (same=${p1.id === p2.id})`);

  // STEP 1 · add p1, verify badge + totals.
  console.log("STEP 1 · add p1 via rendered button");
  await page.goto(`${BASE}/nex-native/product/${p1.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  await page.locator('[data-nex-add-to-cart-button], button:has-text("Add to Cart"), button:has-text("Add to cart")').first().click();
  await page.waitForTimeout(400);
  result.steps.step_1 = {
    cart_after_add_1: await readCartLocalStorage(page),
    badge_after_add_1: await readBadgeCount(page),
  };
  await shot(page, "01-after-add-p1");

  // STEP 2 · open cart popup and click + to increase qty
  console.log("STEP 2 · increase qty via popup +");
  await page.locator('[data-nex-cart-header-button]').first().click();
  await page.waitForTimeout(400);
  await page.locator('[aria-label="Increase quantity"]').first().click();
  await page.waitForTimeout(200);
  await page.locator('[aria-label="Increase quantity"]').first().click();
  await page.waitForTimeout(300);
  result.steps.step_2 = {
    cart_after_increase: await readCartLocalStorage(page),
    badge_after_increase: await readBadgeCount(page),
    subtotal_text: await page.locator('[data-nex-cart-popup-subtotal]').first().textContent().catch(() => null),
  };
  await shot(page, "02-after-increase");

  // STEP 3 · click − to decrease back by one
  console.log("STEP 3 · decrease qty via popup −");
  await page.locator('[aria-label="Decrease quantity"]').first().click();
  await page.waitForTimeout(300);
  result.steps.step_3 = {
    cart_after_decrease: await readCartLocalStorage(page),
    badge_after_decrease: await readBadgeCount(page),
  };
  await shot(page, "03-after-decrease");

  // STEP 4 · navigate to /cart page · verify persistence + subtotal
  console.log("STEP 4 · full cart page · verify subtotal persists");
  await page.keyboard.press("Escape").catch(() => {});
  await page.goto(`${BASE}/nex-native/cart`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const bodySample = (await page.locator("body").textContent()) ?? "";
  result.steps.step_4 = {
    cart_on_cart_page: await readCartLocalStorage(page),
    body_includes_subtotal_word: /subtotal/i.test(bodySample),
    body_includes_checkout: /checkout/i.test(bodySample),
  };
  await shot(page, "04-cart-page");

  // STEP 5 · add second product if available (different id) · else re-add same
  console.log("STEP 5 · add p2 to cart from its product page");
  if (p2.id !== p1.id) {
    await page.goto(`${BASE}/nex-native/product/${p2.id}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    await page.locator('[data-nex-add-to-cart-button], button:has-text("Add to Cart"), button:has-text("Add to cart")').first().click();
    await page.waitForTimeout(400);
  }
  result.steps.step_5 = {
    cart_after_add_p2: await readCartLocalStorage(page),
  };
  await shot(page, "05-after-add-p2");

  // STEP 6 · remove one line while retaining the other (if two present)
  console.log("STEP 6 · remove one line");
  await page.goto(`${BASE}/nex-native/cart`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const removeButtons = page.locator('[aria-label^="Remove "]');
  const removeCount = await removeButtons.count();
  if (removeCount >= 2) {
    await removeButtons.first().click();
    await page.waitForTimeout(400);
  } else if (removeCount === 1) {
    // With a single-line cart we just capture the state · last-item
    // removal is step 7.
  }
  result.steps.step_6 = {
    remove_buttons_seen: removeCount,
    cart_after_remove_one: await readCartLocalStorage(page),
  };
  await shot(page, "06-after-remove-one");

  // STEP 7 · remove the last item · verify empty state
  console.log("STEP 7 · remove last item · empty state");
  const stillRemovable = page.locator('[aria-label^="Remove "]');
  const stillCount = await stillRemovable.count();
  if (stillCount > 0) {
    for (let i = stillCount - 1; i >= 0; i -= 1) {
      await stillRemovable.nth(i).click();
      await page.waitForTimeout(300);
    }
  }
  await page.waitForTimeout(400);
  const emptyBody = (await page.locator("body").textContent()) ?? "";
  result.steps.step_7 = {
    cart_after_remove_all: await readCartLocalStorage(page),
    body_includes_empty_copy: /your cart is empty/i.test(emptyBody),
    badge_after_empty: await readBadgeCount(page),
  };
  await shot(page, "07-after-remove-all");

  // STEP 8 · reload · empty state must persist
  console.log("STEP 8 · reload · empty persistence");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const afterReloadBody = (await page.locator("body").textContent()) ?? "";
  result.steps.step_8 = {
    cart_after_reload: await readCartLocalStorage(page),
    body_includes_empty_copy_after_reload: /your cart is empty/i.test(afterReloadBody),
  };
  await shot(page, "08-after-reload-empty");

  // Print + save manifest.
  const outPath = path.join(EV_DIR, "cart-quantity-journey-result.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log("\nDONE");
  console.log(JSON.stringify(result, null, 2));
  await ctx.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
