// tests/e2e/journey-selected-theme-cookie-signup.spec.ts
//
// CYCLE 14 · G-4 P1b · SELECTED_THEME_COOKIE splash-selection journey.
// Owner-required 2026-11-25 as part of Fix A acceptance scope.
// -----------------------------------------------------------------------------
// This spec proves the SECOND pick-theme handoff mechanism, distinct from
// the pending-account-wall flow that `journey-full-guest-signup-pick-theme`
// verifies.
//
// The flow:
//
//   1. Guest (no cookies) visits a free NEX-brand theme preview
//      (`/nex-native/themes/nex-bubbles`). The `MarkSelectedThemeClient`
//      component fires `POST /api/nex-native/select-theme?id=nex-bubbles`
//      on mount, which writes the hard-whitelisted httpOnly cookie
//      `nex_selected_theme=nex-bubbles` (24h TTL).
//
//   2. Guest subsequently arrives at `/nex-native/sign-in?mode=signup`
//      and signs up. The cookie is set, but the guest never clicked
//      "Use this theme" (which would open the WallModal and use the
//      pending-wall path); the SELECTED_THEME path is the "I previewed
//      a free NEX theme while browsing" short-circuit.
//
//   3. `createNexAccountAction` in `src/app/nex-native/_actions.ts`
//      (lines 643-672 of 2026-11-25) reads `nex_selected_theme`, calls
//      `parseSelectedThemeId` (hard whitelist: nex-bubbles | nex-flat),
//      deletes the cookie, authoritatively writes
//      `accountService.updateChatTheme(freshAcc.id, chosen)`, and
//      303-redirects to `/nex-native/themes/nex-bubbles?applied=1`.
//
// Decisive customer-outcome proof:
//   · DB `nex_account.chat_theme` = the whitelisted themeId.
//   · Landing URL carries `applied=1` + opens the applied toast.
//   · `nex_selected_theme` cookie is cleared.
//   · ThemePreviewActionBar is absent on the authenticated viewer
//     (sealed 2026-10-28 · when account.chat_theme === themeId the
//     bar returns null).
//   · Only ONE auth user created · no orphan pre-apply user.
//
// 2026-11-25 · Cycle-14 F2 · the Class-A known limitation originally
// noted here (GuestSignupBanner default `signupHref` pointing at the
// retired `/nex-native/create-account` route) was fixed in the same
// cycle · the default now targets the sealed one-URL auth signup mode
// `/nex-native/sign-in?mode=signup`. The direct-navigation step below
// remains valid as the server-action half's proof surface; the
// organic in-page CTA is additionally guarded by the new
// `journey-theme-viewer-organic-signup.spec.ts` regression spec.
//
// Sandbox-only. Cleanup via Supabase admin in `finally`, same shape
// as `journey-full-guest-signup-pick-theme.spec.ts`.

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
  await withPgClient(async (c) => {
    await c.query(
      `DELETE FROM nex_account WHERE supabase_user_id = $1`,
      [supabaseUserId],
    );
  });
  const r = await sb.auth.admin.deleteUser(supabaseUserId);
  if (r.error && !/not.?found/i.test(r.error.message)) {
    // eslint-disable-next-line no-console
    console.warn(`[cleanup] deleteUser failed · ${r.error.message}`);
  }
}

// Fresh context · guest branch must run so the beacon fires.
test.use({ storageState: { cookies: [], origins: [] } });

// Sandbox rate-limit · same rationale as the other cycle-14 journey
// specs. Hermetic clear before every test.
test.beforeEach(async () => {
  await withPgClient(async (c) => {
    await c.query(
      `DELETE FROM nex_security_rate_limit WHERE action = 'account_create'`,
    );
  });
});

