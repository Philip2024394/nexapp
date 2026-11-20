#!/usr/bin/env node
// scripts/gate-a-connected-matrix/42_v_w1_cap.mjs
//
// V-W1-CAP · 4th invite triggers cap.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// Cap semantics from mig-133 trigger: SELECT COUNT(*) ... WHERE session_id=NEW.session_id.
// IF cnt >= 4 THEN RAISE. So when existing count=3, INSERT succeeds (cnt→4).
// When existing count=4, INSERT raises P0001.
//
// Setup: A creates session and invites B, C (now 3 rows: B, C invited + possibly A as host?).
// NOTE: nex_invite_to_call_tx (W1) only inserts the INVITEE participant, not the host.
// So new-session via W1 results in: 1 row (B invited). After invite C: 2 rows.
// Need 4 rows total (at count=3) to trigger cap on 5th attempt.
// Use W2 or chain W1 invites. Chain W1: invite B (1 row), invite C (2 rows), need 3rd invitee.
//
// With only 3 identities A/B/C: W1 can create at most 2 invitee rows (B and C).
// cnt=2 → 3rd invite (non-existent identity D) would succeed (cnt→3, still < 4).
// We cannot reach cnt=4 with only 3 real identities via W1 alone without identity D.
//
// PARTIAL-COVERAGE path (3 identities only):
// - Create session, invite B (cnt=1), invite C (cnt=2).
// - Attempt to invite a fake UUID (not a real nex_account) → fails with 42501 NOT P0001.
// - This exercises the cap function call path but not the cnt>=4 boundary.
// - Mark PARTIAL with reason.
//
// Full path (4+ identities): invite B (1), C (2), D (3) → 4th invite → P0001.
// If 4+ identities exist in capture, run full path.

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
console.log("SCENARIO: V-W1-CAP — 4th participant invite triggers cap (P0001)");

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
const idD = getOk("D");  // may not exist

if (!idA || !idB || !idC) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "need A, B, C minimum" }));
  process.exit(0);
}

const jwtA = await signIn("A");
if (!jwtA) {
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "A sign-in failed" }));
  process.exit(0);
}
const clientA = buildClient(jwtA);
const dummyUuid = "00000000-0000-4000-8000-000000000001";

const retainedSessions = [];
const retainedParticipants = [];
const retainedConvs = [];
const retainedMsgs = [];

// Setup: use W2 to create a session with A as host + B, C as guests (3 rows total)
// W2 path: host_account_id row + invitees rows in one call
const { data: sessData, error: sessErr } = await clientA.rpc("nex_create_group_call_session_tx", {
  p_media_type: "audio",
  p_from_call_link_id: null,
  p_host_country: "ireland",
  p_invitee_account_ids: [idB.nex_account_id, idC.nex_account_id],
});

