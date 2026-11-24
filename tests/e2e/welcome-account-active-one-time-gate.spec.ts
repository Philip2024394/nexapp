// tests/e2e/welcome-account-active-one-time-gate.spec.ts
//
// NEX-024 · D3a verification · owner-sealed 2026-11-24.
//
// Exercises the one-time-gate semantics of /nex-native/welcome/
// account-active against the live dev server at http://localhost:3008.
// Every assertion is against observed HTTP responses, browser cookies,
// rendered DOM, or document.cookie · never source-code grep.
//
// Environment reality (observed, not assumed):
//   · The server-side `redirect("/nex-native/sign-in")` in the page
//     materialises as `<meta http-equiv="refresh" content="1;url=/...">`
//     in the response HTML. The HTTP status is 200 with the meta
//     refresh triggering navigation ~1s later. Tests therefore wait on
//     `page.waitForURL(...)` after the goto rather than treating
//     domcontentloaded as the end of the redirect chain.
//   · NEX_DEV_IMPERSONATE_HANDLE is commented out in .env.local so the
//     dev-impersonation persona fallback is OFF. Guests are real
//     guests · a fresh context genuinely has no session.
//   · NEX_ADMIN_EMAILS + NEX_ADMIN_DEV_PASSWORD ARE set, so the dev-
//     pass sign-in path is available and produces a REAL Supabase
//     session. The spec uses this path (not a stale storageState) so
//     every authenticated case stands on genuine auth.
//
// What this spec intentionally does NOT do:
//   · Does NOT assert production Secure-cookie behaviour · Secure is
//     NODE_ENV=production-gated on the server and this dev run will
//     see Secure=false. A production smoke test owns the inverse.
//   · Does NOT bypass the gate by setting the HttpOnly cookie
//     from the client · the whole point of the test is that it CAN'T.
//   · Does NOT inject session cookies · auth is achieved by driving
//     the real dev-pass form, so the resulting session is real.

import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const WELCOME_PATH = "/nex-native/welcome/account-active";
const CONTACTS_PATH = "/nex-native/contacts";
const SIGN_IN_PATH = "/nex-native/sign-in";
const SHOP_START_FROM_SIGNUP = "/nex-native/manage/shop/start?from=signup";

const COOKIE_NAME = "nex_account_active_seen";
const EXPECTED_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
const EXPECTED_MAX_AGE_TOLERANCE = 60 * 60; // ±1 hour · set-vs-read drift

const META_REFRESH_WAIT_MS = 8_000;
const NAV_TIMEOUT_MS = 20_000;

async function readSeenCookie(context: BrowserContext): Promise<
  | {
      value: string;
      httpOnly: boolean;
      sameSite: string;
      secure: boolean;
      expiresInSeconds: number;
    }
  | null
> {
  const cookies = await context.cookies();
  const c = cookies.find((x) => x.name === COOKIE_NAME);
  if (!c) return null;
  const expiresInSeconds =
    c.expires && c.expires > 0 ? c.expires - Math.floor(Date.now() / 1000) : -1;
  return {
    value: c.value,
    httpOnly: c.httpOnly,
    sameSite: String(c.sameSite ?? ""),
    secure: c.secure,
    expiresInSeconds,
  };
}

/**
 * Drive the real dev-pass sign-in form so the resulting context holds
 * a genuine Supabase session, not a mocked storageState. Returns the
 * final URL after sign-in · the Dev Pass form posts to signInAction
 * which redirects signed-in users to /nex-native/contacts.
 *
 * Fails the test loudly if the Dev Pass button is not rendered · that
 * means the dev server is missing NEX_ADMIN_EMAILS / NEX_ADMIN_DEV_
 * PASSWORD, in which case this spec cannot run honestly.
 */
