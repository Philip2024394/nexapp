// nex-supabase/candidate-migrations/apply-migration-356-sandbox.mjs.PREVIEW
//
// UNAPPLIED · REVIEW REQUIRED · DO NOT PROMOTE TO scripts/ WITHOUT
// SEPARATE AUTHORISATION NAMING THE SANDBOX
//
// Reviewable PREVIEW of the apply-script that WOULD live at
// `scripts/apply-migration-356-sandbox.mjs` if the owner approves
// mig-356 for sandbox `kdstoyyeygcopkogqsyv`.  The `.PREVIEW`
// extension keeps it out of any `node scripts/apply-migration-*.mjs`
// invocation and out of any filename glob the rest of the codebase
// uses.
//
// What mig-356 does (summary · full preamble in the SQL file)
//   · DROPs the mig-353 7-param signature of `nex_invite_to_call_tx`.
//   · CREATEs a new 7-param signature with identity derived solely
//     from `auth.uid()` (fail-closed on NULL) and `p_attachment_url`
//     threaded through the `nex_peer_message` INSERT so the
//     `nex_peer_message_attachment_pair_check` constraint is
//     satisfied by construction.
//   · REVOKEs PUBLIC and anon · GRANTs authenticated only.
//
// Promotion path (requires separate authorisation)
//   1. Move
//      `nex-supabase/candidate-migrations/356_nex_group_call_invite_v2_PREVIEW.sql`
//      to `nex-supabase/migrations/356_nex_group_call_invite_v2.sql`
//      (strip the `_PREVIEW` tail of the filename).
//   2. Move the matching rollback to
//      `nex-supabase/migrations/356_nex_group_call_invite_v2_rollback.sql`.
//   3. Move this file to `scripts/apply-migration-356-sandbox.mjs`.
//   4. Run `node scripts/apply-migration-356-sandbox.mjs` ONCE.
//
// Safety guards (identical pattern to apply-migration-353-sandbox.mjs)
//   · Reads SANDBOX_DATABASE_URL from `.env.local`.
//   · Hard-refuses to run if the URL is missing.
//   · Hard-refuses to run if the URL does NOT contain sandbox project
//     ref `kdstoyyeygcopkogqsyv`.
//   · Hard-refuses to run if the URL DOES contain production project
//     ref `ijvqdvsvwtwxzcqmoqit`.
//   · Prints the target database name before executing.
//   · Reads the SQL from the POST-PROMOTION path · a run against the
//     PREVIEW filename will fail readFileSync.  The script CANNOT
//     execute against the quarantined preview file.

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

// Promotion-only path · the script deliberately points at the
// post-promotion filename.  Running it BEFORE promoting the SQL
// will fail at readFileSync · the script CANNOT apply the
// quarantined PREVIEW file.
const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/356_nex_group_call_invite_v2.sql"),
  "utf8",
);

const client = new Client({ connectionString: SANDBOX_DATABASE_URL });
await client.connect();

const target = await client.query("SELECT current_database() AS db");
console.log("Target:", target.rows[0]);

try {
  await client.query(sql);
  console.log("✓ mig 356 applied");

  // === Signature verification ======================================
  // Confirm exactly ONE overload exists (the new 7-param one) · the
  // old signature from mig 353 must be absent.  If TWO rows appear
  // the DROP in mig-356 did not match the old signature and manual
  // review is required BEFORE any invite test.
  const overloads = await client.query(
    `SELECT oid, pg_get_function_arguments(oid) AS args
       FROM pg_proc
      WHERE proname = 'nex_invite_to_call_tx'
      ORDER BY oid`,
  );
  console.log("\n=== nex_invite_to_call_tx overloads (expect exactly 1) ===");
  console.table(overloads.rows);
  if (overloads.rows.length !== 1) {
    throw new Error(`EXPECTED exactly 1 overload · got ${overloads.rows.length} · STOP · no happy-path test should run until this is resolved`);
  }
  if (!overloads.rows[0].args.includes("p_attachment_url")) {
    throw new Error("EXPECTED new signature to contain p_attachment_url · STOP");
  }
  if (overloads.rows[0].args.includes("p_self_supabase_user_id")) {
    throw new Error("UNEXPECTED old parameter p_self_supabase_user_id still present · STOP");
  }

  // === Security-definer + search_path =============================
  const fn = await client.query(
    `SELECT proname, prosecdef, proconfig
       FROM pg_proc
      WHERE proname = 'nex_invite_to_call_tx'`,
  );
  console.log("\n=== nex_invite_to_call_tx (security_definer + proconfig) ===");
  console.table(fn.rows);

  // === Grants ======================================================
  // Expect: authenticated, postgres only.  anon must be ABSENT.
  // service_role is not granted on purpose (see SQL preamble).
  const grants = await client.query(
    `SELECT grantee, privilege_type
       FROM information_schema.role_routine_grants
      WHERE routine_name = 'nex_invite_to_call_tx'
      ORDER BY grantee, privilege_type`,
  );
  console.log("\n=== grants (expect: authenticated, postgres · NOT anon · NOT service_role unless postgres default) ===");
  console.table(grants.rows);
  const hasAnon = grants.rows.some((r) => r.grantee === "anon");
  if (hasAnon) {
    throw new Error("UNEXPECTED anon EXECUTE grant present · STOP");
  }

  // === Migration history row ======================================
  const history = await client.query(
    `SELECT version, description, notes
       FROM nex_migration_history
      WHERE version = '356'`,
  );
  console.log("\n=== nex_migration_history row ===");
  console.table(history.rows);
  if (history.rows.length !== 1) {
    throw new Error(`EXPECTED exactly 1 mig-356 history row · got ${history.rows.length}`);
  }
} finally {
  await client.end();
}
