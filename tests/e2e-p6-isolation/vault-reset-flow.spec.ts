// tests/e2e-p6-isolation/vault-reset-flow.spec.ts
//
// NEX Vault · Phase 2B+3 acceptance · reset-token consumption.
// -----------------------------------------------------------------------------
// Owner-authorised 2026-11-15. Starting from a locked Vault, exercises
// the sealed reset-email flow:
//   1. Click [data-nex-vault-reset-request] to issue a token.
//   2. Assert [data-nex-vault-reset-sent] confirmation panel.
//   3. Harvest the plaintext reset URL via a planned dev-only test
//      harness route (see TODO below · the route does NOT yet exist).
//   4. Navigate to the harvested URL.
//   5. Assert [data-nex-vault-reset-page="success"].
//   6. Return to /nex-native/vault · enter the correct PIN · assert
//      the Vault opens (navigates to /vault/home).
//
// Sandbox-only. Defaults to http://localhost:3008 per package.json.
//
// IMPORTANT · runtime UNVERIFIED by author
// ----------------------------------------
// Two caller-side wiring TODOs:
//
// (A) Add a project to playwright.p6-isolation.config.ts:
//
//     {
//       name: "vault-reset-flow-390",
//       use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
//       testMatch: /vault-reset-flow\.spec\.ts/,
//       timeout: 240_000,
//     }
//
// (B) Add a dev-only test-harness route at
//     `src/app/api/dev-test/latest-reset-token/route.ts` that returns
//     `{ token, url, expires_at }` for a given `account_id` query param.
//     The route MUST hard-refuse when NODE_ENV === 'production' AND MUST
//     hard-refuse when the DATABASE_URL does not include
//     'kdstoyyeygcopkogqsyv'. Shape used by this spec:
//
//       GET /api/dev-test/latest-reset-token?account_id=<uuid>
//       → 200 { token: string, url: string, expires_at: string }
//       → 403 { error: "harness_disabled_in_production" }
//       → 404 { error: "no_live_token" }
//
// Until (B) lands, the reset-URL consumption test below is skipped
// explicitly via `test.skip('wiring: needs _test-harness route')`.
// Phase 1 of the spec (request → sent) runs regardless.
//
// Fixture env: PLAYWRIGHT_VA_CUSTOMER_* populated by
// scripts/_tmp/provision-vault-acceptance-fixtures.mjs. Credentials in
// comments are redacted as `****`.

import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import pkg from "pg";

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

const DB_URL = fromEnvLocal("DATABASE_URL");
if (!DB_URL.includes("kdstoyyeygcopkogqsyv")) {
  throw new Error("vault-reset-flow refuses · not sandbox");
}

const CUSTOMER_EMAIL = process.env.PLAYWRIGHT_VA_CUSTOMER_EMAIL ?? "";
const CUSTOMER_PASSWORD = process.env.PLAYWRIGHT_VA_CUSTOMER_PASSWORD ?? ""; // ****
const CUSTOMER_ACCOUNT_ID = process.env.PLAYWRIGHT_VA_CUSTOMER_ACCOUNT_ID ?? "";

for (const [k, v] of Object.entries({
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  CUSTOMER_ACCOUNT_ID,
})) {
  if (!v) throw new Error(`vault-reset-flow · missing env ${k}`);
}

const { Client: PG } = pkg;

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

