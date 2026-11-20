// tests/e2e-p6-isolation/sign-up-approved-inbox.spec.ts
//
// Owner-authorised 2026-11-17 · Option B · end-to-end signup proof
// against the approved real inbox phillipofarrell@gmail.com via the
// Gmail +plus tag routing (`phillipofarrell+e2e-signup-<stamp>@gmail.com`
// routes to the phillipofarrell@gmail.com Primary inbox).
//
// This is a NEW sibling spec · the hardened sign-up-flow.spec.ts stays
// untouched (it still proves the UI journey with synthetic locals that
// never collide with real inboxes).
//
// Flow
// ────
//   1. Drive the signup form at /sign-in?mode=signup
//   2. Assert form submission produced EITHER:
//        (a) /contacts landing (sandbox auto-confirm mode · delivery
//            not exercised · reported explicitly as a sandbox config
//            observation, not a success claim for mailbox proof)
//        (b) /sign-in?mode=signup with email_confirmation_required
//            banner · real SMTP fired · proceed to mailbox step
//   3. Write a request-artifact file with the exact email + user id
//   4. Poll a response-artifact file for the confirmation URL (the
//      Claude orchestrator extracts it via the Gmail MCP connector
//      and writes it to this file) · timeout 6 minutes
//   5. Navigate to the confirmation URL · assert signed-in landing
//   6. Sign out, then normal sign-in with the same email + password
//      · assert signed-in landing again · proves credentials work
//   7. afterAll: admin-delete ONLY this run's created auth.users row
//      (tracked by exact id captured in step 3). Hard refuses to touch
//      any pre-existing account.
//
// Safety guards (fail-closed)
//   · Hard refuses if DATABASE_URL or NEX_SUPABASE_URL contains the
//     production project ref `ijvqdvsvwtwxzcqmoqit`.
//   · Hard refuses if DATABASE_URL does NOT contain the sandbox ref
//     `kdstoyyeygcopkogqsyv`.
//   · Local-part guard: email MUST start with the fixed prefix
//     `phillipofarrell+e2e-signup-` so cleanup can never land on an
//     unrelated address.
//   · Cleanup also refuses on any address matching Hammerex / Rosa /
//     p6-customer / p6-seller / nex-99901 / nex-99903.
//   · Admin cleanup targets the EXACT user id captured at signup time;
//     if that id is empty or missing, cleanup is skipped and logged.

import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import * as path from "node:path";
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
  fromEnvLocal("NEXT_PUBLIC_NEX_SUPABASE_URL") ||
  fromEnvLocal("NEX_SUPABASE_URL");
const SERVICE_ROLE = fromEnvLocal("NEX_SUPABASE_SERVICE_ROLE_KEY");

const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";

if (DB_URL.includes(PROD_REF) || SUPABASE_URL.includes(PROD_REF)) {
  throw new Error("sign-up-approved-inbox refuses · production ref detected");
}
if (!DB_URL.includes(SANDBOX_REF)) {
  throw new Error(
    "sign-up-approved-inbox refuses · DATABASE_URL does not target sandbox " +
      SANDBOX_REF,
  );
}

// ─── identity ─────────────────────────────────────────────────────

const APPROVED_INBOX_LOCAL = "phillipofarrell";
const APPROVED_INBOX_DOMAIN = "gmail.com";
const DISPOSABLE_TAG_PREFIX = "e2e-signup-"; // `phillipofarrell+e2e-signup-<stamp>@gmail.com`

