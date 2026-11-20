// scripts/_tmp/probe-mig354-security.mjs — READ-ONLY security probe.
//
// Queries sandbox kdstoyyeygcopkogqsyv for the actual grants, body,
// and security properties of nex_create_cart_order_tx. Hard-refuses
// against the production project ref.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const env = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
function v(name){const m=env.match(new RegExp("^"+name+"=(.*)$","m"));if(!m)return null;let x=m[1].trim();if((x.startsWith("\"")&&x.endsWith("\""))||(x.startsWith("'")&&x.endsWith("'")))x=x.slice(1,-1);return x||null;}
const url = v("SANDBOX_DATABASE_URL");
if (!url) { console.error("STOP · SANDBOX_DATABASE_URL missing"); process.exit(1); }
if (!url.includes("kdstoyyeygcopkogqsyv")) { console.error("STOP · not sandbox ref"); process.exit(2); }
if (url.includes("ijvqdvsvwtwxzcqmoqit")) { console.error("STOP · production ref"); process.exit(3); }

const c = new Client({ connectionString: url });
await c.connect();

console.log("=== function exists + security_definer + search_path ===");
let r = await c.query(`
  SELECT n.nspname AS schema, p.proname, p.prosecdef AS security_definer,
         p.proconfig, r.rolname AS owner
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE p.proname = 'nex_create_cart_order_tx'`);
console.table(r.rows);

console.log("\n=== ACL (raw proacl) ===");
r = await c.query(`
  SELECT p.proname, p.proacl::text AS acl
  FROM pg_proc p
  WHERE p.proname = 'nex_create_cart_order_tx'`);
console.table(r.rows);

console.log("\n=== role_routine_grants ===");
r = await c.query(`
  SELECT grantee, privilege_type, is_grantable
  FROM information_schema.role_routine_grants
  WHERE routine_name = 'nex_create_cart_order_tx'
  ORDER BY grantee, privilege_type`);
console.table(r.rows);

console.log("\n=== has_function_privilege for anon ===");
r = await c.query(`
  SELECT has_function_privilege('anon','public.nex_create_cart_order_tx(uuid,uuid,uuid,text,jsonb,text,uuid,uuid,text,text)','execute') AS anon_can_execute,
         has_function_privilege('authenticated','public.nex_create_cart_order_tx(uuid,uuid,uuid,text,jsonb,text,uuid,uuid,text,text)','execute') AS authenticated_can_execute`);
console.table(r.rows);

console.log("\n=== nex_account columns (supabase_user_id discoverability) ===");
r = await c.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'nex_account'
    AND column_name IN ('id','supabase_user_id','nex_handle','is_mock_persona')
  ORDER BY column_name`);
console.table(r.rows);

console.log("\n=== nex_account_profile RLS on anon (can anon read supabase_user_id?) ===");
r = await c.query(`
  SELECT policyname, cmd, permissive, roles, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'nex_account'
  ORDER BY policyname`);
console.table(r.rows);

console.log("\n=== personas 99901 + 99903 ===");
r = await c.query(`
  SELECT nex_handle, is_mock_persona, LEFT(id::text,8)||'…' AS id_prefix,
         LEFT(supabase_user_id::text,8)||'…' AS sup_prefix
  FROM nex_account
  WHERE nex_handle IN ('nex-99901','nex-99903')
  ORDER BY nex_handle`);
console.table(r.rows);

await c.end();
console.log("\nOK");
