#!/usr/bin/env node
// scripts/gate-a-connected-matrix/52_v_w2_dup.mjs
//
// V-W2-DUP · duplicate invitee in array.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// A calls W2 with p_invitee_account_ids=[B, B, C].
// Expected: one row for B, one row for C (dedup via unique_violation catch),
// no error raised. out_rejected_count=0 (slice is 3 elements, all within cap).

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
if (!supabaseUrl || supabaseUrl.includes(PRODUCTION_REF)) { console.error("FATAL"); process.exit(2); }
const anonKey = readEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
if (!anonKey) { console.error("FATAL"); process.exit(2); }

console.log(`TARGET: sandbox ${CANONICAL_PROJECT_REF}`);
console.log("SCENARIO: V-W2-DUP — duplicate B in invitee array — dedup expected");

if (!existsSync(IDENTITY_CAPTURE_FILE)) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "identity capture missing" }));
  process.exit(0);
}
const capture = JSON.parse(readFileSync(IDENTITY_CAPTURE_FILE, "utf8"));
function getOk(label) { const id = capture[label]; return (id?.status === "OK" && id.nex_account_id) ? id : null; }
async function signIn(label) {
  const id = getOk(label);
  if (!id) return null;
  const pw = process.env[`GATE_A_TEST_PASSWORD_${label}`];
  if (!pw) return null;
  const c = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: id.email, password: pw });
  if (error || !data.session) return null;
  return data.session.access_token;
}
function buildClient(jwt) {
  return createClient(supabaseUrl, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${jwt}` } } });
}

const idA = getOk("A");
const idB = getOk("B");
const idC = getOk("C");
if (!idA || !idB || !idC) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "need A, B, C" }));
  process.exit(0);
}
const jwtA = await signIn("A");
if (!jwtA) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "A sign-in failed" }));
  process.exit(0);
}
const clientA = buildClient(jwtA);

// Pass [B, B, C] — B appears twice
const { data, error } = await clientA.rpc("nex_create_group_call_session_tx", {
  p_media_type: "audio",
  p_from_call_link_id: null,
  p_host_country: "ireland",
  p_invitee_account_ids: [idB.nex_account_id, idB.nex_account_id, idC.nex_account_id],
});

if (error) {
  if (error.code === "42883") {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: "MIG-B not applied" }));
    process.exit(0);
  }
  console.error(`FAIL: W2 error on dup input: ${error.code}: ${error.message}`);
  console.log(JSON.stringify({ verdict: "FAIL", detail: `Unexpected error: ${error.code}: ${error.message}` }));
  process.exit(1);
}

const row = data?.[0];
const participants = Array.isArray(row?.out_participants) ? row.out_participants : [];
console.log(`Participants returned: ${participants.length}`);
console.log(`out_rejected_count: ${row?.out_rejected_count}`);

const checks = [];
// host A + B (once) + C = 3 participants (B's second occurrence is silently skipped)
checks.push({ name: "participant count=3 (host+B+C, B deduped)", pass: participants.length === 3 });

// Verify no error
checks.push({ name: "no error returned", pass: !error });

// B appears exactly once
const bCount = participants.filter(p => p.account_id === idB.nex_account_id).length;
checks.push({ name: "B appears exactly once", pass: bCount === 1 });

// C appears exactly once
const cCount = participants.filter(p => p.account_id === idC.nex_account_id).length;
checks.push({ name: "C appears exactly once", pass: cCount === 1 });

// out_rejected_count: slice of [B,B,C] = [B,B,C] (len=3, capped to 3), rejected=0
checks.push({ name: "out_rejected_count=0", pass: row?.out_rejected_count === 0 });

for (const c of checks) console.log(`  ${c.pass ? "OK" : "FAIL"}: ${c.name}`);

const allPass = checks.every(c => c.pass);
console.log(JSON.stringify({
  verdict: allPass ? "PASS" : "FAIL",
  classification: "CONNECTED",
  detail: checks.filter(c => !c.pass).map(c => c.name).join("; ") || "all passed",
  retained_rows: { nex_group_call_session: [row?.out_session_id].filter(Boolean), nex_group_call_participant: participants.map(p => p.id).filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] },
}));
process.exit(allPass ? 0 : 1);
