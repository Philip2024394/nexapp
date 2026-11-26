// tests/e2e/journey-post-signup-apply-theme.spec.ts
//
// CYCLE 12 → CYCLE 13 · G-4 · post-signup theme-persistence regression.
// -----------------------------------------------------------------------------
// Exercises the sealed account-wall `pick-theme` handoff:
//
//   guest selects theme → account-wall modal → "Create free account"
//   → signup completes → server redirect to /nex-native/post-signup-apply
//   → cookie consumed → chat_theme written → redirect to /themes/<id>?applied=1
//   → viewer renders without ThemePreviewActionBar (owner directive 2026-10-28).
//
// Founder decisive-proof rule (2026-11-25):
//   "I would not allow Claude to mark G-4 complete just because a
//    database row exists. The decisive proof is that the correct
//    account owns the selected theme and the authenticated chat
//    actually uses it without another activation action."
//
// We cannot replay the real signup flow because the sandbox prelaunch
// access guard in createNexAccountAction (src/app/nex-native/_actions.ts)
// currently only permits founder emails. Rather than weaken the guard,
// this spec starts from the *authenticated* state (the signup side has
// already completed; the sealed account-wall primitive deposits the
// cookie just before the redirect to /post-signup-apply) and verifies
// the handler itself produces the customer outcome.
//
// CYCLE 13 additions (2026-11-25) · fail-first regressions for two
// real bugs found against the Cycle-12 RSC `page.tsx` implementation:
//
//   · BUG-C13-001 · stale-cookie replay. Next.js 16 RSC render functions
//     cannot emit Set-Cookie response headers, so the one-shot pending-
//     wall cookie persisted in the browser for its full 20-min TTL. If
//     the user later picked a different theme through the normal app
//     flow, any subsequent visit to /post-signup-apply (bookmark,
//     back-nav, cross-site link) silently re-applied the stale theme.
//     Cycle 13 fix: route.ts supersedes page.tsx. Route handlers CAN
//     emit Set-Cookie, so the one-shot is now a REAL one-shot.
//
//   · BUG-C13-002 · CSRF on state-changing GET. The handler performed a
//     DB write in response to a GET. SameSite=Lax permits the cookie to
//     travel on cross-site top-level navigation (<a href> click, form
//     POST). Cycle 13 fix: Sec-Fetch-Site: cross-site is rejected;
//     Origin cross-origin check is a defence-in-depth backstop.
//
// Four assertions (post-Cycle-13):
//   (1) /nex-native/post-signup-apply with a valid pick-theme cookie
//       redirects to the nextUrl and the viewer renders without the
//       ThemePreviewActionBar (decisive proof: no second Activate press).
//   (2) Second visit with NO cookie redirects to /nex-native/contacts.
//   (3) REAL one-shot: after first consumption the pending-wall cookie
//       is cleared from the browser AND a user's intervening theme
//       choice is NOT overwritten by a stale cookie on a later visit.
//   (4) CSRF: a request with Sec-Fetch-Site: cross-site is rejected
//       without consuming the cookie and without altering chat_theme.
//
// Scope honesty:
//   · This does NOT exercise the SELECTED_THEME_COOKIE splash path
//     (that requires driving createNexAccountAction, which is gated
//     by prelaunch access · out of scope for Cycles 12/13).
//   · This does NOT exercise the `source='first_free'` write (migration
//     342 unapplied · explicitly deferred by the sealed handler).
//   · nex-bubbles / nex-flat are gratis live-world themes registered
//     in code (not DB), so the spec does not depend on sandbox seed
//     state for the theme catalogue.

import { readFileSync } from "node:fs";
import { Client } from "pg";
import { expect, test } from "@playwright/test";

// Admin account UUID (per sandbox fixture) · the storageState in
// tests/e2e/.auth/state.json is bound to this account via its
// Supabase user id. Used for DB state checks in C13 regressions.
const ADMIN_ACCOUNT_ID = "80a9cedb-f477-4116-bcd8-78fb337d31e2";

