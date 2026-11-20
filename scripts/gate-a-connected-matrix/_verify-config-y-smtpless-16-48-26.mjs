// scripts/gate-a-connected-matrix/_verify-config-y-smtpless-16-48-26.mjs
//
// §16.48.26 · Config Y · SMTP-less confirmation verifier.
// Authored 2026-11-20 · OFFLINE AUTHORED — run only when owner authorises.
//
// Purpose
// ─────────
// Config Y is the email-confirmation journey. The owner-visible blocker is
// "no Brevo SMTP configured". This verifier proves the server-side
// confirmation-link roundtrip WITHOUT any email provider, by using the
// Supabase GoTrue admin API `admin.generateLink()` to mint a confirmation
// token server-side, then exercising the real production code path at
// `GET /nex-native/auth/confirm?token_hash=&type=`.
//
// This yields CONNECTED-BODY-PASS-SMTPLESS evidence: one tier below full
// SMTP delivery, but genuinely end-to-end through the sealed verifyOtp +
// cookie-write path.
//
// SDK signature (verified against @supabase/auth-js GoTrueAdminApi.d.ts +
// types.d.ts in node_modules on 2026-11-20):
//
//   supabase.auth.admin.generateLink({
//     type: 'signup' | 'magiclink' | 'invite' | 'recovery' | ...,
//     email: string,
//     password?: string,              // REQUIRED for 'signup'
//     options?: { redirectTo?: string, data?: object },
//   }): Promise<{
//     data: {
//       properties: {
//         action_link: string,
//         email_otp: string,
//         hashed_token: string,        // ← we use this
//         redirect_to: string,
//         verification_type: 'signup'|'magiclink'|'invite'|'recovery'|...,
//       },
//       user: User,
//     },
//     error: AuthError | null,
//   }>
//
// Per SDK docs: `generateLink()` handles user creation for signup / invite /
// magiclink. If the user already exists, 'signup' errors — we fall back to
// 'magiclink' which works on existing users. Both produce a `hashed_token`
// accepted by Supabase `verifyOtp` with the matching `verification_type`.
//
// HARD INVARIANTS
// ───────────────
// · Sandbox only · NEXT_PUBLIC_NEX_SUPABASE_URL must contain
//   `kdstoyyeygcopkogqsyv` AND must NOT contain `ijvqdvsvwtwxzcqmoqit`.
// · Operates ONLY on identity C from the capture file. A/B untouched.
// · No new signups beyond what `generateLink(type:signup)` naturally does
//   on an unknown email. C already exists per capture, so magiclink path
//   is expected.
// · No password reset. No cleanup. No writes to auth.users beyond what
//   verifyOtp naturally does (sets email_confirmed_at).
// · Tokens redacted in logs · only first 8 chars + ellipsis printed.
// · Cookies counted but NEVER logged raw.
// · Any URL containing the production ref is hard-refused.
//
// EXIT CODES
// ──────────
// · 0 → verdict written (PASS / FAIL / BLOCKED). Read the verdict file.
// · 2 → missing env / missing capture file / missing password / SDK error
//       expressible as BLOCKED — a verdict file is still written.
// · 3 → safety-preamble refusal (prod ref present, or dev server down).
//
// VERDICT TIERS
// ─────────────
// PASS   — admin.generateLink returned a hashed_token; the confirm route
//          responded 303 with Location=/nex-native/contacts AND set at
//          least one Supabase session cookie; and either (a) the follow-up
//          service-role read saw email_confirmed_at populated, or (b) it
//          was already populated before and verifyOtp was a no-op idempotent
//          success (noted as state-change vs no-op in detail).
// FAIL   — admin.generateLink succeeded but the confirm route did not
//          redirect to /nex-native/contacts, or did not set a session
//          cookie. Evidence of a real journey defect.
// BLOCKED— could not even generate a link (admin API off, user state
//          incompatible with both signup+magiclink, service role missing).
//          Not a journey defect; a prerequisite is missing.

import {
  readFileSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import {
  CANONICAL_PROJECT_REF,
  PRODUCTION_REF,
  REPO_ROOT,
  IDENTITY_CAPTURE_FILE,
  readEnv,
  validateSupabaseUrl,
  readIdentityCapture,
} from "./_shared.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const RESULTS_FILE = resolve(
  __dir,
  "_results.16-48-26.config-y.json.OUTPUT",
);
const ROUND_ID = "§16.48.26-config-y-smtpless";
const DEV_ORIGIN = "http://localhost:3008";
const CONFIRM_PATH = "/nex-native/auth/confirm";
const EXPECTED_SUCCESS_REDIRECT = "/nex-native/contacts";

