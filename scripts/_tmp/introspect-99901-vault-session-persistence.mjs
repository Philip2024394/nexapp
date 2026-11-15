// scripts/_tmp/introspect-99901-vault-session-persistence.mjs
//
// Read-only introspection of Hammerex (nex-99901) vault + lockout state
// against sandbox kdstoyyeygcopkogqsyv. Used before/after the
// session-persistence.spec.ts run to prove no vault mutation.
// Sandbox-only · hard refuses production ref.

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
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const ref =
  u.username.match(/\.([a-z0-9]{15,})/)?.[1] ??
  u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref === "ijvqdvsvwtwxzcqmoqit") {
  console.error("STOP · production ref");
  process.exit(2);
}
if (ref !== "kdstoyyeygcopkogqsyv") {
  console.error(`STOP · unknown ref ${ref}`);
  process.exit(2);
}

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111"; // Hammerex / nex-99901

const c = new Client({ connectionString: databaseUrl });
await c.connect();

async function q(sql, params = []) {
  const r = await c.query(sql, params);
  return r.rows;
}

const setup = await q(
  `SELECT account_id, created_at
     FROM nex_vault_setup
    WHERE account_id = $1`,
  [ACCOUNT_ID],
);

const lockoutCols = await q(
  `SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_vault_pin_lockout'`,
);
const hasLockoutTable = lockoutCols.length > 0;

let lockout = [];
if (hasLockoutTable) {
  lockout = await q(
    `SELECT * FROM nex_vault_pin_lockout WHERE account_id = $1`,
    [ACCOUNT_ID],
  );
}

const envelopes = await q(
  `SELECT COUNT(*)::int AS n FROM nex_vault_key_envelope WHERE account_id = $1`,
  [ACCOUNT_ID],
);

const payload = {
  sandbox_ref: ref,
  account_id: ACCOUNT_ID,
  nex_vault_setup_row: setup[0] ?? null,
  nex_vault_pin_lockout_row: lockout[0] ?? null,
  nex_vault_key_envelope_count: envelopes[0]?.n ?? 0,
  at: new Date().toISOString(),
};

console.log(JSON.stringify(payload, null, 2));

await c.end();
