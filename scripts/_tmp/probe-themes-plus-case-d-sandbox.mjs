// scripts/_tmp/probe-themes-plus-case-d-sandbox.mjs
//
// READ-ONLY probe · owner-authorised 2026-11-11 for Phase 0 of
// NEX Themes Plus. Two scopes:
//
//   A) Verify the 5 provisional free-pool themes exist in sandbox
//      with resolvable wallpaper URLs
//   B) CASE D audit · accounts currently on premium themes grouped
//      by ownership / subscription status + per-theme-id counts
//
// Sandbox-only. Hard-refuses prod ref ijvqdvsvwtwxzcqmoqit.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const ref = u.username.match(/\.([a-z0-9]{15,})/)?.[1]
  ?? u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}`);

const c = new Client({ connectionString: databaseUrl });
await c.connect();
async function q(sql, params = []) { return (await c.query(sql, params)).rows; }

// ───────────────────────────────────────────────────────────────────
// A · Free-pool sandbox verification
// ───────────────────────────────────────────────────────────────────
console.log(`\n═══ A · Free-pool theme row verification ═══`);

const freePool = ["default", "theme-0", "library-ireland-1", "library-pattern-2", "library-pub-folk"];
const themeTableExists = (await q(
  `SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'nex_chat_theme') AS e`
))[0].e;
console.log(`nex_chat_theme table present: ${themeTableExists}`);

if (themeTableExists) {
  const cols = await q(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_chat_theme'
      ORDER BY ordinal_position`
  );
  const colNames = cols.map(r => r.column_name);
  console.log(`  columns: ${colNames.join(", ")}`);

  const rows = await q(
    `SELECT id, name, tier, category, wallpaper_config, is_active
       FROM nex_chat_theme
      WHERE id = ANY($1)
      ORDER BY id`,
    [freePool],
  );
  const byId = new Map(rows.map(r => [r.id, r]));
  console.log(`\n  Row presence:`);
  for (const id of freePool) {
    const r = byId.get(id);
    if (r) {
      const wallpaperSummary = r.wallpaper_config ? Object.keys(r.wallpaper_config).join(",") : "NULL";
      console.log(`    ${id}  · name="${r.name}"  · tier=${r.tier}  · category=${r.category}  · is_active=${r.is_active}  · wallpaper_config keys: ${wallpaperSummary}`);
    } else {
      console.log(`    ${id}  · ABSENT from nex_chat_theme`);
    }
  }
}

// ───────────────────────────────────────────────────────────────────
// B · CASE D audit
// ───────────────────────────────────────────────────────────────────
console.log(`\n═══ B · CASE D audit · premium-theme users ═══`);

const sealedFree = ["default", "theme-0"];

// Total accounts with chat_theme set
const totalRow = (await q(
  `SELECT count(*)::int AS n FROM nex_account WHERE chat_theme IS NOT NULL`
))[0];
console.log(`\nTotal accounts with chat_theme set: ${totalRow.n}`);

// Accounts on sealed-free themes
const freeRow = (await q(
  `SELECT count(*)::int AS n
     FROM nex_account
    WHERE chat_theme = ANY($1)`,
  [sealedFree],
))[0];
console.log(`Accounts on sealed-free themes (default/theme-0): ${freeRow.n}`);

// Accounts on PREMIUM themes (= chat_theme IS NOT NULL AND NOT IN sealed-free)
const premiumRow = (await q(
  `SELECT count(*)::int AS n
     FROM nex_account
    WHERE chat_theme IS NOT NULL
      AND chat_theme <> ALL($1)`,
  [sealedFree],
))[0];
console.log(`Accounts on PREMIUM themes (CASE D candidate pool): ${premiumRow.n}`);

// Per-theme breakdown
const perTheme = await q(
  `SELECT chat_theme AS theme_id, count(*)::int AS n
     FROM nex_account
    WHERE chat_theme IS NOT NULL
      AND chat_theme <> ALL($1)
    GROUP BY chat_theme
    ORDER BY n DESC, chat_theme`,
  [sealedFree],
);
console.log(`\nPer-theme-id counts (accounts currently on each premium theme):`);
if (perTheme.length === 0) {
  console.log(`  (none)`);
} else {
  perTheme.forEach(r => console.log(`  ${r.theme_id}  →  ${r.n} account(s)`));
}

