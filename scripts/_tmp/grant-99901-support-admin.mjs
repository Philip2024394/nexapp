// scripts/_tmp/grant-99901-support-admin.mjs
//
// Owner-authorised 2026-11-10 · insert 99901 into nex.support_admin_grant
// so the test account can use the HQ support tickets admin surface.
// Idempotent · ON CONFLICT DO NOTHING. Sandbox-only · hard prod refusal.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const ACCT_99901 = "11111111-1111-4111-8111-111111111111";

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const ref = u.username.match(/\.([a-z0-9]{15,})/)?.[1]
  ?? u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }

const c = new Client({ connectionString: databaseUrl });
await c.connect();
try {
  const pre = await c.query(
    "SELECT 1 FROM nex.support_admin_grant WHERE account_id = $1",
    [ACCT_99901],
  );
  if (pre.rowCount === 1) {
    console.log(`BEFORE: 99901 already admin · no-op`);
  } else {
    console.log(`BEFORE: 99901 not an admin`);
  }
  await c.query(
    `INSERT INTO nex.support_admin_grant (account_id)
     VALUES ($1)
     ON CONFLICT (account_id) DO NOTHING`,
    [ACCT_99901],
  );
  const post = await c.query(
    "SELECT account_id, granted_at FROM nex.support_admin_grant WHERE account_id = $1",
    [ACCT_99901],
  );
  if (post.rowCount !== 1) { console.error("✗ grant missing"); process.exit(3); }
  console.log(`AFTER : 99901 granted · granted_at=${post.rows[0].granted_at}`);
  console.log(`\n✓ 99901 can now visit /nex-native/hq/support-tickets`);
} finally {
  await c.end();
}
