// Lane G · mig-356 authenticated-RPC battery · sandbox kdstoyyeygcopkogqsyv only.
// Cases:
//   A · anonymous RPC denial at the privilege boundary
//   B · NULL auth.uid() body guard · expected UNVERIFIED (grants are authenticated-only;
//        exercising the body with NULL auth.uid() would require weakening controls)
//   C · cross-account / supplied-identity mismatch · INAPPLICABLE for new signature
//        (no supplied-identity parameter exists; auth.uid() is the only identity source)
//   D · NULL / blank / whitespace p_attachment_url rejected pre-write
//   E · valid authenticated invite · persisted session + participant + conversation + message
//        with both attachment_type='call_invite' AND attachment_url populated
//   F · dedup retry convergence + bounded concurrent retries
//   G · bounded intermediate-write fault/rollback · STATE_BLOCKER
//        (no safe authorised mid-chain fault available without weakening controls;
//         prior §16.39.5 natural CHECK-violation evidence retained as partial rollback)
//
// Does NOT: change grants · install triggers · forge auth claims · touch prod ref.
// Reads fixtures from tmp-lane-g/fixtures-356.json captured 2026-11-19.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const envRaw = readFileSync("C:/Users/Victus/nexapp/.env.local", "utf8");
function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v || null;
}
const url = envValue("SANDBOX_SUPABASE_URL");
const anonKey = envValue("SANDBOX_SUPABASE_ANON_KEY");
const dbUrl = envValue("SANDBOX_DATABASE_URL");
if (!url || !url.includes("kdstoyyeygcopkogqsyv") || url.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("STOP · bad url ref");
if (!dbUrl || !dbUrl.includes("kdstoyyeygcopkogqsyv") || dbUrl.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("STOP · bad db ref");
if (!anonKey) throw new Error("STOP · SANDBOX_SUPABASE_ANON_KEY missing");

const fixtures = JSON.parse(readFileSync("C:/Users/Victus/nexapp/tmp-lane-g/fixtures-356.json", "utf8"));
const A = fixtures[0];
const B = fixtures[1];
console.log("Fixture A:", A.email, "nex_account_id=", A.nex_account_id);
console.log("Fixture B:", B.email, "nex_account_id=", B.nex_account_id);

const results = [];
function record(id, verdict, detail) {
  results.push({ case: id, verdict, detail });
  console.log(`\n=== CASE ${id} · ${verdict} ===`);
  console.log(detail);
}

function newAnonClient() {
  return createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function signInAs(user) {
  const c = newAnonClient();
  const { data, error } = await c.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`sign-in failed for ${user.email}: ${error.message}`);
  return { client: c, session: data.session };
}

// ─────────────────────────────────────────────────────────────────
// CASE A · anonymous RPC denial at the privilege boundary
// ─────────────────────────────────────────────────────────────────
{
  const anon = newAnonClient();
  const { data, error } = await anon.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: B.nex_account_id,
    p_media_type: "audio",
    p_host_country: "ireland",
    p_attachment_meta: { probe: "anon-case-a" },
    p_invite_body: "lane-g case A probe",
    p_attachment_url: "/nex-native/call/preview?session=00000000-0000-0000-0000-000000000000&accept=1",
    p_existing_session_id: null,
  });
  if (error && (String(error.code) === "42501" || /permission denied/i.test(error.message))) {
    record("A", "PASS", `anon RPC denied at permission boundary · code=${error.code} msg=${error.message}`);
  } else if (error) {
    record("A", "FAIL", `anon RPC rejected but not at permission boundary · code=${error.code} msg=${error.message}`);
  } else {
    record("A", "FAIL", `anon RPC unexpectedly succeeded · data=${JSON.stringify(data)}`);
  }
}

// ─────────────────────────────────────────────────────────────────
// CASE B · NULL auth.uid() body guard · UNVERIFIED (as directive permits)
// ─────────────────────────────────────────────────────────────────
record(
  "B",
  "UNVERIFIED",
  [
    "Grants are authenticated-only (REVOKE anon, REVOKE service_role, GRANT authenticated).",
    "Exercising the `IF v_caller_sb_user_id IS NULL` body guard requires an authenticated-grant caller",
    "with NULL auth.uid(), which does not occur in Supabase runtime without weakening controls",
    "(forged JWT, fake claim, or grant to a role with no auth.uid()).  The directive forbids all three.",
    "Evidence tier: SOURCE_INSPECTED · mig-356 lines 176-180:",
    "  v_caller_sb_user_id := auth.uid();",
    "  IF v_caller_sb_user_id IS NULL THEN",
    "    RAISE EXCEPTION 'caller_identity_required · auth.uid() is NULL' USING ERRCODE = '42501';",
    "Permission-boundary denial (case A) does NOT independently prove the body guard executed.",
  ].join("\n"),
);

