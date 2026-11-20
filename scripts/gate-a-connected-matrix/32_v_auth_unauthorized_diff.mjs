#!/usr/bin/env node
// scripts/gate-a-connected-matrix/32_v_auth_unauthorized_diff.mjs
//
// V-AUTH-UNAUTH-DIFF · session_not_owned impersonation blocked.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// Scenario:
// 1. User A creates a session by calling nex_invite_to_call_tx with
//    p_existing_session_id=NULL (new-session path). Session is now owned by A.
// 2. User B attempts to invite to A's session_id (p_existing_session_id = A's session).
// Expected: ERRCODE 42501, msg 'session_not_owned'.
//
// Setup creates scoped fixture rows — captured for cleanup.

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
if (!supabaseUrl || supabaseUrl.includes(PRODUCTION_REF)) {
  console.error("FATAL: URL missing or contains production ref"); process.exit(2);
}
const anonKey = readEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
if (!anonKey) { console.error("FATAL: anon key missing"); process.exit(2); }

console.log(`TARGET: sandbox ${CANONICAL_PROJECT_REF}`);
console.log("SCENARIO: V-AUTH-UNAUTH-DIFF — B tries to invite to A's session");

if (!existsSync(IDENTITY_CAPTURE_FILE)) {
  console.error("BLOCKED: identity capture missing");
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "identity capture missing" }));
  process.exit(0);
}
const capture = JSON.parse(readFileSync(IDENTITY_CAPTURE_FILE, "utf8"));

function getOkIdentity(label) {
  const id = capture[label];
  if (!id || id.status !== "OK" || !id.nex_account_id) return null;
  return id;
}

function buildClient(jwt) {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

async function signIn(label) {
  const id = getOkIdentity(label);
  if (!id) return null;
  const pw = process.env[`GATE_A_TEST_PASSWORD_${label}`];
  if (!pw) return null;
  const c = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: id.email, password: pw });
  if (error || !data.session) return null;
  return data.session.access_token;
}

const idA = getOkIdentity("A");
const idB = getOkIdentity("B");
if (!idA || !idB) {
  console.log("BLOCKED: need identities A and B with nex_account rows");
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "insufficient identities" }));
  process.exit(0);
}

const jwtA = await signIn("A");
const jwtB = await signIn("B");
if (!jwtA || !jwtB) {
  console.log("BLOCKED: sign-in failed for A or B");
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: "sign-in failed" }));
  process.exit(0);
}

// Step 1: A creates a session (new-session path)
const clientA = buildClient(jwtA);
const { data: sessionData, error: sessionError } = await clientA.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: idB.nex_account_id,
  p_media_type: "audio",
  p_host_country: "ireland",
  p_attachment_meta: {},
  p_invite_body: "v-auth-unauth-diff setup",
  p_attachment_url: `/nex-native/call/preview?session=00000000-0000-4000-8000-000000000001&accept=1`,
  p_existing_session_id: null,
});

if (sessionError || !Array.isArray(sessionData) || !sessionData[0]?.out_session_id) {
  console.error(`BLOCKED: A's session creation failed: ${sessionError?.message}`);
  console.log(JSON.stringify({ verdict: "BLOCKED", detail: `session creation failed: ${sessionError?.message}` }));
  process.exit(0);
}

const aSessionId = sessionData[0].out_session_id;
const aParticipantId = sessionData[0].out_participant_id;
const aConversationId = sessionData[0].out_conversation_id;
const aMessageId = sessionData[0].out_message_id;
console.log(`A's session_id: ${aSessionId}`);

// Step 2: B attempts to invite to A's session
const clientB = buildClient(jwtB);
const { data: badData, error: badError } = await clientB.rpc("nex_invite_to_call_tx", {
  p_invitee_account_id: idA.nex_account_id,
  p_media_type: "audio",
  p_host_country: "ireland",
  p_attachment_meta: {},
  p_invite_body: "b tries to hijack a's session",
  p_attachment_url: `/nex-native/call/preview?session=${aSessionId}&accept=1`,
  p_existing_session_id: aSessionId,
});

const retainedRows = {
  nex_group_call_session: [aSessionId],
  nex_group_call_participant: [aParticipantId].filter(Boolean),
  nex_peer_conversation: [aConversationId].filter(Boolean),
  nex_peer_message: [aMessageId].filter(Boolean),
};

if (badError) {
  const code = badError.code ?? "";
  const msg = badError.message ?? "";
  console.log(`B's RPC error code: ${code}`);
  console.log(`B's RPC error msg: ${msg.slice(0, 200)}`);

  const isExpected =
    code === "42501" ||
    /session_not_owned|42501/i.test(msg);

  if (isExpected) {
    console.log("PASS: V-AUTH-UNAUTH-DIFF — session_not_owned confirmed");
    console.log(JSON.stringify({
      verdict: "PASS",
      classification: "CONNECTED",
      detail: `42501 session_not_owned confirmed. code=${code}`,
      retained_rows: retainedRows,
    }));
    process.exit(0);
  } else {
    console.error(`FAIL: unexpected error code ${code}: ${msg.slice(0, 200)}`);
    console.log(JSON.stringify({
      verdict: "FAIL",
      detail: `Unexpected error code ${code}: ${msg.slice(0, 200)}`,
      retained_rows: retainedRows,
    }));
    process.exit(1);
  }
} else {
  console.error("FAIL: B successfully invited to A's session — session_not_owned guard is NOT effective");
  console.log(JSON.stringify({
    verdict: "FAIL",
    detail: "B was not rejected — impersonation guard broken",
    retained_rows: retainedRows,
  }));
  process.exit(1);
}
