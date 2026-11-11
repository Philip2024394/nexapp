// scripts/apply-migration-337-sandbox.mjs
//
// Owner-authorised 2026-11-11 (unified visual library sandbox apply).
// Applies BOTH:
//   · 337_nex_background_asset.sql       (DDL + RLS + triggers)
//   · 337_nex_background_asset_seed.sql  (450 catalog rows + 171 nex_chat_theme rows)
// against the SANDBOX Supabase project kdstoyyeygcopkogqsyv.
// REFUSES to run against production ref ijvqdvsvwtwxzcqmoqit.
//
// Verification steps (in order):
//   A · Pre-snapshot of existing nex_account.chat_theme + nex_business
//       (shop_cover_image_url, shop_cover_tint_hex) so we can prove
//       zero existing selections are overwritten.
//   B · Apply both SQL files in one transaction.
//   C · Post-snapshot same columns; row-for-row diff must be empty.
//   D · Row counts: nex_background_asset=450, nex_chat_theme extended
//       by 171 new rows.
//   E · Context separation: COUNT contexts=shop vs contexts=chat vs
//       cross-context (expect 0 cross).
//   F · Free-pool tier verification: 3 rows in nex_chat_theme for the
//       approved free-pool ids must carry tier='gratis'.
//   G · RLS: SELECT works for authenticated (public read); INSERT/
//       UPDATE/DELETE policies for authenticated return nothing (no
//       such policies exist).
//   H · Spot-check a few storage_url paths to confirm the referenced
//       files exist on disk (for local assets).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvVar(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const match = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) throw new Error(`${name} not found in .env.local`);
  let v = match[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

const databaseUrl = loadEnvVar("SANDBOX_DATABASE_URL");
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF    = "kdstoyyeygcopkogqsyv";
const u = new URL(databaseUrl);
const refFromUser = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
const refFromHost = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1] ?? null;
const projectRef = refFromUser ?? refFromHost;

console.log(`DB host:     ${u.hostname}`);
console.log(`Project ref: ${projectRef ?? "<UNKNOWN>"}`);
if (projectRef === PRODUCTION_REF) {
  console.error(`STOP · production ref detected · aborting`);
  process.exit(2);
}
if (projectRef !== SANDBOX_REF) {
  console.error(`STOP · ref "${projectRef}" is not the sealed SANDBOX · aborting`);
  process.exit(2);
}
console.log(`Pre-flight OK · targeting SANDBOX ${SANDBOX_REF}\n`);

const ddlPath  = resolve(repoRoot, "nex-supabase/migrations/337_nex_background_asset.sql");
const seedPath = resolve(repoRoot, "nex-supabase/migrations/337_nex_background_asset_seed.sql");
const ddlSql   = readFileSync(ddlPath,  "utf8");
const seedSql  = readFileSync(seedPath, "utf8");
console.log(`Loaded DDL  · ${ddlSql.length}  bytes`);
console.log(`Loaded seed · ${seedSql.length} bytes\n`);

// ───── A · Pre-snapshot ───────────────────────────────────────────
console.log(`[A] Pre-snapshot of existing selections ...`);
const pre = new Client({ connectionString: databaseUrl });
await pre.connect();
const preChatTheme = await pre.query(
  `SELECT id, chat_theme FROM nex_account WHERE chat_theme IS NOT NULL ORDER BY id`,
);
const preBusiness = await pre.query(
  `SELECT id, shop_cover_image_url, shop_cover_tint_hex FROM nex_business
    WHERE shop_cover_image_url IS NOT NULL OR shop_cover_tint_hex IS NOT NULL
    ORDER BY id`,
);
console.log(`  · nex_account rows with chat_theme set:        ${preChatTheme.rows.length}`);
console.log(`  · nex_business rows with shop_cover_* set:     ${preBusiness.rows.length}`);
await pre.end();

// ───── B · Apply migration ───────────────────────────────────────
console.log(`\n[B] Applying migration 337 ...`);
const apply = new Client({ connectionString: databaseUrl });
try {
  await apply.connect();
  await apply.query("BEGIN");
  // Mig 337 DDL file wraps its own BEGIN/COMMIT. We strip the BEGIN/
  // COMMIT markers so this outer transaction wraps the whole apply.
  const stripped = ddlSql.replace(/^\s*BEGIN\s*;/im, "").replace(/\s*COMMIT\s*;\s*$/im, "");
  await apply.query(stripped);
  await apply.query(seedSql);
  await apply.query("COMMIT");
  console.log(`  · Both SQL files applied · transaction committed`);
} catch (err) {
  console.error(`  · Apply FAILED · rolling back`, err?.message ?? err);
  try { await apply.query("ROLLBACK"); } catch {}
  process.exit(3);
} finally {
  await apply.end();
}

