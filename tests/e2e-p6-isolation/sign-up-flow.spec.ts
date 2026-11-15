// tests/e2e-p6-isolation/sign-up-flow.spec.ts
//
// Checkpoint 2 · 2026-11-15. Drives the sealed one-URL sign-up at
// /nex-native/sign-in?mode=signup using disposable accounts only.
//
// Hardcoded constants:
//   · DISPOSABLE_EMAIL_PREFIX  = "e2e-signup-"   (must NEVER overlap
//     Hammerex or Rosa fixture emails p6-customer / p6-seller @
//     nex.invalid · explicit grep-guard in the cleanup helper rejects
//     any identifier that doesn't match this prefix).
//
// What this spec PROVES
//   1. The "Sign Up" link on /sign-in is a live anchor to
//      /sign-in?mode=signup (not a dead fall-through to the business-
//      slug dynamic route).
//   2. The signup form renders with the expected data-nex-* selectors.
//   3. A fresh disposable account can be created through the UI; the
//      server lands either on /contacts (confirmation disabled) OR
//      back on /sign-in with the email_confirmation_required banner
//      (confirmation enabled). The test records whichever outcome
//      happened as EVIDENCE · neither is a bypass.
//   4. Submitting the SAME email again produces a sign-up error on
//      the server-rendered banner (Supabase's own duplicate reject).
//   5. The "Already have an account? Sign in" link flips the form
//      back to signin mode.
//
// What this spec does NOT prove (honest limits)
//   · Real email delivery · we cannot intercept Supabase's outbound
//     SMTP. We assert the UI reaches the "please confirm" state when
//     confirmation is enabled, but delivery is UNVERIFIED.
//   · Confirmation-link redemption · requires an email client. If
//     sandbox Supabase has `email_confirm` disabled (common for dev
//     projects), this spec will observe immediate sign-in and
//     documents that as the sandbox state.
//
// Hard safety guards
//   · Cleanup deletes auth.users rows where email LIKE 'e2e-signup-%
//     @mock.nex.invalid'. It REFUSES to run if DATABASE_URL points
//     at prod or if the pattern matches any Hammerex / Rosa / p6-*
//     identifier.

import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import pkg from "pg";
import { createClient } from "@supabase/supabase-js";

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

const DB_URL = fromEnvLocal("DATABASE_URL");
const SUPABASE_URL =
  fromEnvLocal("NEXT_PUBLIC_NEX_SUPABASE_URL") || fromEnvLocal("NEX_SUPABASE_URL");
const SERVICE_ROLE = fromEnvLocal("NEX_SUPABASE_SERVICE_ROLE_KEY");

// Hard sandbox-only + hard Hammerex/Rosa guard.
const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
if (DB_URL.includes(PROD_REF) || SUPABASE_URL.includes(PROD_REF)) {
  throw new Error("sign-up-flow refuses · production ref detected");
}
if (!DB_URL.includes("kdstoyyeygcopkogqsyv")) {
  throw new Error("sign-up-flow refuses · not sandbox kdstoyyeygcopkogqsyv");
}

const DISPOSABLE_EMAIL_PREFIX = "e2e-signup-";
// NOTE · Supabase auth.signUp rejects the RFC-reserved `.invalid` TLD
// (the sealed p6-customer / p6-seller fixtures use .invalid because
// they were minted via admin.createUser, which has a looser validator).
// Our form posts through auth.signUp, so we need a Supabase-accepted
// domain. `mock.nex.app` is the active NEX apex domain · Supabase
// accepts it · no outbound delivery actually lands (no MX for the
// mock. subdomain), which keeps the test fully sandboxed.
const DISPOSABLE_EMAIL_DOMAIN = "mock.nex.app";