async function signInViaDevPass(page: Page): Promise<void> {
  await page.goto(SIGN_IN_PATH, { waitUntil: "domcontentloaded" });
  const devPass = page.locator('[data-nex-dev-pass-button]');
  const count = await devPass.count();
  test.skip(
    count === 0,
    "Dev Pass button not present · the local dev server is missing " +
      "NEX_ADMIN_EMAILS or NEX_ADMIN_DEV_PASSWORD in .env.local. " +
      "This spec needs the dev-pass auth path to produce a real " +
      "Supabase session. Owner must either populate those env vars " +
      "or provision a different test-account mechanism.",
  );
  await devPass.first().click();
  // Wait for either a successful redirect to /contacts OR a sign-in
  // failure banner. We don't know which will happen until the server
  // responds · race both and inspect the result.
  await page.waitForURL(
    (url) => url.pathname === SIGN_IN_PATH || url.pathname.includes(CONTACTS_PATH),
    { timeout: NAV_TIMEOUT_MS },
  );
  const settled = page.url();
  // If we were bounced back to sign-in with an error, the dev-pass
  // path is not operational in this environment · skip honestly
  // rather than pretend the authenticated journey ran.
  if (settled.includes(SIGN_IN_PATH)) {
    const urlObj = new URL(settled);
    const errorCode = urlObj.searchParams.get("e") ?? "";
    const errorMsg = urlObj.searchParams.get("m") ?? "";
    test.skip(
      true,
      `Dev-pass sign-in did not establish a Supabase session · server ` +
        `returned code="${errorCode}" message="${errorMsg}". The admin ` +
        `email in NEX_ADMIN_EMAILS likely needs email confirmation in ` +
        `the sandbox Supabase project (kdstoyyeygcopkogqsyv), or the ` +
        `password in NEX_ADMIN_DEV_PASSWORD does not match the account. ` +
        `Owner must either (a) confirm the admin email in Supabase ` +
        `Auth, (b) provision a fresh sb-*-auth-token storageState at ` +
        `tests/e2e/.auth/state.json, or (c) enable NEX_DEV_IMPERSONATE_` +
        `HANDLE for local testing. Until then B/C/D/E cannot run ` +
        `honestly on this dev environment.`,
    );
  }
}

/**
 * Wait for Next.js's meta-refresh redirect to land on an expected path.
 * `page.goto(..., { waitUntil: "domcontentloaded" })` returns before
 * the refresh fires, so we poll `page.url()` up to a budget.
 */
async function waitForUrlContains(
  page: Page,
  needle: string,
  timeoutMs: number = META_REFRESH_WAIT_MS,
): Promise<void> {
  // Escape slashes for RegExp.
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  await page.waitForURL(re, { timeout: timeoutMs });
}

// ────────────────────────────────────────────────────────────────────
// A · Unauthenticated redirect
// ────────────────────────────────────────────────────────────────────

test.describe("account-active · unauthenticated", () => {
  test("A · redirects guest to /sign-in", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(WELCOME_PATH, { waitUntil: "domcontentloaded" });

    // Next.js server redirect manifests as meta-refresh · wait for it.
    await waitForUrlContains(page, SIGN_IN_PATH);
    expect(page.url()).toContain(SIGN_IN_PATH);

    const seen = await readSeenCookie(ctx);
    expect(seen, "guest must never receive the seen cookie").toBeNull();

    await ctx.close();
  });
});

// ────────────────────────────────────────────────────────────────────
// B · First visit renders welcome + sets HttpOnly cookie
// ────────────────────────────────────────────────────────────────────

