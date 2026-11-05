// scripts/apply-migration-280.mjs
//
// Owner-authorised 2026-11-05 iter 24 continuation · one-shot
// migration apply for 280_nex_product_background_media.sql against
// Supabase ijvqdvsvwtwxzcqmoqit.
//
// Hard pre-flight check per CLAUDE.md §8 · aborts if DATABASE_URL
// doesn't point at the sealed canonical NEX project. Runs the SQL
// inside a single transaction so a mid-apply failure rolls back.
//
// Idempotent · the migration uses `ADD COLUMN IF NOT EXISTS` so
// re-running is safe.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

function loadEnvVar(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const match = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) throw new Error(`${name} not found in .env.local`);
  let v = match[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

const databaseUrl = loadEnvVar("DATABASE_URL");

const EXPECTED_REF = "ijvqdvsvwtwxzcqmoqit";
const u = new URL(databaseUrl);
const refMatch = u.username.match(/\.([a-z0-9]{15,})/);
const projectRef = refMatch ? refMatch[1] : null;
console.log(`DB host:      ${u.hostname}`);
console.log(`DB username:  ${u.username}`);
console.log(`Project ref:  ${projectRef ?? "<UNKNOWN>"}`);
if (projectRef !== EXPECTED_REF) {
  console.error(
    `STOP · project ref "${projectRef}" is not the sealed NEX project "${EXPECTED_REF}" · aborting`,
  );
  process.exit(2);
}
console.log(`Pre-flight OK · targeting canonical NEX project ${EXPECTED_REF}`);

const migrationPath = resolve(
  repoRoot,
  "nex-supabase/migrations/280_nex_product_background_media.sql",
);
const sql = readFileSync(migrationPath, "utf8");
console.log(`Loaded migration · ${migrationPath} · ${sql.length} bytes`);

const client = new Client({ connectionString: databaseUrl });
try {
  await client.connect();
  console.log("Connected · beginning transaction");
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("Migration applied · transaction committed");
} catch (err) {
  console.error("Apply failed · rolling back:", err?.message ?? err);
  try {
    await client.query("ROLLBACK");
  } catch {
    /* nothing to roll back */
  }
  process.exit(3);
} finally {
  await client.end();
}

const verifier = new Client({ connectionString: databaseUrl });
await verifier.connect();
try {
  const cols = await verifier.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'nex_product'
        AND column_name IN (
          'background_video_id',
          'background_image_id',
          'background_image_url',
          'background_music_id'
        )
      ORDER BY column_name`,
  );
  console.log(`Verification · ${cols.rows.length}/4 columns present:`);
  for (const r of cols.rows) {
    console.log(`    - ${r.column_name} · ${r.data_type} · nullable=${r.is_nullable}`);
  }
  if (cols.rows.length !== 4) {
    console.error("STOP · expected 4 columns · migration did not land as expected");
    process.exit(4);
  }
} finally {
  await verifier.end();
}

console.log("DONE");
