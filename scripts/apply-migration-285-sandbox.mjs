// scripts/apply-migration-285-sandbox.mjs
//
// Owner-authorised 2026-11-13 · apply mig 285 to sandbox so the Chat
// Font save (+ Screenshot Protection + Background Sync) can write.
// Hard-refuses prod ref ijvqdvsvwtwxzcqmoqit.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnvVar(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = loadEnvVar("SANDBOX_DATABASE_URL");
const PROD = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX = "kdstoyyeygcopkogqsyv";
const u = new URL(databaseUrl);
const ref =
  u.username.match(/\.([a-z0-9]{15,})/)?.[1] ??
  u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
console.log(`DB host:     ${u.hostname}\nProject ref: ${ref}`);
if (ref === PROD) { console.error("STOP · production"); process.exit(2); }
if (ref !== SANDBOX) { console.error(`STOP · ref ${ref} is not SANDBOX`); process.exit(2); }
console.log(`Pre-flight OK · targeting SANDBOX ${SANDBOX}\n`);

const sqlPath = resolve(repoRoot, "nex-supabase/migrations/285_nex_account_chat_view_preferences.sql");
const sql = readFileSync(sqlPath, "utf8");
console.log(`Loaded SQL · ${sql.length} bytes`);

console.log(`\n[A] Pre-snapshot ...`);
const pre = new Client({ connectionString: databaseUrl });
await pre.connect();
const preCols = (await pre.query(
  `SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
      AND column_name IN ('chat_font_family','chat_font_size','screenshot_copy_protection_enabled','chat_bg_from_shop_cover','shop_cover_from_chat_theme')
    ORDER BY column_name`,
)).rows;
console.log(`  · pre columns: ${preCols.length > 0 ? preCols.map(r => r.column_name).join(', ') : "absent"}`);
await pre.end();

console.log(`\n[B] Applying migration 285 ...`);
const apply = new Client({ connectionString: databaseUrl });
try {
  await apply.connect();
  await apply.query(sql);
  console.log(`  · applied`);
} catch (err) {
  console.error(`  · Apply FAILED:`, err?.message ?? err);
  process.exit(3);
} finally {
  await apply.end();
}

console.log(`\n[C] Post-verify ...`);
const v = new Client({ connectionString: databaseUrl });
await v.connect();
const cols = (await v.query(
  `SELECT column_name, data_type, column_default
     FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
      AND column_name IN ('chat_font_family','chat_font_size','screenshot_copy_protection_enabled','chat_bg_from_shop_cover','shop_cover_from_chat_theme')
    ORDER BY column_name`,
)).rows;
for (const r of cols) console.log(`  · ${r.column_name}: ${r.data_type} default=${r.column_default}`);

const checks = (await v.query(
  `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
    WHERE conrelid='nex_account'::regclass
      AND conname IN ('nex_account_chat_font_family_valid','nex_account_chat_font_size_valid')
    ORDER BY conname`,
)).rows;
for (const r of checks) console.log(`  · ${r.conname}: ${r.def}`);

// Functional round-trip on 99901
const ACC = "11111111-1111-4111-8111-111111111111";
try {
  await v.query(
    `UPDATE nex_account SET chat_font_family='handwritten', chat_font_size='large' WHERE id=$1`,
    [ACC],
  );
  const post = (await v.query(
    `SELECT chat_font_family AS f, chat_font_size AS s FROM nex_account WHERE id=$1`,
    [ACC],
  )).rows[0];
  console.log(`  · 99901 write test: family=${post.f} size=${post.s} (expected handwritten/large)`);
} finally {
  await v.query(
    `UPDATE nex_account SET chat_font_family='default', chat_font_size='medium' WHERE id=$1`,
    [ACC],
  );
}

await v.end();
console.log(`\n✓ DONE · sandbox migration 285 applied + verified`);
