// scripts/_tmp/chase-ireland-preview-profile-and-storage.mjs
// Owner-authorised read-only probe 2026-11-04.
// Fetch nex_account_profile (incl. avatar_url) for Irish Pride on
// Ireland preview, plus list its storage objects (nex-avatars +
// nex-music-media).

import { readFileSync } from "node:fs";
import pg from "pg";

const PREVIEW_DB =
  "postgresql://postgres:adminphilip240176.@db.kdstoyyeygcopkogqsyv.supabase.co:5432/postgres";
const PREVIEW_URL = "https://kdstoyyeygcopkogqsyv.supabase.co";

// Service role key for Ireland preview (previously in
// .env.development.local before 2026-11-04). The user confirmed
// this is read-only investigation; no writes performed.
const PREVIEW_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtkc3RveXlleWdjb3Brb2dxc3l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzQyMDA1MCwiZXhwIjoyMTA4OTk2MDUwfQ.jxQICmJgddzJXAkPH8XliRCQS9cBUlZhlNbsUPq1ioA";

const PERSONA = "11111111-1111-4111-8111-111111111111";

const client = new pg.Client({ connectionString: PREVIEW_DB });
await client.connect();
console.log("CONNECTED to Ireland preview (read-only)\n");

try {
  console.log("─── 1 · All nex_account_profile columns on Ireland preview ───");
  const col = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'nex_account_profile'
       ORDER BY ordinal_position`,
  );
  console.table(col.rows);

  console.log("\n─── 2 · nex_account_profile row for Irish Pride (dynamic SELECT *) ───");
  const p1 = await client.query(
    `SELECT * FROM nex_account_profile WHERE account_id = $1`,
    [PERSONA],
  );
  console.table(p1.rows);
} finally {
  await client.end();
}

// ─── Storage listings ─────────────────────────────────────────
async function list(bucket, prefix) {
  const url = new URL(`/storage/v1/object/list/${bucket}`, PREVIEW_URL);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PREVIEW_SERVICE_KEY,
      Authorization: `Bearer ${PREVIEW_SERVICE_KEY}`,
    },
    body: JSON.stringify({ prefix, limit: 100, offset: 0 }),
  });
  if (!res.ok) return { error: `${res.status} ${await res.text()}` };
  return { items: await res.json() };
}

console.log("\n─── 3 · Storage: nex-avatars under Irish Pride UUID ───");
const sa = await list("nex-avatars", PERSONA);
console.log(sa.error ? `  error: ${sa.error}` : `  ${sa.items?.length ?? 0} entries`);
if (sa.items) for (const o of sa.items.slice(0, 20)) console.log(`    ${o.name}  (${o.metadata?.size ?? "?"} bytes)`);

console.log("\n─── 4 · Storage: nex-music-media under Irish Pride UUID ───");
const sm = await list("nex-music-media", PERSONA);
console.log(sm.error ? `  error: ${sm.error}` : `  ${sm.items?.length ?? 0} entries`);
if (sm.items) for (const o of sm.items.slice(0, 20)) console.log(`    ${o.name}  (${o.metadata?.size ?? "?"} bytes)`);

console.log("\nDONE (read-only · no writes)");
