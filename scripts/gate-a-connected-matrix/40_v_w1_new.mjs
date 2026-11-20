#!/usr/bin/env node
// scripts/gate-a-connected-matrix/40_v_w1_new.mjs
//
// V-W1-NEW · W1 happy path — new session + invite.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
// §16.48.25 Lane 3 revision 2026-11-20 — assertion expectations rebased
// onto RLS reality:
//   · W1 RPC (mig-357) does NOT insert a host participant row for A.
//   · nex_group_call_participant SELECT policy is `account_id IN (me)
//     OR nex_is_participant_in_session(session_id)`. For A with NO
//     participant row, both branches are false → A's JWT cannot read
//     B's participant row at all. So the B-participant assertions now
//     run under clientB (B's JWT · B's own row via account_id=me branch).
//
// A invites B (new session, p_existing_session_id=NULL).
// Expected:
//   · 5-col return: out_session_id, out_participant_id, out_conversation_id,
//     out_message_id, out_skipped NULL
//   · Session row in nex_group_call_session with state='ringing',
//     host_account_id=A (readable by A via the session's host-branch policy)
//   · Participant row for B readable via clientB (B's JWT):
//     invited_at NOT NULL, joined_at NULL, role='guest'
//   · nex_peer_conversation row (ordered pair A,B)
//   · nex_peer_message row with attachment_type='call_invite'
//
// Assertion count: 14 (was 14; semantics rebased, total unchanged).

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
console.log("SCENARIO: V-W1-NEW — A invites B, new session");

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
if (!idA || !idB) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "need A and B with nex_account" }));
  process.exit(0);
}

const jwtA = await signIn("A");
if (!jwtA) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "A sign-in failed" }));
  process.exit(0);
}
// §16.48.25 Lane 3 · B's JWT is required to read B's participant row
// under the mig-133 SELECT policy. Missing B password → BLOCKED so the
// assertions don't fail vacuously under A's JWT.
const jwtB = await signIn("B");
if (!jwtB) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "B sign-in failed (needed for participant-row read under RLS)" }));
  process.exit(0);
}

const clientA = buildClient(jwtA);
const clientB = buildClient(jwtB);

// Use dummy UUID in attachment_url for the initial call;
// the function does not validate that the URL's session matches the returned session_id.
const dummySessionUuid = "00000000-0000-4000-8000-000000000001";
const attachmentUrl = `/nex-native/call/preview?session=${dummySessionUuid}&accept=1`;

const { data, error } = await clientA.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: idB.nex_account_id,
  p_media_type: "audio",
  p_host_country: "ireland",
  p_attachment_meta: { call_type: "audio", host: idA.nex_account_id },
  p_invite_body: "v-w1-new test invite",
  p_attachment_url: attachmentUrl,
  p_existing_session_id: null,
});

if (error) {
  console.error(`FAIL: RPC error ${error.code}: ${error.message}`);
  console.log(JSON.stringify({ verdict: "FAIL", detail: `RPC error: ${error.code}: ${error.message}` }));
  process.exit(1);
}

if (!Array.isArray(data) || data.length === 0) {
  console.error("FAIL: empty rowset");
  console.log(JSON.stringify({ verdict: "FAIL", detail: "empty rowset" }));
  process.exit(1);
}

const row = data[0];
console.log(`out_session_id: ${row.out_session_id}`);
console.log(`out_participant_id: ${row.out_participant_id}`);
console.log(`out_conversation_id: ${row.out_conversation_id}`);
console.log(`out_message_id: ${row.out_message_id}`);
console.log(`out_skipped: ${row.out_skipped}`);

// Verify shape
const checks = [];
checks.push({ name: "out_session_id present", pass: !!row.out_session_id });
checks.push({ name: "out_participant_id present", pass: !!row.out_participant_id });
checks.push({ name: "out_conversation_id present", pass: !!row.out_conversation_id });
checks.push({ name: "out_message_id present", pass: !!row.out_message_id });
checks.push({ name: "out_skipped is null", pass: row.out_skipped === null || row.out_skipped === undefined });

// Verify session row
const { data: sessRows } = await clientA
  .from("nex_group_call_session")
  .select("id,state,host_account_id")
  .eq("id", row.out_session_id)
  .limit(1);
const sess = sessRows?.[0];
checks.push({ name: "session state=ringing", pass: sess?.state === "ringing" });
checks.push({ name: "session host=A", pass: sess?.host_account_id === idA.nex_account_id });

// Verify participant row for B — read under clientB because A has no
// participant row in this W1 session and the mig-133 SELECT policy
// hides B's row from A. B sees their own row via account_id=me.
const { data: partRows } = await clientB
  .from("nex_group_call_participant")
  .select("id,account_id,invited_at,joined_at,role")
  .eq("id", row.out_participant_id)
  .limit(1);
const part = partRows?.[0];
checks.push({ name: "participant account_id=B", pass: part?.account_id === idB.nex_account_id });
checks.push({ name: "participant invited_at not null", pass: !!part?.invited_at });
checks.push({ name: "participant joined_at is null", pass: !part?.joined_at });
checks.push({ name: "participant role=guest", pass: part?.role === "guest" });

// Verify peer_message
const { data: msgRows } = await clientA
  .from("nex_peer_message")
  .select("id,attachment_type,attachment_url,conversation_id")
  .eq("id", row.out_message_id)
  .limit(1);
const msg = msgRows?.[0];
checks.push({ name: "message attachment_type=call_invite", pass: msg?.attachment_type === "call_invite" });
checks.push({ name: "message attachment_url present", pass: !!msg?.attachment_url });
checks.push({ name: "message conversation_id matches", pass: msg?.conversation_id === row.out_conversation_id });

for (const c of checks) {
  console.log(`  ${c.pass ? "OK" : "FAIL"}: ${c.name}`);
}

const allPass = checks.every(c => c.pass);
const retainedRows = {
  nex_group_call_session: [row.out_session_id].filter(Boolean),
  nex_group_call_participant: [row.out_participant_id].filter(Boolean),
  nex_peer_conversation: [row.out_conversation_id].filter(Boolean),
  nex_peer_message: [row.out_message_id].filter(Boolean),
};

console.log(JSON.stringify({
  verdict: allPass ? "PASS" : "FAIL",
  classification: "CONNECTED",
  detail: `V-W1-NEW: ${checks.filter(c => !c.pass).map(c => c.name).join("; ") || "all checks passed"}`,
  session_id: row.out_session_id,
  retained_rows: retainedRows,
}));
process.exit(allPass ? 0 : 1);
