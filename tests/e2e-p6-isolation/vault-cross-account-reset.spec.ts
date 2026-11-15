// tests/e2e-p6-isolation/vault-cross-account-reset.spec.ts
//
// NEX Vault · Phase 2B+3 cross-account defence.
// -----------------------------------------------------------------------------
// Owner-authorised 2026-11-15. Verifies the sealed `expectedAccountId`
// short-circuit in consumePinResetToken (src/lib/nex-native/vault/
// pin-reset-service.ts) by having two SIGNED-IN accounts (A and B)
// racing over the same reset URL:
//
//   Context A · locks account A's Vault + issues a reset token for A.
//   Context B · signs in as a DIFFERENT NEX account and navigates to
//               A's reset URL. The route MUST refuse with
//               token_account_mismatch BEFORE consuming the token.
//
//   (optional, if time permits) Context A then re-consumes A's URL and
//   succeeds · proves the token was not burned by B's attempt.
//
// The sealed behaviour under test:
//   · POST /api/nex-native/vault/escrow/reset-confirm returns 403
//     { ok: false, error: "token_account_mismatch" }
//   · The reset page renders
//     [data-nex-vault-reset-page="error"] with
//     [data-nex-reset-error-code="token_account_mismatch"]
//
// Sandbox-only. Defaults to http://localhost:3008 per package.json.
//
// IMPORTANT · runtime UNVERIFIED by author
// ----------------------------------------
// Two caller-side wiring TODOs (same as vault-reset-flow.spec.ts):
//
// (A) Add a project to playwright.p6-isolation.config.ts:
//
//     {
//       name: "vault-cross-account-reset-390",
//       use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
//       testMatch: /vault-cross-account-reset\.spec\.ts/,
//       timeout: 300_000,
//     }
//
// (B) The dev-only test-harness route described in
//     vault-reset-flow.spec.ts must exist to harvest the plaintext
//     token for account A. Until it lands, this spec test.skips the
//     Context B branch with a clear TODO.
//
// Fixture env:
//   · PLAYWRIGHT_VA_CUSTOMER_* → "Account A" (will be locked)
//   · PLAYWRIGHT_VA_SELLER_*   → "Account B" (signed in, uninvolved)
// Both populated by scripts/_tmp/provision-vault-acceptance-fixtures.mjs.
// Credentials in comments are redacted as `****`.

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
  throw new Error("vault-cross-account-reset refuses · not sandbox");
}

const A_EMAIL = process.env.PLAYWRIGHT_VA_CUSTOMER_EMAIL ?? "";
const A_PASSWORD = process.env.PLAYWRIGHT_VA_CUSTOMER_PASSWORD ?? ""; // ****
const A_ACCOUNT_ID = process.env.PLAYWRIGHT_VA_CUSTOMER_ACCOUNT_ID ?? "";
const B_EMAIL = process.env.PLAYWRIGHT_VA_SELLER_EMAIL ?? "";
const B_PASSWORD = process.env.PLAYWRIGHT_VA_SELLER_PASSWORD ?? ""; // ****
const B_ACCOUNT_ID = process.env.PLAYWRIGHT_VA_SELLER_ACCOUNT_ID ?? "";

for (const [k, v] of Object.entries({
  A_EMAIL,
  A_PASSWORD,
  A_ACCOUNT_ID,
  B_EMAIL,
  B_PASSWORD,
  B_ACCOUNT_ID,
})) {
  if (!v) throw new Error(`vault-cross-account-reset · missing env ${k}`);
}

if (A_ACCOUNT_ID === B_ACCOUNT_ID) {
  throw new Error(
    "vault-cross-account-reset · A and B fixtures resolve to the SAME account_id · aborting to avoid false-positive",
  );
}

const { Client: PG } = pkg;

