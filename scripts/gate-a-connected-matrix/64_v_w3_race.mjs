#!/usr/bin/env node
// scripts/gate-a-connected-matrix/64_v_w3_race.mjs
//
// V-W3-RACE · concurrent cold-joins.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// Session with 3 rows. Two concurrent cold-join callers (D and E).
// Expected: one succeeds (cnt→4), one fails P0001 OR both succeed (if below cap).
// CRITICAL FAIL if both succeed and cnt > 4.
// Requires 5 identities (A host + B,C setup + D,E racers). PARTIAL if fewer.

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
console.log("SCENARIO: V-W3-RACE — concurrent cold-joins serialized by FOR UPDATE");

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

if (!idA || !idB || !idC || !idD || !idE) {
  const available = ["A","B","C","D","E"].filter(l => !!getOk(l));
  console.log(`PARTIAL: need 5 identities (A,B,C,D,E). Available: ${available.join(",")}`);
  console.log(JSON.stringify({ verdict: "PARTIAL", classification: "PARTIAL-COVERAGE", detail: `Race requires 5 identities. Available: ${available.join(",")}.` }));
  process.exit(0);
}

const jwtA = await signIn("A");
const jwtD = await signIn("D");
const jwtE = await signIn("E");
if (!jwtA || !jwtD || !jwtE) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "sign-in failed for A/D/E" }));
  process.exit(0);
}
const clientA = buildClient(jwtA);
const clientD = buildClient(jwtD);
const clientE = buildClient(jwtE);

// Create session with A (host) + B + C = 3 rows via W2
const { data: sessData, error: sessErr } = await clientA.rpc("nex_create_group_call_session_tx", {
  p_media_type: "audio", p_from_call_link_id: null, p_host_country: "ireland",
  p_invitee_account_ids: [idB.nex_account_id, idC.nex_account_id],
});

let sessionId;
const retainedParticipants = [];

if (sessErr || !sessData?.[0]?.out_session_id) {
  // W2 fallback via W1
  const { data: i1, error: e1 } = await clientA.rpc("nex_invite_to_call_tx", { p_invitee_account_id: idB.nex_account_id, p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {}, p_invite_body: "race3 setup", p_attachment_url: `/nex-native/call/preview?session=00000000-0000-4000-8000-000000000001&accept=1`, p_existing_session_id: null });
  if (e1 || !i1?.[0]?.out_session_id) { console.log(JSON.stringify({ verdict: "BLOCKED", detail: `setup failed: ${e1?.message}` })); process.exit(0); }
  sessionId = i1[0].out_session_id;
  retainedParticipants.push(i1[0].out_participant_id);
  const { data: i2 } = await clientA.rpc("nex_invite_to_call_tx", { p_invitee_account_id: idC.nex_account_id, p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {}, p_invite_body: "race3 setup c", p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`, p_existing_session_id: sessionId });
  if (i2?.[0]?.out_participant_id) retainedParticipants.push(i2[0].out_participant_id);
} else {
  sessionId = sessData[0].out_session_id;
  const parts = Array.isArray(sessData[0].out_participants) ? sessData[0].out_participants : [];
  for (const p of parts) retainedParticipants.push(p.id);
}

const { data: preRows } = await clientA.from("nex_group_call_participant").select("id").eq("session_id", sessionId);
console.log(`Pre-race participant count: ${preRows?.length ?? 0}`);

// Concurrent cold-joins from D and E
const [resD, resE] = await Promise.all([
  clientD.rpc("nex_join_group_call_session_tx", { p_session_id: sessionId, p_role: "guest" }),
  clientE.rpc("nex_join_group_call_session_tx", { p_session_id: sessionId, p_role: "guest" }),
]);

const dOk = !resD.error && !!resD.data?.[0]?.out_participant_id;
const eOk = !resE.error && !!resE.data?.[0]?.out_participant_id;
const dCap = resD.error && (resD.error.code === "P0001" || /already has 4 participants/i.test(resD.error.message ?? ""));
const eCap = resE.error && (resE.error.code === "P0001" || /already has 4 participants/i.test(resE.error.message ?? ""));
const dMigMissing = resD.error?.code === "42883";
const eMigMissing = resE.error?.code === "42883";

if (dMigMissing || eMigMissing) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "MIG-C not applied" }));
  process.exit(0);
}

console.log(`D: ok=${dOk} cap=${dCap} error=${resD.error?.code}`);
console.log(`E: ok=${eOk} cap=${eCap} error=${resE.error?.code}`);

if (dOk) retainedParticipants.push(resD.data[0].out_participant_id);
if (eOk) retainedParticipants.push(resE.data[0].out_participant_id);

const { data: postRows } = await clientA.from("nex_group_call_participant").select("id").eq("session_id", sessionId);
const finalCount = postRows?.length ?? 0;
console.log(`Final participant count: ${finalCount}`);

const retainedRows = { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] };

if (finalCount > 4) {
  console.error(`CRITICAL FAIL: count=${finalCount} > 4 — FOR UPDATE did not serialize`);
  console.log(JSON.stringify({ verdict: "FAIL", classification: "CRITICAL: FOR_UPDATE_NOT_SERIALIZING", detail: `Count ${finalCount} > 4`, retained_rows: retainedRows }));
  process.exit(1);
}

if (dOk && eOk && finalCount <= 4) {
  console.log("PASS: both joined and count <= 4 (session was below cap threshold for both)");
  console.log(JSON.stringify({ verdict: "PASS", classification: "CONNECTED", detail: `Both joined; final count=${finalCount} <= 4`, retained_rows: retainedRows }));
  process.exit(0);
}

if ((dOk && eCap) || (eOk && dCap)) {
  console.log("PASS: one succeeded, one raised P0001 — FOR UPDATE serialized correctly");
  console.log(JSON.stringify({ verdict: "PASS", classification: "CONNECTED", detail: `Race serialized. Final count=${finalCount}`, retained_rows: retainedRows }));
  process.exit(0);
}

console.error(`FAIL: unexpected outcome. D ok=${dOk} cap=${dCap} err=${resD.error?.code}. E ok=${eOk} cap=${eCap} err=${resE.error?.code}`);
console.log(JSON.stringify({ verdict: "FAIL", detail: `Unexpected outcome`, retained_rows: retainedRows }));
process.exit(1);
