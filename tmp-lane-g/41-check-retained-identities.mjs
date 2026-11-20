// tmp-lane-g/41-check-retained-identities.mjs
// Check sandbox for any retained auth.users / nex_account rows matching the
// disposable-identity email pattern. Read-only.

import { readFileSync } from "node:fs";
import pg from "pg";

function env(key) {
  const raw = readFileSync(".env.local", "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const url = env("SANDBOX_DATABASE_URL") ?? env("DATABASE_URL");
const parsed = new URL(url);
let ref = null;
if (parsed.hostname.endsWith(".pooler.supabase.com")) ref = parsed.username.match(/^postgres\.([a-z0-9]+)$/)?.[1];
else if (parsed.hostname.endsWith(".supabase.co")) ref = parsed.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/)?.[1];
if (ref !== "kdstoyyeygcopkogqsyv") { console.error("STOP · not sandbox"); process.exit(3); }

const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  // Count disposable-pattern rows. Pattern from HARNESS: nex-gate-a-<ts>-[ABC]@test....invalid
  const authUsers = (await c.query(
    `SELECT id, email, created_at FROM auth.users
      WHERE email LIKE 'nex-gate-a-%@test.kdstoyyeygcopkogqsyv.sandbox.invalid'
         OR email LIKE 'nex-gate-a-%'
      ORDER BY created_at DESC LIMIT 20`
  )).rows;
  console.log(`auth.users with nex-gate-a-* pattern: ${authUsers.length}`);
  for (const r of authUsers) console.log(`  ${r.id} · ${r.email} · ${r.created_at}`);

  const nexAccts = (await c.query(
    `SELECT id, supabase_user_id, created_at FROM nex_account
      WHERE supabase_user_id IN (SELECT id FROM auth.users WHERE email LIKE 'nex-gate-a-%')`
  )).rows;
  console.log(`nex_account linked to nex-gate-a-* auth users: ${nexAccts.length}`);
  for (const r of nexAccts) console.log(`  ${r.id} · sb=${r.supabase_user_id} · ${r.created_at}`);

  // Also check call-system tables for any stray rows from a prior V-* probe
  for (const tbl of ["nex_group_call_session", "nex_group_call_participant"]) {
    const n = (await c.query(`SELECT count(*)::int AS n FROM ${tbl}`)).rows[0].n;
    console.log(`${tbl}: ${n} total rows (sandbox-wide)`);
  }
} finally {
  try { await c.end(); } catch { /* ignore */ }
}