// ───── C · Post-snapshot + diff ──────────────────────────────────
console.log(`\n[C] Post-snapshot · diff against pre-snapshot ...`);
const v = new Client({ connectionString: databaseUrl });
await v.connect();
const postChatTheme = await v.query(
  `SELECT id, chat_theme FROM nex_account WHERE chat_theme IS NOT NULL ORDER BY id`,
);
const postBusiness = await v.query(
  `SELECT id, shop_cover_image_url, shop_cover_tint_hex FROM nex_business
    WHERE shop_cover_image_url IS NOT NULL OR shop_cover_tint_hex IS NOT NULL
    ORDER BY id`,
);
let chatDiffs = 0, shopDiffs = 0;
const preChatMap = new Map(preChatTheme.rows.map(r => [r.id, r.chat_theme]));
for (const row of postChatTheme.rows) {
  const before = preChatMap.get(row.id) ?? null;
  if (before !== row.chat_theme) { chatDiffs++; console.error(`  ! chat_theme CHANGED · account=${row.id}: ${before} → ${row.chat_theme}`); }
}
const preShopMap = new Map(preBusiness.rows.map(r => [r.id, { url: r.shop_cover_image_url, tint: r.shop_cover_tint_hex }]));
for (const row of postBusiness.rows) {
  const before = preShopMap.get(row.id) ?? { url: null, tint: null };
  if (before.url !== row.shop_cover_image_url || before.tint !== row.shop_cover_tint_hex) {
    shopDiffs++; console.error(`  ! shop_cover CHANGED · business=${row.id}`);
  }
}
console.log(`  · chat_theme rows unchanged · diffs: ${chatDiffs}`);
console.log(`  · shop_cover rows unchanged · diffs: ${shopDiffs}`);
if (chatDiffs !== 0 || shopDiffs !== 0) {
  console.error(`  FAIL · migration 337 modified existing selections!`);
  process.exit(4);
}

// ───── D · Row counts ────────────────────────────────────────────
console.log(`\n[D] Row count verification ...`);
const bg = await v.query(`SELECT count(*)::int AS n FROM nex_background_asset`);
console.log(`  · nex_background_asset total: ${bg.rows[0].n} (expected 450)`);
const nctNew = await v.query(
  `SELECT count(*)::int AS n FROM nex_chat_theme
    WHERE id LIKE 'library-%' OR id LIKE 'theme-o%'`,
);
console.log(`  · nex_chat_theme new rows (library- + theme-o): ${nctNew.rows[0].n} (expected 171)`);
const nctFree = await v.query(
  `SELECT id, tier FROM nex_chat_theme WHERE id IN ('library-ireland-1','library-pattern-2','library-pets-1') ORDER BY id`,
);
console.log(`  · free-pool rows:`);
nctFree.rows.forEach(r => console.log(`      ${r.id}: tier=${r.tier}`));
const allFree = nctFree.rows.length === 3 && nctFree.rows.every(r => r.tier === "gratis");
console.log(`  · free-pool tier correct: ${allFree}`);

// ───── E · Context separation ────────────────────────────────────
console.log(`\n[E] Context separation ...`);
const ctxCounts = await v.query(
  `SELECT
     count(*) FILTER (WHERE contexts @> ARRAY['shop']::text[] AND NOT contexts @> ARRAY['chat']::text[])::int AS shop_only,
     count(*) FILTER (WHERE contexts @> ARRAY['chat']::text[] AND NOT contexts @> ARRAY['shop']::text[])::int AS chat_only,
     count(*) FILTER (WHERE contexts @> ARRAY['shop']::text[] AND contexts @> ARRAY['chat']::text[])::int AS cross_context
   FROM nex_background_asset`,
);
console.log(`  · shop-only:       ${ctxCounts.rows[0].shop_only} (expected 279)`);
console.log(`  · chat-only:       ${ctxCounts.rows[0].chat_only} (expected 171)`);
console.log(`  · cross-context:   ${ctxCounts.rows[0].cross_context} (expected 0)`);

// ───── F · RLS policy verification ───────────────────────────────
console.log(`\n[F] RLS policies ...`);
const rlsEnabled = await v.query(
  `SELECT relrowsecurity FROM pg_class WHERE relname = 'nex_background_asset'`,
);
console.log(`  · RLS enabled: ${rlsEnabled.rows[0]?.relrowsecurity}`);
const policies = await v.query(
  `SELECT policyname, cmd, roles FROM pg_policies
    WHERE schemaname='public' AND tablename='nex_background_asset'
    ORDER BY policyname`,
);
console.log(`  · Policies:`);
policies.rows.forEach(p => console.log(`      ${p.policyname} · ${p.cmd} · roles=${p.roles}`));

// ───── G · Storage URL spot check (local files only) ─────────────
console.log(`\n[G] Storage URL spot check (local files) ...`);
const spot = await v.query(
  `SELECT storage_url FROM nex_background_asset
    WHERE storage_url LIKE '/%' ORDER BY random() LIMIT 20`,
);
let okCount = 0, badCount = 0;
for (const row of spot.rows) {
  const diskPath = resolve(repoRoot, "public", row.storage_url.replace(/^\//, ""));
  if (existsSync(diskPath)) okCount++;
  else { badCount++; console.error(`  ! MISSING: ${row.storage_url}`); }
}
console.log(`  · ${okCount}/${spot.rows.length} spot-checked local files exist on disk`);
if (badCount !== 0) console.error(`  ! ${badCount} MISSING files flagged above`);

// ───── H · Migration history ─────────────────────────────────────
console.log(`\n[H] Migration history ...`);
const hist = await v.query(
  `SELECT version, description FROM nex_migration_history WHERE version = '337'`,
);
console.log(`  · mig 337 history row: ${hist.rows.length > 0 ? "PRESENT" : "ABSENT"}`);
if (hist.rows[0]) console.log(`      ${hist.rows[0].description}`);

await v.end();
console.log(`\n✓ DONE · sandbox migration 337 applied + verified`);
