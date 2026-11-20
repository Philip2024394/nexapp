#!/usr/bin/env node
// scripts/gate-a-connected-matrix/66_v_w3_nopromote.mjs
//
// V-W3-NOPROMOTE · session already live, out_session_promoted=FALSE.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// Setup: run V-W3-PROMOTE first (session goes live). Then a 3rd joiner (C)
// calls W3. Expected: out_session_promoted=FALSE, state unchanged (live).

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
console.log("SCENARIO: V-W3-NOPROMOTE — session already live, 2nd join does not re-promote");

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
const jwtB = await signIn("B");
const jwtC = await signIn("C");
if (!jwtA || !jwtB || !jwtC) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "sign-in failed" }));
  process.exit(0);
}
const clientA = buildClient(jwtA);
const clientB = buildClient(jwtB);
const clientC = buildClient(jwtC);

// Setup: create session + invite B + invite C
const { data: inv1, error: e1 } = await clientA.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: idB.nex_account_id,
  p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {},
  p_invite_body: "nopromote setup", p_attachment_url: `/nex-native/call/preview?session=00000000-0000-4000-8000-000000000001&accept=1`,
  p_existing_session_id: null,
});
if (e1 || !inv1?.[0]?.out_session_id) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: `setup failed: ${e1?.message}` }));
  process.exit(0);
}
const sessionId = inv1[0].out_session_id;

const { data: inv2 } = await clientA.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: idC.nex_account_id,
  p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {},
  p_invite_body: "nopromote setup c",
  p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`,
  p_existing_session_id: sessionId,
});

// B joins → promotes session to live
const { data: joinB, error: joinBErr } = await clientB.rpc("nex_join_group_call_session_tx", {
  p_session_id: sessionId, p_role: "guest",
});
if (joinBErr) {
  if (joinBErr.code === "42883") { console.log(JSON.stringify({ verdict: "BLOCKED", detail: "MIG-C not applied" })); process.exit(0); }
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: `B join failed: ${joinBErr.message}` }));
  process.exit(0);
}
console.log(`B joined. promoted=${joinB?.[0]?.out_session_promoted}`);

// Verify session is now live
const { data: mid } = await clientA.from("nex_group_call_session").select("state").eq("id", sessionId).limit(1);
if (mid?.[0]?.state !== "live") {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: `Session not in live state after B join: ${mid?.[0]?.state}` }));
  process.exit(0);
}

// C joins → should NOT promote (already live)
const { data: joinC, error: joinCErr } = await clientC.rpc("nex_join_group_call_session_tx", {
  p_session_id: sessionId, p_role: "guest",
});
if (joinCErr) {
  console.log(JSON.stringify({ verdict: "FAIL", detail: `C join failed: ${joinCErr.code}: ${joinCErr.message}` }));
  process.exit(1);
}

const rowC = joinC?.[0];
const checks = [];
checks.push({ name: "C out_session_promoted=FALSE", pass: rowC?.out_session_promoted === false });
const { data: post } = await clientA.from("nex_group_call_session").select("state").eq("id", sessionId).limit(1);
checks.push({ name: "session state still live", pass: post?.[0]?.state === "live" });

for (const c of checks) console.log(`  ${c.pass ? "OK" : "FAIL"}: ${c.name}`);

const allParts = [inv1[0].out_participant_id, inv2?.[0]?.out_participant_id, joinB?.[0]?.out_participant_id, rowC?.out_participant_id].filter(Boolean);
const allMsgs = [inv1[0].out_message_id, inv2?.[0]?.out_message_id].filter(Boolean);
const allConvs = [inv1[0].out_conversation_id, inv2?.[0]?.out_conversation_id].filter((v, i, a) => v && a.indexOf(v) === i);

const allPass = checks.every(c => c.pass);
console.log(JSON.stringify({
  verdict: allPass ? "PASS" : "FAIL",
  classification: "CONNECTED",
  detail: checks.filter(c => !c.pass).map(c => c.name).join("; ") || "all passed",
  retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: allParts, nex_peer_conversation: allConvs, nex_peer_message: allMsgs },
}));
process.exit(allPass ? 0 : 1);
