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
const MARK_SEEN_ENDPOINT = "/api/nex-native/welcome/mark-seen";
const CONTACTS_PATH = "/nex-native/contacts";
const SIGN_IN_PATH = "/nex-native/sign-in";
const SHOP_START_FROM_SIGNUP = "/nex-native/manage/shop/start?from=signup";
// 2026-11-26 (L-008) · owner-sealed sign-in destination for already-
// signed-up users with a known device is `/nex-native/free-chat?show-
// themes=1` per `src/app/nex-native/_actions.ts:1004,1038` (sealed
// 2026-10-21 iteration 58). The original helper comment claiming
// `/contacts` is the dev-pass destination was authored before that
// seal landed; this spec now accepts either terminal destination.
const FREE_CHAT_PATH = "/nex-native/free-chat";

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
  // 2026-11-26 (L-008 · test-fixture fix) · wait for networkidle, not
  // domcontentloaded. Before React hydration completes the dev-pass
  // form's `action` attribute is the React placeholder
  // `javascript:throw new Error('A React form was unexpectedly
  // submitted ...')` · a deliberate fail-closed marker. Clicking the
  // button in that window is a no-op: no POST fires, no redirect
  // happens, the page simply stays on /sign-in with no `e=` query
  // param. The helper then saw bare `/sign-in` and tripped its
  // skip branch, leaving B and D unexecuted every run. Waiting
  // for networkidle means the hydration fetch chain has settled and
  // the form has been rewired to call the server action.
  await page.goto(SIGN_IN_PATH, { waitUntil: "networkidle" });
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
  // Note on hydration: the dev-pass <form>'s `action` attribute
  // keeps React's `javascript:throw ...` placeholder even post-
  // hydration · the Server Action is wired by intercepting the form
  // submit event, not by replacing the attribute. The `networkidle`
  // wait on goto is what ensures the submit handler is installed;
  // once that returns, clicking the button fires the server POST.
  await devPass.first().click();
  // Wait for a TERMINAL URL. The predicate must not match the bare
  // starting URL (`/sign-in` with no error params) because the Server
  // Action POST chain renders RSC payloads that transiently keep the
  // URL on `/sign-in` before the final navigation to `/free-chat` (or
  // `/contacts` on the legacy path). Matching too eagerly caused the
  // helper to exit before the real redirect, then skip the test on
  // the (misinterpreted) bare `/sign-in` URL.
  //   Terminal states:
  //     · /nex-native/free-chat?...                (success · sealed destination)
  //     · /nex-native/contacts?...                 (success · legacy path)
  //     · /nex-native/sign-in?e=<code>&m=<msg>     (failure · server rejected)
  await page.waitForURL(
    (url) => {
      if (url.pathname.includes(CONTACTS_PATH)) return true;
      if (url.pathname.includes(FREE_CHAT_PATH)) return true;
      if (url.pathname === SIGN_IN_PATH && url.searchParams.has("e")) {
        return true;
      }
      return false;
    },
    { timeout: NAV_TIMEOUT_MS },
  );
  const settled = page.url();
  // If we were bounced back to sign-in WITH an error param, the dev-
  // pass path is not operational in this environment · skip honestly
  // rather than pretend the authenticated journey ran. (Bare
  // `/sign-in` never reaches here · the waitForURL predicate above
  // only accepts `/sign-in?e=<code>` as a terminal state.)
  const settledUrl = new URL(settled);
  if (
    settledUrl.pathname === SIGN_IN_PATH &&
    settledUrl.searchParams.has("e")
  ) {
    const urlObj = settledUrl;
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
 * 2026-11-26 (L-008) · navigate to the celebration page AND await the
 * client-side `MarkSeenPinger` POST to `/api/nex-native/welcome/mark-
 * seen` before returning. Without this await the context cookie read
 * races the Set-Cookie response · observed flakes where the test read
 * the cookie jar <50 ms after goto returned and saw no cookie.
 *
 * We await the response itself (not just the request) so that by the
 * time this helper returns the Playwright context has already applied
 * the Set-Cookie header. The predicate accepts any POST completion ·
 * if the Route Handler returns 401/503 (fail-closed cases) the test
 * will proceed and the subsequent cookie assertion will catch it.
 */
async function visitWelcomeAndAwaitMarkSeen(
  page: Page,
  options: { expectCookieSet: boolean } = { expectCookieSet: true },
): Promise<void> {
  if (options.expectCookieSet) {
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(MARK_SEEN_ENDPOINT) && r.request().method() === "POST",
        { timeout: NAV_TIMEOUT_MS },
      ),
      page.goto(WELCOME_PATH, { waitUntil: "domcontentloaded" }),
    ]);
  } else {
    await page.goto(WELCOME_PATH, { waitUntil: "domcontentloaded" });
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

    // L-008 · await the client mark-seen POST so the Set-Cookie has
    // been applied before we read the context jar.
    await visitWelcomeAndAwaitMarkSeen(page, { expectCookieSet: true });
    // Give the page a moment · if it was going to redirect we would
    // land elsewhere. We assert it did NOT redirect.
    expect(page.url()).toContain(WELCOME_PATH);
    await expect(
      page.getByText(/your NEX account is active/i),
    ).toBeVisible();

    const seen = await readSeenCookie(ctx);
    expect(seen, "seen cookie must be set after first visit").not.toBeNull();
    // 2026-11-26 (L-008) · the cookie value is HMAC-signed: envelope
    // `v1.<base64url-hmac-sha256>`. The prior literal `"1"` assertion
    // described the pre-fix (forgery-vulnerable) implementation · the
    // signed envelope is the stronger correct behaviour. We assert the
    // structure here; the forgery-resistance assertion belongs to test
    // D below.
    expect(seen!.value, "cookie must carry the v1 HMAC envelope").toMatch(
      /^v1\.[A-Za-z0-9_-]{32,}$/,
    );
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
    await visitWelcomeAndAwaitMarkSeen(page, { expectCookieSet: true });
    expect(page.url()).toContain(WELCOME_PATH);
    const firstSeen = await readSeenCookie(ctx);
    expect(firstSeen, "first visit must set the seen cookie").not.toBeNull();

    // Second visit · must redirect to contacts. No mark-seen POST is
    // expected here because the server redirects before WelcomeShell
    // ever mounts.
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

    await visitWelcomeAndAwaitMarkSeen(page, { expectCookieSet: true });
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
