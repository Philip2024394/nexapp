// tests/e2e/journey-pending-wall-security-regressions.spec.ts
//
// CYCLE 14 · G-4 P2 · extended pending-wall security regressions.
// Owner-required 2026-11-25 as part of Fix A acceptance scope.
// -----------------------------------------------------------------------------
// These are defence-in-depth regressions for scenarios that are NOT
// covered by the existing Cycle-13 CSRF spec
// (`journey-post-signup-apply-theme.spec.ts`) or the Cycle-14 race /
// one-shot specs (`journey-pending-wall-race-conditions.spec.ts`).
//
// Three attacker-shaped inputs are exercised against the retained
// `/nex-native/post-signup-apply` Route Handler, which is the only
// surface that still consumes `nex_pending_wall` for direct browser
// navigations (server-action callers of `consumeAndApplyPendingAccountWall`
// are covered by the signup/sign-in journey specs):
//
//   (A) Tampered premium theme payload.
//       An attacker who could deposit the cookie before signup could
//       try to trick the user into applying a premium theme they do not
//       own. The shared consumer
//       (`src/lib/nex-native/account-wall/consume-and-apply.ts:134-152`)
//       calls `canAccessChatTheme` and bounces to the chat-themes-
//       library with `e=premium_required` when the account has no
//       `themes_plus_until` and no `nex_theme_ownership` row. The one-
//       shot cookie MUST still be consumed (so the attacker cannot
//       simply retry) but the DB write MUST NOT happen.
//
//   (B) Origin-only probe without Sec-Fetch-Site.
//       Older browsers (and crafted non-browser clients) may not send
//       Sec-Fetch-Site but will send Origin on a top-level navigation.
//       The handler's defence-in-depth fallback at
//       `src/app/nex-native/post-signup-apply/route.ts:143-154` rejects
//       requests whose Origin host differs from the request Host. We
//       prove the fallback still rejects when Sec-Fetch-Site is absent
//       and Origin is foreign.
//
//   (C) Invalid nextUrl variants.
//       `isAllowedNextUrl` (`src/lib/nex-native/account-wall/pending-
//       action.ts:61-68`) rejects: `..` segments, `\\` backslashes,
//       `//` (double-slash → protocol-relative), and anything not
//       starting with `/nex-native/`. A decode failure inside
//       `consumePendingAccountWall` returns `null` BUT still clears
//       the cookie (`pending-action.ts:147-154`), which we assert
//       alongside the DB-untouched invariant. The handler then falls
//       through to `/nex-native/contacts`.
//
// Scope honesty:
//   · This spec uses the admin fixture account (storageState auth)
//     exactly like the Cycle-13 CSRF spec, because we are exercising
//     the retained Route Handler path (direct-nav / stale-cookie /
//     attacker probes). The server-action consume path is proved end
//     to end by the two Cycle-14 signup journey specs; adding a
//     parallel server-action security spec would duplicate that
//     coverage without proving new behavior.
//   · Cookie-TTL expiry is NOT asserted end-to-end: expired cookies
//     are dropped by the browser BEFORE the request reaches the
//     server, so the useful behavior for e2e is identical to the
//     "no cookie" case already covered by the Cycle-13 spec.

import { readFileSync } from "node:fs";
import { Client } from "pg";
import { expect, test } from "@playwright/test";

const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";

// Admin fixture bound to tests/e2e/.auth/state.json.
const ADMIN_ACCOUNT_ID = "80a9cedb-f477-4116-bcd8-78fb337d31e2";

// A premium theme id the admin fixture does NOT own (verified via
// sandbox DB inspection 2026-11-25 · nex_theme_ownership is empty for
// this account, themes_plus_until is NULL). `aurora` is tier='bisnis'
// so `canAccessChatTheme` → `not_entitled` → premium_required bounce.
const PREMIUM_THEME_ID = "aurora";
const FREE_THEME_ID = "nex-bubbles";

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

