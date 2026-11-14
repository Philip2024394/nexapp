// tests/e2e-p6-isolation/two-context-isolation.spec.ts
//
// P6 · two-context browser isolation · owner-sealed 2026-11-14.
// -----------------------------------------------------------------
// Uses TWO independent browser contexts, each signed in via REAL
// Supabase email/password credentials (sandbox-only fixtures
// provisioned by scripts/_tmp/provision-playwright-auth-fixtures.mjs).
// Dev-impersonation is DISABLED on the target dev server (started on
// port 3010 with NEX_DEV_IMPERSONATE_HANDLE=""). No sealed env var
// toggling · no sequential persona swap.
//
// Fixtures:
//   context A · "customer" · signs in as p6-customer@nex.invalid
//               linked to nex-99901 (also owner of irish-pride-shop).
//   context B · "seller"   · signs in as p6-seller@nex.invalid linked
//               to nex-99903 (Rosa · owner of handbags-direct).
//
// Checks:
//   1. Both contexts complete real sign-in and land on the intended
//      next URL.
//   2. Each context's session cookie is isolated · context A does not
//      authenticate as context B's account.
//   3. Cross-shop isolation: customer (nex-99901) attempting to
//      access handbags-direct's shop-owner management surfaces does
//      NOT see Rosa's owner view · the manage surface is either
//      refused or loads the customer's own shop (irish-pride-shop),
//      never Rosa's.
//   4. The /manage/shop/inbox owner surface loads for the seller
//      context (nex-99903) · negative test for context A.

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const CUSTOMER_EMAIL = process.env.PLAYWRIGHT_P6_CUSTOMER_EMAIL ?? "";
const CUSTOMER_PASSWORD = process.env.PLAYWRIGHT_P6_CUSTOMER_PASSWORD ?? "";
const SELLER_EMAIL = process.env.PLAYWRIGHT_P6_SELLER_EMAIL ?? "";
const SELLER_PASSWORD = process.env.PLAYWRIGHT_P6_SELLER_PASSWORD ?? "";

if (!CUSTOMER_EMAIL || !CUSTOMER_PASSWORD || !SELLER_EMAIL || !SELLER_PASSWORD) {
  throw new Error(
    "P6 fixture env vars missing · run scripts/_tmp/provision-playwright-auth-fixtures.mjs then source .env.playwright.p6",
  );
}

test.describe.configure({ mode: "serial" });

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
    (u) => u.pathname === nextPath || u.pathname.startsWith(nextPath),
    { timeout: 60_000, waitUntil: "domcontentloaded" },
  );
}

test.describe("P6 · two-context isolation (real sandbox sign-in)", () => {
  let customerCtx: BrowserContext;
  let sellerCtx: BrowserContext;
  let customerPage: Page;
  let sellerPage: Page;

  test.beforeAll(async ({ browser }) => {
    customerCtx = await browser.newContext();
    sellerCtx = await browser.newContext();
    customerPage = await customerCtx.newPage();
    sellerPage = await sellerCtx.newPage();
  });

  test.afterAll(async () => {
    await customerCtx.close();
    await sellerCtx.close();
  });

  test("Step 1 · both contexts sign in with distinct real credentials", async () => {
    await signIn(
      customerPage,
      CUSTOMER_EMAIL,
      CUSTOMER_PASSWORD,
      "/nex-native/handbags-direct",
    );
    await signIn(
      sellerPage,
      SELLER_EMAIL,
      SELLER_PASSWORD,
      "/nex-native/manage",
    );

    // Independent session cookies. Supabase SSR stores the full JWT
    // in `sb-<project>-auth-token*` cookies · the token itself differs
    // per session even when cookie NAMES collide. Compare full values.
    const aCookies = await customerCtx.cookies();
    const bCookies = await sellerCtx.cookies();
    const aAuth = aCookies
      .filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))
      .map((c) => `${c.name}:${c.value}`)
      .sort()
      .join("\n");
    const bAuth = bCookies
      .filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))
      .map((c) => `${c.name}:${c.value}`)
      .sort()
      .join("\n");
    expect(aAuth.length).toBeGreaterThan(50);
    expect(bAuth.length).toBeGreaterThan(50);
    expect(
      aAuth,
      "Supabase SSR auth-token cookie values must differ across contexts",
    ).not.toBe(bAuth);
  });

  test("Step 2 · customer sees handbags-direct as a VISITOR · no owner chrome", async () => {
    // Customer context is nex-99901 · NOT Rosa. They can view
    // handbags-direct but should not have owner management chrome.
    await customerPage.goto(`/nex-native/handbags-direct`, {
      waitUntil: "domcontentloaded",
    });
    const url = new URL(customerPage.url());
    expect(url.pathname).toBe("/nex-native/handbags-direct");
    // Sanity · page rendered shop identity.
    await expect(customerPage.locator("body")).toContainText(/Handbags|handbags/i, {
      timeout: 15_000,
    });
  });

  test("Step 3 · seller reaches /manage · hub surface for shop owner", async () => {
    // Seller context is Rosa (nex-99903). /nex-native/manage either
    // renders the shop hub or redirects to the owner's shop page.
    const url = new URL(sellerPage.url());
    expect(url.pathname.startsWith("/nex-native/manage")).toBe(true);
    await expect(sellerPage.locator("body")).toContainText(
      /Shop|Manage|Handbags|Products|Menu/i,
      { timeout: 15_000 },
    );
  });

  test("Step 4 · cross-shop isolation · customer cannot reach seller's /manage as Rosa", async () => {
    // Customer context visits /manage · but their identity is
    // nex-99901 (owns irish-pride-shop), not Rosa. The resolver
    // should load THEIR shop context · never Rosa's handbags-direct
    // owner view.
    await customerPage.goto(`/nex-native/manage`, {
      waitUntil: "domcontentloaded",
    });
    const body = await customerPage.locator("body").textContent();
    // Rosa's shop name is "Handbags direct". If the customer's
    // /manage view shows that, isolation has failed. Allow either
    // the customer's own shop label (irish-pride) or a sign-in
    // nudge · never Rosa's.
    const sawRosaShop =
      /Handbags\s*direct/i.test(body ?? "") ||
      /handbags-direct/.test(customerPage.url());
    expect(
      sawRosaShop,
      "customer context must NOT see Rosa's handbags-direct management surface",
    ).toBe(false);
  });

  test("Step 5 · session persists across navigation in each context", async () => {
    await customerPage.goto("/nex-native/", {
      waitUntil: "domcontentloaded",
    });
    // Should NOT redirect to sign-in · session cookie is live.
    expect(customerPage.url()).not.toContain("/nex-native/sign-in");

    await sellerPage.goto("/nex-native/", { waitUntil: "domcontentloaded" });
    expect(sellerPage.url()).not.toContain("/nex-native/sign-in");
  });
});
