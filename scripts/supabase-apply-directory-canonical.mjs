#!/usr/bin/env node
// scripts/supabase-apply-directory-canonical.mjs
//
// Applies the directory canonical layer migrations (166-183, ported
// from D:/trades/deploy/postgres/init/) to the sealed NEX Supabase
// project.
//
// Safety:
//   · HARD-GATES on the project id in DATABASE_URL · if it is not
//     ijvqdvsvwtwxzcqmoqit the script refuses to run.
//   · Each migration applies in its own transaction · one failure
//     does not partially commit.
//   · Idempotent via public.nex_migration_history · a repeat run
//     skips already-applied migrations.
//   · DDL only · no data copy · no can_display flip · no
//     attribution_template seed · no bulk INSERTs beyond what the
//     migration SQL itself contains.
//
// Usage:
//   node --env-file=.env.local scripts/supabase-apply-directory-canonical.mjs           · live apply
//   node --env-file=.env.local scripts/supabase-apply-directory-canonical.mjs --dry-run · parse-only, print SQL stats

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(__dirname, "..", "nex-supabase", "migrations");
const APPROVED_PROJECT_HOST_PREFIX = "aws-0-eu-west-1.pooler.supabase.com";
const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";

const DRY_RUN = process.argv.includes("--dry-run");

function verifyTarget(url) {
  const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
  const host = u.hostname;
  const userPart = u.username;
  if (!host.endsWith(APPROVED_PROJECT_HOST_PREFIX)) {
    throw new Error(`REFUSED · host '${host}' is not the sealed Supabase pooler`);
  }
  // Pooler user shape is "postgres.<project-id>" · verify the id.
  const match = /^postgres\.(?<id>[a-z0-9]+)$/.exec(userPart);
  if (!match || match.groups.id !== APPROVED_PROJECT_ID) {
    throw new Error(
      `REFUSED · pooler user '${userPart}' is not sealed project '${APPROVED_PROJECT_ID}'`,
    );
  }
  return { host, user: userPart, project: APPROVED_PROJECT_ID };
}

function targetedMigrations() {
  const all = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql"));
  const picked = all.filter((f) => {
    const m = /^(\d{3})_/.exec(f);
    if (!m) return false;
    const n = Number(m[1]);
    return n >= 166 && n <= 183;
  });
  picked.sort();
  return picked;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set · load .env.local first");
  const target = verifyTarget(url);
  console.log(
    `DB target  :  pooler=${target.host} · project=${target.project}`,
  );
  console.log(`mode       :  ${DRY_RUN ? "DRY-RUN" : "LIVE"}`);

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const migs = targetedMigrations();
  console.log(`migrations :  ${migs.length} candidates in 166-183 range`);
  console.log("");

  // Load the migration history
  const histRows = await client.query(
    "SELECT version FROM public.nex_migration_history",
  );
  const applied = new Set(histRows.rows.map((r) => r.version));

  const summary = {
    applied: 0,
    skipped_already_present: 0,
    failed: 0,
    failures: [],
  };

  for (const file of migs) {
    const m = /^(\d{3})_/.exec(file);
    const version = m[1];
    const path = join(MIG_DIR, file);
    const sql = readFileSync(path, "utf8");

    if (applied.has(version)) {
      summary.skipped_already_present++;
      console.log(`[skip] ${file} · already in nex_migration_history`);
      continue;
    }

    if (DRY_RUN) {
      const stmts = sql
        .split(/;\s*$/m)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));
      console.log(
        `[dry] ${file} · ${sql.length} chars · ~${stmts.length} statements`,
      );
      summary.applied++;
      continue;
    }

    console.log(`[apply] ${file} · ${sql.length} chars`);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO public.nex_migration_history (version, description, applied_at) VALUES ($1, $2, now()) ON CONFLICT (version) DO NOTHING",
        [version, `supabase-apply-directory-canonical · ${file}`],
      );
      await client.query("COMMIT");
      summary.applied++;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      const reason = String(e.message || e).slice(0, 220);
      summary.failed++;
      summary.failures.push({ file, reason });
      console.log(`  ✗ FAILED · ${reason}`);
    }
  }

  console.log("");
  console.log("=== summary ===");
  console.log(JSON.stringify(summary, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
