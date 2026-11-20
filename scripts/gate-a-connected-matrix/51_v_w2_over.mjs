#!/usr/bin/env node
// scripts/gate-a-connected-matrix/51_v_w2_over.mjs
//
// V-W2-OVER · server-side slice (> 3 invitees).
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// A calls W2 with 5 invitees. Expected: only first 3 inserted, out_rejected_count=2.
// If identity pool < 5, adjust expected count or mark PARTIAL.

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
console.log("SCENARIO: V-W2-OVER — server-side slice caps invitees at 3");

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
const idD = getOk("D");
const idE = getOk("E");

if (!idA || !idB) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "need at least A, B" }));
  process.exit(0);
}

const jwtA = await signIn("A");
if (!jwtA) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "A sign-in failed" }));
  process.exit(0);
}
const clientA = buildClient(jwtA);

// Build invitee list from available identities
const availableInvitees = [idB, idC, idD, idE].filter(Boolean).map(id => id.nex_account_id);
const inputCount = availableInvitees.length;

if (inputCount < 4) {
  // Cannot pass > 3 invitees without at least 4 non-host identities
  console.log(
    `PARTIAL: only ${inputCount} invitee identities available. ` +
    `V-W2-OVER needs at least 4 invitees (passed to W2) so that RPC slices at 3. ` +
    `With ${inputCount} invitees, rejection count would be ${Math.max(0, inputCount - 3)}.`
  );
  if (inputCount < 1) {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: "no invitee identities" }));
    process.exit(0);
  }
  // Run with what we have — partial coverage
  const { data, error } = await clientA.rpc("nex_create_group_call_session_tx", {
    p_media_type: "audio",
    p_from_call_link_id: null,
    p_host_country: "ireland",
    p_invitee_account_ids: availableInvitees,
  });
  if (error) {
    if (error.code === "42883") {
      console.log(JSON.stringify({ verdict: "BLOCKED", detail: "MIG-B not applied" }));
      process.exit(0);
    }
    console.log(JSON.stringify({ verdict: "FAIL", detail: `W2 error: ${error.code}: ${error.message}` }));
    process.exit(1);
  }
  const row = data?.[0];
  const participants = Array.isArray(row?.out_participants) ? row.out_participants : [];
  const expectedInserted = Math.min(inputCount, 3);
  const expectedRejected = Math.max(0, inputCount - 3);
  console.log(`participants returned: ${participants.length}, out_rejected_count: ${row?.out_rejected_count}`);
  const verdict = (participants.length === expectedInserted + 1) && (row?.out_rejected_count === expectedRejected) ? "PARTIAL" : "FAIL";
  console.log(JSON.stringify({
    verdict,
    classification: "PARTIAL-COVERAGE",
    detail: `Only ${inputCount} invitees available; full 5-invitee test needs 5 identities`,
    retained_rows: { nex_group_call_session: [row?.out_session_id].filter(Boolean), nex_group_call_participant: participants.map(p => p.id).filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] },
  }));
  process.exit(verdict === "FAIL" ? 1 : 0);
}

// Full path: 4+ invitees available — pass them all, expect slice at 3
const { data, error } = await clientA.rpc("nex_create_group_call_session_tx", {
  p_media_type: "audio",
  p_from_call_link_id: null,
  p_host_country: "ireland",
  p_invitee_account_ids: availableInvitees,
});

if (error) {
  if (error.code === "42883") {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: "MIG-B not applied" }));
    process.exit(0);
  }
  console.log(JSON.stringify({ verdict: "FAIL", detail: `W2 error: ${error.code}: ${error.message}` }));
  process.exit(1);
}

const row = data?.[0];
const participants = Array.isArray(row?.out_participants) ? row.out_participants : [];
const expectedRejected = inputCount - 3;

console.log(`Input invitees: ${inputCount}, out_rejected_count: ${row?.out_rejected_count}, participants: ${participants.length}`);

const checks = [];
// host + 3 capped invitees = 4 participant rows
checks.push({ name: "participant count = 4 (host + 3 capped)", pass: participants.length === 4 });
checks.push({ name: `out_rejected_count=${expectedRejected}`, pass: row?.out_rejected_count === expectedRejected });

for (const c of checks) console.log(`  ${c.pass ? "OK" : "FAIL"}: ${c.name}`);

const allPass = checks.every(c => c.pass);
console.log(JSON.stringify({
  verdict: allPass ? "PASS" : "FAIL",
  classification: "CONNECTED",
  detail: checks.filter(c => !c.pass).map(c => c.name).join("; ") || "all passed",
  retained_rows: { nex_group_call_session: [row?.out_session_id].filter(Boolean), nex_group_call_participant: participants.map(p => p.id).filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] },
}));
process.exit(allPass ? 0 : 1);
