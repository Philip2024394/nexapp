#!/usr/bin/env node
// scripts/gate-a-connected-matrix/63_v_w3_cap.mjs
//
// V-W3-CAP · cold join to full session (5th participant attempt).
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// Create session with 4 participants (host A + 3 invitees via W2 or chained W1).
// A 5th disposable identity (D or E) attempts W3 cold-join.
// Expected: P0001 cap trigger raises.
// If identities < 5: PARTIAL.

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
console.log("SCENARIO: V-W3-CAP — 5th participant cold-join raises P0001");

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

if (!idA || !idB || !idC) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "need A,B,C minimum" }));
  process.exit(0);
}

const jwtA = await signIn("A");
if (!jwtA) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "A sign-in failed" }));
  process.exit(0);
}
const clientA = buildClient(jwtA);
const retainedParticipants = [];

// Create session with 4 rows via W2 (host A + B + C + D = 4)
const invitees = [idB, idC, idD].filter(Boolean).map(id => id.nex_account_id);
const { data: sessData, error: sessErr } = await clientA.rpc("nex_create_group_call_session_tx", {
  p_media_type: "audio", p_from_call_link_id: null, p_host_country: "ireland",
  p_invitee_account_ids: invitees,
});

let sessionId;
if (sessErr || !sessData?.[0]?.out_session_id) {
  // Fall back to W1 chaining
  if (sessErr?.code === "42883" || !sessData) console.log("W2 not available — using W1");
  const { data: i1, error: e1 } = await clientA.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: idB.nex_account_id,
    p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {},
    p_invite_body: "cap setup", p_attachment_url: `/nex-native/call/preview?session=00000000-0000-4000-8000-000000000001&accept=1`,
    p_existing_session_id: null,
  });
  if (e1 || !i1?.[0]?.out_session_id) {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: `setup failed: ${e1?.message}` }));
    process.exit(0);
  }
  sessionId = i1[0].out_session_id;
  retainedParticipants.push(i1[0].out_participant_id);
  if (idC) {
    const { data: i2 } = await clientA.rpc("nex_invite_to_call_tx", { p_invitee_account_id: idC.nex_account_id, p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {}, p_invite_body: "cap setup c", p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`, p_existing_session_id: sessionId });
    if (i2?.[0]?.out_participant_id) retainedParticipants.push(i2[0].out_participant_id);
  }
  if (idD) {
    const { data: i3 } = await clientA.rpc("nex_invite_to_call_tx", { p_invitee_account_id: idD.nex_account_id, p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {}, p_invite_body: "cap setup d", p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`, p_existing_session_id: sessionId });
    if (i3?.[0]?.out_participant_id) retainedParticipants.push(i3[0].out_participant_id);
  }
} else {
  sessionId = sessData[0].out_session_id;
  const parts = Array.isArray(sessData[0].out_participants) ? sessData[0].out_participants : [];
  for (const p of parts) retainedParticipants.push(p.id);
  console.log(`W2 session ${sessionId} with ${parts.length} participants`);
}

// Check current count
const { data: partRows } = await clientA.from("nex_group_call_participant").select("id").eq("session_id", sessionId);
const currentCount = partRows?.length ?? 0;
console.log(`Current participant count: ${currentCount}`);

if (currentCount < 4) {
  console.log(`PARTIAL: only ${currentCount} rows. Need exactly 4 to test 5th-join P0001. Insufficient identities.`);
  console.log(JSON.stringify({ verdict: "PARTIAL", classification: "PARTIAL-COVERAGE", detail: `Only ${currentCount}/4 rows. Need 5 identities total.`, retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] } }));
  process.exit(0);
}

// Need a 5th identity (E) to attempt cold-join
if (!idE) {
  console.log("PARTIAL: 4 rows in session but no 5th identity (E) to attempt cap-triggering cold-join");
  console.log(JSON.stringify({ verdict: "PARTIAL", classification: "PARTIAL-COVERAGE", detail: "Session at cnt=4. Need E for 5th cold-join attempt.", retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] } }));
  process.exit(0);
}

const jwtE = await signIn("E");
if (!jwtE) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "E sign-in failed" }));
  process.exit(0);
}
const clientE = buildClient(jwtE);

const { data: joinData, error: joinErr } = await clientE.rpc("nex_join_group_call_session_tx", {
  p_session_id: sessionId,
  p_role: "guest",
});

if (joinErr) {
  if (joinErr.code === "42883") {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: "MIG-C not applied" }));
    process.exit(0);
  }
  const isP0001 = joinErr.code === "P0001" || /already has 4 participants/i.test(joinErr.message ?? "");
  if (isP0001) {
    console.log("PASS: P0001 raised on 5th cold-join attempt — cap enforced by trigger");
    console.log(JSON.stringify({ verdict: "PASS", classification: "CONNECTED", detail: `P0001 at cnt=4 cold-join. code=${joinErr.code}`, retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] } }));
    process.exit(0);
  } else {
    console.error(`FAIL: unexpected error: ${joinErr.code}: ${joinErr.message}`);
    console.log(JSON.stringify({ verdict: "FAIL", detail: `Unexpected: ${joinErr.code}: ${joinErr.message}`, retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] } }));
    process.exit(1);
  }
} else {
  console.error("FAIL: 5th cold-join succeeded — cap trigger not firing");
  console.log(JSON.stringify({ verdict: "FAIL", detail: "5th join succeeded unexpectedly", retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] } }));
  process.exit(1);
}
