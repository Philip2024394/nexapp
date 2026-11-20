// Inspects whether the failed RPC left orphan rows (validates transactional
// rollback property) then cleans up the two fixtures by captured IDs only.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const envRaw = readFileSync("C:/Users/Victus/nexapp/.env.local", "utf8");
function envValue(name) { const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m")); if (!m) return null; let v = m[1].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); return v || null; }
const url = envValue("SANDBOX_SUPABASE_URL");
const srv = envValue("SANDBOX_SUPABASE_SERVICE_ROLE_KEY");
const dbUrl = envValue("SANDBOX_DATABASE_URL");
if (!url?.includes("kdstoyyeygcopkogqsyv") || url.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("STOP ref");

const fixtures = JSON.parse(readFileSync("C:/Users/Victus/nexapp/tmp-lane-g/fixtures.json", "utf8"));
const [A, B] = fixtures;

const pg = new Client({ connectionString: dbUrl });
await pg.connect();

// === ROLLBACK VERIFICATION ===
// The RPC failed on the message insert (last statement). The function's
// subtransaction should have rolled back the session + participant too.
console.log("--- ROLLBACK EVIDENCE ---");
const orphans_s = await pg.query(`SELECT id, host_account_id, state FROM nex_group_call_session WHERE host_account_id=$1`, [A.nex_account_id]);
console.log("sessions where host=fixture-A (expect 0 · rollback):", orphans_s.rows.length);
console.table(orphans_s.rows);
const orphans_p = await pg.query(`SELECT id, session_id, account_id FROM nex_group_call_participant WHERE account_id=$1`, [B.nex_account_id]);
console.log("participants where invitee=fixture-B (expect 0 · rollback):", orphans_p.rows.length);
console.table(orphans_p.rows);
const orphans_c = await pg.query(`SELECT id FROM nex_peer_conversation WHERE (participant_a_id=$1 AND participant_b_id=$2) OR (participant_a_id=$2 AND participant_b_id=$1)`, [A.nex_account_id, B.nex_account_id]);
console.log("peer conversations between A,B (may be 0 or 1 · the conversation insert is INSIDE the same function subtx; it should also roll back):", orphans_c.rows.length);
console.table(orphans_c.rows);
const orphans_m = await pg.query(`SELECT id FROM nex_peer_message WHERE sender_account_id=$1`, [A.nex_account_id]);
console.log("peer messages from A (expect 0):", orphans_m.rows.length);

// === NEIGHBOUR SAFETY CHECKS (bulk-only, no content exposure) ===
const totals = await pg.query(`
  SELECT
    (SELECT COUNT(*) FROM nex_account) AS accounts_total,
    (SELECT COUNT(*) FROM nex_peer_message) AS peer_msg_total,
    (SELECT COUNT(*) FROM nex_peer_conversation) AS peer_conv_total,
    (SELECT COUNT(*) FROM nex_group_call_session) AS gcs_total,
    (SELECT COUNT(*) FROM nex_group_call_participant) AS gcp_total
`);
console.log("\n--- PRE-CLEANUP TOTALS ---");
console.table(totals.rows);

// === CLEANUP · fixture-specific IDs only ===
// Cascades: nex_account → nex_peer_conversation (via participant FK ON DELETE CASCADE)
//                      → nex_peer_message (sender_account_id FK ON DELETE CASCADE)
//                      → nex_group_call_session (host_account_id FK ON DELETE CASCADE)
//                      → nex_group_call_participant (account_id FK ON DELETE CASCADE)
// Delete nex_account rows first (cascades), then auth.users by captured sb_user_id.
console.log("\n--- CLEANUP ---");
for (const u of [A, B]) {
  const del = await pg.query(`DELETE FROM nex_account WHERE id=$1 RETURNING id`, [u.nex_account_id]);
  console.log("nex_account deleted for", u.email, "→", del.rows.length === 1 ? "OK" : "MISSING");
}

const admin = createClient(url, srv, { auth: { autoRefreshToken: false, persistSession: false } });
for (const u of [A, B]) {
  const { error } = await admin.auth.admin.deleteUser(u.supabase_user_id);
  console.log("auth.users delete for", u.email, error ? "ERR: " + error.message : "OK");
}

// === POST-CLEANUP TOTAL DELTA ===
const totals_after = await pg.query(`
  SELECT
    (SELECT COUNT(*) FROM nex_account) AS accounts_total,
    (SELECT COUNT(*) FROM nex_peer_message) AS peer_msg_total,
    (SELECT COUNT(*) FROM nex_peer_conversation) AS peer_conv_total,
    (SELECT COUNT(*) FROM nex_group_call_session) AS gcs_total,
    (SELECT COUNT(*) FROM nex_group_call_participant) AS gcp_total
`);
console.log("\n--- POST-CLEANUP TOTALS ---");
console.table(totals_after.rows);

const delta_accounts = Number(totals.rows[0].accounts_total) - Number(totals_after.rows[0].accounts_total);
console.log("delta accounts (expect -2):", -delta_accounts);
console.log("delta peer_msg (expect 0):", Number(totals_after.rows[0].peer_msg_total) - Number(totals.rows[0].peer_msg_total));
console.log("delta peer_conv (expect 0):", Number(totals_after.rows[0].peer_conv_total) - Number(totals.rows[0].peer_conv_total));
console.log("delta gcs (expect 0):", Number(totals_after.rows[0].gcs_total) - Number(totals.rows[0].gcs_total));
console.log("delta gcp (expect 0):", Number(totals_after.rows[0].gcp_total) - Number(totals.rows[0].gcp_total));
await pg.end();
