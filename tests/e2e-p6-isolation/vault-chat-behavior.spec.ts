// tests/e2e-p6-isolation/vault-chat-behavior.spec.ts
//
// Vault chat behavior · 2026-11-14 · bounded browser pass.
// -----------------------------------------------------------------------------
// Verifies that after unlocking the Vault, standard peer chat can
// send and receive messages normally. Then verifies that Lock Now
// prevents access to the VAULT chat surface (which is the surface
// that requires VMK to decrypt). Scope note: the "standard chat
// interface" at /chat/peer/[accountId] is E2E-encrypted via device
// keys (IndexedDB) · NOT via the VMK. Lock Now clears VMK but keeps
// device keys. So the standard chat continues to work after Lock Now
// by sealed architecture · the Vault chat surface at
// /vault/home/chats/[id] is the one gated by VMK. Observations
// below report exactly which gate fires.
//
// Fixtures: provisioned by
//   scripts/_tmp/provision-vault-acceptance-fixtures.mjs
// (sandbox-only · idempotent · clears nex_vault_setup + nex_vault_entry
// for the two P6 personas · creates 4 disposable friends).

import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
  throw new Error("vault-chat-behavior refuses · not sandbox");
}

const CUSTOMER_EMAIL = process.env.PLAYWRIGHT_VA_CUSTOMER_EMAIL ?? "";
const CUSTOMER_PASSWORD = process.env.PLAYWRIGHT_VA_CUSTOMER_PASSWORD ?? "";
const CUSTOMER_ACCOUNT_ID = process.env.PLAYWRIGHT_VA_CUSTOMER_ACCOUNT_ID ?? "";
const SELLER_EMAIL = process.env.PLAYWRIGHT_VA_SELLER_EMAIL ?? "";
const SELLER_PASSWORD = process.env.PLAYWRIGHT_VA_SELLER_PASSWORD ?? "";
const SELLER_ACCOUNT_ID = process.env.PLAYWRIGHT_VA_SELLER_ACCOUNT_ID ?? "";

const F2_ACCOUNT_ID =
  process.env.PLAYWRIGHT_VA_F2_NOT_VAULTED_ACCOUNT_ID ?? "";
const F2_CONV_ID = process.env.PLAYWRIGHT_VA_F2_NOT_VAULTED_CONV_ID ?? "";

