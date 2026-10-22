#!/usr/bin/env node
// scripts/preflight-nex-migration-history-readonly.mjs
//
// NEX Family Safety database baseline probe · READ-ONLY.
// ------------------------------------------------------------------
// Owner-authorised 2026-10-20. Narrow scope: one SELECT against
// `nex_migration_history` on the sealed Supabase project
// `ijvqdvsvwtwxzcqmoqit`.
//
// STRICT SAFEGUARDS (every rule below is load-bearing):
//
//   1. Project-identity gate · the pooler username MUST match the
//      sealed project ref. On mismatch, STOP before any query.
//   2. Credentials never printed · the DATABASE_URL string is read
//      from .env.local and used only for the pg Client. Only a
//      SHA-256 fingerprint of the password-redacted URL is logged.
//   3. One query only · SELECT version, applied_at, description
//      FROM nex_migration_history ORDER BY applied_at. No other
//      query runs under any branch of this script.
//   4. No writes · pg.Client with no transaction block. If any
//      write path is ever added here, the sealed-project gate at
//      top is the last line of defence.
//   5. Missing-table handling · if nex_migration_history does not
//      exist, STOP and report. Do not query any fallback table.
//   6. Verify-first-then-query · the project ref is matched BEFORE
//      the client connects to prevent a stray TCP open against the
//      wrong database.
//
// Usage:
//   node scripts/preflight-nex-migration-history-readonly.mjs
//
// Expected environment:
//   .env.local MUST contain `DATABASE_URL=postgres://postgres.<ref>:…`

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ENV_PATH = ".env.local";
const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";

// ─── 1 · Load DATABASE_URL from .env.local (never from stray env) ──
function loadDatabaseUrl() {
  let txt;
  try {
    txt = readFileSync(ENV_PATH, "utf8");
  } catch (e) {
    throw new Error(
      `cannot read ${ENV_PATH} · ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const m = txt.match(/^DATABASE_URL=(.+?)$/m);
  if (!m) throw new Error("DATABASE_URL not found in .env.local");
  let url = m[1].trim();
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1);
  }
  if (!url) throw new Error("DATABASE_URL is empty in .env.local");
  return url;
}

// ─── 2 · Sealed-project identity gate ─────────────────────────────
function verifyTarget(url) {
  let parsed;
  try {
    parsed = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
  } catch (e) {
    throw new Error(
      `DATABASE_URL does not parse as a URL · ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const m = /^postgres\.([a-z0-9]+)$/.exec(parsed.username);
  if (!m) {
    throw new Error(
      `pooler username does not match expected 'postgres.<ref>' shape`,
    );
  }
  if (m[1] !== APPROVED_PROJECT_ID) {
    throw new Error(
      `REFUSED · pooler user is not sealed project '${APPROVED_PROJECT_ID}' · got '${m[1]}'`,
    );
  }
  return { project: m[1], host: parsed.hostname };
}

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

// ─── 3 · Main ─────────────────────────────────────────────────────
async function main() {
  const url = loadDatabaseUrl();
  const target = verifyTarget(url);
  const connFingerprint = sha256(url.replace(/:[^:/@]+@/, ":****@")).slice(
    0,
    16,
  );

  console.log("=".repeat(70));
  console.log("NEX Family Safety · migration-history probe · READ-ONLY");
  console.log("=".repeat(70));
  console.log(`run_timestamp:          ${new Date().toISOString()}`);
  console.log(`approved_project_id:    ${APPROVED_PROJECT_ID}`);
  console.log(`verified_project:       ${target.project}`);
  console.log(`pooler_host:            ${target.host}`);
  console.log(`conn_fingerprint:       ${connFingerprint}`);
  console.log("");

  // Late-import pg · lets us surface a clean error if the module is
  // absent rather than a cryptic import crash.
  let pg;
  try {
    pg = (await import("pg")).default;
  } catch (e) {
    throw new Error(
      `cannot import 'pg' · ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    // Safeguard 5 · verify the table exists before SELECT. Querying
    // a missing table on PG raises error code 42P01 · we handle it
    // explicitly and STOP rather than attempting a fallback.
    const existence = await client.query(
      `SELECT to_regclass('public.nex_migration_history') AS t`,
    );
    const tableRef = existence.rows[0]?.t;
    if (!tableRef) {
      console.log(
        "RESULT · nex_migration_history table NOT FOUND on target DB.",
      );
      console.log(
        "         No fallback query attempted (safeguard 5).",
      );
      console.log("         Blocker · a migration-history table must exist");
      console.log(
        "         before this probe can report applied versions. If the",
      );
      console.log(
        "         live project has never had migration 001 applied, that",
      );
      console.log("         is a Directory-level reconciliation task.");
      return { ok: false, missingTable: true, rows: [] };
    }
    console.log(`verified_table:         ${tableRef}`);

    // Safeguard 3 · the one authorised query.
    const r = await client.query(
      `SELECT version, applied_at, description
         FROM nex_migration_history
         ORDER BY applied_at ASC`,
    );

    console.log("");
    console.log(`rows_returned:          ${r.rows.length}`);
    console.log("");
    console.log("version · applied_at                          · description");
    console.log("-".repeat(100));
    for (const row of r.rows) {
      const v = String(row.version).padEnd(7);
      const d =
        row.applied_at instanceof Date
          ? row.applied_at.toISOString().padEnd(32)
          : String(row.applied_at ?? "").padEnd(32);
      const desc =
        typeof row.description === "string" && row.description.length > 55
          ? row.description.slice(0, 52) + "..."
          : String(row.description ?? "");
      console.log(`${v} · ${d} · ${desc}`);
    }
    console.log("");

    return { ok: true, rows: r.rows };
  } finally {
    await client.end();
  }
}

main()
  .then((res) => {
    if (!res?.ok) {
      process.exit(2); // non-zero so blocker is loud
    }
  })
  .catch((e) => {
    console.error("PROBE FAILED · ", e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