// ─── helpers (lifted from sibling specs · keep them local so this spec stands alone) ──

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
        `UPDATE nex_vault_pin_lockout
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
 * Harvest the most recent reset token for an account via the planned
 * dev-only test harness route. See top-of-file TODO (B). Returns null
 * when the route is unavailable so the caller can test.skip gracefully.
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
test.setTimeout(300_000);

// ─── Suite ────────────────────────────────────────────────────────

test.describe("Vault · cross-account reset defence (sandbox)", () => {
  let aCtx: BrowserContext;
  let bCtx: BrowserContext;
  let aPage: Page;
  let bPage: Page;
  const A_PIN = "640280";
  let resetUrl: string | null = null;

  test.beforeAll(async ({ browser }) => {
    // TWO isolated contexts · each gets its own cookie jar, matching
    // the sealed two-context pattern in two-context-isolation.spec.ts.
    aCtx = await browser.newContext();
    bCtx = await browser.newContext();
    aPage = await aCtx.newPage();
    bPage = await bCtx.newPage();

    // Prepare account A · locked state with a reset-token issued.
    await resetVaultState(A_ACCOUNT_ID);
    await signIn(aPage, A_EMAIL, A_PASSWORD /* **** */, "/nex-native/vault");
    await warmDeviceKey(aPage, A_ACCOUNT_ID);
    await completeVaultSetup(aPage, A_PIN);
    await forceLockout(aPage);
    // Issue a reset token by clicking the sealed button in context A.
    await aPage.locator("[data-nex-vault-reset-request]").click();
    await expect(
      aPage.locator("[data-nex-vault-reset-sent]"),
    ).toBeVisible({ timeout: 15_000 });

    // Sign in account B in the SECOND isolated context. B does NOT
    // touch the Vault setup · it only needs an authenticated session
    // so that when it visits A's reset URL the server sees "a signed-
    // in session for B" and routes through the token_account_mismatch
    // short-circuit (as opposed to "not_signed_in").
    await signIn(bPage, B_EMAIL, B_PASSWORD /* **** */, "/nex-native/vault");

    // Harvest the plaintext reset URL for account A via the planned
    // dev-only test harness. Null → skip the cross-account test below.
    const harvested = await fetchLatestResetTokenViaHarness(
      aPage,
      A_ACCOUNT_ID,
    );
    resetUrl = harvested?.url ?? null;
  });

  test.afterAll(async () => {
    await aCtx.close();
    await bCtx.close();
  });

  test("account B opens account A's reset URL → sealed error page with token_account_mismatch", async () => {
    test.skip(
      resetUrl === null,
      "wiring: needs _test-harness route at /api/dev-test/latest-reset-token (see top-of-file TODO).",
    );
    if (!resetUrl) return;

    // Context B navigates to the URL. Because context B's cookies
    // authenticate as account B (NOT account A · the token owner),
    // the sealed consumePinResetToken short-circuit returns
    // token_account_mismatch BEFORE marking the token consumed.
    await bPage.goto(resetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    // The reset client renders the error state.
    await expect(
      bPage.locator("[data-nex-vault-reset-page='error']"),
    ).toBeVisible({ timeout: 20_000 });
    // AND it carries the specific error-code attribute.
    await expect(
      bPage.locator(
        "[data-nex-vault-reset-page='error'][data-nex-reset-error-code='token_account_mismatch']",
      ),
    ).toBeVisible({ timeout: 5_000 });
    // The success page must NOT have rendered.
    expect(
      await bPage.locator("[data-nex-vault-reset-page='success']").count(),
    ).toBe(0);
  });

  test("account A can STILL consume the same reset URL (token was not burned by B's attempt)", async () => {
    test.skip(
      resetUrl === null,
      "wiring: needs _test-harness route at /api/dev-test/latest-reset-token (see top-of-file TODO).",
    );
    if (!resetUrl) return;

    // Switch back to context A, whose cookies authenticate as the real
    // token owner. The sealed consumer flips to success + clears the
    // lockout counter.
    await aPage.goto(resetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(
      aPage.locator("[data-nex-vault-reset-page='success']"),
    ).toBeVisible({ timeout: 20_000 });

    // Vault doorway is no longer locked for account A · PIN entry is
    // offered again.
    await aPage.goto("/nex-native/vault", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(aPage.locator("[data-nex-vault-pin-root]")).toBeVisible({
      timeout: 15_000,
    });
    expect(
      await aPage.locator("[data-nex-vault-locked-out]").count(),
    ).toBe(0);
  });
});
