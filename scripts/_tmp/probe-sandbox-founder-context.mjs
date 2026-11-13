// Read-only · find a real businessId for the founder test URL +
// enumerate themes-plus-adjacent state that's already present.

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

const c = new Client({ connectionString: databaseUrl });
await c.connect();

console.log(`=== Founder test account (nex_handle = 99901) ===`);
const owner = await c.query(
  `SELECT id, nex_handle, display_name, chat_theme, subscription_plan, bisnis_expires_at, themes_trial_used_at
     FROM nex_account WHERE nex_handle = '99901' LIMIT 1`,
);
if (owner.rows[0]) {
  const r = owner.rows[0];
  console.log(`  id:                    ${r.id}`);
  console.log(`  nex_handle:            ${r.nex_handle}`);
  console.log(`  display_name:          ${r.display_name}`);
  console.log(`  chat_theme:            ${r.chat_theme ?? "(null)"}`);
  console.log(`  subscription_plan:     ${r.subscription_plan ?? "(null)"}`);
  console.log(`  bisnis_expires_at:     ${r.bisnis_expires_at ?? "(null)"}`);
  console.log(`  themes_trial_used_at:  ${r.themes_trial_used_at ?? "(null)"}`);
}

console.log(`\n=== Businesses owned by 99901 ===`);
if (owner.rows[0]) {
  const biz = await c.query(
    `SELECT id, slug, display_name, shop_cover_image_url, shop_cover_tint_hex
       FROM nex_business WHERE owner_account_id = $1 ORDER BY created_at DESC`,
    [owner.rows[0].id],
  );
  if (biz.rows.length === 0) {
    console.log(`  (no businesses · founder flow will need /nex-native/manage/shop setup first)`);
  } else {
    biz.rows.forEach(b => {
      console.log(`  ${b.id} · slug=${b.slug} · name="${b.display_name}"`);
      console.log(`      cover_url=${b.shop_cover_image_url ?? "(null)"}`);
      console.log(`      tint_hex=${b.shop_cover_tint_hex ?? "(null)"}`);
    });
  }
}

console.log(`\n=== Themes Plus adjacent columns on nex_account ===`);
const cols = await c.query(
  `SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
      AND column_name IN ('themes_plus_until','themes_trial_used_at',
                          'subscription_plan','bisnis_expires_at',
                          'free_theme_id')
    ORDER BY column_name`,
);
cols.rows.forEach(r => console.log(`  ${r.column_name}`));

console.log(`\n=== nex_theme_ownership state (verified historical ownership) ===`);
const own = await c.query(
  `SELECT count(*)::int AS total,
          count(*) FILTER (WHERE revoked_at IS NULL)::int AS active
     FROM nex_theme_ownership`,
);
console.log(`  total rows: ${own.rows[0].total} · active (revoked_at IS NULL): ${own.rows[0].active}`);

console.log(`\n=== nex_theme_subscription table presence (Themes Plus Phase 1 indicator) ===`);
const subTbl = await c.query(
  `SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='nex_theme_subscription') AS e`,
);
console.log(`  nex_theme_subscription present: ${subTbl.rows[0].e}`);

await c.end();
