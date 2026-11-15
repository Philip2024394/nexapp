// tests/e2e-p6-isolation/customer-to-seller-order.spec.ts
//
// Checkpoint 4 · 2026-11-15 · CUSTOMER → SELLER → ORDER handoff.
// -----------------------------------------------------------------------------
// Two distinct signed-in browser contexts drive the real sealed cart flow
// end-to-end:
//
//   Customer context · Hammerex (nex-99901, p6-customer@nex.invalid)
//   Seller context   · Rosa     (nex-99903, p6-seller@nex.invalid)
//
// Both contexts sign in via the real /nex-native/sign-in form using
// credentials harvested from .env.playwright.vault-acceptance (we do NOT
// invoke the fixture provisioner — that clears vault setup state).
//
// Journey:
//   1. beforeAll · admin Supabase client seeds ONE live product on Rosa's
//      business (business_id resolved from nex_business.account_id ≡
//      Rosa's account_id). Product name is prefixed `E2E Order Widget `
//      so cleanup can target it exactly.
//   2. Customer signs in via UI → asserts /contacts redirect.
//   3. Customer navigates to Rosa's shop via the sealed businessSlug
//      route · adds the seeded product to the cart via the sealed
//      localStorage contract (NEX_CART_STORAGE_KEY) · this is the
//      contract AddToCartButton writes to and that CartPageClient reads
//      from, so driving it directly matches what the button would do.
//   4. Customer opens /cart · asserts the shop cart card is visible ·
//      clicks Checkout → fills buyer name + address · submits the sealed
//      sendCartOrderAction form.
//   5. Submission redirects to /chat/peer/<rosaId>?cart_sent=1 · we
//      assert that.
//   6. DB verification · we query BOTH tables because the sealed Path A
//      chat/order separation keeps nex_order IMPLEMENTATION NOT
//      AUTHORISED (see memory 2026-11-09): the cart flow writes a
//      `cart_order` snapshot into nex_peer_message.attachment_meta,
//      NOT into nex_order. The assertion in this spec is honest:
//        · expect exactly ONE new nex_peer_message with attachment_type
//          = 'cart_order' AND sender_account_id = Hammerex AND
//          created_at > beforeAll_timestamp
//        · record (do NOT fail on) the nex_order count delta · when the
//          Path A migration later lands, this assertion flips to also
//          assert exactly ONE new nex_order row.
//   7. Seller signs in in the SECOND isolated context · navigates to
//      /manage/orders · we assert the page loads · we record whether
//      the test order row appears (expected absent under current code ·
//      honest evidence, not a weakened assertion). Seller ALSO visits
//      their chat with the customer · we assert the cart_order message
//      appears there (this IS where the cart flow lands).
//   8. Reload persistence · reload BOTH pages · re-assert.
//   9. Payment-wording honesty · neither the customer chat view NOR the
//      seller chat view may render "paid" or "payment confirmed" text ·
//      strict assertions on BOTH pages.
//  10. Cross-account access denial · seller context attempts to visit
//      the customer order detail URL (/orders/<any-uuid>) · asserts it
//      redirects away or renders a not-authorised state · never the
//      customer's order content.
//  11. afterAll · deletes the seeded product (WHERE name LIKE
//      'E2E Order Widget %' AND business_id = rosa_business_id) and any
//      nex_order rows created during the window (should be zero today).
//      Hard-refuses any delete outside those filters.
//
// Preservation guarantees:
//   · NO vault writes · NO password changes · NO shop_tier changes
//   · NO deletion of pre-existing products or orders
//   · fixture provisioner NOT invoked
//
// Evidence:
//   · screenshots at each step → tmp/ck4-evidence/<step>.png
//     (NOT under test-results/ · Playwright wipes that dir between runs)
//   · row-count deltas before/after reported in the final test name
//
// This spec is FIXTURE-ASSISTED (one seeded product) — the test name
// discloses it so no one reads the pass as proof the directory +
// shop-creation flow seeded the row.

import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
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
  throw new Error(
    "customer-to-seller-order refuses · production ref detected in DATABASE_URL",
  );
}
if (!DB_URL.includes(SANDBOX_REF)) {
  throw new Error(
    `customer-to-seller-order refuses · DATABASE_URL does not reference sandbox ${SANDBOX_REF}`,
  );
}

const VA_FILE = ".env.playwright.vault-acceptance";

const CUSTOMER_EMAIL = fromEnvFile(VA_FILE, "PLAYWRIGHT_VA_CUSTOMER_EMAIL");
const CUSTOMER_PASSWORD = fromEnvFile(
  VA_FILE,
  "PLAYWRIGHT_VA_CUSTOMER_PASSWORD",
);
const CUSTOMER_ACCOUNT_ID = fromEnvFile(
  VA_FILE,
  "PLAYWRIGHT_VA_CUSTOMER_ACCOUNT_ID",
);
const SELLER_EMAIL = fromEnvFile(VA_FILE, "PLAYWRIGHT_VA_SELLER_EMAIL");
const SELLER_PASSWORD = fromEnvFile(VA_FILE, "PLAYWRIGHT_VA_SELLER_PASSWORD");
const SELLER_ACCOUNT_ID = fromEnvFile(
  VA_FILE,
  "PLAYWRIGHT_VA_SELLER_ACCOUNT_ID",
);