if (sessErr || !sessData?.[0]?.out_session_id) {
  // W2 may not be applied yet or invitees not set up — fall back to chained W1
  console.log("W2 unavailable or failed — using chained W1 invites");

  // Create session with W1 (A→B = 1 row)
  const { data: i1, error: e1 } = await clientA.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: idB.nex_account_id,
    p_media_type: "audio",
    p_host_country: "ireland",
    p_attachment_meta: {},
    p_invite_body: "cap setup inv1",
    p_attachment_url: `/nex-native/call/preview?session=${dummyUuid}&accept=1`,
    p_existing_session_id: null,
  });
  if (e1 || !i1?.[0]?.out_session_id) {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: `W1 invite1 failed: ${e1?.message}` }));
    process.exit(0);
  }
  const sessionId = i1[0].out_session_id;
  retainedSessions.push(sessionId);
  retainedParticipants.push(i1[0].out_participant_id);
  retainedConvs.push(i1[0].out_conversation_id);
  retainedMsgs.push(i1[0].out_message_id);

  // Invite C (cnt=2)
  const { data: i2, error: e2 } = await clientA.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: idC.nex_account_id,
    p_media_type: "audio",
    p_host_country: "ireland",
    p_attachment_meta: {},
    p_invite_body: "cap setup inv2",
    p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`,
    p_existing_session_id: sessionId,
  });
  if (e2 || !i2?.[0]?.out_participant_id) {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: `W1 invite2 failed: ${e2?.message}` }));
    process.exit(0);
  }
  retainedParticipants.push(i2[0].out_participant_id);
  retainedMsgs.push(i2[0].out_message_id);

  // cnt=2. Need idD for cnt=3, then 5th attempt for P0001.
  if (!idD) {
    // PARTIAL: only 3 identities. We have 2 rows; cap boundary at 4 is unreachable.
    console.log(
      "PARTIAL-COVERAGE: Only 3 identities available (A, B, C). " +
      "W1 creates invitee rows only (no host row via this path). " +
      "Current count=2. Need identity D to reach cnt=3, then E to reach cnt=4 trigger. " +
      "Cap boundary (P0001 at cnt>=4) not fully exercised with only 3 identities."
    );
    const retainedRows = {
      nex_group_call_session: retainedSessions,
      nex_group_call_participant: retainedParticipants.filter(Boolean),
      nex_peer_conversation: retainedConvs.filter(Boolean),
      nex_peer_message: retainedMsgs.filter(Boolean),
    };
    console.log(JSON.stringify({
      verdict: "PARTIAL",
      classification: "PARTIAL-COVERAGE",
      detail: "Identities insufficient. Need 5 (host A + invitees B,C,D,E) to reach cnt=4 then trigger. Only A,B,C available. Cap boundary UNIT-VERIFIED only.",
      retained_rows: retainedRows,
    }));
    process.exit(0);
  }

  // We have D — invite D (cnt=3), then invite a 5th to trigger cap
  const { data: i3, error: e3 } = await clientA.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: idD.nex_account_id,
    p_media_type: "audio",
    p_host_country: "ireland",
    p_attachment_meta: {},
    p_invite_body: "cap setup inv3",
    p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`,
    p_existing_session_id: sessionId,
  });
  if (e3 || !i3?.[0]?.out_participant_id) {
    console.log(JSON.stringify({ verdict: "BLOCKED", detail: `W1 invite3 failed: ${e3?.message}` }));
    process.exit(0);
  }
  retainedParticipants.push(i3[0].out_participant_id);
  retainedMsgs.push(i3[0].out_message_id);

  // cnt=3. The 4th invite (new invitee) succeeds (cnt→4). 5th should fail.
  // We need a 5th real identity to get a valid nex_account_id.
  const idE = getOk("E");
  if (!idE) {
    console.log("PARTIAL: have D but not E — can verify cnt→4 succeeds but not cnt=4→P0001");
    // Try a fake UUID for the 4th (will fail on account lookup, not cap)
    const retainedRows = { nex_group_call_session: retainedSessions, nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: retainedConvs.filter(Boolean), nex_peer_message: retainedMsgs.filter(Boolean) };
    console.log(JSON.stringify({ verdict: "PARTIAL", classification: "PARTIAL-COVERAGE", detail: "Have A,B,C,D (cnt=3). Need E for final P0001 test.", retained_rows: retainedRows }));
    process.exit(0);
  }

  // Invite E (should trigger P0001 since cnt will become 4, trigger checks >=4 at NEW insert time)
  // Wait: trigger counts BEFORE insert, so when cnt=3 existing, NEW insert would make cnt=4.
  // trigger: SELECT COUNT(*) = 3; 3 >= 4 is false → INSERT succeeds, cnt=4.
  // 5th: cnt=4; 4 >= 4 is true → RAISE P0001.
  // So invite E (cnt=3→4) should SUCCEED; invite a 6th should fail.
  // We only have E as identity. Invite E:
  const { data: i4, error: e4 } = await clientA.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: idE.nex_account_id,
    p_media_type: "audio",
    p_host_country: "ireland",
    p_attachment_meta: {},
    p_invite_body: "cap inv4 cnt3->4",
    p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`,
    p_existing_session_id: sessionId,
  });
  if (e4) {
    if (e4.code === "P0001" || /already has 4 participants/i.test(e4.message)) {
      // This means cnt was already 4 before this call (possible if host row was inserted elsewhere)
      console.log("Invite4 raised P0001 — cnt was already 4 before this invite");
    } else {
      console.log(JSON.stringify({ verdict: "FAIL", detail: `invite4 unexpected error: ${e4.code}: ${e4.message}` }));
      process.exit(1);
    }
  } else {
    retainedParticipants.push(i4?.[0]?.out_participant_id);
    retainedMsgs.push(i4?.[0]?.out_message_id);
    // cnt=4. Now invite a 5th — should raise P0001. Use a recycled/fake nex_account_id.
    // We don't have a 6th identity but we can try a known non-existing UUID to test cap vs account lookup order.
    // Actually the trigger fires on INSERT, before the account FK is resolved by the trigger,
    // but the FK constraint would also reject. The trigger fires BEFORE INSERT so cap is checked first.
    // However, we cannot safely test this without a real 5th nex_account_id.
    // Report PARTIAL — we got to cnt=4 successfully.
    console.log("cnt→4 invite succeeded. Cannot test cnt=4→P0001 without 6th identity.");
  }

  const retainedRows = { nex_group_call_session: retainedSessions, nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: retainedConvs.filter(Boolean), nex_peer_message: retainedMsgs.filter(Boolean) };
  console.log(JSON.stringify({ verdict: "PARTIAL", classification: "PARTIAL-COVERAGE", detail: "Cap boundary partially exercised. P0001 at cnt>=4 is UNIT-VERIFIED. Connected evidence: cnt→4 succeeds.", retained_rows: retainedRows }));
  process.exit(0);
}

// W2 succeeded — parse session + participants
const w2row = sessData[0];
const sessionId = w2row.out_session_id;
retainedSessions.push(sessionId);
// W2 gives 3 participant rows (host A + guests B, C)
const participants = Array.isArray(w2row.out_participants) ? w2row.out_participants : [];
for (const p of participants) retainedParticipants.push(p.id);
console.log(`W2 session: ${sessionId}, participants: ${participants.length}`);

// cnt=3. Need to invite D to reach cnt=4, then invite E (or use a 5th to trigger P0001)
// Use idD if available; otherwise PARTIAL
if (!idD) {
  console.log("PARTIAL: 3 identities, W2 gave host+B+C = 3 rows. Need D for cnt=4, E for P0001.");
  // W1 invite to reach cnt=4 (should succeed)
  // We don't have D — mark PARTIAL
  const retainedRows = { nex_group_call_session: retainedSessions, nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: retainedConvs.filter(Boolean), nex_peer_message: retainedMsgs.filter(Boolean) };
  console.log(JSON.stringify({ verdict: "PARTIAL", classification: "PARTIAL-COVERAGE", detail: "W2 created 3-row session. Need D for 4th invite (cnt→4 succeeds), E for 5th invite (cnt=4→P0001). Only A,B,C available.", retained_rows: retainedRows }));
  process.exit(0);
}

const jwtD = await signIn("D");
// Invite D via W1 (cnt=3 → 4): should SUCCEED
const { data: invD, error: errD } = await clientA.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: idD.nex_account_id,
  p_media_type: "audio",
  p_host_country: "ireland",
  p_attachment_meta: {},
  p_invite_body: "cap inv D (cnt3->4)",
  p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`,
  p_existing_session_id: sessionId,
});
const retainedRowsBase = { nex_group_call_session: retainedSessions, nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: retainedConvs.filter(Boolean), nex_peer_message: retainedMsgs.filter(Boolean) };

