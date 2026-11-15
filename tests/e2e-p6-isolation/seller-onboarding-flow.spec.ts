// tests/e2e-p6-isolation/seller-onboarding-flow.spec.ts
//
// Checkpoint 3 · 2026-11-15 · Seller onboarding + shop customisation +
// product management · real-UI Playwright proof.
// -----------------------------------------------------------------------------
// Signs in as Rosa (nex-99903 · p6-seller@nex.invalid) via the sealed
// /nex-native/sign-in form, then drives the Shop Management Centre,
// the Chat-intro customisation surface, the Products management list
// (list + reload + public storefront), and finally cleans up every
// synthetic artefact so Rosa's account ends exactly as it began.
//
// Sandbox-only. Guards:
//   · DATABASE_URL must include kdstoyyeygcopkogqsyv · hard refusal
//     otherwise (including any production ref).
//   · Rosa's nex_vault_setup is NEVER touched · the spec reads it at
//     beforeAll and asserts it is unchanged at afterAll.
//   · Only rows whose `name` starts with 'E2E Synthetic Widget ' are
//     eligible for cleanup. Any other row is hard-refused.
//   · Hammerex (nex-99901) is NEVER signed in or modified.
//
// Preservation contract:
//   · shop_intro_message is read at beforeAll and restored at afterAll
//     via a UI save (same path the real seller would take).
//   · The synthetic product is deleted from nex_product at afterAll.
//
// UI-defect note (reproduced, NOT fixed):
//   · /nex-native/create/product/form is a 404 · the Create Product
//     flow at /create/product/category links to this missing route via
//     SpecFormBuilder/MarketSelector/etc. Building the form page is a
//     significant change and exceeds this spec's authorised scope.
//     Product creation in this spec therefore writes to nex_product via
//     the same path the real createProductAction uses (department +
//     category + spec jsonb). The storefront still renders through the
//     real UI so the public-view assertion remains a UI check.
//
// Runtime baseline:
//   · PLAYWRIGHT_TEST_BASE_URL defaults to http://localhost:3008 (same
//     port `npm run dev` binds). Pairs with project seller-onboarding-
//     flow-390 in playwright.p6-isolation.config.ts (mobile viewport).

import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
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
if (DB_URL.includes(PROD_REF)) {
  throw new Error("seller-onboarding-flow refuses · production ref detected in DATABASE_URL");
}
if (!DB_URL.includes("kdstoyyeygcopkogqsyv")) {
  throw new Error("seller-onboarding-flow refuses · not sandbox kdstoyyeygcopkogqsyv");
}

const SELLER_EMAIL =
  process.env.PLAYWRIGHT_VA_SELLER_EMAIL ||
  fromEnvFile(".env.playwright.vault-acceptance", "PLAYWRIGHT_VA_SELLER_EMAIL") ||
  "p6-seller@nex.invalid";
const SELLER_PASSWORD =
  process.env.PLAYWRIGHT_VA_SELLER_PASSWORD ||
  fromEnvFile(".env.playwright.vault-acceptance", "PLAYWRIGHT_VA_SELLER_PASSWORD");
const SELLER_ACCOUNT_ID =
  process.env.PLAYWRIGHT_VA_SELLER_ACCOUNT_ID ||
  fromEnvFile(".env.playwright.vault-acceptance", "PLAYWRIGHT_VA_SELLER_ACCOUNT_ID") ||
  "11111111-1111-4111-8111-111111111113";

// Rosa's handle is a hard-coded invariant of the seed. If this diverges
// we want to fail loudly rather than silently touch another account.
const ROSA_NEX_HANDLE = "nex-99903";
const HAMMEREX_NEX_HANDLE = "nex-99901";
const SYNTHETIC_PREFIX = "E2E Synthetic Widget ";

for (const [k, v] of Object.entries({
  SELLER_EMAIL,
  SELLER_PASSWORD,
  SELLER_ACCOUNT_ID,
})) {
  if (!v) {
    throw new Error(`seller-onboarding-flow · missing env ${k}`);
  }
}

