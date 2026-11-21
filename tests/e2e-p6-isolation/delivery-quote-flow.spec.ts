// tests/e2e-p6-isolation/delivery-quote-flow.spec.ts
//
// Lane F · delivery-quote per-ring verification · browser e2e · 2026-11-21.
// -----------------------------------------------------------------
// Companion to the offline F-wire vitest
// (src/app/nex-native/__tests__/send-cart-order-f-wire.test.ts):
//
//   · F-wire proves classifier + verification logic with mocked
//     Supabase/account/business services. No HTTP boundary, no real
//     DB round-trip.
//   · THIS spec drives the REAL Next.js server action over HTTP
//     against the sandbox DB, with a REAL per-ring product and REAL
//     `nex_business.location_lat/lng` columns populated via SQL.
//
// What this spec proves at the browser boundary:
//   · F-E2E-1 · in-range + authentic ring fare → action accepts,
//     redirects to /chat/peer/<seller>?cart_sent=1
//   · F-E2E-2 · buyer destination beyond the largest ring → action
//     refuses with "outside the shop's delivery range"
//   · F-E2E-3 · tampered (lower) fare → action refuses with "rate
//     card" message
//
// Payload strategy
// -----------------------------------------------------------------
// The cart UI's checkout sheet (src/app/nex-native/cart/_checkout-
// sheet.tsx) composes `cart_payload` as a React useMemo but does NOT
// surface a `delivery_quote` field, nor does it include `lat`/`lng`
// on `delivery_address`. Those fields are what the Lane F server
// code reads (see _actions.ts § "G3-Server · 2026-11-18 · OPTIONAL
// buyer-destination coordinate parse" and the subsequent per-ring
// branch). To exercise the per-ring branch end-to-end we patch the
// hidden `<input name="cart_payload">` DOM value with a crafted JSON
// just before clicking the submit button · the React synthetic event
// doesn't re-render between evaluate() and click(), so the browser
// submits the patched payload.
//
// This is NOT a regression on the UI: Lane F's payment is to PROVE
// the server action enforces the F-A classification + fare match
// over a real HTTP boundary. The UI is the authentication shell; the
// server is the gate. We are testing the gate.
//
// Honest safety fence
// -----------------------------------------------------------------
//   · Sandbox DB only (kdstoyyeygcopkogqsyv). Prod ref refused.
//   · Uses the existing CK5 disposable accounts (A=seller, B=buyer).
//     Hard-refuses Hammerex/Rosa IDs.
//   · Writes to one nex_product row + sets nex_business.location_lat
//     /lng on the seller business. Cleanup restores lat/lng to NULL
//     and deletes the product in afterAll.

import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import pkg from "pg";
const { Client: PG } = pkg;

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
  throw new Error("delivery-quote-flow refuses · production ref");
}
if (!DB_URL.includes(SANDBOX_REF)) {
  throw new Error(
    `delivery-quote-flow refuses · not sandbox ${SANDBOX_REF}`,
  );
}

const CK5 = ".env.playwright.vault-ck5";
const SELLER_ACCOUNT_ID = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const SELLER_BUSINESS_ID = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_BUSINESS_ID");
const SELLER_BUSINESS_SLUG = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_BUSINESS_SLUG");
const SELLER_BUSINESS_NAME = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_BUSINESS_NAME");
const BUYER_EMAIL = fromEnvFile(CK5, "PLAYWRIGHT_CK5_B_EMAIL");
const BUYER_PASSWORD = fromEnvFile(CK5, "PLAYWRIGHT_CK5_B_PASSWORD");
const BUYER_ACCOUNT_ID = fromEnvFile(CK5, "PLAYWRIGHT_CK5_B_ACCOUNT_ID");

for (const [k, v] of Object.entries({
  SELLER_ACCOUNT_ID,
  SELLER_BUSINESS_ID,
  SELLER_BUSINESS_SLUG,
  SELLER_BUSINESS_NAME,
  BUYER_EMAIL,
  BUYER_PASSWORD,
  BUYER_ACCOUNT_ID,
})) {
  if (!v) throw new Error(`delivery-quote-flow · missing ${k}`);
}

