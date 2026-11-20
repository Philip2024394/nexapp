#!/usr/bin/env node
// scripts/inspect-hammerex-rosa-auth-mapping-sandbox.mjs
//
// Read-only inspection of the Hammerex (nex-99901) and Rosa (nex-99903)
// accounts to explain what, if anything, prevents them from functioning
// as normal official accounts. Does NOT sign in, does NOT read any
// private message, chat, vault, or encryption-key data.
//
// Reads:
//   · auth.users (id, email, email_confirmed_at, last_sign_in_at,
//     is_sso_user, banned_until, deleted_at)
//   · public.nex_account (id, role, display_name, slug, created_at,
//     email_verified_at, status flags)
//   · public.nex_business rows owned by those nex_account.id (slug,
//     country_code, currency, is_published)
//
// 2026-11-18 · prompt-3 clarification §Hammerex/Rosa.

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
if (!dbUrl.includes("kdstoyyeygcopkogqsyv")) {
  console.error("REFUSED non-sandbox");
  process.exit(3);
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const EMAILS = ["p6-customer@nex.invalid", "p6-seller@nex.invalid"];

const authRows = (
  await client.query(
    `SELECT id, email, email_confirmed_at, confirmed_at, last_sign_in_at,
            is_sso_user, banned_until, deleted_at, created_at
       FROM auth.users
       WHERE lower(email) = ANY($1::text[])`,
    [EMAILS.map((e) => e.toLowerCase())],
  )
).rows;

// Introspect nex_account column set first — the schema may not have
// `email_verified_at` or other hoped-for columns.
const accountCols = (
  await client.query(
    `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name='nex_account'
       ORDER BY ordinal_position`,
  )
).rows.map((r) => r.column_name);

const accountRows = (
  await client.query(
    `SELECT *
       FROM public.nex_account
       WHERE supabase_user_id = ANY($1::uuid[])`,
    [authRows.map((u) => u.id)],
  )
).rows;

const businessRows = (
  await client.query(
    `SELECT *
       FROM public.nex_business
       WHERE owner_account_id = ANY($1::uuid[])`,
    [accountRows.map((a) => a.id)],
  )
).rows;

const vaultCols = (
  await client.query(
    `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema='public' AND table_name LIKE 'nex_vault%'`,
  )
).rows.map((r) => r.table_name);

await client.end();

console.log(
  JSON.stringify(
    {
      project_ref: "kdstoyyeygcopkogqsyv",
      ts: new Date().toISOString(),
      note:
        "Read-only inspection. No private message/chat/vault data " +
        "is read; only identity mappings + business ownership.",
      auth_users: authRows,
      nex_account_columns_available: accountCols,
      nex_account_rows: accountRows,
      nex_business_rows: businessRows,
      nex_vault_tables_present: vaultCols,
    },
    null,
    2,
  ),
);
