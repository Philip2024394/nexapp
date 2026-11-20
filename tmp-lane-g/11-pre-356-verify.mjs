// Read-only pre-apply verification for mig-356.  Executes narrowly
// scoped queries against sandbox `kdstoyyeygcopkogqsyv` only:
//   · mig-353 as-applied function body + signature + grants
//   · dependent objects pointing at nex_invite_to_call_tx
//   · attachment_pair_check definition
//   · nex_peer_message columns (attachment_url exists?)
//   · nex_group_call_session.host_country constraint values
//   · nex_migration_history head
//   · accept_href caller contract (TypeScript side read separately)
// No mutations · hard refuses production ref.
import { readFileSync } from "node:fs";
import { Client } from "pg";

const envRaw = readFileSync("C:/Users/Victus/nexapp/.env.local", "utf8");
function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v || null;
}
const dbUrl = envValue("SANDBOX_DATABASE_URL");
if (!dbUrl) throw new Error("STOP · SANDBOX_DATABASE_URL missing");
if (!dbUrl.includes("kdstoyyeygcopkogqsyv")) throw new Error("STOP · not sandbox");
if (dbUrl.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("STOP · production ref present");

const pg = new Client({ connectionString: dbUrl });
await pg.connect();

const target = await pg.query("SELECT current_database() AS db");
console.log("Target:", target.rows[0]);

console.log("\n=== 1 · Current nex_invite_to_call_tx overloads ===");
const overloads = await pg.query(`
  SELECT oid, pg_get_function_arguments(oid) AS args,
         prosecdef, proconfig, proowner::regrole AS owner
    FROM pg_proc WHERE proname = 'nex_invite_to_call_tx' ORDER BY oid`);
console.table(overloads.rows);

if (overloads.rows.length !== 1) {
  console.log("!! EXPECTED exactly 1 overload (mig-353) · observed", overloads.rows.length);
}
if (overloads.rows.length === 1) {
  const args = overloads.rows[0].args;
  console.log("has p_self_supabase_user_id:", args.includes("p_self_supabase_user_id"));
  console.log("has p_attachment_url:", args.includes("p_attachment_url"));
}

console.log("\n=== 2 · Grants on nex_invite_to_call_tx ===");
const grants = await pg.query(`
  SELECT grantee, privilege_type
    FROM information_schema.role_routine_grants
   WHERE routine_name = 'nex_invite_to_call_tx'
   ORDER BY grantee, privilege_type`);
console.table(grants.rows);

console.log("\n=== 3 · Effective role memberships for auth roles ===");
// Confirm no role-membership chain restores anon EXECUTE
const roleMem = await pg.query(`
  SELECT r.rolname AS role, m.rolname AS member_of
    FROM pg_roles r
    LEFT JOIN pg_auth_members am ON am.member = r.oid
    LEFT JOIN pg_roles m ON m.oid = am.roleid
   WHERE r.rolname IN ('anon','authenticated','service_role')
   ORDER BY r.rolname, m.rolname`);
console.table(roleMem.rows);

console.log("\n=== 4 · Dependent objects referencing nex_invite_to_call_tx ===");
const deps = await pg.query(`
  SELECT DISTINCT d.classid::regclass AS kind,
         CASE
           WHEN d.classid::regclass::text = 'pg_proc' THEN d.objid::regprocedure::text
           WHEN d.classid::regclass::text = 'pg_rewrite' THEN (SELECT ev_class::regclass::text FROM pg_rewrite WHERE oid = d.objid)
           WHEN d.classid::regclass::text = 'pg_trigger' THEN (SELECT tgname FROM pg_trigger WHERE oid = d.objid)
           ELSE d.objid::text
         END AS dependent
    FROM pg_depend d
   WHERE d.refobjid = (SELECT oid FROM pg_proc WHERE proname='nex_invite_to_call_tx' LIMIT 1)
     AND d.deptype <> 'i'`);
console.table(deps.rows);

console.log("\n=== 5 · attachment_pair_check definition (expect url==null = type==null) ===");
const pair = await pg.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
   WHERE conname = 'nex_peer_message_attachment_pair_check'`);
console.table(pair.rows);

console.log("\n=== 6 · nex_peer_message columns (confirm attachment_url exists and is text) ===");
const cols = await pg.query(`
  SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
   WHERE table_name = 'nex_peer_message'
     AND column_name IN ('body','attachment_type','attachment_url','attachment_meta','sender_account_id','conversation_id')
   ORDER BY column_name`);
console.table(cols.rows);

console.log("\n=== 7 · attachment_type CHECK (expect allows 'call_invite') ===");
const atype = await pg.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
   WHERE conrelid = 'nex_peer_message'::regclass AND conname LIKE '%attachment_type%'`);
console.table(atype.rows);

console.log("\n=== 8 · host_country CHECK (expect ireland/indonesia/worldwide/global) ===");
const hc = await pg.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
   WHERE conrelid = 'nex_group_call_session'::regclass AND conname LIKE '%host_country%'`);
console.table(hc.rows);

console.log("\n=== 9 · 4-cap trigger on participants (GB-4CAP · stays OPEN) ===");
const trg = await pg.query(`
  SELECT tgname, pg_get_triggerdef(oid) AS def
    FROM pg_trigger
   WHERE tgrelid = 'nex_group_call_participant'::regclass AND NOT tgisinternal`);
console.table(trg.rows);

console.log("\n=== 10 · UNIQUE indexes required for retry/convergence ===");
const idx = await pg.query(`
  SELECT indexrelid::regclass AS idx, indisunique, pg_get_indexdef(indexrelid) AS def
    FROM pg_index
   WHERE indrelid IN ('nex_group_call_participant'::regclass,'nex_peer_conversation'::regclass)
     AND indisunique`);
console.table(idx.rows);

console.log("\n=== 11 · migration_history head ===");
const head = await pg.query(`
  SELECT version, description, notes FROM nex_migration_history
   ORDER BY version::int DESC LIMIT 6`);
console.table(head.rows);

console.log("\n=== 12 · Is mig-356 already recorded? (expect 0 rows) ===");
const m356 = await pg.query(`SELECT version FROM nex_migration_history WHERE version='356'`);
console.log("mig-356 history rows:", m356.rows.length);

console.log("\n=== 13 · Session state check list (expect 'ringing' legal) ===");
const sstate = await pg.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
   WHERE conrelid = 'nex_group_call_session'::regclass AND conname LIKE '%state%'`);
console.table(sstate.rows);

// mig-353 body (preserve · informational only)
console.log("\n=== 14 · Applied mig-353 body (first 40 lines) ===");
const body = await pg.query(`SELECT pg_get_functiondef((SELECT oid FROM pg_proc WHERE proname='nex_invite_to_call_tx' LIMIT 1)) AS def`);
console.log(body.rows[0].def.split("\n").slice(0, 60).join("\n"));

await pg.end();
console.log("\n=== pre-356 verification complete ===");
