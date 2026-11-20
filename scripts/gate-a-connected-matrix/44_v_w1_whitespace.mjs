#!/usr/bin/env node
// scripts/gate-a-connected-matrix/44_v_w1_whitespace.mjs
//
// V-W1-WS · whitespace-guard enforcement.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// Part 1: attachment_url with trailing tab → expect 22023
// Part 2: correctly-formed URL → expect success
// Verifies the POSIX ERE: ^/nex-native/call/preview\?session=[0-9a-f-]{36}&accept=1$

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
console.log("SCENARIO: V-W1-WS — whitespace and malformed URL rejection");

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

const validUuid = "00000000-0000-4000-8000-000000000001";
const validUrl = `/nex-native/call/preview?session=${validUuid}&accept=1`;
const baseParams = {
  p_invitee_account_id: idB.nex_account_id,
  p_media_type: "audio",
  p_host_country: "ireland",
  p_attachment_meta: {},
  p_invite_body: "whitespace test",
  p_existing_session_id: null,
};

const checks = [];

// Test 1: trailing tab
{
  const urlWithTab = `${validUrl}\t`;
  const { data, error } = await clientA.rpc("nex_invite_to_call_tx", {
    ...baseParams,
    p_attachment_url: urlWithTab,
  });
  const is22023 = error && (error.code === "22023" || /attachment_url_required|22023/i.test(error.message ?? ""));
  checks.push({ name: "trailing tab → 22023", pass: !!is22023, detail: `code=${error?.code} msg=${error?.message?.slice(0, 100)}` });
}

// Test 2: trailing newline
{
  const urlWithLF = `${validUrl}\n`;
  const { data, error } = await clientA.rpc("nex_invite_to_call_tx", {
    ...baseParams,
    p_attachment_url: urlWithLF,
  });
  const is22023 = error && (error.code === "22023" || /attachment_url_required|22023/i.test(error.message ?? ""));
  checks.push({ name: "trailing newline → 22023", pass: !!is22023, detail: `code=${error?.code}` });
}

// Test 3: leading space
{
  const { data, error } = await clientA.rpc("nex_invite_to_call_tx", {
    ...baseParams,
    p_attachment_url: ` ${validUrl}`,
  });
  const is22023 = error && (error.code === "22023" || /attachment_url_required|22023/i.test(error.message ?? ""));
  checks.push({ name: "leading space → 22023", pass: !!is22023, detail: `code=${error?.code}` });
}

// Test 4: wrong path
{
  const { data, error } = await clientA.rpc("nex_invite_to_call_tx", {
    ...baseParams,
    p_attachment_url: `/wrong-path?session=${validUuid}&accept=1`,
  });
  const is22023 = error && (error.code === "22023" || /attachment_url_required|22023/i.test(error.message ?? ""));
  checks.push({ name: "wrong path → 22023", pass: !!is22023, detail: `code=${error?.code}` });
}

// Test 5: missing accept=1
{
  const { data, error } = await clientA.rpc("nex_invite_to_call_tx", {
    ...baseParams,
    p_attachment_url: `/nex-native/call/preview?session=${validUuid}`,
  });
  const is22023 = error && (error.code === "22023" || /attachment_url_required|22023/i.test(error.message ?? ""));
  checks.push({ name: "missing &accept=1 → 22023", pass: !!is22023, detail: `code=${error?.code}` });
}

// Test 6: NULL url
{
  const { data, error } = await clientA.rpc("nex_invite_to_call_tx", {
    ...baseParams,
    p_attachment_url: null,
  });
  const is22023 = error && (error.code === "22023" || /attachment_url_required|22023/i.test(error.message ?? ""));
  checks.push({ name: "null url → 22023", pass: !!is22023, detail: `code=${error?.code}` });
}

// Test 7: valid URL → success (new session created as side effect)
const retainedRows = { nex_group_call_session: [], nex_group_call_participant: [], nex_peer_conversation: [], nex_peer_message: [] };
{
  const { data, error } = await clientA.rpc("nex_invite_to_call_tx", {
    ...baseParams,
    p_attachment_url: validUrl,
  });
  if (error) {
    checks.push({ name: "valid URL → success", pass: false, detail: `error: ${error.code}: ${error.message?.slice(0, 100)}` });
  } else {
    const row = data?.[0];
    checks.push({ name: "valid URL → success", pass: !!(row?.out_session_id && row?.out_participant_id) });
    if (row?.out_session_id) retainedRows.nex_group_call_session.push(row.out_session_id);
    if (row?.out_participant_id) retainedRows.nex_group_call_participant.push(row.out_participant_id);
    if (row?.out_conversation_id) retainedRows.nex_peer_conversation.push(row.out_conversation_id);
    if (row?.out_message_id) retainedRows.nex_peer_message.push(row.out_message_id);
  }
}

for (const c of checks) console.log(`  ${c.pass ? "OK" : "FAIL"}: ${c.name}${c.detail ? " — " + c.detail : ""}`);

const allPass = checks.every(c => c.pass);
console.log(JSON.stringify({
  verdict: allPass ? "PASS" : "FAIL",
  classification: "CONNECTED",
  detail: checks.filter(c => !c.pass).map(c => c.name).join("; ") || "all checks passed",
  retained_rows: retainedRows,
}));
process.exit(allPass ? 0 : 1);
