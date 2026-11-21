// tests/e2e-p6-isolation/account-deletion-flow.spec.ts
//
// Lane I · /settings/security/delete-account real-browser end-to-end.
// Authored 2026-11-21 under owner directive "fix all above stripe".
//
// What this spec PROVES
// -----------------------------------------------------------------
//   1. The delete-account surface renders with the sealed form
//      shell (current-password + DELETE confirm phrase + optional
//      reason + submit button + explanatory warning section).
//   2. The POST /api/nex-native/security/account/delete route:
//        · rejects a wrong current password with a banner message
//        · accepts a correct password + "DELETE" phrase and returns
//          {ok:true, deleted:true}
//        · runs the deletion workflow end-to-end · the final observable
//          DB state is that nex_account has NO row for the account id
//          (soft-delete sets deleted_at first, then the Supabase auth
//          user delete cascades via nex_account.supabase_user_id FK
//          ON DELETE CASCADE from migration 001)
//        · deletes the Supabase Auth user (admin.getUserById → error)
//   3. The client redirects to /sign-in?reason=account_deleted after
//      a short banner-visible window.
//   4. Re-sign-in with the same credentials FAILS (the auth user is
//      gone · the legacy nex_account row remains soft-deleted and
//      unreachable to the signed-out world).
//
// What this spec does NOT prove (honest limits)
// -----------------------------------------------------------------
//   · Does NOT verify the security audit rows (attempted/completed)
//     were persisted · covered by unit coverage of the deletion
//     service and HQ reconciler.
//   · Does NOT exercise the `audit_unavailable` branch · would
//     require taking the audit table offline mid-request.
//   · Does NOT drive the `auth_delete_failed` branch · would require
//     tearing down the admin API mid-request.
//   · Does NOT cover the rate-limit (session_revoke_all · 3/hour)
//     branch · a dedicated bounded test would need to burn two
//     disposables in rapid succession and we stay well under the
//     cap here (2 POSTs total).
//
// Hard safety guards
// -----------------------------------------------------------------
//   · Sandbox DATABASE_URL required. Hard-refuses on prod ref.
//   · Fresh disposable per run · prefixed e2e-delete-* on nex.invalid
//     domain. Never touches Hammerex / Rosa / CK5.
//   · Cleanup: deletes ONLY rows matching the captured disposable
//     account_id / supabase_user_id · never prefix-match.

import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import pkg from "pg";
const { Client: PG } = pkg;

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

const SUPABASE_URL =
  fromEnvLocal("NEXT_PUBLIC_NEX_SUPABASE_URL") ||
  fromEnvLocal("NEX_SUPABASE_URL");
const SERVICE_ROLE = fromEnvLocal("NEX_SUPABASE_SERVICE_ROLE_KEY");
const DB_URL = fromEnvLocal("DATABASE_URL");
const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";

if (!SUPABASE_URL || !SERVICE_ROLE || !DB_URL) {
  throw new Error(
    "account-deletion-flow refuses · Supabase + DATABASE_URL required in .env.local",
  );
}
if (SUPABASE_URL.includes(PROD_REF) || DB_URL.includes(PROD_REF)) {
  throw new Error("account-deletion-flow refuses · production ref detected");
}
if (!SUPABASE_URL.includes(SANDBOX_REF)) {
  throw new Error(
    `account-deletion-flow refuses · not sandbox ${SANDBOX_REF}`,
  );
}

const STAMP = Date.now().toString(36);
const EMAIL = `e2e-delete-${STAMP}@nex.invalid`;
const PASSWORD = `Del-${STAMP}-${randomBytes(6).toString("hex")}`;
const ACCOUNT_ID = randomUUID();
// Handle range · far from Hammerex (99901) / Rosa (99903) / dp6-f /
// CK5 (97xxxx). Use 960000-969999 to stay unique.
const HANDLE = `nex-${960000 + Math.floor(Math.random() * 10000)}`;

