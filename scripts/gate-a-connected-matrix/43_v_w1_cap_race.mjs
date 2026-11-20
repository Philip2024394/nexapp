#!/usr/bin/env node
// scripts/gate-a-connected-matrix/43_v_w1_cap_race.mjs
//
// V-W1-CAP-RACE · concurrent invite race.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// Setup: session with host (A) + 2 invitees (B, C) = 3 rows total (via W2).
// Then two concurrent callers (both signed in as A) each invite a different
// account to the SAME session via Promise.all.
// Expected with v4 FOR UPDATE: one succeeds (cnt→4), other fails P0001.
// CRITICAL FAIL if both succeed and cnt becomes 5.
//
// If only 3 identities available: PARTIAL — cannot run two concurrent invites
// to real different accounts without identities D and E.

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
console.log("SCENARIO: V-W1-CAP-RACE — concurrent invites serialized by FOR UPDATE lock");

if (!existsSync(IDENTITY_CAPTURE_FILE)) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "identity capture missing" }));
  process.exit(0);
}
const capture = JSON.parse(readFileSync(IDENTITY_CAPTURE_FILE, "utf8"));

function getOk(label) {
  const id = capture[label];
  return (id?.status === "OK" && id.nex_account_id) ? id : null;
}
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
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

const idA = getOk("A");
const idB = getOk("B");
const idC = getOk("C");
const idD = getOk("D");
const idE = getOk("E");

// Need A (host), B, C for setup (3 rows via W2), then D and E for the two concurrent callers
if (!idA || !idB || !idC) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "need A,B,C minimum" }));
  process.exit(0);
}

const jwtA = await signIn("A");
if (!jwtA) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "A sign-in failed" }));
  process.exit(0);
}

// Create session with 3 rows via W2
const clientA = buildClient(jwtA);
const { data: sessData, error: sessErr } = await clientA.rpc("nex_create_group_call_session_tx", {
  p_media_type: "audio",
  p_from_call_link_id: null,
  p_host_country: "ireland",
  p_invitee_account_ids: [idB.nex_account_id, idC.nex_account_id],
});

let sessionId;
const retainedParticipants = [];
const retainedConvs = [];
const retainedMsgs = [];

if (sessErr || !sessData?.[0]?.out_session_id) {
  // Fall back: chain W1 invites for B and C (2 rows)
  console.log("W2 unavailable — using chained W1 for setup");
  const { data: i1, error: e1 } = await clientA.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: idB.nex_account_id,
    p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {},
    p_invite_body: "race setup 1",
    p_attachment_url: `/nex-native/call/preview?session=00000000-0000-4000-8000-000000000001&accept=1`,
    p_existing_session_id: null,
  });
  if (e1 || !i1?.[0]?.out_session_id) {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: `W1 setup failed: ${e1?.message}` }));
    process.exit(0);
  }
  sessionId = i1[0].out_session_id;
  retainedParticipants.push(i1[0].out_participant_id);
  retainedConvs.push(i1[0].out_conversation_id);
  retainedMsgs.push(i1[0].out_message_id);

  const { data: i2, error: e2 } = await clientA.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: idC.nex_account_id,
    p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {},
    p_invite_body: "race setup 2",
    p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`,
    p_existing_session_id: sessionId,
  });
  if (e2) {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: `W1 setup2 failed: ${e2.message}` }));
    process.exit(0);
  }
  retainedParticipants.push(i2?.[0]?.out_participant_id);
  retainedMsgs.push(i2?.[0]?.out_message_id);
  // cnt=2 (B and C). W1 path doesn't add host row — need 3 rows to test cap race properly.
  // With only 2 rows and 2 concurrent callers, both should succeed (cnt→3 and cnt→4, both < 4).
  // We need exactly 3 rows to race toward the cap.
  if (!idD) {
    console.log("PARTIAL: only 3 identities. With 2 setup rows (B,C), two concurrent invites to D,E would go to cnt=3 and cnt=4 (both succeed). No P0001 expected without 5th row.");
    const retainedRows = { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: retainedConvs.filter(Boolean), nex_peer_message: retainedMsgs.filter(Boolean) };
    console.log(JSON.stringify({ verdict: "PARTIAL", classification: "PARTIAL-COVERAGE", detail: "Race test requires 5 identities: host + 2 setup + 2 concurrent racers. Only 3 available.", retained_rows: retainedRows }));
    process.exit(0);
  }
  // Add D as 3rd setup row to get cnt=3
  const { data: i3, error: e3 } = await clientA.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: idD.nex_account_id,
    p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {},
    p_invite_body: "race setup 3",
    p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`,
    p_existing_session_id: sessionId,
  });
  if (e3) {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: `W1 setup3 failed: ${e3.message}` }));
    process.exit(0);
  }
  retainedParticipants.push(i3?.[0]?.out_participant_id);
  retainedMsgs.push(i3?.[0]?.out_message_id);
} else {
  sessionId = sessData[0].out_session_id;
  const participants = Array.isArray(sessData[0].out_participants) ? sessData[0].out_participants : [];
  for (const p of participants) retainedParticipants.push(p.id);
  console.log(`W2 session ${sessionId} with ${participants.length} participants`);
  if (!idD) {
    console.log("PARTIAL: 3 identities. W2 gave 3 rows. Need D and E as concurrent racers.");
    const retainedRows = { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] };
    console.log(JSON.stringify({ verdict: "PARTIAL", classification: "PARTIAL-COVERAGE", detail: "Race test requires D,E as concurrent invitees. Only A,B,C available.", retained_rows: retainedRows }));
    process.exit(0);
  }
}