const PROTECTED_RE = new Set<string>([
  "11111111-1111-4111-8111-111111111111", // Hammerex
  "11111111-1111-4111-8111-111111111113", // Rosa
]);
for (const id of [SELLER_ACCOUNT_ID, BUYER_ACCOUNT_ID]) {
  if (PROTECTED_RE.has(id)) {
    throw new Error(
      `delivery-quote-flow refuses · protected identity ${id}`,
    );
  }
}

// Jakarta anchor · reused across the F-wire vitest. Keeps the
// authoritative distance deterministic (ring thresholds are at
// integer km).
const SELLER_LAT = -6.2088;
const SELLER_LNG = 106.8456;

// Close buyer destination · ~1.57 km straight-line from the seller.
// Fits inside the 5 km ring.
const BUYER_LAT_CLOSE = -6.22;
const BUYER_LNG_CLOSE = 106.85;

// Far buyer destination · ~55 km straight-line from the seller.
// Outside the 20 km largest ring.
const BUYER_LAT_FAR = -5.7;
const BUYER_LNG_FAR = 106.8456;

const RING_5_PRICE = 15_000; // IDR 15,000
const RING_10_PRICE = 25_000;
const RING_20_PRICE = 40_000;

const PRODUCT_NAME_PREFIX = "E2E LANE-F per-ring";
const STAMP = Date.now().toString(36);
const PRODUCT_NAME = `${PRODUCT_NAME_PREFIX} ${STAMP}`;
const PRICE_PENCE = 100_000;

async function pgClient(): Promise<InstanceType<typeof PG>> {
  const c = new PG({ connectionString: DB_URL });
  await c.connect();
  return c;
}

