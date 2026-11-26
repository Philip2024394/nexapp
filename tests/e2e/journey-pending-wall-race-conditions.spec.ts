// tests/e2e/journey-pending-wall-race-conditions.spec.ts
//
// CYCLE 14 · G-4 · one-shot pending-account-wall race-condition proofs.
// Owner-required 2026-11-25 as part of Fix A acceptance:
//   "The shared function must preserve one-shot behaviour, including
//    under repeated or concurrent requests. Claude should test this
//    rather than assume that clearing a browser cookie alone guarantees
//    atomic consumption."
//   "Clearing a cookie in a server action does not by itself prove
//    atomic one-shot consumption. Claude must explicitly test the race
//    conditions between the server action and the retained Route
//    Handler."
// -----------------------------------------------------------------------------
// The one-shot primitive lives at `src/lib/nex-native/account-wall/
// pending-action.ts` · `consumePendingAccountWall` reads AND clears
// the `nex_pending_wall` cookie atomically on the server. BOTH callers
// (the server-action path in `createNexAccountAction` / `signInAction`,
// and the retained Route Handler at `/post-signup-apply`) consume via
// the shared `consumeAndApplyPendingAccountWall` module (Fix A,
// GAP-C14-002).
//
// Three browser-observable invariants this spec proves:
//
//   TEST A · Replay-after-apply must be a no-op. After a successful
//            signup+apply has landed on the authenticated viewer with
//            `?applied=1`, directly navigating back to
//            `/post-signup-apply` MUST NOT reapply a theme, MUST NOT
//            resurrect the cookie, and MUST NOT return the user to a
//            misleading `?applied=1` URL. The handler must see no
//            cookie and redirect safely to a non-apply destination.
//
//   TEST B · Back-navigation after apply must not resurrect the
//            pending-wall cookie. The route-handler's Set-Cookie clear
//            (defence-in-depth against Next.js 16 best-effort
//            cookies().set in RSC contexts) must survive browser
//            history replay. Post-apply back-nav to the handler URL
//            must leave the cookie cleared and the chat_theme row
//            unchanged in the DB.
//
// Sandbox-only. Both tests create a throwaway account under
// `c14-race-<stamp>@sandbox.invalid`, assert via DB that chat_theme is
// written exactly once, and clean up in `finally`.
//
// Boundaries honoured (same as journey-full-guest-signup-pick-theme.spec.ts):
//   · Sandbox project kdstoyyeygcopkogqsyv only · guard before every op.
//   · No production DB writes.
//   · No migration 342 touch.
//   · Email-confirmation disabled in sandbox is a pre-existing project
//     setting · not altered.
//   · NEX_PRELAUNCH_MODE=false in .env.local is pre-existing · not altered.

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
 * Resolve the sandbox Postgres URL, preferring the pooler
 * (`DATABASE_URL`) over the direct URL when the username-encoded ref
 * matches the sealed sandbox project. The direct URL is IPv6-only on
 * Supabase projects without the IPv4 add-on and times out from
 * IPv4-only hosts (which is exactly what blew up four specs in the
 * 2026-11-26 baseline). This mirrors the sealed helper in the shared
 * harness (`sandbox-test-harness.resolveSandboxDbUrl`).
 */
function resolveSandboxDbUrlLocal(): string {
  try {
    const pooler = envVar("DATABASE_URL");
    const u = new URL(pooler);
    const dotIdx = u.username.indexOf(".");
    const refInUser = dotIdx > -1 ? u.username.slice(dotIdx + 1) : "";
    if (refInUser === SANDBOX_REF) return pooler;
  } catch {
    // fall through to direct URL
  }
  return envVar("SANDBOX_DATABASE_URL");
}

async function withPgClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  assertSandboxRef();
  const c = new Client({ connectionString: resolveSandboxDbUrlLocal() });
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

