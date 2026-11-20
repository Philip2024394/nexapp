#!/usr/bin/env node
// scripts/gate-a-connected-matrix/30_v_auth_null.mjs
//
// V-AUTH-NULL · NULL auth.uid() fail-closed verification.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// Scenario: call nex_invite_to_call_tx with NO signed-in session (anon client).
// Expected: ACL rejection (42501 or 42883) — the REVOKE EXECUTE FROM anon
// fires BEFORE the function body ever executes.
//
// Important distinction:
// Via supported Supabase auth, a NULL auth.uid() INSIDE the body is NOT directly
// producible because anon role cannot reach the body (EXECUTE is REVOKED).
// V-AUTH-NULL therefore observes the ACL-level block, not the body guard.
// Classification: CONNECTED-ACL-VERIFIED + body-guard-UNIT-VERIFIED.
// The body guard (auth.uid() IS NULL RAISE 42501) is covered by unit tests only.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");
const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";

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
console.log("SCENARIO: V-AUTH-NULL — anon (no session) RPC call");

// Build anon client with NO signed-in session
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

// Payload: valid structure, but caller is anon (no JWT sub)
const { data, error } = await client.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: "00000000-0000-4000-8000-000000000099",
  p_media_type: "audio",
  p_host_country: "ireland",
  p_attachment_meta: {},
  p_invite_body: "v-auth-null test",
  p_attachment_url: "/nex-native/call/preview?session=00000000-0000-4000-8000-000000000001&accept=1",
  p_existing_session_id: null,
});

if (error) {
  const code = error.code ?? "";
  const msg = error.message ?? "";
  console.log(`RPC error code: ${code}`);
  console.log(`RPC error msg (truncated): ${msg.slice(0, 200)}`);

  // Expected: 42501 (insufficient privilege) or 42883 (function does not exist for anon)
  // or PGRST301 (JWT required) or similar ACL-level rejection
  const isAclBlock =
    code === "42501" ||
    code === "42883" ||
    code === "PGRST301" ||
    /insufficient.privilege|permission.denied|does not exist|42501|42883|PGRST301/i.test(msg);

  if (isAclBlock) {
    console.log(
      "PASS (ACL-LEVEL BLOCK): anon RPC call was rejected before body execution.\n" +
      "Classification: CONNECTED-ACL-VERIFIED.\n" +
      "Body guard (auth.uid() IS NULL → RAISE 42501) is UNIT-VERIFIED only — " +
      "not reachable via supported auth path in a connected run.\n" +
      "V-AUTH-NULL body-guard: UNVERIFIED-in-connected (expected; known limitation)."
    );
    console.log(JSON.stringify({
      verdict: "PASS",
      classification: "CONNECTED-ACL-VERIFIED",
      detail: `ACL block confirmed. code=${code}. Body guard is UNIT-VERIFIED only.`,
      body_guard_connected: false,
      body_guard_unit_verified: true,
    }));
    process.exit(0);
  } else {
    console.error(`FAIL: unexpected error code ${code}: ${msg}`);
    console.log(JSON.stringify({
      verdict: "FAIL",
      classification: "UNEXPECTED_ERROR",
      detail: `Unexpected error code ${code}: ${msg.slice(0, 200)}`,
    }));
    process.exit(1);
  }
} else {
  // If data is returned from anon, the REVOKE did NOT work — critical failure
  console.error("FAIL: anon RPC call returned data — REVOKE FROM anon is NOT effective");
  console.log(JSON.stringify({
    verdict: "FAIL",
    classification: "CRITICAL: REVOKE_NOT_EFFECTIVE",
    detail: "anon client received data from nex_invite_to_call_tx — ACL is broken",
  }));
  process.exit(1);
}