// Hard guard · the spec MUST NOT be configured against Hammerex.
if (SELLER_EMAIL.includes("customer") || SELLER_EMAIL.includes("99901")) {
  throw new Error("seller-onboarding-flow refuses · SELLER_EMAIL looks like Hammerex");
}

// ─── helpers ──────────────────────────────────────────────────────

mkdirSync("test-results/ck3", { recursive: true });
// A second copy lives at `evidence/ck3` because other concurrent
// specs in this repo run `rm -rf test-results/` as part of their
// launcher · without the second path our screenshots can get wiped
// mid-run. `evidence/` is outside the Playwright output tree so
// nothing else touches it.
mkdirSync("evidence/ck3", { recursive: true });

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `test-results/ck3/${name}.png`, fullPage: false });
  // Dual-save for durability · see mkdirSync comment above.
  await page.screenshot({ path: `evidence/ck3/${name}.png`, fullPage: false });
}

async function signIn(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(`/nex-native/sign-in`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  // Click + wait for the Server Action POST to complete. The response
  // body is an RSC payload, not a classic redirect · the client-side
  // router then performs the navigation. We wait on the URL settling
  // to a non-sign-in path AFTER the POST so we don't race hydration.
  await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "POST" && /\/nex-native\/sign-in/.test(r.url()),
      { timeout: 60_000 },
    ),
    page.locator("button[data-nex-sign-in-submit]").click(),
  ]);
  await page
    .waitForURL(
      (url) => !url.pathname.startsWith("/nex-native/sign-in"),
      { timeout: 30_000, waitUntil: "domcontentloaded" },
    )
    .catch(() => {});
  const u = new URL(page.url());
  if (u.pathname.startsWith("/nex-native/sign-in")) {
    const errParam = u.searchParams.get("e") ?? u.searchParams.get("error") ?? "";
    const msgParam = u.searchParams.get("m") ?? "";
    throw new Error(
      `signIn · stayed on sign-in · url=${page.url()} · e=${errParam} m=${msgParam}`,
    );
  }
}

interface RosaState {
  readonly accountId: string;
  readonly nexHandle: string;
  readonly businessId: string;
  readonly businessSlug: string;
  readonly businessDisplayName: string;
  readonly shopIntroMessage: string;
  readonly productCount: number;
  readonly vaultSetupRows: number;
}

async function readRosaState(): Promise<RosaState> {
  const c = new PG({ connectionString: DB_URL });
  await c.connect();
  try {
    const acc = await c.query(
      "SELECT id, nex_handle FROM nex_account WHERE nex_handle=$1",
      [ROSA_NEX_HANDLE],
    );
    if (acc.rowCount !== 1) {
      throw new Error(
        `readRosaState · expected exactly one ${ROSA_NEX_HANDLE} row · got ${acc.rowCount}`,
      );
    }
    const accountId = String(acc.rows[0].id);
    if (accountId !== SELLER_ACCOUNT_ID) {
      throw new Error(
        `readRosaState · Rosa's DB account ${accountId} does not match PLAYWRIGHT_VA_SELLER_ACCOUNT_ID ${SELLER_ACCOUNT_ID}`,
      );
    }
    const biz = await c.query(
      "SELECT id, slug, display_name, shop_intro_message FROM nex_business WHERE owner_account_id=$1",
      [accountId],
    );
    if (biz.rowCount !== 1) {
      throw new Error(
        `readRosaState · expected exactly one business for Rosa · got ${biz.rowCount}`,
      );
    }
    const products = await c.query(
      "SELECT count(*)::int AS cnt FROM nex_product WHERE business_id=$1",
      [biz.rows[0].id],
    );
    const vault = await c.query(
      "SELECT count(*)::int AS cnt FROM nex_vault_setup WHERE account_id=$1",
      [accountId],
    );
    return {
      accountId,
      nexHandle: acc.rows[0].nex_handle,
      businessId: String(biz.rows[0].id),
      businessSlug: String(biz.rows[0].slug),
      businessDisplayName: String(biz.rows[0].display_name),
      shopIntroMessage: biz.rows[0].shop_intro_message ?? "",
      productCount: Number(products.rows[0].cnt),
      vaultSetupRows: Number(vault.rows[0].cnt),
    };
  } finally {
    await c.end();
  }
}

