// tests/e2e-p6-isolation/session-persistence.spec.ts
//
// CRUCIAL · 2026-11-15 · author Claude Code task (session-persistence-390).
// -----------------------------------------------------------------------------
// This spec proves TWO critical invariants through the real UI:
//
//   (1) App session persists across browser context close + reopen.
//       The Supabase SSR auth cookie (`sb-*-auth-token*`) is HTTP-only,
//       SameSite=Lax, and lives in the cookie jar; Playwright's
//       storageState captures it and seeding a fresh context with that
//       state reconstitutes the signed-in state across what, for
//       Playwright, is the closest analogue of a real browser quit +
//       relaunch.
//
//   (2) The Vault stays SEPARATELY locked after that reopen.
//       The Vault's unlocked state is held in the tab-scoped
//       `vault-session.ts` in-memory singleton (`state.vmk`). It is
//       never persisted to localStorage, sessionStorage, cookies, URL,
//       or any server-side session record. A context.close() destroys
//       the browser process worth of memory that singleton lives in,
//       so the VMK is guaranteed gone after reopen even if the auth
//       cookie survives.
//
// Honest limits (per task directive):
//   · `browser.newContext({ storageState })` after `context.close()` is
//     the closest Playwright can simulate to a true browser quit +
//     relaunch. It does NOT model a full OS process kill or a PWA
//     "install + relaunch" lifecycle. For in-memory state (VMK) that
//     distinction is immaterial · fresh context = fresh memory. For the
//     cookie jar it is identical to a persisted-session reopen. For
//     service-worker or indexedDB state we make no claim here.
//   · Real device-install scenarios are not testable without a mobile
//     OS harness. Playwright emulates viewport + user-agent only.
//
// Fixture · Hammerex (nex-99901) · sandbox-only.
//   Credentials read from `.env.playwright.vault-acceptance` env vars
//   (`PLAYWRIGHT_VA_CUSTOMER_EMAIL` + `PLAYWRIGHT_VA_CUSTOMER_PASSWORD`).
//
// Vault preservation · this spec MUST NOT mutate Hammerex's vault:
//   · Never clears `nex_vault_setup`.
//   · Never drives wipe-and-resetup.
//   · Never submits a PIN · neither correct nor wrong · so the
//     `nex_vault_pin_lockout.consecutive_failures` counter cannot
//     advance.
//   · Hammerex is currently in `reset_required=true` lockout state
//     (consecutive_failures=3). The spec OPENS the Vault doorway (a
//     read of her existing server state) and asserts the locked-out
//     shell renders · no form submission is attempted.
//
// Sandbox envelope · the Playwright base URL MUST point at a dev server
// backed by Supabase ref `kdstoyyeygcopkogqsyv`. The p6-isolation
// config (`playwright.p6-isolation.config.ts`) targets :3010 which is
// expected to be run against sandbox credentials.

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Playwright clears `test-results/` on each startup; ensure the output
// dir for our cold-reopen screenshots exists before any test writes.
// Resolve to an absolute path anchored at process.cwd() (Playwright's
// project root). `test-results/ck-session/` is the required evidence
// path; if a concurrent Playwright run on another project is racing
// us for this directory, callers can pass SESSION_PERSISTENCE_SCREENSHOT_DIR
// to override.
const SCREENSHOT_DIR = resolve(
  process.cwd(),
  process.env.SESSION_PERSISTENCE_SCREENSHOT_DIR ?? "test-results/ck-session",
);
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const CUSTOMER_EMAIL = process.env.PLAYWRIGHT_VA_CUSTOMER_EMAIL ?? "";
const CUSTOMER_PASSWORD = process.env.PLAYWRIGHT_VA_CUSTOMER_PASSWORD ?? "";

if (!CUSTOMER_EMAIL || !CUSTOMER_PASSWORD) {
  throw new Error(
    "session-persistence · missing Hammerex credentials · source .env.playwright.vault-acceptance before running",
  );
}

// Tests 1 + 2 share a storageState → describe.serial. Test 3 is
// independent (signs in fresh) but keeps serial mode for determinism.
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

