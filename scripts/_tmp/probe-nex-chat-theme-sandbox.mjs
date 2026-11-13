// Read-only · list all rows in nex_chat_theme sandbox.
// Scope: list ids + names + tiers so we understand the gap between
// the LIBRARY_THEMES code catalog (155 entries) and the DB table.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const ref = u.username.match(/\.([a-z0-9]{15,})/)?.[1]
  ?? u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · ${ref}`); process.exit(2); }

const c = new Client({ connectionString: databaseUrl });
await c.connect();

const total = await c.query(`SELECT count(*)::int AS n FROM nex_chat_theme`);
console.log(`nex_chat_theme total rows in sandbox: ${total.rows[0].n}`);

const byTier = await c.query(`SELECT tier, count(*)::int AS n FROM nex_chat_theme GROUP BY tier ORDER BY tier`);
console.log(`\nBy tier:`);
byTier.rows.forEach(r => console.log(`  ${r.tier}: ${r.n}`));

const all = await c.query(`SELECT id, name, tier, category, is_active FROM nex_chat_theme ORDER BY sort_order, id LIMIT 50`);
console.log(`\nAll rows (first 50):`);
all.rows.forEach(r => console.log(`  ${r.id}  · "${r.name}"  · tier=${r.tier}  · cat=${r.category}  · active=${r.is_active}`));

await c.end();