// ─────────────────────────────────────────────────────────────────
// CASE C · cross-account / supplied-identity mismatch · INAPPLICABLE
// ─────────────────────────────────────────────────────────────────
record(
  "C",
  "INAPPLICABLE",
  [
    "The new signature nex_invite_to_call_tx(p_invitee_account_id, p_media_type, p_host_country,",
    "p_attachment_meta, p_invite_body, p_attachment_url, p_existing_session_id) contains NO",
    "supplied-identity parameter (p_self_supabase_user_id was removed at DROP of the mig-353",
    "7-param signature).  Identity is derived from auth.uid() ONLY.",
    "A supplied-identity mismatch test is therefore structurally impossible against the new RPC",
    "without re-adding a supplied-identity parameter (prohibited · no wrapper/signature change).",
    "Session-ownership negative IS available: p_existing_session_id owned by someone else",
    "raises 'session_not_owned' (ERRCODE 42501) at mig-356 line 224.  That is exercised",
    "under case E as a targeted sub-assertion once we have A's own session to compare against.",
  ].join("\n"),
);

// ─────────────────────────────────────────────────────────────────
// Sign in once as A for cases D, E, F, and the C sub-assertion.
// ─────────────────────────────────────────────────────────────────
const A_session = await signInAs(A);
const asA = A_session.client;

// ─────────────────────────────────────────────────────────────────
// CASE D · NULL / blank / whitespace p_attachment_url rejected
// ─────────────────────────────────────────────────────────────────
{
  const sub = [];
  for (const [label, p_attachment_url] of [
    ["null", null],
    ["empty-string", ""],
    ["whitespace-only", "   "],
    ["tab-newline", "\t\n"],
  ]) {
    const { data, error } = await asA.rpc("nex_invite_to_call_tx", {
      p_invitee_account_id: B.nex_account_id,
      p_media_type: "audio",
      p_host_country: "ireland",
      p_attachment_meta: { probe: "case-d-" + label },
      p_invite_body: "lane-g case D probe",
      p_attachment_url,
      p_existing_session_id: null,
    });
    if (error && /attachment_url_required/.test(error.message)) {
      sub.push({ label, result: "PASS", code: error.code, msg: error.message });
    } else if (error) {
      sub.push({ label, result: "WRONG_ERROR", code: error.code, msg: error.message });
    } else {
      sub.push({ label, result: "FAIL_ACCEPTED", data: JSON.stringify(data) });
    }
  }
  const allPass = sub.every(s => s.result === "PASS");
  record("D", allPass ? "PASS" : "FAIL", "sub-cases:\n" + sub.map(s => JSON.stringify(s)).join("\n"));
  // Verify no attributable partial writes from any of the 4 sub-cases:
  const pg = new Client({ connectionString: dbUrl });
  await pg.connect();
  const probeRows = await pg.query(
    `SELECT id, attachment_meta FROM nex_peer_message
      WHERE sender_account_id = $1
        AND attachment_meta ? 'probe'
        AND attachment_meta->>'probe' LIKE 'case-d-%'`,
    [A.nex_account_id],
  );
  await pg.end();
  console.log(`CASE D · partial-write check · rows found for case-d probes: ${probeRows.rows.length}`);
  if (probeRows.rows.length !== 0) {
    record("D-partial-writes", "FAIL", `found ${probeRows.rows.length} partial write(s) from rejected D sub-cases`);
  } else {
    record("D-partial-writes", "PASS", "no partial writes from any D sub-case · pre-write guard rejected before any INSERT");
  }
}

