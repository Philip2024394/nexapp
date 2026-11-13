// scripts/_tmp/grant-themes-plus-99901-sandbox.mjs
//
// Owner-authorised 2026-11-12 · grant Themes Plus access to the
// dev-impersonation account 99901 on sandbox kdstoyyeygcopkogqsyv so
// premium chat themes can be applied. Sets themes_plus_until to one
// year from now. Idempotent · running again just refreshes the expiry.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadEnvVar(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const match = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) throw new Error(`${name} not found in .env.local`);
  let v = match[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = loadEnvVar("SANDBOX_DATABASE_URL");
const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
const u = new URL(databaseUrl);
const refFromUser = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
const refFromHost = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1] ?? null;
const projectRef = refFromUser ?? refFromHost;

if (projectRef === PROD_REF) { console.error("STOP · production ref detected"); process.exit(2); }
if (projectRef !== SANDBOX_REF) { console.error(`STOP · ref "${projectRef}" is not SANDBOX`); process.exit(2); }

const NEX_99901_UUID = "11111111-1111-4111-8111-111111111111";

const c = new Client({ connectionString: databaseUrl });
await c.connect();

const pre = await c.query(
  `SELECT id, themes_plus_until FROM nex_account WHERE id = $1`,
  [NEX_99901_UUID],
);
console.log("pre:", pre.rows[0] ?? null);

const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
const upd = await c.query(
  `UPDATE nex_account SET themes_plus_until = $1 WHERE id = $2
   RETURNING id, themes_plus_until`,
  [oneYear, NEX_99901_UUID],
);
console.log("post:", upd.rows[0] ?? null);
console.log(`rows updated: ${upd.rowCount}`);

await c.end();
