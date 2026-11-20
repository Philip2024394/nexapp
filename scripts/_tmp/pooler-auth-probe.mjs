// scripts/_tmp/pooler-auth-probe.mjs
// Try documented sandbox pooler host with existing passwords from .env.local.
// NEVER prints secrets. Only prints which env-var key authenticated (if any).
import { readFileSync } from "node:fs";
import { Client } from "pg";

const env = readFileSync(".env.local", "utf8");
function v(k) {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  if (!m) return null;
  let x = m[1].trim();
  if ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("'") && x.endsWith("'"))) x = x.slice(1, -1);
  return x || null;
}

const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const POOLER_HOST = "aws-0-eu-west-1.pooler.supabase.com"; // documented in CLAUDE.md
const PORTS = [6543, 5432]; // transaction mode, then session mode

const candidates = ["SANDBOX_DATABASE_URL", "DATABASE_URL", "NEX_POSTGRES_URL"];

for (const key of candidates) {
  const raw = v(key);
  if (!raw) { console.log(key + " <none>"); continue; }
  if (raw.includes(PROD_REF)) { console.log(key + " REFUSE · prod ref"); continue; }
  let parsed; try { parsed = new URL(raw); } catch { console.log(key + " unparseable"); continue; }
  // Build pooler URL using same password, pooler-style username.
  const password = decodeURIComponent(parsed.password);
  for (const port of PORTS) {
    const pooler = `postgresql://postgres.${SANDBOX_REF}:${encodeURIComponent(password)}@${POOLER_HOST}:${port}/postgres`;
    const c = new Client({ connectionString: pooler, ssl: { rejectUnauthorized: false }, statement_timeout: 10000 });
    try {
      await c.connect();
      const r = await c.query("SELECT current_user, current_database(), inet_server_addr()::text AS addr");
      console.log(`${key} :${port} → AUTH OK · user=${r.rows[0].current_user} db=${r.rows[0].current_database} addr=${r.rows[0].addr}`);
      await c.end();
      console.log("USE_KEY=" + key + " PORT=" + port);
      process.exit(0);
    } catch (e) {
      console.log(`${key} :${port} → ${e.code || "ERR"} ${e.message.slice(0, 80)}`);
      try { await c.end(); } catch {}
    }
  }
}
console.log("NO_AUTH_PATH");
process.exit(2);
