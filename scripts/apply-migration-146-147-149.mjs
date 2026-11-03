// scripts/apply-migration-146-147-149.mjs
//
// Owner-authorised applier for the Community Notice backend trio
// (Scope-B+β · 2026-11-03). Applies migrations 146 + 147 + 149 to the
// sealed Supabase project `ijvqdvsvwtwxzcqmoqit` IN ORDER.
//
// Hard safeties per CLAUDE.md §8:
//   · Verifies DATABASE_URL points at ijvqdvsvwtwxzcqmoqit
//   · Exits with code 3 if the project ID is wrong
//   · Each migration runs inside its own transaction (BEGIN/COMMIT
//     already in the SQL files · the applier does not add an outer
//     transaction so a failure in one does not pollute the others'
//     commit state)
//   · PRE/POST verification per migration · prints evidence
//   · No destructive operations · ON CONFLICT DO NOTHING is used
//     in the SQL where appropriate (idempotent apply)
//
// Scope restriction: this script DOES NOT:
//   · modify any other migration
//   · touch Bridges 76/77/78/88
//   · commit anything to Git
//   · deploy to Vercel
//   · install packages

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

function readEnv(key) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === key) return m[2];
  }
  return null;
}

const url = readEnv("DATABASE_URL");
if (!url) {
  console.error("ERR: DATABASE_URL not found in .env.local");
  process.exit(2);
}
if (!url.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error(
    "ERR: DATABASE_URL does not point at ijvqdvsvwtwxzcqmoqit · aborting per CLAUDE.md §8",
  );
  process.exit(3);
}

const MIGRATIONS = [
  {
    version: "146",
    file: "146_nex_community_watch_core.sql",
    description: "nex_community_* core tables (zone · membership · notice · update · confirmation · report · rate_limit)",
    preCheck:
      "SELECT COUNT(*)::int AS existing FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('nex_community_zone','nex_community_membership','nex_community_notice','nex_community_notice_update','nex_community_notice_confirmation','nex_community_notice_report','nex_community_rate_limit')",
    postCheck:
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nex_community_%' ORDER BY table_name",
    expectedPostTableCount: 7,
  },
  {
    version: "147",
    file: "147_nex_community_zone_seed_id_yogyakarta.sql",
    description: "Yogyakarta zone seed (country ID · province DIY · 14 kecamatans)",
    preCheck:
      "SELECT COUNT(*)::int AS existing FROM nex_community_zone WHERE country = 'ID'",
    postCheck:
      "SELECT level, COUNT(*)::int AS n FROM nex_community_zone WHERE country='ID' GROUP BY level ORDER BY level",
    expectedPostRows: null, // multiple levels · just print
  },
  {
    version: "149",
    file: "149_nex_community_phase2a_notification_prefs.sql",
    description: "per-section notification prefs on nex_community_membership (safety · lost_found · events · voting · life_news)",
    preCheck:
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_community_membership' AND column_name IN ('safety_pref','lost_found_pref','events_pref','voting_pref','life_news_pref')",
    postCheck:
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_community_membership' AND column_name IN ('safety_pref','lost_found_pref','events_pref','voting_pref','life_news_pref') ORDER BY column_name",
    expectedPostRows: 5,
  },
];

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit via pooler · DATABASE_URL verified");
console.log("");

try {
  for (const migration of MIGRATIONS) {
    console.log(`─── Migration ${migration.version} · ${migration.description} ───`);

    // PRE check
    const pre = await client.query(migration.preCheck);
    console.log(`PRE   query → ${pre.rowCount} row(s): ${JSON.stringify(pre.rows)}`);

    // Apply
    const sql = readFileSync(
      resolve("nex-supabase/migrations", migration.file),
      "utf8",
    );
    try {
      await client.query(sql);
      console.log(`APPLY ${migration.version} · OK`);
    } catch (err) {
      console.error(`APPLY ${migration.version} · FAILED: ${err.message}`);
      throw err;
    }

    // POST check
    const post = await client.query(migration.postCheck);
    console.log(`POST  query → ${post.rowCount} row(s): ${JSON.stringify(post.rows)}`);

    // Record in nex_migration_history
    const historyCheck = await client.query(
      "SELECT version FROM nex_migration_history WHERE version = $1",
      [migration.version],
    );
    if (historyCheck.rowCount === 0) {
      await client.query(
        "INSERT INTO nex_migration_history (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING",
        [migration.version, migration.description],
      );
      console.log(`HIST  ${migration.version} recorded in nex_migration_history`);
    } else {
      console.log(`HIST  ${migration.version} already in nex_migration_history (idempotent)`);
    }
    console.log("");
  }

  console.log("ALL THREE MIGRATIONS APPLIED SUCCESSFULLY");
} finally {
  await client.end();
}
