// tests/e2e/auth.setup.ts
//
// Sandbox Playwright authentication setup · built 2026-11-24.
//
// Purpose:
//   Produce tests/e2e/.auth/state.json by driving the real NEX sign-in
//   flow against the local dev server. This runs ONCE as a Playwright
//   dependency project before every authenticated spec in the suite,
//   so that future Stage A runs do not depend on a manually refreshed
//   storage-state file.
//
// Why this is safe (no bypass · no fabrication · no weakening):
//   · The flow used is the sealed-and-owner-sanctioned "Dev Pass"
//     button on src/app/nex-native/sign-in/page.tsx:666-707 (form
//     action=devPassAction, button [data-nex-dev-pass-button]).
//   · Dev Pass is localhost-only · src/app/nex-native/_actions.ts:877
//     refuses to run under NODE_ENV=production. The button is only
//     rendered when BOTH NEX_ADMIN_EMAILS and NEX_ADMIN_DEV_PASSWORD
//     are configured in the env the dev server loads (.env.local).
//   · devPassAction (_actions.ts:877) calls the real Supabase
//     supabase.auth.signInWithPassword against whatever project
//     NEXT_PUBLIC_NEX_SUPABASE_URL points at. The current `.env.local`
//     points the dev server at sandbox kdstoyyeygcopkogqsyv.
//   · This setup does NOT read, print, log or expose cookie values,
//     tokens, OTPs or credentials. It only acts on the sign-in page
//     + reads cookie *names* from context.cookies() to prove the
//     resulting session is sandbox-scoped.
//
// Safety gates enforced below (any one failing refuses to write state):
//   1. The /sign-in page must load with HTTP 200.
//   2. The Dev Pass form (data-nex-dev-pass-form) must be present.
//      Absence proves the env vars are missing OR the server is in
//      production mode · either way we refuse to proceed.
//   3. After submission, the page must NOT display an error banner
//      ([data-nex-sign-in-banner]). The banner code is reported in
//      the failure message so the owner can act.
//   4. The resulting URL must be an authenticated NEX route
//      (NOT /sign-in with an error, NOT /auth/callback timing out).
//   5. Cookies present in the resulting context must contain at
//      least ONE sandbox Supabase auth cookie
//      (sb-kdstoyyeygcopkogqsyv-auth-token.*) and ZERO production
//      Supabase auth cookies (sb-ijvqdvsvwtwxzcqmoqit-auth-token.*).
//      If production cookies appear, we refuse to save · the dev
//      server is mis-pointed.
//
// What this setup will NOT do:
//   · Will not touch .env.local.
//   · Will not seed data, apply migrations, change buckets/policies,
//     touch Stripe, commit, push, merge or deploy.
//   · Will not create a Supabase user manually. If Dev Pass itself
//     needs to use its signUp fallback (devPassAction second branch),
//     that is a sanctioned behaviour of the existing owner-approved
//     action and happens entirely inside the already-configured
//     Supabase sandbox · no new secrets are produced.
//   · Will not run against production. The cookie-prefix guard at
//     step 5 refuses to write state if production cookies are
//     observed.
//
// Classification: AUTH SETUP BUILT.

import { expect, test as setup } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const STATE_PATH = path.resolve(
  process.cwd(),
  "tests",
  "e2e",
  ".auth",
  "state.json",
);

// Hard-coded project references · these are PUBLIC identifiers (they
// appear in Supabase project URLs) and are not secrets. We assert on
// them by NAME only, never by cookie value.
const SANDBOX_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PROD_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

const SANDBOX_COOKIE_PREFIX = `sb-${SANDBOX_PROJECT_REF}-auth-token`;
const PROD_COOKIE_PREFIX = `sb-${PROD_PROJECT_REF}-auth-token`;

