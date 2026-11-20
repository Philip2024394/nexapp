// scripts/_tmp/pooler-region-sweep.mjs
// Sweep documented Supabase pooler regions for the sandbox tenant.
// Never prints secrets. Stops at first authenticated region.
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
const REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-central-2", "eu-north-1", "eu-south-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-south-1",
  "sa-east-1", "ca-central-1",
];
const PORT = 6543;

const raw = v("SANDBOX_DATABASE_URL") || v("DATABASE_URL");
if (!raw) { console.error("no DB URL"); process.exit(2); }
if (raw.includes(PROD_REF)) { console.error("REFUSE · prod ref"); process.exit(3); }
const parsed = new URL(raw);
const password = decodeURIComponent(parsed.password);

for (const r of REGIONS) {
  for (const prefix of ["aws-0", "aws-1"]) {
  const host = `${prefix}-${r}.pooler.supabase.com`;
  const url = `postgresql://postgres.${SANDBOX_REF}:${encodeURIComponent(password)}@${host}:${PORT}/postgres`;
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 7000, statement_timeout: 7000 });
  try {
    await c.connect();
    const q = await c.query("SELECT current_database() d, current_user u");
    console.log(`REGION ${prefix}-${r} :${PORT} → AUTH OK db=${q.rows[0].d} user=${q.rows[0].u}`);
    await c.end();
    console.log("FOUND_HOST=" + host);
    process.exit(0);
  } catch (e) {
    const msg = (e.message || "").slice(0, 90);
    console.log(`REGION ${prefix}-${r} :${PORT} → ${e.code || "ERR"} ${msg}`);
    try { await c.end(); } catch {}
  }
  }
}
console.log("NO_REGION_MATCH");
process.exit(2);