/**
 * Prefer the pooler URL (`DATABASE_URL`) over the direct URL · the
 * direct Supabase endpoint is IPv6-only on this sandbox project and
 * times out from IPv4-only hosts. Mirrors the sealed harness helper.
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
    await c.query(`UPDATE nex_account SET chat_theme = $1 WHERE id = $2`, [
      value,
      ADMIN_ACCOUNT_ID,
    ]);
  });
}

// Cookie format mirrored from pending-action.ts:85-88 · v1|action|nextUrl|payload.
function encodePendingWall(
  action: string,
  nextUrl: string,
  payload: string,
): string {
  return `v1|${action}|${nextUrl}|${payload}`;
}

test.use({ storageState: "tests/e2e/.auth/state.json" });

test.describe.serial("G-4 P2 · pending-wall security regressions", () => {
  test.beforeEach(async ({ context }) => {
    // Scoped purge · keep the Supabase auth cookies from storageState.
    await context.clearCookies({ name: "nex_pending_wall" });
    assertSandboxRef();
    // Baseline DB state · a stable sentinel so we can assert the
    // attacker's probe did NOT mutate chat_theme regardless of which
    // theme the previous test may have left behind.
    await writeAdminChatTheme("theme-0");
  });

  test.afterAll(async () => {
    // Final tidy so unrelated specs in the same project see the same
    // baseline as the Cycle-13 suite expects.
    await writeAdminChatTheme("theme-0");
  });

  test("tampered premium payload · premium_required bounce · no DB write · cookie consumed", async ({
    page,
    context,
    baseURL,
  }) => {
    // Seed a cookie that WOULD apply a premium theme if the gate were
    // absent. Admin fixture has no ownership and no themes_plus_until
    // → canAccessChatTheme denies → consume-and-apply returns the
    // premium_required destination without touching chat_theme.
    const host = new URL(baseURL ?? "http://localhost:3008").hostname;
    await context.addCookies([
      {
        name: "nex_pending_wall",
        value: encodePendingWall(
          "pick-theme",
          `/nex-native/themes/${PREMIUM_THEME_ID}?applied=1`,
          PREMIUM_THEME_ID,
        ),
        domain: host,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: false,
      },
    ]);

    const baseline = await readAdminChatTheme();
    expect(baseline).toBe("theme-0");

    const res = await page.request.get(
      `${baseURL ?? "http://localhost:3008"}/nex-native/post-signup-apply`,
      { maxRedirects: 0, failOnStatusCode: false },
    );

    // 303 redirect to the chat-themes library with the premium_required
    // signal and NO ?applied=1 marker.
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    const location = res.headers()["location"] ?? "";
    expect(
      location,
      "tampered premium payload must bounce to the library with premium_required",
    ).toContain("/nex-native/chat-themes-library");
    expect(location).toContain("e=premium_required");
    expect(
      location,
      "applied=1 MUST NOT appear on a rejected-apply redirect",
    ).not.toContain("applied=1");

    // Decisive · the premium theme was NEVER written to the DB.
    const after = await readAdminChatTheme();
    expect(
      after,
      "tampered premium cookie MUST NOT update chat_theme · the " +
        "entitlement gate is a defence-in-depth guard against a " +
        "forged cookie",
    ).toBe("theme-0");

    // One-shot invariant · the cookie MUST be consumed (even on a
    // rejected apply), otherwise an attacker could retry.
    const afterCookies = await context.cookies();
    const stillPending = afterCookies.find(
      (c) => c.name === "nex_pending_wall" && c.value !== "",
    );
    expect(
      stillPending,
      "cookie must be cleared on consumption even when the entitlement " +
        "gate rejected the apply · otherwise retries remain possible",
    ).toBeUndefined();
  });

  test("Origin-only probe (no Sec-Fetch-Site) with foreign Origin · bounce to /contacts · DB untouched · cookie preserved", async ({
    page,
    context,
    baseURL,
  }) => {
    // Older-browser defence-in-depth path. The Origin header's host
    // does not match the request's Host · handler must bounce to
    // /contacts WITHOUT touching the cookie or the DB. Keeping the
    // cookie is the correct behavior here because a legit same-origin
    // follow-up may still need to consume it (same reasoning as the
    // Cycle-13 Sec-Fetch-Site: cross-site branch).
    const host = new URL(baseURL ?? "http://localhost:3008").hostname;
    await context.addCookies([
      {
        name: "nex_pending_wall",
        value: encodePendingWall(
          "pick-theme",
          `/nex-native/themes/${FREE_THEME_ID}?applied=1`,
          FREE_THEME_ID,
        ),
        domain: host,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: false,
      },
    ]);

    const baseline = await readAdminChatTheme();
    expect(baseline).toBe("theme-0");

    // Explicitly DO NOT send sec-fetch-site, DO send a foreign Origin.
    // Playwright's APIRequestContext does not auto-populate the
    // Sec-Fetch-* family unless we add them · absence is what we want.
    const res = await page.request.get(
      `${baseURL ?? "http://localhost:3008"}/nex-native/post-signup-apply`,
      {
        headers: {
          Origin: "https://evil.example.com",
        },
        maxRedirects: 0,
        failOnStatusCode: false,
      },
    );

    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    const location = res.headers()["location"] ?? "";
    expect(
      location,
      "older-browser Origin mismatch must bounce to /contacts without " +
        "running consume-and-apply",
    ).toContain("/nex-native/contacts");

    const after = await readAdminChatTheme();
    expect(
      after,
      "foreign-Origin probe MUST NOT update chat_theme · the Origin " +
        "defence is the fallback when Sec-Fetch-Site is absent",
    ).toBe("theme-0");

    // Cookie is preserved · the handler short-circuits via
    // `redirectKeepingCookie` before consume-and-apply runs. Same
    // reasoning as the Cycle-13 Sec-Fetch-Site: cross-site branch.
    const afterCookies = await context.cookies();
    const stillPending = afterCookies.find(
      (c) => c.name === "nex_pending_wall" && c.value !== "",
    );
    expect(
      stillPending,
      "Origin-mismatch path must NOT consume the cookie · the legit " +
        "same-origin flow may still need it · the attacker just loses " +
        "this trip",
    ).toBeDefined();

    await context.clearCookies({ name: "nex_pending_wall" });
  });

  test("invalid nextUrl variants · each rejected by decode · fallback to /contacts · DB untouched", async ({
    page,
    context,
    baseURL,
  }) => {
    // Decode-side rejections. `isAllowedNextUrl` bars each of these
    // shapes, so `decode()` returns null. `consumePendingAccountWall`
    // still clears the cookie defensively, and the handler then
    // produces `/contacts` with no apply.
    //
    // We iterate with the SAME admin fixture; the baseline is reset
    // in beforeEach but not between sub-cases, so we additionally
    // clear the cookie between iterations to keep each probe
    // independent.
    const host = new URL(baseURL ?? "http://localhost:3008").hostname;
    const variants: Array<{ label: string; nextUrl: string }> = [
      { label: "dot-dot traversal", nextUrl: "/nex-native/../etc/passwd" },
      { label: "double-slash protocol-relative", nextUrl: "//evil.example.com/" },
      { label: "windows backslash", nextUrl: "/nex-native\\evil" },
      { label: "non-nex-native root path", nextUrl: "/sign-in" },
      { label: "absolute https url", nextUrl: "https://evil.example.com/" },
    ];

    for (const v of variants) {
      await context.clearCookies({ name: "nex_pending_wall" });
      await writeAdminChatTheme("theme-0");

      await context.addCookies([
        {
          name: "nex_pending_wall",
          value: encodePendingWall("pick-theme", v.nextUrl, FREE_THEME_ID),
          domain: host,
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
          secure: false,
        },
      ]);

      const res = await page.request.get(
        `${baseURL ?? "http://localhost:3008"}/nex-native/post-signup-apply`,
        { maxRedirects: 0, failOnStatusCode: false },
      );

      expect(res.status(), `[${v.label}] expected 3xx`).toBeGreaterThanOrEqual(
        300,
      );
      expect(res.status(), `[${v.label}] expected <400`).toBeLessThan(400);
      const location = res.headers()["location"] ?? "";
      expect(
        location,
        `[${v.label}] invalid nextUrl must fall through to /contacts · never to the forged destination`,
      ).toContain("/nex-native/contacts");
      expect(
        location,
        `[${v.label}] applied=1 MUST NOT appear on a rejected-decode redirect`,
      ).not.toContain("applied=1");
      // The redirect location must NOT echo the attacker-controlled
      // nextUrl value anywhere.
      expect(
        location,
        `[${v.label}] attacker-controlled nextUrl must not leak into the redirect target`,
      ).not.toContain(v.nextUrl);

      const after = await readAdminChatTheme();
      expect(
        after,
        `[${v.label}] invalid-nextUrl cookie MUST NOT update chat_theme`,
      ).toBe("theme-0");

      // Cookie MUST be cleared · `consumePendingAccountWall` clears
      // defensively even on decode failure, and the Route Handler
      // additionally emits Set-Cookie: nex_pending_wall=; Max-Age=0.
      const afterCookies = await context.cookies();
      const stillPending = afterCookies.find(
        (c) => c.name === "nex_pending_wall" && c.value !== "",
      );
      expect(
        stillPending,
        `[${v.label}] malformed/invalid cookie must still be cleared on consumption`,
      ).toBeUndefined();
    }
  });
});
