// tests/e2e/journey-free-chat-cookie-signup.spec.ts
//
// L-052 follow-up · Option B cookie→DB migration on signup · full
// browser proof. Sibling to `journey-selected-theme-cookie-signup.spec.ts`
// (which proves the `nex_selected_theme` whitelisted-cookie path); this
// spec proves the `nex-free-chat-wallpaper` library-asset cookie path
// added by the owner-sealed 2026-11-27 Option B directive.
//
// The flow it locks in:
//
//   1. A guest (fresh context, no cookies) has picked a free library
//      wallpaper from the first-visit three-category cards on
//      /nex-native/free-chat. That pick is persisted client-side by
//      `ApplyPreviewModal` as the first-party `nex-free-chat-wallpaper`
//      cookie carrying the BARE asset id (no `chat:` prefix). In this
//      spec we inject the cookie directly on the context so the proof
//      is scoped to the signup half of the loop.
//
//   2. Guest arrives at `/nex-native/sign-in?mode=signup` and submits
//      the signup form.
//
//   3. `createNexAccountAction` in `src/app/nex-native/_actions.ts`
//      (block added 2026-11-27 at lines ~626-678, BEFORE the sealed
//      `nex_selected_theme` branch) reads `nex-free-chat-wallpaper`,
//      calls `seedChatThemeFromFreeChatCookie` from
//      `src/lib/nex-native/chat-theme-service.ts` which:
//         · re-prefixes the bare id to `chat:<bare>`,
//         · looks it up via `getBackgroundAsset`,
//         · enforces chat-context + `tier === "gratis"` entitlement,
//         · lazy-upserts the matching `nex_chat_theme` row
//           (same shape as `applyFromLibraryChatAction`),
//         · writes `nex_account.chat_theme` via the sealed validator
//           in `accountService.updateChatTheme`.
//      On success the server action clears the cookie with the sealed
//      `jar.set(..., maxAge:0)` discipline and signup continues to its
//      default landing (`/nex-native/contacts` when no other
//      redirect-cookie is set).
//
// Decisive customer-outcome proof:
//   · DB `nex_account.chat_theme` = the bare library asset id.
//   · `nex-free-chat-wallpaper` cookie is cleared on the browser.
//   · Signup completed · auth user exists · landing is /contacts.
//
// Sandbox-only. Prod ref is refused. Cleanup via Supabase admin in
// `finally`, same shape as the sibling signup specs.
//
// Classification: SPEC AUTHORED under Stage A · fresh-cookie viewer.

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

async function pickSandboxGratisChatLibraryId(): Promise<string> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("nex_background_asset")
    .select("id,tier")
    .like("id", "chat:library-ireland-%")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<{ id: string; tier: string }>();
  if (error) throw new Error(`asset lookup · ${error.message}`);
  if (!data) throw new Error("no chat:library-ireland-% asset in sandbox");
  if (data.tier !== "gratis") {
    throw new Error(`asset tier must be gratis · got ${data.tier}`);
  }
  return data.id.replace(/^chat:/, "");
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

// Fresh context · guest branch must run so the cookie-read path
// exercises the newly added seed block.
test.use({ storageState: { cookies: [], origins: [] } });

// Sandbox rate-limit · same rationale as the other cycle-14 journey
// specs. Hermetic clear before the test.
test.beforeEach(async () => {
  await withPgClient(async (c) => {
    await c.query(
      `DELETE FROM nex_security_rate_limit WHERE action = 'account_create'`,
    );
  });
});

test("nex-free-chat-wallpaper · guest picks free library wallpaper then signs up · chat_theme seeded on account", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(90_000);
  assertSandboxRef();

  const bareWallpaperId = await pickSandboxGratisChatLibraryId();

  const stamp = Date.now();
  const email = `l052-freechatcookie-${stamp}@sandbox.invalid`;
  const password = `TestPass!${stamp}`;
  const fullName = `L052 FreeChatCookie ${stamp}`;

  // Resolve the origin we'll bind the cookie to from Playwright's
  // baseURL (`playwright.config.ts` sets this to the dev server).
  const origin = new URL(baseURL ?? "http://localhost:3008");

  let createdUserId: string | null = null;

  try {
    // Step 1 · simulate the ApplyPreviewModal client-side cookie write
    // by injecting the first-party cookie directly on the context.
    // Value shape matches what `_full-library-client.tsx` writes
    // (bare asset id with chat:/shop: prefix stripped).
    await context.addCookies([
      {
        name: "nex-free-chat-wallpaper",
        value: bareWallpaperId,
        domain: origin.hostname,
        path: "/",
        httpOnly: false,
        secure: origin.protocol === "https:",
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      },
    ]);

    // Step 2 · guest arrives at the sealed sign-in surface in signup
    // mode. Sanity-check the cookie is attached to the context.
    const cookiesBefore = await context.cookies();
    expect(
      cookiesBefore.find((c) => c.name === "nex-free-chat-wallpaper")?.value,
      "free-chat wallpaper cookie must be attached before signup",
    ).toBe(bareWallpaperId);

    await page.goto("/nex-native/sign-in?mode=signup", {
      waitUntil: "domcontentloaded",
    });

    // Step 3 · fill the signup form and submit.
    await page.locator("[data-nex-sign-up-input-name]").fill(fullName);
    await page.locator("[data-nex-sign-up-input-email]").fill(email);
    await page.locator("[data-nex-sign-up-input-password]").fill(password);
    await page
      .locator('[data-nex-sign-up-form] button[type="submit"]')
      .click();

    // Step 4 · with neither nex_selected_theme nor WELCOME_INTENT_COOKIE
    // nor a `next=` form field set, `createNexAccountAction` lands on
    // `/nex-native/contacts` by default.
    await page.waitForURL(/\/nex-native\/contacts(?:\?|$)/, {
      timeout: 25_000,
    });

    // Resolve the created auth user.
    const sb = supabaseAdmin();
    const { data: userList } = await sb.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const created = userList?.users?.find((u) => u.email === email);
    expect(created?.id, "signup must have created the auth user").toBeTruthy();
    createdUserId = created!.id;

    // Decisive customer-outcome: DB chat_theme row is the bare library id.
    expect(
      await readChatTheme(createdUserId),
      "nex_account.chat_theme must equal the bare library wallpaper id",
    ).toBe(bareWallpaperId);

    // nex-free-chat-wallpaper cookie cleared · maxAge:0 discipline is
    // the authority. We assert absence-or-empty-value, which matches
    // `jar.set(name, "", { maxAge: 0 })` semantics.
    const afterCookies = await context.cookies();
    const stillSet = afterCookies.find(
      (c) => c.name === "nex-free-chat-wallpaper" && c.value !== "",
    );
    expect(
      stillSet,
      "nex-free-chat-wallpaper must be cleared after seed",
    ).toBeUndefined();

    // `nex_selected_theme` must stay untouched · this flow does not
    // interact with the NEX-brand whitelist cookie.
    const strayWhitelist = afterCookies.find(
      (c) => c.name === "nex_selected_theme" && c.value !== "",
    );
    expect(
      strayWhitelist,
      "free-chat cookie flow must not set or interact with nex_selected_theme",
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