/**
 * Count synthetic product rows that match this spec's prefix. Used by
 * afterAll as a preservation check · must return 0 at teardown.
 */
async function countSyntheticRemnants(businessId: string): Promise<number> {
  const c = new PG({ connectionString: DB_URL });
  await c.connect();
  try {
    const r = await c.query(
      "SELECT count(*)::int AS cnt FROM nex_product WHERE business_id=$1 AND name LIKE $2",
      [businessId, `${SYNTHETIC_PREFIX}%`],
    );
    return Number(r.rows[0].cnt);
  } finally {
    await c.end();
  }
}

/**
 * Delete rows in nex_product whose name starts with the synthetic
 * prefix and whose business belongs to Rosa. Hard-refuses any name
 * that does not match the prefix.
 */
async function cleanupSyntheticProducts(businessId: string): Promise<number> {
  const c = new PG({ connectionString: DB_URL });
  await c.connect();
  try {
    // Hammerex-safety: owner_account_id of the business must match Rosa.
    const ownerCheck = await c.query(
      `SELECT a.nex_handle
         FROM nex_business b
         JOIN nex_account a ON a.id = b.owner_account_id
        WHERE b.id = $1`,
      [businessId],
    );
    if (ownerCheck.rowCount !== 1 || ownerCheck.rows[0].nex_handle !== ROSA_NEX_HANDLE) {
      throw new Error(
        `cleanupSyntheticProducts refuses · business ${businessId} is not owned by ${ROSA_NEX_HANDLE}`,
      );
    }
    // Candidate names must ALL match the synthetic prefix.
    const candidates = await c.query(
      "SELECT id, name FROM nex_product WHERE business_id=$1 AND name LIKE $2",
      [businessId, `${SYNTHETIC_PREFIX}%`],
    );
    for (const row of candidates.rows) {
      if (!String(row.name).startsWith(SYNTHETIC_PREFIX)) {
        throw new Error(
          `cleanupSyntheticProducts refuses · row ${row.id} name '${row.name}' lacks synthetic prefix`,
        );
      }
    }
    const del = await c.query(
      "DELETE FROM nex_product WHERE business_id=$1 AND name LIKE $2 RETURNING id",
      [businessId, `${SYNTHETIC_PREFIX}%`],
    );
    return del.rowCount ?? 0;
  } finally {
    await c.end();
  }
}

/**
 * Direct-DB product create. We use this because the UI form route
 * /nex-native/create/product/form does not exist on this branch
 * (reproduced defect · see header). The write path matches what the
 * real createProductAction would do for a fashion_clothing/bags_luggage
 * listing: insert nex_product with department_id, category_id, and a
 * minimal valid spec jsonb.
 */
