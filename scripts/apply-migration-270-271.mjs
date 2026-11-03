// scripts/apply-migration-270-271.mjs
// Applies 270 (user-created zone moderation surface) + 271 (Wexford
// local-area pilot seed) to the sealed ijvqdvsvwtwxzcqmoqit project.
// Strips the DRAFT apply-guard DO block before running · the sealed
// convention is "comment out when applying" · we strip the guard
// client-side so the committed migration file keeps the convention
// visible.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

function readEnv(k) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === k) return m[2];
  }
  return null;
}

const url = readEnv("DATABASE_URL");
if (!url?.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: DATABASE_URL not pointing at ijvqdvsvwtwxzcqmoqit");
  process.exit(3);
}

function stripDraftGuard(sql, migrationVersion) {
  const pattern = new RegExp(
    `-- Apply guard\\s*\\nDO \\$\\$ BEGIN\\s*\\n\\s*RAISE EXCEPTION 'Migration ${migrationVersion} is DRAFT[^']*';\\s*\\nEND \\$\\$;`,
    "m",
  );
  return sql.replace(
    pattern,
    `-- (DRAFT guard stripped at apply time · migration ${migrationVersion})`,
  );
}

const migs = [
  { version: "270", file: "270_nex_community_zone_user_created.sql" },
  { version: "271", file: "271_nex_community_zone_seed_ie_wexford_areas.sql" },
];

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit");

try {
  for (const m of migs) {
    console.log(`\n── Applying ${m.file} ──`);
    const sqlRaw = readFileSync(resolve("nex-supabase/migrations", m.file), "utf8");
    const sql = stripDraftGuard(sqlRaw, m.version);
    await client.query(sql);
    console.log(`OK ${m.version}`);
  }

  const r = await client.query(
    "SELECT version, description FROM nex_migration_history WHERE version IN ('270','271') ORDER BY version",
  );
  console.log("\nmigration_history:");
  r.rows.forEach((row) => console.log(`  ${row.version} · ${row.description.slice(0, 70)}`));

  const wex = await client.query(
    "SELECT count(*)::int AS c FROM nex_community_zone WHERE country='IE' AND level='neighbourhood' AND moderation_status='approved'",
  );
  console.log(`\nIE neighbourhood (approved) rows: ${wex.rows[0].c}`);
} finally {
  await client.end();
}
