#!/usr/bin/env node
// Stage 3A.1 identity + schema verification · read-only · sandbox only.
import pg from "pg";

const SBX_DB = process.env.SBX_DB;
if (!SBX_DB) throw new Error("SBX_DB not set");
if (SBX_DB.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("safeguard · production ref");
if (!SBX_DB.includes("kdstoyyeygcopkogqsyv")) throw new Error("safeguard · unexpected sandbox ref");

const c = new pg.Client({ connectionString: SBX_DB, ssl: { rejectUnauthorized: false } });
await c.connect();

console.log("=== Confirming sandbox project ref ===");
const ref = await c.query("SELECT current_database() AS db, inet_server_addr() AS host");
console.log("  db:", ref.rows[0].db, "· host:", ref.rows[0].host);

console.log("\n=== Candidate accounts: nex-99901 and nex-90001 ===");
const accts = await c.query(
  `SELECT id, nex_handle, display_name, hq_role, phone_country_code, last_known_country_iso
     FROM public.nex_account
    WHERE nex_handle IN ('nex-99901','nex-90001','nex-99901-irish-pride')
    ORDER BY nex_handle`,
);
for (const r of accts.rows) {
  console.log(`  handle=${r.nex_handle} id=${r.id} display="${r.display_name}" hq_role=${r.hq_role} phone_cc=${r.phone_country_code} country=${r.last_known_country_iso}`);
}

console.log("\n=== All HQ accounts in sandbox ===");
const hq = await c.query(
  `SELECT id, nex_handle, display_name, hq_role
     FROM public.nex_account
    WHERE hq_role IS NOT NULL
    ORDER BY nex_handle`,
);
for (const r of hq.rows) {
  console.log(`  handle=${r.nex_handle} id=${r.id} display="${r.display_name}" hq_role=${r.hq_role}`);
}

console.log("\n=== Irish Pride tracks · looking up owner by id lookup via DEWI fixed UUID ===");
const DEWI = "11111111-1111-4111-8111-111111111111";
const tracks = await c.query(
  `SELECT id, title, visibility, created_at
     FROM public.nex_music_track
    WHERE owner_account_id = $1
    ORDER BY visibility, title`,
  [DEWI],
);
for (const r of tracks.rows) {
  console.log(`  id=${r.id} visibility=${r.visibility} title="${r.title}"`);
}

console.log("\n=== Does DEWI id match an actual account? ===");
const dewiAcct = await c.query(
  `SELECT id, nex_handle, display_name, hq_role FROM public.nex_account WHERE id = $1`,
  [DEWI],
);
for (const r of dewiAcct.rows) {
  console.log(`  handle=${r.nex_handle} id=${r.id} display="${r.display_name}" hq_role=${r.hq_role}`);
}
if (dewiAcct.rows.length === 0) {
  console.log(`  ⚠ no account found with id=${DEWI}`);
}

console.log("\n=== Country registry state ===");
const reg = await c.query("SELECT code, display_name, hq_enabled, public_feed_enabled FROM public.nex_country_registry ORDER BY code");
for (const r of reg.rows) {
  console.log(`  ${r.code} · ${r.display_name} · hq=${r.hq_enabled} · public=${r.public_feed_enabled}`);
}

console.log("\n=== Existing placements (should be 0) ===");
const plc = await c.query("SELECT count(*)::int AS n FROM public.nex_country_placement");
console.log(`  nex_country_placement rows: ${plc.rows[0].n}`);

console.log("\n=== Existing audit log entries (should be 0) ===");
const al = await c.query("SELECT count(*)::int AS n FROM public.nex_hq_action_log");
console.log(`  nex_hq_action_log rows: ${al.rows[0].n}`);

console.log("\n=== Migration ledger · 252/253/254 applied? ===");
const mh = await c.query("SELECT version, applied_at FROM public.nex_migration_history WHERE version IN ('252','253','254','255','256') ORDER BY version");
for (const r of mh.rows) {
  console.log(`  v${r.version} applied_at=${r.applied_at.toISOString()}`);
}

await c.end();
console.log("\n==========================================");
console.log("READ-ONLY · NO WRITES PERFORMED");
console.log("==========================================");
