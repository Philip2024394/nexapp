// tests/e2e-p6-isolation/vault-lockout-threshold.spec.ts
//
// NEX Vault · Phase 1-3 acceptance · 3-strike lockout threshold.
// -----------------------------------------------------------------------------
// Owner-authorised 2026-11-15. Drives the SEALED Vault setup wizard,
// then submits 3 consecutive wrong PINs via the sealed doorway. The
// 4th navigation to /nex-native/vault must render the lockout shell
// (`data-nex-vault-locked-out`) with the "Send reset email" affordance
// visible.
//
// Sandbox-only. Defaults to http://localhost:3008 per package.json
// (`npm run dev`). Override with PLAYWRIGHT_TEST_BASE_URL.
//
// IMPORTANT · runtime UNVERIFIED by author
// ----------------------------------------
// This spec is authored against the sealed UI contract but was NOT
// executed in this session · the P6 config currently defaults to
// http://localhost:3010 and this file's new project (see below) needs
// to be added to playwright.p6-isolation.config.ts before it can be
// picked up by `npx playwright test --config=playwright.p6-isolation.config.ts`.
// A sample project block that the main thread should add:
//
//   {
//     name: "vault-lockout-threshold-390",
//     use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
//     testMatch: /vault-lockout-threshold\.spec\.ts/,
//     timeout: 180_000,
//   }
//
// The spec also assumes the P6 fixture provisioner
// (`scripts/_tmp/provision-vault-acceptance-fixtures.mjs`) has run so
// PLAYWRIGHT_VA_CUSTOMER_* env vars are populated. Credentials in
// comments below are redacted as `****`.

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
  throw new Error("vault-lockout-threshold refuses · not sandbox");
}

const CUSTOMER_EMAIL = process.env.PLAYWRIGHT_VA_CUSTOMER_EMAIL ?? "";
const CUSTOMER_PASSWORD = process.env.PLAYWRIGHT_VA_CUSTOMER_PASSWORD ?? ""; // ****
const CUSTOMER_ACCOUNT_ID = process.env.PLAYWRIGHT_VA_CUSTOMER_ACCOUNT_ID ?? "";

