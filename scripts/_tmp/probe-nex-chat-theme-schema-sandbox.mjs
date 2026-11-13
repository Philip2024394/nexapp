// Read-only · sandbox probe for Phase 0 Themes Plus corrections.
// Three scopes:
//   1. Exact wallpaper_config JSONB shape on existing rows
//   2. Column catalog of nex_chat_theme + nullability + defaults
//   3. Role-name collision check for nex_themes_plus_admin_fn_owner
//   4. Existing trigger inventory on nex_account for the UPDATE event
//   5. support_admin_grant table + schema check

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
console.log(`Target · sandbox ${ref}`);

const c = new Client({ connectionString: databaseUrl });
await c.connect();

// 1. wallpaper_config shape from existing rows
console.log(`\n[1] wallpaper_config sample (existing rows)`);
const samples = await c.query(
  `SELECT id, name, tier, category, wallpaper_config, layout_style, intro_video_url
     FROM nex_chat_theme
    ORDER BY sort_order, id LIMIT 6`,
);
samples.rows.forEach(r => {
  console.log(`  ${r.id} · tier=${r.tier} · cat=${r.category} · layout=${r.layout_style}`);
  console.log(`    wallpaper_config: ${JSON.stringify(r.wallpaper_config)}`);
});

// 2. column catalog
console.log(`\n[2] Column catalog + nullability + defaults`);
const cols = await c.query(
  `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_chat_theme'
    ORDER BY ordinal_position`,
);
cols.rows.forEach(r => console.log(`  ${r.column_name.padEnd(30)} ${r.data_type.padEnd(30)} null=${r.is_nullable} default=${r.column_default ?? "(none)"}`));

// 3. role name collision
console.log(`\n[3] Role existence check`);
const role = await c.query(
  `SELECT rolname, rolcanlogin, rolinherit, rolsuper
     FROM pg_roles
    WHERE rolname = 'nex_themes_plus_admin_fn_owner'`,
);
console.log(`  nex_themes_plus_admin_fn_owner present: ${role.rows.length > 0}`);

// Also list existing nex_* roles to check patterns
const nexRoles = await c.query(
  `SELECT rolname FROM pg_roles WHERE rolname LIKE 'nex_%' ORDER BY rolname`,
);
console.log(`  All nex_* roles (${nexRoles.rows.length}):`);
nexRoles.rows.forEach(r => console.log(`    ${r.rolname}`));

// 4. Triggers on nex_account for UPDATE
console.log(`\n[4] Existing triggers on nex_account (UPDATE event)`);
const trig = await c.query(
  `SELECT tgname, tgtype, pg_get_triggerdef(oid) AS def
     FROM pg_trigger
    WHERE tgrelid = 'public.nex_account'::regclass AND NOT tgisinternal
    ORDER BY tgname`,
);
if (trig.rows.length === 0) {
  console.log(`  (none)`);
} else {
  trig.rows.forEach(r => console.log(`  ${r.tgname}`));
}

// 5. support_admin_grant
console.log(`\n[5] support_admin_grant table`);
const grantExists = (await c.query(
  `SELECT EXISTS (SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='support_admin_grant') AS e`,
)).rows[0].e;
console.log(`  support_admin_grant present: ${grantExists}`);
if (grantExists) {
  const grantCols = await c.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='support_admin_grant'
      ORDER BY ordinal_position`,
  );
  grantCols.rows.forEach(r => console.log(`    ${r.column_name.padEnd(25)} ${r.data_type.padEnd(25)} null=${r.is_nullable}`));
}

// 6. nex_security_audit
console.log(`\n[6] nex_security_audit table`);
const audExists = (await c.query(
  `SELECT EXISTS (SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='nex_security_audit') AS e`,
)).rows[0].e;
console.log(`  nex_security_audit present: ${audExists}`);
if (audExists) {
  const audCols = await c.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_security_audit'
      ORDER BY ordinal_position`,
  );
  audCols.rows.forEach(r => console.log(`    ${r.column_name.padEnd(25)} ${r.data_type}`));
}

// 7. nex schema existence (for the function to live in)
console.log(`\n[7] 'nex' schema existence`);
const nexSchema = (await c.query(
  `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'nex') AS e`,
)).rows[0].e;
console.log(`  'nex' schema present: ${nexSchema}`);

// 8. service_role existence (standard Supabase role)
console.log(`\n[8] service_role existence`);
const svc = await c.query(`SELECT 1 FROM pg_roles WHERE rolname = 'service_role'`);
console.log(`  service_role present: ${svc.rows.length > 0}`);

await c.end();
console.log(`\nProbe complete. No writes performed.`);