test("SELECTED_THEME_COOKIE · guest previews free theme then signs up · chosen theme is auto-applied", async ({
  page,
}) => {
  test.setTimeout(90_000);
  assertSandboxRef();

  const themeId = "nex-bubbles";
  const themeViewer = `/nex-native/themes/${themeId}`;
  const stamp = Date.now();
  const email = `c14-selcookie-${stamp}@sandbox.invalid`;
  const password = `TestPass!${stamp}`;
  const fullName = `Cycle14 SelCookie ${stamp}`;

  let createdUserId: string | null = null;

  try {
    // Step 1 · guest lands on the theme viewer · MarkSelectedThemeClient
    // mounts and fires POST /api/nex-native/select-theme. Wait for the
    // request-response pair explicitly so we're not racing the next
    // navigation against an un-set cookie.
    const beaconResp = page.waitForResponse(
      (r) =>
        r.url().includes("/api/nex-native/select-theme") &&
        r.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.goto(themeViewer, { waitUntil: "domcontentloaded" });
    const resp = await beaconResp;
    expect(
      resp.status(),
      "select-theme beacon must succeed so the cookie is set",
    ).toBe(200);

    // Confirm the cookie landed on the browser context.
    const cookiesAfterBeacon = await page.context().cookies();
    const selected = cookiesAfterBeacon.find(
      (c) => c.name === "nex_selected_theme",
    );
    expect(
      selected?.value,
      "nex_selected_theme cookie must be written after the theme viewer mount",
    ).toBe(themeId);

    // Step 2 · guest arrives at the sealed sign-in surface in signup
    // mode. The organic in-page CTA (`GuestSignupBanner`) is currently
    // broken (Class A audit); this direct navigation represents the
    // post-fix organic flow and tests the server-action half today.
    await page.goto("/nex-native/sign-in?mode=signup", {
      waitUntil: "domcontentloaded",
    });

    // Step 3 · fill the signup form and submit.
    await page.locator('[data-nex-sign-up-input-name]').fill(fullName);
    await page.locator('[data-nex-sign-up-input-email]').fill(email);
    await page.locator('[data-nex-sign-up-input-password]').fill(password);
    await page.locator('[data-nex-sign-up-form] button[type="submit"]').click();

    // Step 4 · `createNexAccountAction` must consume the cookie and
    // redirect to /themes/<id>?applied=1.
    await page.waitForURL(
      new RegExp(`/nex-native/themes/${themeId}(?:\\?|$)`),
      { timeout: 25_000 },
    );
    expect(
      page.url(),
      "final URL must carry applied=1 marker emitted by the SELECTED_THEME branch",
    ).toContain("applied=1");

    // Resolve the created user.
    const sb = supabaseAdmin();
    const { data: userList } = await sb.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const created = userList?.users?.find((u) => u.email === email);
    expect(created?.id, "signup must have created the auth user").toBeTruthy();
    createdUserId = created!.id;

    // Decisive customer-outcome: DB chat_theme row is the chosen id.
    expect(
      await readChatTheme(createdUserId),
      "nex_account.chat_theme must equal the SELECTED_THEME value",
    ).toBe(themeId);

    // Applied toast + action bar absent on the authenticated viewer.
    await expect(
      page.locator("[data-nex-theme-applied-toast]"),
      "Applied toast must render on the authenticated viewer",
    ).toBeAttached({ timeout: 10_000 });
    await expect(
      page.locator("[data-nex-theme-action-bar]"),
      "ThemePreviewActionBar must be absent (sealed 2026-10-28)",
    ).toHaveCount(0);

    // nex_selected_theme cookie cleared · jar.delete() on the server
    // action is the authority. `nex_pending_wall` must also stay
    // untouched (this flow does not interact with it).
    const afterCookies = await page.context().cookies();
    const stillSelected = afterCookies.find(
      (c) => c.name === "nex_selected_theme" && c.value !== "",
    );
    expect(
      stillSelected,
      "nex_selected_theme must be cleared after consumption",
    ).toBeUndefined();
    const strayPendingWall = afterCookies.find(
      (c) => c.name === "nex_pending_wall" && c.value !== "",
    );
    expect(
      strayPendingWall,
      "SELECTED_THEME flow must not set or interact with nex_pending_wall",
    ).toBeUndefined();
  } finally {
    if (createdUserId) await deleteTestUser(createdUserId);
    else {
      try {
        const sb = supabaseAdmin();
        const { data } = await sb.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const fb = data?.users?.find((u) => u.email === email);
        if (fb?.id) await deleteTestUser(fb.id);
      } catch {
        /* non-fatal */
      }
    }
  }
});
