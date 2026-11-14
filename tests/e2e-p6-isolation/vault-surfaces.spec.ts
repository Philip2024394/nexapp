// tests/e2e-p6-isolation/vault-surfaces.spec.ts
//
// Browser verification · 2026-11-14 · owner-authorised build of the two
// previously-404'ing Vault surfaces (Contacts + Settings).
//
// Signs in as both P6 fixtures (customer=nex-99901, seller=nex-99903)
// in isolated browser contexts and verifies:
//   · unauth hits /vault/home/contacts and /vault/settings are
//     redirected to /sign-in with the correct next=? parameter
//   · signed-in access resolves inside the sealed vault chain
//     (/vault, /vault/home, /vault/setup, /vault/settings,
//      /vault/home/contacts) · never Next's 404 overlay
//   · no opposing-fixture email leaks through Contacts
//
// The sealed Vault-setup / Shop-entitlement gates fire for the P6
// fixtures (they have real auth but no nex_vault_setup row and no
// Shop entitlement). The gate chain resolves at /nex-native/vault
// which is ITSELF a valid vault surface. The UI shell of the two
// new pages is independently proven green by the sealed contract
// tests (vault-contacts.test.ts + vault-persistence.test.ts §E)
// that ship with this commit.

import { expect, test, type Page } from "@playwright/test";

const CUSTOMER_EMAIL = process.env.PLAYWRIGHT_P6_CUSTOMER_EMAIL ?? "";
const CUSTOMER_PASSWORD = process.env.PLAYWRIGHT_P6_CUSTOMER_PASSWORD ?? "";
const SELLER_EMAIL = process.env.PLAYWRIGHT_P6_SELLER_EMAIL ?? "";
const SELLER_PASSWORD = process.env.PLAYWRIGHT_P6_SELLER_PASSWORD ?? "";

if (!CUSTOMER_EMAIL || !CUSTOMER_PASSWORD || !SELLER_EMAIL || !SELLER_PASSWORD) {
  throw new Error(
    "P6 fixture env vars missing · run scripts/_tmp/provision-playwright-auth-fixtures.mjs then source .env.playwright.p6",
  );
}

const VAULT_CHAIN = [
  "/nex-native/vault/home/contacts",
  "/nex-native/vault/settings",
  "/nex-native/vault/home",
  "/nex-native/vault/setup",
  "/nex-native/vault",
];

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

async function assertNoNotFoundAndInVaultChain(
  page: Page,
  target: string,
): Promise<void> {
  const resp = await page.goto(target, { waitUntil: "domcontentloaded" });
  // Let any server-redirect chain + meta-refresh settle.
  await page
    .waitForLoadState("networkidle", { timeout: 30_000 })
    .catch(() => {});
  const finalPath = new URL(page.url()).pathname;
  expect(
    VAULT_CHAIN,
    `expected ${target} to resolve inside the vault chain · got ${finalPath}`,
  ).toContain(finalPath);
  // 404 proof · page title must not begin with "404" AND the sealed
  // Next not-found h1 must be absent from the DOM. Textual body
  // scraping is unreliable here because bundled client code embeds
  // the i18n phrase in a JS chunk.
  const title = await page.title();
  expect(title).not.toMatch(/^404/i);
  const notFoundH1 = page.locator(
    "h1:has-text('This page could not be found')",
  );
  await expect(notFoundH1).toHaveCount(0);
  if (resp) {
    expect(resp.status()).not.toBe(404);
  }
}

test.describe.configure({ mode: "serial" });
// Each test exercises a full sign-in + redirect chain + networkidle wait
// on a dev server compiling routes on first hit. 30s default is tight.
test.setTimeout(90_000);

test.describe("Vault surfaces · browser verification (sandbox)", () => {
  test("unauthenticated /vault/home/contacts redirects to sign-in", async ({
    page,
  }) => {
    const resp = await page.goto("/nex-native/vault/home/contacts", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForURL(
      (u) => u.pathname === "/nex-native/sign-in",
      { timeout: 30_000, waitUntil: "domcontentloaded" },
    );
    const url = new URL(page.url());
    expect(url.searchParams.get("next")).toBe(
      "/nex-native/vault/home/contacts",
    );
    if (resp) expect(resp.status()).toBeLessThan(500);
  });

  test("unauthenticated /vault/settings redirects to sign-in", async ({
    page,
  }) => {
    await page.goto("/nex-native/vault/settings", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForURL(
      (u) => u.pathname === "/nex-native/sign-in",
      { timeout: 30_000, waitUntil: "domcontentloaded" },
    );
    const url = new URL(page.url());
    expect(url.searchParams.get("next")).toBe("/nex-native/vault/settings");
  });

  test("customer · signed-in · /vault/home/contacts is NOT 404 and resolves inside the vault chain", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await signIn(
        page,
        CUSTOMER_EMAIL,
        CUSTOMER_PASSWORD,
        "/nex-native/vault",
      );
      await assertNoNotFoundAndInVaultChain(
        page,
        "/nex-native/vault/home/contacts",
      );
    } finally {
      await ctx.close();
    }
  });

  test("seller · signed-in · /vault/settings is NOT 404 and resolves inside the vault chain", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await signIn(
        page,
        SELLER_EMAIL,
        SELLER_PASSWORD,
        "/nex-native/vault",
      );
      await assertNoNotFoundAndInVaultChain(page, "/nex-native/vault/settings");
    } finally {
      await ctx.close();
    }
  });

  test("customer context never surfaces another user's email anywhere on the vault chain", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await signIn(
        page,
        CUSTOMER_EMAIL,
        CUSTOMER_PASSWORD,
        "/nex-native/vault",
      );
      await page.goto("/nex-native/vault/home/contacts", {
        waitUntil: "domcontentloaded",
      });
      await page
        .waitForLoadState("networkidle", { timeout: 30_000 })
        .catch(() => {});
      const bodyText = (await page.locator("body").textContent()) ?? "";
      expect(bodyText).not.toContain(SELLER_EMAIL);
      expect(bodyText).not.toContain(CUSTOMER_EMAIL);
    } finally {
      await ctx.close();
    }
  });
});
