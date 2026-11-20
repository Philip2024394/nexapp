#!/usr/bin/env node
// scripts/gate-a-connected-matrix/65_v_w3_promote.mjs
//
// V-W3-PROMOTE · session ringing→live.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// Session in state='ringing'. W3 called by B. out_session_promoted=TRUE, state=live.

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
console.log("SCENARIO: V-W3-PROMOTE — session promoted ringing→live on first join");

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
if (!idA || !idB) { console.log(JSON.stringify({ verdict: "BLOCKED", detail: "need A, B" })); process.exit(0); }
const jwtA = await signIn("A");
const jwtB = await signIn("B");
if (!jwtA || !jwtB) { console.log(JSON.stringify({ verdict: "BLOCKED", detail: "sign-in failed" })); process.exit(0); }
const clientA = buildClient(jwtA);
const clientB = buildClient(jwtB);

// Create ringing session
const { data: inv, error: invErr } = await clientA.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: idB.nex_account_id,
  p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {},
  p_invite_body: "promote test",
  p_attachment_url: `/nex-native/call/preview?session=00000000-0000-4000-8000-000000000001&accept=1`,
  p_existing_session_id: null,
});
if (invErr || !inv?.[0]?.out_session_id) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: `setup failed: ${invErr?.message}` }));
  process.exit(0);
}
const sessionId = inv[0].out_session_id;
const participantId = inv[0].out_participant_id;

// Verify ringing
const { data: pre } = await clientA.from("nex_group_call_session").select("state").eq("id", sessionId).limit(1);
console.log(`Pre-join state: ${pre?.[0]?.state}`);

// B joins
const { data: joinData, error: joinErr } = await clientB.rpc("nex_join_group_call_session_tx", {
  p_session_id: sessionId, p_role: "guest",
});
if (joinErr) {
  if (joinErr.code === "42883") { console.log(JSON.stringify({ verdict: "BLOCKED", detail: "MIG-C not applied" })); process.exit(0); }
  console.log(JSON.stringify({ verdict: "FAIL", detail: `W3 error: ${joinErr.code}: ${joinErr.message}`, retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: [participantId].filter(Boolean), nex_peer_conversation: [inv[0].out_conversation_id].filter(Boolean), nex_peer_message: [inv[0].out_message_id].filter(Boolean) } }));
  process.exit(1);
}

const row = joinData?.[0];
const checks = [];
checks.push({ name: "out_session_promoted=TRUE", pass: row?.out_session_promoted === true });

const { data: post } = await clientA.from("nex_group_call_session").select("state,live_at").eq("id", sessionId).limit(1);
checks.push({ name: "session state=live", pass: post?.[0]?.state === "live" });
checks.push({ name: "live_at set", pass: !!post?.[0]?.live_at });

for (const c of checks) console.log(`  ${c.pass ? "OK" : "FAIL"}: ${c.name}`);
const allPass = checks.every(c => c.pass);
console.log(JSON.stringify({
  verdict: allPass ? "PASS" : "FAIL",
  classification: "CONNECTED",
  detail: checks.filter(c => !c.pass).map(c => c.name).join("; ") || "all passed",
  retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: [participantId, row?.out_participant_id].filter(Boolean), nex_peer_conversation: [inv[0].out_conversation_id].filter(Boolean), nex_peer_message: [inv[0].out_message_id].filter(Boolean) },
}));
process.exit(allPass ? 0 : 1);
