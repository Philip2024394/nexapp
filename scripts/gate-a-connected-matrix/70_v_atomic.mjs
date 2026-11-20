#!/usr/bin/env node
// scripts/gate-a-connected-matrix/70_v_atomic.mjs
//
// V-ATOMIC · transaction atomicity evidence.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// Attempt a W1 invite that triggers cap raise mid-function (participant INSERT
// fires cap trigger on existing-session path where cnt=4).
//
// Design note (from §16.47.8):
// V-ATOMIC provides single-write atomicity evidence only. True mid-function
// fault injection (between session-INSERT and participant-INSERT) is a
// STATE_BLOCKER (Case G) that PL/pgSQL does not expose via supported auth.
// Record V-ATOMIC result as INDIRECT evidence for Case G; mark Case G as
// UNVERIFIED in the status matrix.
//
// Setup: create session A + 3 invitees (cnt=3 via W2). Then one more
// invite (cnt→4). Then attempt a 5th (should raise P0001 during participant
// INSERT). Verify no extra orphaned session, conversation, message was written
// by the failed 5th call (which used an existing session, so no session INSERT
// to roll back — the test covers single-statement atomicity only).

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
console.log("SCENARIO: V-ATOMIC — single-write atomicity on cap-trigger failure");
console.log("NOTE: Case G (true mid-function fault) = STATE_BLOCKER. This test provides INDIRECT evidence only.");

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
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "need A, B, C minimum" }));
  process.exit(0);
}

const jwtA = await signIn("A");
if (!jwtA) { console.log(JSON.stringify({ verdict: "BLOCKED", detail: "A sign-in failed" })); process.exit(0); }
const clientA = buildClient(jwtA);

// Build a session with 4 participants
const retainedParticipants = [];
let sessionId;

const invitees3 = [idB, idC, idD].filter(Boolean).map(id => id.nex_account_id);
const { data: sessData, error: sessErr } = await clientA.rpc("nex_create_group_call_session_tx", {
  p_media_type: "audio", p_from_call_link_id: null, p_host_country: "ireland",
  p_invitee_account_ids: invitees3,
});
if (sessErr || !sessData?.[0]?.out_session_id) {
  // Chain W1
  const { data: i1, error: e1 } = await clientA.rpc("nex_invite_to_call_tx", { p_invitee_account_id: idB.nex_account_id, p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {}, p_invite_body: "atomic setup", p_attachment_url: `/nex-native/call/preview?session=00000000-0000-4000-8000-000000000001&accept=1`, p_existing_session_id: null });
  if (e1 || !i1?.[0]?.out_session_id) { console.log(JSON.stringify({ verdict: "BLOCKED", detail: `setup: ${e1?.message}` })); process.exit(0); }
  sessionId = i1[0].out_session_id;
  retainedParticipants.push(i1[0].out_participant_id);
  if (idC) {
    const { data: i2 } = await clientA.rpc("nex_invite_to_call_tx", { p_invitee_account_id: idC.nex_account_id, p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {}, p_invite_body: "atomic setup c", p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`, p_existing_session_id: sessionId });
    if (i2?.[0]?.out_participant_id) retainedParticipants.push(i2[0].out_participant_id);
  }
  if (idD) {
    const { data: i3 } = await clientA.rpc("nex_invite_to_call_tx", { p_invitee_account_id: idD.nex_account_id, p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {}, p_invite_body: "atomic setup d", p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`, p_existing_session_id: sessionId });
    if (i3?.[0]?.out_participant_id) retainedParticipants.push(i3[0].out_participant_id);
  }
} else {
  sessionId = sessData[0].out_session_id;
  const parts = Array.isArray(sessData[0].out_participants) ? sessData[0].out_participants : [];
  for (const p of parts) retainedParticipants.push(p.id);
}

// Add E if available to get cnt=4 (W2 gives host+B+C = 3 rows, need D for 4th)
const { data: preRows } = await clientA.from("nex_group_call_participant").select("id").eq("session_id", sessionId);
let preCount = preRows?.length ?? 0;
console.log(`Pre-cap-attempt count: ${preCount}`);

