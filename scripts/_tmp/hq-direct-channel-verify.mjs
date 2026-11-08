#!/usr/bin/env node
// Quick sandbox verification · post-apply · migration 301 ledger + grants.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

let SBX_DB = process.env.SBX_DB;
if (!SBX_DB) {
  const envPath = path.join(repoRoot, ".env.local");
  if (fs.existsSync(envPath)) {
    const txt = fs.readFileSync(envPath, "utf8");
    const m = txt.match(/^SANDBOX_DATABASE_URL=(.+)$/m);
    if (m) SBX_DB = m[1].trim();
  }
}
if (!SBX_DB) throw new Error("SBX_DB not resolved");
if (SBX_DB.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("production ref · aborting");

const c = new pg.Client({ connectionString: SBX_DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const h = await c.query(
  `select version, description, applied_at from nex_migration_history where version = '301'`,
);
console.log("history row:", h.rows[0]);

const grants = await c.query(
  `select grantee, privilege_type from information_schema.table_privileges
    where table_name = 'nex_hq_direct_channel' order by grantee, privilege_type`,
);
console.log("table grants:");
for (const r of grants.rows) console.log("  " + r.grantee + ": " + r.privilege_type);

const rls = await c.query(
  `select relrowsecurity as rowsecurity, relname from pg_class where relname = 'nex_hq_direct_channel'`,
);
console.log("rls enabled:", rls.rows[0]?.rowsecurity);

const sentinel = await c.query(
  `select id, display_name, supabase_user_id from nex_account where id = '11111111-aaaa-aaaa-aaaa-111111111111'`,
);
console.log("sentinel:", sentinel.rows[0]);

const funcs = await c.query(
  `select p.proname, pg_get_function_arguments(p.oid) as args, p.prosecdef, pg_get_function_identity_arguments(p.oid) as ident
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('nex_hq_direct_channel_upsert','nex_hq_direct_send')`,
);
console.log("functions:");
for (const r of funcs.rows) console.log("  " + r.proname + "(" + r.ident + ") security_definer=" + r.prosecdef);

const funcGrants = await c.query(
  `select r.rolname as grantee, p.proname
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     cross join pg_roles r
    where n.nspname = 'public'
      and p.proname in ('nex_hq_direct_channel_upsert','nex_hq_direct_send')
      and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
      and r.rolname in ('anon','authenticated','service_role','public')
   order by p.proname, r.rolname`,
);
console.log("function execute grants:");
for (const r of funcGrants.rows) console.log("  " + r.proname + " -> " + r.grantee);

await c.end();
