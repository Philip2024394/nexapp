// scripts/apply-migration-252-254-269.mjs
// Applies 252 (country_registry · 254 dependency), 254 (hq_action_log),
// and 269 (community actions enum expansion) to the sealed Supabase
// project. Each file carries its own DRAFT RAISE EXCEPTION guard · we
// strip it client-side before executing so the sealed convention stays
// visible in the committed migration file.

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

/** Strip the DRAFT apply-guard DO block so the migration can run.
 *  The sealed convention is "comment out when applying" · we honour
 *  the intent by stripping only this specific guard pattern. */
function stripDraftGuard(sql, migrationVersion) {
  const pattern = new RegExp(
    `-- Apply guard\\s*\\nDO \\$\\$\\s*BEGIN\\s*\\n\\s*RAISE EXCEPTION 'Migration ${migrationVersion} is DRAFT[^']*';\\s*\\nEND \\$\\$;`,
    "m",
  );
  return sql.replace(pattern, `-- (DRAFT guard stripped at apply time · migration ${migrationVersion})`);
}

const migs = [
  { version: "252", file: "252_nex_country_registry.sql" },
  { version: "254", file: "254_nex_hq_action_log.sql" },
  { version: "269", file: "269_nex_hq_action_log_community_actions.sql" },
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
    "SELECT version, description FROM nex_migration_history WHERE version IN ('252','254','269') ORDER BY version",
  );
  console.log("\nmigration_history:");
  r.rows.forEach((row) => console.log(`  ${row.version} · ${row.description.slice(0, 70)}`));

  const t = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('nex_country_registry','nex_hq_action_log') ORDER BY table_name",
  );
  console.log("\ntables created: " + JSON.stringify(t.rows));
} finally {
  await client.end();
}