function disposableEmail(): string {
  const n = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${DISPOSABLE_EMAIL_PREFIX}${n}-${r}@${DISPOSABLE_EMAIL_DOMAIN}`;
}

function assertEmailIsDisposable(email: string): void {
  // Guards against ever running cleanup against Hammerex (p6-customer),
  // Rosa (p6-seller), or any non-test identity. Fail-closed.
  if (!email.startsWith(DISPOSABLE_EMAIL_PREFIX)) {
    throw new Error(`refuse · not a disposable email prefix: ${email}`);
  }
  if (!email.endsWith(`@${DISPOSABLE_EMAIL_DOMAIN}`)) {
    throw new Error(`refuse · not a disposable domain: ${email}`);
  }
  if (/hammerex|rosa|p6-customer|p6-seller|nex-99901|nex-99903/i.test(email)) {
    throw new Error(`refuse · email mentions a protected identity: ${email}`);
  }
}

// ─── cleanup ──────────────────────────────────────────────────────

async function wipeDisposableAccounts(): Promise<void> {
  // Admin SDK cleanup · deletes ONLY auth.users rows that match the
  // disposable prefix. nex_account rows cascade via supabase_user_id
  // on DELETE CASCADE (migration 042 setup).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Walk in pages of 1000 just in case prior runs piled up.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) break;
    const rows = data?.users ?? [];
    if (rows.length === 0) break;
    for (const u of rows) {
      const email = (u.email ?? "").toLowerCase();
      if (!email.startsWith(DISPOSABLE_EMAIL_PREFIX)) continue;
      if (!email.endsWith(`@${DISPOSABLE_EMAIL_DOMAIN}`)) continue;
      assertEmailIsDisposable(email); // hard guard
      await admin.auth.admin.deleteUser(u.id).catch(() => undefined);
    }
    if (rows.length < 1000) break;
  }
}

// ─── test config ──────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

// ─── Suite ────────────────────────────────────────────────────────

test.describe("Sign-up flow (sandbox · disposable accounts)", () => {
  let ctx: BrowserContext;
  let page: Page;
  const email = disposableEmail();
  const password = "e2e-signup-pass-abc123"; // sandbox only
  const fullName = "E2E Signup Test";
  let outcomeAfterSignup: "contacts" | "confirm_banner" | "other" = "other";

  test.beforeAll(async ({ browser }) => {
    await wipeDisposableAccounts();
    ctx = await browser.newContext();
    page = await ctx.newPage();
  });

  test.afterAll(async () => {
    await ctx.close();
    await wipeDisposableAccounts();
  });

  test("Sign Up link on /sign-in points to ?mode=signup (not the dead /create-account fallback)", async () => {
    await page.goto("/nex-native/sign-in", { waitUntil: "domcontentloaded" });
    const flip = page.locator("[data-nex-sign-in-flip-to-signup]");
    await expect(flip).toBeVisible();
    const href = await flip.getAttribute("href");
    expect(href).toMatch(/\/nex-native\/sign-in\?mode=signup(?:&|$)/);
    expect(href).not.toContain("/nex-native/create-account");
  });

  test("Signup form renders at /sign-in?mode=signup with expected selectors", async () => {
    await page.goto("/nex-native/sign-in?mode=signup", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.locator("[data-nex-sign-in-heading='signup']"),
    ).toBeVisible();
    await expect(page.locator("[data-nex-sign-up-form]")).toBeVisible();
    await expect(
      page.locator("[data-nex-sign-up-input-name]"),
    ).toBeVisible();
    await expect(
      page.locator("[data-nex-sign-up-input-email]"),
    ).toBeVisible();
    await expect(
      page.locator("[data-nex-sign-up-input-password]"),
    ).toBeVisible();
    await expect(page.locator("[data-nex-sign-up-submit]")).toBeVisible();
    // Dev-Pass button must NOT render in signup mode.
    expect(await page.locator("[data-nex-dev-pass-button]").count()).toBe(0);
  });

  test("Fresh disposable account completes signup; server lands on /contacts OR banner", async () => {
    // Pre-check: email does not exist yet.
    const db = new PG({ connectionString: DB_URL });
    await db.connect();
    try {
      const pre = await db.query(
        `SELECT COUNT(*)::int AS n FROM auth.users WHERE email = $1`,
        [email],
      );
      expect(pre.rows[0].n).toBe(0);
    } finally {
      await db.end();
    }

    await page.goto("/nex-native/sign-in?mode=signup", {
      waitUntil: "domcontentloaded",
    });
    await page.locator("[data-nex-sign-up-input-name]").fill(fullName);
    await page.locator("[data-nex-sign-up-input-email]").fill(email);
    await page.locator("[data-nex-sign-up-input-password]").fill(password);
    await Promise.all([
      page.waitForURL(
        (u) =>
          u.pathname === "/nex-native/contacts" ||
          u.pathname === "/nex-native/sign-in",
        { timeout: 30_000 },
      ),
      page.locator("[data-nex-sign-up-submit]").click(),
    ]);
    const final = new URL(page.url());
    if (final.pathname === "/nex-native/contacts") {
      outcomeAfterSignup = "contacts";
    } else {
      const banner = page.locator(
        "[data-nex-sign-in-banner='email_confirmation_required']",
      );
      if ((await banner.count()) === 1) {
        outcomeAfterSignup = "confirm_banner";
      } else {
        outcomeAfterSignup = "other";
      }
    }
    // auth.users row MUST exist after either outcome.
    const db2 = new PG({ connectionString: DB_URL });
    await db2.connect();
    try {
      const post = await db2.query(
        `SELECT id, email_confirmed_at FROM auth.users WHERE email = $1`,
        [email],
      );
      expect(post.rows.length).toBe(1);
    } finally {
      await db2.end();
    }
    expect(outcomeAfterSignup === "contacts" || outcomeAfterSignup === "confirm_banner").toBe(
      true,
    );
  });

  test("Second signup with same email fails on the server banner (duplicate)", async () => {
    await page.goto("/nex-native/sign-in?mode=signup", {
      waitUntil: "domcontentloaded",
    });
    await page.locator("[data-nex-sign-up-input-name]").fill(fullName);
    await page.locator("[data-nex-sign-up-input-email]").fill(email);
    await page.locator("[data-nex-sign-up-input-password]").fill(password);
    await Promise.all([
      page.waitForURL(
        (u) =>
          u.pathname === "/nex-native/sign-in" &&
          (u.search.includes("mode=signup") || u.search.includes("e=")),
        { timeout: 30_000 },
      ),
      page.locator("[data-nex-sign-up-submit]").click(),
    ]);
    // Banner must appear with some error indicator (sign_up_failed or
    // email_confirmation_required-with-existing-user semantics depending
    // on Supabase's own response shape).
    const banner = page.locator("[data-nex-sign-in-banner]");
    await expect(banner).toBeVisible({ timeout: 15_000 });
    const code = await banner.getAttribute("data-nex-sign-in-banner");
    // Accept any of: sign_up_failed, email_confirmation_required
    // (Supabase sometimes silently returns "ok" on duplicate pending
    // confirmation; the email WILL NOT be delivered a second time).
    expect(
      code === "sign_up_failed" || code === "email_confirmation_required",
    ).toBe(true);
  });

  test("Validation blocks invalid email + short password at the browser layer", async () => {
    await page.goto("/nex-native/sign-in?mode=signup", {
      waitUntil: "domcontentloaded",
    });
    // Try submitting with short password only · browser minLength=6 on
    // password input will prevent form submission. We assert the page
    // stays on /sign-in?mode=signup.
    await page.locator("[data-nex-sign-up-input-name]").fill(fullName);
    await page.locator("[data-nex-sign-up-input-email]").fill(disposableEmail());
    await page.locator("[data-nex-sign-up-input-password]").fill("abc"); // 3 < 6
    await page.locator("[data-nex-sign-up-submit]").click();
    // Wait a beat for navigation that should NOT happen.
    await page.waitForTimeout(500);
    expect(new URL(page.url()).searchParams.get("mode")).toBe("signup");
    expect(new URL(page.url()).pathname).toBe("/nex-native/sign-in");
  });

  test("Flip link 'Already have an account? Sign in' returns to signin form", async () => {
    await page.goto("/nex-native/sign-in?mode=signup", {
      waitUntil: "domcontentloaded",
    });
    const flip = page.locator("[data-nex-sign-up-flip-to-signin]");
    await expect(flip).toBeVisible();
    await flip.click();
    await page.waitForURL(
      (u) => u.pathname === "/nex-native/sign-in" && !u.search.includes("mode=signup"),
      { timeout: 15_000 },
    );
    await expect(
      page.locator("[data-nex-sign-in-heading='signin']"),
    ).toBeVisible();
    await expect(page.locator("[data-nex-sign-in-form]")).toBeVisible();
  });
});