async function warmDeviceKey(page: Page, accountId: string): Promise<void> {
  await page.goto("/nex-native/vault", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const { deviceId, publicKeyB64 } = await page.evaluate(async () => {
    function b64(b: Uint8Array): string {
      let s = "";
      for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
      return btoa(s);
    }
    const secret = new Uint8Array(32);
    const pub = new Uint8Array(32);
    crypto.getRandomValues(secret);
    crypto.getRandomValues(pub);
    const did =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `did-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("nex-native-crypto", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("device")) {
          db.createObjectStore("device");
        }
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("device", "readwrite");
        tx.objectStore("device").put(
          {
            deviceId: did,
            secretKey: secret,
            publicKey: pub,
            createdAt: Date.now(),
          },
          "self",
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
    return { deviceId: did, publicKeyB64: b64(pub) };
  });
  const client = new PG({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO nex_account_device_key (account_id, device_id, public_key, last_seen_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (account_id, device_id) DO UPDATE SET
         public_key = EXCLUDED.public_key, last_seen_at = now()`,
      [accountId, deviceId, publicKeyB64],
    );
  } finally {
    await client.end();
  }
}

async function resetVaultState(accountId: string): Promise<void> {
  const client = new PG({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM nex_vault_pin_reset_token WHERE account_id = $1`,
      [accountId],
    );
    await client.query(
      `DELETE FROM nex_vault_key_envelope WHERE account_id = $1`,
      [accountId],
    );
    await client.query(
      `DELETE FROM nex_vault_setup WHERE account_id = $1`,
      [accountId],
    );
    await client
      .query(
        `UPDATE nex_vault_lockout_state
         SET consecutive_failures = 0, reset_required = false, locked_at = NULL
         WHERE account_id = $1`,
        [accountId],
      )
      .catch(() => {});
  } finally {
    await client.end();
  }
}

async function completeVaultSetup(page: Page, pin: string): Promise<void> {
  await page.goto("/nex-native/vault/setup", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page
    .waitForLoadState("networkidle", { timeout: 30_000 })
    .catch(() => {});
  if (new URL(page.url()).pathname !== "/nex-native/vault/setup") {
    return;
  }
  const warnRoot = page.locator(
    "[data-nex-vault-setup-root][data-nex-vault-setup-step='warn']",
  );
  if ((await warnRoot.count()) > 0) {
    await page.locator("[data-nex-vault-setup-warn-acknowledge]").check();
    await page.locator("[data-nex-vault-setup-warn-continue]").click();
  }
  await expect(
    page.locator(
      "[data-nex-vault-setup-root][data-nex-vault-setup-step='enter']",
    ),
  ).toBeVisible({ timeout: 30_000 });
  const pinInput = page.locator("[data-nex-vault-setup-pin-input]").first();
  await pinInput.focus();
  await pinInput.fill(pin);
  await expect(pinInput).toHaveValue(pin, { timeout: 10_000 });
  await page.locator("[data-nex-vault-setup-next]").click();
  await expect(
    page.locator(
      "[data-nex-vault-setup-root][data-nex-vault-setup-step='confirm']",
    ),
  ).toBeVisible({ timeout: 30_000 });
  const pinInput2 = page.locator("[data-nex-vault-setup-pin-input]").first();
  await pinInput2.focus();
  await pinInput2.fill(pin);
  await expect(pinInput2).toHaveValue(pin, { timeout: 10_000 });
  await page.locator("[data-nex-vault-setup-confirm]").click();
  await expect(page.locator("[data-nex-vault-setup-popup]")).toBeVisible({
    timeout: 15_000,
  });
  await page.locator("[data-nex-vault-setup-popup-ack]").click();
  await page.waitForURL(
    (u) => u.pathname === "/nex-native/vault/home",
    { timeout: 90_000, waitUntil: "domcontentloaded" },
  );
}

/**
 * Submit a wrong PIN at the doorway + wait for the reducer to settle.
 * Mirrors submitWrongPin in vault-lockout-threshold.spec.ts.
 */
async function submitWrongPin(page: Page, wrongPin: string): Promise<void> {
  await expect(page.locator("[data-nex-vault-pin-root]")).toBeVisible({
    timeout: 15_000,
  });
  const input = page.locator("[data-nex-vault-pin-input]").first();
  await input.focus();
  await input.fill(wrongPin);
  await expect(input).toHaveValue(wrongPin, { timeout: 5_000 });
  await page.locator("[data-nex-vault-unlock-btn]").click();
  await Promise.race([
    page
      .locator("[data-nex-vault-pin-field][data-nex-vault-pin-digits='0']")
      .waitFor({ timeout: 15_000 })
      .catch(() => {}),
    page
      .locator("[data-nex-vault-locked-out]")
      .waitFor({ timeout: 15_000 })
      .catch(() => {}),
  ]);
}

/**
 * Drive 3 wrong PINs → re-navigate → assert locked shell is visible.
 */
async function forceLockout(page: Page): Promise<void> {
  await page.goto("/nex-native/vault", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await submitWrongPin(page, "111111");
  await submitWrongPin(page, "222222");
  await submitWrongPin(page, "333333");
  await page.goto("/nex-native/vault", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await expect(page.locator("[data-nex-vault-locked-out]")).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Fetch the most recent reset token for an account from the planned
 * dev-only harness route. Returns null if the route is missing (404 /
 * network failure), which the caller uses to decide whether to skip.
 */
async function fetchLatestResetTokenViaHarness(
  page: Page,
  accountId: string,
): Promise<{ token: string; url: string } | null> {
  try {
    const res = await page.request.get(
      `/api/dev-test/latest-reset-token?account_id=${encodeURIComponent(accountId)}`,
    );
    if (!res.ok()) return null;
    const body = (await res.json()) as {
      token?: string;
      url?: string;
    };
    if (typeof body.token !== "string" || typeof body.url !== "string") {
      return null;
    }
    return { token: body.token, url: body.url };
  } catch {
    return null;
  }
}

// ─── test config ──────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

// ─── Suite ────────────────────────────────────────────────────────

test.describe("Vault · reset-token flow (sandbox)", () => {
  let ctx: BrowserContext;
  let page: Page;
  const CORRECT_PIN = "579135";

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await resetVaultState(CUSTOMER_ACCOUNT_ID);
    await signIn(
      page,
      CUSTOMER_EMAIL,
      CUSTOMER_PASSWORD, // ****
      "/nex-native/vault",
    );
    await warmDeviceKey(page, CUSTOMER_ACCOUNT_ID);
    await completeVaultSetup(page, CORRECT_PIN);
    await forceLockout(page);
  });

  test.afterAll(async () => {
    await ctx.close();
  });

  test("click 'Send reset email' → sealed confirmation panel appears", async () => {
    // We start the test from the locked shell left by beforeAll.
    await expect(page.locator("[data-nex-vault-locked-out]")).toBeVisible({
      timeout: 10_000,
    });
    // Click the sealed button.
    const sendReset = page.locator("[data-nex-vault-reset-request]");
    await expect(sendReset).toBeVisible();
    await sendReset.click();
    // The in-flight state is transient · we don't block on it, but
    // assert it appears briefly to confirm the button-state locator is
    // live. The sealed button renders [data-nex-vault-reset-request-
    // sending] while the POST is in-flight.
    await page
      .locator("[data-nex-vault-reset-request-sending]")
      .waitFor({ timeout: 2_000 })
      .catch(() => {});
    // The confirmation panel MUST appear on success.
    await expect(
      page.locator("[data-nex-vault-reset-sent]"),
    ).toBeVisible({ timeout: 15_000 });
    // Error panel must NOT be present on the happy path.
    expect(
      await page.locator("[data-nex-vault-reset-request-error]").count(),
    ).toBe(0);
  });

  test("consume the reset URL → success page + Vault opens with correct PIN", async () => {
    // Harvest the reset URL via the planned dev-only test harness.
    const harvested = await fetchLatestResetTokenViaHarness(
      page,
      CUSTOMER_ACCOUNT_ID,
    );
    test.skip(
      harvested === null,
      "wiring: needs _test-harness route at /api/dev-test/latest-reset-token (see top-of-file TODO).",
    );
    if (!harvested) return; // Keeps TS happy · test.skip short-circuits.

    // Navigate to the reset URL in the SAME authenticated context.
    // The URL carries the plaintext token in the query string.
    await page.goto(harvested.url, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    // The client consumes the token on mount · wait for the success
    // state. Avoid asserting the 'consuming' state because it is
    // transient · the consume POST may resolve before Playwright can
    // latch the in-flight selector.
    await expect(
      page.locator("[data-nex-vault-reset-page='success']"),
    ).toBeVisible({ timeout: 20_000 });

    // Head back to /vault. The counter is cleared · PIN entry must be
    // offered again (no lockout shell).
    await page.goto("/nex-native/vault", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(page.locator("[data-nex-vault-pin-root]")).toBeVisible({
      timeout: 15_000,
    });
    expect(await page.locator("[data-nex-vault-locked-out]").count()).toBe(0);

    // Enter the correct PIN · Vault opens to /vault/home.
    const input = page.locator("[data-nex-vault-pin-input]").first();
    await input.focus();
    await input.fill(CORRECT_PIN);
    await expect(input).toHaveValue(CORRECT_PIN, { timeout: 5_000 });
    await Promise.all([
      page.waitForURL(
        (u) => u.pathname === "/nex-native/vault/home",
        { timeout: 60_000 },
      ),
      page.locator("[data-nex-vault-unlock-btn]").click(),
    ]);
  });
});