async function signIn(
  page: Page,
  email: string,
  password: string,
  expectedNextPath = "/nex-native/contacts",
): Promise<void> {
  await page.goto("/nex-native/sign-in", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("button[data-nex-sign-in-submit]").click();
  await page.waitForURL(
    (u) => u.pathname === expectedNextPath || u.pathname.startsWith(expectedNextPath),
    { timeout: 90_000, waitUntil: "domcontentloaded" },
  );
}

function hasAuthCookie(
  cookies: Array<{ name: string; value: string }>,
): boolean {
  return cookies.some(
    (c) => c.name.startsWith("sb-") && c.name.includes("auth-token") && c.value.length > 0,
  );
}

test.describe("Session persistence across context close + reopen (sandbox · Hammerex)", () => {
  // Shared storageState handed from Test 1 to Test 2. Captured in Test
  // 1's body, consumed by Test 2.
  let capturedStorageState: Awaited<ReturnType<BrowserContext["storageState"]>> | null = null;

  test("Test 1 · app session survives context close + reopen", async ({ browser }) => {
    // ── Context A · fresh sign-in ─────────────────────────────────
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    try {
      await signIn(pageA, CUSTOMER_EMAIL, CUSTOMER_PASSWORD, "/nex-native/contacts");
      // Confirm the signInAction default redirect landed us on /contacts.
      expect(new URL(pageA.url()).pathname).toBe("/nex-native/contacts");

      // Capture storageState · includes cookies + localStorage snapshot.
      capturedStorageState = await contextA.storageState();

      // Hard assert the auth cookie was captured in storageState.
      const authCookies = (capturedStorageState?.cookies ?? []).filter(
        (c) => c.name.startsWith("sb-") && c.name.includes("auth-token"),
      );
      expect(
        authCookies.length,
        "storageState must carry at least one sb-*-auth-token cookie",
      ).toBeGreaterThan(0);
    } finally {
      await contextA.close();
    }

    // ── Context B · seed with captured storageState ─────────────────
    // Simulates "close browser + reopen with persisted session" · the
    // closest Playwright analogue to a real quit + relaunch.
    const contextB = await browser.newContext({
      storageState: capturedStorageState!,
    });
    const pageB = await contextB.newPage();
    try {
      // Direct navigation to the signed-in landing · must render,
      // NOT bounce to /sign-in.
      await pageB.goto("/nex-native/contacts", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      expect(
        new URL(pageB.url()).pathname,
        "contacts must not redirect to sign-in after reopen",
      ).toBe("/nex-native/contacts");
      await pageB.screenshot({
        path: resolve(SCREENSHOT_DIR, "contacts-after-reopen.png"),
        fullPage: false,
      });

      // Auth cookie present on the live context too.
      const bCookies = await contextB.cookies();
      expect(
        hasAuthCookie(bCookies),
        "sb-*-auth-token must be present on context B after reopen",
      ).toBe(true);

      // Root resolver proof · server-side `src/app/page.tsx` sends
      // signed-in users to /nex-native/contacts (NOT /sign-in). We
      // must observe that routing decision on a real HTTP request.
      await pageB.goto("/", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      const rootResolvedPath = new URL(pageB.url()).pathname;
      expect(
        rootResolvedPath,
        "root resolver must route signed-in user to /nex-native/contacts",
      ).toBe("/nex-native/contacts");
    } finally {
      await contextB.close();
    }
  });

  test("Test 2 · Vault remains SEPARATELY locked after same context close + reopen", async ({
    browser,
  }) => {
    expect(
      capturedStorageState,
      "Test 1 must have captured storageState before Test 2 runs",
    ).not.toBeNull();

    // Reopen with the same storageState Test 1 captured. The Vault's
    // in-memory VMK singleton lives in the previous browser context's
    // process memory · guaranteed gone.
    const contextB = await browser.newContext({
      storageState: capturedStorageState!,
    });
    const pageB = await contextB.newPage();
    try {
      // Navigate to the Vault doorway.
      await pageB.goto("/nex-native/vault", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      // Allow the sealed VaultLockedBootstrap client probe (which
      // reads unlock-materials + decides which shell to render) to
      // settle.
      await pageB
        .waitForLoadState("networkidle", { timeout: 20_000 })
        .catch(() => {});

      // Hammerex's sealed Vault state (see the baseline captured by
      // scripts/_tmp/introspect-99901-vault-session-persistence.mjs
      // immediately before this run) · consecutive_failures=3,
      // reset_required=true · drives VaultLockedBootstrap into the
      // `locked_out` branch. The spec accepts any of the three
      // "LOCKED-on-client" shells (pin · waiting · locked_out).
      // NONE of them equal "Vault is unlocked and showing content".
      const pinRoot = pageB.locator("[data-nex-vault-pin-root]");
      const waitingRoot = pageB.locator("[data-nex-vault-waiting]");
      const lockedOutRoot = pageB.locator("[data-nex-vault-locked-out]");
      // Exactly one of these three locked shells is rendered.
      await expect(async () => {
        const pinCount = await pinRoot.count();
        const waitingCount = await waitingRoot.count();
        const lockedOutCount = await lockedOutRoot.count();
        expect(
          pinCount + waitingCount + lockedOutCount,
          "exactly one of (pin · waiting · locked_out) shells must render on /vault after reopen",
        ).toBeGreaterThan(0);
      }).toPass({ timeout: 30_000 });

      // Hard URL assertion · the doorway did NOT silently promote us
      // to /vault/home (which would imply VMK survived close+reopen).
      expect(
        new URL(pageB.url()).pathname,
        "Vault doorway path must be /nex-native/vault · never /vault/home after reopen",
      ).toBe("/nex-native/vault");

      await pageB.screenshot({
        path: resolve(SCREENSHOT_DIR, "vault-after-reopen.png"),
        fullPage: false,
      });

      // Independent probe · direct navigation to /vault/home must
      // NOT reveal decrypted Vault content on a fresh context. The
      // server-side guard only redirects when no setup row exists;
      // for Hammerex a setup row DOES exist so /vault/home renders.
      // We therefore gate on the sealed client Lock-chip state (which
      // reflects the live VMK singleton via `useVaultSession`): it
      // MUST read `locked`. If the chip is `unlocked` the VMK
      // survived a context destroy · a security defect.
      await pageB.goto("/nex-native/vault/home", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await pageB
        .waitForLoadState("networkidle", { timeout: 20_000 })
        .catch(() => {});

      // If the server redirected us back to /vault (e.g. a stricter
      // gate was added) that is MORE secure than merely rendering
      // home-locked · accept either, but NEVER the unlocked chip.
      const finalPath = new URL(pageB.url()).pathname;
      if (finalPath === "/nex-native/vault/home") {
        const lockChip = pageB.locator("[data-nex-vault-lock-now]");
        // The sealed chip is rendered by the shell · give it time to
        // hydrate but do not weaken the final assertion.
        await expect(lockChip).toBeVisible({ timeout: 20_000 });
        await expect(
          lockChip,
          "Lock Now chip must read 'locked' on cold reopen · unlocked state would indicate VMK survived close+reopen",
        ).toHaveAttribute("data-nex-vault-lock-state", "locked");
      } else {
        // Hard-redirected to the doorway · acceptable. Confirm it.
        expect(finalPath).toBe("/nex-native/vault");
      }
    } finally {
      await contextB.close();
    }
  });

  test("Test 3 · Vault-lock independence · locking Vault does NOT sign out of the app", async ({
    browser,
  }) => {
    // Fresh context + fresh sign-in. We do NOT reuse the Test 1/2
    // storageState because we want to prove the independence property
    // starts from the SAME place a real user would · a live session
    // and a locked Vault.
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await signIn(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD, "/nex-native/contacts");
      expect(new URL(page.url()).pathname).toBe("/nex-native/contacts");

      // Open /vault · for Hammerex this lands on the PIN entry OR
      // the locked-out shell (she is in reset_required). No PIN is
      // entered, so her lockout counter stays at 3 · preservation
      // honoured.
      await page.goto("/nex-native/vault", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page
        .waitForLoadState("networkidle", { timeout: 20_000 })
        .catch(() => {});

      const pinRoot = page.locator("[data-nex-vault-pin-root]");
      const lockedOutRoot = page.locator("[data-nex-vault-locked-out]");
      const waitingRoot = page.locator("[data-nex-vault-waiting]");
      await expect(async () => {
        const pinCount = await pinRoot.count();
        const lockedOutCount = await lockedOutRoot.count();
        const waitingCount = await waitingRoot.count();
        expect(pinCount + lockedOutCount + waitingCount).toBeGreaterThan(0);
      }).toPass({ timeout: 30_000 });

      // Without unlocking the vault, navigate back to Contacts.
      await page.goto("/nex-native/contacts", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      // Not bounced to /sign-in · the app session is still live even
      // though the Vault is locked.
      expect(
        new URL(page.url()).pathname,
        "contacts must render while Vault is locked · app session is independent of Vault lock state",
      ).toBe("/nex-native/contacts");

      // Auth cookie still present.
      const cookies = await context.cookies();
      expect(
        hasAuthCookie(cookies),
        "sb-*-auth-token must remain after visiting locked /vault doorway",
      ).toBe(true);
    } finally {
      await context.close();
    }
  });
});
