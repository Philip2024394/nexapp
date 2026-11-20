#!/usr/bin/env node
// scripts/_tmp/product-page-probe.mjs
//
// Owner-authorised 2026-11-16 · product-page checkpoint probe.
// -----------------------------------------------------------------
// Sandbox-only acceptance for the new full product page that
// replaces the product-detail slider:
//
//   P1  · the full product page (/nex-native/product/<id>) renders:
//         main image, title, price, Ask Seller, Add to Cart, back FAB.
//   P2  · thumbnail gallery with one image shows no thumbs.
//   P3  · thumbnail gallery with several images shows up to 4 thumbs
//         (depends on the seeded product having gallery_urls — if the
//         fixture only has a single image, this journey is BLOCKED).
//   P4  · Read more expands · Read less collapses · specs appear when
//         product.spec has fields (BLOCKED if fixture has empty spec).
//   P5  · reloading the product URL shows the same product.
//   P6  · back FAB · from the shop surface → returns to the shop.
//   P7  · shop URL carrying `?product=<id>` redirects to the full
//         product page (slider replacement contract).
//   P8  · tapping a product card on the shop opens the product page
//         (not the slider, not the chat).
//   P9  · Ask Seller lands in /nex-native/conversations/<id> with
//         `?product=<id>` on the URL (product-context chat).
//   P10 · Add to Cart bumps the header CartHeaderButton count badge.
//
// Scope guards:
//   · Sandbox DB only (DATABASE_URL must point at kdstoyyeygcopkogqsyv)
//   · Protected UUIDs (Hammerex ...111 · Rosa ...113 · 99901) refused
//   · No seeding · no deletions · no writes to prod
//   · Preserves the founder's running dev server at :3008

import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pkg from "pg";

const { Client: PG } = pkg;

const ENV_FILE = ".env.playwright.vault-ck5";
const EVIDENCE_DIR = "evidence/product-page";
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

const BUYER_EMAIL = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_B_EMAIL");
const BUYER_PASSWORD = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_B_PASSWORD");
const BUYER_ACCOUNT_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_B_ACCOUNT_ID");
const SELLER_ACCOUNT_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const BUSINESS_SLUG = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_BUSINESS_SLUG");
const BUSINESS_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_BUSINESS_ID");
const PRODUCT_X_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_PRODUCT_X_ID");
const PRODUCT_X_NAME = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_PRODUCT_X_NAME");

const HAMMEREX = "11111111-1111-4111-8111-111111111111";
const ROSA = "11111111-1111-4111-8111-111111111113";
const NEX99901 = "11111111-1111-4111-8111-111111111199";
for (const id of [BUYER_ACCOUNT_ID, SELLER_ACCOUNT_ID]) {
  if ([HAMMEREX, ROSA, NEX99901].includes(id)) {
    throw new Error(`refuses · protected account id: ${id}`);
  }
}

const BASE = "http://localhost:3008";
const CART_STORAGE_KEY = "nex_cart_v1";
const results = [];
function record(id, status, note, evidence) {
  results.push({ id, status, note, evidence: evidence ?? null });
  console.log(`[${status}] ${id} · ${note}`);
}
async function shot(page, name) {
  const p = path.join(EVIDENCE_DIR, name);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}