async function signIn(
  page: Page,
  email: string,
  pw: string,
  next: string,
): Promise<void> {
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

async function seedCart(page: Page, productId: string): Promise<void> {
  await page.evaluate(
    (p) => {
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
        currency: "IDR",
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
    },
    {
      productId,
      shopId: SELLER_BUSINESS_ID,
      shopSlug: SELLER_BUSINESS_SLUG,
      sellerAccountId: SELLER_ACCOUNT_ID,
      shopName: SELLER_BUSINESS_NAME,
      name: PRODUCT_NAME,
      pricePence: PRICE_PENCE,
    },
  );
}

interface PatchedQuote {
  readonly fare_pence: number;
  readonly distance_km: number;
  readonly buyer_lat: number;
  readonly buyer_lng: number;
}

/** Open checkout sheet, fill buyer name (UI validation), patch the
 *  hidden cart_payload to inject the Lane-F fields the UI doesn't
 *  natively surface, then click submit. Returns the landed URL. */
async function submitWithPatchedQuote(
  page: Page,
  productId: string,
  productName: string,
  q: PatchedQuote,
): Promise<URL> {
  await page.goto("/nex-native/cart", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await expect(
    page.locator("section").filter({ hasText: productName }).first(),
  ).toBeVisible({ timeout: 20_000 });

  // Checkout button.
  await page
    .locator("button", { hasText: /^Checkout\s*→$/ })
    .first()
    .click();

  const sheet = page.locator(
    `[data-nex-checkout-sheet="${SELLER_BUSINESS_ID}"]`,
  );
  await expect(sheet).toBeVisible({ timeout: 15_000 });

  // UI-level required field.
  await sheet.locator("#co-name").fill("Lane F Buyer");
  await sheet.locator('input[placeholder="Street + number"]').fill("1 Jl. Lane F");
  await sheet.locator('input[placeholder="City"]').fill("Jakarta");

  // Patch the hidden cart_payload DOM value. React will not re-render
  // between here and the submit click (no reactive dependency
  // changes), so the browser will serialise OUR patched JSON on POST.
  await page.evaluate(
    (patch) => {
      const input = document.querySelector<HTMLInputElement>(
        'input[name="cart_payload"]',
      );
      if (!input) throw new Error("cart_payload hidden input missing");
      const current = JSON.parse(input.value) as Record<string, unknown>;
      // Overwrite delivery_address with the server-shape fields
      // (recipient_name/phone/street/city/country + lat/lng) that
      // the server action reads. The UI uses different field names
      // (buyer_name/line1) which the server action silently coerces
      // to empty; patching here gives the server a complete address.
      current.delivery_address = {
        recipient_name: "Lane F Buyer",
        phone: "+62 000 000 0001",
        street: "1 Jl. Lane F",
        city: "Jakarta",
        country: "ID",
        lat: patch.buyer_lat,
        lng: patch.buyer_lng,
      };
      current.delivery_quote = {
        kind: "estimate",
        fare_pence: patch.fare_pence,
        distance_km: patch.distance_km,
        currency: "IDR",
      };
      input.value = JSON.stringify(current);
    },
    q,
  );

  const submit = sheet.locator('button[type="submit"]');
  await expect(submit).toBeEnabled({ timeout: 10_000 });
  await submit.click();

  // Wait until either /chat/peer/* (success) OR /cart?send_error=...
  // (refusal). Either resolves within a few seconds on a healthy
  // dev server · we allow up to 60s to tolerate first-compile.
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    const u = new URL(page.url());
    if (u.pathname.startsWith("/nex-native/chat/peer/")) break;
    if (u.pathname === "/nex-native/cart" && u.searchParams.size > 0) break;
    await page
      .waitForLoadState("networkidle", { timeout: 2_000 })
      .catch(() => {});
  }
  return new URL(page.url());
}

// ──────────────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

test.describe("Lane F · delivery-quote per-ring verification · browser e2e", () => {
  let productId = "";

  test.beforeAll(async () => {
    const c = await pgClient();
    try {
      // Seller coords · set to Jakarta anchor so distances are
      // deterministic. Guarded by business_id + slug prefix match so
      // we can't accidentally touch a non-fixture row.
      const biz = await c.query(
        `SELECT id, slug FROM nex_business WHERE id = $1`,
        [SELLER_BUSINESS_ID],
      );
      if (biz.rows.length !== 1) {
        throw new Error("seller business row missing · run CK5 seeder first");
      }
      if (!String(biz.rows[0].slug).startsWith("e2e-ck5-seller-shop-")) {
        throw new Error(
          `refuse · seller business slug not disposable: ${biz.rows[0].slug}`,
        );
      }
      await c.query(
        `UPDATE nex_business
            SET location_lat = $2, location_lng = $3
          WHERE id = $1
            AND slug LIKE 'e2e-ck5-seller-shop-%'`,
        [SELLER_BUSINESS_ID, SELLER_LAT, SELLER_LNG],
      );

      // Clean any prior per-ring fixture products (prefix-scoped).
      // Also break any dependent nex_order rows a prior interrupted
      // run might have left. nex_order_event has FK to nex_order.
      await c.query(
        `DELETE FROM nex_order_event
          WHERE order_id IN (
            SELECT id FROM nex_order
             WHERE product_id IN (
               SELECT id FROM nex_product
                WHERE business_id = $1 AND name LIKE $2
             )
          )`,
        [SELLER_BUSINESS_ID, `${PRODUCT_NAME_PREFIX} %`],
      );
      await c.query(
        `DELETE FROM nex_order
          WHERE product_id IN (
            SELECT id FROM nex_product
             WHERE business_id = $1 AND name LIKE $2
          )`,
        [SELLER_BUSINESS_ID, `${PRODUCT_NAME_PREFIX} %`],
      );
      await c.query(
        `DELETE FROM nex_product
          WHERE business_id = $1 AND name LIKE $2`,
        [SELLER_BUSINESS_ID, `${PRODUCT_NAME_PREFIX} %`],
      );

      const deliverySpec = {
        __delivery: {
          local: {
            radii: [
              { km: 5, price_pence: RING_5_PRICE, currency: "IDR" },
              { km: 10, price_pence: RING_10_PRICE, currency: "IDR" },
              { km: 20, price_pence: RING_20_PRICE, currency: "IDR" },
            ],
          },
        },
      };
      const r = await c.query(
        `INSERT INTO nex_product
           (business_id, name, description, price_pence, currency, status,
            department_id, category_id, image_url, spec)
         VALUES ($1, $2, 'lane-F per-ring fixture · delete freely',
                 $3, 'IDR', 'live',
                 'everything_else', 'other', NULL, $4::jsonb)
         RETURNING id`,
        [SELLER_BUSINESS_ID, PRODUCT_NAME, PRICE_PENCE, JSON.stringify(deliverySpec)],
      );
      productId = r.rows[0].id as string;
    } finally {
      await c.end();
    }
  });

  test.afterAll(async () => {
    try {
      const c = await pgClient();
      try {
        // Clear any peer-messages this buyer generated against the
        // seller shop in this run (cart_sent redirects always write
        // one · the F-E2E-1 success case produces one).
        await c.query(
          `DELETE FROM nex_peer_message
            WHERE sender_account_id = $1
              AND (attachment_meta->'cart'->>'shop_id') = $2
              AND body LIKE $3`,
          [BUYER_ACCOUNT_ID, SELLER_BUSINESS_ID, `%${PRODUCT_NAME_PREFIX}%`],
        );
        // Then any nex_order rows that reference the fixture product.
        if (productId) {
          await c.query(
            `DELETE FROM nex_order_event
              WHERE order_id IN (SELECT id FROM nex_order WHERE product_id = $1)`,
            [productId],
          );
          await c.query(`DELETE FROM nex_order WHERE product_id = $1`, [productId]);
          await c.query(`DELETE FROM nex_product WHERE id = $1`, [productId]);
        }
        // Restore business coords to NULL so other specs that
        // predicate on them don't regress silently.
        await c.query(
          `UPDATE nex_business
              SET location_lat = NULL, location_lng = NULL
            WHERE id = $1
              AND slug LIKE 'e2e-ck5-seller-shop-%'`,
          [SELLER_BUSINESS_ID],
        );
      } finally {
        await c.end();
      }
    } catch (e) {
      console.warn("delivery-quote-flow cleanup failed · manual review", e);
    }
  });

  test("F-E2E-1 · in-range buyer + authentic ring fare → chat/peer redirect (cart_sent=1)", async ({
    page,
  }) => {
    await signIn(page, BUYER_EMAIL, BUYER_PASSWORD, "/nex-native/contacts");
    await seedCart(page, productId);

    const landed = await submitWithPatchedQuote(page, productId, PRODUCT_NAME, {
      fare_pence: RING_5_PRICE,
      distance_km: 1.57,
      buyer_lat: BUYER_LAT_CLOSE,
      buyer_lng: BUYER_LNG_CLOSE,
    });
    expect(
      landed.pathname,
      `expected /nex-native/chat/peer/<seller> · got ${landed.pathname}${landed.search}`,
    ).toMatch(/^\/nex-native\/chat\/peer\//);
    expect(landed.searchParams.get("cart_sent")).toBe("1");
  });

  test("F-E2E-2 · buyer outside largest ring → refusal with 'outside the shop's delivery range'", async ({
    page,
  }) => {
    await signIn(page, BUYER_EMAIL, BUYER_PASSWORD, "/nex-native/contacts");
    await seedCart(page, productId);

    const landed = await submitWithPatchedQuote(page, productId, PRODUCT_NAME, {
      // Claim the largest-ring price for the far destination; the
      // server computes the straight-line km and refuses before
      // comparing fares.
      fare_pence: RING_20_PRICE,
      distance_km: 55,
      buyer_lat: BUYER_LAT_FAR,
      buyer_lng: BUYER_LNG_FAR,
    });
    expect(landed.pathname).toBe("/nex-native/cart");
    const err = landed.searchParams.get("send_error") ?? "";
    expect(err).toContain("outside the shop's delivery range");
  });

  test("F-E2E-3 · tampered (lower) fare → refusal with 'rate card'", async ({
    page,
  }) => {
    await signIn(page, BUYER_EMAIL, BUYER_PASSWORD, "/nex-native/contacts");
    await seedCart(page, productId);

    const landed = await submitWithPatchedQuote(page, productId, PRODUCT_NAME, {
      // Buyer is inside the 5 km ring (true fare 15 000 IDR) but
      // claims 1 pence.
      fare_pence: 1,
      distance_km: 1.57,
      buyer_lat: BUYER_LAT_CLOSE,
      buyer_lng: BUYER_LNG_CLOSE,
    });
    expect(landed.pathname).toBe("/nex-native/cart");
    const err = landed.searchParams.get("send_error") ?? "";
    expect(err.toLowerCase()).toContain("rate card");
  });
});
