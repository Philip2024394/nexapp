// tests/e2e-p6-isolation/cart-order-deterministic.spec.ts
//
// #14 REAL ACTIVATION · sealed 2026-11-16.
// -----------------------------------------------------------------
// The GAP14-DETER test in order-visibility.spec.ts proves the
// deterministic-link CONTRACT with fixture-inserted nex_order rows
// (disclosed in that file's header). This spec proves the PRODUCTION
// CODE PATH end-to-end:
//
//   · The real `sendCartOrderAction` (not a fixture insert) now
//     creates the `nex_order` row with id = `attachment_meta.cart.
//     order_id` via `orderService.createOrder({ id, product_id })`.
//   · Two IDENTICAL carts (same item, same qty, same subtotal, same
//     address) submitted back-to-back by the SAME buyer produce TWO
//     distinct nex_order rows whose IDs match their respective cart
//     messages' embedded order_id UUIDs.
//   · The seller's /manage/orders/<id> page resolves each 1:1 via
//     Tier 0 (`data-nex-order-cart-match-tier="deterministic_order_id"`)
//     and renders ITS OWN cart items. Distinguishing payload: the
//     buyer types a different note per checkout.
//
// Honest safety fence
// -----------------------------------------------------------------
//   · Sandbox DB only (kdstoyyeygcopkogqsyv). Prod ref refused.
//   · CK5 disposable accounts only. Hammerex/Rosa refused.
//   · Real cart UI → real checkout sheet → real
//     `sendCartOrderAction` → real `createOrder`. No DB INSERT by
//     the test for nex_order (verified by querying `created_at` >=
//     the test start-time cutoff and comparing to the UUIDs the
//     cart messages embed).
//   · Cleanup is prefix-scoped on nex_product.name and
//     time-and-buyer-scoped on nex_peer_message / nex_order.
//
// Honest limits
// -----------------------------------------------------------------
//   · The price_pence snapshot on nex_order comes from the real
//     product record (per createOrder semantics). Our cart has one
//     line item at that price so the list-row price is correct for
//     this fixture. For multi-item or variant-adjusted carts the
//     list shows the first-item price while the detail page renders
//     the full items from attachment_meta.cart; that's documented
//     in _actions.ts and unaffected by this test.

import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import pkg from "pg";
const { Client: PG } = pkg;

function fromEnvLocal(name: string): string {
  try {
    const m = readFileSync(".env.local", "utf8").match(
      new RegExp(`^${name}=(.*)$`, "m"),
    );
    return m ? m[1].trim() : "";
  } catch { return ""; }
}
function fromEnvFile(path: string, name: string): string {
  try {
    const m = readFileSync(path, "utf8").match(
      new RegExp(`^${name}=['"]?([^'"\\n]*)['"]?$`, "m"),
    );
    return m ? m[1].trim() : "";
  } catch { return ""; }
}

const DB_URL = fromEnvLocal("DATABASE_URL");
const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
if (DB_URL.includes(PROD_REF)) {
  throw new Error("cart-order-deterministic refuses · production ref");
}
if (!DB_URL.includes(SANDBOX_REF)) {
  throw new Error(`cart-order-deterministic refuses · not sandbox ${SANDBOX_REF}`);
}

const CK5 = ".env.playwright.vault-ck5";
const SELLER_EMAIL = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_EMAIL");
const SELLER_PASSWORD = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_PASSWORD");
const SELLER_ACCOUNT_ID = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const SELLER_BUSINESS_ID = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_BUSINESS_ID");
const SELLER_BUSINESS_SLUG = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_BUSINESS_SLUG");
const SELLER_BUSINESS_NAME = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_BUSINESS_NAME");
const BUYER_EMAIL = fromEnvFile(CK5, "PLAYWRIGHT_CK5_B_EMAIL");
const BUYER_PASSWORD = fromEnvFile(CK5, "PLAYWRIGHT_CK5_B_PASSWORD");
const BUYER_ACCOUNT_ID = fromEnvFile(CK5, "PLAYWRIGHT_CK5_B_ACCOUNT_ID");