test.describe("account-active · authenticated (dev-pass real Supabase)", () => {
  test("B · first visit renders welcome + sets HttpOnly cookie", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signInViaDevPass(page);

    // After sign-in dev-pass has redirected us to /contacts. Confirm
    // no seen-cookie exists yet · this proves the test starts clean.
    const pre = await readSeenCookie(ctx);
    expect(pre, "pre-visit · seen cookie must not be set").toBeNull();

    await page.goto(WELCOME_PATH, { waitUntil: "domcontentloaded" });
    // Give the page a moment · if it was going to redirect we would
    // land elsewhere. We assert it did NOT redirect.
    expect(page.url()).toContain(WELCOME_PATH);
    await expect(
      page.getByText(/your NEX account is active/i),
    ).toBeVisible();

    const seen = await readSeenCookie(ctx);
    expect(seen, "seen cookie must be set after first visit").not.toBeNull();
    expect(seen!.value).toBe("1");
    expect(seen!.httpOnly, "cookie must be HttpOnly").toBe(true);
    // Playwright normalises SameSite to "Strict" | "Lax" | "None".
    expect(seen!.sameSite).toBe("Lax");
    // Secure is NODE_ENV-gated on the server. Dev server runs with
    // NODE_ENV=development so Secure MUST be false. Production smoke
    // test owns the inverse assertion.
    expect(seen!.secure).toBe(false);
    expect(seen!.expiresInSeconds).toBeGreaterThan(
      EXPECTED_MAX_AGE_SECONDS - EXPECTED_MAX_AGE_TOLERANCE,
    );
    expect(seen!.expiresInSeconds).toBeLessThan(
      EXPECTED_MAX_AGE_SECONDS + EXPECTED_MAX_AGE_TOLERANCE,
    );

    // Prove HttpOnly against a live browser · document.cookie must NOT
    // expose the cookie even though the context has it.
    const docCookie = await page.evaluate(() => document.cookie);
    expect(
      docCookie.includes(COOKIE_NAME),
      "HttpOnly cookie must be invisible to document.cookie",
    ).toBe(false);

    await ctx.close();
  });

  test("C · second visit with seen cookie redirects to /contacts", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signInViaDevPass(page);

    // First visit · establish the seen cookie honestly through the
    // real route (we do NOT inject a cookie into the context).
    await page.goto(WELCOME_PATH, { waitUntil: "domcontentloaded" });
    expect(page.url()).toContain(WELCOME_PATH);
    const firstSeen = await readSeenCookie(ctx);
    expect(firstSeen, "first visit must set the seen cookie").not.toBeNull();

    // Second visit · must redirect to contacts.
    await page.goto(WELCOME_PATH, { waitUntil: "domcontentloaded" });
    await waitForUrlContains(page, CONTACTS_PATH);
    expect(
      page.url(),
      "returning signed-in visitor must land on /contacts, not re-see welcome",
    ).toContain(CONTACTS_PATH);

    // Celebration headline must NOT be present after the redirect.
    await expect(
      page.getByText(/your NEX account is active/i),
    ).toHaveCount(0);

    await ctx.close();
  });

  test("D · client-JS cookie forgery cannot bypass server trust", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signInViaDevPass(page);

    // Attempt a client-side forgery of the seen cookie BEFORE first
    // welcome visit. HttpOnly means the server will not recognise this
    // JS-set cookie as its trust signal · it will read via next/
    // headers cookies() and see no server-set HttpOnly cookie, so it
    // will render the celebration.
    await page.evaluate((name) => {
      document.cookie = `${name}=1; path=/`;
    }, COOKIE_NAME);

    await page.goto(WELCOME_PATH, { waitUntil: "domcontentloaded" });
    expect(
      page.url(),
      "forged JS cookie must not cause server to skip onboarding",
    ).toContain(WELCOME_PATH);
    await expect(
      page.getByText(/your NEX account is active/i),
    ).toBeVisible();

    // After the real visit the cookie we observe must be HttpOnly
    // (the server-set one, not the JS-forged one).
    const seen = await readSeenCookie(ctx);
    expect(seen).not.toBeNull();
    expect(
      seen!.httpOnly,
      "cookie observed after real visit must be the HttpOnly server cookie",
    ).toBe(true);

    await ctx.close();
  });

  test("E · /manage/shop/start?from=signup Skip-for-now link resolves to welcome", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signInViaDevPass(page);

    await page.goto(SHOP_START_FROM_SIGNUP, { waitUntil: "domcontentloaded" });

    // The admin test account may already own a business, in which case
    // shop-start redirects to /manage/shop/themes and the Skip-for-now
    // footer is unreachable. Detect that + skip honestly rather than
    // assert on behaviour we didn't exercise.
    const settledUrl = page.url();
    test.skip(
      settledUrl.includes("/manage/shop/themes"),
      "Admin dev-pass account already owns a business · shop-start " +
        "redirects to /themes and never exposes the Skip-for-now " +
        "footer. Signup-intent routing is verified in code by " +
        "shop/start/page.tsx line 532-556 (reviewed separately). A " +
        "no-business test account would be needed to exercise the " +
        "Skip-for-now DOM link here.",
    );

    const skipLink = page.getByRole("link", { name: /skip for now/i });
    await expect(skipLink).toBeVisible();
    const href = await skipLink.getAttribute("href");
    expect(href).toBe(WELCOME_PATH);

    await ctx.close();
  });
});
