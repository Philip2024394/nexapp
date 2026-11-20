// Sign-in via password auth + run RPC invite scenarios.
// Covers: (a) happy path invite, (b) deduplicated retry convergence.
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
const anon = envValue("SANDBOX_SUPABASE_ANON_KEY");
const dbUrl = envValue("SANDBOX_DATABASE_URL");
if (!url?.includes("kdstoyyeygcopkogqsyv") || url.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("STOP ref");

const admin = createClient(url, srv, { auth: { autoRefreshToken: false, persistSession: false } });
const fixtures = JSON.parse(readFileSync("C:/Users/Victus/nexapp/tmp-lane-g/fixtures.json", "utf8"));
const [A, B] = fixtures;

// Set known passwords (admin-controlled · not email-delivery)
const pwdA = "LaneG-pwd-A-" + Date.now();
const pwdB = "LaneG-pwd-B-" + Date.now();
await admin.auth.admin.updateUserById(A.supabase_user_id, { password: pwdA });
await admin.auth.admin.updateUserById(B.supabase_user_id, { password: pwdB });
console.log("passwords set via admin · signing in via supported password auth");

// Sign in as A with a FRESH anon-key client (not admin)
const clientA = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: sessA, error: signErrA } = await clientA.auth.signInWithPassword({ email: A.email, password: pwdA });
if (signErrA) { console.error("signin A failed:", signErrA); process.exit(1); }
console.log("signed in A · auth.uid:", sessA.user.id, "· supabase_user_id matches:", sessA.user.id === A.supabase_user_id);

const invite_body = "Lane G sandbox invite · round 18 · fixture A → B";
const attach = { ring_tone: "default", initiated_at: new Date().toISOString() };

// === HAPPY PATH ===
console.log("\n--- HAPPY PATH · invite A → B ---");
const r1 = await clientA.rpc("nex_invite_to_call_tx", {
  p_self_supabase_user_id: A.supabase_user_id,
  p_invitee_account_id: B.nex_account_id,
  p_media_type: "audio",
  p_host_country: "ireland",
  p_attachment_meta: attach,
  p_invite_body: invite_body,
  p_existing_session_id: null,
});
if (r1.error) { console.error("RPC call 1 error:", r1.error); process.exit(2); }
console.log("RPC call 1 result:", r1.data);
const first = r1.data[0];

// === RETRY (should dedup via unique(session_id, account_id)) ===
console.log("\n--- RETRY · same (session, invitee) ---");
const r2 = await clientA.rpc("nex_invite_to_call_tx", {
  p_self_supabase_user_id: A.supabase_user_id,
  p_invitee_account_id: B.nex_account_id,
  p_media_type: "audio",
  p_host_country: "ireland",
  p_attachment_meta: attach,
  p_invite_body: invite_body,
  p_existing_session_id: first.out_session_id,
});
if (r2.error) { console.error("RPC call 2 error:", r2.error); process.exit(3); }
console.log("RPC call 2 result:", r2.data);
const second = r2.data[0];
console.log("convergence · session same:", second.out_session_id === first.out_session_id, "· participant same:", second.out_participant_id === first.out_participant_id, "· skipped:", second.out_skipped);

// === PERSISTENCE VERIFICATION via direct pg (count rows) ===
const pg = new Client({ connectionString: dbUrl });
await pg.connect();
const sessionRows = await pg.query(`SELECT id, host_account_id, media_type, state, host_country, created_at FROM nex_group_call_session WHERE host_account_id=$1 ORDER BY created_at DESC`, [A.nex_account_id]);
const participantRows = await pg.query(`SELECT id, session_id, account_id, invited_at FROM nex_group_call_participant WHERE session_id=$1`, [first.out_session_id]);
const messageRows = await pg.query(`SELECT id, conversation_id, sender_account_id, attachment_type, body FROM nex_peer_message WHERE id=$1`, [first.out_message_id]);
console.log("\n--- PERSISTED ---");
console.log("sessions for A (expect 1):", sessionRows.rows.length);
console.table(sessionRows.rows);
console.log("participants for session (expect 1):", participantRows.rows.length);
console.table(participantRows.rows);
console.log("invite message (expect 1, attachment_type=call_invite):", messageRows.rows.length);
console.table(messageRows.rows);
await pg.end();

writeFileSync("C:/Users/Victus/nexapp/tmp-lane-g/invite-results.json", JSON.stringify({ happy: first, retry: second }, null, 2));
console.log("\nSAVED → tmp-lane-g/invite-results.json");