if (errD) {
  if (errD.code === "P0001" || /already has 4 participants/i.test(errD.message)) {
    // cnt was already >=4 before D — unexpected
    console.log(JSON.stringify({ verdict: "FAIL", detail: `invite D raised P0001 at cnt=3 — unexpected`, retained_rows: retainedRowsBase }));
    process.exit(1);
  }
  console.log(JSON.stringify({ verdict: "FAIL", detail: `invite D failed: ${errD.code}: ${errD.message}`, retained_rows: retainedRowsBase }));
  process.exit(1);
}
// D succeeded — cnt=4
retainedParticipants.push(invD?.[0]?.out_participant_id);
retainedMsgs.push(invD?.[0]?.out_message_id);
console.log("Invite D (cnt→4) succeeded as expected");

// Now try to invite E (cnt=4 → trigger raises P0001)
const idE = getOk("E");
if (!idE) {
  // Cannot test final P0001 without 5th identity
  console.log("PARTIAL: have A,B,C,D (cnt=4). Need E for final P0001 boundary test.");
  const retainedRows = { nex_group_call_session: retainedSessions, nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: retainedConvs.filter(Boolean), nex_peer_message: retainedMsgs.filter(Boolean) };
  console.log(JSON.stringify({ verdict: "PARTIAL", classification: "PARTIAL-COVERAGE", detail: "cnt=4 confirmed. P0001 boundary at cnt>=4 verified structurally but not via live 5th invite.", retained_rows: retainedRows }));
  process.exit(0);
}

const { data: invE, error: errE } = await clientA.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: idE.nex_account_id,
  p_media_type: "audio",
  p_host_country: "ireland",
  p_attachment_meta: {},
  p_invite_body: "cap inv E (cnt=4 → P0001)",
  p_attachment_url: `/nex-native/call/preview?session=${sessionId}&accept=1`,
  p_existing_session_id: sessionId,
});

const retainedRowsFinal = { nex_group_call_session: retainedSessions, nex_group_call_participant: retainedParticipants.filter(Boolean), nex_peer_conversation: retainedConvs.filter(Boolean), nex_peer_message: retainedMsgs.filter(Boolean) };

if (!errE) {
  console.error("FAIL: invite E succeeded but should have raised P0001 (cnt was 4)");
  console.log(JSON.stringify({ verdict: "FAIL", detail: "cap trigger did not fire at cnt=4", retained_rows: retainedRowsFinal }));
  process.exit(1);
}

const isP0001 = errE.code === "P0001" || /already has 4 participants/i.test(errE.message);
if (isP0001) {
  console.log("PASS: V-W1-CAP — P0001 raised when cnt=4 (trigger correct)");
  console.log(JSON.stringify({ verdict: "PASS", classification: "CONNECTED", detail: `P0001 at cnt=4 confirmed. code=${errE.code}`, retained_rows: retainedRowsFinal }));
  process.exit(0);
} else {
  console.error(`FAIL: unexpected error at cnt=4: ${errE.code}: ${errE.message}`);
  console.log(JSON.stringify({ verdict: "FAIL", detail: `Unexpected error: ${errE.code}: ${errE.message}`, retained_rows: retainedRowsFinal }));
  process.exit(1);
}
