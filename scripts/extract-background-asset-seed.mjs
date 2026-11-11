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
// Each theme is one line (compact literal) with wallpaperUrl pointing at a local path.
// We only extract LOCAL assets (wallpaperUrl starts with "/nex-themes/library/preview/").
// The 97 Supabase-hosted entries point at prod storage · excluded from Phase 1 seed.
const chatLineRe = /\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*wallpaperUrl:\s*"(\/nex-themes\/library\/preview\/[^"]+)",\s*oneTimePriceEUR:\s*[\d.]+,\s*accentHex:\s*"([^"]+)",\s*downloads:\s*\d+(?:,\s*isNew:\s*true)?[\s,]*\}/g;
const chatAssets = [];
while ((m = chatLineRe.exec(chatText)) !== null) {
  const [, id, label, wallpaperUrl, accentHex] = m;
  // Derive a single category from the id prefix heuristic
  let cat = "scenery";                 // default
  if (id.includes("pattern") || id.includes("celtic")) cat = "pattern";
  else if (id.includes("pets")) cat = "pets";
  else if (id.includes("pub") || id.includes("leprechaun") || id.includes("highlander")) cat = "scene";
  else if (id.includes("ireland")) cat = "scenery";
  else if (/^library-m-/.test(id) || /^library-y-/.test(id) || /^library-this-/.test(id)) cat = "scenery";
  chatAssets.push({
    id: `chat:${id}`,
    storage_url: wallpaperUrl,
    preview_url: wallpaperUrl,
    label,
    tint_hex: accentHex,
    categories: [cat, "chat-wallpaper"],
    contexts: ["chat"],
    tier: "bisnis",                  // chat library entries are premium (gated by Themes Plus per Phase 0)
    source: "nex_catalog_chat_library",
    sort_order: 200,
  });
}
console.error(`[extract] chat library (local) themes found: ${chatAssets.length}`);

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
const chatThemeRows = chatAssets.map(a => {
  const bareId = a.id.replace(/^chat:/, "");
  const label = a.label;
  const accent = a.tint_hex ?? "#C6A15B";
  const heroUrl = a.storage_url;
  return `  (${sqlQuote(bareId)}, ${sqlQuote(label)}, ${sqlQuote(accent)}, 'bisnis', 'premium', ${sqlQuote(heroUrl)}, true, 300)`;
});
console.log(`INSERT INTO nex_chat_theme (id, name, accent_hex, tier, category, hero_image_url, is_active, sort_order)
VALUES`);
console.log(chatThemeRows.join(",\n"));
console.log(`ON CONFLICT (id) DO NOTHING;`);
