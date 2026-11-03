#!/usr/bin/env node
// Batch D+ · verify Irish Pride qualification state · READ-ONLY.
import pg from "pg";
const SBX_DB = process.env.SBX_DB;
if (!SBX_DB) throw new Error("SBX_DB not set");
if (SBX_DB.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("safeguard · production ref");
const c = new pg.Client({ connectionString: SBX_DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const IRISH_PRIDE = "11111111-1111-4111-8111-111111111111";

const tracks = await c.query(
  "SELECT visibility, count(*)::int AS n FROM public.nex_music_track WHERE owner_account_id=$1 GROUP BY visibility ORDER BY visibility",
  [IRISH_PRIDE],
);
console.log("Irish Pride music tracks:");
let qualifying = 0;
for (const r of tracks.rows) {
  console.log(`  visibility=${r.visibility} · ${r.n}`);
  if (r.visibility !== "removed") qualifying += r.n;
}
console.log(`  → qualifying (visibility != 'removed'): ${qualifying}`);
console.log(`  → threshold: 5`);
console.log(`  → earned music badge: ${qualifying >= 5 ? "YES" : "no"}`);

const support = await c.query(
  "SELECT account_id, enabled, qris_image_url IS NOT NULL AS has_qr, paypal_link IS NOT NULL AS has_paypal, external_links FROM public.nex_creator_support_settings WHERE account_id=$1",
  [IRISH_PRIDE],
).catch((e) => ({ rows: [{ _error: e.message }] }));
console.log("\nIrish Pride support settings:");
if (support.rows.length === 0) {
  console.log("  → NO ROW (never configured)");
} else {
  for (const r of support.rows) console.log("  ", r);
}

await c.end();
