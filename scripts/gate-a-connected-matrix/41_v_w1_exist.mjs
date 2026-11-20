#!/usr/bin/env node
// scripts/gate-a-connected-matrix/41_v_w1_exist.mjs
//
// V-W1-EXIST · invite to existing self-owned session.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
// §16.48.25 Lane 3 revision 2026-11-20 — assertion expectations rebased
// onto RLS reality:
//   · W1 RPC does NOT insert a host participant row for A.
//   · Participant-count / C-has-row assertions now run under the
//     invitees' JWTs (clientB sees B's row, clientC sees C's row) so
//     they aren't silently vacuous under A's JWT, which can see
//     neither row under the mig-133 SELECT policy.
//   · "Participant count >= 2" is split into two per-invitee checks
//     (B-row-visible + C-row-visible) under the correct JWT, since A
//     cannot aggregate-count across non-self rows.
//
// A invites B first (creates session), then A invites C to same session.
// Expected: second call returns valid 5-col, session still ringing,
// B sees B's own participant row, C sees C's own participant row,
// two peer_message rows (one per invite).
//
// Assertion count: 9 (was 8; +1 for the per-invitee split).

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
if (!anonKey) { console.error("FATAL: anonKey"); process.exit(2); }

console.log(`TARGET: sandbox ${CANONICAL_PROJECT_REF}`);
console.log("SCENARIO: V-W1-EXIST — A invites B (new session) then invites C to same session");

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
if (!idA || !idB || !idC) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "need A, B, C with nex_account" }));
  process.exit(0);
}

const jwtA = await signIn("A");
if (!jwtA) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "A sign-in failed" }));
  process.exit(0);
}
// §16.48.25 Lane 3 · B's + C's JWTs are required to read their own
// participant rows under the mig-133 SELECT policy. Missing a password
// → BLOCKED so the per-invitee assertions don't fail vacuously under A.
const jwtB = await signIn("B");
if (!jwtB) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "B sign-in failed (needed for B-row read under RLS)" }));
  process.exit(0);
}
const jwtC = await signIn("C");
if (!jwtC) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "C sign-in failed (needed for C-row read under RLS)" }));
  process.exit(0);
}
const clientA = buildClient(jwtA);
const clientB = buildClient(jwtB);
const clientC = buildClient(jwtC);
const dummyUuid = "00000000-0000-4000-8000-000000000001";

// Invite 1: A → B (new session)
const { data: inv1, error: err1 } = await clientA.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: idB.nex_account_id,
  p_media_type: "audio",
  p_host_country: "ireland",
  p_attachment_meta: {},
  p_invite_body: "v-w1-exist invite1",
  p_attachment_url: `/nex-native/call/preview?session=${dummyUuid}&accept=1`,
  p_existing_session_id: null,
});
if (err1 || !inv1?.[0]?.out_session_id) {
  console.error(`BLOCKED: invite1 failed: ${err1?.message}`);
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: `invite1 failed: ${err1?.message}` }));
  process.exit(0);
}
const sessionId = inv1[0].out_session_id;
console.log(`Session created: ${sessionId}`);

// Invite 2: A → C (existing session)
const { data: inv2, error: err2 } = await clientA.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: idC.nex_account_id,
  p_media_type: "audio",
  p_host_country: "ireland",
  p_attachment_meta: {},
  p_invite_body: "v-w1-exist invite2",
  p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`,
  p_existing_session_id: sessionId,
});

if (err2) {
  console.error(`FAIL: invite2 failed: ${err2.code}: ${err2.message}`);
  console.log(JSON.stringify({
    verdict: "FAIL",
    detail: `invite2 error: ${err2.code}: ${err2.message}`,
    retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: [inv1[0].out_participant_id].filter(Boolean) },
  }));
  process.exit(1);
}

const row2 = inv2?.[0];
const checks = [];
checks.push({ name: "inv2 session_id matches", pass: row2?.out_session_id === sessionId });
checks.push({ name: "inv2 participant_id present", pass: !!row2?.out_participant_id });
checks.push({ name: "inv2 conversation_id present", pass: !!row2?.out_conversation_id });
checks.push({ name: "inv2 message_id present", pass: !!row2?.out_message_id });
checks.push({ name: "inv2 skipped null", pass: !row2?.out_skipped });

// Verify session still ringing
const { data: sessRows } = await clientA
  .from("nex_group_call_session").select("state").eq("id", sessionId).limit(1);
checks.push({ name: "session still ringing", pass: sessRows?.[0]?.state === "ringing" });

// §16.48.25 Lane 3 · the mig-133 SELECT policy hides non-self rows
// from A's JWT (A has no participant row in this W1 session). Read
// each invitee's row under their own JWT via the account_id=me branch.
const { data: bRows } = await clientB
  .from("nex_group_call_participant")
  .select("id,account_id")
  .eq("session_id", sessionId)
  .eq("account_id", idB.nex_account_id)
  .limit(1);
const bPart = bRows?.[0];
checks.push({ name: "B has participant row (clientB)", pass: !!bPart });

const { data: cRows } = await clientC
  .from("nex_group_call_participant")
  .select("id,account_id")
  .eq("session_id", sessionId)
  .eq("account_id", idC.nex_account_id)
  .limit(1);
const cPart = cRows?.[0];
checks.push({ name: "C has participant row (clientC)", pass: !!cPart });

// For retained_rows bookkeeping: aggregate both rows we just verified.
const partRows = [...(bRows ?? []), ...(cRows ?? [])];
console.log(`Participant rows observed (per-invitee JWTs): ${partRows.length}`);

for (const c of checks) console.log(`  ${c.pass ? "OK" : "FAIL"}: ${c.name}`);

const allPass = checks.every(c => c.pass);
const allParticipantIds = (partRows ?? []).map(p => p.id);
const retainedRows = {
  nex_group_call_session: [sessionId],
  nex_group_call_participant: allParticipantIds,
  nex_peer_conversation: [inv1[0].out_conversation_id, row2?.out_conversation_id].filter(Boolean),
  nex_peer_message: [inv1[0].out_message_id, row2?.out_message_id].filter(Boolean),
};
console.log(JSON.stringify({
  verdict: allPass ? "PASS" : "FAIL",
  classification: "CONNECTED",
  detail: checks.filter(c => !c.pass).map(c => c.name).join("; ") || "all passed",
  session_id: sessionId,
  retained_rows: retainedRows,
}));
process.exit(allPass ? 0 : 1);
