// tests/e2e-p6-isolation/vault-landing-tiles.spec.ts
//
// Vault landing page · 6-tile grid + honest password panel (2026-11-15).
// -----------------------------------------------------------------------------
// Owner-authorised Part C of the bounded Vault audit pass. Verifies
// the sealed six-tile layout on /nex-native/vault/home and the
// honest-limits panel that states what works and what does not in the
// password / recovery area.
//
// Fixtures: reuses the p6 customer persona · provisioned by
//   scripts/_tmp/provision-vault-acceptance-fixtures.mjs
// Driven on dev :3010 via playwright.p6-isolation.config.ts.

import { expect, test, type Page } from "@playwright/test";
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
  throw new Error("vault-landing-tiles refuses · not sandbox");
}

const CUSTOMER_EMAIL = process.env.PLAYWRIGHT_VA_CUSTOMER_EMAIL ?? "";
const CUSTOMER_PASSWORD = process.env.PLAYWRIGHT_VA_CUSTOMER_PASSWORD ?? "";
const CUSTOMER_ACCOUNT_ID = process.env.PLAYWRIGHT_VA_CUSTOMER_ACCOUNT_ID ?? "";

for (const [k, v] of Object.entries({
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  CUSTOMER_ACCOUNT_ID,
})) {
  if (!v) throw new Error(`vault-landing-tiles · missing env ${k}`);
}

const { Client: PG } = pkg;
const PIN = "468135";

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
  await page.locator("button[data-nex-sign-in-submit]").click();
  await page.waitForURL(
    (u) => !u.pathname.startsWith("/nex-native/sign-in"),
    { timeout: 60_000, waitUntil: "domcontentloaded" },
  );
}

async function warmDeviceKey(page: Page, accountId: string): Promise<void> {
  await page
    .goto("/nex-native/vault/setup", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    })
    .catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  const { deviceId, publicKeyB64 } = await page.evaluate(async () => {
    function b64(b: Uint8Array): string {
      let s = "";
      for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
      return btoa(s);
    }
    const kp = (await crypto.subtle.generateKey(
      { name: "X25519" } as never,
      true,
      ["deriveBits"] as never,
    )) as { publicKey: CryptoKey; privateKey: CryptoKey };
    const pubJwk = (await crypto.subtle.exportKey("jwk", kp.publicKey)) as {
      x: string;
    };
    const privJwk = (await crypto.subtle.exportKey("jwk", kp.privateKey)) as {
      d: string;
    };
    function b64urlToBytes(s: string): Uint8Array {
      const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
      const b64std = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
      const bin = atob(b64std);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    const pub = b64urlToBytes(pubJwk.x);
    const secret = b64urlToBytes(privJwk.d);
    const did =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `did-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("nex-native-crypto", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("device")) db.createObjectStore("device");
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
      `DELETE FROM nex_account_device_key WHERE account_id=$1`,
      [accountId],
    );
    await client.query(
      `INSERT INTO nex_account_device_key (account_id, device_id, public_key, last_seen_at)
       VALUES ($1, $2, $3, now())`,
      [accountId, deviceId, publicKeyB64],
    );
  } finally {
    await client.end();
  }
}

async function completeVaultSetup(page: Page, pin: string): Promise<void> {
  await page.goto("/nex-native/vault/setup", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  if (new URL(page.url()).pathname !== "/nex-native/vault/setup") return;
  // Owner-authorised 2026-11-15 · Item 4.12 added a data-loss warning
  // step BEFORE the PIN entry · drive past it when present.
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
  await page.locator("[data-nex-vault-setup-next]").click();
  await expect(
    page.locator(
      "[data-nex-vault-setup-root][data-nex-vault-setup-step='confirm']",
    ),
  ).toBeVisible({ timeout: 30_000 });
  const pinInput2 = page.locator("[data-nex-vault-setup-pin-input]").first();
  await pinInput2.focus();
  await pinInput2.fill(pin);
  await page.locator("[data-nex-vault-setup-confirm]").click();
  await expect(page.locator("[data-nex-vault-setup-popup]")).toBeVisible({
    timeout: 60_000,
  });
  await page.locator("[data-nex-vault-setup-popup-ack]").click();
  await page.waitForURL(
    (u) => u.pathname === "/nex-native/vault/home",
    { timeout: 90_000, waitUntil: "domcontentloaded" },
  );
}

async function unlockVault(page: Page, pin: string): Promise<void> {
  await page.goto("/nex-native/vault", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await expect(page.locator("[data-nex-vault-pin-root]")).toBeVisible({
    timeout: 15_000,
  });
  await page.locator("[data-nex-vault-pin-input]").first().fill(pin);
  await Promise.all([
    page.waitForURL((u) => u.pathname === "/nex-native/vault/home", {
      timeout: 60_000,
    }),
    page.locator("[data-nex-vault-unlock-btn]").click(),
  ]);
}

async function resetVaultState(): Promise<void> {
  const client = new PG({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM nex_vault_key_envelope WHERE account_id=$1`, [
      CUSTOMER_ACCOUNT_ID,
    ]);
    await client.query(`DELETE FROM nex_vault_setup WHERE account_id=$1`, [
      CUSTOMER_ACCOUNT_ID,
    ]);
    await client.query(`DELETE FROM nex_vault_entry WHERE account_id=$1`, [
      CUSTOMER_ACCOUNT_ID,
    ]);
  } finally {
    await client.end();
  }
}

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

