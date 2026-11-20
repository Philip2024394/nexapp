#!/usr/bin/env node
// scripts/gate-a-connected-matrix/50_v_w2_ok.mjs
//
// V-W2-OK · W2 happy path — session create with invitees.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// A calls nex_create_group_call_session_tx with B and C as invitees.
// Expected:
//   · 1 session row state='ringing'
//   · Host participant (A) with role='host', joined_at=NOW()
//   · Guest participants (B, C) with role='guest', joined_at NULL
//   · out_rejected_count=0

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
console.log("SCENARIO: V-W2-OK — session create with 2 invitees");

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
if (!jwtA) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "A sign-in failed" }));
  process.exit(0);
}
const clientA = buildClient(jwtA);

const { data, error } = await clientA.rpc("nex_create_group_call_session_tx", {
  p_media_type: "video",
  p_from_call_link_id: null,
  p_host_country: "ireland",
  p_invitee_account_ids: [idB.nex_account_id, idC.nex_account_id],
});

if (error) {
  if (error.code === "42883" || /function.*does not exist/i.test(error.message ?? "")) {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: "nex_create_group_call_session_tx not found — MIG-B not applied" }));
    process.exit(0);
  }
  console.error(`FAIL: W2 RPC error ${error.code}: ${error.message}`);
  console.log(JSON.stringify({ verdict: "FAIL", detail: `RPC error: ${error.code}: ${error.message}` }));
  process.exit(1);
}

if (!Array.isArray(data) || !data[0]) {
  console.log(JSON.stringify({ verdict: "FAIL", detail: "empty rowset" }));
  process.exit(1);
}

const row = data[0];
console.log(`out_session_id: ${row.out_session_id}`);
console.log(`out_rejected_count: ${row.out_rejected_count}`);
const participants = Array.isArray(row.out_participants) ? row.out_participants : [];
console.log(`participants returned: ${participants.length}`);

const checks = [];
checks.push({ name: "out_session_id present", pass: !!row.out_session_id });
checks.push({ name: "out_rejected_count=0", pass: row.out_rejected_count === 0 });
checks.push({ name: "4 participant rows returned (host+B+C = 3? Wait: B+C=2+host=1=3, not 4)", pass: participants.length === 3 });

// Verify host (A) participant
const hostPart = participants.find(p => p.account_id === idA.nex_account_id);
checks.push({ name: "host (A) participant present", pass: !!hostPart });
checks.push({ name: "host role=host", pass: hostPart?.role === "host" });
checks.push({ name: "host joined_at set", pass: !!hostPart?.joined_at });

// Verify guest B
const bPart = participants.find(p => p.account_id === idB.nex_account_id);
checks.push({ name: "guest B participant present", pass: !!bPart });
checks.push({ name: "guest B role=guest", pass: bPart?.role === "guest" });
checks.push({ name: "guest B joined_at null", pass: !bPart?.joined_at });

// Verify guest C
const cPart = participants.find(p => p.account_id === idC.nex_account_id);
checks.push({ name: "guest C participant present", pass: !!cPart });
checks.push({ name: "guest C role=guest", pass: cPart?.role === "guest" });
checks.push({ name: "guest C joined_at null", pass: !cPart?.joined_at });

// Verify session state from DB
const { data: sessRows } = await clientA.from("nex_group_call_session").select("state").eq("id", row.out_session_id).limit(1);
checks.push({ name: "session state=ringing", pass: sessRows?.[0]?.state === "ringing" });

for (const c of checks) console.log(`  ${c.pass ? "OK" : "FAIL"}: ${c.name}`);

const allPass = checks.every(c => c.pass);
const retainedParticipants = participants.map(p => p.id).filter(Boolean);
console.log(JSON.stringify({
  verdict: allPass ? "PASS" : "FAIL",
  classification: "CONNECTED",
  detail: checks.filter(c => !c.pass).map(c => c.name).join("; ") || "all passed",
  session_id: row.out_session_id,
  retained_rows: {
    nex_group_call_session: [row.out_session_id],
    nex_group_call_participant: retainedParticipants,
    nex_peer_conversation: [],
    nex_peer_message: [],
  },
}));
process.exit(allPass ? 0 : 1);