// ── Log helpers · never print raw secrets ────────────────────────────────────
function redactToken(tok) {
  if (typeof tok !== "string" || tok.length === 0) return "<empty>";
  return `${tok.slice(0, 8)}… (len=${tok.length})`;
}

function log(stage, msg, extra) {
  const line = extra
    ? `[${stage}] ${msg} :: ${JSON.stringify(extra)}`
    : `[${stage}] ${msg}`;
  console.log(line);
}

function writeVerdict(verdictObj) {
  const payload = {
    round: ROUND_ID,
    target_ref: CANONICAL_PROJECT_REF,
    method:
      "admin.generateLink + /auth/confirm roundtrip · NO SMTP",
    identity: "C",
    ...verdictObj,
    written_at: new Date().toISOString(),
  };
  writeFileSync(RESULTS_FILE, JSON.stringify(payload, null, 2), "utf8");
  log("VERDICT", `${payload.verdict} → ${RESULTS_FILE}`);
}

// ── Hard refuse any URL that references production ref ───────────────────────
function refuseIfProd(urlOrString, label) {
  if (
    typeof urlOrString === "string" &&
    urlOrString.includes(PRODUCTION_REF)
  ) {
    console.error(
      `FATAL: ${label} contains production ref ${PRODUCTION_REF} — refusing`,
    );
    process.exit(3);
  }
}

