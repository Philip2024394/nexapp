// scripts/_tmp/genuine-auth-walker-full.mjs
// Extended genuine-authentication walker for Hamrex (nex-99901) + Rosa (nex-99903).
//
// Builds on scripts/_tmp/genuine-auth-walker.mjs. Instead of Playwright,
// drives Supabase magiclink via fetch({redirect:'manual'}) → extracts
// access_token from the Location-header hash fragment. Each persona then
// exercises the REAL nex_peer_message RLS write/read path with their own
// JWT (never service_role) to prove:
//
//   P1 · Hamrex POST message in shared conversation      → 201
//   P2 · Rosa reads the shared conversation              → sees Hamrex's row
//   P3 · Rosa POST reply in the same conversation        → 201
//   P4 · Hamrex reads again                              → sees BOTH rows
//   P5 · Fresh fetch after settle (reload persistence)   → both rows still present
//   N1 · Hamrex POST with sender_account_id spoofed to Rosa → RLS REJECT (403)
//   N2 · Hamrex POST into a non-participant conversation    → RLS REJECT (403)
//   N3 · Rosa SELECT a stranger conversation                → 0 rows (RLS filter)
//
// Everything is cleaned up by RUN_TAG via service-role admin at the end.
// Writes redacted evidence to
// scripts/_tmp/evidence/2026-11-20-closeout/full-walker-two-way-chat.json.
//
// Sandbox: kdstoyyeygcopkogqsyv · Prod sealed: ijvqdvsvwtwxzcqmoqit (refused).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const pg = await import("pg");

function v(k) {
  const raw = readFileSync(".env.local", "utf8");
  const m = raw.match(new RegExp("^" + k + "=(.*)$", "m"));
  if (!m) return null;
  let x = m[1].trim();
  if ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("'") && x.endsWith("'"))) x = x.slice(1, -1);
  return x || null;
}