async function insertSyntheticProduct(
  businessId: string,
  name: string,
): Promise<{ id: string }> {
  const c = new PG({ connectionString: DB_URL });
  await c.connect();
  try {
    // Hammerex-safety: owner_account_id of the business must match Rosa.
    const ownerCheck = await c.query(
      `SELECT a.nex_handle
         FROM nex_business b
         JOIN nex_account a ON a.id = b.owner_account_id
        WHERE b.id = $1`,
      [businessId],
    );
    if (ownerCheck.rowCount !== 1 || ownerCheck.rows[0].nex_handle !== ROSA_NEX_HANDLE) {
      throw new Error(
        `insertSyntheticProduct refuses · business ${businessId} is not owned by ${ROSA_NEX_HANDLE}`,
      );
    }
    if (!name.startsWith(SYNTHETIC_PREFIX)) {
      throw new Error(
        `insertSyntheticProduct refuses · name '${name}' lacks synthetic prefix`,
      );
    }
    // Minimal spec payload compatible with the fashion_clothing /
    // bags_luggage spec schema. The Zod spec validators are enforced
    // only in the server action; the DB column is a jsonb NOT NULL
    // default '{}'. Writing an empty object is accepted by the column
    // CHECK; the public storefront renders the `name` field regardless
    // of spec completeness. This is the minimum we need for the public
    // storefront assertion.
    const r = await c.query(
      `INSERT INTO nex_product (
         business_id, name, description, price_pence, currency, status,
         department_id, category_id, spec, stock_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
       RETURNING id`,
      [
        businessId,
        name,
        "E2E synthetic product · safe to delete.",
        1000,
        "IDR",
        "live",
        "fashion_clothing",
        "bags_luggage",
        JSON.stringify({ __market: { scope: "worldwide" } }),
        "in_stock",
      ],
    );
    if (r.rowCount !== 1) {
      throw new Error("insertSyntheticProduct · insert returned no row");
    }
    return { id: String(r.rows[0].id) };
  } finally {
    await c.end();
  }
}

/**
 * Save an intro message through the REAL /manage/shop/intro form and
 * wait for the sealed success banner. The server action redirects to
 * /manage/shop/intro?s=saved on success; the page then reads from the
 * DB (dynamic=force-dynamic) and renders the stored value in the
 * textarea default. We wait on the banner, not a timeout.
 */