// ─────────────────────────────────────────────────────────────────
// CASE E · valid authenticated invite · persisted relationships
// ─────────────────────────────────────────────────────────────────
let E_sessionId, E_participantId, E_conversationId, E_messageId;
{
  const accept_href_placeholder = "/nex-native/call/preview?session=00000000-0000-0000-0000-000000000000&accept=1";
  const { data, error } = await asA.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: B.nex_account_id,
    p_media_type: "audio",
    p_host_country: "ireland",
    p_attachment_meta: { probe: "case-e-happy", lane: "G" },
    p_invite_body: "lane-g case E happy path",
    p_attachment_url: accept_href_placeholder,
    p_existing_session_id: null,
  });
  if (error) {
    record("E", "FAIL", `happy path RPC errored · code=${error.code} msg=${error.message}`);
  } else {
    const row = Array.isArray(data) ? data[0] : data;
    E_sessionId = row.out_session_id;
    E_participantId = row.out_participant_id;
    E_conversationId = row.out_conversation_id;
    E_messageId = row.out_message_id;
    const pg = new Client({ connectionString: dbUrl });
    await pg.connect();
    const sess = await pg.query(`SELECT id, host_account_id, media_type, state, host_country FROM nex_group_call_session WHERE id=$1`, [E_sessionId]);
    const part = await pg.query(`SELECT id, session_id, account_id FROM nex_group_call_participant WHERE id=$1`, [E_participantId]);
    const conv = await pg.query(`SELECT id, participant_a_id, participant_b_id FROM nex_peer_conversation WHERE id=$1`, [E_conversationId]);
    const msg = await pg.query(`SELECT id, conversation_id, sender_account_id, attachment_type, attachment_url, body FROM nex_peer_message WHERE id=$1`, [E_messageId]);
    await pg.end();
    const sOK = sess.rows.length === 1 && sess.rows[0].host_account_id === A.nex_account_id
      && sess.rows[0].media_type === "audio" && sess.rows[0].state === "ringing" && sess.rows[0].host_country === "ireland";
    const pOK = part.rows.length === 1 && part.rows[0].session_id === E_sessionId && part.rows[0].account_id === B.nex_account_id;
    const cOK = conv.rows.length === 1
      && ((conv.rows[0].participant_a_id === A.nex_account_id && conv.rows[0].participant_b_id === B.nex_account_id)
       || (conv.rows[0].participant_a_id === B.nex_account_id && conv.rows[0].participant_b_id === A.nex_account_id));
    const mOK = msg.rows.length === 1 && msg.rows[0].conversation_id === E_conversationId
      && msg.rows[0].sender_account_id === A.nex_account_id
      && msg.rows[0].attachment_type === "call_invite"
      && msg.rows[0].attachment_url === accept_href_placeholder;
    const verdict = (sOK && pOK && cOK && mOK) ? "PASS" : "FAIL";
    record("E", verdict, JSON.stringify({ sess: sess.rows, part: part.rows, conv: conv.rows, msg: msg.rows, flags: { sOK, pOK, cOK, mOK } }, null, 2));
  }
}

// ─────────────────────────────────────────────────────────────────
// CASE C (sub-assertion) · session_not_owned when B tries to reuse A's session
// ─────────────────────────────────────────────────────────────────
if (E_sessionId) {
  const B_session = await signInAs(B);
  const asB = B_session.client;
  const { data, error } = await asB.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: A.nex_account_id,
    p_media_type: "audio",
    p_host_country: "ireland",
    p_attachment_meta: { probe: "case-c-cross-account" },
    p_invite_body: "lane-g case C cross-account probe",
    p_attachment_url: "/nex-native/call/preview?session=" + E_sessionId + "&accept=1",
    p_existing_session_id: E_sessionId,
  });
  if (error && /session_not_owned/.test(error.message)) {
    record("C-sub", "PASS", `B cannot reuse A's session · code=${error.code} msg=${error.message}`);
  } else if (error) {
    record("C-sub", "WRONG_ERROR", `B rejected but not with session_not_owned · code=${error.code} msg=${error.message}`);
  } else {
    record("C-sub", "FAIL", `B unexpectedly used A's session · data=${JSON.stringify(data)}`);
  }
  await asB.auth.signOut();
}

