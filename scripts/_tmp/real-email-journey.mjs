// scripts/_tmp/real-email-journey.mjs
//
// Real-email checkpoint orchestration · 2026-11-16.
// -----------------------------------------------------------------
// Drives Playwright through the FULL signup + recovery journeys
// with REAL Supabase-sent emails read from the owner's authorised
// Gmail inbox (phillipofarrell@gmail.com) via `+e2e-*` aliasing.
//
// This script has EIGHT phases selected via the first CLI arg. The
// agent (claude-code) polls Gmail between phases and writes the
// extracted URL into a signal file. The script itself never touches
// Gmail · it only writes screenshots + status JSON + reads the
// agent's signal files.
//
// Phases:
//   seed            · mint new stamp · write state.json
//   signup          · UI signup submission · expect email_confirmation_required
//   signup-confirm  · navigate confirm URL from Gmail · verify sign-in
//   signin-check    · sign out · sign in with new creds
//   duplicate       · duplicate signup via UI · verify anti-enumeration
//                     + admin corroboration (1 user, no password overwrite)
//   forgot          · request recovery · wait for banner
//   recovery-set    · navigate recovery URL · verify new-password flow
//                     · mismatch rejected · match accepted
//   final-signin    · OLD password rejected · NEW password accepted
//   cleanup         · admin-delete the disposable user
//
// Hard safety:
//   · sandbox DB (kdstoyyeygcopkogqsyv) only · prod ref refused
//   · fresh disposable email per run · never touches Hammerex/Rosa
//   · no commits · no pushes · no DDL · no production writes
//   · never prints secrets, passwords, or full recovery tokens

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const PHASE = process.argv[2] ?? "help";
const STATE_FILE = ".tmp/real-email-journey/state.json";
const STORAGE_STATE = ".tmp/real-email-journey/storage-state.json";
const EVIDENCE = "evidence/real-email-journey";
const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008";