test.describe("Vault landing · six-tile grid + honest password panel", () => {
  // Persistent context across tests so the device key (and VMK after
  // unlock) survive into each assertion. Mirrors the pattern used by
  // vault-chat-ui-behavior.spec.ts.
  let ctx: import("@playwright/test").BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    await resetVaultState();
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    page = await ctx.newPage();
    await signIn(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD, "/nex-native/vault");
    await warmDeviceKey(page, CUSTOMER_ACCOUNT_ID);
    await completeVaultSetup(page, PIN);
    await unlockVault(page, PIN);
  });

  test.afterAll(async () => {
    await ctx.close();
  });

  test("exactly 6 tiles render, each pointing at an existing section", async () => {
    // We are already on /vault/home from the beforeAll unlock.
    await page.goto("/nex-native/vault/home", { waitUntil: "domcontentloaded" });
    const tiles = page.locator("[data-nex-vault-section]");
    await expect(tiles).toHaveCount(6);
    const keys = await tiles.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-nex-vault-section")),
    );
    expect(keys).toEqual([
      "chats",
      "contacts",
      "videos",
      "plans",
      "archived",
      "settings",
    ]);
    const expected: Array<{ key: string; href: string }> = [
      { key: "chats", href: "/nex-native/vault/home/chats" },
      { key: "contacts", href: "/nex-native/vault/home/contacts" },
      { key: "videos", href: "/nex-native/vault/home/videos" },
      { key: "plans", href: "/nex-native/vault/home/plans" },
      { key: "archived", href: "/nex-native/vault/home/archived" },
      { key: "settings", href: "/nex-native/vault/settings" },
    ];
    for (const { key, href } of expected) {
      const tile = page.locator(`[data-nex-vault-section="${key}"]`);
      await expect(tile).toHaveAttribute("href", href);
    }
  });

  test("each of the six tile destinations renders 200 (no broken links)", async () => {
    const destinations = [
      "/nex-native/vault/home/chats",
      "/nex-native/vault/home/contacts",
      "/nex-native/vault/home/videos",
      "/nex-native/vault/home/plans",
      "/nex-native/vault/home/archived",
      "/nex-native/vault/settings",
    ];
    for (const dest of destinations) {
      const res = await page.goto(dest, { waitUntil: "domcontentloaded" });
      expect(res?.status(), `${dest} should render 200`).toBe(200);
    }
  });

  test("password-and-recovery panel renders with all four honest states", async () => {
    await page.goto("/nex-native/vault/home", { waitUntil: "domcontentloaded" });
    const panel = page.locator("[data-nex-vault-password-limits]");
    await expect(panel).toHaveCount(1);
    for (const kind of ["create", "reset", "forgot", "honest-loss"]) {
      await expect(
        page.locator(`[data-nex-vault-password-limit="${kind}"]`),
      ).toHaveCount(1);
    }
    const createLink = page.locator("[data-nex-vault-create-password-link]");
    await expect(createLink).toHaveAttribute(
      "href",
      "/nex-native/vault/setup",
    );
    const panelText = await panel.textContent();
    expect(panelText ?? "").toMatch(/cannot be recovered/i);
  });

  test("retired broken file-category tiles do NOT render", async () => {
    await page.goto("/nex-native/vault/home", { waitUntil: "domcontentloaded" });
    for (const key of ["documents", "photos", "important"]) {
      await expect(
        page.locator(`[data-nex-vault-section="${key}"]`),
      ).toHaveCount(0);
      await expect(
        page.locator(`[data-nex-vault-category="${key}"]`),
      ).toHaveCount(0);
    }
  });
});

// Owner-authorised 2026-11-15 · Item 4.12 fallback · the setup wizard
// now opens on a data-loss warning screen with a confirm checkbox
// gate. Testing that the warning renders with the correct wording,
// the Continue button is disabled until the checkbox is checked, and
// unchecking it re-disables the button. Uses a fresh browser context
// against a clean vault-setup state so the setup wizard is reachable.
test.describe.configure({ mode: "serial" });
test.describe("Vault setup · data-loss warning (Item 4.12)", () => {
  test.beforeAll(async () => {
    test.setTimeout(60_000);
    await resetVaultState();
  });

  test("warn step renders first, gates the Continue button on the checkbox", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    try {
      await signIn(
        page,
        CUSTOMER_EMAIL,
        CUSTOMER_PASSWORD,
        "/nex-native/vault/setup",
      );
      await page.goto("/nex-native/vault/setup", {
        waitUntil: "domcontentloaded",
      });
      await page.waitForLoadState("networkidle").catch(() => {});

      // Warn step is the initial wizard step.
      await expect(
        page.locator(
          "[data-nex-vault-setup-root][data-nex-vault-setup-step='warn']",
        ),
      ).toHaveCount(1);
      await expect(
        page.locator("[data-nex-vault-setup-warn-panel]"),
      ).toHaveCount(1);

      // The headline carries the honest loss statement.
      const headline = await page
        .locator("[data-nex-vault-setup-warn-headline]")
        .textContent();
      expect(headline ?? "").toMatch(/cannot be recovered/i);

      // The Continue button is DISABLED until the checkbox is checked.
      const continueBtn = page.locator(
        "[data-nex-vault-setup-warn-continue]",
      );
      await expect(continueBtn).toBeDisabled();

      // Checking the box enables the button.
      const checkbox = page.locator("[data-nex-vault-setup-warn-acknowledge]");
      await checkbox.check();
      await expect(continueBtn).toBeEnabled();

      // Unchecking re-disables it.
      await checkbox.uncheck();
      await expect(continueBtn).toBeDisabled();

      // Re-check + click Continue → the wizard advances to the enter step.
      await checkbox.check();
      await continueBtn.click();
      await expect(
        page.locator(
          "[data-nex-vault-setup-root][data-nex-vault-setup-step='enter']",
        ),
      ).toHaveCount(1);
    } finally {
      await ctx.close();
    }
  });
});
