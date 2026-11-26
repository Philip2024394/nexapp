// tests/e2e/journey-full-guest-signup-pick-theme.spec.ts
//
// CYCLE 14 · G-4 PRIORITY 1 · Full guest→signup→authenticated-viewer
// journey for the `pick-theme` account-wall handoff.
// -----------------------------------------------------------------------------
// This is the real customer journey the Founder required for G-4 to
// move past PARTIAL:
//
//   1. Guest (no auth cookies) opens a free chat-theme viewer.
//   2. Guest presses "Use this theme".
//   3. The RequireAccount client gate opens the WallModal.
//   4. Guest presses "Create free account" → setPendingAndSignUpAction
//      writes the one-shot `nex_pending_wall` cookie AND redirects to
//      the sealed one-URL sign-in surface at /sign-in?mode=signup
//      (Cycle 14 fix · the old redirect went to the retired
//      /nex-native/create-account which catches on the business-slug
//      not-found surface).
//   5. Guest fills in full name, unique sandbox email, and password
//      and submits the form.
//   6. createNexAccountAction creates the Supabase auth user and
//      detects the pending cookie; redirects to /post-signup-apply.
//   7. The Cycle 13 route handler consumes the cookie, writes the
//      new account's chat_theme, emits Set-Cookie: nex_pending_wall=
//      ;Max-Age=0 (real one-shot), and 303-redirects to the theme
//      viewer.
//   8. The authenticated viewer renders the Applied toast and
//      ThemePreviewActionBar returns null (owner-sealed 2026-10-28:
//      when account.chat_theme === themeId, the bar is absent).
//
// Decisive customer-outcome proof: the just-created account's DB
// `nex_account.chat_theme` row is `nex-bubbles`, AND the Applied toast
// is present, AND the ThemePreviewActionBar is absent, AND the
// pending-wall cookie has been cleared. The user was not required to
// press Activate a second time.
//
// Sandbox-only. The test account is created under the convention
// `c14-full-<stamp>@sandbox.invalid` and deleted via Supabase admin at
// the end of the test (both pass AND fail paths). Guards against
// production ref before every DB operation.
//
// Boundaries honoured:
//   · Sandbox project kdstoyyeygcopkogqsyv only.
//   · No production DB writes.
//   · No migration 342 touch. We create a `nex_account` row via the
//     signup server action, NEVER by direct insert.
//   · Email-confirmation disabled in sandbox is a pre-existing
//     project setting · verified empirically by
//     scripts/_tmp/probe-sandbox-signup-session.mjs returning
//     `hasSession: true`. We do not alter it.
//   · NEX_PRELAUNCH_MODE=false in .env.local is a pre-existing
//     sandbox setting · we do not alter it.

import { readFileSync } from "node:fs";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";