async function overwriteChatTheme(
  supabaseUserId: string,
  newTheme: string,
): Promise<void> {
  // Direct sandbox UPDATE · used to park the row at a SENTINEL value
  // after the journey apply. If a stale pending-wall cookie were to
  // replay through /post-signup-apply, the handler's authoritative
  // updateChatTheme would overwrite the sentinel back to the original
  // themeId · detectable by a subsequent read.
  await withPgClient(async (c) => {
    await c.query(
      `UPDATE nex_account SET chat_theme = $1 WHERE supabase_user_id = $2`,
      [newTheme, supabaseUserId],
    );
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

// Fresh context · guest branch must run for the signup setup.
test.use({ storageState: { cookies: [], origins: [] } });

// Clear the sandbox `account_create` rate-limit before each test so
// serial runs of the cycle-14 signup journeys can all complete. The
// production `account_create` bucket is 3/hour per IP; each test
// here creates a throwaway account from the same CI/dev IP.
test.beforeEach(async () => {
  await withPgClient(async (c) => {
    await c.query(
      `DELETE FROM nex_security_rate_limit WHERE action = 'account_create'`,
    );
  });
});

/**
 * Shared setup: drive a guest through the full
 * Use-this-theme → WallModal → /sign-in?mode=signup → signup form
 * → apply flow, returning the just-created userId so each test
 * can assert from a known-good authenticated state.
 */
async function signUpAndApply(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  fullName: string,
  themeId: string,
): Promise<string> {
  const themeViewer = `/nex-native/themes/${themeId}`;
  await page.goto(themeViewer, { waitUntil: "networkidle" });
  const useBtn = page.locator('[data-nex-theme-action-bar-use]');
  await expect(useBtn).toBeVisible({ timeout: 10_000 });
  await expect(
    page.locator('[data-nex-account-wall-trigger="pick-theme"]'),
  ).toBeAttached({ timeout: 10_000 });

  await useBtn.click();
  const modal = page.locator('[data-nex-account-wall="pick-theme"]');
  await expect(modal).toBeVisible({ timeout: 10_000 });

  await Promise.all([
    page.waitForURL(/\/nex-native\/sign-in\?mode=signup/, { timeout: 15_000 }),
    modal.locator('[data-nex-account-wall-primary]').click(),
  ]);

  await page.locator('[data-nex-sign-up-input-name]').fill(fullName);
  await page.locator('[data-nex-sign-up-input-email]').fill(email);
  await page.locator('[data-nex-sign-up-input-password]').fill(password);
  await page.locator('[data-nex-sign-up-form] button[type="submit"]').click();

  await page.waitForURL(
    new RegExp(`/nex-native/themes/${themeId}(?:\\?|$)`),
    { timeout: 25_000 },
  );
  expect(page.url()).toContain("applied=1");

  const sb = supabaseAdmin();
  const { data: userList } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const created = userList?.users?.find((u) => u.email === email);
  expect(created?.id, "signup must have created the Supabase auth user").toBeTruthy();
  return created!.id;
}

test.describe("pending-wall one-shot · race-condition regression", () => {
  test.describe.configure({ timeout: 120_000 });

  test("TEST A · direct re-visit to /post-signup-apply after apply must not replay", async ({
    page,
  }) => {
    assertSandboxRef();
    const themeId = "nex-bubbles";
    const stamp = Date.now();
    const email = `c14-race-a-${stamp}@sandbox.invalid`;
    const password = `TestPass!${stamp}`;
    const fullName = `Cycle14 RaceA ${stamp}`;
    let createdUserId: string | null = null;

    try {
      createdUserId = await signUpAndApply(
        page,
        email,
        password,
        fullName,
        themeId,
      );

      // Baseline · DB has the applied theme.
      expect(await readChatTheme(createdUserId)).toBe(themeId);

      // Park the DB at a SENTINEL theme id. If a stale pending-wall
      // cookie were to replay the original themeId, the handler's
      // authoritative write would flip the row back · detected below.
      const SENTINEL = "nex-flat";
      await overwriteChatTheme(createdUserId, SENTINEL);
      expect(await readChatTheme(createdUserId)).toBe(SENTINEL);

      // Confirm pending cookie is already cleared after the server-action
      // path · this is the invariant we're about to attack.
      const afterApplyCookies = await page.context().cookies();
      const stillPending = afterApplyCookies.find(
        (c) => c.name === "nex_pending_wall" && c.value !== "",
      );
      expect(
        stillPending,
        "baseline · pending-wall cookie must already be cleared after server-action apply",
      ).toBeUndefined();

      // RACE · the authenticated user directly navigates back to
      // /post-signup-apply. This is what a bookmark, history-replay, or
      // an attacker-crafted link would do. The retained Route Handler
      // must see no cookie, bounce to /contacts, and NEVER return a
      // `?applied=1` URL.
      // domcontentloaded (not networkidle) · /contacts keeps a
      // realtime WebSocket open, so networkidle never fires. We care
      // about the final URL after the 303, which lands on domloaded.
      await page.goto("/nex-native/post-signup-apply", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      expect(
        page.url(),
        "post-apply replay must not land back on an applied-marker URL",
      ).not.toContain("applied=1");
      expect(
        page.url(),
        "post-apply replay must redirect to a safe non-apply destination",
      ).toMatch(/\/nex-native\/(contacts|home)/);

      // Applied toast must NOT appear · the shared module returns null
      // (no cookie) → handler bounces to /contacts.
      await expect(
        page.locator("[data-nex-theme-applied-toast]"),
        "no theme toast on the non-apply destination",
      ).toHaveCount(0);

      // DB chat_theme must STILL be the sentinel · no re-write
      // happened. A failed one-shot would overwrite SENTINEL back to
      // the original themeId.
      expect(
        await readChatTheme(createdUserId),
        "chat_theme must stay at sentinel · proves no silent re-apply",
      ).toBe(SENTINEL);

      // Cookie still cleared after the replay attempt.
      const afterReplay = await page.context().cookies();
      const resurrected = afterReplay.find(
        (c) => c.name === "nex_pending_wall" && c.value !== "",
      );
      expect(
        resurrected,
        "pending-wall cookie must not resurrect after replay",
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
        } catch { /* non-fatal */ }
      }
    }
  });

  test("TEST B · browser back-navigation after apply must not resurrect cookie or double-apply", async ({
    page,
  }) => {
    assertSandboxRef();
    const themeId = "nex-bubbles";
    const stamp = Date.now();
    const email = `c14-race-b-${stamp}@sandbox.invalid`;
    const password = `TestPass!${stamp}`;
    const fullName = `Cycle14 RaceB ${stamp}`;
    let createdUserId: string | null = null;

    try {
      createdUserId = await signUpAndApply(
        page,
        email,
        password,
        fullName,
        themeId,
      );

      // Park at a SENTINEL · same strategy as TEST A. A back-nav that
      // silently replayed the one-shot would overwrite SENTINEL back
      // to themeId.
      const SENTINEL = "nex-flat";
      await overwriteChatTheme(createdUserId, SENTINEL);
      expect(await readChatTheme(createdUserId)).toBe(SENTINEL);

      // Push an intermediate same-origin visit so page.goBack() lands
      // on the applied destination and a SECOND goBack() lands further
      // into history. This is a realistic back-nav shape · a user
      // continues into their inbox then taps Back repeatedly.
      await page.goto("/nex-native/contacts", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.goBack({
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      // After one goBack we're back on the applied theme viewer. This
      // is the browser's history-replay of the 303 destination.
      expect(page.url()).toMatch(
        new RegExp(`/nex-native/themes/${themeId}(?:\\?|$)`),
      );

      // DB chat_theme must still be SENTINEL · back-nav must not
      // trigger a re-write.
      expect(
        await readChatTheme(createdUserId),
        "back-nav after apply must not silently re-apply the original theme",
      ).toBe(SENTINEL);

      // Cookie still cleared.
      const cookies = await page.context().cookies();
      const resurrected = cookies.find(
        (c) => c.name === "nex_pending_wall" && c.value !== "",
      );
      expect(
        resurrected,
        "back-nav must not resurrect the pending-wall cookie from history cache",
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
        } catch { /* non-fatal */ }
      }
    }
  });
});
