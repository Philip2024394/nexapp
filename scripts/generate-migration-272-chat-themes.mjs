// scripts/generate-migration-272-chat-themes.mjs
// Reads the upload report and emits migration 272 that inserts 97
// gratis chat-theme rows pointing at the Supabase Storage URLs.
// Owner-authorised 2026-11-03 · Phase 1 chat-theme-templates.

import { readFileSync, writeFileSync } from "node:fs";

const report = JSON.parse(
  readFileSync("scripts/.upload-report-chat-themes.json", "utf8"),
);
const rows = report.uploads
  .slice()
  .sort((a, b) => a.themeOrdinal - b.themeOrdinal);

const valuesSql = rows
  .map((r) => {
    const id = `theme-o${r.themeOrdinal}`;
    const name = `Theme ${r.themeOrdinal}`;
    const sortOrder = r.themeOrdinal;
    // Escape single quotes in URL (shouldn't occur · supabase URLs are safe)
    const url = r.url.replace(/'/g, "''");
    return `  ('${id}', '${name}', '#C6A15B', 'gratis', 'standard', '${url}', true, ${sortOrder})`;
  })
  .join(",\n");

const sql = `-- 272_nex_chat_theme_seed_o_wallpapers.sql
--
-- Owner-authorised 2026-11-03 · Phase 1 chat-theme-templates.
-- Seeds 97 gratis chat themes · each one has a wallpaper hosted in
-- Supabase Storage bucket \`nex-chat-themes/library/o<N>.png\` (uploaded
-- via scripts/upload-chat-theme-wallpapers.mjs). All rows ship as
-- tier='gratis', category='standard' so no sealed Theme Commerce /
-- Package Contract / Launch Pricing DRAFT is touched. Owner can
-- rename / re-tier / re-order individually from HQ.
--
-- Idempotent via ON CONFLICT (id) DO UPDATE SET (matches the sealed
-- INSERT pattern in migration 048 line 103+).

-- Apply guard
DO $$ BEGIN
  RAISE EXCEPTION 'Migration 272 is DRAFT · comment out this block before applying.';
END $$;

INSERT INTO nex_chat_theme
  (id, name, accent_hex, tier, category, hero_image_url, is_active, sort_order)
VALUES
${valuesSql}
ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  accent_hex     = EXCLUDED.accent_hex,
  tier           = EXCLUDED.tier,
  category       = EXCLUDED.category,
  hero_image_url = EXCLUDED.hero_image_url,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order;

INSERT INTO nex_migration_history (version, description, applied_at)
VALUES ('272', 'chat themes · seed 97 gratis o-wallpaper rows', now())
ON CONFLICT (version) DO NOTHING;
`;

writeFileSync(
  "nex-supabase/migrations/272_nex_chat_theme_seed_o_wallpapers.sql",
  sql,
);
console.log(`wrote migration 272 · ${rows.length} rows`);
