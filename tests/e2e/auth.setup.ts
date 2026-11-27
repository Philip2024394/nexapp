// tests/e2e/auth.setup.ts
//
// Sandbox Playwright authentication setup · built 2026-11-24 ·
// refactored 2026-11-27 (L-055) to drive the normal sign-in form
// after the visible "Dev Pass" button was retired per owner
// directive (see src/app/nex-native/sign-in/page.tsx:598-602).
//
// Purpose:
//   Produce tests/e2e/.auth/state.json by driving the real NEX sign-in
//   flow against the local dev server. This runs ONCE as a Playwright
//   dependency project before every authenticated spec in the suite,
//   so that future Stage A runs do not depend on a manually refreshed
//   storage-state file.
//
// Why this is safe (no bypass · no fabrication · no weakening):
//   · The flow used is the sealed-and-owner-sanctioned normal sign-in
//     form on src/app/nex-native/sign-in/page.tsx:483-595
//     (form action=signInAction, submit button [data-nex-sign-in-submit]).
//   · The dev-founder bypass inside signInAction (_actions.ts:875-920)
//     is localhost-only · refuses to run under NODE_ENV=production.
//     The bypass fires only when BOTH NEX_ADMIN_EMAILS and
//     NEX_ADMIN_DEV_PASSWORD are configured in the env the dev server
//     loads (.env.local) AND the typed credentials match them.
//   · signInAction calls the real Supabase
//     supabase.auth.signInWithPassword against whatever project
//     NEXT_PUBLIC_NEX_SUPABASE_URL points at. The current `.env.local`
//     points the dev server at sandbox kdstoyyeygcopkogqsyv.
//   · This setup reads the configured admin email + dev password
//     from .env.local, types them into the normal form, and clicks
//     Sign In. It does NOT log, print, or return those values · they
//     flow through Playwright's keyboard-event emulation into the
//     page only. Cookie *names* only are read for the sandbox-scope
//     assertion · never values.
//
// Safety gates enforced below (any one failing refuses to write state):
//   1. The /sign-in page must load with HTTP 200.
//   2. The normal sign-in form (data-nex-sign-in-form) must be
//      present with email + password inputs. Absence proves the
//      sign-in page is broken.
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
//   · Will not create a Supabase user manually. If the dev-founder
//     bypass needs to provision + re-attempt (_actions.ts:916-920),
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

/** Read a bare value out of .env.local without exposing it anywhere
 *  observable. Strips surrounding single / double quotes. Throws when
 *  the variable is missing so the gate fires early. */
function readEnvFromLocal(name: string): string {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const raw = fs.readFileSync(envPath, "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) {
    throw new Error(
      `${name} missing from .env.local · required for the dev-founder ` +
        `typed-credentials bypass inside signInAction (_actions.ts:875-920). ` +
        `Add it to .env.local without quoting if it contains no spaces.`,
    );
  }
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v;
}

setup("authenticate against sandbox via typed credentials · write state.json", async ({
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

  // ── Gate 2 · normal sign-in form is present ─────────────────────
  const signInForm = page.locator("[data-nex-sign-in-form]");
  const emailInput = signInForm.locator('input[name="email"]');
  const passwordInput = signInForm.locator('input[name="password"]');
  const submitButton = page.locator("[data-nex-sign-in-submit]");
  await expect(
    signInForm,
    "normal sign-in form must render · the visible Dev Pass form was " +
      "retired 2026-11-27 (see sign-in/page.tsx:598-602) · if this form " +
      "is also missing the sign-in page itself is broken",
  ).toHaveCount(1, { timeout: 5_000 });
  await expect(emailInput, "email input must be present").toBeVisible();
  await expect(passwordInput, "password input must be present").toBeVisible();
  await expect(submitButton, "Sign In submit button must be visible").toBeVisible();

  // ── Read dev-founder credentials from .env.local ────────────────
  // NEX_ADMIN_EMAILS is comma-delimited · the dev-founder bypass
  // accepts any entry in that list · we pick the first.
  const adminEmailsRaw = readEnvFromLocal("NEX_ADMIN_EMAILS");
  const devPassword = readEnvFromLocal("NEX_ADMIN_DEV_PASSWORD");
  const firstAdminEmail = adminEmailsRaw
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0)[0];
  if (!firstAdminEmail) {
    throw new Error(
      "NEX_ADMIN_EMAILS resolved to zero entries · required for the " +
        "dev-founder bypass · add at least one email to .env.local",
    );
  }
  // We NEVER print either value. Even on failure the error messages
  // below reference only the variable NAME.
  await emailInput.fill(firstAdminEmail);
  await passwordInput.fill(devPassword);

  // Submit the sealed sign-in path.
  await Promise.all([
    page.waitForURL(
      (url) => !/\/nex-native\/sign-in(?:[/?#]|$)/.test(url.pathname) ||
        /[?&](e|error)=/.test(url.search),
      { timeout: 20_000, waitUntil: "domcontentloaded" },
    ),
    submitButton.click(),
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
      `dev-founder sign-in failed · banner code='${code}' message='${firstLine}'. ` +
        `State NOT written. If message is "Email not confirmed": the ` +
        `admin user exists in Supabase but has not confirmed its email ` +
        `yet · owner-only fix is to disable "Confirm email" in the ` +
        `sandbox project (Auth → Providers → Email) OR confirm the ` +
        `admin email. See src/app/nex-native/_actions.ts:875-876.`,
    );
  }

  // ── Gate 4 · landed on an authenticated route ───────────────────
  // signInAction redirects to /nex-native/contacts on success
  // (or the ?next= parameter if one was supplied). Reject anything
  // still on /sign-in (which would indicate a silent failure).
  const finalUrl = new URL(page.url());
  expect(
    finalUrl.pathname,
    `post-sign-in URL must NOT be /sign-in · got ${finalUrl.pathname}`,
  ).not.toMatch(/^\/nex-native\/sign-in(?:\/|$)/);
  expect(
    finalUrl.pathname,
    `post-sign-in URL must be an authenticated /nex-native/* route · ` +
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
    `production Supabase cookies MUST NOT be present after sign-in ` +
      `· observed ${prodCount}. The dev server appears to be pointed ` +
      `at production · refusing to overwrite state.json. Check ` +
      `NEXT_PUBLIC_NEX_SUPABASE_URL in .env.local.`,
  ).toBe(0);
  expect(
    sandboxCount,
    `at least one sandbox Supabase auth cookie (sb-${SANDBOX_PROJECT_REF}` +
      `-auth-token.*) must be present · observed ${sandboxCount}. If ` +
      `zero, the sign-in flow did not actually establish a session.`,
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
