// scripts/_tmp/probe-mig363-pre-state.mjs
// Captures pre-state for migration 363 on the sandbox. Never prints the
// connection string. Prints (a) history head, (b) whether 363 already
// applied, (c) function metadata, (d) current ACL, (e) deployed body.
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { spawnSync } from "node:child_process";

const SANDBOX = "kdstoyyeygcopkogqsyv";
const PROD = "ijvqdvsvwtwxzcqmoqit";
const u = spawnSync("node", ["scripts/_tmp/pooler-url.mjs"], { encoding: "utf8" });
if (u.status !== 0) { console.error("pooler-url failed", u.stderr); process.exit(2); }
const url = u.stdout.trim();
if (!url.includes(SANDBOX) || url.includes(PROD)) { console.error("STOP · bad url ref"); process.exit(3); }

const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 20000 });
await c.connect();
console.log("CONNECTED · pooler");

const head = await c.query(`SELECT version, applied_at FROM nex_migration_history ORDER BY applied_at DESC, version DESC LIMIT 5`);
console.log("HISTORY HEAD (top 5):");
for (const r of head.rows) console.log(`  ${r.version} @ ${r.applied_at}`);

const already = await c.query(`SELECT version, applied_at, description FROM nex_migration_history WHERE version = '363'`);
console.log("MIG 363 ROW: " + (already.rows.length ? JSON.stringify(already.rows[0]) : "<absent>"));

const fn = await c.query(`
  SELECT n.nspname, p.proname, p.prosecdef, p.proconfig,
         pg_get_function_identity_arguments(p.oid) AS sig,
         pg_get_userbyid(p.proowner) AS owner,
         md5(pg_get_functiondef(p.oid)) AS body_md5
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'nex_create_cart_order_tx'`);
console.log("FUNCTION META:");
for (const r of fn.rows) console.log(`  ${r.nspname}.${r.proname}(${r.sig}) secdef=${r.prosecdef} owner=${r.owner} proconfig=${JSON.stringify(r.proconfig)} body_md5=${r.body_md5}`);

const sig = "public.nex_create_cart_order_tx(uuid,uuid,uuid,text,jsonb,text,uuid,uuid,text,text)";
for (const role of ["public", "anon", "authenticated", "service_role"]) {
  const r = await c.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS v", [role, sig]);
  console.log(`  PRIV ${role}: ${r.rows[0].v}`);
}

const acl = await c.query(`SELECT p.proacl::text AS acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='nex_create_cart_order_tx'`);
console.log("RAW ACL: " + (acl.rows[0]?.acl ?? "<none>"));

await c.end();
console.log("DONE");
