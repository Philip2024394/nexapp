import { readFileSync } from "node:fs";
import { Client } from "pg";
const envRaw = readFileSync("C:/Users/Victus/nexapp/.env.local", "utf8");
function envValue(name) { const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m")); if (!m) return null; let v = m[1].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); return v || null; }
const url = envValue("SANDBOX_DATABASE_URL");
if (!url?.includes("kdstoyyeygcopkogqsyv") || url.includes("ijvqdvsvwtwxzcqmoqit")) { console.error("STOP ref"); process.exit(1); }
const c = new Client({ connectionString: url });
await c.connect();
console.log("--- all overloads of nex_invite_to_call_tx ---");
const fn = await c.query(`
  SELECT p.oid::text, p.proname, pg_get_function_identity_arguments(p.oid) AS args,
         p.prosecdef, p.proconfig, pg_get_function_result(p.oid) AS result
  FROM pg_proc p
  WHERE p.proname = 'nex_invite_to_call_tx'
`);
console.table(fn.rows);
for (const row of fn.rows) {
  const def = await c.query(`SELECT pg_get_functiondef($1::oid) AS d`, [row.oid]);
  console.log("\n---BODY for oid " + row.oid + "---\n");
  console.log(def.rows[0].d.slice(0, 1600));
  const g = await c.query(`
    SELECT grantee, privilege_type
    FROM information_schema.role_routine_grants
    WHERE routine_name='nex_invite_to_call_tx' AND specific_name LIKE 'nex_invite_to_call_tx_%'
    ORDER BY grantee
  `);
  console.log("grants (consolidated across overloads):", g.rows);
}
console.log("\n--- migration_history head (numeric only) ---");
const h = await c.query(`SELECT version, description FROM nex_migration_history WHERE version ~ '^[0-9]+$' ORDER BY (version::int) DESC LIMIT 10`);
console.table(h.rows);
console.log("\n--- nex_peer_message_attachment_pair_check definition ---");
const chk = await c.query(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname LIKE '%attachment%' AND conrelid='nex_peer_message'::regclass`);
console.table(chk.rows);
await c.end();
