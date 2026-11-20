// nex-supabase/candidate-migrations/apply-migration-353-sandbox.mjs.PREVIEW
//
// UNAPPLIED · REVIEW REQUIRED · DO NOT PROMOTE TO scripts/ WITHOUT
// SEPARATE AUTHORISATION NAMING THE SANDBOX
//
// This is a reviewable PREVIEW of the apply-script that WOULD live at
// `scripts/apply-migration-353-sandbox.mjs` if the owner approved the
// Lane G-B transactional candidate for the sandbox. The `.PREVIEW`
// extension keeps it out of any `node scripts/apply-migration-*.mjs`
// invocation and out of any filename glob the rest of the codebase
// uses.
//
// Promotion path (requires separate authorisation):
//   1. Move this file to `scripts/apply-migration-353-sandbox.mjs`.
//   2. Move
//      `nex-supabase/candidate-migrations/353_nex_group_call_invite_transactional_PREVIEW.sql`
//      to `nex-supabase/migrations/353_nex_group_call_invite_transactional.sql`
//      (strip the `_PREVIEW` tail of the filename · the SQL body stays
//      the same).
//   3. Move the matching `_rollback_PREVIEW` file to
//      `nex-supabase/migrations/353_nex_group_call_invite_transactional_rollback.sql`.
//   4. Run `node scripts/apply-migration-353-sandbox.mjs` ONCE.
//   5. Keep the TypeScript wrapper disabled until BROWSER-tier
//      verification against the sandbox passes (separate step · not
//      this script's responsibility).
//
// Safety guards (identical pattern to apply-migration-348-sandbox.mjs):
//   · Reads SANDBOX_DATABASE_URL from `.env.local`.
//   · Hard-refuses to run if the URL is missing.
//   · Hard-refuses to run if the URL does NOT contain the sandbox
//     project ref `kdstoyyeygcopkogqsyv`.
//   · Hard-refuses to run if the URL DOES contain the production
//     project ref `ijvqdvsvwtwxzcqmoqit`.
//   · Prints the target database name before executing.
//   · Reads the SQL from the POST-PROMOTION path · a run against the
//     PREVIEW filename will fail readFileSync. This is intentional ·
//     the script CANNOT execute against the quarantined preview file.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envRaw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");

function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v || null;
}

const SANDBOX_DATABASE_URL = envValue("SANDBOX_DATABASE_URL");
if (!SANDBOX_DATABASE_URL) {
  console.error("STOP · SANDBOX_DATABASE_URL missing from .env.local");
  process.exit(1);
}
if (!SANDBOX_DATABASE_URL.includes("kdstoyyeygcopkogqsyv")) {
  console.error("STOP · SANDBOX_DATABASE_URL does not contain sandbox project ref");
  process.exit(2);
}
if (SANDBOX_DATABASE_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("STOP · SANDBOX_DATABASE_URL contains production project ref");
  process.exit(3);
}

// Promotion-only path. The script deliberately points at the
// post-promotion filename. Running this script BEFORE promoting the
// SQL will fail at readFileSync · the script CANNOT apply the
// quarantined PREVIEW file.
const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/353_nex_group_call_invite_transactional.sql"),
  "utf8",
);

const client = new Client({ connectionString: SANDBOX_DATABASE_URL });
await client.connect();

const target = await client.query("SELECT current_database() AS db");
console.log("Target:", target.rows[0]);

try {
  await client.query(sql);
  console.log("✓ mig 353 applied");

  const fn = await client.query(
    `SELECT proname, prosecdef, proconfig
       FROM pg_proc
      WHERE proname = 'nex_invite_to_call_tx'`,
  );
  console.log("\n=== nex_invite_to_call_tx (security_definer + proconfig) ===");
  console.table(fn.rows);

  const grants = await client.query(
    `SELECT grantee, privilege_type
       FROM information_schema.role_routine_grants
      WHERE routine_name = 'nex_invite_to_call_tx'
      ORDER BY grantee, privilege_type`,
  );
  console.log("\n=== grants ===");
  console.table(grants.rows);

  const history = await client.query(
    `SELECT version, description, notes
       FROM nex_migration_history
      WHERE version = '353'`,
  );
  console.log("\n=== nex_migration_history row ===");
  console.table(history.rows);
} finally {
  await client.end();
}
