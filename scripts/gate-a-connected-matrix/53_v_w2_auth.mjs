#!/usr/bin/env node
// scripts/gate-a-connected-matrix/53_v_w2_auth.mjs
//
// V-W2-AUTH · W2 identity fail-closed (anon call).
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// Same ACL-level block as V-AUTH-NULL but for nex_create_group_call_session_tx.
// Expected: 42501 or 42883 ACL rejection for anon caller.

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
if (!supabaseUrl || supabaseUrl.includes(PRODUCTION_REF)) { console.error("FATAL"); process.exit(2); }
const anonKey = readEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
if (!anonKey) { console.error("FATAL"); process.exit(2); }

console.log(`TARGET: sandbox ${CANONICAL_PROJECT_REF}`);
console.log("SCENARIO: V-W2-AUTH — anon (no session) W2 call → ACL rejection");

const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

const { data, error } = await client.rpc("nex_create_group_call_session_tx", {
  p_media_type: "audio",
  p_from_call_link_id: null,
  p_host_country: "ireland",
  p_invitee_account_ids: [],
});

if (error) {
  const code = error.code ?? "";
  const msg = error.message ?? "";
  console.log(`RPC error code: ${code}`);
  console.log(`RPC error msg (truncated): ${msg.slice(0, 200)}`);

  const isAclBlock =
    code === "42501" || code === "42883" || code === "PGRST301" ||
    /insufficient.privilege|permission.denied|does not exist|42501|42883|PGRST301/i.test(msg);

  if (isAclBlock) {
    console.log("PASS (ACL-LEVEL): anon W2 call rejected before body execution");
    console.log(JSON.stringify({
      verdict: "PASS",
      classification: "CONNECTED-ACL-VERIFIED",
      detail: `ACL block confirmed for W2. code=${code}`,
    }));
    process.exit(0);
  } else {
    console.error(`FAIL: unexpected error ${code}: ${msg}`);
    console.log(JSON.stringify({ verdict: "FAIL", detail: `Unexpected: ${code}: ${msg.slice(0, 200)}` }));
    process.exit(1);
  }
} else {
  console.error("FAIL: anon W2 call returned data — REVOKE not effective");
  console.log(JSON.stringify({ verdict: "FAIL", classification: "CRITICAL: REVOKE_NOT_EFFECTIVE", detail: "anon W2 received data" }));
  process.exit(1);
}