function loadSandboxDatabaseUrl(): string {
  const raw = readFileSync("./.env.local", "utf8");
  // Prefer the pooler URL (`DATABASE_URL`) over the direct URL · the
  // direct Supabase endpoint is IPv6-only on this sandbox project and
  // times out from IPv4-only hosts (ETIMEDOUT observed in the
  // 2026-11-26 baseline). Only trust the pooler when its
  // username-encoded ref matches the sealed sandbox ref.
  const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
  function stripQuotes(v: string): string {
    const t = v.trim();
    if (
      (t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'"))
    ) {
      return t.slice(1, -1);
    }
    return t;
  }
  const pooler = raw.match(/^DATABASE_URL=(.*)$/m);
  if (pooler) {
    try {
      const pUrl = stripQuotes(pooler[1]);
      const u = new URL(pUrl);
      const dotIdx = u.username.indexOf(".");
      const refInUser = dotIdx > -1 ? u.username.slice(dotIdx + 1) : "";
      if (refInUser === SANDBOX_REF) return pUrl;
    } catch {
      // fall through to direct URL
    }
  }
  const m = raw.match(/^SANDBOX_DATABASE_URL=(.*)$/m);
  if (!m) throw new Error("SANDBOX_DATABASE_URL not in .env.local");
  return stripQuotes(m[1]);
}

async function withPgClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: loadSandboxDatabaseUrl() });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function readAdminChatTheme(): Promise<string | null> {
  return withPgClient(async (c) => {
    const r = await c.query<{ chat_theme: string | null }>(
      `SELECT chat_theme FROM nex_account WHERE id = $1`,
      [ADMIN_ACCOUNT_ID],
    );
    return r.rows[0]?.chat_theme ?? null;
  });
}

async function writeAdminChatTheme(value: string | null): Promise<void> {
  await withPgClient(async (c) => {
    await c.query(
      `UPDATE nex_account SET chat_theme = $1 WHERE id = $2`,
      [value, ADMIN_ACCOUNT_ID],
    );
  });
}

test.use({ storageState: "tests/e2e/.auth/state.json" });

// A gratis live-world theme id · registered in code (not DB), so the
// spec does not depend on sandbox seed state. The handler validates
// the id against the live-world register inside updateChatTheme.
const FREE_THEME_ID = "nex-bubbles";
const NEXT_URL = `/nex-native/themes/${FREE_THEME_ID}?applied=1`;

// Cookie format defined in src/lib/nex-native/account-wall/pending-action.ts:85-88
//   v1|<action>|<nextUrl>|<payload>
function encodePendingWall(
  action: string,
  nextUrl: string,
  payload: string,
): string {
  return `v1|${action}|${nextUrl}|${payload}`;
}