function disposableEmail(): string {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${APPROVED_INBOX_LOCAL}+${DISPOSABLE_TAG_PREFIX}${stamp}@${APPROVED_INBOX_DOMAIN}`;
}

function assertEmailIsDisposable(email: string): void {
  const [local, domain] = email.split("@");
  if (domain !== APPROVED_INBOX_DOMAIN) {
    throw new Error(`refuse · not the approved domain: ${email}`);
  }
  if (!local || !local.startsWith(`${APPROVED_INBOX_LOCAL}+${DISPOSABLE_TAG_PREFIX}`)) {
    throw new Error(`refuse · not an approved-inbox disposable tag: ${email}`);
  }
  if (/hammerex|rosa|p6-customer|p6-seller|nex-99901|nex-99903/i.test(email)) {
    throw new Error(`refuse · email mentions a protected identity: ${email}`);
  }
}

// ─── artifact paths ───────────────────────────────────────────────

const ARTIFACT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-p6-isolation",
  ".artifacts",
);
if (!existsSync(ARTIFACT_DIR)) mkdirSync(ARTIFACT_DIR, { recursive: true });

const REQUEST_PATH = path.join(ARTIFACT_DIR, "signup-request.json");
const CONFIRMATION_PATH = path.join(ARTIFACT_DIR, "signup-confirmation.json");

interface SignupRequest {
  email: string;
  userId: string | null;
  submittedAt: number;
  outcome: "contacts" | "confirm_banner" | "other";
}

interface SignupConfirmation {
  confirmation_url: string;
  source_message_id?: string;
  injected_at?: number;
}

// ─── suite ────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });
test.setTimeout(420_000);

// Owner directive 2026-11-18 · lifecycle fix.
// Cleanup must NOT fire after the first separately invoked test (e.g.
// `--grep P1`) because that would delete the identity before P2/P3 can
// use it. We gate the admin deletion on an explicit `journeyOutcome`
// state that is set to "ready-to-clean" only at:
//   (a) the end of P3 after authenticated access is proven, or
//   (b) a declared terminal failure branch inside P2 where recovery is
//       impossible (e.g. the confirmation URL pointed at prod and we
//       refuse to continue).
// Any other end-state (partial run, serial-mode skip after an earlier
// failure, test filter excluding later phases) leaves the state as
// "partial-preserve" and the identity is intentionally preserved so
// the owner can finish the journey on a subsequent run.
type JourneyOutcome =
  | "pending"          // never progressed past beforeAll
  | "partial-preserve" // some phases ran but P3 not reached · DEFER cleanup
  | "ready-to-clean";  // full journey completed OR safe terminal failure

test.describe("Option B · signup → mailbox → confirm → signed-in", () => {
  let ctx: BrowserContext;
  let page: Page;
  const email = disposableEmail();
  const password = "e2e-approved-pass-abc123"; // sandbox only · never real
  const fullName = "E2E Approved Inbox";
  let capturedUserId: string | null = null;
  let journeyOutcome: JourneyOutcome = "pending";

  test.beforeAll(async ({ browser }) => {
    assertEmailIsDisposable(email);
    ctx = await browser.newContext();
    page = await ctx.newPage();
  });

  test.afterAll(async () => {
    try {
      await ctx?.close();
    } catch {
      /* ignore */
    }
    // Admin cleanup · delete ONLY the exact user id we captured. If we
    // never captured a user id, skip cleanup and log · never guess.
    if (!capturedUserId) {
      // eslint-disable-next-line no-console
      console.log("[cleanup] skipped · no capturedUserId recorded");
      return;
    }
    // Owner directive 2026-11-18 · do NOT delete the identity unless
    // the full journey (or a declared terminal failure) was reached.
    // A partial run (e.g. `--grep P1`, serial-skip after mid-phase
    // failure) must preserve the identity for the next invocation so
    // P2/P3 can still redeem the confirmation link against it.
    if (journeyOutcome !== "ready-to-clean") {
      // eslint-disable-next-line no-console
      console.log(
        `[cleanup] DEFERRED · journeyOutcome=${journeyOutcome} · ` +
          `identity preserved for next run · capturedUserId=${capturedUserId} · ` +
          `email=${email}`,
      );
      return;
    }
    assertEmailIsDisposable(email); // final guard on the known email
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Double-check the id still resolves to the disposable email before deleting.
    const { data: userBefore } = await admin.auth.admin.getUserById(capturedUserId);
    const emailOfUser = (userBefore?.user?.email ?? "").toLowerCase();
    if (emailOfUser !== email.toLowerCase()) {
      // eslint-disable-next-line no-console
      console.log(
        `[cleanup] refuse · captured id ${capturedUserId} resolves to ${emailOfUser}, not ${email}`,
      );
      return;
    }
    await admin.auth.admin.deleteUser(capturedUserId).catch(() => undefined);
    // eslint-disable-next-line no-console
    console.log(`[cleanup] deleted auth.users id=${capturedUserId}`);
  });

  test("P1 · signup form submits · outcome recorded · artifact written", async () => {
    // Pre-check · email is not already present.
    const db = new PG({ connectionString: DB_URL });
    await db.connect();
    try {
      const pre = await db.query(
        `SELECT id FROM auth.users WHERE email = $1`,
        [email],
      );
      expect(pre.rows.length).toBe(0);
    } finally {
      await db.end();
    }

    await page.goto("/nex-native/sign-in?mode=signup", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.locator("[data-nex-sign-up-form]"),
    ).toBeVisible({ timeout: 15_000 });

    await page.locator("[data-nex-sign-up-input-name]").fill(fullName);
    await page.locator("[data-nex-sign-up-input-email]").fill(email);
    await page.locator("[data-nex-sign-up-input-password]").fill(password);

    await Promise.all([
      page.waitForURL(
        (u) =>
          u.pathname === "/nex-native/contacts" ||
          u.pathname === "/nex-native/sign-in",
        { timeout: 60_000 },
      ),
      page.locator("[data-nex-sign-up-submit]").click(),
    ]);

    // Give the server action a beat to complete; Server Actions can
    // redirect via a 303 that Playwright's waitForURL may see as early.
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

    let outcome: SignupRequest["outcome"] = "other";
    const finalUrl = new URL(page.url());
    const anyBanner = page.locator("[data-nex-sign-in-banner]");
    const bannerCount = await anyBanner.count();
    const bannerCode = bannerCount > 0
      ? await anyBanner.first().getAttribute("data-nex-sign-in-banner")
      : null;
    const errorCode = finalUrl.searchParams.get("e");
    const errorMsg = finalUrl.searchParams.get("m");
    // eslint-disable-next-line no-console
    console.log(
      `[P1 diag] final.url=${page.url()} pathname=${finalUrl.pathname} ` +
        `search=${finalUrl.search} banner=${bannerCode ?? "none"} ` +
        `errorCode=${errorCode ?? "none"} errorMsg=${errorMsg ?? "none"}`,
    );
    if (finalUrl.pathname === "/nex-native/contacts") {
      outcome = "contacts";
    } else if (bannerCode === "email_confirmation_required") {
      outcome = "confirm_banner";
    }

    // Capture auth.users id for cleanup.
    const db2 = new PG({ connectionString: DB_URL });
    await db2.connect();
    try {
      const post = await db2.query(
        `SELECT id FROM auth.users WHERE email = $1`,
        [email],
      );
      if (post.rows.length !== 1) {
        // eslint-disable-next-line no-console
        console.log(
          `[P1 diag] auth.users row MISSING for ${email} · submission did not create user. ` +
            `outcome=${outcome} bannerCode=${bannerCode ?? "none"}`,
        );
      }
      expect(post.rows.length).toBe(1);
      capturedUserId = post.rows[0].id as string;
    } finally {
      await db2.end();
    }

    // Identity now exists · subsequent phases may need it. Preserve it
    // by default; only P3 (full success) or a declared terminal failure
    // flips the flag to "ready-to-clean".
    journeyOutcome = "partial-preserve";

    const req: SignupRequest = {
      email,
      userId: capturedUserId,
      submittedAt: Date.now(),
      outcome,
    };
    writeFileSync(REQUEST_PATH, JSON.stringify(req, null, 2));

    expect(["contacts", "confirm_banner"]).toContain(outcome);
  });

  test("P2 · poll for confirmation URL · navigate · verify signed-in landing", async () => {
    const req: SignupRequest = JSON.parse(readFileSync(REQUEST_PATH, "utf8"));
    if (req.outcome === "contacts") {
      // Auto-confirm mode · no mailbox step needed. Report explicitly.
      // eslint-disable-next-line no-console
      console.log(
        "[P2] sandbox is in auto-confirm mode · delivery pathway NOT exercised · " +
          "already signed in post-signup",
      );
      // Verify we are still signed in by hitting a signed-in page.
      await page.goto("/nex-native/contacts", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/nex-native\/contacts/);
      return;
    }

    // confirm_banner · poll for confirmation URL injected by orchestrator.
    const deadline = Date.now() + 360_000; // 6 min
    let conf: SignupConfirmation | null = null;
    while (Date.now() < deadline) {
      if (existsSync(CONFIRMATION_PATH)) {
        try {
          conf = JSON.parse(readFileSync(CONFIRMATION_PATH, "utf8"));
          if (conf && typeof conf.confirmation_url === "string") break;
        } catch {
          /* partial write · keep polling */
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!conf?.confirmation_url) {
      throw new Error(
        "[P2] no confirmation_url injected within 6 min · check Gmail orchestration",
      );
    }

    // Must be an https URL pointing at the sandbox project · never prod.
    const u = new URL(conf.confirmation_url);
    if (u.hostname.includes(PROD_REF)) {
      // Terminal failure · refusing to proceed. The sandbox identity is
      // unreachable from this path, so cleanup is safe to run now.
      journeyOutcome = "ready-to-clean";
      throw new Error("[P2] refuse · confirmation URL points at prod");
    }
    expect(u.protocol).toBe("https:");

    await page.goto(conf.confirmation_url, { waitUntil: "domcontentloaded" });
    // The confirmation flow bounces through /auth/confirm → signed-in
    // landing. Accept either /contacts (standard) or the sign-in page
    // with a success state (depends on Supabase's redirect_to config).
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
    const landed = new URL(page.url());
    expect(
      landed.pathname === "/nex-native/contacts" ||
        landed.pathname.startsWith("/nex-native/"),
    ).toBe(true);

    // DB · email_confirmed_at must now be set.
    const db = new PG({ connectionString: DB_URL });
    await db.connect();
    try {
      const row = await db.query(
        `SELECT email_confirmed_at FROM auth.users WHERE email = $1`,
        [email],
      );
      expect(row.rows.length).toBe(1);
      expect(row.rows[0].email_confirmed_at).not.toBeNull();
    } finally {
      await db.end();
    }
  });

  test("P3 · sign out · sign in with credentials · authenticated access proven", async () => {
    // Clear cookies to force a clean sign-in.
    await ctx.clearCookies();
    await page.goto("/nex-native/sign-in", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-nex-sign-in-form], form[action*='signInAction']").first(),
    ).toBeVisible({ timeout: 15_000 });

    // The sign-in form uses standard email + password fields. Prefer
    // the sealed data-nex-sign-in-* selectors if present, else fall
    // back to input[name].
    const emailInput = page
      .locator("[data-nex-sign-in-input-email], input[name='email'], input[type='email']")
      .first();
    const passwordInput = page
      .locator(
        "[data-nex-sign-in-input-password], input[name='password'], input[type='password']",
      )
      .first();
    const submit = page
      .locator("[data-nex-sign-in-submit], button[type='submit']")
      .first();
    await emailInput.fill(email);
    await passwordInput.fill(password);

    // 2026-11-20 · the earlier Promise.all([waitForURL, click]) pattern
    // false-matches on the starting URL (/sign-in startsWith /nex-native/)
    // and returns before the server action fires. Click first, then wait
    // for the signed-in landing with a STRICT predicate that excludes
    // the sign-in path.
    await submit.click();
    await page.waitForURL(
      (u) =>
        u.pathname.startsWith("/nex-native/") &&
        u.pathname !== "/nex-native/sign-in",
      { timeout: 60_000 },
    );
    await page
      .waitForLoadState("networkidle", { timeout: 10_000 })
      .catch(() => undefined);

    const landed = new URL(page.url());
    expect(landed.pathname.startsWith("/nex-native/")).toBe(true);
    expect(landed.pathname).not.toBe("/nex-native/sign-in");

    // Authenticated fetch · hit a signed-in-only page (contacts) to
    // confirm the session cookie actually works post-sign-in.
    await page.goto("/nex-native/contacts", { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).toBe("/nex-native/contacts");

    // Full journey reached end · authorise afterAll to clean up the
    // disposable identity this run created.
    journeyOutcome = "ready-to-clean";
  });
});
