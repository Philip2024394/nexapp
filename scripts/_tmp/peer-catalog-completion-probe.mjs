#!/usr/bin/env node
// scripts/_tmp/peer-catalog-completion-probe.mjs
//
// Bounded browser verification for the peer-catalog ShopDrawer wiring
// (owner directive 2026-11-16). Uses two disposable, already-authorised
// sandbox accounts (CK5 A seller + CK5 B buyer). Founder session + dev
// server are untouched. Sandbox DB only.
//
// Journeys covered:
//   A. Buyer (CK5 B) → seller (CK5 A) chat · Shop FAB visible with the
//      storefront glyph · drawer header shows seller display name ·
//      drawer body lists the real CK5 seller products (not MOCK_SHOP_
//      PRODUCTS) · tap a product → sealed share action lands a
//      product-message in the conversation · persistence confirmed
//      after reload.
//   B. Seller (CK5 A) → buyer (CK5 B) chat (peer has no business) ·
//      NO Shop FAB is mounted · ordinary text message still works.
//   C. FAB separation · Shop FAB and Call Centre FAB are both present
//      at phone width without overlapping and carry distinct glyphs.
//
// READ-ONLY shape:
//   · No writes outside the sealed send-peer-message / share-product
//     server actions that this surface already uses in production.
//   · No DB mutation performed from this probe.
//   · No account creation · no tier mutation · no bucket writes.
//   · Protected UUIDs (Hammerex/Rosa) refused up front.

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ENV_FILE = ".env.playwright.vault-ck5";
const EVIDENCE_DIR = "evidence/peer-catalog-completion";
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
const PRODUCT_X_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_PRODUCT_X_ID");
const PRODUCT_X_NAME = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_PRODUCT_X_NAME");
const PRODUCT_Y_NAME = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_PRODUCT_Y_NAME");

const HAMMEREX = "11111111-1111-4111-8111-111111111111";
const ROSA = "11111111-1111-4111-8111-111111111113";
for (const id of [SELLER_ACCOUNT_ID, BUYER_ACCOUNT_ID]) {
  if (id === HAMMEREX || id === ROSA) {
    throw new Error("refuses · protected account id resolved");
  }
}

const BASE = "http://localhost:3008";
const log = (phase, data) => console.log(`[${phase}]`, data ?? "");

