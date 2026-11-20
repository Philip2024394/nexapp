#!/usr/bin/env node
// scripts/audit-wholesale-350-351-pg-catalog-sandbox.mjs
//
// Read-only pg_catalog audit · direct Postgres connection to sandbox
// using the DATABASE_URL already configured in .env.local. Verifies the
// elements PostgREST cannot reach: indexes, triggers, functions, RLS
// policies, column CHECK constraints, GRANTs.
//
// Issues ONLY SELECT statements. No INSERT/UPDATE/DELETE/DDL/DCL.
// Hard-refuses if DATABASE_URL isn't sandbox `kdstoyyeygcopkogqsyv`.
//
// 2026-11-18 · prompt-3 §2 reconciliation.

import pg from "pg";
import fs from "node:fs";
import path from "node:path";

function loadEnv(p) {
  if (!fs.existsSync(p)) return;
  for (const raw of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnv(path.resolve(process.cwd(), ".env.local"));

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(2);
}
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
if (!dbUrl.includes(SANDBOX_REF)) {
  console.error(
    `REFUSED · DATABASE_URL is not sandbox (${SANDBOX_REF}).`,
  );
  process.exit(3);
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

async function q(sql, params = []) {
  const r = await client.query(sql, params);
  return r.rows;
}

const TABLES = ["nex_wholesale_buyer_approval", "nex_wholesale_quote"];

const out = {
  project_ref: SANDBOX_REF,
  ts: new Date().toISOString(),
  tables: {},
};

for (const t of TABLES) {
  const tableRow = (
    await q(
      `SELECT table_schema, table_name
         FROM information_schema.tables
         WHERE table_schema='public' AND table_name=$1`,
      [t],
    )
  )[0];
  if (!tableRow) {
    out.tables[t] = { exists: false };
    continue;
  }

  const columns = await q(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1
       ORDER BY ordinal_position`,
    [t],
  );

  const checks = await q(
    `SELECT con.conname, pg_get_constraintdef(con.oid) AS def
       FROM pg_constraint con
       JOIN pg_class c ON c.oid=con.conrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname=$1 AND con.contype IN ('c','u','p','f')
       ORDER BY con.conname`,
    [t],
  );

  const indexes = await q(
    `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname='public' AND tablename=$1
       ORDER BY indexname`,
    [t],
  );

  const triggers = await q(
    `SELECT tgname,
            pg_get_triggerdef(oid) AS def,
            tgenabled
       FROM pg_trigger
       WHERE tgrelid=(
         SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relname=$1)
         AND NOT tgisinternal
       ORDER BY tgname`,
    [t],
  );

  const policies = await q(
    `SELECT polname,
            CASE polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                 WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                 WHEN '*' THEN 'ALL' END AS cmd,
            pg_get_expr(polqual, polrelid) AS using_expr,
            pg_get_expr(polwithcheck, polrelid) AS check_expr,
            polroles::regrole[] AS roles
       FROM pg_policy
       WHERE polrelid=(
         SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relname=$1)
       ORDER BY polname`,
    [t],
  );

  const rlsStatus = (
    await q(
      `SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced
         FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relname=$1`,
      [t],
    )
  )[0];

  const grants = await q(
    `SELECT grantee, privilege_type
       FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name=$1
       ORDER BY grantee, privilege_type`,
    [t],
  );

  out.tables[t] = {
    exists: true,
    columns,
    constraints: checks,
    indexes,
    triggers,
    rls: rlsStatus,
    policies,
    grants,
  };
}

const FUNCTIONS = [
  "nex_wholesale_buyer_approval_touch_updated_at",
  "nex_wholesale_quote_touch_updated_at",
  "nex_wholesale_quote_buyer_column_guard",
];
out.functions = {};
for (const fn of FUNCTIONS) {
  const rows = await q(
    `SELECT n.nspname AS schema, p.proname AS name,
            l.lanname AS language,
            CASE p.prosecdef WHEN TRUE THEN 'DEFINER' ELSE 'INVOKER' END AS security,
            p.proconfig AS config
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid=p.pronamespace
       JOIN pg_language l ON l.oid=p.prolang
       WHERE n.nspname='public' AND p.proname=$1`,
    [fn],
  );
  out.functions[fn] = rows.length > 0 ? rows[0] : { exists: false };
}

await client.end();
console.log(JSON.stringify(out, null, 2));
