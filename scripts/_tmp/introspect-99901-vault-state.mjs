// scripts/_tmp/introspect-99901-vault-state.mjs
//
// Read-only introspection against sandbox kdstoyyeygcopkogqsyv to find
// the 99901 test account + its vault + shop state. No writes.
// Owner-authorised 2026-11-09 for the 6-digit vault test flow.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const ref = u.username.match(/\.([a-z0-9]{15,})/)?.[1]
  ?? u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}\n`);

const c = new Client({ connectionString: databaseUrl });
await c.connect();

async function q(sql, params = []) {
  const r = await c.query(sql, params);
  return r.rows;
}

// Step 1 · find nex_account candidates for "99901"
// Try common identifier columns: nex_id, legacy_nex_id, handle, username, display_name.
const cols = await q(
  `SELECT column_name
     FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
    ORDER BY ordinal_position`
);
console.log(`[1] nex_account columns (${cols.length}):`);
console.log("    " + cols.map((r) => r.column_name).join(", "));

// Try each likely text column with value '99901' or '%99901%'
const identCols = cols
  .map((r) => r.column_name)
  .filter((c) =>
    /nex_id|legacy_nex_id|handle|username|display_name|email|phone/.test(c)
  );
console.log(`\n[2] Searching ${identCols.length} identifier columns for '99901':`);
let matches = [];
for (const col of identCols) {
  try {
    const rows = await q(
      `SELECT id, ${col} AS v FROM nex_account WHERE ${col}::text ILIKE $1 LIMIT 5`,
      ["%99901%"],
    );
    if (rows.length > 0) {
      console.log(`    ${col} · ${rows.length} match(es):`);
      rows.forEach((r) => {
        console.log(`      id=${r.id}  ${col}=${r.v}`);
        matches.push({ id: r.id, col, v: r.v });
      });
    }
  } catch (e) {
    // column cast may fail on non-text types; skip
  }
}

if (matches.length === 0) {
  console.log("    No match on any identifier column. 99901 may not exist in sandbox.");
}

// Dedup matches by id
const uniqueIds = Array.from(new Set(matches.map((m) => m.id)));
console.log(`\n[3] Unique account_ids matched (${uniqueIds.length}): ${uniqueIds.join(", ") || "(none)"}`);

// Step 2 · for each matched id, show shop_tier + vault setup
for (const id of uniqueIds) {
  const acct = await q(
    `SELECT id, shop_tier FROM nex_account WHERE id = $1`,
    [id],
  );
  const shop = acct[0]?.shop_tier ?? null;
  console.log(`\n[4] Account ${id}:`);
  console.log(`    shop_tier = ${shop === null ? "NULL (NOT entitled · setup wizard will redirect to /vault upgrade surface)" : `'${shop}' (entitled)`}`);

  const vaultSetup = await q(
    `SELECT account_id, created_at
       FROM nex_vault_setup
      WHERE account_id = $1`,
    [id],
  );
  if (vaultSetup.length > 0) {
    console.log(`    nex_vault_setup · ROW EXISTS · created_at=${vaultSetup[0].created_at}`);
    console.log(`      → DELETE required to re-run the 6-digit setup wizard`);
  } else {
    console.log(`    nex_vault_setup · no row (first-time setup will run cleanly)`);
  }

  // Count vault envelopes + files (destructive check · will these be
  // orphaned if we delete the setup row?)
  const envs = await q(
    `SELECT COUNT(*)::int AS n FROM nex_vault_key_envelope WHERE account_id = $1`,
    [id],
  );
  const files = await q(
    `SELECT COUNT(*)::int AS n FROM nex_vault_file WHERE account_id = $1`,
    [id],
  );
  console.log(`    nex_vault_key_envelope · ${envs[0]?.n ?? 0} row(s)`);
  console.log(`    nex_vault_file         · ${files[0]?.n ?? 0} row(s)`);
}

await c.end();
