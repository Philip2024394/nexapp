#!/usr/bin/env node
// scripts/gate-a-connected-matrix/62_v_w3_role.mjs
//
// V-W3-ROLE · role rejection at RPC level.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// B calls W3 with p_role='cohost'. Expected: ERRCODE 22023, msg 'invalid_role'.
// The RPC validates role before the INSERT fires, so the mig-133 CHECK is never reached.

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
console.log("SCENARIO: V-W3-ROLE — p_role='cohost' → 22023 invalid_role");

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
if (!idA || !idB) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "need A, B" }));
  process.exit(0);
}

// Need a valid session for B to try to join. Create one via W2 or W1 with C.
const jwtA = await signIn("A");
const jwtB = await signIn("B");
if (!jwtA || !jwtB) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "sign-in failed" }));
  process.exit(0);
}
const clientA = buildClient(jwtA);
const clientB = buildClient(jwtB);

// Create session with just A (W2 empty invitees)
const { data: sessData, error: sessErr } = await clientA.rpc("nex_create_group_call_session_tx", {
  p_media_type: "audio", p_from_call_link_id: null, p_host_country: "ireland", p_invitee_account_ids: [],
});

let sessionId;
const retainedParticipants = [];
if (sessErr) {
  // Fall back: use a dummy session via W1 with C
  const idC = getOk("C");
  if (!idC) {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: "W2 not available and no C" }));
    process.exit(0);
  }
  const { data: inv, error: invErr } = await clientA.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: idC.nex_account_id,
    p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {},
    p_invite_body: "role test setup",
    p_attachment_url: `/nex-native/call/preview?session=00000000-0000-4000-8000-000000000001&accept=1`,
    p_existing_session_id: null,
  });
  if (invErr || !inv?.[0]?.out_session_id) {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: `setup failed: ${invErr?.message}` }));
    process.exit(0);
  }
  sessionId = inv[0].out_session_id;
  retainedParticipants.push(inv[0].out_participant_id);
} else {
  sessionId = sessData?.[0]?.out_session_id;
  const parts = Array.isArray(sessData?.[0]?.out_participants) ? sessData[0].out_participants : [];
  for (const p of parts) retainedParticipants.push(p.id);
}

if (!sessionId) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "no session obtained" }));
  process.exit(0);
}
console.log(`Session: ${sessionId}`);

// Count participants before call (verify no insert attempt)
const { data: partsBefore } = await clientA.from("nex_group_call_participant").select("id").eq("session_id", sessionId);
const countBefore = partsBefore?.length ?? 0;

// B calls W3 with invalid role
const { data: joinData, error: joinErr } = await clientB.rpc("nex_join_group_call_session_tx", {
  p_session_id: sessionId,
  p_role: "cohost",  // invalid
});

if (joinErr) {
  if (joinErr.code === "42883") {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: "MIG-C not applied" }));
    process.exit(0);
  }
  const code = joinErr.code ?? "";
  const msg = joinErr.message ?? "";
  const is22023 = code === "22023" || /invalid_role|22023/i.test(msg);
  console.log(`Error: code=${code} msg=${msg.slice(0, 100)}`);

  // Verify no participant row was inserted (role check fires before INSERT)
  const { data: partsAfter } = await clientA.from("nex_group_call_participant").select("id").eq("session_id", sessionId);
  const countAfter = partsAfter?.length ?? 0;
  const noInsert = countAfter === countBefore;

  const checks = [];
  checks.push({ name: "22023 invalid_role raised", pass: is22023 });
  checks.push({ name: "no participant row inserted (role check before INSERT)", pass: noInsert });

  for (const c of checks) console.log(`  ${c.pass ? "OK" : "FAIL"}: ${c.name}`);

  const allPass = checks.every(c => c.pass);
  console.log(JSON.stringify({
    verdict: allPass ? "PASS" : "FAIL",
    classification: "CONNECTED",
    detail: checks.filter(c => !c.pass).map(c => c.name).join("; ") || "all passed",
    retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] },
  }));
  process.exit(allPass ? 0 : 1);
} else {
  console.error("FAIL: cohost role was accepted — invalid_role guard not enforced");
  console.log(JSON.stringify({ verdict: "FAIL", detail: "cohost role not rejected", retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] } }));
  process.exit(1);
}
