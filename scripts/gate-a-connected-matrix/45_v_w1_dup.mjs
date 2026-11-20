#!/usr/bin/env node
// scripts/gate-a-connected-matrix/45_v_w1_dup.mjs
//
// V-W1-DUP · idempotent re-invite.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// A invites B. Then A re-invites B to same session.
// Expected: second call returns out_skipped='already_invited',
// no new participant row (count stable), no new peer_message in dedup path.

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
console.log("SCENARIO: V-W1-DUP — idempotent re-invite returns out_skipped=already_invited");

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
const jwtA = await signIn("A");
if (!jwtA) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "A sign-in failed" }));
  process.exit(0);
}
const clientA = buildClient(jwtA);
const dummyUuid = "00000000-0000-4000-8000-000000000001";
const validUrl = `/nex-native/call/preview?session=${dummyUuid}&accept=1`;

// Invite 1: A → B (new session)
const { data: inv1, error: err1 } = await clientA.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: idB.nex_account_id,
  p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {},
  p_invite_body: "dup test invite1", p_attachment_url: validUrl, p_existing_session_id: null,
});
if (err1 || !inv1?.[0]?.out_session_id) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: `invite1 failed: ${err1?.message}` }));
  process.exit(0);
}
const sessionId = inv1[0].out_session_id;
const participantId1 = inv1[0].out_participant_id;
const messageId1 = inv1[0].out_message_id;
const conversationId = inv1[0].out_conversation_id;
console.log(`Session: ${sessionId}, participantId1: ${participantId1}`);

// Count participants before re-invite
const { data: partsBefore } = await clientA.from("nex_group_call_participant").select("id").eq("session_id", sessionId);
const countBefore = partsBefore?.length ?? 0;

// Count messages before re-invite
const { data: msgsBefore } = await clientA.from("nex_peer_message").select("id").eq("conversation_id", conversationId);
const msgCountBefore = msgsBefore?.length ?? 0;

// Re-invite B to same session
const { data: inv2, error: err2 } = await clientA.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: idB.nex_account_id,
  p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {},
  p_invite_body: "dup test re-invite", p_attachment_url: validUrl, p_existing_session_id: sessionId,
});
if (err2) {
  console.error(`FAIL: re-invite errored: ${err2.code}: ${err2.message}`);
  console.log(JSON.stringify({ verdict: "FAIL", detail: `re-invite error: ${err2.code}: ${err2.message}`, retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: [participantId1].filter(Boolean), nex_peer_conversation: [conversationId].filter(Boolean), nex_peer_message: [messageId1].filter(Boolean) } }));
  process.exit(1);
}

const row2 = inv2?.[0];
const checks = [];
checks.push({ name: "out_skipped='already_invited'", pass: row2?.out_skipped === "already_invited" });
checks.push({ name: "out_session_id still set", pass: row2?.out_session_id === sessionId });
// In dedup path, conversation_id and message_id should be NULL (no new message written)
checks.push({ name: "out_conversation_id null in dedup", pass: row2?.out_conversation_id == null });
checks.push({ name: "out_message_id null in dedup", pass: row2?.out_message_id == null });

// Verify participant count stable
const { data: partsAfter } = await clientA.from("nex_group_call_participant").select("id").eq("session_id", sessionId);
const countAfter = partsAfter?.length ?? 0;
checks.push({ name: "participant count stable", pass: countAfter === countBefore });

// Verify no new message row
const { data: msgsAfter } = await clientA.from("nex_peer_message").select("id").eq("conversation_id", conversationId);
const msgCountAfter = msgsAfter?.length ?? 0;
checks.push({ name: "no new peer_message in dedup path", pass: msgCountAfter === msgCountBefore });

for (const c of checks) console.log(`  ${c.pass ? "OK" : "FAIL"}: ${c.name}`);

const allPass = checks.every(c => c.pass);
console.log(JSON.stringify({
  verdict: allPass ? "PASS" : "FAIL",
  classification: "CONNECTED",
  detail: checks.filter(c => !c.pass).map(c => c.name).join("; ") || "all passed",
  retained_rows: {
    nex_group_call_session: [sessionId],
    nex_group_call_participant: [participantId1].filter(Boolean),
    nex_peer_conversation: [conversationId].filter(Boolean),
    nex_peer_message: [messageId1].filter(Boolean),
  },
}));
process.exit(allPass ? 0 : 1);