setup("authenticate against sandbox via Dev Pass · write state.json", async ({
  page,
  context,
}) => {
  // ── Gate 1 · sign-in page loads ─────────────────────────────────
  const response = await page.goto("/nex-native/sign-in", {
    waitUntil: "domcontentloaded",
  });
  expect(
    response?.status(),
    "sign-in page responds 200 against the local dev server",
  ).toBe(200);

  // ── Gate 2 · Dev Pass form is present (proves env vars set) ─────
  const devPassForm = page.locator("[data-nex-dev-pass-form]");
  const devPassButton = page.locator("[data-nex-dev-pass-button]");
  await expect(
    devPassForm,
    "Dev Pass form must render · requires NEX_ADMIN_EMAILS + " +
      "NEX_ADMIN_DEV_PASSWORD in the dev server's env AND " +
      "NODE_ENV!=='production' · see src/app/nex-native/sign-in/" +
      "page.tsx:666 and _actions.ts:877",
  ).toHaveCount(1, { timeout: 5_000 });
  await expect(devPassButton, "Dev Pass button must be visible").toBeVisible();

  // Submit the sealed sign-in path. We do NOT log the button's aria-
  // label (it contains the configured admin email). We only click.
  await Promise.all([
    page.waitForURL(
      (url) => !/\/nex-native\/sign-in(?:[/?#]|$)/.test(url.pathname) ||
        /[?&](e|error)=/.test(url.search),
      { timeout: 20_000, waitUntil: "domcontentloaded" },
    ),
    devPassButton.click(),
  ]);

  // ── Gate 3 · no error banner on the destination ─────────────────
  // If devPassAction redirected back to /sign-in with ?e=... the
  // banner renders with data-nex-sign-in-banner=<code>. We refuse to
  // save state in that case and surface the code.
  const errorBanner = page.locator("[data-nex-sign-in-banner]");
  const errorCount = await errorBanner.count();
  if (errorCount > 0) {
    const code =
      (await errorBanner.first().getAttribute("data-nex-sign-in-banner")) ??
      "unknown";
    // Pull the first line of the banner's text (Supabase passes the
    // raw error through _actions.ts:914 as `&m=<message>`). Printing
    // this text does not expose credentials · it is the sign-in
    // error reason only (e.g. "Email not confirmed").
    const rawText = (await errorBanner.first().innerText()).trim();
    const firstLine = rawText.split(/\r?\n/)[0] ?? "";
    throw new Error(
      `Dev Pass sign-in failed · banner code='${code}' message='${firstLine}'. ` +
        `State NOT written. If message is "Email not confirmed": the ` +
        `admin user exists in Supabase but has not confirmed its email ` +
        `yet · owner-only fix is to disable "Confirm email" in the ` +
        `sandbox project (Auth → Providers → Email) OR confirm the ` +
        `admin email. See src/app/nex-native/_actions.ts:875-876.`,
    );
  }

  // ── Gate 4 · landed on an authenticated route ───────────────────
  // devPassAction redirects to /nex-native/free-chat?show-themes=1
  // on success (_actions.ts:869). signInAction redirects to
  // /nex-native/contacts. Accept either · reject anything still on
  // /sign-in (which would indicate a silent failure).
  const finalUrl = new URL(page.url());
  expect(
    finalUrl.pathname,
    `post-Dev-Pass URL must NOT be /sign-in · got ${finalUrl.pathname}`,
  ).not.toMatch(/^\/nex-native\/sign-in(?:\/|$)/);
  expect(
    finalUrl.pathname,
    `post-Dev-Pass URL must be an authenticated /nex-native/* route · ` +
      `got ${finalUrl.pathname}`,
  ).toMatch(/^\/nex-native\//);

  // ── Gate 5 · cookies prove sandbox scope ────────────────────────
  // Read cookie NAMES only. Never log or return values.
  const cookies = await context.cookies();
  const cookieNames = cookies.map((c) => c.name);
  const sandboxCount = cookieNames.filter((n) =>
    n.startsWith(SANDBOX_COOKIE_PREFIX),
  ).length;
  const prodCount = cookieNames.filter((n) =>
    n.startsWith(PROD_COOKIE_PREFIX),
  ).length;

  expect(
    prodCount,
    `production Supabase cookies MUST NOT be present after Dev Pass ` +
      `· observed ${prodCount}. The dev server appears to be pointed ` +
      `at production · refusing to overwrite state.json. Check ` +
      `NEXT_PUBLIC_NEX_SUPABASE_URL in .env.local.`,
  ).toBe(0);
  expect(
    sandboxCount,
    `at least one sandbox Supabase auth cookie (sb-${SANDBOX_PROJECT_REF}` +
      `-auth-token.*) must be present · observed ${sandboxCount}. If ` +
      `zero, Dev Pass did not actually establish a session.`,
  ).toBeGreaterThanOrEqual(1);

  // ── Persist the state ───────────────────────────────────────────
  // Ensure the directory exists · gitignored via .gitignore:341.
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  await context.storageState({ path: STATE_PATH });

  // Structural integrity · parse the file we just wrote and re-assert
  // the cookie-name guard without exposing values.
  const persistedRaw = fs.readFileSync(STATE_PATH, "utf8");
  const persisted = JSON.parse(persistedRaw) as {
    cookies?: { name: string }[];
  };
  const persistedNames = (persisted.cookies ?? []).map((c) => c.name);
  const persistedSandbox = persistedNames.filter((n) =>
    n.startsWith(SANDBOX_COOKIE_PREFIX),
  ).length;
  const persistedProd = persistedNames.filter((n) =>
    n.startsWith(PROD_COOKIE_PREFIX),
  ).length;
  expect(
    persistedProd,
    "persisted state must contain ZERO production auth cookies",
  ).toBe(0);
  expect(
    persistedSandbox,
    "persisted state must contain at least one sandbox auth cookie",
  ).toBeGreaterThanOrEqual(1);
});