// ─────────────────────────────────────────────────────────────────
// CASE F · dedup retry convergence + bounded concurrent retries
// ─────────────────────────────────────────────────────────────────
if (E_sessionId && E_participantId) {
  // Sequential retry · same (session, invitee)
  const retry = await asA.rpc("nex_invite_to_call_tx", {
    p_invitee_account_id: B.nex_account_id,
    p_media_type: "audio",
    p_host_country: "ireland",
    p_attachment_meta: { probe: "case-f-retry-seq" },
    p_invite_body: "lane-g case F seq retry",
    p_attachment_url: "/nex-native/call/preview?session=" + E_sessionId + "&accept=1",
    p_existing_session_id: E_sessionId,
  });
  let seqOK = false, seqRow = null;
  if (!retry.error) {
    seqRow = Array.isArray(retry.data) ? retry.data[0] : retry.data;
    seqOK = seqRow.out_skipped === "already_invited"
      && seqRow.out_session_id === E_sessionId
      && seqRow.out_participant_id === E_participantId
      && seqRow.out_conversation_id === null
      && seqRow.out_message_id === null;
  }

  // Bounded concurrent · 5 parallel retries against same (session, invitee)
  const concPromises = [];
  for (let i = 0; i < 5; i++) {
    concPromises.push(asA.rpc("nex_invite_to_call_tx", {
      p_invitee_account_id: B.nex_account_id,
      p_media_type: "audio",
      p_host_country: "ireland",
      p_attachment_meta: { probe: "case-f-retry-conc-" + i },
      p_invite_body: "lane-g case F conc retry " + i,
      p_attachment_url: "/nex-native/call/preview?session=" + E_sessionId + "&accept=1",
      p_existing_session_id: E_sessionId,
    }));
  }
  const concResults = await Promise.all(concPromises);
  const concRows = concResults.map(r => r.error ? { error: r.error.message } : (Array.isArray(r.data) ? r.data[0] : r.data));
  const allSkipped = concRows.every(r => r.out_skipped === "already_invited" && r.out_participant_id === E_participantId);

  // Persisted convergence · exactly 1 participant row for (E_sessionId, B)
  const pg = new Client({ connectionString: dbUrl });
  await pg.connect();
  const partCount = await pg.query(
    `SELECT COUNT(*)::int AS n FROM nex_group_call_participant WHERE session_id=$1 AND account_id=$2`,
    [E_sessionId, B.nex_account_id],
  );
  // Also · no duplicate messages per retry (retries must not emit new messages because already_invited returns early)
  const msgCount = await pg.query(
    `SELECT COUNT(*)::int AS n FROM nex_peer_message
      WHERE conversation_id = $1
        AND sender_account_id = $2
        AND attachment_meta ? 'probe'
        AND (attachment_meta->>'probe' LIKE 'case-f-%')`,
    [E_conversationId, A.nex_account_id],
  );
  await pg.end();

  const participantSingleton = partCount.rows[0].n === 1;
  const noDuplicateMessages = msgCount.rows[0].n === 0;
  const verdict = (seqOK && allSkipped && participantSingleton && noDuplicateMessages) ? "PASS" : "FAIL";
  record("F", verdict, JSON.stringify({ seqRow, concRows, participantSingleton, noDuplicateMessages }, null, 2));
}

// ─────────────────────────────────────────────────────────────────
// CASE G · STATE_BLOCKER
// ─────────────────────────────────────────────────────────────────
record(
  "G",
  "STATE_BLOCKER",
  [
    "After mig-356 the function body has NO remaining safe failure window between the session INSERT",
    "and the participant INSERT: both p_media_type and p_attachment_url are validated BEFORE any write,",
    "and the attachment-pair invariant is now satisfied by construction (attachment_type='call_invite'",
    "AND attachment_url=p_attachment_url inserted together).",
    "",
    "The directive forbids installing persistent fault hooks, changing shared triggers, or weakening",
    "controls.  No authorised mid-chain fault can therefore be injected against these fixtures in the",
    "current sandbox state.  Residual options would all require a prohibited change:",
    "  · temporary trigger on nex_peer_conversation (weakens shared behaviour)",
    "  · artificial constraint flip on nex_peer_message (same)",
    "  · race against GB-4CAP participant cap (explicitly out of scope; GB-4CAP stays OPEN)",
    "  · service_role bypass path (grants withdrawn)",
    "",
    "Partial evidence retained: §16.39.5 ledger entry captured a NATURAL mid-chain rollback under the",
    "pre-mig-356 attachment-pair CHECK violation · participant INSERT succeeded then message INSERT",
    "failed and the subtransaction rolled the participant back.  That evidence is NOT a mig-356 proof;",
    "it demonstrates the Postgres atomicity primitive that mig-356 continues to rely on.",
    "",
    "Classification: PARTIAL_PRIOR_EVIDENCE + STATE_BLOCKER_FOR_NEW_FAULT_INJECTION.",
  ].join("\n"),
);

// Final sign-out + results dump
await asA.auth.signOut();
writeFileSync("C:/Users/Victus/nexapp/tmp-lane-g/battery-356-results.json", JSON.stringify(results, null, 2));
console.log("\n=== BATTERY 356 · SUMMARY ===");
console.table(results.map(r => ({ case: r.case, verdict: r.verdict })));
console.log("\nresults written to tmp-lane-g/battery-356-results.json");
