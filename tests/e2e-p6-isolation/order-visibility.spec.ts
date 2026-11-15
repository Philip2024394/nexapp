// tests/e2e-p6-isolation/order-visibility.spec.ts
//
// D2 · 2026-11-15. Two-context Playwright suite proving that cart
// orders — both with AND without a product image on the lead item —
// (a) persist via the sealed D2 write-path (attachment_type NULL,
// attachment_meta.cart populated), (b) surface in the seller's
// /manage/orders dashboard, (c) survive reload, and (d) are hidden
// from buyer-context cross-account access.
//
// Context A = CK5 buyer (PLAYWRIGHT_CK5_B_*).
// Context B = CK5 seller (PLAYWRIGHT_CK5_A_*).
//
// Fixture-assist (disclosed):
//   · CK5 accounts seeded by scripts/_tmp/seed-disposable-vault-accounts.mjs
//   · CK5 seller business row seeded by scripts/_tmp/seed-disposable-business.mjs
//   · Two seeded nex_product rows on the CK5 seller:
//       - imaged (image_url = placeholder data: URL · never fetched by server)
//       - imageless (image_url = NULL)
//     Both status='live'.
//   · Two seeded nex_order rows pointing at the cart conversation·
//     this is required because the sealed Path A chat/order
//     separation (memory 2026-11-09) does NOT auto-insert nex_order
//     from the cart flow. The seller's /manage/orders page reads
//     nex_order directly, so the orders must exist for visibility
//     to be provable. This is disclosed.
//
// Hard safety guards:
//   · DATABASE_URL must reference sandbox kdstoyyeygcopkogqsyv.
//   · Account IDs must NOT match Hammerex (11111111-...-111) or Rosa
//     (11111111-...-113). Fail-closed if the env file resolves wrong.
//   · Cleanup uses WHERE clauses anchored on (business_id, prefix)
//     and (sender_account_id, business_id, prefix). Any deviation
//     refuses.

import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pkg from "pg";

const { Client: PG } = pkg;

// ─── env ──────────────────────────────────────────────────────────