// Cross with nex_theme_ownership (active, non-revoked)
const ownTableExists = (await q(
  `SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='nex_theme_ownership') AS e`
))[0].e;
console.log(`\nnex_theme_ownership present: ${ownTableExists}`);

let withOwnership = 0, withoutOwnership = premiumRow.n;
if (ownTableExists) {
  withOwnership = (await q(
    `SELECT count(DISTINCT a.id)::int AS n
       FROM nex_account a
       JOIN nex_theme_ownership o
         ON o.account_id = a.id AND o.theme_id = a.chat_theme
      WHERE a.chat_theme IS NOT NULL
        AND a.chat_theme <> ALL($1)
        AND o.revoked_at IS NULL`,
    [sealedFree],
  ))[0].n;
  withoutOwnership = premiumRow.n - withOwnership;
  console.log(`  of the ${premiumRow.n} premium-theme accounts:`);
  console.log(`    with verified non-revoked ownership of their current theme: ${withOwnership}`);
  console.log(`    WITHOUT ownership record: ${withoutOwnership}`);
}

// Cross with any subscription marker
// nex_theme_subscription may not exist yet
const subTableExists = (await q(
  `SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='nex_theme_subscription') AS e`
))[0].e;
console.log(`\nnex_theme_subscription present (expected false pre-Phase-1): ${subTableExists}`);

// Shop/Bisnis tier as proxy for "active premium tier"
// column may or may not exist — probe safely
const acctCols = (await q(
  `SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
      AND column_name IN ('subscription_plan','bisnis_expires_at','themes_trial_used_at')`
)).map(r => r.column_name);
console.log(`nex_account commercial columns present: ${acctCols.join(", ") || "(none)"}`);

if (acctCols.includes("bisnis_expires_at")) {
  const bisnisActive = (await q(
    `SELECT count(DISTINCT a.id)::int AS n
       FROM nex_account a
      WHERE a.chat_theme IS NOT NULL
        AND a.chat_theme <> ALL($1)
        AND a.bisnis_expires_at IS NOT NULL
        AND a.bisnis_expires_at > now()`,
    [sealedFree],
  ))[0].n;
  console.log(`  of the ${premiumRow.n} premium-theme accounts with active bisnis_expires_at (future): ${bisnisActive}`);
}

if (acctCols.includes("themes_trial_used_at")) {
  // trial window = used_at + 7 days (per isThemesTrialActive helper)
  const trialActive = (await q(
    `SELECT count(DISTINCT a.id)::int AS n
       FROM nex_account a
      WHERE a.chat_theme IS NOT NULL
        AND a.chat_theme <> ALL($1)
        AND a.themes_trial_used_at IS NOT NULL
        AND a.themes_trial_used_at > now() - interval '7 days'`,
    [sealedFree],
  ))[0].n;
  console.log(`  of the ${premiumRow.n} premium-theme accounts with active 7-day trial: ${trialActive}`);
}

// Test / demo / seeded account distinguishability
// 99901 is owner's test persona · check for pattern-like handles
const testFlagCols = (await q(
  `SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
      AND column_name IN ('is_test_account','test','demo','seeded')`
)).map(r => r.column_name);
console.log(`\nTest-flag columns on nex_account: ${testFlagCols.join(", ") || "(none)"}`);

const seededByHandle = (await q(
  `SELECT count(*)::int AS n
     FROM nex_account
    WHERE chat_theme IS NOT NULL
      AND chat_theme <> ALL($1)
      AND (nex_handle ~ '^[0-9]+$' OR nex_handle LIKE 'test%' OR nex_handle LIKE 'demo%')`,
  [sealedFree],
))[0].n;
console.log(`Premium-theme accounts whose handle matches test/demo pattern (numeric handles, 'test*', 'demo*'): ${seededByHandle}`);

// Owner persona 99901 specifically
const ownerPersona = (await q(
  `SELECT id, nex_handle, chat_theme
     FROM nex_account
    WHERE nex_handle = '99901'
    LIMIT 1`,
))[0];
if (ownerPersona) {
  console.log(`Owner persona 99901 present · handle=${ownerPersona.nex_handle} · chat_theme=${ownerPersona.chat_theme ?? "(unset)"}`);
}

await c.end();
console.log(`\nProbe complete. No writes performed.`);