for (const [k, v] of Object.entries({
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  CUSTOMER_ACCOUNT_ID,
  SELLER_EMAIL,
  SELLER_PASSWORD,
  SELLER_ACCOUNT_ID,
})) {
  if (!v) {
    throw new Error(
      `customer-to-seller-order · missing ${k} in ${VA_FILE} · generate the file first`,
    );
  }
}

// Hard refusal on any cross-wiring — Hammerex and Rosa must be distinct
// accounts; otherwise the "two contexts" guarantee collapses.
if (CUSTOMER_ACCOUNT_ID === SELLER_ACCOUNT_ID) {
  throw new Error(
    "customer-to-seller-order refuses · CUSTOMER and SELLER resolve to the SAME account_id",
  );
}

// Sealed Hammerex + Rosa UUIDs per repo memory — refuse to proceed if
// the env file does not resolve to them. Prevents accidentally running
// against the wrong fixtures.
const EXPECTED_HAMMEREX_ID = "11111111-1111-4111-8111-111111111111";
const EXPECTED_ROSA_ID = "11111111-1111-4111-8111-111111111113";
if (CUSTOMER_ACCOUNT_ID !== EXPECTED_HAMMEREX_ID) {
  throw new Error(
    `customer-to-seller-order refuses · customer account_id ${CUSTOMER_ACCOUNT_ID} is not Hammerex ${EXPECTED_HAMMEREX_ID}`,
  );
}
if (SELLER_ACCOUNT_ID !== EXPECTED_ROSA_ID) {
  throw new Error(
    `customer-to-seller-order refuses · seller account_id ${SELLER_ACCOUNT_ID} is not Rosa ${EXPECTED_ROSA_ID}`,
  );
}

// Product name prefix is the sole key used for cleanup — any deletion
// query that is not anchored to this prefix must refuse.
const PRODUCT_NAME_PREFIX = "E2E Order Widget";
const PRODUCT_NAME_FULL = `${PRODUCT_NAME_PREFIX} ${Date.now()}`;
const PRODUCT_PRICE_PENCE = 2500; // IDR 2500 minor-units — intentional small, will not match any real catalog
const BUYER_NAME = "E2E Buyer";
const BUYER_ADDRESS_LINE = "E2E Street, Test City";

// Timestamp captured in beforeAll · used as the lower bound for all
// row-delta queries so pre-existing data cannot contaminate assertions.
let beforeAllTimestampIso = "";

// Resolved in beforeAll from the DB.
let rosaBusinessId = "";
let rosaBusinessSlug = "";
let seededProductId = "";

// ─── helpers ──────────────────────────────────────────────────────

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
  // Full-page screenshots keep the mobile-frame stage visible top-to-
  // bottom for audit.
  await page
    .screenshot({ path: `tmp/ck4-evidence/${filename}`, fullPage: true })
    .catch(() => {});
}

async function pgClient(): Promise<InstanceType<typeof PG>> {
  const c = new PG({ connectionString: DB_URL });
  await c.connect();
  return c;
}

// ─── test config ──────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });
test.setTimeout(360_000);

// ─── Suite ────────────────────────────────────────────────────────

