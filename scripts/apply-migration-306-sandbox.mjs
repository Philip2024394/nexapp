// scripts/apply-migration-306-sandbox.mjs
//
// Owner-authorised 2026-11-08 (round 22) · Call Center invite flow.
// Applies 306_nex_peer_message_call_invite.sql to sandbox only.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const refFromUser = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
const refFromHost = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1] ?? null;
const ref = refFromUser ?? refFromHost;
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}`);

const sql = readFileSync(
  resolve(repoRoot, "nex-supabase/migrations/306_nex_peer_message_call_invite.sql"),
  "utf8",
);
const c = new Client({ connectionString: databaseUrl });
try {
  await c.connect();
  await c.query("BEGIN");
  await c.query(sql);
  await c.query("COMMIT");
  console.log("Migration applied · committed");
} catch (e) {
  console.error("Apply failed:", e?.message);
  try { await c.query("ROLLBACK"); } catch {}
  process.exit(3);
} finally {
  await c.end();
}

const v = new Client({ connectionString: databaseUrl });
await v.connect();
try {
  const ck = await v.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'nex_peer_message_attachment_type_check'`,
  );
  const hist = await v.query(
    `SELECT version, description FROM nex_migration_history WHERE version='306'`,
  );
  console.log(`✓ CHECK: ${ck.rows[0]?.def}`);
  console.log(`✓ Ledger: ${hist.rows[0]?.version} · ${hist.rows[0]?.description}`);
  if (!/call_invite/.test(ck.rows[0]?.def ?? "")) {
    console.error("FAIL · call_invite not in CHECK");
    process.exit(4);
  }
} finally {
  await v.end();
}
console.log("DONE · sandbox migration 306 applied + verified");