for (const [k, v] of Object.entries({
  SELLER_EMAIL, SELLER_PASSWORD, SELLER_ACCOUNT_ID, SELLER_BUSINESS_ID,
  SELLER_BUSINESS_SLUG, SELLER_BUSINESS_NAME,
  BUYER_EMAIL, BUYER_PASSWORD, BUYER_ACCOUNT_ID,
})) {
  if (!v) throw new Error(`cart-order-deterministic · missing ${k}`);
}
const HAMMEREX = "11111111-1111-4111-8111-111111111111";
const ROSA = "11111111-1111-4111-8111-111111111113";
for (const id of [SELLER_ACCOUNT_ID, BUYER_ACCOUNT_ID]) {
  if (id === HAMMEREX || id === ROSA) {
    throw new Error("cart-order-deterministic refuses · protected identity");
  }
}

const EVIDENCE_DIR = "evidence/cart-order-deterministic";
if (!existsSync(EVIDENCE_DIR)) mkdirSync(EVIDENCE_DIR, { recursive: true });

const PRODUCT_PREFIX = "E2E CART-DETER Widget";
const PRICE_PENCE = 3399;
const PLACEHOLDER_IMG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP8/58BAAT/Av+GHHe6AAAAAElFTkSuQmCC";
const STAMP = Date.now().toString(36);
const PRODUCT_NAME = `${PRODUCT_PREFIX} ${STAMP}`;
const NOTE_A = `CART-DETER A ${STAMP}`;
const NOTE_B = `CART-DETER B ${STAMP}`;
const BUYER_NAME = `CartDeterBuyer ${STAMP}`;
const BUYER_PHONE = "+351 900 000 000";
const BUYER_STREET = "1 Deterministic Lane";
const BUYER_CITY = "Testopolis";

async function pgClient(): Promise<InstanceType<typeof PG>> {
  const c = new PG({ connectionString: DB_URL });
  await c.connect();
  return c;
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `${EVIDENCE_DIR}/${name}`, fullPage: true });
}