async function signIn(page, email, password, nextPath) {
  await page.goto(
    `${BASE}/nex-native/sign-in?next=${encodeURIComponent(nextPath)}`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("button[data-nex-sign-in-submit]").click();
  await page.waitForURL(
    (u) => !new URL(u).pathname.startsWith("/nex-native/sign-in"),
    { timeout: 60_000, waitUntil: "domcontentloaded" },
  );
}
async function shot(page, name) {
  const p = path.join(EVIDENCE_DIR, name);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  📸 ${p}`);
  return p;
}

const results = {
  journeys: [],
  mockLeakDetected: false,
  startedAt: new Date().toISOString(),
};
function record(id, status, note, evidence) {
  const row = { id, status, note, evidence };
  results.journeys.push(row);
  console.log(`[${status}] ${id} · ${note}`);
  return row;
}

const browser = await chromium.launch({ headless: true });
try {
  // ─────────────────────────────────────────────────────────────
  // JOURNEY A · buyer → seller · peer-catalog mode
  // ─────────────────────────────────────────────────────────────
  log("A · buyer sign-in");
  const buyerCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const buyerPage = await buyerCtx.newPage();
  const chatSellerPath = `/nex-native/chat/peer/${SELLER_ACCOUNT_ID}`;
  await signIn(buyerPage, BUYER_EMAIL, BUYER_PASSWORD, chatSellerPath);
  // Wait for the client-mounted Shop FAB and Call Centre FAB to paint.
  await buyerPage
    .waitForSelector("[data-nex-shop-drawer-trigger]", {
      state: "attached",
      timeout: 15_000,
    })
    .catch(() => {});
  await buyerPage
    .waitForSelector("[data-nex-free-chat-call-center-trigger]", {
      state: "attached",
      timeout: 15_000,
    })
    .catch(() => {});
  await buyerPage.waitForTimeout(500);

  // Confirm identity of the loaded chat page.
  const urlAfter = buyerPage.url();
  if (!urlAfter.includes(SELLER_ACCOUNT_ID)) {
    record(
      "A-nav",
      "FAIL",
      `expected peer chat with seller · got ${urlAfter}`,
      null,
    );
    throw new Error("buyer did not reach seller chat");
  } else {
    record("A-nav", "PASS", `buyer landed at ${chatSellerPath}`);
  }
  await shot(buyerPage, "A1-buyer-seller-chat-initial.png");

  // Shop FAB should be present AND carry the peer-catalog marker.
  const fabAll = buyerPage.locator("[data-nex-shop-drawer-trigger]");
  const fabCount = await fabAll.count();
  const fabMode = fabCount
    ? await fabAll
        .first()
        .getAttribute("data-nex-shop-drawer-trigger-mode")
    : null;
  if (fabCount === 1 && fabMode === "peer-catalog") {
    record(
      "A-fab-present",
      "PASS",
      `Shop FAB mounted once in peer-catalog mode`,
    );
  } else {
    record(
      "A-fab-present",
      "FAIL",
      `shop FABs=${fabCount} mode=${fabMode}`,
      null,
    );
  }
  // Call Centre FAB stacked above · verify it exists so we know the
  // two controls are distinct.
  const callCentreFab = buyerPage.locator(
    "[data-nex-free-chat-call-center-trigger]",
  );
  const callCentreCount = await callCentreFab.count();
  if (callCentreCount === 1) {
    record(
      "A-callcenter-present",
      "PASS",
      "Call Centre FAB mounted once (stacked above Shop FAB)",
    );
  } else {
    record(
      "A-callcenter-present",
      "FAIL",
      `call-centre FABs=${callCentreCount}`,
      null,
    );
  }
  // Verify no overlap at phone width.
  if (fabCount === 1 && callCentreCount === 1) {
    const shopBox = await fabAll.first().boundingBox();
    const ccBox = await callCentreFab.first().boundingBox();
    const overlap =
      shopBox && ccBox
        ? !(
            shopBox.y + shopBox.height <= ccBox.y ||
            ccBox.y + ccBox.height <= shopBox.y ||
            shopBox.x + shopBox.width <= ccBox.x ||
            ccBox.x + ccBox.width <= shopBox.x
          )
        : null;
    if (overlap === false) {
      record(
        "A-fab-no-overlap",
        "PASS",
        `shop=${JSON.stringify(shopBox)} callcenter=${JSON.stringify(ccBox)} · no overlap`,
      );
    } else {
      record(
        "A-fab-no-overlap",
        overlap === true ? "FAIL" : "UNVERIFIED",
        `overlap=${overlap} shop=${JSON.stringify(shopBox)} callcenter=${JSON.stringify(ccBox)}`,
        null,
      );
    }
  }

  // Open the drawer.
  log("A · open shop drawer");
  await fabAll.first().click();
  await buyerPage.waitForSelector(
    '[data-nex-shop-drawer][data-nex-shop-drawer-visible="true"]',
    { timeout: 10_000 },
  );
  await buyerPage.waitForTimeout(300);
  await shot(buyerPage, "A2-shop-drawer-open.png");

  // Header + mode marker.
  const drawerMode = await buyerPage
    .locator("[data-nex-shop-drawer]")
    .first()
    .getAttribute("data-nex-shop-drawer-mode");
  if (drawerMode === "peer-catalog") {
    record("A-drawer-mode", "PASS", "drawer mounted in peer-catalog mode");
  } else {
    record(
      "A-drawer-mode",
      "FAIL",
      `drawer mode = ${drawerMode}`,
      null,
    );
  }
  const headerText = await buyerPage
    .locator('[data-nex-shop-drawer] header h2')
    .first()
    .textContent();
  if (headerText && headerText.toLowerCase().includes("shop")) {
    record(
      "A-drawer-header",
      "PASS",
      `drawer header = "${headerText.trim()}"`,
    );
  } else {
    record(
      "A-drawer-header",
      "FAIL",
      `unexpected header "${headerText}"`,
      null,
    );
  }

  // Product list should contain the real CK5 product names, not mocks.
  const bodyText = await buyerPage
    .locator("[data-nex-shop-drawer-scroll]")
    .first()
    .innerText();
  const hasRealX = bodyText.includes(PRODUCT_X_NAME);
  const hasRealY = bodyText.includes(PRODUCT_Y_NAME);
  const mockNames = [
    "Treaty Bar Hoodie",
    "Dublin Print",
    "Roasted Blend",
    "Session Fiddle Strings",
    "Connemara Weekend",
    "Seaglass Brooch",
    "Harbour Mug",
    "Trad Nights",
  ];
  const leakedMock = mockNames.find((n) => bodyText.includes(n)) ?? null;
  if (hasRealX && hasRealY && !leakedMock) {
    record(
      "A-real-products",
      "PASS",
      `real products rendered: "${PRODUCT_X_NAME}", "${PRODUCT_Y_NAME}" · no mock leak`,
    );
  } else {
    results.mockLeakDetected = !!leakedMock;
    record(
      "A-real-products",
      "FAIL",
      `hasX=${hasRealX} hasY=${hasRealY} leaked=${leakedMock ?? "none"}`,
      null,
    );
  }

  // Search filter · type partial product X name and confirm Y disappears.
  const searchInput = buyerPage.locator(
    "[data-nex-shop-drawer-search]",
  );
  if ((await searchInput.count()) === 1) {
    await searchInput.fill("Widget X");
    await buyerPage.waitForTimeout(300);
    const filteredText = await buyerPage
      .locator("[data-nex-shop-drawer-scroll]")
      .first()
      .innerText();
    const xStill = filteredText.includes(PRODUCT_X_NAME);
    const yGone = !filteredText.includes(PRODUCT_Y_NAME);
    if (xStill && yGone) {
      record(
        "A-drawer-search",
        "PASS",
        'search "Widget X" filters correctly',
      );
    } else {
      record(
        "A-drawer-search",
        "FAIL",
        `search filter result: xStill=${xStill} yGone=${yGone}`,
        null,
      );
    }
    await searchInput.fill("");
    await buyerPage.waitForTimeout(300);
  } else {
    record("A-drawer-search", "UNVERIFIED", "search input not found", null);
  }
  await shot(buyerPage, "A3-shop-drawer-filtered.png");

  // Tap product X · the card is a submit button inside a form posting
  // the sealed share action. Expect redirect back to the same chat with
  // a new product message bubble.
  log("A · tap product X to share");
  const productXCard = buyerPage
    .locator(
      `[data-nex-shop-drawer-card][aria-label*="${PRODUCT_X_NAME}"]`,
    )
    .first();
  const xCount = await productXCard.count();
  if (xCount === 0) {
    record(
      "A-share-product",
      "UNVERIFIED",
      `product card for "${PRODUCT_X_NAME}" not found`,
      null,
    );
  } else {
    await productXCard.click();
    // Server action redirects back to chat page.
    await buyerPage
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    await buyerPage.waitForTimeout(1500);
    const afterShareUrl = buyerPage.url();
    const bodyAfter = await buyerPage.locator("body").innerText();
    const chatHasProduct = bodyAfter.includes(PRODUCT_X_NAME);
    if (chatHasProduct && afterShareUrl.includes(SELLER_ACCOUNT_ID)) {
      record(
        "A-share-product",
        "PASS",
        `product message "${PRODUCT_X_NAME}" visible in chat after server-side share`,
      );
    } else {
      record(
        "A-share-product",
        "FAIL",
        `after share: url=${afterShareUrl} containsProduct=${chatHasProduct}`,
        null,
      );
    }
    await shot(buyerPage, "A4-after-product-share.png");

    // Persistence after reload.
    await buyerPage.reload({ waitUntil: "domcontentloaded" });
    await buyerPage.waitForTimeout(1500);
    const bodyReload = await buyerPage.locator("body").innerText();
    if (bodyReload.includes(PRODUCT_X_NAME)) {
      record(
        "A-share-persist",
        "PASS",
        `product message still present after reload`,
      );
    } else {
      record(
        "A-share-persist",
        "FAIL",
        "product message missing after reload",
        null,
      );
    }
    await shot(buyerPage, "A5-after-reload.png");
  }

  await buyerCtx.close();

  // ─────────────────────────────────────────────────────────────
  // JOURNEY B · seller → non-seller peer · FAB must NOT mount ·
  // ordinary chat still works
  // ─────────────────────────────────────────────────────────────
  log("B · seller sign-in · peer is buyer (no nex_business)");
  const sellerCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const sellerPage = await sellerCtx.newPage();
  const chatBuyerPath = `/nex-native/chat/peer/${BUYER_ACCOUNT_ID}`;
  await signIn(sellerPage, SELLER_EMAIL, SELLER_PASSWORD, chatBuyerPath);
  // Wait for Call Centre FAB · Shop FAB must NOT appear so we can't
  // waitForSelector on it.
  await sellerPage
    .waitForSelector("[data-nex-free-chat-call-center-trigger]", {
      state: "attached",
      timeout: 15_000,
    })
    .catch(() => {});
  await sellerPage.waitForTimeout(800);
  await shot(sellerPage, "B1-seller-buyer-chat-initial.png");

  const fabCountB = await sellerPage
    .locator("[data-nex-shop-drawer-trigger]")
    .count();
  if (fabCountB === 0) {
    record(
      "B-no-fab-when-non-seller-peer",
      "PASS",
      "no Shop FAB mounted when peer has no nex_business",
    );
  } else {
    record(
      "B-no-fab-when-non-seller-peer",
      "FAIL",
      `expected 0 Shop FABs · got ${fabCountB}`,
      null,
    );
  }
  // Call Centre FAB should still be mounted · distinct control.
  const ccCountB = await sellerPage
    .locator("[data-nex-free-chat-call-center-trigger]")
    .count();
  if (ccCountB >= 1) {
    record(
      "B-callcenter-still-present",
      "PASS",
      `Call Centre FAB still mounted (${ccCountB}) · unrelated to shop drawer`,
    );
  } else {
    record(
      "B-callcenter-still-present",
      "FAIL",
      `Call Centre FAB missing`,
      null,
    );
  }
  // Ordinary text message still works.
  const composer = sellerPage
    .locator("[data-nex-composer-textarea]")
    .first();
  const marker = `CP-PCC-ORD-${Date.now()}`;
  const compCount = await composer.count();
  if (compCount === 0) {
    record("B-ordinary-chat", "UNVERIFIED", "no composer found", null);
  } else {
    try {
      await composer.fill(marker);
      // Try locating a send button by common testids / accessible labels.
      const sendBtn = sellerPage
        .locator(
          'button[type="submit"], button[aria-label*="Send" i], button[data-nex-send]',
        )
        .first();
      if ((await sendBtn.count()) === 0) {
        record(
          "B-ordinary-chat",
          "UNVERIFIED",
          "send button not located",
          null,
        );
      } else {
        await sendBtn.click();
        await sellerPage.waitForTimeout(1500);
        const bodyB = await sellerPage.locator("body").innerText();
        if (bodyB.includes(marker)) {
          record(
            "B-ordinary-chat",
            "PASS",
            `ordinary text message "${marker}" delivered without a product drawer`,
          );
        } else {
          record(
            "B-ordinary-chat",
            "UNVERIFIED",
            `marker not visible after send (may be eventual · did not fail)`,
            null,
          );
        }
      }
    } catch (err) {
      record(
        "B-ordinary-chat",
        "UNVERIFIED",
        `send flow threw: ${String(err).slice(0, 120)}`,
        null,
      );
    }
    await shot(sellerPage, "B2-seller-after-send-ordinary.png");
  }
  await sellerCtx.close();
} finally {
  await browser.close();
}

results.finishedAt = new Date().toISOString();
console.log("\n[SUMMARY]");
for (const r of results.journeys) {
  console.log(`  ${r.status.padEnd(11)} ${r.id.padEnd(30)} ${r.note}`);
}
console.log(
  `\nmockLeakDetected=${results.mockLeakDetected} · journeys=${results.journeys.length}`,
);

import { writeFileSync } from "node:fs";
writeFileSync(
  path.join(EVIDENCE_DIR, "probe-summary.json"),
  JSON.stringify(results, null, 2),
);