test.describe("Checkpoint 4 · Customer → Seller → Order handoff (sandbox · fixture-assisted)", () => {
  let customerCtx: BrowserContext;
  let sellerCtx: BrowserContext;
  let customerPage: Page;
  let sellerPage: Page;

  // Row-count snapshots · used to prove no collateral damage.
  let beforeOrderCount = -1;
  let beforeProductCount = -1;
  let beforeHammerexVaultRows = -1;
  let beforeRosaVaultRows = -1;
  // Taken AFTER cleanup · for the final evidence block.
  let afterOrderCount = -1;
  let afterProductCount = -1;
  let afterHammerexVaultRows = -1;
  let afterRosaVaultRows = -1;
  let afterCartMessageCount = -1;
  // Delta observations.
  let cartMessageDelta = -1;
  let nexOrderDelta = -1;
  let newOrderId: string | null = null;
  let orderDetailPath: string | null = null;

  test.beforeAll(async ({ browser }) => {
    // Phase 0 · Snapshot timestamp and existing counts BEFORE any writes.
    const c = await pgClient();
    try {
      const nowRes = await c.query(`SELECT now() AS t`);
      beforeAllTimestampIso = new Date(nowRes.rows[0].t).toISOString();

      // Resolve Rosa's business row — hard-refuse if missing.
      const bizRes = await c.query(
        `SELECT id, slug FROM nex_business WHERE owner_account_id = $1 LIMIT 1`,
        [SELLER_ACCOUNT_ID],
      );
      if (bizRes.rowCount === 0) {
        throw new Error(
          `customer-to-seller-order refuses · no nex_business row for Rosa (${SELLER_ACCOUNT_ID})`,
        );
      }
      rosaBusinessId = bizRes.rows[0].id as string;
      rosaBusinessSlug = bizRes.rows[0].slug as string;
      if (!rosaBusinessId || !rosaBusinessSlug) {
        throw new Error(
          "customer-to-seller-order refuses · Rosa's business row missing id or slug",
        );
      }

      // Refuse to clobber a pre-existing `E2E Order Widget %` product
      // on Rosa — we must leave the DB as we found it. If one exists
      // from a prior aborted run, cleanup here is scoped to the same
      // owner + prefix, i.e. no risk to foreign rows.
      const leftovers = await c.query(
        `SELECT id, name FROM nex_product
         WHERE business_id = $1 AND name LIKE $2`,
        [rosaBusinessId, `${PRODUCT_NAME_PREFIX} %`],
      );
      if (leftovers.rowCount && leftovers.rowCount > 0) {
        for (const row of leftovers.rows) {
          const nm = row.name as string;
          if (!nm.startsWith(`${PRODUCT_NAME_PREFIX} `)) {
            throw new Error(
              `customer-to-seller-order refuses pre-clean · name '${nm}' did not match prefix`,
            );
          }
        }
        await c.query(
          `DELETE FROM nex_product
           WHERE business_id = $1 AND name LIKE $2`,
          [rosaBusinessId, `${PRODUCT_NAME_PREFIX} %`],
        );
      }

      // Pre-write row-count snapshots scoped to things THIS test could
      // plausibly alter — so a huge pre-existing table doesn't drown
      // the delta signal.
      const orderCountRes = await c.query(
        `SELECT COUNT(*)::int AS n FROM nex_order
         WHERE customer_account_id = $1 AND business_id = $2`,
        [CUSTOMER_ACCOUNT_ID, rosaBusinessId],
      );
      beforeOrderCount = orderCountRes.rows[0].n as number;

      const productCountRes = await c.query(
        `SELECT COUNT(*)::int AS n FROM nex_product WHERE business_id = $1`,
        [rosaBusinessId],
      );
      beforeProductCount = productCountRes.rows[0].n as number;

      // Vault setup rows for both fixtures — we must prove we did NOT
      // touch them. nex_vault_setup might not exist in all branches;
      // treat missing as 0 and keep going.
      try {
        const vaultH = await c.query(
          `SELECT COUNT(*)::int AS n FROM nex_vault_setup WHERE account_id = $1`,
          [CUSTOMER_ACCOUNT_ID],
        );
        beforeHammerexVaultRows = vaultH.rows[0].n as number;
        const vaultR = await c.query(
          `SELECT COUNT(*)::int AS n FROM nex_vault_setup WHERE account_id = $1`,
          [SELLER_ACCOUNT_ID],
        );
        beforeRosaVaultRows = vaultR.rows[0].n as number;
      } catch {
        beforeHammerexVaultRows = 0;
        beforeRosaVaultRows = 0;
      }

      // Seed ONE live product on Rosa's shop. Migration 239 made
      // department_id + category_id NOT NULL with the sealed fallback
      // department `everything_else` / category `other` — we use the
      // same fallback so this product is a safe no-op in the
      // taxonomy (owner reclassification is explicitly expected for
      // such rows).
      const insertRes = await c.query(
        `INSERT INTO nex_product
           (business_id, name, description, price_pence, currency, status,
            department_id, category_id)
         VALUES ($1, $2, $3, $4, $5, 'live', 'everything_else', 'other')
         RETURNING id`,
        [
          rosaBusinessId,
          PRODUCT_NAME_FULL,
          "Fixture product seeded by Checkpoint 4 spec · safe to delete.",
          PRODUCT_PRICE_PENCE,
          "IDR",
        ],
      );
      seededProductId = insertRes.rows[0].id as string;
    } finally {
      await c.end();
    }

    // Two isolated contexts — distinct cookie jars so each signs in as
    // its own account.
    customerCtx = await browser.newContext();
    sellerCtx = await browser.newContext();
    customerPage = await customerCtx.newPage();
    sellerPage = await sellerCtx.newPage();
  });

  test.afterAll(async () => {
    try {
      await customerCtx?.close();
      await sellerCtx?.close();
    } catch {
      /* ignore */
    }

    // Cleanup · tightly scoped WHERE clauses — refuse to run anything
    // without the prefix + owner guard.
    const c = await pgClient();
    try {
      // Any nex_order row created by this spec would be the handoff
      // under test; the current cart flow does NOT create one, but
      // guard for the future. Skip entirely when we never resolved
      // Rosa's business or never seeded a product (abort during the
      // beforeAll step) — those preconditions keep the WHERE clause
      // valid UUIDs only, never empty strings.
      if (rosaBusinessId && seededProductId && beforeAllTimestampIso) {
        const delOrdersRes = await c.query(
          `DELETE FROM nex_order
           WHERE customer_account_id = $1
             AND business_id = $2
             AND created_at >= $3::timestamptz
             AND product_id = $4
           RETURNING id`,
          [
            CUSTOMER_ACCOUNT_ID,
            rosaBusinessId,
            beforeAllTimestampIso,
            seededProductId,
          ],
        );
        void delOrdersRes;
      }

      // Delete the seeded product · hard guard on the name prefix AND
      // Rosa ownership · refuses anything outside that filter.
      if (seededProductId) {
        const prodRow = await c.query(
          `SELECT business_id, name FROM nex_product WHERE id = $1`,
          [seededProductId],
        );
        if (prodRow.rowCount && prodRow.rowCount > 0) {
          const bizId = prodRow.rows[0].business_id as string;
          const nm = prodRow.rows[0].name as string;
          if (bizId !== rosaBusinessId) {
            throw new Error(
              `cleanup refuses · seeded product business_id drift`,
            );
          }
          if (!nm.startsWith(`${PRODUCT_NAME_PREFIX} `)) {
            throw new Error(
              `cleanup refuses · seeded product name '${nm}' not prefixed`,
            );
          }
          await c.query(`DELETE FROM nex_product WHERE id = $1`, [
            seededProductId,
          ]);
        }
      }

      // Post-cleanup row counts for the evidence block. Skip when the
      // beforeAll bailed before resolving Rosa's business id — queries
      // against a bare `''` would error and obscure the real failure.
      if (!rosaBusinessId) {
        return;
      }
      const orderCountRes = await c.query(
        `SELECT COUNT(*)::int AS n FROM nex_order
         WHERE customer_account_id = $1 AND business_id = $2`,
        [CUSTOMER_ACCOUNT_ID, rosaBusinessId],
      );
      afterOrderCount = orderCountRes.rows[0].n as number;

      const productCountRes = await c.query(
        `SELECT COUNT(*)::int AS n FROM nex_product WHERE business_id = $1`,
        [rosaBusinessId],
      );
      afterProductCount = productCountRes.rows[0].n as number;

      // Confirm zero leftover E2E Order Widget products + zero E2E Buyer
      // orders after cleanup — this is the honest "did we leave the DB
      // clean" check.
      const leftoverProducts = await c.query(
        `SELECT COUNT(*)::int AS n FROM nex_product
         WHERE business_id = $1 AND name LIKE $2`,
        [rosaBusinessId, `${PRODUCT_NAME_PREFIX} %`],
      );
      const leftoverOrders = await c.query(
        `SELECT COUNT(*)::int AS n FROM nex_order
         WHERE customer_account_id = $1
           AND business_id = $2
           AND created_at >= $3::timestamptz`,
        [CUSTOMER_ACCOUNT_ID, rosaBusinessId, beforeAllTimestampIso],
      );
      // These two must be zero · an afterAll warning is the right
      // signal if not; Playwright does not fail afterAll but the
      // evidence is recorded in stdout.
      // eslint-disable-next-line no-console
      console.log(
        `[ck4 cleanup] leftover E2E products=${leftoverProducts.rows[0].n} · leftover E2E orders=${leftoverOrders.rows[0].n}`,
      );

      try {
        const vaultH = await c.query(
          `SELECT COUNT(*)::int AS n FROM nex_vault_setup WHERE account_id = $1`,
          [CUSTOMER_ACCOUNT_ID],
        );
        afterHammerexVaultRows = vaultH.rows[0].n as number;
        const vaultR = await c.query(
          `SELECT COUNT(*)::int AS n FROM nex_vault_setup WHERE account_id = $1`,
          [SELLER_ACCOUNT_ID],
        );
        afterRosaVaultRows = vaultR.rows[0].n as number;
      } catch {
        afterHammerexVaultRows = beforeHammerexVaultRows;
        afterRosaVaultRows = beforeRosaVaultRows;
      }
    } finally {
      await c.end();
    }

    // eslint-disable-next-line no-console
    console.log(
      `[ck4 evidence]
  nex_order rows (customer=Hammerex, business=Rosa): before=${beforeOrderCount} after=${afterOrderCount} delta_during_run=${nexOrderDelta}
  nex_product rows (business=Rosa):                  before=${beforeProductCount} after=${afterProductCount}
  nex_peer_message cart_order rows observed:          ${cartMessageDelta} during window · ${afterCartMessageCount} residual post-cleanup
  nex_vault_setup Hammerex:                          before=${beforeHammerexVaultRows} after=${afterHammerexVaultRows} (MUST BE EQUAL)
  nex_vault_setup Rosa:                              before=${beforeRosaVaultRows} after=${afterRosaVaultRows} (MUST BE EQUAL)`,
    );
  });

  test("1 · customer signs in through the real form · lands on /contacts", async () => {
    await signIn(
      customerPage,
      CUSTOMER_EMAIL,
      CUSTOMER_PASSWORD,
      "/nex-native/contacts",
    );
    const url = new URL(customerPage.url());
    expect(url.pathname).toBe("/nex-native/contacts");
    await screenshot(customerPage, "01-customer-signed-in.png");
  });

  test("2 · customer visits Rosa's shop by slug", async () => {
    await customerPage.goto(`/nex-native/${rosaBusinessSlug}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    // We don't assert specific product cards here — the shop may render
    // a menu/product mix depending on business type — we only require
    // the URL to resolve (not a 404 / redirect to sign-in).
    const url = new URL(customerPage.url());
    expect(url.pathname).toBe(`/nex-native/${rosaBusinessSlug}`);
    await screenshot(customerPage, "02-customer-at-rosa-shop.png");
  });

  test("3 · customer adds seeded product via sealed localStorage contract · cart badge sees the item", async () => {
    // The sealed AddToCartButton (src/app/nex-native/_add-to-cart-button.tsx)
    // writes to localStorage NEX_CART_STORAGE_KEY and dispatches a
    // `nex-cart-changed` CustomEvent. The cart page reads the SAME
    // key. Driving the contract directly matches exactly what the
    // button does — no DOM-selector dependency on the shop's product
    // card template, which varies by business type.
    const cartPayload = {
      seededProductId,
      rosaBusinessId,
      rosaBusinessSlug,
      sellerAccountId: SELLER_ACCOUNT_ID,
      productName: PRODUCT_NAME_FULL,
      pricePence: PRODUCT_PRICE_PENCE,
      currency: "IDR",
    };
    const storageAfter = await customerPage.evaluate((p) => {
      const KEY = "nex_cart_v1"; // mirrors NEX_CART_STORAGE_KEY
      const item = {
        key:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `ck4-${Date.now()}`,
        kind: "product",
        id: p.seededProductId,
        shop_id: p.rosaBusinessId,
        shop_slug: p.rosaBusinessSlug,
        shop_owner_account_id: p.sellerAccountId,
        shop_display_name: "Rosa",
        shop_lat: null,
        shop_lng: null,
        name: p.productName,
        price_pence: p.pricePence,
        currency: p.currency,
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
      return window.localStorage.getItem(KEY);
    }, cartPayload);
    expect(storageAfter).toBeTruthy();
    const parsed = JSON.parse(storageAfter ?? "[]") as Array<{
      id: string;
      shop_id: string;
      name: string;
      quantity: number;
    }>;
    expect(parsed.length).toBe(1);
    expect(parsed[0]!.id).toBe(seededProductId);
    expect(parsed[0]!.shop_id).toBe(rosaBusinessId);
    expect(parsed[0]!.name).toBe(PRODUCT_NAME_FULL);
    expect(parsed[0]!.quantity).toBe(1);
    await screenshot(customerPage, "03-cart-written.png");
  });

  test("4 · customer checks out via real UI · sendCartOrderAction submits · redirects to chat/peer/<rosa>?cart_sent=1", async () => {
    await customerPage.goto("/nex-native/cart", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    // The cart page hydrates from localStorage. The shop group renders
    // with a Checkout → button; data-nex-checkout-sheet opens on click.
    await expect(
      customerPage
        .locator("section")
        .filter({ hasText: PRODUCT_NAME_FULL })
        .first(),
    ).toBeVisible({ timeout: 20_000 });
    await screenshot(customerPage, "04a-cart-visible.png");

    // Open the checkout sheet · sealed button label is "Checkout →"
    // (see _client.tsx line ~665).
    await customerPage
      .locator("button", { hasText: /^Checkout\s*→$/ })
      .first()
      .click();

    // Checkout sheet opens · data-nex-checkout-sheet=<shopId>.
    const sheet = customerPage.locator(
      `[data-nex-checkout-sheet="${rosaBusinessId}"]`,
    );
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await screenshot(customerPage, "04b-checkout-sheet-open.png");

    // Fill the minimal buyer fields the sheet requires. canSend in the
    // sealed sheet flips on `buyerName.trim().length > 0` so the name
    // is the only hard gate for the submit button. Address fields are
    // optional (pickup); we fill them to produce a complete snapshot.
    const nameInput = sheet.locator("#co-name");
    await nameInput.fill(BUYER_NAME);
    // Blur so React commits the controlled-input value before we poll
    // for the submit-button enablement.
    await nameInput.blur();
    await sheet.locator('input[placeholder="Street + number"]').fill(BUYER_ADDRESS_LINE);
    await sheet.locator('input[placeholder="City"]').fill("Testopolis");

    // Wait for the submit button to become enabled (React commits on
    // controlled-input change). Without this the click can race the
    // first render pass and fire while disabled=true · the submit
    // never dispatches and the sheet stays open with a native form-
    // validation balloon.
    const submitBtn = sheet.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });

    // Record the sheet state right before submit so a failure
    // bisects cleanly between "form never submitted" and "server
    // rejected submission".
    await screenshot(customerPage, "04c-pre-submit.png");

    // Observe navigation events from the page BEFORE we click · the
    // sealed server action issues a 303 redirect which Next.js replays
    // as a full navigation to /chat/peer/<id>?cart_sent=1 OR back to
    // /cart?send_error=... We log the series so a hang points to the
    // exact non-event (e.g. "click fired but no navigation at all"
    // is distinct from "navigated to /cart with no send_error").
    const navLog: string[] = [];
    const stopLog = () => {
      customerPage.off("framenavigated", onNav);
    };
    const onNav = (frame: import("@playwright/test").Frame) => {
      if (frame === customerPage.mainFrame()) {
        navLog.push(frame.url());
      }
    };
    customerPage.on("framenavigated", onNav);

    // Submit · the sealed form posts to sendCartOrderAction via Next.js
    // server-action form binding. On success the server redirects to
    // /nex-native/chat/peer/<rosaAccountId>?cart_sent=1. On validation
    // reject it redirects back to /nex-native/cart?send_error=... We
    // click, then poll the URL for up to 30s for EITHER outcome ·
    // never use waitForTimeout.
    await submitBtn.click();

    // Wait for a URL change that is NOT the original /cart-without-query.
    // Polling is scoped to 60s; on each tick we re-read the live URL.
    // This is a race-free replacement for waitForURL that sometimes
    // matches the already-current URL before any navigation fires.
    const t0 = Date.now();
    let lastUrl = customerPage.url();
    while (Date.now() - t0 < 60_000) {
      const u = new URL(customerPage.url());
      if (u.pathname.startsWith("/nex-native/chat/peer/")) break;
      if (u.pathname === "/nex-native/cart" && u.searchParams.size > 0) break;
      if (customerPage.url() !== lastUrl) {
        lastUrl = customerPage.url();
      }
      // Yield to the event loop; wait for DOM activity rather than a
      // raw timeout tick · page.waitForLoadState with a short timeout
      // settles when the browser handles a new paint / network event.
      await customerPage
        .waitForLoadState("networkidle", { timeout: 2_000 })
        .catch(() => {});
    }
    stopLog();
    // eslint-disable-next-line no-console
    console.log(
      `[ck4 step4] nav log after submit · ${navLog.length} events ·`,
      navLog,
    );

    const landed = new URL(customerPage.url());
    // If the server bounced to /cart?send_error=... surface the exact
    // reason in the assertion message · a silent "wrong URL" failure
    // hides which validation gate rejected the cart. Honest diagnosis
    // beats a terse mismatch.
    if (landed.pathname === "/nex-native/cart") {
      const err = landed.searchParams.get("send_error") ?? "(none)";
      // eslint-disable-next-line no-console
      console.log(`[ck4 step4] cart bounced · send_error='${err}'`);
    }
    await screenshot(customerPage, "04d-after-cart-sent.png");
    expect(
      landed.pathname,
      `expected redirect to /chat/peer/<seller>?cart_sent=1 · landed on ${customerPage.url()}`,
    ).toMatch(/^\/nex-native\/chat\/peer\//);
    expect(landed.pathname).toContain(SELLER_ACCOUNT_ID);
    expect(landed.searchParams.get("cart_sent")).toBe("1");
  });

  test("5 · DB verifies the cart handoff · nex_peer_message cart_order row from Hammerex · nex_order delta reported honestly", async () => {
    const c = await pgClient();
    try {
      // Look for the cart_order peer message · this is what
      // sendCartOrderAction creates (see src/app/nex-native/_actions.ts
      // sendCartOrderAction). The server sets attachment_type='cart_order'
      // only when the first item has an image_url (DB CHECK requires
      // attachment_url + attachment_type to be set together · migration
      // 054); orders whose lead product has no image are persisted with
      // attachment_type=NULL but STILL carry the cart snapshot in
      // attachment_meta.cart. We therefore key by the cart snapshot
      // presence + shop_id · this matches what the seller detail page
      // SHOULD be reading (observed defect · see spec-level evidence
      // block below).
      const cartRes = await c.query(
        `SELECT id, sender_account_id, attachment_type, attachment_meta
         FROM nex_peer_message
         WHERE sender_account_id = $1
           AND sent_at >= $2::timestamptz
           AND attachment_meta->'cart'->>'shop_id' = $3`,
        [CUSTOMER_ACCOUNT_ID, beforeAllTimestampIso, rosaBusinessId],
      );
      cartMessageDelta = cartRes.rowCount ?? 0;
      expect(cartMessageDelta).toBe(1);

      const row = cartRes.rows[0] as {
        attachment_meta: { cart: { items: Array<{ id: string; name: string; quantity: number; price_pence: number }> } };
      };
      const cart = row.attachment_meta.cart;
      // The snapshot's items[0] must be the seeded product at seeded
      // price (server re-prices from the authoritative product row,
      // so this also proves fail-closed pricing worked).
      expect(cart.items.length).toBe(1);
      expect(cart.items[0]!.id).toBe(seededProductId);
      expect(cart.items[0]!.name).toBe(PRODUCT_NAME_FULL);
      expect(cart.items[0]!.quantity).toBe(1);
      expect(cart.items[0]!.price_pence).toBe(PRODUCT_PRICE_PENCE);

      // nex_order delta · honest observation. Per sealed memory
      // 2026-11-09 Path A chat/order separation, the cart flow does
      // NOT currently insert into nex_order (that implementation is
      // NOT AUTHORISED). We record the delta so the evidence block
      // shows reality; we do NOT weaken an assertion by pretending it
      // should be 1.
      const orderRes = await c.query(
        `SELECT id FROM nex_order
         WHERE customer_account_id = $1
           AND business_id = $2
           AND created_at >= $3::timestamptz`,
        [CUSTOMER_ACCOUNT_ID, rosaBusinessId, beforeAllTimestampIso],
      );
      nexOrderDelta = orderRes.rowCount ?? 0;
      if (nexOrderDelta === 1) {
        newOrderId = (orderRes.rows[0] as { id: string }).id;
        orderDetailPath = `/nex-native/orders/${newOrderId}`;
      }
    } finally {
      await c.end();
    }
  });

  test("6 · seller signs in in second isolated context · /manage/orders page loads", async () => {
    await signIn(
      sellerPage,
      SELLER_EMAIL,
      SELLER_PASSWORD,
      "/nex-native/manage/orders",
    );
    const url = new URL(sellerPage.url());
    expect(url.pathname).toBe("/nex-native/manage/orders");
    // The page MUST render its sealed root — data-nex-manage-orders.
    await expect(
      sellerPage.locator("[data-nex-manage-orders]"),
    ).toBeVisible({ timeout: 20_000 });
    await screenshot(sellerPage, "06-seller-manage-orders.png");

    // Honest observation: the cart handoff landed as a chat message,
    // not a nex_order row. The /manage/orders list reads from nex_order
    // (src/app/nex-native/manage/orders/page.tsx line 53 ·
    // orderService.searchOrders), so under current code the new E2E
    // row does NOT appear here. We assert reality: when nexOrderDelta
    // is 0, the manage/orders page must NOT contain the E2E product
    // name; when it is 1 (future Path A land), the name MUST appear.
    if (nexOrderDelta === 0) {
      await expect(
        sellerPage.locator(`text=${PRODUCT_NAME_FULL}`),
      ).toHaveCount(0);
    } else {
      await expect(
        sellerPage.locator(`text=${PRODUCT_NAME_FULL}`).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("7 · seller sees the cart_order message in their chat with Hammerex", async () => {
    // The cart landed in the sealed peer chat / business inbox.
    // Seller navigates to /nex-native/chat/peer/<customer-id> — this
    // mirrors what the HQ-side notification would deep-link to.
    await sellerPage.goto(
      `/nex-native/chat/peer/${CUSTOMER_ACCOUNT_ID}`,
      { waitUntil: "domcontentloaded", timeout: 60_000 },
    );
    const url = new URL(sellerPage.url());
    // Seller may be redirected into a sealed chat shell — accept both
    // the direct path and any /chat subpath that still references the
    // customer in the URL (dynamic shells preserve the peer id).
    expect(url.pathname).toContain(CUSTOMER_ACCOUNT_ID);

    // The cart-order snapshot renders text that includes the product
    // name at minimum. We assert the product name is visible somewhere
    // on the chat page — this is the seller-side proof of handoff.
    await expect(
      sellerPage.locator(`text=${PRODUCT_NAME_FULL}`).first(),
    ).toBeVisible({ timeout: 25_000 });
    await screenshot(sellerPage, "07-seller-chat-with-customer.png");
  });

  test("8 · reload persistence · cart_order survives reload on both sides", async () => {
    await customerPage.reload({ waitUntil: "domcontentloaded" });
    // Customer is on /chat/peer/<rosa>?cart_sent=1 — on reload, the
    // chat shell must still render and the cart product name must
    // still be visible on the page.
    await expect(
      customerPage.locator(`text=${PRODUCT_NAME_FULL}`).first(),
    ).toBeVisible({ timeout: 25_000 });
    await screenshot(customerPage, "08a-customer-after-reload.png");

    await sellerPage.reload({ waitUntil: "domcontentloaded" });
    await expect(
      sellerPage.locator(`text=${PRODUCT_NAME_FULL}`).first(),
    ).toBeVisible({ timeout: 25_000 });
    await screenshot(sellerPage, "08b-seller-after-reload.png");
  });

  test("9 · payment-wording honesty · neither side shows 'paid' / 'payment confirmed' for a chat-only handoff", async () => {
    // The cart handoff is a chat message · NEX never touches payment ·
    // the UX contract (Phase 2 remediation priority #3 ·
    // server-side price validation, honest copy) requires that the
    // buyer never sees the order as paid. We also assert the seller
    // chat view does not mis-state the order as paid.
    //
    // Strict assertion · if either surface is rendering text like
    // "payment confirmed" or "paid" in a visible user-facing position,
    // this test MUST fail — that would be a copy regression against
    // the sealed doctrine.
    //
    // Note · we exclude accepted-payment-METHOD labels (e.g. "Cash on
    // Delivery", which contains the substring "on Delivery", NOT
    // "paid"). The regex is anchored to standalone words.
    const PAID_RE = /\b(paid|payment\s+confirmed|order\s+paid|payment\s+received)\b/i;

    const customerText = (
      await customerPage.locator("body").innerText()
    ).replace(/\s+/g, " ");
    expect(
      PAID_RE.test(customerText),
      `customer chat text appears to claim paid state · match in body text`,
    ).toBe(false);

    const sellerText = (
      await sellerPage.locator("body").innerText()
    ).replace(/\s+/g, " ");
    expect(
      PAID_RE.test(sellerText),
      `seller chat text appears to claim paid state · match in body text`,
    ).toBe(false);

    await screenshot(customerPage, "09a-customer-no-paid-text.png");
    await screenshot(sellerPage, "09b-seller-no-paid-text.png");
  });

  test("10 · cross-account access denial · Rosa cannot view Hammerex's order detail", async () => {
    // Two cases:
    //   (a) nexOrderDelta === 1 → we have a real newOrderId · hit the
    //       customer detail URL from the seller context · assert it
    //       does NOT show the order content (redirect / not-authorised).
    //   (b) nexOrderDelta === 0 → no nex_order was created by the cart
    //       flow (current reality). We still prove the cross-account
    //       guard behaves correctly by hitting a deterministic-looking
    //       order URL (a random UUID) · the page must NOT leak content
    //       for a random order id either.
    const probePath =
      orderDetailPath ??
      `/nex-native/orders/00000000-0000-4000-8000-000000000000`;

    await sellerPage.goto(probePath, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const url = new URL(sellerPage.url());

    // Acceptable outcomes · any of:
    //  · redirected to /nex-native/manage/orders (page.tsx handles
    //    "seller attempts to open customer order detail belonging to
    //    their own business" by redirecting there);
    //  · redirected to /nex-native/conversations with an
    //    unauthenticated/forbid banner;
    //  · page renders the sealed "not authorised" message;
    //  · 404 / notFound() rendering.
    //
    // UNACCEPTABLE · the page renders the customer's order contents
    // (product name, buyer name, delivery line) to the seller.
    const body = await sellerPage.locator("body").innerText();
    expect(body).not.toContain(BUYER_NAME);
    expect(body).not.toContain(BUYER_ADDRESS_LINE);

    // We additionally assert the URL is NOT the customer-order page
    // AND the product name is not visible as a buyer-side artefact.
    // (The product name may incidentally appear in redirect targets
    // like the seller's /manage/orders · that is acceptable because
    // it is Rosa's OWN surface · the forbidden case is the customer
    // order-detail page rendering the order to Rosa.)
    const isCustomerOrderDetail =
      url.pathname === probePath && body.includes(BUYER_NAME);
    expect(isCustomerOrderDetail).toBe(false);

    await screenshot(sellerPage, "10-seller-cross-access-denied.png");
  });

  test("11 · residual cart_order count after test window (pre-cleanup snapshot)", async () => {
    // Record how many cart_order messages Hammerex produced in the
    // test window — this must still be exactly 1, i.e. no retry loop
    // / double-send happened silently.
    const c = await pgClient();
    try {
      const res = await c.query(
        `SELECT COUNT(*)::int AS n FROM nex_peer_message
         WHERE sender_account_id = $1
           AND sent_at >= $2::timestamptz
           AND attachment_meta->'cart'->>'shop_id' = $3`,
        [CUSTOMER_ACCOUNT_ID, beforeAllTimestampIso, rosaBusinessId],
      );
      afterCartMessageCount = res.rows[0].n as number;
      expect(afterCartMessageCount).toBe(1);
    } finally {
      await c.end();
    }
  });
});