// ── Dev-server reachability check (2s timeout) ───────────────────────────────
async function devServerReachable() {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${DEV_ORIGIN}/`, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "manual",
    });
    clearTimeout(t);
    // Any HTTP response — even a redirect or a 404 — proves the port is
    // listening and Next.js answered. Only a network error means down.
    return { ok: true, status: res.status };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: String(e?.message ?? e) };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log("SAFETY", "starting preamble");

  // 1a · Supabase URL sandbox check
  const supaUrl = readEnv("NEXT_PUBLIC_NEX_SUPABASE_URL");
  refuseIfProd(supaUrl, "NEXT_PUBLIC_NEX_SUPABASE_URL");
  validateSupabaseUrl(supaUrl, "NEXT_PUBLIC_NEX_SUPABASE_URL");
  log("SAFETY", `supabase url references sandbox ${CANONICAL_PROJECT_REF}`);

  // 1b · Service-role key
  const serviceKey =
    readEnv("NEX_SUPABASE_SERVICE_ROLE_KEY") ||
    readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    writeVerdict({
      verdict: "BLOCKED",
      evidence_tier: "CONNECTED-BODY-PASS-SMTPLESS",
      detail:
        "NEX_SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY not in .env.local — cannot call admin.generateLink",
    });
    process.exit(2);
  }
  log("SAFETY", "service-role key present (value redacted)");

  // 1c · Dev server
  const reach = await devServerReachable();
  if (!reach.ok) {
    console.error(
      `FATAL: dev server at ${DEV_ORIGIN} unreachable (${reach.error}). ` +
        `Run \`npm run dev\` in another terminal before invoking this script.`,
    );
    process.exit(3);
  }
  log("SAFETY", `dev server reachable (HEAD / → ${reach.status})`);

  // 1d · Identity capture
  if (!existsSync(IDENTITY_CAPTURE_FILE)) {
    writeVerdict({
      verdict: "BLOCKED",
      evidence_tier: "CONNECTED-BODY-PASS-SMTPLESS",
      detail:
        "99_identity_capture.json.OUTPUT missing — run 20_signup_disposable_identities.mjs first",
    });
    process.exit(2);
  }
  const capture = readIdentityCapture();
  const C = capture.C;
  if (!C || !C.email || !C.supabase_user_id) {
    writeVerdict({
      verdict: "BLOCKED",
      evidence_tier: "CONNECTED-BODY-PASS-SMTPLESS",
      detail:
        "identity C missing email/supabase_user_id in capture file",
    });
    process.exit(2);
  }
  log("SAFETY", `identity C selected (email redacted, uid=${C.supabase_user_id})`);

  // 1e · GATE_A_TEST_PASSWORD_C — required by signup path. If missing we
  //      can still try magiclink (which doesn't need password) but owner
  //      spec says fail fast if unset. Honour that.
  const testPassword = process.env.GATE_A_TEST_PASSWORD_C;
  if (!testPassword) {
    writeVerdict({
      verdict: "BLOCKED",
      evidence_tier: "CONNECTED-BODY-PASS-SMTPLESS",
      detail:
        "env var GATE_A_TEST_PASSWORD_C not set — refusing to invent a password per spec",
    });
    process.exit(2);
  }
  log("SAFETY", "GATE_A_TEST_PASSWORD_C present (value never logged)");

  // ── Build service-role client ──────────────────────────────────────────────
  const admin = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Phase 0 · snapshot email_confirmed_at before ───────────────────────────
  let confirmedBefore = null;
  try {
    const { data: userBefore, error: ubErr } = await admin.auth.admin.getUserById(
      C.supabase_user_id,
    );
    if (ubErr) {
      log("PHASE0", `getUserById error: ${ubErr.message}`);
    } else {
      confirmedBefore = userBefore?.user?.email_confirmed_at ?? null;
      log(
        "PHASE0",
        `email_confirmed_at(before) = ${confirmedBefore ?? "null"}`,
      );
    }
  } catch (e) {
    log("PHASE0", `getUserById threw: ${String(e?.message ?? e)}`);
  }

  // ── Phase 1 · admin.generateLink ───────────────────────────────────────────
  let hashedToken = null;
  let verificationType = null;
  let linkTypeUsed = null;
  let phase1Detail = "";

  // Try signup first (per spec); if "already registered" (expected for C),
  // fall back to magiclink.
  log("PHASE1", "attempting generateLink type=signup");
  const sgOptions = {
    redirectTo: `${DEV_ORIGIN}${CONFIRM_PATH}`,
  };
  const signupResp = await admin.auth.admin.generateLink({
    type: "signup",
    email: C.email,
    password: testPassword,
    options: sgOptions,
  });

  if (signupResp.error) {
    log(
      "PHASE1",
      `signup path error (expected if already registered): ${signupResp.error.message}`,
    );
    log("PHASE1", "falling back to generateLink type=magiclink");
    const mlResp = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: C.email,
      options: sgOptions,
    });
    if (mlResp.error) {
      writeVerdict({
        verdict: "BLOCKED",
        evidence_tier: "CONNECTED-BODY-PASS-SMTPLESS",
        detail:
          `both generateLink paths failed. signup: ${signupResp.error.message} ; magiclink: ${mlResp.error.message}`,
        email_confirmed_at_before: confirmedBefore,
      });
      process.exit(2);
    }
    hashedToken = mlResp.data?.properties?.hashed_token ?? null;
    verificationType = mlResp.data?.properties?.verification_type ?? null;
    linkTypeUsed = "magiclink";
    phase1Detail = `signup path returned error (${signupResp.error.message}); magiclink path succeeded`;
  } else {
    hashedToken = signupResp.data?.properties?.hashed_token ?? null;
    verificationType = signupResp.data?.properties?.verification_type ?? null;
    linkTypeUsed = "signup";
    phase1Detail = "signup path succeeded on first attempt";
  }

  if (!hashedToken || !verificationType) {
    writeVerdict({
      verdict: "BLOCKED",
      evidence_tier: "CONNECTED-BODY-PASS-SMTPLESS",
      detail:
        `generateLink returned no hashed_token or verification_type. path=${linkTypeUsed}. upstream: ${phase1Detail}`,
      link_type_used: linkTypeUsed,
      email_confirmed_at_before: confirmedBefore,
    });
    process.exit(2);
  }

  log(
    "PHASE1",
    `token minted path=${linkTypeUsed} type=${verificationType} token=${redactToken(hashedToken)}`,
  );

  // ── Phase 2 · GET /nex-native/auth/confirm ─────────────────────────────────
  const confirmUrl =
    `${DEV_ORIGIN}${CONFIRM_PATH}` +
    `?token_hash=${encodeURIComponent(hashedToken)}` +
    `&type=${encodeURIComponent(verificationType)}`;

  // Sanity: refuse if somehow the URL grew a prod ref (defensive)
  refuseIfProd(confirmUrl, "confirm URL");

  log("PHASE2", `GET ${CONFIRM_PATH}?token_hash=<redacted>&type=${verificationType}`);
  let confirmRes;
  try {
    confirmRes = await fetch(confirmUrl, { redirect: "manual" });
  } catch (e) {
    writeVerdict({
      verdict: "BLOCKED",
      evidence_tier: "CONNECTED-BODY-PASS-SMTPLESS",
      detail: `fetch to confirm route threw: ${String(e?.message ?? e)}`,
      link_type_used: linkTypeUsed,
      email_confirmed_at_before: confirmedBefore,
    });
    process.exit(2);
  }

  const confirmStatus = confirmRes.status;
  const confirmLocation = confirmRes.headers.get("location") ?? null;

  // Count Set-Cookie headers without logging values. Node fetch exposes
  // multiple Set-Cookie via `getSetCookie()` (undici).
  let setCookieCount = 0;
  let sessionCookiePresent = false;
  try {
    if (typeof confirmRes.headers.getSetCookie === "function") {
      const all = confirmRes.headers.getSetCookie();
      setCookieCount = Array.isArray(all) ? all.length : 0;
      // Supabase SSR cookies: names starting with `sb-` and ending in
      // `-auth-token` (sometimes chunked `.0`, `.1`). We only read the
      // NAME prefix — never the value.
      sessionCookiePresent = all.some((c) => {
        const name = String(c).split("=")[0];
        return /^sb-.*-auth-token(\.|$)/.test(name);
      });
    } else {
      const single = confirmRes.headers.get("set-cookie");
      setCookieCount = single ? 1 : 0;
      if (single) {
        const name = single.split("=")[0];
        sessionCookiePresent = /^sb-.*-auth-token(\.|$)/.test(name);
      }
    }
  } catch (e) {
    log("PHASE2", `set-cookie parse error (non-fatal): ${String(e?.message ?? e)}`);
  }

  log(
    "PHASE2",
    `confirm response status=${confirmStatus} location=${confirmLocation} setCookieCount=${setCookieCount} sessionCookiePresent=${sessionCookiePresent}`,
  );

  // ── Phase 3 · re-check email_confirmed_at via service role ─────────────────
  let confirmedAfter = null;
  try {
    const { data: userAfter, error: uaErr } = await admin.auth.admin.getUserById(
      C.supabase_user_id,
    );
    if (uaErr) {
      log("PHASE3", `getUserById error: ${uaErr.message}`);
    } else {
      confirmedAfter = userAfter?.user?.email_confirmed_at ?? null;
      log(
        "PHASE3",
        `email_confirmed_at(after) = ${confirmedAfter ?? "null"}`,
      );
    }
  } catch (e) {
    log("PHASE3", `getUserById threw: ${String(e?.message ?? e)}`);
  }

  const stateChange =
    confirmedBefore == null && confirmedAfter != null
      ? "state_change_null_to_set"
      : confirmedBefore != null && confirmedAfter != null
        ? "no_op_idempotent"
        : confirmedBefore == null && confirmedAfter == null
          ? "no_change_still_null"
          : "unexpected_after_null_before_set";

  // ── Verdict ────────────────────────────────────────────────────────────────
  const redirectIsSuccess =
    (confirmStatus === 302 || confirmStatus === 303) &&
    typeof confirmLocation === "string" &&
    confirmLocation.endsWith(EXPECTED_SUCCESS_REDIRECT);

  const redirectIsFailure =
    (confirmStatus === 302 || confirmStatus === 303) &&
    typeof confirmLocation === "string" &&
    confirmLocation.includes("/nex-native/sign-in") &&
    confirmLocation.includes("email_confirmation_failed");

  let verdict;
  let detail;
  if (redirectIsSuccess && sessionCookiePresent) {
    verdict = "PASS";
    detail =
      `confirm route returned ${confirmStatus} → ${confirmLocation} with ${setCookieCount} Set-Cookie header(s); sb-auth-token present; email_confirmed_at transition: ${stateChange}; link path: ${linkTypeUsed}`;
  } else if (redirectIsFailure) {
    verdict = "FAIL";
    detail =
      `confirm route redirected to failure page: ${confirmLocation}. link path: ${linkTypeUsed}. This is a real journey defect — the admin-minted token was rejected by verifyOtp.`;
  } else {
    verdict = "FAIL";
    detail =
      `confirm route response not as expected. status=${confirmStatus} location=${confirmLocation} setCookieCount=${setCookieCount} sessionCookiePresent=${sessionCookiePresent} link_path=${linkTypeUsed}`;
  }

  writeVerdict({
    verdict,
    evidence_tier: "CONNECTED-BODY-PASS-SMTPLESS",
    link_type_used: linkTypeUsed,
    confirm_status_code: confirmStatus,
    confirm_redirect_location: confirmLocation,
    set_cookie_count: setCookieCount,
    session_cookie_present: sessionCookiePresent,
    email_confirmed_at_before: confirmedBefore,
    email_confirmed_at_after: confirmedAfter,
    email_confirmed_state_transition: stateChange,
    phase1_detail: phase1Detail,
    detail,
  });

  process.exit(0);
}

main().catch((e) => {
  console.error(`FATAL: unhandled: ${String(e?.stack ?? e?.message ?? e)}`);
  // Best-effort verdict file so the runner has something to aggregate.
  try {
    writeVerdict({
      verdict: "BLOCKED",
      evidence_tier: "CONNECTED-BODY-PASS-SMTPLESS",
      detail: `unhandled exception: ${String(e?.message ?? e)}`,
    });
  } catch { /* ignore */ }
  process.exit(2);
});
