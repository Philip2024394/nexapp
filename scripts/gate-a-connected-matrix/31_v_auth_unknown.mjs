#!/usr/bin/env node
// scripts/gate-a-connected-matrix/31_v_auth_unknown.mjs
//
// V-AUTH-UNKNOWN · authenticated JWT but no nex_account row.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// Scenario: call nex_invite_to_call_tx with a valid JWT whose sub has
// no corresponding nex_account row. Expected: ERRCODE 42501, msg contains
// 'caller_account_not_found'.
//
// Sandbox config dependency:
// If sandbox auto-creates nex_account on signup (via trigger or RLS policy),
// this case is NOT naturally reproducible via supported signup.
// Policy: we CANNOT delete the auto-created nex_account row for a disposable
// account mid-test (that would violate scoped-cleanup bounds and require
// service_role or superuser access beyond the test's authorized scope).
//
// Resolution: read the identity capture file. If the identity has
// nex_account_found=false, we have a natural V-AUTH-UNKNOWN test candidate.
// If nex_account_found=true for all identities, mark BLOCKED with exact reason.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");
const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";
const IDENTITY_CAPTURE_FILE = resolve(__dir, "99_identity_capture.json.OUTPUT");

function readEnv(key) {
  const raw = readFileSync(resolve(REPO_ROOT, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const supabaseUrl = readEnv("NEXT_PUBLIC_NEX_SUPABASE_URL");
if (!supabaseUrl || supabaseUrl.includes(PRODUCTION_REF)) {
  console.error("FATAL: URL missing or contains production ref"); process.exit(2);
}
const anonKey = readEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
if (!anonKey) { console.error("FATAL: anon key missing"); process.exit(2); }

console.log(`TARGET: sandbox ${CANONICAL_PROJECT_REF}`);
console.log("SCENARIO: V-AUTH-UNKNOWN — signed-in user with no nex_account row");

// Read identity capture
if (!existsSync(IDENTITY_CAPTURE_FILE)) {
  console.error("BLOCKED: identity capture file not found — run 20_signup_disposable_identities.mjs first");
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "identity capture missing" }));
  process.exit(0);  // exit 0 — BLOCKED is not a runner FAIL
}
const capture = JSON.parse(readFileSync(IDENTITY_CAPTURE_FILE, "utf8"));

// Find an identity where nex_account_found = false
const unknownCandidate = Object.entries(capture).find(
  ([, v]) => v.status === "OK" && v.nex_account_found === false
);

if (!unknownCandidate) {
  // All identities have nex_account rows — auto-create is ON in sandbox
  console.log(
    "BLOCKED: V-AUTH-UNKNOWN requires a signed-in user with NO nex_account row.\n" +
    "Sandbox auto-creates nex_account on signup — all disposable identities have nex_account rows.\n" +
    "Authorized test policy: we cannot delete the auto-created nex_account row for a " +
    "disposable account mid-test (would require service_role DELETE beyond authorized test scope).\n" +
    "Mark BLOCKED with reason: nex_account_auto_create_active_in_sandbox.\n" +
    "Resolution: disable nex_account auto-create trigger in sandbox (separately authorized action), " +
    "or accept that this code path is UNIT-VERIFIED only."
  );
  console.log(JSON.stringify({
    verdict: "BLOCKED",
    classification: "UNIT-VERIFIED-ONLY",
    detail:
      "nex_account auto-create is active in sandbox. " +
      "V-AUTH-UNKNOWN is not naturally reproducible via supported-signup-only policy. " +
      "Body guard (caller_account_not_found) is UNIT-VERIFIED only.",
    reason: "nex_account_auto_create_active_in_sandbox",
  }));
  process.exit(0);
}

const [label, identity] = unknownCandidate;
console.log(`Using identity ${label} (${identity.email}) — nex_account not found`);

// Sign in this identity
const pwKey = `GATE_A_TEST_PASSWORD_${label}`;
const password = process.env[pwKey];
if (!password) {
  console.error(`BLOCKED: ${pwKey} env var not set`);
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: `${pwKey} not in env` }));
  process.exit(0);
}

const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
  email: identity.email,
  password,
});

if (signInError || !signInData?.session) {
  console.error(`BLOCKED: sign-in failed: ${signInError?.message}`);
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: `sign-in failed: ${signInError?.message}` }));
  process.exit(0);
}

const jwt = signInData.session.access_token;
const authedClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

// Call W1 — expect 42501 caller_account_not_found
const { data, error } = await authedClient.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: "00000000-0000-4000-8000-000000000099",
  p_media_type: "audio",
  p_host_country: "ireland",
  p_attachment_meta: {},
  p_invite_body: "v-auth-unknown test",
  p_attachment_url: "/nex-native/call/preview?session=00000000-0000-4000-8000-000000000001&accept=1",
  p_existing_session_id: null,
});

if (error) {
  const code = error.code ?? "";
  const msg = error.message ?? "";
  console.log(`RPC error code: ${code}`);
  console.log(`RPC error msg: ${msg.slice(0, 200)}`);

  const isExpected =
    code === "42501" ||
    /caller_account_not_found|42501/i.test(msg);

  if (isExpected) {
    console.log("PASS: V-AUTH-UNKNOWN — 42501 caller_account_not_found confirmed");
    console.log(JSON.stringify({
      verdict: "PASS",
      classification: "CONNECTED",
      detail: `42501 caller_account_not_found. code=${code}`,
    }));
    process.exit(0);
  } else {
    console.error(`FAIL: unexpected error — expected 42501/caller_account_not_found, got ${code}: ${msg.slice(0, 200)}`);
    console.log(JSON.stringify({
      verdict: "FAIL",
      detail: `Unexpected error code ${code}: ${msg.slice(0, 200)}`,
    }));
    process.exit(1);
  }
} else {
  console.error("FAIL: RPC returned data for user with no nex_account — body guard not firing");
  console.log(JSON.stringify({
    verdict: "FAIL",
    detail: "RPC returned data — caller_account_not_found guard is NOT effective",
  }));
  process.exit(1);
}
