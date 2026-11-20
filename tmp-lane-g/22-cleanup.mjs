// Lane G · mig-356 fixture cleanup · sandbox kdstoyyeygcopkogqsyv only.
// Removes ONLY rows owned by fixtures captured 2026-11-19:
//   A nex_account_id = bfcd2a0b-7c94-43d2-83c8-cc548bcf9f66 (auth 58013b91-caa6-4047-ac47-f53fa447256f)
//   B nex_account_id = c6ad3b74-75a6-4d01-9f78-77ce5122b32d (auth c0d68671-3307-43f6-9848-114353465867)
// Hard refuses production ref · does NOT touch other accounts · verifies neighbour invariants.
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
const srv = envValue("SANDBOX_SUPABASE_SERVICE_ROLE_KEY");
const dbUrl = envValue("SANDBOX_DATABASE_URL");
if (!url || !url.includes("kdstoyyeygcopkogqsyv") || url.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("STOP · bad url ref");
if (!dbUrl || !dbUrl.includes("kdstoyyeygcopkogqsyv") || dbUrl.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("STOP · bad db ref");

const fixtures = JSON.parse(readFileSync("C:/Users/Victus/nexapp/tmp-lane-g/fixtures-356.json", "utf8"));
const A = fixtures[0];
const B = fixtures[1];
const accountIds = [A.nex_account_id, B.nex_account_id];
const authIds = [A.supabase_user_id, B.supabase_user_id];

const pg = new Client({ connectionString: dbUrl });
await pg.connect();

// ─── Pre-count neighbour-invariant baselines (non-fixture totals) ────
async function globalCount(table, extraWhere = "") {
  const r = await pg.query(`SELECT COUNT(*)::bigint AS n FROM ${table} ${extraWhere}`);
  return r.rows[0].n;
}
const preAccTotal       = await globalCount("nex_account");
const preSessionTotal   = await globalCount("nex_group_call_session");
const preParticipantTot = await globalCount("nex_group_call_participant");
const preConvTotal      = await globalCount("nex_peer_conversation");
const preMsgTotal       = await globalCount("nex_peer_message");

// Also: non-fixture subset (total minus anything attributable to A or B)
const preNonFixtureSessions = await pg.query(
  `SELECT COUNT(*)::bigint AS n FROM nex_group_call_session WHERE host_account_id <> ALL($1::uuid[])`,
  [accountIds],
);
const preNonFixtureParticipants = await pg.query(
  `SELECT COUNT(*)::bigint AS n FROM nex_group_call_participant
    WHERE account_id <> ALL($1::uuid[])
      AND session_id NOT IN (SELECT id FROM nex_group_call_session WHERE host_account_id = ANY($1::uuid[]))`,
  [accountIds],
);
const preNonFixtureConversations = await pg.query(
  `SELECT COUNT(*)::bigint AS n FROM nex_peer_conversation
    WHERE participant_a_id <> ALL($1::uuid[])
      AND participant_b_id <> ALL($1::uuid[])`,
  [accountIds],
);
const preNonFixtureMessages = await pg.query(
  `SELECT COUNT(*)::bigint AS n FROM nex_peer_message
    WHERE sender_account_id <> ALL($1::uuid[])`,
  [accountIds],
);

console.log("─── Pre-cleanup global counts ───");
console.table({
  accounts: preAccTotal,
  sessions: preSessionTotal,
  participants: preParticipantTot,
  conversations: preConvTotal,
  messages: preMsgTotal,
});
console.log("─── Pre-cleanup non-fixture subsets (must be unchanged after) ───");
console.table({
  non_fixture_sessions: preNonFixtureSessions.rows[0].n,
  non_fixture_participants: preNonFixtureParticipants.rows[0].n,
  non_fixture_conversations: preNonFixtureConversations.rows[0].n,
  non_fixture_messages: preNonFixtureMessages.rows[0].n,
});

// ─── Enumerate fixture-attributable rows for the receipt ─────────────
const fixtureSessions = await pg.query(
  `SELECT id, host_account_id, state FROM nex_group_call_session WHERE host_account_id = ANY($1::uuid[])`,
  [accountIds],
);
const fixtureParticipants = await pg.query(
  `SELECT id, session_id, account_id FROM nex_group_call_participant
    WHERE account_id = ANY($1::uuid[])
       OR session_id IN (SELECT id FROM nex_group_call_session WHERE host_account_id = ANY($1::uuid[]))`,
  [accountIds],
);
const fixtureConversations = await pg.query(
  `SELECT id, participant_a_id, participant_b_id FROM nex_peer_conversation
    WHERE participant_a_id = ANY($1::uuid[]) OR participant_b_id = ANY($1::uuid[])`,
  [accountIds],
);
const fixtureMessages = await pg.query(
  `SELECT id, conversation_id, sender_account_id FROM nex_peer_message
    WHERE sender_account_id = ANY($1::uuid[])
       OR conversation_id IN (
            SELECT id FROM nex_peer_conversation
             WHERE participant_a_id = ANY($1::uuid[]) OR participant_b_id = ANY($1::uuid[])
          )`,
  [accountIds],
);
console.log("─── Fixture-attributable rows ───");
console.log("sessions:", fixtureSessions.rows.length);
console.log("participants:", fixtureParticipants.rows.length);
console.log("conversations:", fixtureConversations.rows.length);
console.log("messages:", fixtureMessages.rows.length);

// ─── Delete in FK-safe order inside a single transaction ─────────────
await pg.query("BEGIN");
const dMsg = await pg.query(
  `DELETE FROM nex_peer_message
    WHERE sender_account_id = ANY($1::uuid[])
       OR conversation_id IN (
            SELECT id FROM nex_peer_conversation
             WHERE participant_a_id = ANY($1::uuid[]) OR participant_b_id = ANY($1::uuid[])
          )
    RETURNING id`,
  [accountIds],
);
const dConv = await pg.query(
  `DELETE FROM nex_peer_conversation
    WHERE participant_a_id = ANY($1::uuid[]) OR participant_b_id = ANY($1::uuid[])
    RETURNING id`,
  [accountIds],
);
const dPart = await pg.query(
  `DELETE FROM nex_group_call_participant
    WHERE account_id = ANY($1::uuid[])
       OR session_id IN (SELECT id FROM nex_group_call_session WHERE host_account_id = ANY($1::uuid[]))
    RETURNING id`,
  [accountIds],
);
const dSess = await pg.query(
  `DELETE FROM nex_group_call_session WHERE host_account_id = ANY($1::uuid[]) RETURNING id`,
  [accountIds],
);
const dAcc = await pg.query(
  `DELETE FROM nex_account WHERE id = ANY($1::uuid[]) RETURNING id`,
  [accountIds],
);
await pg.query("COMMIT");

console.log("─── Deleted counts ───");
console.table({
  messages: dMsg.rows.length,
  conversations: dConv.rows.length,
  participants: dPart.rows.length,
  sessions: dSess.rows.length,
  accounts: dAcc.rows.length,
});

// ─── Post-count neighbour-invariant checks ────────────────────────────
const postNonFixtureSessions = await pg.query(`SELECT COUNT(*)::bigint AS n FROM nex_group_call_session`);
const postNonFixtureParticipants = await pg.query(`SELECT COUNT(*)::bigint AS n FROM nex_group_call_participant`);
const postNonFixtureConversations = await pg.query(`SELECT COUNT(*)::bigint AS n FROM nex_peer_conversation`);
const postNonFixtureMessages = await pg.query(`SELECT COUNT(*)::bigint AS n FROM nex_peer_message`);
const postAccTotal = await globalCount("nex_account");

// After cleanup · non-fixture subsets should equal total (no fixture rows left)
// AND should EQUAL the pre-cleanup non-fixture subsets (no collateral damage).
const invariants = {
  non_fixture_sessions:      { before: preNonFixtureSessions.rows[0].n,      after: postNonFixtureSessions.rows[0].n },
  non_fixture_participants:  { before: preNonFixtureParticipants.rows[0].n,  after: postNonFixtureParticipants.rows[0].n },
  non_fixture_conversations: { before: preNonFixtureConversations.rows[0].n, after: postNonFixtureConversations.rows[0].n },
  non_fixture_messages:      { before: preNonFixtureMessages.rows[0].n,      after: postNonFixtureMessages.rows[0].n },
  accounts_delta:            { before: preAccTotal,                           after: postAccTotal, expected_delta: -2 },
};
console.log("─── Neighbour invariants ───");
console.table(invariants);

const neighbourOK =
  invariants.non_fixture_sessions.before === invariants.non_fixture_sessions.after &&
  invariants.non_fixture_participants.before === invariants.non_fixture_participants.after &&
  invariants.non_fixture_conversations.before === invariants.non_fixture_conversations.after &&
  invariants.non_fixture_messages.before === invariants.non_fixture_messages.after &&
  (BigInt(invariants.accounts_delta.after) - BigInt(invariants.accounts_delta.before) === BigInt(-2));

if (!neighbourOK) {
  console.error("!!  NEIGHBOUR INVARIANTS FAILED · unexpected collateral change · DO NOT CLAIM CLEAN CLEANUP");
} else {
  console.log("✓ Neighbour invariants hold · cleanup touched ONLY fixture-attributable rows plus the 2 fixture accounts.");
}

await pg.end();

// ─── Delete auth users via admin API ─────────────────────────────────
const admin = createClient(url, srv, { auth: { autoRefreshToken: false, persistSession: false } });
const authDeletions = [];
for (const authId of authIds) {
  const { error } = await admin.auth.admin.deleteUser(authId);
  authDeletions.push({ authId, deleted: !error, error: error?.message ?? null });
  console.log(`auth user ${authId} delete:`, error ? error.message : "OK");
}

// Receipt
const receipt = {
  stamp: new Date().toISOString(),
  accountIds,
  authIds,
  deleted: {
    messages: dMsg.rows.map(r => r.id),
    conversations: dConv.rows.map(r => r.id),
    participants: dPart.rows.map(r => r.id),
    sessions: dSess.rows.map(r => r.id),
    accounts: dAcc.rows.map(r => r.id),
  },
  authDeletions,
  neighbourInvariants: invariants,
  neighbourOK,
};
writeFileSync("C:/Users/Victus/nexapp/tmp-lane-g/cleanup-356-receipt.json", JSON.stringify(receipt, null, 2));
console.log("\nReceipt written to tmp-lane-g/cleanup-356-receipt.json");