for (const [k, v] of Object.entries({
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  CUSTOMER_ACCOUNT_ID,
})) {
  if (!v) throw new Error(`vault-lockout-threshold · missing env ${k}`);
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

/**
 * Seed a device key for the signed-in account by generating a random
 * secret/public keypair in the browser (IndexedDB) and upserting the
 * matching public_key row in nex_account_device_key. Mirrors the
 * warmDeviceKey helper from vault-chat-behavior.spec.ts exactly so the
 * doorway bootstrap resolves the device correctly.
 */
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

/**
 * Reset Vault state for this account. Needed because a prior spec run
 * may have left a nex_vault_setup row, a locked counter, or a stale
 * reset token that would short-circuit this spec's happy path.
 */
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
    // Clear any outstanding lockout counter from a previous run. The
    // column name is governed by migration 346 · if the table shape
    // differs, this UPDATE will no-op (acceptable · the lockout state
    // is read by the server service, not this spec).
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

/**
 * Drive the SEALED Vault setup wizard (warn → enter → confirm → popup
 * → home). Lifted from vault-chat-behavior.spec.ts verbatim (selectors
 * are sealed).
 */
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
 * Submit ONE wrong PIN at the sealed doorway. The sealed PIN field
 * auto-submits via the orchestrator once isSubmittable returns true,
 * but the form also supports explicit submit · we drive submit via
 * [data-nex-vault-unlock-btn] to be deterministic.
 *
 * After each wrong attempt the reducer transitions to the 'wrong' state
 * which clears the digits and keeps the user on /vault. Returns when
 * the client has either (a) re-rendered the PIN field cleared, or
 * (b) navigated away (which would be unexpected).
 */
async function submitWrongPin(page: Page, wrongPin: string): Promise<void> {
  // Ensure doorway is mounted.
  await expect(page.locator("[data-nex-vault-pin-root]")).toBeVisible({
    timeout: 15_000,
  });
  const input = page.locator("[data-nex-vault-pin-input]").first();
  await input.focus();
  await input.fill(wrongPin);
  await expect(input).toHaveValue(wrongPin, { timeout: 5_000 });
  await page.locator("[data-nex-vault-unlock-btn]").click();
  // Wait for the reducer to settle · either the field is cleared (wrong
  // state) or the whole surface swaps to locked_out. We just wait for
  // the input to be re-enabled OR the locked-out container to appear.
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

// ─── test config ──────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

// ─── Suite ────────────────────────────────────────────────────────

test.describe("Vault · 3-strike lockout threshold (sandbox)", () => {
  let ctx: BrowserContext;
  let page: Page;
  const CORRECT_PIN = "468024";
  const WRONG_PIN_1 = "111111";
  const WRONG_PIN_2 = "222222";
  const WRONG_PIN_3 = "333333";

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
  });

  test.afterAll(async () => {
    // Leave the locked state in place · downstream specs may depend on
    // it. The resetVaultState helper runs in beforeAll of each spec so
    // residue is fine.
    await ctx.close();
  });

  test("3 wrong PINs at the sealed doorway lands on the locked-out shell + Send-reset-email is visible", async () => {
    // Navigate back to the doorway · completeVaultSetup landed us on
    // /vault/home with VMK alive. A full page.goto to /vault wipes
    // module state so the PIN entry re-mounts cleanly.
    await page.goto("/nex-native/vault", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(page.locator("[data-nex-vault-pin-root]")).toBeVisible({
      timeout: 15_000,
    });

    // Attempt 1 · wrong.
    await submitWrongPin(page, WRONG_PIN_1);
    // After the first wrong PIN we should NOT be on the lockout screen
    // yet. The reducer stays on 'wrong' state within the doorway.
    expect(await page.locator("[data-nex-vault-locked-out]").count()).toBe(0);

    // Attempt 2 · wrong.
    await submitWrongPin(page, WRONG_PIN_2);
    expect(await page.locator("[data-nex-vault-locked-out]").count()).toBe(0);

    // Attempt 3 · wrong. This bumps the counter to the sealed
    // VAULT_PIN_LOCKOUT_THRESHOLD (3). The next probe at /vault will
    // see the server's 403 vault_locked_reset_required and render the
    // locked_out bootstrap state.
    await submitWrongPin(page, WRONG_PIN_3);

    // Re-mount the bootstrap by navigating back to /vault. The 4th
    // attempt is BLOCKED at the shell layer · the UI must never show
    // the PIN field again until the email reset clears the counter.
    await page.goto("/nex-native/vault", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page
      .waitForLoadState("networkidle", { timeout: 20_000 })
      .catch(() => {});

    // Locked-out container must be visible.
    await expect(page.locator("[data-nex-vault-locked-out]")).toBeVisible({
      timeout: 15_000,
    });

    // Headline copy must be the sealed string.
    await expect(
      page.locator("[data-nex-vault-locked-out-headline]"),
    ).toHaveText("Three incorrect PIN attempts", { timeout: 5_000 });

    // "Send reset email" affordance must be present + clickable.
    const sendReset = page.locator("[data-nex-vault-reset-request]");
    await expect(sendReset).toBeVisible({ timeout: 5_000 });
    await expect(sendReset).toBeEnabled();

    // The PIN field MUST NOT be rendered · the sealed bootstrap swaps
    // the DoorwayShell for the LockedOutShell on this state.
    expect(await page.locator("[data-nex-vault-pin-root]").count()).toBe(0);

    // Device-id chip is present (short-form display).
    await expect(
      page.locator("[data-nex-vault-locked-out-device-id]"),
    ).toBeVisible({ timeout: 5_000 });
  });
});