// Hard-refuse any accidental match on sealed personas.
const PROTECTED_RE = /hammerex|rosa|nex-99901|nex-99903|ck5|dp6-f/i;
if (PROTECTED_RE.test(EMAIL) || PROTECTED_RE.test(HANDLE)) {
  throw new Error(
    `account-deletion-flow refuses · disposable id touches protected pattern: ${EMAIL} / ${HANDLE}`,
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let supabaseUserId: string | null = null;

async function dbQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = new PG({ connectionString: DB_URL });
  await db.connect();
  try {
    const r = await db.query(sql, params);
    return r.rows as T[];
  } finally {
    await db.end();
  }
}

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

test.describe("Lane I · /settings/security/delete-account (sandbox)", () => {
  let ctx: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // 1 · Seed disposable auth user.
    const created = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: "E2E Delete", fixture: "e2e-delete" },
    });
    if (created.error || !created.data.user) {
      throw new Error(
        `account-deletion seed failed: ${created.error?.message ?? "no user"}`,
      );
    }
    supabaseUserId = created.data.user.id;

    // 2 · Mint the matching nex_account row · shop tier so the
    // settings surface mounts fully.
    await dbQuery(
      `INSERT INTO nex_account (id, supabase_user_id, display_name, nex_handle, locale, tier, shop_tier, is_mock_persona)
       VALUES ($1, $2, $3, $4, 'en', 'bisnis', 'shop', false)`,
      [ACCOUNT_ID, supabaseUserId, "E2E Delete", HANDLE],
    );

    ctx = await browser.newContext();
    page = await ctx.newPage();
  });

  test.afterAll(async () => {
    try {
      await ctx?.close();
    } catch {
      /* */
    }
    // Belt-and-braces cleanup · the real workflow should have done
    // both of these, but if the test aborted mid-flow we still clean.
    // (a) Delete any leftover nex_account row by captured id.
    try {
      await dbQuery(`DELETE FROM nex_account WHERE id = $1`, [ACCOUNT_ID]);
    } catch {
      /* */
    }
    // (b) Delete auth user if still present.
    if (supabaseUserId) {
      try {
        await admin.auth.admin.deleteUser(supabaseUserId);
      } catch {
        /* */
      }
    }
  });

  test("1 · sign in + navigate to delete-account · form renders", async () => {
    await page.goto("/nex-native/sign-in", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await Promise.all([
      page.waitForURL(
        (u) =>
          u.pathname !== "/nex-native/sign-in" &&
          !u.pathname.startsWith("/nex-native/sign-in/"),
        { timeout: 60_000, waitUntil: "domcontentloaded" },
      ),
      page.locator("button[data-nex-sign-in-submit]").click(),
    ]);

    await page.goto("/nex-native/settings/security/delete-account", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    // If session wasn't minted the page redirects back to /sign-in · a
    // present form proves the opposite.
    await expect(
      page.locator("[data-nex-delete-form]"),
      "delete-account form must render for signed-in disposable",
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator("[data-nex-delete-current-password]"),
    ).toBeVisible();
    await expect(
      page.locator("[data-nex-delete-confirm-phrase]"),
    ).toBeVisible();
    await expect(page.locator("[data-nex-delete-submit]")).toBeVisible();
    await expect(page.locator("[data-nex-delete-explain]")).toContainText(
      /cannot be undone/i,
    );
  });

  test("2 · wrong password · error banner · form intact", async () => {
    await page
      .locator("[data-nex-delete-current-password]")
      .fill(`${PASSWORD}-WRONG`);
    await page.locator("[data-nex-delete-confirm-phrase]").fill("DELETE");
    await page.locator("[data-nex-delete-submit]").click();

    await expect(
      page.locator('[data-nex-banner="error"]'),
      "wrong-password branch must render an error banner",
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-nex-banner="error"]')).toContainText(
      /password.*not correct|not authorised|try again/i,
    );
    // Soft-delete must NOT have run · nex_account.deleted_at stays null.
    const rows = await dbQuery<{ deleted_at: string | null }>(
      `SELECT deleted_at FROM nex_account WHERE id = $1`,
      [ACCOUNT_ID],
    );
    expect(rows.length, "nex_account row must still exist").toBe(1);
    expect(rows[0].deleted_at).toBeNull();
  });

  test("3 · correct password + DELETE phrase · soft-delete + auth user removed", async () => {
    // Re-fill the password field with the correct value (the wrong
    // one is still populated from test 2).
    await page.locator("[data-nex-delete-current-password]").fill(PASSWORD);
    // Confirm phrase persists from test 2 · re-fill defensively.
    await page.locator("[data-nex-delete-confirm-phrase]").fill("DELETE");
    await page.locator("[data-nex-delete-submit]").click();

    // Success banner appears before the 2.5s redirect fires.
    await expect(
      page.locator('[data-nex-banner="ok"]'),
      "success banner must render on completed deletion",
    ).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('[data-nex-banner="ok"]')).toContainText(
      /account deleted/i,
    );

    // Wait for the client-side redirect to /sign-in?reason=account_deleted.
    await page.waitForURL(
      (u) =>
        u.pathname === "/nex-native/sign-in" &&
        u.searchParams.get("reason") === "account_deleted",
      { timeout: 15_000, waitUntil: "domcontentloaded" },
    );

    // DB evidence · nex_account row is GONE. The workflow first
    // soft-deletes (sets deleted_at), then the Supabase auth user
    // delete cascades via the nex_account.supabase_user_id FK
    // (ON DELETE CASCADE · defined in mig 001) and hard-removes
    // the row. This is the real production behavior; asserting 0
    // rows is the honest post-state.
    const rows = await dbQuery<{ id: string; deleted_at: string | null }>(
      `SELECT id, deleted_at FROM nex_account WHERE id = $1`,
      [ACCOUNT_ID],
    );
    expect(
      rows.length,
      "nex_account row must be removed (soft-delete then FK cascade from auth user delete)",
    ).toBe(0);

    // Supabase Auth user is gone · getUserById returns an error.
    const probe = await admin.auth.admin.getUserById(supabaseUserId!);
    const gone =
      !!probe.error ||
      !probe.data?.user ||
      probe.data.user.id !== supabaseUserId;
    expect(gone, "Supabase auth user must be deleted").toBe(true);
    // Flag so afterAll does not try to re-delete.
    supabaseUserId = null;
  });

  test("4 · re-sign-in with same credentials FAILS (functional proof)", async () => {
    await page.goto("/nex-native/sign-in", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator("button[data-nex-sign-in-submit]").click();

    // The auth user is gone · sign-in must NOT advance to an authed
    // route. Give the server action a settle window and assert the
    // landing pathname is still /sign-in (with or without ?e=).
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(
      () => {},
    );
    const u = new URL(page.url());
    expect(
      u.pathname === "/nex-native/sign-in" ||
        u.pathname.startsWith("/nex-native/sign-in/"),
      `expected to stay on /sign-in · landed ${u.pathname}`,
    ).toBe(true);
  });
});
