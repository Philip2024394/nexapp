// scripts/_tmp/probe-via-pooler.mjs — IPv4 security probe via pooler.
// Reads a derived pooler URL from ~/.nex-pooler-url.tmp (never
// committed). Hard-refuses if URL is not sandbox.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

const home = process.env.USERPROFILE || process.env.HOME || ".";
const url = readFileSync(resolve(home, ".nex-pooler-url.tmp"), "utf8").trim();
if (!url.includes("kdstoyyeygcopkogqsyv")) { console.error("STOP · not sandbox ref"); process.exit(2); }
if (url.includes("ijvqdvsvwtwxzcqmoqit")) { console.error("STOP · production ref"); process.exit(3); }

// Supabase pooler presents a shared AWS cert chain that isn't in
// Node's default trust store · dev-script-only override, SANDBOX ONLY.
const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const probe = async (label, sql, vals=[]) => {
  console.log("\n=== " + label + " ===");
  try { const r = await c.query(sql, vals); console.table(r.rows); }
  catch (e) { console.log("ERR:", e.message); }
};

await probe("function metadata",
  `SELECT n.nspname AS schema, p.proname, p.prosecdef AS security_definer,
          p.proconfig, r.rolname AS owner
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     JOIN pg_roles r ON r.oid = p.proowner
    WHERE p.proname = 'nex_create_cart_order_tx'`);

await probe("raw ACL",
  `SELECT p.proname, p.proacl::text AS acl
     FROM pg_proc p
    WHERE p.proname = 'nex_create_cart_order_tx'`);

await probe("role_routine_grants",
  `SELECT grantee, privilege_type, is_grantable
     FROM information_schema.role_routine_grants
    WHERE routine_name = 'nex_create_cart_order_tx'
    ORDER BY grantee, privilege_type`);

await probe("has_function_privilege",
  `SELECT has_function_privilege('anon','public.nex_create_cart_order_tx(uuid,uuid,uuid,text,jsonb,text,uuid,uuid,text,text)','execute') AS anon_can_execute,
          has_function_privilege('authenticated','public.nex_create_cart_order_tx(uuid,uuid,uuid,text,jsonb,text,uuid,uuid,text,text)','execute') AS authenticated_can_execute,
          has_function_privilege('service_role','public.nex_create_cart_order_tx(uuid,uuid,uuid,text,jsonb,text,uuid,uuid,text,text)','execute') AS service_role_can_execute`);

await probe("personas",
  `SELECT nex_handle, is_mock_persona, LEFT(id::text,8)||'…' AS id_pref,
          LEFT(supabase_user_id::text,8)||'…' AS sup_pref
     FROM nex_account
    WHERE nex_handle IN ('nex-99901','nex-99903')
    ORDER BY nex_handle`);

await probe("nex_product sample for Rosa (handbags-direct)",
  `SELECT LEFT(p.id::text,8)||'…' AS pid,
          LEFT(p.business_id::text,8)||'…' AS bid,
          p.price_pence, p.currency, p.title
     FROM nex_product p
     JOIN nex_business b ON b.id = p.business_id
     JOIN nex_account a ON a.id = b.owner_account_id
    WHERE a.nex_handle = 'nex-99903'
    LIMIT 3`);

await c.end();
console.log("\nOK");
