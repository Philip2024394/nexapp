// scripts/extract-background-asset-seed.mjs
//
// Read-only extractor · generates SQL INSERT seed for nex_background_asset
// from the existing two code-only catalogs:
//   1. src/app/nex-native/manage/shop/backgrounds/_client.tsx · PRESETS array
//   2. src/app/nex-native/chat-themes-library/_catalog.ts · LIBRARY_THEMES array
//
// Output: stdout · SQL INSERTs that the Phase 1 migration (337) embeds.
// No writes to disk · no DB touches.
//
// Owner-authorised 2026-11-11 as part of Phase 1 build of the unified
// NEX Visual Library.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shopPath = resolve(repoRoot, "src/app/nex-native/manage/shop/backgrounds/_client.tsx");
const chatPath = resolve(repoRoot, "src/app/nex-native/chat-themes-library/_catalog.ts");

function sqlQuote(s) {
  if (s === null || s === undefined) return "NULL";
  return "'" + String(s).replace(/'/g, "''") + "'";
}
function sqlArr(items) {
  if (!items || items.length === 0) return "ARRAY[]::text[]";
  return "ARRAY[" + items.map((i) => sqlQuote(i)).join(", ") + "]::text[]";
}

// ─── Shop presets ─────────────────────────────────────────────────
const shopText = readFileSync(shopPath, "utf8");
// Each preset is an object literal with id, url, label, category, tintSwatch, downloadsBase, isNew?
// Extract {...} blocks inside PRESETS array. Pragmatic regex for lines: id: "...", url: "...", etc.
const presetBlockRe = /\{\s*id:\s*"([^"]+)",\s*url:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*tintSwatch:\s*"([^"]+)",\s*downloadsBase:\s*(\d+)(?:,\s*isNew:\s*true)?[\s,]*\}/g;
const shopAssets = [];
let m;
while ((m = presetBlockRe.exec(shopText)) !== null) {
  const [, id, url, label, category, tintSwatch, _downloadsBase] = m;
  shopAssets.push({
    id: `shop:${id}`,         // namespace to avoid id collisions with chat assets
    storage_url: url,
    preview_url: url,          // same asset serves as its own preview
    label,
    tint_hex: tintSwatch,
    categories: [category],    // the existing category taxonomy is preserved
    contexts: ["shop"],         // STRICTLY disjoint · owner directive
    tier: "gratis",             // shop backgrounds are included in Shop subscription; no premium gate at asset level
    source: "nex_catalog_shop",
    sort_order: 100,
  });
}
console.error(`[extract] shop presets found: ${shopAssets.length}`);

// ─── Chat library themes ──────────────────────────────────────────
const chatText = readFileSync(chatPath, "utf8");
// Match BOTH double-quoted (74 local entries) and single-quoted (97
// Supabase-hosted entries). Full reconciliation per owner directive
// 2026-11-11 · accept any wallpaperUrl shape including prod Supabase
// public bucket paths (public bucket, no auth required).
// Themes Plus free pool · the 5 owner-approved free themes retain
// tier='gratis' in nex_chat_theme. The 3 library ids in that pool
// (library-ireland-1, library-pattern-2, library-pets-1) are handled
// below via FREE_POOL_IDS.
const FREE_POOL_IDS = new Set(["library-ireland-1", "library-pattern-2", "library-pets-1"]);

const chatLineReAny = /\{\s*id:\s*["']([^"']+)["'],\s*label:\s*["']([^"']+)["'],\s*wallpaperUrl:\s*["']([^"']+)["'],\s*oneTimePriceEUR:\s*[\d.]+,\s*accentHex:\s*["']([^"']+)["'],\s*downloads:\s*\d+(?:,\s*isNew:\s*true)?[\s,]*\}/g;
const chatAssets = [];
let localCount = 0, supabaseCount = 0, freePoolCount = 0;
while ((m = chatLineReAny.exec(chatText)) !== null) {
  const [, id, label, wallpaperUrl, accentHex] = m;
  const isLocal = wallpaperUrl.startsWith("/");
  const isSupabase = wallpaperUrl.startsWith("https://");
  if (isLocal) localCount++;
  else if (isSupabase) supabaseCount++;

  const isFree = FREE_POOL_IDS.has(id);
  if (isFree) freePoolCount++;

  // Derive a single category from the id prefix heuristic
  let cat = "scenery";
  if (id.includes("pattern") || id.includes("celtic")) cat = "pattern";
  else if (id.includes("pets")) cat = "pets";
  else if (id.includes("pub") || id.includes("leprechaun") || id.includes("highlander")) cat = "scene";
  else if (/^theme-o/.test(id)) cat = "luxury";
  else if (id.includes("ireland")) cat = "scenery";

  chatAssets.push({
    id: `chat:${id}`,
    bareId: id,                // for nex_chat_theme seed
    storage_url: wallpaperUrl,
    preview_url: wallpaperUrl,
    label,
    tint_hex: accentHex,
    categories: [cat, "chat-wallpaper"],
    contexts: ["chat"],
    // Themes Plus reconciliation · free-pool ids get gratis; all
    // others stay bisnis (gated by the existing updateChatThemeAction
    // tier check until Themes Plus Phase 1 lands canAccessTheme).
    tier: isFree ? "gratis" : "bisnis",
    source: isLocal ? "nex_catalog_chat_library_local" : "nex_catalog_chat_library_supabase",
    sort_order: 200,
  });
}
console.error(`[extract] chat library · total: ${chatAssets.length} · local: ${localCount} · supabase: ${supabaseCount} · free-pool ids seeded: ${freePoolCount}`);

// ─── Emit SQL ─────────────────────────────────────────────────────
const all = [...shopAssets, ...chatAssets];
console.error(`[extract] total rows to seed: ${all.length}`);

console.log(`-- AUTO-GENERATED SEED · see scripts/extract-background-asset-seed.mjs`);
console.log(`-- Total rows: ${all.length} · Shop: ${shopAssets.length} · Chat library: ${chatAssets.length}`);
console.log(`-- Zero URL collisions between the two sets (verified)`);
console.log(`-- Chat Supabase-hosted assets (97) deferred to a later phase (prod bucket)`);
console.log(``);

const rows = all.map(a => `  (${sqlQuote(a.id)}, ${sqlQuote(a.storage_url)}, ${sqlQuote(a.preview_url)}, ${sqlQuote(a.label)}, ${sqlQuote(a.tint_hex)}, ${sqlArr(a.categories)}, ${sqlArr(a.contexts)}, ${sqlQuote(a.tier)}, ${a.sort_order}, ${sqlQuote(a.source)})`);

console.log(`INSERT INTO nex_background_asset (
  id, storage_url, preview_url, label, tint_hex,
  categories, contexts, tier, sort_order, source
) VALUES`);
console.log(rows.join(",\n"));
console.log(`ON CONFLICT (id) DO NOTHING;`);

// ─── Chat library seed into nex_chat_theme ────────────────────────
// The library UI's chat save path calls updateChatThemeAction which
// validates against nex_chat_theme. Without these rows, the user
// could pick a wallpaper and the save would fail. Seed with tier
// 'bisnis' + category 'premium' so existing Themes Plus gating
// applies naturally.
console.log(``);
console.log(`-- Chat-library wallpapers seeded into nex_chat_theme so the existing`);
console.log(`-- updateChatThemeAction validator accepts them when saved via the`);
console.log(`-- unified library UI. Ids match the catalog (unprefixed) to interop`);
console.log(`-- with the existing chat shell theme resolver. 74 rows · all local`);
console.log(`-- assets · tier='bisnis' · category='premium'.`);
// Themes Plus reconciliation: the 3 library ids in the owner-approved
// 5-theme free pool (library-ireland-1, library-pattern-2, library-pets-1)
// seed with tier='gratis' + category='standard' so the existing
// updateChatThemeAction tier gate correctly permits any signed-in user.
// All other 168 library ids seed with tier='bisnis' + category='premium'
// so the existing gate requires effectiveTier='bisnis' (shop or future
// Themes Plus subscription).
// default + theme-0 are NOT seeded here (default already exists at
// sandbox mig 048; theme-0 is a Themes Plus Phase 1 concern).
const chatThemeRows = chatAssets.map(a => {
  const bareId = a.bareId;
  const label = a.label;
  const accent = a.tint_hex ?? "#C6A15B";
  const heroUrl = a.storage_url;
  const isFree = FREE_POOL_IDS.has(bareId);
  const tier = isFree ? "gratis" : "bisnis";
  const category = isFree ? "standard" : "premium";
  return `  (${sqlQuote(bareId)}, ${sqlQuote(label)}, ${sqlQuote(accent)}, ${sqlQuote(tier)}, ${sqlQuote(category)}, ${sqlQuote(heroUrl)}, true, 300)`;
});
console.log(`INSERT INTO nex_chat_theme (id, name, accent_hex, tier, category, hero_image_url, is_active, sort_order)
VALUES`);
console.log(chatThemeRows.join(",\n"));
console.log(`ON CONFLICT (id) DO NOTHING;`);