test.describe.serial("G-4 · post-signup-apply pick-theme handoff", () => {
  test.beforeEach(async ({ context }) => {
    // Purge ONLY the pending-wall cookie, if it carried over from a
    // prior test. `clearCookies({ name })` is scoped so the Supabase
    // auth cookies from storageState survive · the old full-clear-and-
    // restore pattern drops cookies whose attributes don't round-trip
    // through addCookies() (observed: `sb-<ref>-auth-token` + the
    // app's own `nex_session` were lost, which made the viewer render
    // as a guest and hid the applied-chip we assert on).
    await context.clearCookies({ name: "nex_pending_wall" });
  });

  test("valid pick-theme cookie → redirect → applied chip (no second Activate)", async ({
    page,
    context,
    baseURL,
  }) => {
    // Seed the pending-wall cookie exactly as the sealed account-wall
    // primitive would have set it immediately before signup completion.
    const host = new URL(baseURL ?? "http://localhost:3008").hostname;
    await context.addCookies([
      {
        name: "nex_pending_wall",
        value: encodePendingWall("pick-theme", NEXT_URL, FREE_THEME_ID),
        domain: host,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: false,
      },
    ]);

    // Visit the post-signup-apply handler · it should consume the
    // cookie, write chat_theme, and redirect. Next.js RSC redirects
    // emitted during render are delivered as a `<meta http-equiv=
    // "refresh" content="1;url=...">` tag · the browser follows it a
    // tick after DOM-ready, so we must `waitForURL` rather than read
    // `page.url()` immediately.
    await page.goto("/nex-native/post-signup-apply", {
      waitUntil: "domcontentloaded",
    });

    // Decisive proof #1 · we eventually land at the theme viewer.
    await page.waitForURL(/\/nex-native\/themes\/nex-bubbles/, {
      timeout: 15_000,
    });
    expect(page.url(), "applied=1 marker present").toContain("applied=1");

    // Decisive proof #2 · the ThemePreviewActionBar is ABSENT ·
    // owner directive 2026-10-28 (`_preview-action-bar.tsx:86-88`)
    // returns null when `isAlreadyApplied === true`. The server-side
    // predicate is `account.chat_theme === themeId`, so the bar's
    // absence proves the applied chat_theme on the AUTHENTICATED
    // viewer's own account matches the previewed theme id. If the
    // handler had failed to persist, the bar would render with a
    // "Use this theme" form and the viewer would need to activate
    // again · exactly the "second Activate press" the Founder
    // forbade.
    //
    // We wait for the server-rendered toast to appear (proves SSR
    // completed) before asserting the bar is absent · avoids a race
    // where the DOM has not yet flushed the SSR payload.
    const appliedToast = page.locator("[data-nex-theme-applied-toast]");
    await expect(
      appliedToast,
      "Applied toast must render · proves ?applied=1 SSR branch executed",
    ).toBeAttached({ timeout: 10_000 });

    const actionBar = page.locator("[data-nex-theme-action-bar]");
    await expect(
      actionBar,
      "ThemePreviewActionBar must be absent · server-side predicate " +
        "account.chat_theme === 'nex-bubbles' is true, so the sealed " +
        "(2026-10-28) action bar returns null · no second Activate",
    ).toHaveCount(0);

    // Belt-and-braces · the specific Use-this-theme form must also
    // be absent. The bar's absence (above) already guarantees this,
    // but we assert it directly so a future bar refactor that keeps
    // the bar visible but hides the form still fails this test.
    const useForm = page.locator("[data-nex-theme-action-bar-use-form]");
    await expect(
      useForm,
      "Use-this-theme form must be absent · its presence would prove " +
        "the G-4 persistence failed and the user must activate again",
    ).toHaveCount(0);
  });

  test("one-shot · second visit with no cookie redirects to /contacts", async ({
    page,
    context,
  }) => {
    // No pending-wall cookie seeded. Handler must fall through to
    // /nex-native/contacts (sealed post-auth home).
    const cookies = await context.cookies();
    expect(
      cookies.find((c) => c.name === "nex_pending_wall"),
      "precondition · no pending-wall cookie present",
    ).toBeUndefined();

    await page.goto("/nex-native/post-signup-apply", {
      waitUntil: "domcontentloaded",
    });
    // Same server-redirect caveat as above · wait for the final URL.
    await page.waitForURL(/\/nex-native\/contacts/, { timeout: 15_000 });
    expect(
      page.url(),
      "falls through to /contacts when no pending action",
    ).toContain("/nex-native/contacts");
  });

  test("REAL one-shot · cookie cleared on consumption · user's intervening theme choice preserved on later visit", async ({
    page,
    context,
    baseURL,
  }) => {
    // CYCLE 13 regression · BUG-C13-001 (stale-cookie replay).
    //
    // Fail-first evidence against the Cycle 12 RSC page.tsx: a
    // repeat visit AFTER the user manually picked a different
    // theme silently REVERTED chat_theme back to the cookie's
    // payload, because `cookies().set("", maxAge:0)` is a no-op
    // inside an RSC render function. The route-handler rewrite
    // (route.ts) emits a real Set-Cookie: nex_pending_wall=;
    // Max-Age=0 on the redirect response, so the browser drops
    // the one-shot at the same moment the server consumed it.
    //
    // Ordering:
    //   1. Reset admin.chat_theme = 'theme-0' (clean baseline)
    //   2. Seed pending-wall cookie (pick-theme nex-bubbles)
    //   3. Visit handler → assert redirect to nex-bubbles viewer,
    //      assert DB chat_theme is now 'nex-bubbles',
    //      assert pending-wall cookie is CLEARED from browser
    //   4. writeAdminChatTheme('nex-flat') · simulates the user
    //      later picking a different theme via the normal
    //      /chat-themes-library → Activate flow (we drive the
    //      DB directly to keep the test fast and isolated · the
    //      point is to assert handler behaviour, not re-exercise
    //      updateChatThemeAction which has its own coverage)
    //   5. Re-visit handler · with the cookie gone the handler
    //      must fall through to /nex-native/contacts (same
    //      behaviour as test #2 "second visit with no cookie")
    //   6. Assert admin.chat_theme is STILL 'nex-flat' · the
    //      user's intervening choice was NOT overwritten by a
    //      stale cookie
    //   7. Cleanup: reset admin.chat_theme = 'theme-0'

    await writeAdminChatTheme("theme-0");

    const host = new URL(baseURL ?? "http://localhost:3008").hostname;
    await context.addCookies([
      {
        name: "nex_pending_wall",
        value: encodePendingWall("pick-theme", NEXT_URL, FREE_THEME_ID),
        domain: host,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: false,
      },
    ]);

    // Step 3 · first visit · consume the cookie authoritatively.
    await page.goto("/nex-native/post-signup-apply", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForURL(/\/nex-native\/themes\/nex-bubbles/, {
      timeout: 15_000,
    });

    const afterFirstVisit = await readAdminChatTheme();
    expect(
      afterFirstVisit,
      "first visit must write chat_theme=nex-bubbles to the DB",
    ).toBe("nex-bubbles");

    const cookiesAfterConsume = await context.cookies();
    const stillPending = cookiesAfterConsume.find(
      (c) => c.name === "nex_pending_wall" && c.value !== "",
    );
    expect(
      stillPending,
      "REAL one-shot · pending-wall cookie must NOT persist with a " +
        "non-empty value after consumption · Cycle 13 fix via route.ts " +
        "Set-Cookie: nex_pending_wall=; Max-Age=0",
    ).toBeUndefined();

    // Step 4 · simulate the user picking a different theme later.
    await writeAdminChatTheme("nex-flat");

    // Step 5 · re-visit the handler · cookie is gone so the
    // handler must fall through to /contacts without touching
    // chat_theme.
    await page.goto("/nex-native/post-signup-apply", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForURL(/\/nex-native\/contacts/, { timeout: 15_000 });

    // Step 6 · decisive proof the stale-replay bug is closed.
    const afterSecondVisit = await readAdminChatTheme();
    expect(
      afterSecondVisit,
      "stale-replay prevention · user's intervening theme choice " +
        "(nex-flat) MUST survive a later visit to /post-signup-apply · " +
        "a regression here resurrects BUG-C13-001",
    ).toBe("nex-flat");

    // Step 7 · cleanup for the next test cycle.
    await writeAdminChatTheme("theme-0");
  });

  test("CSRF defence · Sec-Fetch-Site: cross-site must not consume cookie or mutate DB", async ({
    page,
    context,
    baseURL,
  }) => {
    // CYCLE 13 regression · BUG-C13-002 (CSRF on state-changing GET).
    //
    // Fail-first evidence against the Cycle 12 RSC page.tsx: a GET
    // request carrying `Sec-Fetch-Site: cross-site` plus a stale
    // pending-wall cookie successfully updated chat_theme. SameSite=
    // Lax permits the cookie to travel on cross-site top-level
    // navigation (<a href> click on an attacker page, cross-site
    // form POST), so a stale cookie combined with a cross-site
    // click reliably flipped the victim's theme without any user
    // interaction with the NEX surface.
    //
    // The Cycle 13 fix (route.ts) rejects Sec-Fetch-Site: cross-site
    // and redirects to /nex-native/contacts WITHOUT consuming the
    // cookie · the legit same-origin follow-up (if any) can still
    // use it.
    //
    // Assertions:
    //   (a) response is a 303 redirect to /nex-native/contacts
    //   (b) admin.chat_theme is UNCHANGED (baseline == final)
    //   (c) pending-wall cookie is STILL present (not consumed)

    await writeAdminChatTheme("theme-0");

    const host = new URL(baseURL ?? "http://localhost:3008").hostname;
    await context.addCookies([
      {
        name: "nex_pending_wall",
        value: encodePendingWall("pick-theme", NEXT_URL, FREE_THEME_ID),
        domain: host,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: false,
      },
    ]);

    const baseline = await readAdminChatTheme();
    expect(baseline, "baseline chat_theme precondition").toBe("theme-0");

    // Fire the simulated cross-site navigation. `page.request.get`
    // runs through the same cookie jar as the page context, so the
    // pending-wall cookie travels on the request.
    const res = await page.request.get(
      `${baseURL ?? "http://localhost:3008"}/nex-native/post-signup-apply`,
      {
        headers: {
          "Sec-Fetch-Site": "cross-site",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Dest": "document",
        },
        maxRedirects: 0,
        failOnStatusCode: false,
      },
    );

    // Assertion (a) · 303 redirect to /contacts.
    expect(
      res.status(),
      "cross-site GET must get a 3xx redirect, not a 200 render",
    ).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    const location = res.headers()["location"] ?? "";
    expect(
      location,
      "cross-site GET must redirect to /contacts · the attacker just " +
        "loses this trip",
    ).toContain("/nex-native/contacts");

    // Assertion (b) · DB untouched.
    const afterAttack = await readAdminChatTheme();
    expect(
      afterAttack,
      "CSRF defence · chat_theme MUST be unchanged after a " +
        "cross-site request · a regression here resurrects BUG-C13-002",
    ).toBe("theme-0");

    // Assertion (c) · cookie NOT consumed · the legit same-origin
    // post-sign-in flow that may run after this needs it.
    const after = await context.cookies();
    const pending = after.find(
      (c) => c.name === "nex_pending_wall" && c.value !== "",
    );
    expect(
      pending,
      "cookie must survive a cross-site attack · consumption is " +
        "reserved for same-origin flows so the legit handoff still works",
    ).toBeDefined();

    // Cleanup for the next test cycle.
    await context.clearCookies({ name: "nex_pending_wall" });
  });
});