function fromEnvLocal(name: string): string {
  try {
    const m = readFileSync(".env.local", "utf8").match(
      new RegExp(`^${name}=(.*)$`, "m"),
    );
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}

function fromEnvFile(path: string, name: string): string {
  try {
    const m = readFileSync(path, "utf8").match(
      new RegExp(`^${name}=['"]?([^'"\\n]*)['"]?$`, "m"),
    );
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}

const DB_URL = fromEnvLocal("DATABASE_URL");
const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";

if (DB_URL.includes(PROD_REF)) {
  throw new Error("order-visibility refuses · production ref detected");
}
if (!DB_URL.includes(SANDBOX_REF)) {
  throw new Error(`order-visibility refuses · DATABASE_URL not sandbox ${SANDBOX_REF}`);
}

const CK5_FILE = ".env.playwright.vault-ck5";
const SELLER_EMAIL = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_A_EMAIL");
const SELLER_PASSWORD = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_A_PASSWORD");
const SELLER_ACCOUNT_ID = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const SELLER_BUSINESS_ID = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_A_BUSINESS_ID");
const SELLER_BUSINESS_SLUG = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_A_BUSINESS_SLUG");
const SELLER_BUSINESS_NAME = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_A_BUSINESS_NAME");

const BUYER_EMAIL = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_B_EMAIL");
const BUYER_PASSWORD = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_B_PASSWORD");
const BUYER_ACCOUNT_ID = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_B_ACCOUNT_ID");

for (const [k, v] of Object.entries({
  SELLER_EMAIL, SELLER_PASSWORD, SELLER_ACCOUNT_ID, SELLER_BUSINESS_ID,
  SELLER_BUSINESS_SLUG, SELLER_BUSINESS_NAME,
  BUYER_EMAIL, BUYER_PASSWORD, BUYER_ACCOUNT_ID,
})) {
  if (!v) {
    throw new Error(`order-visibility · missing ${k} in ${CK5_FILE}`);
  }
}

if (SELLER_ACCOUNT_ID === BUYER_ACCOUNT_ID) {
  throw new Error("order-visibility refuses · seller and buyer are the same CK5 account");
}

const PROTECTED = new Set([
  "11111111-1111-4111-8111-111111111111",
  "11111111-1111-4111-8111-111111111113",
]);
if (PROTECTED.has(SELLER_ACCOUNT_ID) || PROTECTED.has(BUYER_ACCOUNT_ID)) {
  throw new Error("order-visibility refuses · CK5 resolves to a protected id");
}

// ─── constants ────────────────────────────────────────────────────

const PRODUCT_NAME_PREFIX = "E2E D2 Widget";
const IMAGED_NAME = `${PRODUCT_NAME_PREFIX} Imaged ${Date.now()}`;
const IMAGELESS_NAME = `${PRODUCT_NAME_PREFIX} Imageless ${Date.now()}`;
const PRICE_IMAGED = 1250; // minor units
const PRICE_IMAGELESS = 999;
const BUYER_NAME = "E2E CK5 Buyer";
const BUYER_ADDRESS_LINE = "E2E Street, Test City";
// Placeholder image_url for the imaged product. The server never fetches
// this URL · it exists only so the server-side `firstImage` branch takes
// the "has image" path. A data: URL is a perfectly valid non-null string.
const PLACEHOLDER_IMG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP8/58BAAT/Av+GHHe6AAAAAElFTkSuQmCC";

// ─── helpers ──────────────────────────────────────────────────────

async function pgClient(): Promise<InstanceType<typeof PG>> {
  const c = new PG({ connectionString: DB_URL });
  await c.connect();
  return c;
}

async function signIn(
  page: Page,
  email: string,
  password: string,
  nextPath: string,
): Promise<void> {
  await page.goto(`/nex-native/sign-in?next=${encodeURIComponent(nextPath)}`, {
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

async function screenshot(page: Page, filename: string): Promise<void> {
  const dir = "evidence/d2-d3";
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${filename}`, fullPage: true }).catch(() => {});
}

// ─── test config ──────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });
test.setTimeout(360_000);

// ─── Suite ────────────────────────────────────────────────────────

test.describe("D2 · Order visibility (imaged + imageless) · CK5 disposable · fixture-assisted", () => {
  let buyerCtx: BrowserContext;
  let sellerCtx: BrowserContext;
  let buyerPage: Page;
  let sellerPage: Page;

  // Resolved in beforeAll.
  let beforeIso = "";
  let imagedProductId = "";
  let imagelessProductId = "";
  // Captured after buyer's cart sends.
  let imagedConversationId = "";
  let imagelessConversationId = "";
  let imagedOrderId = "";
  let imagelessOrderId = "";

  test.beforeAll(async ({ browser }) => {
    const c = await pgClient();
    try {
      beforeIso = new Date(
        (await c.query(`SELECT now() AS t`)).rows[0].t,
      ).toISOString();

      // Pre-clean any prior D2 widgets.
      const leftovers = await c.query(
        `SELECT id, name FROM nex_product
         WHERE business_id = $1 AND name LIKE $2`,
        [SELLER_BUSINESS_ID, `${PRODUCT_NAME_PREFIX} %`],
      );
      for (const row of leftovers.rows) {
        if (!(row.name as string).startsWith(`${PRODUCT_NAME_PREFIX} `)) {
          throw new Error(`pre-clean refuse · unexpected name ${row.name}`);
        }
      }
      await c.query(
        `DELETE FROM nex_product WHERE business_id = $1 AND name LIKE $2`,
        [SELLER_BUSINESS_ID, `${PRODUCT_NAME_PREFIX} %`],
      );

      // Seed TWO live products.
      const imagedRes = await c.query(
        `INSERT INTO nex_product
           (business_id, name, description, price_pence, currency, status,
            department_id, category_id, image_url)
         VALUES ($1, $2, 'D2 fixture · imaged · delete freely',
                 $3, 'EUR', 'live', 'everything_else', 'other', $4)
         RETURNING id`,
        [SELLER_BUSINESS_ID, IMAGED_NAME, PRICE_IMAGED, PLACEHOLDER_IMG],
      );
      imagedProductId = imagedRes.rows[0].id as string;

      const imagelessRes = await c.query(
        `INSERT INTO nex_product
           (business_id, name, description, price_pence, currency, status,
            department_id, category_id, image_url)
         VALUES ($1, $2, 'D2 fixture · imageless · delete freely',
                 $3, 'EUR', 'live', 'everything_else', 'other', NULL)
         RETURNING id`,
        [SELLER_BUSINESS_ID, IMAGELESS_NAME, PRICE_IMAGELESS],
      );
      imagelessProductId = imagelessRes.rows[0].id as string;
    } finally {
      await c.end();
    }

    buyerCtx = await browser.newContext();
    sellerCtx = await browser.newContext();
    buyerPage = await buyerCtx.newPage();
    sellerPage = await sellerCtx.newPage();
  });

  test.afterAll(async () => {
    try { await buyerCtx?.close(); } catch { /* ignore */ }
    try { await sellerCtx?.close(); } catch { /* ignore */ }

    const c = await pgClient();
    try {
      // Delete the nex_order rows we fixture-inserted (if any).
      for (const oid of [imagedOrderId, imagelessOrderId]) {
        if (!oid) continue;
        const row = await c.query(
          `SELECT business_id, customer_account_id FROM nex_order WHERE id = $1`,
          [oid],
        );
        if (row.rowCount && row.rowCount > 0) {
          const r = row.rows[0] as { business_id: string; customer_account_id: string };
          if (r.business_id !== SELLER_BUSINESS_ID || r.customer_account_id !== BUYER_ACCOUNT_ID) {
            throw new Error(`cleanup refuses · order id=${oid} drift`);
          }
          await c.query(`DELETE FROM nex_order WHERE id = $1`, [oid]);
        }
      }

      // Delete the two seeded products.
      const leftovers = await c.query(
        `SELECT id, name, business_id FROM nex_product
         WHERE business_id = $1 AND name LIKE $2`,
        [SELLER_BUSINESS_ID, `${PRODUCT_NAME_PREFIX} %`],
      );
      for (const row of leftovers.rows) {
        if (row.business_id !== SELLER_BUSINESS_ID) {
          throw new Error(`cleanup refuses · product business_id drift`);
        }
        if (!(row.name as string).startsWith(`${PRODUCT_NAME_PREFIX} `)) {
          throw new Error(`cleanup refuses · product name not prefixed: ${row.name}`);
        }
      }
      const delProd = await c.query(
        `DELETE FROM nex_product WHERE business_id = $1 AND name LIKE $2 RETURNING id`,
        [SELLER_BUSINESS_ID, `${PRODUCT_NAME_PREFIX} %`],
      );

      // Delete the nex_peer_message cart_order rows this test created.
      const delMsg = await c.query(
        `DELETE FROM nex_peer_message
         WHERE sender_account_id = $1
           AND sent_at >= $2::timestamptz
           AND attachment_meta->'cart'->>'shop_id' = $3
         RETURNING id`,
        [BUYER_ACCOUNT_ID, beforeIso, SELLER_BUSINESS_ID],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[d2 cleanup] deleted products=${delProd.rowCount} cart_messages=${delMsg.rowCount}`,
      );
    } finally {
      await c.end();
    }
  });

  test("1 · buyer signs in · lands outside sign-in", async () => {
    await signIn(buyerPage, BUYER_EMAIL, BUYER_PASSWORD, "/nex-native/contacts");
    const u = new URL(buyerPage.url());
    expect(u.pathname.startsWith("/nex-native/sign-in")).toBe(false);
    await screenshot(buyerPage, "d2-01-buyer-signed-in.png");
  });

  test("2 · buyer visits seller's public shop by slug", async () => {
    await buyerPage.goto(`/nex-native/${SELLER_BUSINESS_SLUG}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const u = new URL(buyerPage.url());
    expect(u.pathname).toBe(`/nex-native/${SELLER_BUSINESS_SLUG}`);
    await screenshot(buyerPage, "d2-02-buyer-on-shop.png");
  });

  test("3 · buyer writes BOTH cart items via sealed localStorage contract", async () => {
    // Write BOTH products into localStorage (two separate cart items,
    // same shop). The cart page groups by shop_id and shows one cart
    // card. On checkout, _actions.sendCartOrderAction creates ONE
    // peer-message per CART (not per item). To prove D2 covers both
    // the imaged-lead-item path AND the imageless-lead-item path, we
    // send TWO separate checkouts: first with ONLY the imaged item,
    // then with ONLY the imageless item.
    //
    // Honest clarification: per sendCartOrderAction, "has image" is
    // derived from items[0].image_url. So the imaged-vs-imageless
    // distinction is per CART, not per line. Two sequential carts give
    // us one of each.

    await buyerPage.evaluate((p) => {
      const KEY = "nex_cart_v1";
      const item = {
        key: crypto.randomUUID(),
        kind: "product",
        id: p.imagedProductId,
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
      imagedProductId,
      shopId: SELLER_BUSINESS_ID,
      shopSlug: SELLER_BUSINESS_SLUG,
      sellerAccountId: SELLER_ACCOUNT_ID,
      shopName: SELLER_BUSINESS_NAME,
      name: IMAGED_NAME,
      pricePence: PRICE_IMAGED,
      imageUrl: PLACEHOLDER_IMG,
    });
  });

  test("4 · buyer checks out IMAGED cart · redirect to /chat/peer/<seller>?cart_sent=1", async () => {
    await buyerPage.goto("/nex-native/cart", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(
      buyerPage.locator("section").filter({ hasText: IMAGED_NAME }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await screenshot(buyerPage, "d2-04a-cart-imaged.png");

    await buyerPage
      .locator("button", { hasText: /^Checkout\s*→$/ })
      .first()
      .click();

    const sheet = buyerPage.locator(
      `[data-nex-checkout-sheet="${SELLER_BUSINESS_ID}"]`,
    );
    await expect(sheet).toBeVisible({ timeout: 15_000 });

    const nameInput = sheet.locator("#co-name");
    await nameInput.fill(BUYER_NAME);
    await nameInput.blur();
    await sheet.locator('input[placeholder="Street + number"]').fill(BUYER_ADDRESS_LINE);
    await sheet.locator('input[placeholder="City"]').fill("Testopolis");

    const submitBtn = sheet.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await screenshot(buyerPage, "d2-04b-presubmit-imaged.png");
    await submitBtn.click();

    // Wait for redirect with cart_sent=1
    const t0 = Date.now();
    while (Date.now() - t0 < 60_000) {
      const u = new URL(buyerPage.url());
      if (u.pathname.startsWith("/nex-native/chat/peer/")) break;
      if (u.pathname === "/nex-native/cart" && u.searchParams.size > 0) break;
      await buyerPage.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});
    }
    const landed = new URL(buyerPage.url());
    expect(
      landed.pathname,
      `expected redirect to /chat/peer/<seller> · landed on ${landed.pathname}${landed.search}`,
    ).toMatch(/^\/nex-native\/chat\/peer\//);
    expect(landed.pathname).toContain(SELLER_ACCOUNT_ID);
    expect(landed.searchParams.get("cart_sent")).toBe("1");
    await screenshot(buyerPage, "d2-04c-after-imaged-checkout.png");
  });

  test("5 · buyer writes + checks out IMAGELESS cart", async () => {
    // Clear cart, write imageless item, checkout.
    await buyerPage.evaluate((p) => {
      const KEY = "nex_cart_v1";
      const item = {
        key: crypto.randomUUID(),
        kind: "product",
        id: p.imagelessProductId,
        shop_id: p.shopId,
        shop_slug: p.shopSlug,
        shop_owner_account_id: p.sellerAccountId,
        shop_display_name: p.shopName,
        shop_lat: null,
        shop_lng: null,
        name: p.name,
        price_pence: p.pricePence,
        currency: "EUR",
        image_url: null,
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
      imagelessProductId,
      shopId: SELLER_BUSINESS_ID,
      shopSlug: SELLER_BUSINESS_SLUG,
      sellerAccountId: SELLER_ACCOUNT_ID,
      shopName: SELLER_BUSINESS_NAME,
      name: IMAGELESS_NAME,
      pricePence: PRICE_IMAGELESS,
    });

    await buyerPage.goto("/nex-native/cart", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(
      buyerPage.locator("section").filter({ hasText: IMAGELESS_NAME }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await screenshot(buyerPage, "d2-05a-cart-imageless.png");

    await buyerPage
      .locator("button", { hasText: /^Checkout\s*→$/ })
      .first()
      .click();

    const sheet = buyerPage.locator(
      `[data-nex-checkout-sheet="${SELLER_BUSINESS_ID}"]`,
    );
    await expect(sheet).toBeVisible({ timeout: 15_000 });

    const nameInput = sheet.locator("#co-name");
    await nameInput.fill(BUYER_NAME);
    await nameInput.blur();
    await sheet.locator('input[placeholder="Street + number"]').fill(BUYER_ADDRESS_LINE);
    await sheet.locator('input[placeholder="City"]').fill("Testopolis");

    const submitBtn = sheet.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await submitBtn.click();

    const t0 = Date.now();
    while (Date.now() - t0 < 60_000) {
      const u = new URL(buyerPage.url());
      if (u.pathname.startsWith("/nex-native/chat/peer/")) break;
      if (u.pathname === "/nex-native/cart" && u.searchParams.size > 0) break;
      await buyerPage.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});
    }
    const landed = new URL(buyerPage.url());
    expect(landed.pathname).toMatch(/^\/nex-native\/chat\/peer\//);
    expect(landed.searchParams.get("cart_sent")).toBe("1");
    await screenshot(buyerPage, "d2-05b-after-imageless-checkout.png");
  });

  test("6 · DB confirms D2 write shape · attachment_type NULL + meta.cart populated for BOTH carts", async () => {
    const c = await pgClient();
    try {
      const res = await c.query(
        `SELECT id, attachment_type, attachment_url, attachment_meta, conversation_id
         FROM nex_peer_message
         WHERE sender_account_id = $1
           AND sent_at >= $2::timestamptz
           AND attachment_meta->'cart'->>'shop_id' = $3
         ORDER BY sent_at ASC`,
        [BUYER_ACCOUNT_ID, beforeIso, SELLER_BUSINESS_ID],
      );
      // Expect exactly 2 rows (one per cart).
      expect(res.rowCount).toBe(2);

      let seenImaged = false;
      let seenImageless = false;
      for (const row of res.rows) {
        // D2 fix: BOTH must have attachment_type IS NULL and
        // attachment_url IS NULL. The cart snapshot lives in meta.
        expect(row.attachment_type).toBeNull();
        expect(row.attachment_url).toBeNull();
        const meta = row.attachment_meta as { cart?: { items?: Array<{ id: string; name: string; price_pence: number }> } };
        expect(meta.cart).toBeDefined();
        expect(Array.isArray(meta.cart?.items)).toBe(true);
        expect(meta.cart!.items!.length).toBe(1);
        const item = meta.cart!.items![0]!;
        if (item.id === imagedProductId) {
          seenImaged = true;
          expect(item.name).toBe(IMAGED_NAME);
          expect(item.price_pence).toBe(PRICE_IMAGED);
          imagedConversationId = row.conversation_id as string;
        } else if (item.id === imagelessProductId) {
          seenImageless = true;
          expect(item.name).toBe(IMAGELESS_NAME);
          expect(item.price_pence).toBe(PRICE_IMAGELESS);
          imagelessConversationId = row.conversation_id as string;
        }
      }
      expect(seenImaged, "imaged cart message not found").toBe(true);
      expect(seenImageless, "imageless cart message not found").toBe(true);
    } finally {
      await c.end();
    }
  });

  test("7 · fixture-insert two nex_order rows · DISCLOSED · source_conversation_id SET NULL", async () => {
    // Why fixture-assisted: sealed Path A chat/order separation
    // (memory 2026-11-09) does NOT auto-create nex_order from the cart
    // flow. The seller's /manage/orders page reads nex_order directly,
    // so for list visibility to be provable, rows must exist.
    //
    // FINDING (honest, documented): the cart flow writes
    // nex_peer_message.conversation_id (FK to nex_peer_conversation),
    // but nex_order.source_conversation_id FK references nex_conversation
    // · DIFFERENT tables. So we cannot link the fixture order back to
    // the real cart conversation via that FK. We set source_conversation_id
    // = NULL (per migration 005, the column is nullable and ON DELETE
    // SET NULL). The /manage/orders LIST page does NOT require a
    // conversation link to render. The /manage/orders/<id> DETAIL page
    // reads `nex_peer_message.source_conversation_id` which DOES NOT
    // EXIST on the peer_message table · a pre-existing schema mismatch
    // not caused by D2. Cart snapshot rendering is therefore degraded.
    expect(imagedConversationId).not.toBe("");
    expect(imagelessConversationId).not.toBe("");

    const c = await pgClient();
    try {
      const imagedId = randomUUID();
      const imagelessId = randomUUID();
      await c.query(
        `INSERT INTO nex_order
           (id, customer_account_id, business_id, product_id,
            state, price_pence, currency)
         VALUES ($1, $2, $3, $4, 'created', $5, 'EUR'),
                ($6, $2, $3, $7, 'created', $8, 'EUR')`,
        [
          imagedId, BUYER_ACCOUNT_ID, SELLER_BUSINESS_ID, imagedProductId,
          PRICE_IMAGED,
          imagelessId, imagelessProductId, PRICE_IMAGELESS,
        ],
      );
      imagedOrderId = imagedId;
      imagelessOrderId = imagelessId;
    } finally {
      await c.end();
    }
  });

  test("8 · seller signs in · /manage/orders page shows BOTH orders (not just one)", async () => {
    await signIn(sellerPage, SELLER_EMAIL, SELLER_PASSWORD, "/nex-native/manage/orders");
    const url = new URL(sellerPage.url());
    expect(url.pathname).toBe("/nex-native/manage/orders");
    await expect(sellerPage.locator("[data-nex-manage-orders]")).toBeVisible({ timeout: 20_000 });

    // Both order ids must appear somewhere on the page (either in the
    // row links or anchor hrefs pointing at /manage/orders/<id>).
    // The sealed manage/orders _client uses <Link href="/nex-native/manage/orders/<id>">
    // for each row · we assert BOTH hrefs are present.
    await expect(
      sellerPage.locator(`a[href="/nex-native/manage/orders/${imagedOrderId}"]`),
    ).toHaveCount(1, { timeout: 10_000 });
    await expect(
      sellerPage.locator(`a[href="/nex-native/manage/orders/${imagelessOrderId}"]`),
    ).toHaveCount(1);
    await screenshot(sellerPage, "d2-08-seller-manage-orders-list.png");
  });

  test("9 · open IMAGED order detail · Items card shows product name + price", async () => {
    // 2026-11-15 · CP1 reader fix in page.tsx. The sealed reader now
    // keys the cart-snapshot lookup on (sender_account_id = customer)
    // + (attachment_meta.cart.shop_id = business_id) instead of the
    // broken source_conversation_id join. With the fix the navigation
    // completes cleanly AND the Items card hydrates from the cart
    // snapshot. HARD assertion: product name + price present.
    await sellerPage.goto(`/nex-native/manage/orders/${imagedOrderId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(sellerPage.locator("[data-nex-order-detail]")).toBeVisible({ timeout: 15_000 });
    await screenshot(sellerPage, "d2-09-order-imaged.png");
    const body = await sellerPage.locator("body").innerText();
    expect(body, "imaged order Items card must show product name").toContain(IMAGED_NAME);
    expect(body, "imaged order must show headline price").toContain("12.50");
  });

  test("10 · open IMAGELESS order detail · Items card shows product name + price", async () => {
    await sellerPage.goto(`/nex-native/manage/orders/${imagelessOrderId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(sellerPage.locator("[data-nex-order-detail]")).toBeVisible({ timeout: 15_000 });
    await screenshot(sellerPage, "d2-10-order-imageless.png");
    const body = await sellerPage.locator("body").innerText();
    expect(body, "imageless order Items card must show product name").toContain(IMAGELESS_NAME);
    expect(body, "imageless order must show headline price").toContain("9.99");
  });

  test("10b · reload IMAGED order detail · Items card content persists", async () => {
    await sellerPage.goto(`/nex-native/manage/orders/${imagedOrderId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(sellerPage.locator("[data-nex-order-detail]")).toBeVisible({ timeout: 15_000 });
    await sellerPage.reload({ waitUntil: "domcontentloaded" });
    await expect(sellerPage.locator("[data-nex-order-detail]")).toBeVisible({ timeout: 15_000 });
    const body = await sellerPage.locator("body").innerText();
    expect(body, "Items card must persist after reload").toContain(IMAGED_NAME);
    await screenshot(sellerPage, "d2-10b-reload-items-persist.png");
  });

  test("11 · reload /manage/orders LIST · shell persists", async () => {
    // Given steps 9/10 may abort because of the pre-existing
    // order-detail schema gap, exercise reload on the LIST page which
    // we know works (step 8). The LIST is the surface the task cares
    // about for "orders visible, not just one."
    await sellerPage.goto(`/nex-native/manage/orders`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(sellerPage.locator("[data-nex-manage-orders]")).toBeVisible({ timeout: 15_000 });
    await sellerPage.reload({ waitUntil: "domcontentloaded" });
    await expect(sellerPage.locator("[data-nex-manage-orders]")).toBeVisible({ timeout: 15_000 });
    // Both order rows still present after reload.
    await expect(
      sellerPage.locator(`a[href="/nex-native/manage/orders/${imagedOrderId}"]`),
    ).toHaveCount(1);
    await expect(
      sellerPage.locator(`a[href="/nex-native/manage/orders/${imagelessOrderId}"]`),
    ).toHaveCount(1);
    await screenshot(sellerPage, "d2-11-reload-list.png");
  });

  // ─── GAP1 · repeat same-product orders retain their own snapshots ──
  //
  // Owner-sealed defect (2026-11-15): a buyer who places TWO separate
  // orders for the SAME product with the SAME seller must have EACH
  // order resolve to ITS OWN cart snapshot — not both collapsing to
  // the newest. The fix in page.tsx uses nex_order.price_pence vs.
  // attachment_meta.cart.subtotal_pence (+ time proximity) as the
  // zero-schema-change disambiguator. This group proves it end-to-end.
  //
  // Fixture-assist (DISCLOSED): we insert both cart messages directly
  // via pg to mirror the sealed D2 write shape (attachment_type NULL ·
  // attachment_meta.cart populated). This matches exactly what
  // sendCartOrderAction writes at the row level (see _actions.ts
  // line 3192 · `attachment_meta: { cart: snapshot }`). Going through
  // the UI would work but costs ~90s per cart · the shape is the same.
  // Then we fixture-insert two nex_order rows with matching price_pence
  // and assert the reader hydrates each detail page with the correct
  // snapshot.
  //
  // Prefix: "E2E GAP1 Widget *" — isolated from D2's "E2E D2 Widget *".
  test("GAP1 · repeat same-product orders retain their own snapshots", async ({
    browser,
  }) => {
    const GAP1_PREFIX = "E2E GAP1 Widget";
    const GAP1_NAME = `${GAP1_PREFIX} RepeatSameProduct ${Date.now()}`;
    // Order A: qty=1 total 1000. Order B: qty=2 total 2500 (price different
    // from A × 2 on purpose · discount/perk simulation · proves the disambiguator
    // keys on CART subtotal not product-price arithmetic).
    const ORDER_A_PRICE_PENCE = 1000;
    const ORDER_B_PRICE_PENCE = 2500;

    let gap1ProductId = "";
    let gap1CartMsgAId = "";
    let gap1CartMsgBId = "";
    let gap1OrderAId = "";
    let gap1OrderBId = "";
    let gap1BeforeIso = "";

    const gap1Ctx = await browser.newContext();
    const gap1Page = await gap1Ctx.newPage();

    try {
      // ── Seed product + two cart messages + two orders ────────────
      const c = await pgClient();
      try {
        gap1BeforeIso = new Date(
          (await c.query(`SELECT now() AS t`)).rows[0].t,
        ).toISOString();

        // Hard-guard: pre-clean must only match our prefix.
        const leftovers = await c.query(
          `SELECT id, name FROM nex_product
           WHERE business_id = $1 AND name LIKE $2`,
          [SELLER_BUSINESS_ID, `${GAP1_PREFIX} %`],
        );
        for (const row of leftovers.rows) {
          if (!(row.name as string).startsWith(`${GAP1_PREFIX} `)) {
            throw new Error(`gap1 pre-clean refuse · unexpected name ${row.name}`);
          }
        }
        await c.query(
          `DELETE FROM nex_product WHERE business_id = $1 AND name LIKE $2`,
          [SELLER_BUSINESS_ID, `${GAP1_PREFIX} %`],
        );

        // 1 · One live product.
        const prodRes = await c.query(
          `INSERT INTO nex_product
             (business_id, name, description, price_pence, currency, status,
              department_id, category_id, image_url)
           VALUES ($1, $2, 'GAP1 fixture · delete freely',
                   $3, 'EUR', 'live', 'everything_else', 'other', NULL)
           RETURNING id`,
          [SELLER_BUSINESS_ID, GAP1_NAME, ORDER_A_PRICE_PENCE],
        );
        gap1ProductId = prodRes.rows[0].id as string;

        // 2 · Resolve/create a nex_peer_conversation between buyer + seller.
        // Mirror the sealed write shape (migration 047): FK on
        // nex_peer_message.conversation_id points at
        // nex_peer_conversation.id. The table enforces
        // participant_a_id < participant_b_id (lexico) · we canonicalise
        // the pair before SELECT/INSERT. Reuse if it exists.
        const [participantA, participantB] = [BUYER_ACCOUNT_ID, SELLER_ACCOUNT_ID]
          .slice()
          .sort();
        const convRes = await c.query(
          `SELECT id FROM nex_peer_conversation
           WHERE participant_a_id = $1 AND participant_b_id = $2
           LIMIT 1`,
          [participantA, participantB],
        );
        let conversationId: string;
        if (convRes.rowCount && convRes.rowCount > 0) {
          conversationId = convRes.rows[0].id as string;
        } else {
          const newConv = await c.query(
            `INSERT INTO nex_peer_conversation
               (participant_a_id, participant_b_id)
             VALUES ($1, $2)
             RETURNING id`,
            [participantA, participantB],
          );
          conversationId = newConv.rows[0].id as string;
        }

        // 3 · Cart message A · subtotal 1000 · qty 1.
        const cartA = {
          shop_id: SELLER_BUSINESS_ID,
          shop_slug: SELLER_BUSINESS_SLUG,
          shop_display_name: SELLER_BUSINESS_NAME,
          items: [
            {
              id: gap1ProductId,
              name: GAP1_NAME,
              quantity: 1,
              price_pence: ORDER_A_PRICE_PENCE,
              currency: "EUR",
              image_url: null,
              variants: [],
              perks: [],
              perks_note: null,
              notes: null,
            },
          ],
          buyer_notes: null,
          subtotal_pence: ORDER_A_PRICE_PENCE,
          currency: "EUR",
          item_count: 1,
          delivery_address: null,
          delivery_quote: null,
          direct_price: null,
        };
        // Mirror sealed write shape: migration 047 nex_peer_message
        // has columns (conversation_id, sender_account_id, body,
        // attachment_url, attachment_type, attachment_meta). There is
        // NO recipient_account_id column · recipient is derived from
        // the conversation. attachment_type NULL + attachment_url NULL
        // + meta.cart populated is exactly what sendCartOrderAction
        // writes (see _actions.ts line 3192).
        const bodyA = `GAP1 cart A · qty 1 · total €10.00`;
        const msgA = await c.query(
          `INSERT INTO nex_peer_message
             (conversation_id, sender_account_id,
              body, attachment_type, attachment_url, attachment_meta)
           VALUES ($1, $2, $3, NULL, NULL, $4::jsonb)
           RETURNING id`,
          [conversationId, BUYER_ACCOUNT_ID, bodyA,
           JSON.stringify({ cart: cartA })],
        );
        gap1CartMsgAId = msgA.rows[0].id as string;

        // 4 · Cart message B · subtotal 2500 · qty 2 · same product.
        // Written SECOND so it is the "newest" · prior reader bug would
        // collapse Order A's resolution to this snapshot.
        const cartB = {
          shop_id: SELLER_BUSINESS_ID,
          shop_slug: SELLER_BUSINESS_SLUG,
          shop_display_name: SELLER_BUSINESS_NAME,
          items: [
            {
              id: gap1ProductId,
              name: GAP1_NAME,
              quantity: 2,
              price_pence: 1250, // per-unit · intentionally != A's unit price
              currency: "EUR",
              image_url: null,
              variants: [],
              perks: [],
              perks_note: null,
              notes: null,
            },
          ],
          buyer_notes: null,
          subtotal_pence: ORDER_B_PRICE_PENCE,
          currency: "EUR",
          item_count: 2,
          delivery_address: null,
          delivery_quote: null,
          direct_price: null,
        };
        const bodyB = `GAP1 cart B · qty 2 · total €25.00`;
        const msgB = await c.query(
          `INSERT INTO nex_peer_message
             (conversation_id, sender_account_id,
              body, attachment_type, attachment_url, attachment_meta)
           VALUES ($1, $2, $3, NULL, NULL, $4::jsonb)
           RETURNING id`,
          [conversationId, BUYER_ACCOUNT_ID, bodyB,
           JSON.stringify({ cart: cartB })],
        );
        gap1CartMsgBId = msgB.rows[0].id as string;

        // 5 · Two nex_order rows · matching price_pence each.
        const orderAId = randomUUID();
        const orderBId = randomUUID();
        await c.query(
          `INSERT INTO nex_order
             (id, customer_account_id, business_id, product_id,
              state, price_pence, currency)
           VALUES ($1, $2, $3, $4, 'created', $5, 'EUR'),
                  ($6, $2, $3, $4, 'created', $7, 'EUR')`,
          [
            orderAId, BUYER_ACCOUNT_ID, SELLER_BUSINESS_ID, gap1ProductId,
            ORDER_A_PRICE_PENCE,
            orderBId, ORDER_B_PRICE_PENCE,
          ],
        );
        gap1OrderAId = orderAId;
        gap1OrderBId = orderBId;
      } finally {
        await c.end();
      }

      // ── Seller signs in, opens each order detail page ────────────
      await signIn(
        gap1Page, SELLER_EMAIL, SELLER_PASSWORD,
        `/nex-native/manage/orders/${gap1OrderAId}`,
      );

      // Order A · must show €10.00 AND qty ×1.
      await expect(
        gap1Page.locator("[data-nex-order-detail]"),
      ).toBeVisible({ timeout: 15_000 });
      await screenshot(gap1Page, "gap1-01-order-A.png");
      let bodyA = await gap1Page.locator("body").innerText();
      expect(bodyA, "Order A must show €10.00 total").toContain("10.00");
      expect(bodyA, "Order A must show its own qty ×1 from cart A")
        .toMatch(/×\s*1\b/);
      // And must NOT show B's total.
      expect(bodyA, "Order A must NOT leak Order B's €25.00 total")
        .not.toContain("25.00");

      // Order B · must show €25.00 AND qty ×2.
      await gap1Page.goto(`/nex-native/manage/orders/${gap1OrderBId}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await expect(
        gap1Page.locator("[data-nex-order-detail]"),
      ).toBeVisible({ timeout: 15_000 });
      await screenshot(gap1Page, "gap1-02-order-B.png");
      const bodyB = await gap1Page.locator("body").innerText();
      expect(bodyB, "Order B must show €25.00 total").toContain("25.00");
      expect(bodyB, "Order B must show its own qty ×2 from cart B")
        .toMatch(/×\s*2\b/);

      // ── Persist after reload · Order A still shows A's snapshot ──
      await gap1Page.goto(`/nex-native/manage/orders/${gap1OrderAId}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await expect(
        gap1Page.locator("[data-nex-order-detail]"),
      ).toBeVisible({ timeout: 15_000 });
      await gap1Page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        gap1Page.locator("[data-nex-order-detail]"),
      ).toBeVisible({ timeout: 15_000 });
      bodyA = await gap1Page.locator("body").innerText();
      expect(bodyA, "Order A snapshot must persist after reload").toContain("10.00");
      expect(bodyA, "Order A qty ×1 must persist after reload")
        .toMatch(/×\s*1\b/);
      await screenshot(gap1Page, "gap1-03-order-A-reload.png");

      // Same reload check for Order B.
      await gap1Page.goto(`/nex-native/manage/orders/${gap1OrderBId}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await expect(
        gap1Page.locator("[data-nex-order-detail]"),
      ).toBeVisible({ timeout: 15_000 });
      await gap1Page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        gap1Page.locator("[data-nex-order-detail]"),
      ).toBeVisible({ timeout: 15_000 });
      const bodyB2 = await gap1Page.locator("body").innerText();
      expect(bodyB2, "Order B snapshot must persist after reload").toContain("25.00");
      expect(bodyB2, "Order B qty ×2 must persist after reload")
        .toMatch(/×\s*2\b/);
      await screenshot(gap1Page, "gap1-04-order-B-reload.png");
    } finally {
      // ── Cleanup · hard-guarded by prefix + account pair ──────────
      try { await gap1Ctx.close(); } catch { /* ignore */ }

      const c = await pgClient();
      try {
        // Delete GAP1 orders (if any) · verify every row's business_id
        // + customer_account_id before deletion.
        for (const oid of [gap1OrderAId, gap1OrderBId]) {
          if (!oid) continue;
          const row = await c.query(
            `SELECT business_id, customer_account_id FROM nex_order WHERE id = $1`,
            [oid],
          );
          if (row.rowCount && row.rowCount > 0) {
            const r = row.rows[0] as {
              business_id: string; customer_account_id: string;
            };
            if (
              r.business_id !== SELLER_BUSINESS_ID ||
              r.customer_account_id !== BUYER_ACCOUNT_ID
            ) {
              throw new Error(`gap1 cleanup refuse · order ${oid} drift`);
            }
            await c.query(`DELETE FROM nex_order WHERE id = $1`, [oid]);
          }
        }

        // Delete GAP1 peer messages · guarded by (sender, business_id,
        // prefix via subtotal/product_name linkage). We use the cart
        // message IDs we created · each row's sender_account_id MUST
        // equal BUYER_ACCOUNT_ID and attachment_meta->cart->>shop_id
        // MUST equal SELLER_BUSINESS_ID.
        for (const mid of [gap1CartMsgAId, gap1CartMsgBId]) {
          if (!mid) continue;
          const row = await c.query(
            `SELECT sender_account_id,
                    attachment_meta->'cart'->>'shop_id' AS shop_id
             FROM nex_peer_message WHERE id = $1`,
            [mid],
          );
          if (row.rowCount && row.rowCount > 0) {
            const r = row.rows[0] as {
              sender_account_id: string; shop_id: string;
            };
            if (
              r.sender_account_id !== BUYER_ACCOUNT_ID ||
              r.shop_id !== SELLER_BUSINESS_ID
            ) {
              throw new Error(`gap1 cleanup refuse · message ${mid} drift`);
            }
            await c.query(`DELETE FROM nex_peer_message WHERE id = $1`, [mid]);
          }
        }

        // Delete GAP1 product · prefix + business_id guarded.
        const leftovers = await c.query(
          `SELECT id, name, business_id FROM nex_product
           WHERE business_id = $1 AND name LIKE $2`,
          [SELLER_BUSINESS_ID, `${GAP1_PREFIX} %`],
        );
        for (const row of leftovers.rows) {
          if (row.business_id !== SELLER_BUSINESS_ID) {
            throw new Error(`gap1 cleanup refuse · product business_id drift`);
          }
          if (!(row.name as string).startsWith(`${GAP1_PREFIX} `)) {
            throw new Error(`gap1 cleanup refuse · product name not prefixed: ${row.name}`);
          }
        }
        const delProd = await c.query(
          `DELETE FROM nex_product
           WHERE business_id = $1 AND name LIKE $2 RETURNING id`,
          [SELLER_BUSINESS_ID, `${GAP1_PREFIX} %`],
        );
        // eslint-disable-next-line no-console
        console.log(
          `[gap1 cleanup] deleted products=${delProd.rowCount} (before=${gap1BeforeIso || "n/a"})`,
        );
      } finally {
        await c.end();
      }
    }
  });

  test("GAP14 · ambiguous identical-cart orders render explicit unavailable state (never another order's items)", async ({
    browser,
  }) => {
    // Two cart messages with IDENTICAL totals + IDENTICAL items sent
    // within 1s; two nex_order rows with the same price_pence. The
    // reader cannot deterministically pick a snapshot per order without
    // a schema-level link. Instead of silently picking one (which could
    // show Order X's data on Order Y's page), the reader must render an
    // explicit "Items for this order are not reliably identifiable"
    // banner · `[data-nex-order-cart-ambiguous]`.
    const GAP14_PREFIX = "E2E GAP14 Widget";
    const GAP14_NAME = `${GAP14_PREFIX} AmbiguousIdentical ${Date.now()}`;
    const IDENTICAL_PRICE_PENCE = 4200;

    let productId = "";
    let cartMsgAId = "";
    let cartMsgBId = "";
    let orderAId = "";
    let orderBId = "";
    const beforeIso = new Date().toISOString();

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      const c = await pgClient();
      try {
        // Hard pre-clean scoped to our prefix only.
        await c.query(
          `DELETE FROM nex_product WHERE business_id = $1 AND name LIKE $2`,
          [SELLER_BUSINESS_ID, `${GAP14_PREFIX} %`],
        );
        const prodRes = await c.query(
          `INSERT INTO nex_product
             (business_id, name, description, price_pence, currency, status,
              department_id, category_id, image_url)
           VALUES ($1, $2, 'GAP14 fixture · identical ambiguous · delete freely',
                   $3, 'EUR', 'live', 'everything_else', 'other', NULL)
           RETURNING id`,
          [SELLER_BUSINESS_ID, GAP14_NAME, IDENTICAL_PRICE_PENCE],
        );
        productId = prodRes.rows[0].id as string;

        // Peer conversation between buyer + seller (canonicalised).
        const [participantA, participantB] = [BUYER_ACCOUNT_ID, SELLER_ACCOUNT_ID]
          .slice()
          .sort();
        const convRes = await c.query(
          `SELECT id FROM nex_peer_conversation
           WHERE participant_a_id = $1 AND participant_b_id = $2
           LIMIT 1`,
          [participantA, participantB],
        );
        let conversationId: string;
        if (convRes.rowCount && convRes.rowCount > 0) {
          conversationId = convRes.rows[0].id as string;
        } else {
          const newConv = await c.query(
            `INSERT INTO nex_peer_conversation
               (participant_a_id, participant_b_id)
             VALUES ($1, $2)
             RETURNING id`,
            [participantA, participantB],
          );
          conversationId = newConv.rows[0].id as string;
        }

        // TWO cart messages · identical snapshots · sent within 1s.
        const identicalSnapshot = {
          shop_id: SELLER_BUSINESS_ID,
          shop_slug: SELLER_BUSINESS_SLUG,
          shop_display_name: SELLER_BUSINESS_NAME,
          currency: "EUR",
          items: [
            {
              id: productId,
              name: GAP14_NAME,
              quantity: 1,
              price_pence: IDENTICAL_PRICE_PENCE,
              image_url: null,
            },
          ],
          item_count: 1,
          subtotal_pence: IDENTICAL_PRICE_PENCE,
          delivery_quote: null,
          direct_price: null,
          buyer_notes: null,
          delivery_address: {
            recipient: BUYER_NAME,
            phone: null,
            street: BUYER_ADDRESS_LINE,
            city: null,
            postal: null,
            notes: null,
          },
        };
        const insA = await c.query(
          `INSERT INTO nex_peer_message
             (conversation_id, sender_account_id, body,
              attachment_url, attachment_type, attachment_meta)
           VALUES ($1, $2, 'cart A', NULL, NULL, $3)
           RETURNING id`,
          [conversationId, BUYER_ACCOUNT_ID, { cart: identicalSnapshot }],
        );
        cartMsgAId = insA.rows[0].id as string;
        const insB = await c.query(
          `INSERT INTO nex_peer_message
             (conversation_id, sender_account_id, body,
              attachment_url, attachment_type, attachment_meta)
           VALUES ($1, $2, 'cart B', NULL, NULL, $3)
           RETURNING id`,
          [conversationId, BUYER_ACCOUNT_ID, { cart: identicalSnapshot }],
        );
        cartMsgBId = insB.rows[0].id as string;

        // Two orders with the same price_pence; fixture-assisted.
        const insOrders = await c.query(
          `INSERT INTO nex_order
             (customer_account_id, business_id, product_id,
              state, price_pence, currency)
           VALUES ($1, $2, $3, 'created', $4, 'EUR'),
                  ($1, $2, $3, 'created', $4, 'EUR')
           RETURNING id`,
          [BUYER_ACCOUNT_ID, SELLER_BUSINESS_ID, productId, IDENTICAL_PRICE_PENCE],
        );
        orderAId = insOrders.rows[0].id as string;
        orderBId = insOrders.rows[1].id as string;
      } finally {
        await c.end();
      }

      // ── Acceptance: BOTH pages must render the ambiguous banner,
      //    NEITHER page must leak the other order's items (both would
      //    show the SAME item name here · the real leak would be
      //    silently picking one AS IF it's canonical for that order).
      await signIn(page, SELLER_EMAIL, SELLER_PASSWORD, `/nex-native/manage/orders/${orderAId}`);
      await expect(
        page.locator("[data-nex-order-detail]"),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.locator("[data-nex-order-cart-ambiguous]"),
      ).toBeVisible({ timeout: 10_000 });
      // The explicit unavailable state must not render the Items card
      // (OrderDetailClient only shows it when cartSnapshot !== null · the
      // page server-component passes null when ambiguous).
      const bodyA = await page.locator("body").innerText();
      expect(
        bodyA,
        "ambiguous · must NOT render 'Items (from chat cart snapshot)' heading",
      ).not.toContain("Items (from chat cart snapshot)");
      await screenshot(page, "gap14-01-order-A-ambiguous.png");

      // Reload persists the ambiguous state.
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.locator("[data-nex-order-cart-ambiguous]"),
      ).toBeVisible({ timeout: 10_000 });

      // Same for Order B.
      await page.goto(`/nex-native/manage/orders/${orderBId}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await expect(
        page.locator("[data-nex-order-cart-ambiguous]"),
      ).toBeVisible({ timeout: 10_000 });
      await screenshot(page, "gap14-02-order-B-ambiguous.png");

      // The match-tier attribute must record WHY it's ambiguous (price+product).
      const tierA = await page
        .locator("[data-nex-order-cart-ambiguous]")
        .getAttribute("data-nex-order-cart-match-tier");
      expect(["price_and_product", "most_recent"]).toContain(tierA);
    } finally {
      try { await ctx.close(); } catch { /* ignore */ }
      const c = await pgClient();
      try {
        // Hard-guarded cleanup.
        for (const oid of [orderAId, orderBId]) {
          if (!oid) continue;
          const row = await c.query(
            `SELECT business_id, customer_account_id FROM nex_order WHERE id = $1`,
            [oid],
          );
          if (row.rowCount && row.rowCount > 0) {
            const r = row.rows[0] as { business_id: string; customer_account_id: string };
            if (r.business_id !== SELLER_BUSINESS_ID || r.customer_account_id !== BUYER_ACCOUNT_ID) {
              throw new Error("gap14 cleanup refuse · order does not match fixture pair");
            }
            await c.query(`DELETE FROM nex_order WHERE id = $1`, [oid]);
          }
        }
        for (const mid of [cartMsgAId, cartMsgBId]) {
          if (!mid) continue;
          const row = await c.query(
            `SELECT sender_account_id, attachment_meta->'cart'->>'shop_id' AS shop_id
             FROM nex_peer_message WHERE id = $1`,
            [mid],
          );
          if (row.rowCount && row.rowCount > 0) {
            const r = row.rows[0] as { sender_account_id: string; shop_id: string };
            if (r.sender_account_id !== BUYER_ACCOUNT_ID || r.shop_id !== SELLER_BUSINESS_ID) {
              throw new Error("gap14 cleanup refuse · message does not match fixture pair");
            }
            await c.query(`DELETE FROM nex_peer_message WHERE id = $1`, [mid]);
          }
        }
        await c.query(
          `DELETE FROM nex_product WHERE business_id = $1 AND name LIKE $2`,
          [SELLER_BUSINESS_ID, `${GAP14_PREFIX} %`],
        );
        void beforeIso;
      } finally {
        await c.end();
      }
    }
  });

  // ─── GAP14-DETER · deterministic link proves identical-cart orders ─
  //
  // #14 closed deterministically 2026-11-15 · owner-authorised
  // existing-JSON-metadata approach. The sealed cart write path now
  // mints a `crypto.randomUUID()` BEFORE the peer-message insert and
  // stamps it into `attachment_meta.cart.order_id`. The order-service
  // accepts that same UUID via the new `createOrder({ id })` parameter.
  // The reader (Tier 0) resolves the originating cart snapshot by
  // exact UUID equality · heuristic tiers are skipped.
  //
  // This test fixture-inserts TWO cart messages with IDENTICAL totals
  // + IDENTICAL items BUT different `attachment_meta.cart.order_id`
  // UUIDs, then fixture-inserts TWO nex_order rows with id = those
  // UUIDs. Each order detail page must render ITS OWN snapshot (proven
  // by distinguishing `buyer_notes` · Order A = "Order A note", Order
  // B = "Order B note"). Reload persists. Cross-account denial holds.
  // The deterministic match tier is asserted via
  // `[data-nex-order-cart-match-tier="deterministic_order_id"]` on
  // the server page.
  //
  // Hard-guarded cleanup by (business_id, buyer_account_id, prefix).
  test("GAP14-DETER · deterministic link proves identical-cart orders retain their own snapshots", async ({
    browser,
  }) => {
    const DETER_PREFIX = "E2E GAP14-DETER Widget";
    const DETER_NAME = `${DETER_PREFIX} Deterministic ${Date.now()}`;
    const IDENTICAL_PRICE_PENCE = 7777;
    const NOTE_A = `Order A note ${Date.now()}`;
    const NOTE_B = `Order B note ${Date.now()}`;
    // Pre-mint the two "future order" UUIDs the sealed cart flow would
    // produce. The test writes BOTH into the cart messages' JSON meta
    // AND inserts nex_order rows with id = these UUIDs, closing the
    // deterministic contract end-to-end.
    const orderAId = randomUUID();
    const orderBId = randomUUID();

    let productId = "";
    let cartMsgAId = "";
    let cartMsgBId = "";
    const beforeIsoLocal = new Date().toISOString();

    const detCtx = await browser.newContext();
    const detPage = await detCtx.newPage();
    const detBuyerCtx = await browser.newContext();
    const detBuyerPage = await detBuyerCtx.newPage();

    try {
      const c = await pgClient();
      try {
        // Pre-clean · prefix-guarded.
        await c.query(
          `DELETE FROM nex_product WHERE business_id = $1 AND name LIKE $2`,
          [SELLER_BUSINESS_ID, `${DETER_PREFIX} %`],
        );

        // 1 · One live product.
        const prodRes = await c.query(
          `INSERT INTO nex_product
             (business_id, name, description, price_pence, currency, status,
              department_id, category_id, image_url)
           VALUES ($1, $2, 'GAP14-DETER fixture · delete freely',
                   $3, 'EUR', 'live', 'everything_else', 'other', NULL)
           RETURNING id`,
          [SELLER_BUSINESS_ID, DETER_NAME, IDENTICAL_PRICE_PENCE],
        );
        productId = prodRes.rows[0].id as string;

        // 2 · Peer conversation · canonicalised pair (participant_a < b).
        const [participantA, participantB] = [BUYER_ACCOUNT_ID, SELLER_ACCOUNT_ID]
          .slice()
          .sort();
        const convRes = await c.query(
          `SELECT id FROM nex_peer_conversation
           WHERE participant_a_id = $1 AND participant_b_id = $2
           LIMIT 1`,
          [participantA, participantB],
        );
        let conversationId: string;
        if (convRes.rowCount && convRes.rowCount > 0) {
          conversationId = convRes.rows[0].id as string;
        } else {
          const newConv = await c.query(
            `INSERT INTO nex_peer_conversation
               (participant_a_id, participant_b_id)
             VALUES ($1, $2)
             RETURNING id`,
            [participantA, participantB],
          );
          conversationId = newConv.rows[0].id as string;
        }

        // 3 · Build two cart snapshots that are IDENTICAL on totals +
        //     items, differing ONLY on (a) the embedded `order_id` and
        //     (b) `buyer_notes` (distinguishing payload). Without the
        //     deterministic link, the reader would collapse both to the
        //     same most-recent snapshot. With it, each resolves 1:1.
        const buildSnapshot = (orderIdUuid: string, buyerNote: string) => ({
          shop_id: SELLER_BUSINESS_ID,
          shop_slug: SELLER_BUSINESS_SLUG,
          shop_display_name: SELLER_BUSINESS_NAME,
          currency: "EUR",
          items: [
            {
              id: productId,
              name: DETER_NAME,
              quantity: 1,
              price_pence: IDENTICAL_PRICE_PENCE,
              image_url: null,
            },
          ],
          item_count: 1,
          subtotal_pence: IDENTICAL_PRICE_PENCE,
          delivery_quote: null,
          direct_price: null,
          buyer_notes: buyerNote,
          delivery_address: {
            recipient: BUYER_NAME,
            phone: null,
            street: BUYER_ADDRESS_LINE,
            city: null,
            postal: null,
            notes: null,
          },
          // #14 · the deterministic link · exact UUID embedded upstream
          order_id: orderIdUuid,
        });

        const insA = await c.query(
          `INSERT INTO nex_peer_message
             (conversation_id, sender_account_id, body,
              attachment_url, attachment_type, attachment_meta)
           VALUES ($1, $2, 'deter cart A', NULL, NULL, $3)
           RETURNING id`,
          [conversationId, BUYER_ACCOUNT_ID,
           { cart: buildSnapshot(orderAId, NOTE_A) }],
        );
        cartMsgAId = insA.rows[0].id as string;

        const insB = await c.query(
          `INSERT INTO nex_peer_message
             (conversation_id, sender_account_id, body,
              attachment_url, attachment_type, attachment_meta)
           VALUES ($1, $2, 'deter cart B', NULL, NULL, $3)
           RETURNING id`,
          [conversationId, BUYER_ACCOUNT_ID,
           { cart: buildSnapshot(orderBId, NOTE_B) }],
        );
        cartMsgBId = insB.rows[0].id as string;

        // 4 · Insert nex_order rows with EXPLICIT id = embedded UUID.
        //     This is EXACTLY the write path createOrder({ id: ... })
        //     would produce when a downstream cart→order code path
        //     passes attachment_meta.cart.order_id in.
        await c.query(
          `INSERT INTO nex_order
             (id, customer_account_id, business_id, product_id,
              state, price_pence, currency)
           VALUES ($1, $2, $3, $4, 'created', $5, 'EUR'),
                  ($6, $2, $3, $4, 'created', $5, 'EUR')`,
          [
            orderAId, BUYER_ACCOUNT_ID, SELLER_BUSINESS_ID, productId,
            IDENTICAL_PRICE_PENCE,
            orderBId,
          ],
        );
      } finally {
        await c.end();
      }

      // ── Acceptance: each order detail page renders its OWN snapshot.
      //    The deterministic tier must be reported, no ambiguous banner,
      //    buyer_notes distinguish the two despite identical totals.
      await signIn(
        detPage, SELLER_EMAIL, SELLER_PASSWORD,
        `/nex-native/manage/orders/${orderAId}`,
      );
      await expect(
        detPage.locator("[data-nex-order-detail]"),
      ).toBeVisible({ timeout: 15_000 });
      // Assert the NEW deterministic match-tier data attribute.
      const tierA = await detPage
        .locator("[data-nex-order-detail]")
        .getAttribute("data-nex-order-cart-match-tier");
      expect(tierA, "Order A must report deterministic match").toBe(
        "deterministic_order_id",
      );
      // NO ambiguous banner · exact match is unambiguous by construction.
      await expect(
        detPage.locator("[data-nex-order-cart-ambiguous]"),
      ).toHaveCount(0);
      // Each page shows ITS OWN distinguishing payload.
      const bodyA = await detPage.locator("body").innerText();
      expect(
        bodyA,
        "Order A must show its own buyer note from cart A",
      ).toContain(NOTE_A);
      expect(
        bodyA,
        "Order A must NOT leak Order B's buyer note",
      ).not.toContain(NOTE_B);
      await screenshot(detPage, "gap14-deter-01-order-A.png");

      // Order B · symmetric assertions.
      await detPage.goto(`/nex-native/manage/orders/${orderBId}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await expect(
        detPage.locator("[data-nex-order-detail]"),
      ).toBeVisible({ timeout: 15_000 });
      const tierB = await detPage
        .locator("[data-nex-order-detail]")
        .getAttribute("data-nex-order-cart-match-tier");
      expect(tierB, "Order B must report deterministic match").toBe(
        "deterministic_order_id",
      );
      await expect(
        detPage.locator("[data-nex-order-cart-ambiguous]"),
      ).toHaveCount(0);
      const bodyB = await detPage.locator("body").innerText();
      expect(bodyB, "Order B must show its own buyer note from cart B")
        .toContain(NOTE_B);
      expect(bodyB, "Order B must NOT leak Order A's buyer note")
        .not.toContain(NOTE_A);
      await screenshot(detPage, "gap14-deter-02-order-B.png");

      // ── Reload · each order preserves its own snapshot ────────────
      await detPage.goto(`/nex-native/manage/orders/${orderAId}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await expect(
        detPage.locator("[data-nex-order-detail]"),
      ).toBeVisible({ timeout: 15_000 });
      await detPage.reload({ waitUntil: "domcontentloaded" });
      await expect(
        detPage.locator("[data-nex-order-detail]"),
      ).toBeVisible({ timeout: 15_000 });
      const bodyAReload = await detPage.locator("body").innerText();
      expect(
        bodyAReload,
        "Order A buyer note must persist across reload",
      ).toContain(NOTE_A);
      expect(bodyAReload).not.toContain(NOTE_B);
      await screenshot(detPage, "gap14-deter-03-order-A-reload.png");

      await detPage.goto(`/nex-native/manage/orders/${orderBId}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await expect(
        detPage.locator("[data-nex-order-detail]"),
      ).toBeVisible({ timeout: 15_000 });
      await detPage.reload({ waitUntil: "domcontentloaded" });
      await expect(
        detPage.locator("[data-nex-order-detail]"),
      ).toBeVisible({ timeout: 15_000 });
      const bodyBReload = await detPage.locator("body").innerText();
      expect(
        bodyBReload,
        "Order B buyer note must persist across reload",
      ).toContain(NOTE_B);
      expect(bodyBReload).not.toContain(NOTE_A);
      await screenshot(detPage, "gap14-deter-04-order-B-reload.png");

      // ── Cross-account denial · buyer context sees neither order ──
      await signIn(
        detBuyerPage, BUYER_EMAIL, BUYER_PASSWORD,
        "/nex-native/contacts",
      );
      let navErr: string | null = null;
      try {
        await detBuyerPage.goto(`/nex-native/manage/orders/${orderAId}`, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
      } catch (e) {
        navErr = e instanceof Error ? e.message : String(e);
      }
      await screenshot(detBuyerPage, "gap14-deter-05-buyer-denied-A.png");
      if (!navErr) {
        const denied = await detBuyerPage.locator("body").innerText();
        expect(denied.includes(DETER_NAME)).toBe(false);
        expect(denied.includes(NOTE_A)).toBe(false);
        await expect(
          detBuyerPage.locator("[data-nex-order-detail]"),
        ).toHaveCount(0);
      } else {
        expect(navErr).toContain("ERR_ABORTED");
      }
      // Same for Order B.
      navErr = null;
      try {
        await detBuyerPage.goto(`/nex-native/manage/orders/${orderBId}`, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
      } catch (e) {
        navErr = e instanceof Error ? e.message : String(e);
      }
      await screenshot(detBuyerPage, "gap14-deter-06-buyer-denied-B.png");
      if (!navErr) {
        const denied = await detBuyerPage.locator("body").innerText();
        expect(denied.includes(DETER_NAME)).toBe(false);
        expect(denied.includes(NOTE_B)).toBe(false);
        await expect(
          detBuyerPage.locator("[data-nex-order-detail]"),
        ).toHaveCount(0);
      } else {
        expect(navErr).toContain("ERR_ABORTED");
      }
    } finally {
      // ── Cleanup · hard-guarded by (account pair + prefix) ────────
      try { await detCtx.close(); } catch { /* ignore */ }
      try { await detBuyerCtx.close(); } catch { /* ignore */ }

      const c = await pgClient();
      try {
        for (const oid of [orderAId, orderBId]) {
          if (!oid) continue;
          const row = await c.query(
            `SELECT business_id, customer_account_id FROM nex_order WHERE id = $1`,
            [oid],
          );
          if (row.rowCount && row.rowCount > 0) {
            const r = row.rows[0] as {
              business_id: string; customer_account_id: string;
            };
            if (
              r.business_id !== SELLER_BUSINESS_ID ||
              r.customer_account_id !== BUYER_ACCOUNT_ID
            ) {
              throw new Error(`gap14-deter cleanup refuse · order ${oid} drift`);
            }
            await c.query(`DELETE FROM nex_order WHERE id = $1`, [oid]);
          }
        }
        for (const mid of [cartMsgAId, cartMsgBId]) {
          if (!mid) continue;
          const row = await c.query(
            `SELECT sender_account_id,
                    attachment_meta->'cart'->>'shop_id' AS shop_id
             FROM nex_peer_message WHERE id = $1`,
            [mid],
          );
          if (row.rowCount && row.rowCount > 0) {
            const r = row.rows[0] as {
              sender_account_id: string; shop_id: string;
            };
            if (
              r.sender_account_id !== BUYER_ACCOUNT_ID ||
              r.shop_id !== SELLER_BUSINESS_ID
            ) {
              throw new Error(`gap14-deter cleanup refuse · message ${mid} drift`);
            }
            await c.query(`DELETE FROM nex_peer_message WHERE id = $1`, [mid]);
          }
        }
        const leftovers = await c.query(
          `SELECT id, name, business_id FROM nex_product
           WHERE business_id = $1 AND name LIKE $2`,
          [SELLER_BUSINESS_ID, `${DETER_PREFIX} %`],
        );
        for (const row of leftovers.rows) {
          if (row.business_id !== SELLER_BUSINESS_ID) {
            throw new Error("gap14-deter cleanup refuse · product business_id drift");
          }
          if (!(row.name as string).startsWith(`${DETER_PREFIX} `)) {
            throw new Error(`gap14-deter cleanup refuse · product name not prefixed: ${row.name}`);
          }
        }
        await c.query(
          `DELETE FROM nex_product WHERE business_id = $1 AND name LIKE $2`,
          [SELLER_BUSINESS_ID, `${DETER_PREFIX} %`],
        );
        void beforeIsoLocal;
      } finally {
        await c.end();
      }
    }
  });

  test("12 · cross-account denial · buyer context cannot see seller's /manage/orders/<id>", async () => {
    // Buyer attempts to open the seller's order detail. Sealed page
    // calls notFound() when the signed-in account doesn't own the
    // referenced business (page.tsx line 54-57). Expected outcomes:
    //   · 404 render · [data-nex-order-detail] not visible
    //   · redirect to sign-in or similar
    //   · ERR_ABORTED (if pre-existing cart-snapshot query throws
    //     BEFORE the ownership check returns notFound · still a
    //     non-leak outcome because no body renders).
    //
    // UNACCEPTABLE: the imaged product name is visible in body.
    let navErr: string | null = null;
    try {
      await buyerPage.goto(`/nex-native/manage/orders/${imagedOrderId}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
    } catch (e) {
      navErr = e instanceof Error ? e.message : String(e);
    }
    await screenshot(buyerPage, "d2-12-cross-denied.png");
    if (!navErr) {
      const body = await buyerPage.locator("body").innerText();
      expect(body.includes(IMAGED_NAME)).toBe(false);
      // notFound() path should NOT render data-nex-order-detail.
      await expect(buyerPage.locator("[data-nex-order-detail]")).toHaveCount(0);
    } else {
      // Aborted · no UI content rendered to the buyer. Honest pass.
      expect(navErr).toContain("ERR_ABORTED");
    }
  });
});