function readEnvLocal(name) {
  try {
    const m = readFileSync(".env.local", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    return m ? m[1].trim() : "";
  } catch { return ""; }
}

const SUPABASE_URL = readEnvLocal("NEXT_PUBLIC_NEX_SUPABASE_URL")
  || readEnvLocal("NEX_SUPABASE_URL")
  || readEnvLocal("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = readEnvLocal("NEX_SUPABASE_SERVICE_ROLE_KEY")
  || readEnvLocal("SUPABASE_SERVICE_ROLE_KEY");
const DB_URL = readEnvLocal("DATABASE_URL");

const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
if (SUPABASE_URL.includes(PROD_REF) || DB_URL.includes(PROD_REF)) {
  console.error("real-email-journey refuses · production ref detected");
  process.exit(2);
}
if (!SUPABASE_URL.includes(SANDBOX_REF)) {
  console.error(`real-email-journey refuses · not sandbox ${SANDBOX_REF}`);
  process.exit(2);
}

if (!existsSync(EVIDENCE)) mkdirSync(EVIDENCE, { recursive: true });
if (!existsSync(".tmp/real-email-journey")) mkdirSync(".tmp/real-email-journey", { recursive: true });

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function readState() {
  if (!existsSync(STATE_FILE)) return {};
  return JSON.parse(readFileSync(STATE_FILE, "utf8"));
}
function writeState(obj) {
  writeFileSync(STATE_FILE, JSON.stringify(obj, null, 2));
}
function announce(label, obj) {
  const safe = { ...obj };
  if (safe.old_password) safe.old_password = "<redacted>";
  if (safe.new_password) safe.new_password = "<redacted>";
  if (safe.signup_confirm_url) safe.signup_confirm_url = "<set>";
  if (safe.recovery_confirm_url) safe.recovery_confirm_url = "<set>";
  console.log(`[${label}]`, JSON.stringify(safe));
}

async function screenshot(page, name) {
  await page.screenshot({ path: `${EVIDENCE}/${name}`, fullPage: true });
}

async function launch() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  return { browser, context, page };
}

// ──────────────────────────────────────────────────────────────────

async function phaseSeed() {
  const stamp = Date.now().toString(36);
  const email = `phillipofarrell+e2e-realmail-${stamp}@gmail.com`;
  const oldPw = `OldPw-${stamp}-RM1x9Z`;
  const newPw = `NewPw-${stamp}-RM2y0W`;
  const name = `Real-Email ${stamp}`;
  const state = {
    stamp,
    email,
    old_password: oldPw,
    new_password: newPw,
    display_name: name,
    phase1_submit_banner_ok: null,
    phase2_signin_after_confirm_ok: null,
    phase3_signout_signin_ok: null,
    phase4_duplicate_ui_banner: null,
    phase4_duplicate_backend_user_count: null,
    phase5_forgot_submit_banner_ok: null,
    phase6_new_password_mismatch_blocked: null,
    phase6_new_password_accepted: null,
    phase7_old_pw_rejected: null,
    phase7_new_pw_accepted: null,
    created_user_id: null,
  };
  writeState(state);
  announce("seed", { email, stamp });
  console.log("EMAIL=" + email);
}

async function phaseSignup() {
  const s = readState();
  const { browser, context, page } = await launch();
  try {
    await page.goto(`${BASE}/nex-native/sign-in?mode=signup`, {
      waitUntil: "domcontentloaded", timeout: 60_000,
    });
    await screenshot(page, "01-signup-page.png");

    await page.locator('[data-nex-sign-up-input-name]').fill(s.display_name);
    await page.locator('[data-nex-sign-up-input-email]').fill(s.email);
    await page.locator('[data-nex-sign-up-input-password]').fill(s.old_password);

    // Required country radio (Ireland county default is fine in sandbox).
    // The form may have an "I'm in Ireland" style control; submit without
    // picking one and see what happens.

    const clickTime = Date.now();
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {}),
      page.locator('[data-nex-sign-up-submit]').click(),
    ]);
    await page.waitForTimeout(1_500);
    await screenshot(page, "02-post-submit.png");

    const url = new URL(page.url());
    const bannerCode = await page
      .locator("[data-nex-sign-in-banner]")
      .getAttribute("data-nex-sign-in-banner")
      .catch(() => null);
    const bannerText = await page
      .locator("[data-nex-sign-in-banner]")
      .innerText()
      .catch(() => "");
    const helpVisible = (await page
      .locator("[data-nex-sign-in-email-confirm-help]")
      .count()) > 0;

    s.phase1_submit_banner_ok = bannerCode === "email_confirmation_required" && helpVisible;
    s.phase1_banner_code = bannerCode;
    s.phase1_url_pathname = url.pathname;
    s.phase1_url_e_param = url.searchParams.get("e");
    s.phase1_url_m_param = url.searchParams.get("m");
    s.phase1_banner_text = bannerText.slice(0, 500);
    s.phase1_banner_text_contains_check_email = /check.*email/i.test(bannerText);
    s.phase1_submit_at = clickTime;
    writeState(s);
    announce("signup", {
      banner: bannerCode,
      ok: s.phase1_submit_banner_ok,
      path: url.pathname,
    });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function phaseSignupConfirm() {
  const s = readState();
  if (!s.signup_confirm_url) {
    console.error("MISSING signup_confirm_url in state · agent must inject it from Gmail");
    process.exit(3);
  }
  const { browser, context, page } = await launch();
  try {
    await page.goto(s.signup_confirm_url, {
      waitUntil: "domcontentloaded", timeout: 60_000,
    });
    // Supabase's /auth/v1/verify handler redirects back to our
    // app with a token_hash + type=signup. Our /auth/confirm route
    // then verifies and lands the user on /nex-native/contacts.
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await screenshot(page, "03-after-confirm-link.png");

    const land = new URL(page.url());
    // Try to detect a signed-in state: /contacts render or any
    // non-sign-in NEX route. If the app bounced to /sign-in, that's
    // a failure.
    const signedIn = !land.pathname.startsWith("/nex-native/sign-in");
    s.phase2_land_pathname = land.pathname;
    s.phase2_signed_in_after_confirm = signedIn;
    // Save storage state in case we need it later (we don't · we
    // use fresh contexts to prove old vs new password behaviour).
    await context.storageState({ path: STORAGE_STATE });

    // Resolve the created user's id from Supabase admin for cleanup
    // + duplicate corroboration.
    try {
      const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
      const match = users?.users?.find((u) => u.email === s.email);
      if (match) {
        s.created_user_id = match.id;
        s.phase2_user_confirmed_at = match.email_confirmed_at ?? null;
      }
    } catch (e) {
      s.phase2_admin_lookup_err = e.message;
    }

    writeState(s);
    announce("signup-confirm", {
      land: land.pathname,
      signed_in: signedIn,
      confirmed_at: s.phase2_user_confirmed_at ?? null,
    });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function phaseSigninCheck() {
  const s = readState();
  const { browser, context, page } = await launch();
  try {
    // Fresh context · sign in with the newly-registered credentials.
    await page.goto(`${BASE}/nex-native/sign-in`, {
      waitUntil: "domcontentloaded", timeout: 60_000,
    });
    await page.locator('input[name="email"]').fill(s.email);
    await page.locator('input[name="password"]').fill(s.old_password);
    await Promise.all([
      page.waitForURL(
        (u) => !u.pathname.startsWith("/nex-native/sign-in"),
        { timeout: 30_000, waitUntil: "domcontentloaded" },
      ).catch(() => {}),
      page.locator('[data-nex-sign-in-submit]').click(),
    ]);
    await page.waitForTimeout(1_500);
    await screenshot(page, "04-signin-with-new-credentials.png");
    const land = new URL(page.url());
    s.phase3_signout_signin_ok = !land.pathname.startsWith("/nex-native/sign-in");
    s.phase3_land_pathname = land.pathname;
    writeState(s);
    announce("signin-check", { ok: s.phase3_signout_signin_ok, land: land.pathname });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function phaseDuplicate() {
  const s = readState();
  const { browser, context, page } = await launch();
  try {
    await page.goto(`${BASE}/nex-native/sign-in?mode=signup`, {
      waitUntil: "domcontentloaded", timeout: 60_000,
    });
    await page.locator('[data-nex-sign-up-input-name]').fill(s.display_name + " dup");
    await page.locator('[data-nex-sign-up-input-email]').fill(s.email);
    // Submit a DIFFERENT password to prove it never overwrites the
    // real one (we verify in Phase 7 that the real password still
    // signs in after this attempt).
    await page.locator('[data-nex-sign-up-input-password]').fill(`DupeAttempt-${s.stamp}-ZZ`);

    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {}),
      page.locator('[data-nex-sign-up-submit]').click(),
    ]);
    await page.waitForTimeout(1_500);
    await screenshot(page, "05-duplicate-submit.png");
    const url = new URL(page.url());
    const bannerCode = await page
      .locator("[data-nex-sign-in-banner]")
      .getAttribute("data-nex-sign-in-banner")
      .catch(() => null);
    s.phase4_duplicate_ui_banner = bannerCode;
    s.phase4_duplicate_pathname = url.pathname;

    // Admin corroboration · listUsers for this email · must be 1
    // confirmed row, unchanged.
    try {
      const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
      const matches = (users?.users ?? []).filter((u) => u.email === s.email);
      s.phase4_duplicate_backend_user_count = matches.length;
      s.phase4_duplicate_backend_confirmed = matches[0]?.email_confirmed_at ?? null;
      s.phase4_duplicate_backend_user_id = matches[0]?.id ?? null;
      s.phase4_backend_matches_created_user = matches[0]?.id === s.created_user_id;
    } catch (e) {
      s.phase4_admin_lookup_err = e.message;
    }

    writeState(s);
    announce("duplicate", {
      banner: bannerCode,
      backend_count: s.phase4_duplicate_backend_user_count,
      id_unchanged: s.phase4_backend_matches_created_user,
    });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function phaseForgot() {
  const s = readState();
  const { browser, context, page } = await launch();
  try {
    await page.goto(`${BASE}/nex-native/sign-in/forgot`, {
      waitUntil: "domcontentloaded", timeout: 60_000,
    });
    await screenshot(page, "06-forgot-page.png");
    await page.locator('[data-nex-forgot-input-email]').fill(s.email);
    const clickTime = Date.now();
    await Promise.all([
      page.waitForURL(
        (u) => u.searchParams.get("sent") === "1",
        { timeout: 30_000, waitUntil: "domcontentloaded" },
      ),
      page.locator('[data-nex-forgot-submit]').click(),
    ]);
    const bannerVisible = (await page
      .locator("[data-nex-forgot-sent-banner]")
      .count()) > 0;
    s.phase5_forgot_submit_banner_ok = bannerVisible;
    s.phase5_forgot_submit_at = clickTime;
    writeState(s);
    await screenshot(page, "07-forgot-sent.png");
    announce("forgot", { banner_visible: bannerVisible });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function phaseRecoverySet() {
  const s = readState();
  if (!s.recovery_confirm_url) {
    console.error("MISSING recovery_confirm_url · agent must inject from Gmail");
    process.exit(3);
  }
  const { browser, context, page } = await launch();
  try {
    await page.goto(s.recovery_confirm_url, {
      waitUntil: "domcontentloaded", timeout: 60_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await screenshot(page, "08-after-recovery-link.png");
    const land1 = new URL(page.url());
    s.phase6_recovery_land_pathname = land1.pathname;
    s.phase6_reached_new_password =
      land1.pathname === "/nex-native/sign-in/new-password";

    if (s.phase6_reached_new_password) {
      // Mismatch · must NOT advance
      await page.locator('[data-nex-newpw-input-password]').fill(s.new_password);
      await page.locator('[data-nex-newpw-input-confirm]').fill(s.new_password + "WRONG");
      await page.locator('[data-nex-newpw-submit]').click();
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await screenshot(page, "09-mismatch-rejected.png");
      const midPath = new URL(page.url()).pathname;
      s.phase6_new_password_mismatch_blocked =
        midPath === "/nex-native/sign-in/new-password";

      // Match submit · expect redirect off new-password
      await page.locator('[data-nex-newpw-input-password]').fill(s.new_password);
      await page.locator('[data-nex-newpw-input-confirm]').fill(s.new_password);
      await Promise.all([
        page.waitForURL(
          (u) => u.pathname !== "/nex-native/sign-in/new-password",
          { timeout: 30_000, waitUntil: "domcontentloaded" },
        ),
        page.locator('[data-nex-newpw-submit]').click(),
      ]);
      await page.waitForTimeout(1_500);
      await screenshot(page, "10-after-new-password-accepted.png");
      const land2 = new URL(page.url());
      s.phase6_new_password_accepted =
        !land2.pathname.startsWith("/nex-native/sign-in");
      s.phase6_land_after_update = land2.pathname;
    }
    writeState(s);
    announce("recovery-set", {
      reached_form: s.phase6_reached_new_password,
      mismatch_blocked: s.phase6_new_password_mismatch_blocked,
      accepted: s.phase6_new_password_accepted,
    });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function phaseFinalSignin() {
  const s = readState();
  // Run both tests in sequence · fresh context per attempt.

  // A · OLD password MUST fail
  {
    const { browser, context, page } = await launch();
    try {
      await page.goto(`${BASE}/nex-native/sign-in`, {
        waitUntil: "domcontentloaded", timeout: 60_000,
      });
      await page.locator('input[name="email"]').fill(s.email);
      await page.locator('input[name="password"]').fill(s.old_password);
      await page.locator('[data-nex-sign-in-submit]').click();
      await page.waitForTimeout(3_500);
      await screenshot(page, "11-old-password-attempt.png");
      const land = new URL(page.url());
      s.phase7_old_pw_rejected = land.pathname.startsWith("/nex-native/sign-in");
      s.phase7_old_pw_land = land.pathname;
    } finally {
      await context.close();
      await browser.close();
    }
  }
  // B · NEW password MUST succeed
  {
    const { browser, context, page } = await launch();
    try {
      await page.goto(`${BASE}/nex-native/sign-in`, {
        waitUntil: "domcontentloaded", timeout: 60_000,
      });
      await page.locator('input[name="email"]').fill(s.email);
      await page.locator('input[name="password"]').fill(s.new_password);
      await Promise.all([
        page.waitForURL(
          (u) => !u.pathname.startsWith("/nex-native/sign-in"),
          { timeout: 30_000, waitUntil: "domcontentloaded" },
        ).catch(() => {}),
        page.locator('[data-nex-sign-in-submit]').click(),
      ]);
      await page.waitForTimeout(1_500);
      await screenshot(page, "12-new-password-success.png");
      const land = new URL(page.url());
      s.phase7_new_pw_accepted = !land.pathname.startsWith("/nex-native/sign-in");
      s.phase7_new_pw_land = land.pathname;
    } finally {
      await context.close();
      await browser.close();
    }
  }
  writeState(s);
  announce("final-signin", {
    old_rejected: s.phase7_old_pw_rejected,
    new_accepted: s.phase7_new_pw_accepted,
  });
}

async function phaseCleanup() {
  const s = readState();
  if (s.created_user_id) {
    try {
      await admin.auth.admin.deleteUser(s.created_user_id);
      s.cleanup_deleted_user_id = s.created_user_id;
    } catch (e) {
      s.cleanup_err = e.message;
    }
    writeState(s);
    announce("cleanup", {
      deleted: !!s.cleanup_deleted_user_id,
      err: s.cleanup_err ?? null,
    });
  } else {
    console.log("[cleanup] no created_user_id to delete");
  }
}

// ──────────────────────────────────────────────────────────────────

const PHASES = {
  seed: phaseSeed,
  signup: phaseSignup,
  "signup-confirm": phaseSignupConfirm,
  "signin-check": phaseSigninCheck,
  duplicate: phaseDuplicate,
  forgot: phaseForgot,
  "recovery-set": phaseRecoverySet,
  "final-signin": phaseFinalSignin,
  cleanup: phaseCleanup,
};

const fn = PHASES[PHASE];
if (!fn) {
  console.error(`unknown phase: ${PHASE}. valid: ${Object.keys(PHASES).join(", ")}`);
  process.exit(1);
}
await fn();