async function saveIntroViaUI(page: Page, intro: string): Promise<void> {
  await page.goto("/nex-native/manage/shop/intro", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  // Wait for the sealed editor root · if the page is still showing
  // loading.tsx or just hasn't hydrated yet, the selector will appear
  // when the server component resolves. 20s accommodates dev-mode
  // compile-on-demand.
  await expect(
    page.locator("[data-nex-shop-intro-editor]"),
  ).toBeVisible({ timeout: 20_000 });
  const textarea = page.locator("#intro-textarea");
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  // Clear defensively · the page uses React defaultValue which
  // re-asserts on hydration · straight fill("") can race the
  // hydration write. Select-all + delete is deterministic and ends
  // in a controlled empty value.
  await textarea.focus();
  await textarea.press("ControlOrMeta+a");
  await textarea.press("Delete");
  await expect(textarea).toHaveValue("", { timeout: 5_000 });
  await textarea.fill(intro);
  await expect(textarea).toHaveValue(intro, { timeout: 5_000 });
  await page.locator("[data-nex-shop-intro-save]").click();
  // Server action redirects to ?s=saved · the page then renders the
  // success banner. Wait on the redirect-arrival state, not a timeout.
  await page.waitForURL(
    (u) =>
      u.pathname === "/nex-native/manage/shop/intro" &&
      u.searchParams.get("s") === "saved",
    { timeout: 60_000, waitUntil: "domcontentloaded" },
  );
  await expect(
    page.locator("[role='status']", { hasText: "Intro saved" }),
  ).toBeVisible({ timeout: 10_000 });
}

// ─── test config ──────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
// 2026-11-15 · hardcode base URL default = http://localhost:3008 (the
// port `npm run dev` binds). The shared p6-isolation config defaults
// to :3010 which is wrong for this spec · override in-file so the spec
// is runnable without env tampering. PLAYWRIGHT_TEST_BASE_URL still
// wins if set.
test.use({
  baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
});

// ─── Suite ────────────────────────────────────────────────────────

test.describe("Seller onboarding + shop + products (sandbox · Rosa)", () => {
  let ctx: BrowserContext;
  let page: Page;
  let originalState: RosaState;
  let syntheticProductName: string;

  test.beforeAll(async ({ browser }) => {
    // Clean up any orphaned synthetic products from a prior failed run
    // BEFORE capturing originalState · prevents the leak-feedback loop
    // where originalState records an inflated product count because a
    // previous run's cleanup didn't execute. cleanupSyntheticProducts
    // hard-refuses anything that isn't name LIKE 'E2E Synthetic Widget %'.
    // We need Rosa's business ID first · read it raw.
    const pre = await readRosaState();
    const purged = await cleanupSyntheticProducts(pre.businessId);
    if (purged > 0) {
      // eslint-disable-next-line no-console
      console.log(`beforeAll · purged ${purged} orphaned synthetic product(s)`);
    }

    // Snapshot Rosa's clean state AFTER the purge. afterAll compares
    // against this to prove nothing leaked.
    originalState = await readRosaState();
    if (originalState.vaultSetupRows < 0) {
      throw new Error("readRosaState · impossible vault count");
    }

    ctx = await browser.newContext();
    page = await ctx.newPage();
  });

  test.afterAll(async () => {
    // 1. Restore the original intro message through the UI (same path
    //    a seller would use). If Rosa had a blank intro, we still save
    //    "" which maps to the default template.
    //    Skip the UI restore if the DB already matches the original ·
    //    avoids a noisy failure when Step 4 never ran (prior step
    //    failure) and the intro is untouched.
    try {
      const current = await readRosaState();
      if (current.shopIntroMessage !== originalState.shopIntroMessage) {
        await saveIntroViaUI(page, originalState.shopIntroMessage);
      }
    } catch (e) {
      // Fail soft on cleanup · we still try to delete the product.
      // eslint-disable-next-line no-console
      console.error("intro restore failed:", e);
    }

    // 2. Delete synthetic products from DB (hard-prefix-refuse).
    const deleted = await cleanupSyntheticProducts(originalState.businessId);
    // eslint-disable-next-line no-console
    console.log(`cleanup · deleted ${deleted} synthetic product(s)`);

    // 3. Read Rosa's state again and assert PRESERVED.
    const finalState = await readRosaState();
    // Vault setup rows must be unchanged (never touched).
    expect(finalState.vaultSetupRows).toBe(originalState.vaultSetupRows);
    // Business identity preserved.
    expect(finalState.businessId).toBe(originalState.businessId);
    expect(finalState.businessSlug).toBe(originalState.businessSlug);
    expect(finalState.businessDisplayName).toBe(originalState.businessDisplayName);
    // Intro restored (character-exact).
    expect(finalState.shopIntroMessage).toBe(originalState.shopIntroMessage);
    // Rosa's product-row preservation is checked BY PREFIX · we cannot
    // assert exact productCount equality because other concurrent
    // tests (e.g. customer-to-seller-order) may transiently add/remove
    // rows on Rosa's business under their own prefixes. What this
    // spec guarantees is that EVERY row matching the synthetic prefix
    // this spec writes is deleted at teardown. The DB check below
    // reads directly to prove zero remnants.
    const remnants = await countSyntheticRemnants(originalState.businessId);
    expect(remnants).toBe(0);

    // Playwright on Windows can race on trace artefact copy during
    // context close when prior runs left half-written files. Swallow
    // the ENOENT from the tracing shutdown so it never masks a real
    // preservation failure above.
    try {
      await ctx.close();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        "ctx.close() warning · swallowed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  });

  test("Step 1 · Rosa signs in · lands on /contacts", async () => {
    // Hard-refuse if the credential bundle looks like Hammerex.
    expect(SELLER_EMAIL).not.toContain("customer");
    expect(SELLER_EMAIL).not.toContain("99901");

    await signIn(page, SELLER_EMAIL, SELLER_PASSWORD);
    const u = new URL(page.url());
    expect(u.pathname).toBe("/nex-native/contacts");
  });

  test("Step 2 · /manage renders the Shop Management hub", async () => {
    await page.goto("/nex-native/manage", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    // The hub root marker + the Rosa-specific display name must both
    // be present. If Rosa somehow has no business the redirect would
    // land on /manage/shop/setup instead.
    await expect(
      page.locator("[data-nex-shop-management-centre]"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("h1", { hasText: "Shop Settings" })).toBeVisible();
    // Core customisation entry points must be linked.
    await expect(
      page.locator('[data-nex-manage-link="/nex-native/manage/shop/intro"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-nex-manage-link="/nex-native/manage/products"]'),
    ).toBeVisible();
    await screenshot(page, "01-manage-hub");
  });

  test("Step 3 · /manage/shop/setup dispatches to Review (Rosa setup complete)", async () => {
    // The setup dispatcher is a server-only page that calls redirect()
    // based on current state (display_name + city + category + cover +
    // products). Rosa's fixture has everything · the dispatcher lands
    // her on /setup/review. We wait on the URL settle because the
    // page tree streams loading.tsx first.
    await page.goto("/nex-native/manage/shop/setup", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForURL(
      (url) => url.pathname !== "/nex-native/manage/shop/setup",
      { timeout: 30_000, waitUntil: "domcontentloaded" },
    );
    const u = new URL(page.url());
    expect(u.pathname).toBe("/nex-native/manage/shop/setup/review");
    await screenshot(page, "02-setup-review");
  });

  test("Step 4 · intro customisation persists through save + reload", async () => {
    const stamp = `E2E · synthetic intro · ${Date.now()}`;
    await saveIntroViaUI(page, stamp);
    await screenshot(page, "03-intro-saved");

    // Reload without the ?s=saved param so the banner does not mask
    // the textarea default. Assert the stored value is now in the
    // textarea.
    await page.goto("/nex-native/manage/shop/intro", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(page.locator("#intro-textarea")).toHaveValue(stamp, {
      timeout: 10_000,
    });
    // Preview bubble also reflects the saved value.
    await expect(
      page.locator("[data-nex-shop-intro-preview]"),
    ).toContainText(stamp, { timeout: 10_000 });
  });

  test("Step 5 · Products list renders + synthetic product appears after insert", async () => {
    // Baseline count from the UI.
    await page.goto(
      `/nex-native/manage/products?business=${encodeURIComponent(originalState.businessId)}&filter=all`,
      { waitUntil: "domcontentloaded", timeout: 60_000 },
    );
    await expect(page.locator("h1", { hasText: originalState.businessDisplayName })).toBeVisible({
      timeout: 15_000,
    });

    // Create a synthetic product. We write directly to nex_product
    // because /nex-native/create/product/form is a 404 on this branch
    // (reproduced defect · see spec header). The storefront render is
    // still exercised through the real UI.
    syntheticProductName = `${SYNTHETIC_PREFIX}${Date.now()}`;
    await insertSyntheticProduct(originalState.businessId, syntheticProductName);

    // Reload the UI product list · the new row must appear in the
    // server-rendered page (listProductsByBusiness runs server-side).
    await page.goto(
      `/nex-native/manage/products?business=${encodeURIComponent(originalState.businessId)}&filter=all`,
      { waitUntil: "domcontentloaded", timeout: 60_000 },
    );
    await expect(
      page.locator("body", { hasText: syntheticProductName }),
    ).toBeVisible({ timeout: 15_000 });
    // Narrower assertion · the product card renders the name text.
    await expect(
      page.getByText(syntheticProductName, { exact: false }).first(),
    ).toBeVisible({ timeout: 10_000 });
    await screenshot(page, "04-products-list-with-synthetic");
  });

  test("Step 6 · public storefront renders the synthetic product", async () => {
    const publicUrl = `/nex-native/${originalState.businessSlug}`;
    await page.goto(publicUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    // Public shop renders every live product through the cover layout.
    // Assert the synthetic name text appears in the page body.
    await expect(
      page.locator("body", { hasText: syntheticProductName }),
    ).toBeVisible({ timeout: 20_000 });
    await screenshot(page, "05-public-shop-with-synthetic");
  });
});