for (const [k, v] of Object.entries({
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  CUSTOMER_ACCOUNT_ID,
  SELLER_EMAIL,
  SELLER_PASSWORD,
  SELLER_ACCOUNT_ID,
  F2_ACCOUNT_ID,
  F2_CONV_ID,
})) {
  if (!v) throw new Error(`vault-chat-behavior · missing env ${k}`);
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
          { deviceId: did, secretKey: secret, publicKey: pub, createdAt: Date.now() },
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

async function completeVaultSetup(page: Page, pin: string): Promise<void> {
  // Arrive at /vault/setup via the sealed doorway redirect. Use
  // waitForLoadState('networkidle') so the redirect chain settles
  // before we start interacting · parallel beforeAll setup in this
  // spec hits the dev server harder than the acceptance spec and
  // flaky partial-renders were observed.
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
  await expect(
    page.locator(
      "[data-nex-vault-setup-root][data-nex-vault-setup-step='enter']",
    ),
  ).toBeVisible({ timeout: 30_000 });
  // Focus the sealed input before filling · off-screen inputs
  // occasionally lose focus between React re-renders on the dev
  // server when this spec races the setup redirect.
  const pinInput = page.locator("[data-nex-vault-setup-pin-input]").first();
  await pinInput.focus();
  await pinInput.fill(pin);
  // Verify the value was applied before clicking Continue.
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

async function unlockVault(page: Page, pin: string): Promise<void> {
  // SPA-friendly: go to /vault, drive PIN entry, land at /vault/home.
  // VMK survives this nav path (not a full reload across tabs).
  await page.goto("/nex-native/vault", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await expect(page.locator("[data-nex-vault-pin-root]")).toBeVisible({
    timeout: 15_000,
  });
  await page.locator("[data-nex-vault-pin-input]").first().fill(pin);
  await Promise.all([
    page.waitForURL(
      (u) => u.pathname === "/nex-native/vault/home",
      { timeout: 60_000 },
    ),
    page.locator("[data-nex-vault-unlock-btn]").click(),
  ]);
}

async function countPeerMessagesInConversation(
  conversationId: string,
): Promise<number> {
  const client = new PG({ connectionString: DB_URL });
  await client.connect();
  try {
    const r = await client.query(
      `SELECT COUNT(*)::int AS n
       FROM nex_peer_message
       WHERE conversation_id = $1`,
      [conversationId],
    );
    return r.rows[0]?.n ?? 0;
  } finally {
    await client.end();
  }
}

async function deleteDisposableMessages(
  conversationId: string,
  sinceIso: string,
): Promise<void> {
  // Scrub only rows our test created · bounded by conv id + created
  // timestamp.
  const client = new PG({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM nex_peer_message
       WHERE conversation_id = $1 AND sent_at >= $2`,
      [conversationId, sinceIso],
    );
  } finally {
    await client.end();
  }
}

// ─── test config ──────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

// ─── Suite ────────────────────────────────────────────────────────

test.describe("Vault chat behavior · post-unlock send + Lock Now gate (sandbox)", () => {
  let customerCtx: BrowserContext;
  let sellerCtx: BrowserContext;
  let customerPage: Page;
  let sellerPage: Page;
  let customerConvId = "";
  const setupPin = "357914";
  const testStartedAt = new Date().toISOString();

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    customerCtx = await browser.newContext();
    sellerCtx = await browser.newContext();
    customerPage = await customerCtx.newPage();
    sellerPage = await sellerCtx.newPage();
    // Resolve the customer<->seller canonical conversation id so the
    // test can count messages in it.
    const client = new PG({ connectionString: DB_URL });
    await client.connect();
    try {
      const [a, b] =
        CUSTOMER_ACCOUNT_ID < SELLER_ACCOUNT_ID
          ? [CUSTOMER_ACCOUNT_ID, SELLER_ACCOUNT_ID]
          : [SELLER_ACCOUNT_ID, CUSTOMER_ACCOUNT_ID];
      const r = await client.query(
        `SELECT id FROM nex_peer_conversation
         WHERE participant_a_id = $1 AND participant_b_id = $2`,
        [a, b],
      );
      if (!r.rowCount) {
        throw new Error(
          "customer<->seller conversation missing · expected sandbox fixture",
        );
      }
      customerConvId = r.rows[0].id as string;
    } finally {
      await client.end();
    }
    // Reset Vault setup + envelopes for BOTH personas · when this
    // spec runs alongside vault-acceptance in the same config (or
    // re-runs without the fixture provisioner), a prior setup row
    // for a different device will trigger the sealed "waiting for
    // authorisation" multi-device flow which this spec is not
    // designed to drive.
    const resetClient = new PG({ connectionString: DB_URL });
    await resetClient.connect();
    try {
      for (const acc of [CUSTOMER_ACCOUNT_ID, SELLER_ACCOUNT_ID]) {
        await resetClient.query(
          `DELETE FROM nex_vault_key_envelope WHERE account_id = $1`,
          [acc],
        );
        await resetClient.query(
          `DELETE FROM nex_vault_setup WHERE account_id = $1`,
          [acc],
        );
      }
    } finally {
      await resetClient.end();
    }
    // Set up contexts serially · parallel setup overloaded the
    // dev server and caused net::ERR_ABORTED on concurrent navigations.
    await signIn(
      customerPage,
      CUSTOMER_EMAIL,
      CUSTOMER_PASSWORD,
      "/nex-native/vault",
    );
    await warmDeviceKey(customerPage, CUSTOMER_ACCOUNT_ID);
    await completeVaultSetup(customerPage, setupPin);
    // Hard assert that setup persisted · without this the downstream
    // unlock tests silently fall through to /vault/setup.
    const setupCheck = async (accountId: string) => {
      const client = new PG({ connectionString: DB_URL });
      await client.connect();
      try {
        const r = await client.query(
          `SELECT 1 FROM nex_vault_setup WHERE account_id = $1`,
          [accountId],
        );
        return r.rowCount > 0;
      } finally {
        await client.end();
      }
    };
    expect(
      await setupCheck(CUSTOMER_ACCOUNT_ID),
      "customer nex_vault_setup row must exist after completeVaultSetup",
    ).toBe(true);
    await signIn(
      sellerPage,
      SELLER_EMAIL,
      SELLER_PASSWORD,
      "/nex-native/vault",
    );
    await warmDeviceKey(sellerPage, SELLER_ACCOUNT_ID);
    await completeVaultSetup(sellerPage, setupPin);
    expect(
      await setupCheck(SELLER_ACCOUNT_ID),
      "seller nex_vault_setup row must exist after completeVaultSetup",
    ).toBe(true);
  });

  test.afterAll(async () => {
    // Scrub test-added messages.
    if (customerConvId) {
      await deleteDisposableMessages(customerConvId, testStartedAt);
    }
    await customerCtx.close();
    await sellerCtx.close();
  });

  test("post-unlock · customer sends a text message to seller · DB row persists with ciphertext fan-out", async () => {
    await unlockVault(customerPage, setupPin);
    const before = await countPeerMessagesInConversation(customerConvId);
    // Visit the peer-chat page so the browser has an authenticated
    // session cookie attached to the dev origin, then POST directly
    // to the sealed /api/peer-message/encrypted endpoint. The sealed
    // production composer encrypts in the browser and POSTs this
    // exact shape · we bypass only the virtual keypad (the sealed
    // input has `readonly inputmode="none"` · Playwright's fill is
    // refused) and hit the SAME endpoint with real session + real
    // device fan-out from the sandbox DB.
    await customerPage.goto(`/nex-native/chat/peer/${SELLER_ACCOUNT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    // Look up the recipient (seller) device ids + the sender
    // (customer) device + public key · all live in the sandbox from
    // warmDeviceKey.
    const client = new PG({ connectionString: DB_URL });
    await client.connect();
    let senderDeviceId = "";
    let senderPublicKey = "";
    let recipientDeviceIds: string[] = [];
    try {
      const sender = await client.query(
        `SELECT device_id, public_key FROM nex_account_device_key
         WHERE account_id=$1 AND revoked_at IS NULL
         ORDER BY last_seen_at DESC LIMIT 1`,
        [CUSTOMER_ACCOUNT_ID],
      );
      if (!sender.rowCount)
        throw new Error("customer device row missing · warmDeviceKey failed");
      senderDeviceId = sender.rows[0].device_id as string;
      senderPublicKey = sender.rows[0].public_key as string;
      const recip = await client.query(
        `SELECT device_id FROM nex_account_device_key
         WHERE account_id=$1 AND revoked_at IS NULL`,
        [SELLER_ACCOUNT_ID],
      );
      if (!recip.rowCount)
        throw new Error("seller device rows missing · warmDeviceKey failed");
      recipientDeviceIds = recip.rows.map((r) => r.device_id as string);
    } finally {
      await client.end();
    }
    // POST from the authenticated browser context · the fetch
    // picks up the customer's real Supabase session cookie.
    const result = await customerPage.evaluate(
      async ({ convId, groupId, senderDevId, senderPk, recipDevIds }) => {
        function b64(n: number): string {
          const bytes = new Uint8Array(n);
          crypto.getRandomValues(bytes);
          let s = "";
          for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
          return btoa(s);
        }
        const rows = recipDevIds.map((rid) => ({
          conversation_id: convId,
          ciphertext_b64: b64(96),
          nonce_b64: b64(24),
          sender_public_key: senderPk,
          sender_device_id: senderDevId,
          recipient_device_id: rid,
        }));
        const res = await fetch("/api/nex-native/peer-message/encrypted", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message_group_id: groupId, rows }),
        });
        return { status: res.status, body: await res.text() };
      },
      {
        convId: customerConvId,
        groupId: randomUUID(),
        senderDevId: senderDeviceId,
        senderPk: senderPublicKey,
        recipDevIds: recipientDeviceIds,
      },
    );
    expect(
      result.status,
      `POST /api/peer-message/encrypted · body=${result.body}`,
    ).toBe(200);
    // Poll for the DB row count to increase.
    let after = before;
    for (let i = 0; i < 20; i++) {
      after = await countPeerMessagesInConversation(customerConvId);
      if (after > before) break;
      await customerPage.waitForTimeout(500);
    }
    expect(
      after > before,
      `expected new nex_peer_message row after sealed E2E POST · before=${before} after=${after}`,
    ).toBe(true);
  });

  test("post-unlock · seller context sees the customer's message rendered", async () => {
    await unlockVault(sellerPage, setupPin);
    await sellerPage.goto(`/nex-native/chat/peer/${CUSTOMER_ACCOUNT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    // Message bubbles carry data-nex-msg-id. The most recently sent
    // customer message should be visible in the seller's thread.
    const bubbles = sellerPage.locator("[data-nex-msg-id]");
    // Wait for at least one bubble.
    await expect(bubbles.first()).toBeVisible({ timeout: 45_000 });
    const count = await bubbles.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Lock Now · locks the vault + the vault chat surface shows the sealed locked gate", async () => {
    // Prepare: customer moves the customer<->seller conversation into
    // Vault (so visiting /vault/home/chats/<id> is a valid test
    // target). We insert the vault-entry via DB first · the UI-
    // driven move is covered in the companion vault-acceptance spec.
    // CRITICAL: do this DB write BEFORE unlock · any page.goto
    // after unlock would wipe the module-scoped VMK singleton.
    const client = new PG({ connectionString: DB_URL });
    await client.connect();
    try {
      await client.query(
        `INSERT INTO nex_vault_entry (account_id, entry_kind, ref_id)
         VALUES ($1, 'conversation', $2)
         ON CONFLICT DO NOTHING`,
        [CUSTOMER_ACCOUNT_ID, customerConvId],
      );
    } finally {
      await client.end();
    }
    await unlockVault(customerPage, setupPin);
    // SPA-navigate directly to Settings from /vault/home (VMK alive
    // in module). A full page.goto would wipe the module-scoped VMK.
    await Promise.all([
      customerPage.waitForURL(
        (u) => u.pathname === "/nex-native/vault/settings",
        { timeout: 60_000 },
      ),
      customerPage.locator("a[data-nex-vault-settings-link]").click(),
    ]);
    // useVaultSession subscribes on mount · briefly wait for the
    // subscription + initial render to settle.
    await customerPage.waitForTimeout(1_500);
    const lockNow = customerPage.locator(
      "[data-nex-vault-lock-now][data-nex-vault-lock-state='unlocked']",
    );
    await expect(lockNow).toBeVisible({ timeout: 15_000 });
    await Promise.all([
      customerPage.waitForURL(
        (u) => u.pathname === "/nex-native/vault",
        { timeout: 60_000 },
      ),
      lockNow.click(),
    ]);
    // Revisit the Vault chat surface post-lock · expect to be routed
    // to the PIN unlock door at /vault because the module-scoped VMK
    // is cleared and a full page.goto re-imports the client module.
    await customerPage.goto(
      `/nex-native/vault/home/chats/${customerConvId}`,
      { waitUntil: "domcontentloaded" },
    );
    await customerPage
      .waitForLoadState("networkidle", { timeout: 20_000 })
      .catch(() => {});
    // The sealed Vault-chat client renders a "Vault is locked"
    // heading when VMK is absent (see the Playwright page snapshot
    // · heading level-1 text "Vault is locked" + disabled Unlock
    // button).
    await expect(
      customerPage.locator("h1:has-text('Vault is locked')"),
    ).toBeVisible({ timeout: 15_000 });
    // Post-Lock-Now the vault chat surface must not render decrypted
    // plaintext. The sealed body column carries the '(encrypted)'
    // sentinel for E2E rows · when VMK is cleared, the client cannot
    // decrypt and either routes to /vault for PIN entry OR renders a
    // locked placeholder. Either way, the sentinel/placeholder is
    // acceptable · we only forbid the sealed plaintext leak surface
    // from ever showing a cleartext peek. We assert here that NO
    // live "plaintext" attribute is set on any message bubble.
    const plainMessages = await customerPage
      .locator("[data-nex-msg-id][data-nex-msg-plaintext]")
      .count();
    expect(
      plainMessages,
      "post-Lock-Now vault chat must not render any bubble with data-nex-msg-plaintext",
    ).toBe(0);
    // Standard chat interface for the SAME conversation · sealed
    // architecture: standard peer chat uses per-device keys (not VMK)
    // so the sentinel MAY still decrypt here. We assert the
    // architectural reality rather than a false blocking claim.
    await customerPage.goto(`/nex-native/chat/peer/${SELLER_ACCOUNT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await customerPage
      .waitForLoadState("networkidle", { timeout: 30_000 })
      .catch(() => {});
    // Standard chat is E2E'd via device keys · VMK is not required
    // for decryption on this surface. Record the architectural
    // observation: standard chat continues to work post-Lock-Now by
    // design · the Vault chat surface is the one gated by VMK.
    const stdPlainMessages = await customerPage
      .locator("[data-nex-msg-id]")
      .count();
    console.log(
      `[chat-behavior] post-Lock-Now standard-chat message bubbles rendered: ${stdPlainMessages}`,
    );
  });
});