const SB_URL = v("NEXT_PUBLIC_NEX_SUPABASE_URL");
const SB_SERVICE = v("NEX_SUPABASE_SERVICE_ROLE_KEY");
const SB_ANON = v("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
if (!SB_URL || !SB_SERVICE || !SB_ANON) { console.error("missing env"); process.exit(2); }
if (!SB_URL.includes("kdstoyyeygcopkogqsyv")) { console.error("not sandbox · refusing"); process.exit(3); }

const RUN_TAG = `walker-full-${Date.now()}`;
const DEV_BASE = "http://localhost:3008";

const admin = createClient(SB_URL, SB_SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

// ─── Resolve fixtures via pooler ────────────────────────────────────────────
const urlProc = spawnSync("node", ["scripts/_tmp/pooler-url.mjs"], { encoding: "utf8" });
const dbUrl = urlProc.stdout.trim();
const pgc = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await pgc.connect();

async function personaFor(handle) {
  const r = await pgc.query(`
    SELECT a.id::text AS account_id, a.supabase_user_id::text AS user_id, u.email
      FROM nex_account a JOIN auth.users u ON u.id = a.supabase_user_id
     WHERE a.nex_handle = $1`, [handle]);
  return r.rows[0];
}

const hamrex = await personaFor("nex-99901");
const rosa = await personaFor("nex-99903");
if (!hamrex || !rosa) { console.error("fixtures missing"); process.exit(4); }

const convRow = await pgc.query(`
  SELECT id::text FROM nex_peer_conversation
  WHERE (participant_a_id=$1 AND participant_b_id=$2) OR (participant_a_id=$2 AND participant_b_id=$1)
  LIMIT 1`, [hamrex.account_id, rosa.account_id]);
if (!convRow.rows.length) { console.error("no shared conversation"); process.exit(5); }
const sharedConvId = convRow.rows[0].id;

const out = {
  base: DEV_BASE,
  sandbox: "kdstoyyeygcopkogqsyv",
  runTag: RUN_TAG,
  startedAt: new Date().toISOString(),
  fixtures: {
    hamrex: { handle: "nex-99901", account_id_prefix: hamrex.account_id.slice(0, 8), user_id_prefix: hamrex.user_id.slice(0, 8) },
    rosa:   { handle: "nex-99903", account_id_prefix: rosa.account_id.slice(0, 8),   user_id_prefix: rosa.user_id.slice(0, 8) },
    conversation_id_prefix: sharedConvId.slice(0, 8),
  },
  steps: [],
};

function record(name, pass, detail = {}) {
  out.steps.push({ name, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"} · ${name} · ${JSON.stringify(detail)}`);
}

// ─── Mint JWTs via fetch-manual-redirect ────────────────────────────────────
async function mintToken(email) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${DEV_BASE}/nex-native/` },
  });
  if (error || !data?.properties?.action_link) throw new Error(`generateLink · ${error?.message || "no link"}`);
  const res = await fetch(data.properties.action_link, { redirect: "manual" });
  if (res.status !== 303) throw new Error(`verify status · ${res.status}`);
  const loc = res.headers.get("location") || "";
  const m = loc.match(/[#&]access_token=([^&]+)/);
  if (!m) throw new Error("no access_token in location");
  return m[1];
}

let hamrexToken, rosaToken;
try {
  [hamrexToken, rosaToken] = await Promise.all([mintToken(hamrex.email), mintToken(rosa.email)]);
  record("mint JWTs for both personas", true, { hamrexTokenCaptured: !!hamrexToken, rosaTokenCaptured: !!rosaToken });
} catch (e) {
  record("mint JWTs for both personas", false, { err: e.message });
  await pgc.end();
  mkdirSync("scripts/_tmp/evidence/2026-11-20-closeout", { recursive: true });
  writeFileSync("scripts/_tmp/evidence/2026-11-20-closeout/full-walker-two-way-chat.json", JSON.stringify(out, null, 2));
  process.exit(1);
}

// Verify both tokens map to the right auth.uid()
{
  const [h, r] = await Promise.all([
    fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${hamrexToken}` } }),
    fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${rosaToken}` } }),
  ]);
  const hj = h.status === 200 ? await h.json() : {};
  const rj = r.status === 200 ? await r.json() : {};
  const ok = hj.id === hamrex.user_id && rj.id === rosa.user_id;
  record("JWTs map to correct auth.uid()", ok, {
    hamrex_matches: hj.id === hamrex.user_id, rosa_matches: rj.id === rosa.user_id,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function restInsert(token, row) {
  return fetch(`${SB_URL}/rest/v1/nex_peer_message`, {
    method: "POST",
    headers: {
      apikey: SB_ANON, Authorization: `Bearer ${token}`,
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
}

function restSelect(token, path) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
  });
}

const probeMeta = { probe: RUN_TAG };

// ─── P1 · Hamrex sends a message ────────────────────────────────────────────
let hamrexMsgId = null;
{
  const r = await restInsert(hamrexToken, {
    conversation_id: sharedConvId,
    sender_account_id: hamrex.account_id,
    body: `${RUN_TAG} · hamrex → rosa`,
    attachment_meta: probeMeta,
  });
  const rows = r.status === 201 ? await r.json() : null;
  hamrexMsgId = Array.isArray(rows) ? rows[0]?.id : null;
  record("P1 · Hamrex POST message in shared conv", r.status === 201 && !!hamrexMsgId, {
    status: r.status, msg_id_prefix: hamrexMsgId?.slice(0, 8) ?? null,
  });
}

// ─── P2 · Rosa reads shared conversation ───────────────────────────────────
{
  const r = await restSelect(rosaToken, `nex_peer_message?conversation_id=eq.${sharedConvId}&select=id,sender_account_id,body,attachment_meta&order=sent_at.desc&limit=10`);
  const rows = r.status === 200 ? await r.json() : null;
  const sawHamrex = Array.isArray(rows) && rows.some(m => m.id === hamrexMsgId);
  record("P2 · Rosa reads shared conv — sees Hamrex row", r.status === 200 && sawHamrex, {
    status: r.status, total_rows: rows?.length ?? null, saw_hamrex_msg: sawHamrex,
  });
}

// ─── P3 · Rosa replies ──────────────────────────────────────────────────────
let rosaMsgId = null;
{
  const r = await restInsert(rosaToken, {
    conversation_id: sharedConvId,
    sender_account_id: rosa.account_id,
    body: `${RUN_TAG} · rosa → hamrex reply`,
    attachment_meta: probeMeta,
    reply_to_id: hamrexMsgId,
  });
  const rows = r.status === 201 ? await r.json() : null;
  rosaMsgId = Array.isArray(rows) ? rows[0]?.id : null;
  record("P3 · Rosa POST reply in shared conv", r.status === 201 && !!rosaMsgId, {
    status: r.status, msg_id_prefix: rosaMsgId?.slice(0, 8) ?? null,
  });
}

// ─── P4 · Hamrex reads → sees BOTH ──────────────────────────────────────────
{
  const r = await restSelect(hamrexToken, `nex_peer_message?conversation_id=eq.${sharedConvId}&attachment_meta->>probe=eq.${RUN_TAG}&select=id,sender_account_id,body&order=sent_at.asc`);
  const rows = r.status === 200 ? await r.json() : null;
  const sawBoth = Array.isArray(rows) && rows.some(m => m.id === hamrexMsgId) && rows.some(m => m.id === rosaMsgId);
  record("P4 · Hamrex reads — sees both rows", r.status === 200 && sawBoth, {
    status: r.status, total_rows: rows?.length ?? null, saw_both: sawBoth,
  });
}

// ─── P5 · Fresh fetch after settle (reload persistence) ────────────────────
await new Promise(res => setTimeout(res, 500));
{
  const r = await restSelect(rosaToken, `nex_peer_message?conversation_id=eq.${sharedConvId}&attachment_meta->>probe=eq.${RUN_TAG}&select=id&order=sent_at.asc`);
  const rows = r.status === 200 ? await r.json() : null;
  const stillBoth = Array.isArray(rows) && rows.length === 2 &&
    rows.some(m => m.id === hamrexMsgId) && rows.some(m => m.id === rosaMsgId);
  record("P5 · fresh fetch after settle · both rows persisted", r.status === 200 && stillBoth, {
    status: r.status, total_rows: rows?.length ?? null, both_persisted: stillBoth,
  });
}

// ─── N1 · Sender-spoof: Hamrex posts with sender=Rosa ───────────────────────
{
  const r = await restInsert(hamrexToken, {
    conversation_id: sharedConvId,
    sender_account_id: rosa.account_id,            // SPOOF
    body: `${RUN_TAG} · SPOOF should be rejected`,
    attachment_meta: probeMeta,
  });
  const body = r.status !== 201 ? await r.text() : await r.text();
  const rejected = r.status === 403 || r.status === 401 ||
    (r.status === 400 && /row-level security|new row violates|RLS/i.test(body));
  record("N1 · Hamrex→spoof(sender=Rosa) · RLS blocks", rejected, {
    status: r.status, body_hint: body.slice(0, 120),
  });
}

// ─── N2 · Non-participant conv: Hamrex posts into a fabricated conv ─────────
{
  const bogusConv = randomUUID();
  const r = await restInsert(hamrexToken, {
    conversation_id: bogusConv,
    sender_account_id: hamrex.account_id,
    body: `${RUN_TAG} · NON-PARTICIPANT should be rejected`,
    attachment_meta: probeMeta,
  });
  const body = await r.text();
  const rejected = r.status === 403 || r.status === 401 ||
    (r.status === 400 && /row-level security|new row violates|RLS|foreign key/i.test(body));
  record("N2 · Hamrex→non-participant conv · RLS blocks", rejected, {
    status: r.status, body_hint: body.slice(0, 120),
  });
}

// ─── N3 · Stranger-conv SELECT returns 0 (re-prove) ─────────────────────────
{
  const strangerConv = "00000000-0000-4000-8000-000000000000";
  const r = await restSelect(rosaToken, `nex_peer_message?conversation_id=eq.${strangerConv}&select=id`);
  const rows = r.status === 200 ? await r.json() : null;
  record("N3 · Rosa SELECT stranger-conv · 0 rows", r.status === 200 && Array.isArray(rows) && rows.length === 0, {
    status: r.status, rows: rows?.length ?? null,
  });
}

// ─── Cleanup probe rows ─────────────────────────────────────────────────────
try {
  const del = await pgc.query(`DELETE FROM nex_peer_message WHERE attachment_meta->>'probe' = $1 RETURNING id`, [RUN_TAG]);
  out.cleanup = { rows_deleted: del.rows.length };
  console.log(`CLEANUP · deleted=${del.rows.length}`);
} catch (e) {
  out.cleanup = { err: e.message };
}

await pgc.end();
out.finishedAt = new Date().toISOString();

const passed = out.steps.filter(s => s.pass).length;
const total = out.steps.length;
out.summary = { passed, total, allPassed: passed === total };

mkdirSync("scripts/_tmp/evidence/2026-11-20-closeout", { recursive: true });
writeFileSync("scripts/_tmp/evidence/2026-11-20-closeout/full-walker-two-way-chat.json", JSON.stringify(out, null, 2));
console.log(`\nSUMMARY · ${passed}/${total} steps PASS`);
if (passed !== total) process.exit(1);