async function signIn(page: Page, email: string, pw: string, next: string) {
  const url = `/nex-native/sign-in?next=${encodeURIComponent(next)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(pw);
  await Promise.all([
    page.waitForURL(
      (u) => !u.pathname.startsWith("/nex-native/sign-in"),
      { timeout: 60_000, waitUntil: "domcontentloaded" },
    ),
    page.locator("button[data-nex-sign-in-submit]").click(),
  ]);
}

async function writeSingleItemCart(page: Page, productId: string) {
  await page.evaluate((p) => {
    const KEY = "nex_cart_v1";
    const item = {
      key: crypto.randomUUID(),
      kind: "product",
      id: p.productId,
      shop_id: p.shopId,
      shop_slug: p.shopSlug,
      shop_owner_account_id: p.sellerAccountId,
      shop_display_name: p.shopName,
      shop_lat: null,
      shop_lng: null,
      name: p.name,
      price_pence: p.pricePence,
      currency: "EUR",
      image_url: p.imageUrl,
      quantity: 1,
      variants: [],
      perks: [],
      perks_note: null,
      note: null,
      added_at: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify([item]));
    window.dispatchEvent(new CustomEvent("nex-cart-changed"));
  }, {
    productId,
    shopId: SELLER_BUSINESS_ID,
    shopSlug: SELLER_BUSINESS_SLUG,
    sellerAccountId: SELLER_ACCOUNT_ID,
    shopName: SELLER_BUSINESS_NAME,
    name: PRODUCT_NAME,
    pricePence: PRICE_PENCE,
    imageUrl: PLACEHOLDER_IMG,
  });
}

async function checkoutWithNote(page: Page, note: string) {
  await page.goto("/nex-native/cart", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await expect(
    page.locator("section").filter({ hasText: PRODUCT_NAME }).first(),
  ).toBeVisible({ timeout: 20_000 });
  await page.locator("button", { hasText: /^Checkout\s*→$/ }).first().click();

  const sheet = page.locator(`[data-nex-checkout-sheet="${SELLER_BUSINESS_ID}"]`);
  await expect(sheet).toBeVisible({ timeout: 15_000 });

  const nameInput = sheet.locator("#co-name");
  await nameInput.fill(BUYER_NAME);
  await nameInput.blur();
  await sheet.locator('input[placeholder="Street + number"]').fill(BUYER_STREET);
  await sheet.locator('input[placeholder="City"]').fill(BUYER_CITY);
  const notesEl = sheet.locator("#co-notes");
  if (await notesEl.count()) await notesEl.fill(note);

  const submit = sheet.locator('button[type="submit"]');
  await expect(submit).toBeEnabled({ timeout: 10_000 });
  await submit.click();

  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    const u = new URL(page.url());
    if (u.pathname.startsWith("/nex-native/chat/peer/")) break;
    if (u.pathname === "/nex-native/cart" && u.searchParams.size > 0) break;
    await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});
  }
  const landed = new URL(page.url());
  expect(
    landed.pathname,
    `expected /chat/peer/<seller> · landed on ${landed.pathname}${landed.search}`,
  ).toMatch(/^\/nex-native\/chat\/peer\//);
  expect(landed.searchParams.get("cart_sent")).toBe("1");
}

// ──────────────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });
test.setTimeout(360_000);

test.describe("#14 real activation · production code path creates nex_order deterministically", () => {
  let productId = "";
  let orderAId = "";
  let orderBId = "";
  const cutoffIso = new Date().toISOString();

  let buyerCtx: BrowserContext;
  let buyerPage: Page;
  let sellerCtx: BrowserContext;
  let sellerPage: Page;

  test.beforeAll(async ({ browser }) => {
    // 1 · Seed ONE live product (prefix-scoped · restart-safe).
    //     Pre-clean must break the nex_order_product_id_fkey chain from
    //     any prior run that was interrupted before afterAll finished.
    const c = await pgClient();
    try {
      // Delete orphan nex_order_event rows FIRST (FK to nex_order),
      // then orphan nex_order rows that reference prefix-matched
      // products on this business, THEN delete the products.
      await c.query(
        `DELETE FROM nex_order_event
         WHERE order_id IN (
           SELECT id FROM nex_order
           WHERE product_id IN (
             SELECT id FROM nex_product
             WHERE business_id = $1 AND name LIKE $2
           )
         )`,
        [SELLER_BUSINESS_ID, `${PRODUCT_PREFIX} %`],
      );
      await c.query(
        `DELETE FROM nex_order
         WHERE product_id IN (
           SELECT id FROM nex_product
           WHERE business_id = $1 AND name LIKE $2
         )`,
        [SELLER_BUSINESS_ID, `${PRODUCT_PREFIX} %`],
      );
      // Also clean orphan cart peer-messages that reference this seller
      // from leftover runs (prefix-scoped by business_id in meta.cart).
      await c.query(
        `DELETE FROM nex_peer_message
         WHERE sender_account_id = $1
           AND (attachment_meta->'cart'->>'shop_id') = $2
           AND (attachment_meta->'cart'->>'order_id') IS NOT NULL
           AND body LIKE $3`,
        [BUYER_ACCOUNT_ID, SELLER_BUSINESS_ID, `%${PRODUCT_PREFIX}%`],
      );
      await c.query(
        `DELETE FROM nex_product WHERE business_id = $1 AND name LIKE $2`,
        [SELLER_BUSINESS_ID, `${PRODUCT_PREFIX} %`],
      );
      const r = await c.query(
        `INSERT INTO nex_product
           (business_id, name, description, price_pence, currency, status,
            department_id, category_id, image_url)
         VALUES ($1, $2, 'cart-order-deterministic fixture · delete freely',
                 $3, 'EUR', 'live', 'everything_else', 'other', NULL)
         RETURNING id`,
        [SELLER_BUSINESS_ID, PRODUCT_NAME, PRICE_PENCE],
      );
      productId = r.rows[0].id as string;
    } finally { await c.end(); }

    buyerCtx = await browser.newContext();
    buyerPage = await buyerCtx.newPage();
    sellerCtx = await browser.newContext();
    sellerPage = await sellerCtx.newPage();
  });

  test.afterAll(async () => {
    // Cleanup · time-and-buyer scoped for peer-message, id-scoped for
    // nex_order (prefer surgical deletes over name scans).
    try {
      const c = await pgClient();
      try {
        for (const id of [orderAId, orderBId]) {
          if (!id) continue;
          await c.query(`DELETE FROM nex_order_event WHERE order_id = $1`, [id]);
          await c.query(`DELETE FROM nex_order WHERE id = $1`, [id]);
        }
        await c.query(
          `DELETE FROM nex_peer_message
           WHERE sender_account_id = $1
             AND sent_at >= $2
             AND (attachment_meta->'cart'->>'shop_id') = $3`,
          [BUYER_ACCOUNT_ID, cutoffIso, SELLER_BUSINESS_ID],
        );
        if (productId) {
          await c.query(`DELETE FROM nex_product WHERE id = $1`, [productId]);
        }
      } finally { await c.end(); }
    } catch (e) {
      console.warn("cart-order-deterministic cleanup failed · manual review needed", e);
    }
    try { await buyerCtx?.close(); } catch { /* */ }
    try { await sellerCtx?.close(); } catch { /* */ }
  });

  test("1 · buyer signs in", async () => {
    await signIn(buyerPage, BUYER_EMAIL, BUYER_PASSWORD, "/nex-native/contacts");
    expect(new URL(buyerPage.url()).pathname.startsWith("/nex-native/sign-in")).toBe(false);
  });

  test("2 · buyer visits seller shop", async () => {
    await buyerPage.goto(`/nex-native/${SELLER_BUSINESS_SLUG}`, {
      waitUntil: "domcontentloaded", timeout: 60_000,
    });
    expect(new URL(buyerPage.url()).pathname).toBe(`/nex-native/${SELLER_BUSINESS_SLUG}`);
  });

  test("3 · FIRST identical cart → real sendCartOrderAction submits · redirect to chat?cart_sent=1", async () => {
    await writeSingleItemCart(buyerPage, productId);
    await checkoutWithNote(buyerPage, NOTE_A);
    await screenshot(buyerPage, "01-first-cart-sent.png");
  });

  test("4 · SECOND identical cart (same product · same qty · same price · same address · different note)", async () => {
    await writeSingleItemCart(buyerPage, productId);
    await checkoutWithNote(buyerPage, NOTE_B);
    await screenshot(buyerPage, "02-second-cart-sent.png");
  });

  test("5 · production code path produced TWO nex_order rows · ids match embedded cart UUIDs · no fixtures inserted", async () => {
    const c = await pgClient();
    try {
      // Gather the two cart messages from the real production write path.
      const msgs = await c.query(
        `SELECT id,
                attachment_meta->'cart'->>'order_id' AS cart_order_id,
                attachment_meta->'cart'->>'buyer_notes' AS buyer_notes,
                sent_at
         FROM nex_peer_message
         WHERE sender_account_id = $1
           AND sent_at >= $2
           AND (attachment_meta->'cart'->>'shop_id') = $3
         ORDER BY sent_at ASC`,
        [BUYER_ACCOUNT_ID, cutoffIso, SELLER_BUSINESS_ID],
      );
      expect(msgs.rowCount, "expected EXACTLY two cart messages from the two checkouts").toBe(2);
      const uuidA = msgs.rows[0].cart_order_id as string;
      const uuidB = msgs.rows[1].cart_order_id as string;
      expect(uuidA).toBeTruthy();
      expect(uuidB).toBeTruthy();
      expect(uuidA).not.toBe(uuidB);
      // Buyer_notes carry the preferred-payment prefix line + the typed
      // note · we assert substring containment, not equality.
      expect(msgs.rows[0].buyer_notes as string).toContain(NOTE_A);
      expect(msgs.rows[1].buyer_notes as string).toContain(NOTE_B);

      // The real `sendCartOrderAction` (not this test) created the
      // orders. Assert they exist and that id = the embedded UUID.
      const orders = await c.query(
        `SELECT id, business_id, product_id, customer_account_id, state, created_at
         FROM nex_order
         WHERE id = ANY($1::uuid[])`,
        [[uuidA, uuidB]],
      );
      expect(
        orders.rowCount,
        "both nex_order rows must exist with ids = the cart-embedded order_ids",
      ).toBe(2);
      for (const row of orders.rows) {
        expect(row.business_id).toBe(SELLER_BUSINESS_ID);
        expect(row.product_id).toBe(productId);
        expect(row.customer_account_id).toBe(BUYER_ACCOUNT_ID);
        expect(new Date(row.created_at as string).toISOString() >= cutoffIso).toBe(true);
      }
      orderAId = uuidA;
      orderBId = uuidB;
    } finally { await c.end(); }
  });

  test("6 · seller /manage/orders lists BOTH orders (links to each order id)", async () => {
    await signIn(
      sellerPage, SELLER_EMAIL, SELLER_PASSWORD,
      "/nex-native/manage/orders",
    );
    // The list renders each order as a row with its own detail-page
    // link. The display text is the buyer_notes string, not the
    // product name (the product name is the detail-page content).
    // We assert both id-hrefs land in the DOM.
    const t0 = Date.now();
    while (Date.now() - t0 < 30_000) {
      const linkA = await sellerPage.locator(`a[href$="/manage/orders/${orderAId}"]`).count();
      const linkB = await sellerPage.locator(`a[href$="/manage/orders/${orderBId}"]`).count();
      if (linkA > 0 && linkB > 0) break;
      await sellerPage.reload({ waitUntil: "domcontentloaded" });
    }
    for (const id of [orderAId, orderBId]) {
      const link = sellerPage.locator(`a[href$="/manage/orders/${id}"]`).first();
      await expect(link, `list must link to order ${id.slice(0,8)}`).toBeVisible({ timeout: 5_000 });
    }
    await screenshot(sellerPage, "03-seller-orders-list.png");
  });

  test("7 · order A detail · Tier 0 deterministic match · own note · not B's", async () => {
    await sellerPage.goto(`/nex-native/manage/orders/${orderAId}`, {
      waitUntil: "domcontentloaded", timeout: 60_000,
    });
    const detail = sellerPage.locator("[data-nex-order-detail]");
    await expect(detail).toBeVisible({ timeout: 15_000 });
    const tier = await detail.getAttribute("data-nex-order-cart-match-tier");
    expect(tier, "Order A Tier 0 deterministic match").toBe("deterministic_order_id");
    await expect(sellerPage.locator("[data-nex-order-cart-ambiguous]")).toHaveCount(0);
    const body = await sellerPage.locator("body").innerText();
    expect(body, "Order A shows OWN note").toContain(NOTE_A);
    expect(body, "Order A must NOT leak B's note").not.toContain(NOTE_B);
    expect(body).toContain(PRODUCT_NAME);
    await screenshot(sellerPage, "04-order-A-detail.png");
  });

  test("8 · order B detail · Tier 0 deterministic match · own note · not A's", async () => {
    await sellerPage.goto(`/nex-native/manage/orders/${orderBId}`, {
      waitUntil: "domcontentloaded", timeout: 60_000,
    });
    const detail = sellerPage.locator("[data-nex-order-detail]");
    await expect(detail).toBeVisible({ timeout: 15_000 });
    const tier = await detail.getAttribute("data-nex-order-cart-match-tier");
    expect(tier, "Order B Tier 0 deterministic match").toBe("deterministic_order_id");
    await expect(sellerPage.locator("[data-nex-order-cart-ambiguous]")).toHaveCount(0);
    const body = await sellerPage.locator("body").innerText();
    expect(body, "Order B shows OWN note").toContain(NOTE_B);
    expect(body, "Order B must NOT leak A's note").not.toContain(NOTE_A);
    expect(body).toContain(PRODUCT_NAME);
    await screenshot(sellerPage, "05-order-B-detail.png");
  });
});