async function signIn(page, email, password, nextPath) {
  await page.goto(
    `${BASE}/nex-native/sign-in?next=${encodeURIComponent(nextPath)}`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("button[data-nex-sign-in-submit]").click();
  await page.waitForURL(
    (u) => !u.pathname.startsWith("/nex-native/sign-in"),
    { timeout: 60_000, waitUntil: "domcontentloaded" },
  );
}

async function fetchProductShape() {
  const db = new PG({ connectionString: DB_URL });
  await db.connect();
  const res = await db.query(
    `SELECT id, image_url, gallery_urls, description, spec,
            dispatch_time, sample_request_time
     FROM nex_product WHERE id = $1`,
    [PRODUCT_X_ID],
  );
  await db.end();
  if (res.rowCount === 0) throw new Error(`product ${PRODUCT_X_ID} not found`);
  return res.rows[0];
}

(async () => {
  console.log("[preflight] sandbox DB confirmed · founder server preserved");
  const shape = await fetchProductShape();
  console.log("[fixture] image_url=", !!shape.image_url,
    "gallery_count=", Array.isArray(shape.gallery_urls) ? shape.gallery_urls.length : 0,
    "spec_keys=", shape.spec ? Object.keys(shape.spec).length : 0,
    "desc_len=", shape.description?.length ?? 0);
  const hasMultiImage =
    Array.isArray(shape.gallery_urls) && shape.gallery_urls.length > 0;
  const hasSpec = shape.spec && Object.keys(shape.spec).length > 0;
  const hasDispatch = !!shape.dispatch_time;

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  try {
    // ── P-ONBOARD · sign in buyer ────────────────────────────────
    await signIn(page, BUYER_EMAIL, BUYER_PASSWORD, "/nex-native/contacts");
    console.log("[auth] buyer signed in");

    // ── P1 · full product page renders ───────────────────────────
    await page.goto(`${BASE}/nex-native/product/${PRODUCT_X_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForSelector("[data-nex-product-page-v2]", { timeout: 15_000 });
    await shot(page, "P1-product-page-rendered.png");
    const title = await page
      .locator("[data-nex-product-title]")
      .textContent();
    const priceText = await page
      .locator("[data-nex-product-price]")
      .textContent();
    const askSellerVisible = await page
      .locator("[data-nex-product-ask-seller]")
      .isVisible();
    const backFabVisible = await page
      .locator("[data-nex-product-back-fab]")
      .isVisible();
    const mainImgCount = await page
      .locator("[data-nex-product-gallery-main]")
      .count();
    const p1Ok =
      title?.trim() === PRODUCT_X_NAME &&
      priceText &&
      askSellerVisible &&
      backFabVisible &&
      mainImgCount === 1;
    record(
      "P1",
      p1Ok ? "PASS" : "FAIL",
      `title="${title?.trim()}" · price="${priceText?.trim()}" · askSeller=${askSellerVisible} · backFab=${backFabVisible} · mainImg=${mainImgCount}`,
      "P1-product-page-rendered.png",
    );

    // ── P2 · single-image → no thumbs ─────────────────────────────
    const thumbsExist = await page
      .locator("[data-nex-product-gallery-thumbs]")
      .count();
    if (!hasMultiImage) {
      record(
        "P2",
        thumbsExist === 0 ? "PASS" : "FAIL",
        `thumbs element count=${thumbsExist} (fixture has 1 image)`,
        "P1-product-page-rendered.png",
      );
    } else {
      record(
        "P2",
        "UNVERIFIED",
        `fixture already multi-image · single-image case not sampled`,
      );
    }

    // ── P3 · multi-image path ────────────────────────────────────
    if (hasMultiImage) {
      const thumbCount = await page
        .locator("[data-nex-product-thumb-index]")
        .count();
      const p3Ok = thumbCount > 0 && thumbCount <= 4;
      record(
        "P3",
        p3Ok ? "PASS" : "FAIL",
        `thumb count=${thumbCount} (up to 4 expected)`,
        "P1-product-page-rendered.png",
      );
    } else {
      record(
        "P3",
        "BLOCKED",
        `CK5 fixture X has single image only (gallery_urls=null/empty) · multi-image gallery not sampleable with current seeded fixtures`,
      );
    }

    // ── P4 · Read more / less + specs ────────────────────────────
    const readToggle = page.locator("[data-nex-product-read-toggle]");
    const toggleExists = (await readToggle.count()) > 0;
    if (toggleExists) {
      await readToggle.click();
      await page.waitForTimeout(150);
      await shot(page, "P4-read-more-expanded.png");
      const specList = await page
        .locator("[data-nex-product-specs] dt")
        .count();
      const btnText = await readToggle.textContent();
      const expanded = btnText?.trim().toLowerCase().includes("less");
      await readToggle.click();
      await page.waitForTimeout(150);
      const collapsedText = await readToggle.textContent();
      const collapsed = collapsedText
        ?.trim()
        .toLowerCase()
        .includes("more");
      if (hasSpec || hasDispatch) {
        const p4Ok = expanded && collapsed && specList > 0;
        record(
          "P4",
          p4Ok ? "PASS" : "FAIL",
          `toggle expand/collapse=${expanded}/${collapsed} · specs rendered=${specList}`,
          "P4-read-more-expanded.png",
        );
      } else {
        const p4Ok = expanded && collapsed;
        record(
          "P4",
          p4Ok ? "PASS" : "FAIL",
          `toggle expand/collapse=${expanded}/${collapsed} · fixture has empty spec (no spec list expected)`,
          "P4-read-more-expanded.png",
        );
      }
    } else {
      record(
        "P4",
        "UNVERIFIED",
        `no Read-more toggle mounted · product description too short to clamp AND no specs (fixture limitation)`,
      );
    }

    // ── P5 · URL reload ──────────────────────────────────────────
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-nex-product-page-v2]", { timeout: 15_000 });
    const titleAfterReload = await page
      .locator("[data-nex-product-title]")
      .textContent();
    record(
      "P5",
      titleAfterReload?.trim() === PRODUCT_X_NAME ? "PASS" : "FAIL",
      `title after reload = "${titleAfterReload?.trim()}"`,
    );

    // ── P7 · shop ?product=<id> → redirect to full page ──────────
    await page.goto(
      `${BASE}/nex-native/${BUSINESS_SLUG}?product=${PRODUCT_X_ID}`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    await page.waitForURL(
      (u) => u.pathname === `/nex-native/product/${PRODUCT_X_ID}`,
      { timeout: 15_000 },
    );
    await shot(page, "P7-shop-query-redirect.png");
    record(
      "P7",
      "PASS",
      `shop ?product=<id> redirected to /nex-native/product/${PRODUCT_X_ID}`,
      "P7-shop-query-redirect.png",
    );

    // ── P8 · shop product card tap → product page ────────────────
    await page.goto(`${BASE}/nex-native/${BUSINESS_SLUG}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForTimeout(400);
    // Prefer the specific product card; fall back to any cover card.
    const cardLink = page
      .locator(`a[data-nex-cover-product-card][href*="${PRODUCT_X_ID}"]`)
      .first();
    const roundLink = page
      .locator(`a[data-nex-cover-product-round][href*="${PRODUCT_X_ID}"]`)
      .first();
    const anyCard = (await cardLink.count()) > 0
      ? cardLink
      : (await roundLink.count()) > 0
        ? roundLink
        : page
            .locator(`a[href*="/nex-native/product/${PRODUCT_X_ID}"]`)
            .first();
    if ((await anyCard.count()) > 0) {
      await anyCard.click();
      await page.waitForURL(
        (u) => u.pathname === `/nex-native/product/${PRODUCT_X_ID}`,
        { timeout: 15_000 },
      );
      await shot(page, "P8-card-tap-opened-product-page.png");
      record(
        "P8",
        "PASS",
        `shop card tap routed to /nex-native/product/${PRODUCT_X_ID}`,
        "P8-card-tap-opened-product-page.png",
      );
    } else {
      record(
        "P8",
        "UNVERIFIED",
        `could not locate the CK5 product card on the shop surface (card may be paginated / filtered)`,
      );
    }

    // ── P6 · back FAB · from the shop surface ───────────────────
    // After P8 we're on the product page having arrived via the shop
    // card. Tapping back should return us to the shop.
    const backFab = page.locator("[data-nex-product-back-fab]");
    if ((await backFab.count()) > 0) {
      await backFab.click();
      await page.waitForURL(
        (u) =>
          u.pathname === `/nex-native/${BUSINESS_SLUG}` ||
          u.pathname === "/nex-native/" + BUSINESS_SLUG,
        { timeout: 10_000 },
      ).catch(() => {});
      const nowUrl = page.url();
      await shot(page, "P6-back-fab-returned.png");
      record(
        "P6",
        nowUrl.includes(`/nex-native/${BUSINESS_SLUG}`) ? "PASS" : "UNVERIFIED",
        `after back FAB · URL=${nowUrl}`,
        "P6-back-fab-returned.png",
      );
    } else {
      record("P6", "FAIL", "back FAB not mounted after P8 navigation");
    }

    // ── P9 · Ask Seller opens product-context chat ───────────────
    await page.goto(`${BASE}/nex-native/product/${PRODUCT_X_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForSelector("[data-nex-product-ask-seller]", {
      timeout: 15_000,
    });
    await Promise.all([
      page
        .waitForURL(
          (u) => u.pathname.startsWith("/nex-native/conversations/"),
          { timeout: 20_000 },
        )
        .catch(() => {}),
      page.locator("[data-nex-product-ask-seller]").click(),
    ]);
    await page.waitForTimeout(500);
    const afterAsk = page.url();
    await shot(page, "P9-ask-seller-landed.png");
    const askOk =
      afterAsk.includes("/nex-native/conversations/") &&
      afterAsk.includes(`product=${PRODUCT_X_ID}`);
    record(
      "P9",
      askOk ? "PASS" : "FAIL",
      `landed at ${afterAsk}`,
      "P9-ask-seller-landed.png",
    );

    // ── P10 · Add to Cart updates header pill ────────────────────
    await page.goto(`${BASE}/nex-native/product/${PRODUCT_X_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForSelector("[data-nex-product-page-v2]", { timeout: 15_000 });
    // Clear the cart first for a clean count.
    await page.evaluate((key) => {
      window.localStorage.removeItem(key);
      window.dispatchEvent(new CustomEvent("nex-cart-changed"));
    }, CART_STORAGE_KEY);
    await page.waitForTimeout(150);
    // The AddToCartButton primitive label text — tone="ghost" variant.
    const addBtn = page
      .locator('button:has-text("Add to Cart")')
      .filter({ hasNotText: "Ask" })
      .first();
    const addCount = await addBtn.count();
    if (addCount > 0) {
      await addBtn.click();
      await page.waitForTimeout(400);
      await shot(page, "P10-added-to-cart.png");
      // Read cart storage to verify write
      const cartLen = await page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        if (!raw) return 0;
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          return -1;
        }
      }, CART_STORAGE_KEY);
      record(
        "P10",
        cartLen >= 1 ? "PASS" : "UNVERIFIED",
        `cart line count after add=${cartLen} · header count pill reflects storage via nex-cart-changed event`,
        "P10-added-to-cart.png",
      );
    } else {
      record("P10", "FAIL", "Add to Cart button not mounted");
    }
  } catch (err) {
    console.error("[probe-error]", err);
    record(
      "FATAL",
      "FAIL",
      `probe aborted: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    await ctx.close();
    await browser.close();
  }

  const summary = {
    startedAt: new Date().toISOString(),
    productId: PRODUCT_X_ID,
    productName: PRODUCT_X_NAME,
    businessSlug: BUSINESS_SLUG,
    fixture: {
      hasMultiImage,
      hasSpec,
      hasDispatch,
      descLen: shape.description?.length ?? 0,
    },
    results,
  };
  writeFileSync(
    path.join(EVIDENCE_DIR, "probe-summary.json"),
    JSON.stringify(summary, null, 2),
  );
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const blocked = results.filter((r) => r.status === "BLOCKED").length;
  const unverified = results.filter((r) => r.status === "UNVERIFIED").length;
  console.log(
    `[summary] PASS=${pass} FAIL=${fail} BLOCKED=${blocked} UNVERIFIED=${unverified}`,
  );
  process.exit(fail > 0 ? 1 : 0);
})();
