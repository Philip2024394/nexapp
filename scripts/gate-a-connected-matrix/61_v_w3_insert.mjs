#!/usr/bin/env node
// scripts/gate-a-connected-matrix/61_v_w3_insert.mjs
//
// V-W3-INSERT · cold join (INSERT path, no pre-invite row).
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// A creates a session with no invitees (W2 with empty array).
// Then B calls W3 cold (no pre-invite row exists for B).
// Expected: out_was_update=FALSE, out_session_promoted=TRUE (ringing→live),
// new participant row for B with joined_at=NOW().
//
// W2 with empty invitee array creates session with only host row.
// If W2 not applied: fall back to chain W1 for A's session creation
// and avoid pre-inviting B.

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
console.log("SCENARIO: V-W3-INSERT — B cold-joins session with no pre-invite row");

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
const jwtB = await signIn("B");
if (!jwtA || !jwtB) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "sign-in failed" }));
  process.exit(0);
}
const clientA = buildClient(jwtA);
const clientB = buildClient(jwtB);

// Try W2 with empty invitee array to create a session with only host (A)
let sessionId;
const retainedParticipants = [];

const { data: w2data, error: w2err } = await clientA.rpc("nex_create_group_call_session_tx", {
  p_media_type: "audio",
  p_from_call_link_id: null,
  p_host_country: "ireland",
  p_invitee_account_ids: [],
});

if (w2err) {
  if (w2err.code === "42883") {
    // W2 not applied — cannot create host-only session via W1 easily
    // W1 always creates an invitee row, not just a session.
    // Fall back: create session via W1 with C as invitee (not B), so B has no row
    const idC = getOk("C");
    if (!idC) {
      console.log(JSON.stringify({ verdict: "BLOCKED", detail: "W2 not applied and no C identity for fallback" }));
      process.exit(0);
    }
    const { data: inv1, error: e1 } = await clientA.rpc("nex_invite_to_call_tx", {
      p_invitee_account_id: idC.nex_account_id,
      p_media_type: "audio", p_host_country: "ireland", p_attachment_meta: {},
      p_invite_body: "w3 insert fallback setup",
      p_attachment_url: `/nex-native/call/preview?session=00000000-0000-4000-8000-000000000001&accept=1`,
      p_existing_session_id: null,
    });
    if (e1 || !inv1?.[0]?.out_session_id) {
      console.log(JSON.stringify({ verdict: "BLOCKED", detail: `fallback W1 failed: ${e1?.message}` }));
      process.exit(0);
    }
    sessionId = inv1[0].out_session_id;
    retainedParticipants.push(inv1[0].out_participant_id);
    console.log(`Fallback: session ${sessionId} has C as invitee, B has no row`);
  } else {
    console.log(JSON.stringify({ verdict: "FAIL", detail: `W2 error: ${w2err.code}: ${w2err.message}` }));
    process.exit(1);
  }
} else {
  sessionId = w2data?.[0]?.out_session_id;
  const participants = Array.isArray(w2data?.[0]?.out_participants) ? w2data[0].out_participants : [];
  for (const p of participants) retainedParticipants.push(p.id);
  console.log(`W2 session ${sessionId} with ${participants.length} participants (host only if empty array)`);
}

if (!sessionId) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "no session_id obtained" }));
  process.exit(0);
}

// Verify B has no participant row for this session
const { data: preBRows } = await clientA.from("nex_group_call_participant").select("id").eq("session_id", sessionId).eq("account_id", idB.nex_account_id);
if (preBRows && preBRows.length > 0) {
  console.log("NOTE: B already has a participant row — using this session won't exercise INSERT path cleanly");
  console.log("Proceeding anyway — W3 will use UPDATE path, not INSERT");
}

// B cold-joins via W3
const { data: joinData, error: joinErr } = await clientB.rpc("nex_join_group_call_session_tx", {
  p_session_id: sessionId,
  p_role: "guest",
});

if (joinErr) {
  if (joinErr.code === "42883") {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: "MIG-C not applied" }));
    process.exit(0);
  }
  console.error(`FAIL: W3 error: ${joinErr.code}: ${joinErr.message}`);
  console.log(JSON.stringify({ verdict: "FAIL", detail: `W3 error: ${joinErr.code}: ${joinErr.message}`, retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] } }));
  process.exit(1);
}

const row = joinData?.[0];
const checks = [];
// If B had no pre-invite row, was_update should be FALSE
const hadPreInvite = preBRows && preBRows.length > 0;
if (hadPreInvite) {
  checks.push({ name: "out_was_update=TRUE (pre-invited via fallback)", pass: row?.out_was_update === true });
  console.log("NOTE: B had pre-invite row — test degrades to UPDATE path");
} else {
  checks.push({ name: "out_was_update=FALSE (cold insert)", pass: row?.out_was_update === false });
}
checks.push({ name: "out_session_promoted=TRUE (ringing→live)", pass: row?.out_session_promoted === true });
checks.push({ name: "out_participant_id present", pass: !!row?.out_participant_id });

// Verify new participant row for B
const { data: bPart } = await clientB.from("nex_group_call_participant").select("joined_at,left_at,role").eq("id", row?.out_participant_id).limit(1);
const bRow = bPart?.[0];
checks.push({ name: "B joined_at set", pass: !!bRow?.joined_at });
checks.push({ name: "B left_at null", pass: !bRow?.left_at });

// Verify session live
const { data: sessRows } = await clientA.from("nex_group_call_session").select("state").eq("id", sessionId).limit(1);
checks.push({ name: "session state=live", pass: sessRows?.[0]?.state === "live" });

for (const c of checks) console.log(`  ${c.pass ? "OK" : "FAIL"}: ${c.name}`);
retainedParticipants.push(row?.out_participant_id);

const allPass = checks.every(c => c.pass);
console.log(JSON.stringify({
  verdict: allPass ? "PASS" : "FAIL",
  classification: "CONNECTED",
  detail: checks.filter(c => !c.pass).map(c => c.name).join("; ") || "all passed",
  retained_rows: { nex_group_call_session: [sessionId], nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: [], nex_peer_message: [] },
}));
process.exit(allPass ? 0 : 1);