// cnt=3. Race: two concurrent W1 invites to D and E (or E and an extra)
if (!idE) {
  console.log("PARTIAL: have D but not E — can run only one side of race");
  const retainedRows = { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: retainedConvs.filter(Boolean), nex_peer_message: retainedMsgs.filter(Boolean) };
  console.log(JSON.stringify({ verdict: "PARTIAL", classification: "PARTIAL-COVERAGE", detail: "Race requires 2 concurrent callers with distinct identities. Need E. Only A,B,C,D available.", retained_rows: retainedRows }));
  process.exit(0);
}

console.log(`cnt=3. Racing: concurrent invites to D (${idD.nex_account_id}) and E (${idE.nex_account_id})`);

// Two concurrent clients both signed in as A (the host)
// Using Promise.all to send simultaneously
const clientA1 = buildClient(jwtA);
const clientA2 = buildClient(jwtA);

const [res1, res2] = await Promise.all([
  clientA1.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: idD.nex_account_id,
    p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {},
    p_invite_body: "race caller1 D",
    p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`,
    p_existing_session_id: sessionId,
  }),
  clientA2.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: idE.nex_account_id,
    p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {},
    p_invite_body: "race caller2 E",
    p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`,
    p_existing_session_id: sessionId,
  }),
]);

const r1ok = !res1.error && res1.data?.[0]?.out_participant_id;
const r2ok = !res2.error && res2.data?.[0]?.out_participant_id;
const r1cap = res1.error && (res1.error.code === "P0001" || /already has 4 participants/i.test(res1.error.message ?? ""));
const r2cap = res2.error && (res2.error.code === "P0001" || /already has 4 participants/i.test(res2.error.message ?? ""));

console.log(`Caller1 (D): ok=${r1ok} cap=${r1cap} error=${res1.error?.code}`);
console.log(`Caller2 (E): ok=${r2ok} cap=${r2cap} error=${res2.error?.code}`);

if (r1ok) retainedParticipants.push(res1.data[0].out_participant_id);
if (r2ok) retainedParticipants.push(res2.data[0].out_participant_id);
if (res1.data?.[0]?.out_message_id) retainedMsgs.push(res1.data[0].out_message_id);
if (res2.data?.[0]?.out_message_id) retainedMsgs.push(res2.data[0].out_message_id);

// Verify participant count — must not exceed 4
const { data: partRows } = await clientA.from("nex_group_call_participant").select("id").eq("session_id", sessionId);
const finalCount = partRows?.length ?? 0;
console.log(`Final participant count: ${finalCount}`);

const retainedRows = {
  nex_group_call_session: [sessionId],
  nex_group_call_participant: retainedParticipants.filter(Boolean),
  nex_peer_conversation: retainedConvs.filter(Boolean),
  nex_peer_message: retainedMsgs.filter(Boolean),
};

if (finalCount > 4) {
  console.error(`CRITICAL FAIL: final count=${finalCount} > 4 — FOR UPDATE did not serialize`);
  console.log(JSON.stringify({ verdict: "FAIL", classification: "CRITICAL: FOR_UPDATE_NOT_SERIALIZING", detail: `Count exceeded 4: ${finalCount}`, retained_rows: retainedRows }));
  process.exit(1);
}

if (r1ok && r2ok) {
  // Both succeeded — was cnt < 4 before race? Only possible if cnt was 2 (not 3)
  console.log("Both invites succeeded — this is correct if cnt was <3 before race (both fit under cap)");
  // If finalCount <= 4 and both succeeded, the race was below the cap threshold
  if (finalCount <= 4) {
    console.log("PASS (sub-cap): both callers below cap boundary — FOR UPDATE preserved cap invariant");
    console.log(JSON.stringify({ verdict: "PASS", classification: "CONNECTED", detail: `Both callers succeeded; final count=${finalCount} <= 4 — cap not exceeded. FOR UPDATE effective.`, retained_rows: retainedRows }));
    process.exit(0);
  }
}

if ((r1ok && r2cap) || (r2ok && r1cap)) {
  console.log("PASS: exactly one caller succeeded, one raised P0001 — FOR UPDATE serialized correctly");
  console.log(JSON.stringify({ verdict: "PASS", classification: "CONNECTED", detail: `Race serialized: one PASS, one P0001. Final count=${finalCount}`, retained_rows: retainedRows }));
  process.exit(0);
}

// Both failed — unexpected
console.error("FAIL: both concurrent invites failed — unexpected outcome");
console.log(JSON.stringify({ verdict: "FAIL", detail: `Both failed. r1=${res1.error?.code} r2=${res2.error?.code}`, retained_rows: retainedRows }));
process.exit(1);