if (preCount < 4 && idE) {
  // Try to invite E to push to cnt=4
  const { data: ie } = await clientA.rpc("nex_invite_to_call_tx", { p_invitee_account_id: idE.nex_account_id, p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {}, p_invite_body: "atomic setup e", p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`, p_existing_session_id: sessionId });
  if (ie?.[0]?.out_participant_id) { retainedParticipants.push(ie[0].out_participant_id); preCount++; }
}

if (preCount < 4) {
  console.log(`PARTIAL: only ${preCount} rows. Need cnt=4 to trigger P0001 on 5th attempt. Insufficient identities.`);
  console.log(JSON.stringify({ verdict: "PARTIAL", classification: "PARTIAL-COVERAGE", detail: `Only ${preCount}/4 rows. Single-write atomicity cannot be fully tested without 5+ identities.`, retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] } }));
  process.exit(0);
}

// Snapshot conversation count and message count before failed call
const preConvCount = (await clientA.from("nex_peer_conversation").select("id").limit(200))?.data?.length ?? 0;
const preMsgCount = (await clientA.from("nex_peer_message").select("id").limit(200))?.data?.length ?? 0;
const preSessionCount = (await clientA.from("nex_group_call_session").select("id").limit(200))?.data?.length ?? 0;
console.log(`Snapshot: sessions=${preSessionCount} convs=${preConvCount} msgs=${preMsgCount}`);

// Attempt invite that WILL raise P0001 (cnt=4, 5th invite on existing session)
// We need a 5th nex_account_id — if we don't have one, we cannot proceed.
// Use idE if not already used as participant, otherwise report PARTIAL.
const usedAccountIds = new Set([idA, idB, idC, idD, idE].filter(Boolean).map(id => id.nex_account_id));
// Count actual participants to find which are in the session
const { data: actualParts } = await clientA.from("nex_group_call_participant").select("account_id").eq("session_id", sessionId);
const usedInSession = new Set((actualParts ?? []).map(p => p.account_id));

// Find an identity NOT in the session for the failing invite
const freeIdentity = [idB, idC, idD, idE].filter(Boolean).find(id => !usedInSession.has(id.nex_account_id));
if (!freeIdentity) {
  console.log("PARTIAL: all available identities are already in the session. Cannot attempt a cap-triggering 5th invite without a fresh nex_account_id.");
  console.log(JSON.stringify({ verdict: "PARTIAL", classification: "PARTIAL-COVERAGE", detail: "No free identity to use as 5th invite target. Need 5+ identities to exercise atomicity properly.", retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] } }));
  process.exit(0);
}

// Attempt the failing invite on existing session (p_existing_session_id = sessionId)
const { data: failData, error: failErr } = await clientA.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: freeIdentity.nex_account_id,
  p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {},
  p_invite_body: "atomic fail attempt",
  p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`,
  p_existing_session_id: sessionId,
});

const isP0001 = failErr && (failErr.code === "P0001" || /already has 4 participants/i.test(failErr.message ?? ""));

// Post-fail snapshot
const postConvCount = (await clientA.from("nex_peer_conversation").select("id").limit(200))?.data?.length ?? 0;
const postMsgCount = (await clientA.from("nex_peer_message").select("id").limit(200))?.data?.length ?? 0;
const postSessionCount = (await clientA.from("nex_group_call_session").select("id").limit(200))?.data?.length ?? 0;
console.log(`Post-fail snapshot: sessions=${postSessionCount} convs=${postConvCount} msgs=${postMsgCount}`);

const checks = [];
checks.push({ name: "cap trigger raised P0001", pass: !!isP0001 });
// No new session, conversation, or message should have been created
checks.push({ name: "no new session row (single-write atomicity on existing path)", pass: postSessionCount === preSessionCount });
checks.push({ name: "no new conversation row (rollback on cap failure)", pass: postConvCount === preConvCount });
checks.push({ name: "no new message row (rollback on cap failure)", pass: postMsgCount === preMsgCount });

for (const c of checks) console.log(`  ${c.pass ? "OK" : "FAIL"}: ${c.name}`);

const allPass = checks.every(c => c.pass);
console.log(
  "NOTE: V-ATOMIC provides single-write atomicity evidence for existing-session path only. " +
  "True mid-function fault injection (new-session path: session INSERT → participant INSERT → trigger raise) " +
  "is Case G STATE_BLOCKER — PL/pgSQL does not expose a clean fault injection point. " +
  "Case G remains UNVERIFIED after Gate A."
);
console.log(JSON.stringify({
  verdict: allPass ? "PASS" : "FAIL",
  classification: "INDIRECT-ATOMICITY-EVIDENCE",
  case_g_status: "UNVERIFIED (STATE_BLOCKER)",
  detail: checks.filter(c => !c.pass).map(c => c.name).join("; ") || "single-write atomicity confirmed for existing-session path",
  retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] },
}));
process.exit(allPass ? 0 : 1);