function envVar(name: string): string {
  const raw = readFileSync("./.env.local", "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} missing from .env.local`);
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v;
}

function assertSandboxRef(): void {
  const url = envVar("NEXT_PUBLIC_NEX_SUPABASE_URL");
  const ref = new URL(url).hostname.split(".")[0];
  if (ref === PROD_REF) throw new Error("STOP · production ref detected");
  if (ref !== SANDBOX_REF) throw new Error(`STOP · unknown ref ${ref}`);
}

function supabaseAdmin() {
  assertSandboxRef();
  return createClient(
    envVar("NEXT_PUBLIC_NEX_SUPABASE_URL"),
    envVar("NEX_SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * Prefer the pooler URL (`DATABASE_URL`) when its username-encoded ref
 * matches the sealed sandbox ref. The direct URL
 * (`SANDBOX_DATABASE_URL`) is IPv6-only on Supabase projects without
 * the IPv4 add-on and times out from IPv4-only hosts.
 */
function resolveSandboxDbUrl(): string {
  try {
    const pooler = envVar("DATABASE_URL");
    const u = new URL(pooler);
    const dotIdx = u.username.indexOf(".");
    const refInUser = dotIdx > -1 ? u.username.slice(dotIdx + 1) : "";
    if (refInUser === SANDBOX_REF) return pooler;
  } catch {
    // fall through
  }
  return envVar("SANDBOX_DATABASE_URL");
}

async function withPgClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  assertSandboxRef();
  const c = new Client({ connectionString: resolveSandboxDbUrl() });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function readChatTheme(supabaseUserId: string): Promise<string | null> {
  return withPgClient(async (c) => {
    const r = await c.query<{ chat_theme: string | null }>(
      `SELECT chat_theme FROM nex_account WHERE supabase_user_id = $1`,
      [supabaseUserId],
    );
    return r.rows[0]?.chat_theme ?? null;
  });
}

async function deleteTestUser(supabaseUserId: string): Promise<void> {
  const sb = supabaseAdmin();
  // 1 · delete the nex_account row by cascade — do a direct SQL delete
  //     since there may be FK rows (conversations, etc.) that should
  //     cascade. Supabase auth.admin.deleteUser cascades via auth.users,
  //     but we explicitly clean nex_account too for safety.
  await withPgClient(async (c) => {
    await c.query(
      `DELETE FROM nex_account WHERE supabase_user_id = $1`,
      [supabaseUserId],
    );
  });
  // 2 · delete the auth user.
  const r = await sb.auth.admin.deleteUser(supabaseUserId);
  if (r.error && !/not.?found/i.test(r.error.message)) {
    // eslint-disable-next-line no-console
    console.warn(`[cleanup] deleteUser failed · ${r.error.message}`);
  }
}

// Fresh browser context · NO storageState so the guest branch runs.
test.use({ storageState: { cookies: [], origins: [] } });

// Sandbox rate-limit · the `account_create` bucket is 3/hour per IP.
// A serial run of the cycle-14 signup journeys trips it on the 3rd
// account creation. Hermetic clear before every test · sandbox-ref
// guarded via `withPgClient`.
test.beforeEach(async () => {
  await withPgClient(async (c) => {
    await c.query(
      `DELETE FROM nex_security_rate_limit WHERE action = 'account_create'`,
    );
  });
});

test("full guest→signup→theme journey · pick-theme account-wall handoff applies chosen theme", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000);
  assertSandboxRef();

  const themeId = "nex-bubbles";
  const themeViewer = `/nex-native/themes/${themeId}`;
  const stamp = Date.now();
  const email = `c14-full-${stamp}@sandbox.invalid`;
  const password = `TestPass!${stamp}`;
  const fullName = `Cycle14 Test ${stamp}`;

  let createdUserId: string | null = null;

  try {
    // Step 1 · guest lands on the viewer. The server MUST render the
    // action bar with a "Use this theme" form (guest branch) because
    // no session cookie is present. Wait for networkidle so React has
    // hydrated · the RequireAccount client wrapper attaches its
    // onClickCapture only AFTER hydration. Clicking before hydration
    // lets the raw form submit run (updateChatThemeAction on a guest)
    // which redirects to a not-found surface · NOT the real customer
    // journey.
    await page.goto(themeViewer, { waitUntil: "networkidle" });
    const useBtn = page.locator('[data-nex-theme-action-bar-use]');
    await expect(
      useBtn,
      "guest must see Use-this-theme button on free theme viewer",
    ).toBeVisible({ timeout: 10_000 });

    // Confirm the RequireAccount client wrapper has hydrated · the
    // `data-nex-account-wall-trigger` attribute is added by the
    // client component, so its presence in the live DOM is a
    // reliable hydration marker.
    await expect(
      page.locator('[data-nex-account-wall-trigger="pick-theme"]'),
      "RequireAccount client wrapper must be mounted · hydration marker",
    ).toBeAttached({ timeout: 10_000 });

    // Step 2-3 · pressing Use fires the RequireAccount intercept which
    // opens the WallModal (client component). The modal is identified
    // by [data-nex-account-wall="pick-theme"].
    await useBtn.click();
    const modal = page.locator('[data-nex-account-wall="pick-theme"]');
    await expect(
      modal,
      "RequireAccount intercept must open the WallModal for a guest",
    ).toBeVisible({ timeout: 10_000 });

    // Step 4 · press "Create free account" inside the modal. This
    // runs setPendingAndSignUpAction which writes the one-shot
    // pending-wall cookie and redirects to /sign-in?mode=signup
    // (Cycle 14 fix · was previously redirecting to the retired
    // /nex-native/create-account which fell through to a not-found
    // surface · GAP-C14-001).
    await Promise.all([
      page.waitForURL(/\/nex-native\/sign-in\?mode=signup/, {
        timeout: 15_000,
      }),
      modal.locator('[data-nex-account-wall-primary]').click(),
    ]);

    // Step 5 · fill in the signup form and submit.
    await page.locator('[data-nex-sign-up-input-name]').fill(fullName);
    await page.locator('[data-nex-sign-up-input-email]').fill(email);
    await page.locator('[data-nex-sign-up-input-password]').fill(password);
    await page.locator('[data-nex-sign-up-form] button[type="submit"]').click();

    // Step 6-7 · createNexAccountAction creates the account, consumes
    // the pending cookie via the shared `consumeAndApplyPendingAccountWall`
    // module (Cycle 14 Fix A · GAP-C14-002), inline-writes the chat_theme,
    // and redirects to the theme viewer.
    await page.waitForURL(
      new RegExp(`/nex-native/themes/${themeId}(?:\\?|$)`),
      { timeout: 25_000 },
    );
    expect(
      page.url(),
      "final URL must carry applied=1 marker emitted by the post-signup-apply handler",
    ).toContain("applied=1");

    // Resolve the created Supabase user id so we can read + clean up.
    const sb = supabaseAdmin();
    const { data: userList } = await sb.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const created = userList?.users?.find((u) => u.email === email);
    expect(created?.id, "created auth user must exist").toBeTruthy();
    createdUserId = created!.id;

    // Step 8a · DB chat_theme reads nex-bubbles · decisive proof
    // the theme was applied to the just-created account.
    const dbTheme = await readChatTheme(createdUserId);
    expect(
      dbTheme,
      "nex_account.chat_theme must equal the chosen themeId " +
        "for the brand-new account created by this journey",
    ).toBe(themeId);

    // Step 8b · Applied toast present + action bar absent · decisive
    // proof the server-side `isAlreadyApplied` predicate resolved to
    // true on the authenticated viewer's own account (no second
    // Activate press required).
    await expect(
      page.locator("[data-nex-theme-applied-toast]"),
      "Applied toast must render on the authenticated viewer",
    ).toBeAttached({ timeout: 10_000 });
    await expect(
      page.locator("[data-nex-theme-action-bar]"),
      "ThemePreviewActionBar must be absent (sealed 2026-10-28 behaviour)",
    ).toHaveCount(0);

    // Step 8c · pending-wall cookie has been cleared on the same
    // response that applied the theme (Cycle 13 route.ts fix).
    const cookies = await page.context().cookies();
    const stillPending = cookies.find(
      (c) => c.name === "nex_pending_wall" && c.value !== "",
    );
    expect(
      stillPending,
      "nex_pending_wall must NOT survive the post-signup-apply redirect " +
        "with a non-empty value · the handler emits Set-Cookie clear",
    ).toBeUndefined();
  } finally {
    // Cleanup · always runs so a mid-test assertion failure does not
    // leave an orphan test account behind. Looks up the user by email
    // in case the id was not captured before the failure.
    if (createdUserId) {
      await deleteTestUser(createdUserId);
    } else {
      try {
        const sb = supabaseAdmin();
        const { data } = await sb.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const fallback = data?.users?.find((u) => u.email === email);
        if (fallback?.id) await deleteTestUser(fallback.id);
      } catch {
        /* non-fatal · cleanup script will sweep the pattern later */
      }
    }
  }
});
