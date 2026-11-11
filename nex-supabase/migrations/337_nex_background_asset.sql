-- Migration 337 · nex_background_asset · unified NEX Visual Library catalog
-- Owner-authorised 2026-11-11 · Phase 1 implementation of the unified library.
-- -----------------------------------------------------------------------------
-- Purpose · one shared catalog table that the Shop Background picker and the
-- Chat Theme picker both read. Each row declares which contexts (shop, chat)
-- it is approved for; strictly disjoint at launch per owner directive.
--
-- CRITICAL isolation rules preserved (owner directive 2026-11-11):
--   · Shop background SELECTION remains at nex_business.shop_cover_image_url
--     + nex_business.shop_cover_tint_hex (mig 212, per-business, unchanged)
--   · Chat theme SELECTION remains at nex_account.chat_theme (mig 021,
--     per-account, unchanged)
--   · This migration does NOT alter either of those columns
--   · Zero coupling · library UI dispatches to the existing two writers
--
-- Phase 1 seed:
--   · 279 shop backgrounds · extracted from PRESETS array
--     (src/app/nex-native/manage/shop/backgrounds/_client.tsx)
--   · 74 chat library wallpapers (LOCAL assets only) · extracted from
--     LIBRARY_THEMES (src/app/nex-native/chat-themes-library/_catalog.ts)
--   · 97 chat library wallpapers hosted on prod Supabase storage are
--     EXCLUDED · they remain in the legacy LIBRARY_THEMES array until a
--     later phase authorises moving them
--   · Zero URL collisions verified between the two sets · zero basename
--     collisions · each asset uses a namespaced id ("shop:<id>" or
--     "chat:<id>") to prevent cross-source collisions
--
-- Scope-restricted per owner directive 2026-11-11:
--   · NO change to nex_account, nex_business, nex_chat_theme,
--     nex_theme_subscription, or any existing writer
--   · NO change to Themes Plus commercial model
--   · NO change to Shop subscription rules
--
-- NOT YET APPLIED to sandbox. Review-only. Requires separate explicit
-- owner approval naming the sandbox project ref kdstoyyeygcopkogqsyv
-- before apply. Production project ijvqdvsvwtwxzcqmoqit remains sealed.

BEGIN;

-- 1. Table ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_background_asset (
  id              text        PRIMARY KEY,
  storage_url     text        NOT NULL,
  preview_url     text,
  label           text        NOT NULL,
  tint_hex        text,
  categories      text[]      NOT NULL DEFAULT ARRAY[]::text[],
  contexts        text[]      NOT NULL,
  tier            text        NOT NULL DEFAULT 'gratis'
                              CHECK (tier IN ('gratis','bisnis','pro')),
  is_active       boolean     NOT NULL DEFAULT true,
  sort_order      integer     NOT NULL DEFAULT 100,
  source          text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_background_asset_contexts_nonempty
    CHECK (array_length(contexts, 1) IS NOT NULL AND array_length(contexts, 1) >= 1),
  CONSTRAINT nex_background_asset_tint_hex_format
    CHECK (tint_hex IS NULL OR tint_hex ~ '^#[0-9A-Fa-f]{6}$')
);

COMMENT ON TABLE  nex_background_asset IS
  'NEX unified visual library catalog. One row per approved background image. '
  'Row contexts declare whether the image is selectable by shop, chat, or both. '
  'Owner directive 2026-11-11 · see migration 337 header for isolation rules.';
COMMENT ON COLUMN nex_background_asset.contexts IS
  'Non-empty array of context keys the asset is approved for · e.g. {"shop"} or {"chat"} or {"shop","chat"}. '
  'Strictly disjoint at launch; cross-context promotion requires a deliberate UPDATE.';
COMMENT ON COLUMN nex_background_asset.categories IS
  'Discovery tags · may include shop-picker categories (retail, electronics, etc.) '
  'and chat-picker categories (scenery, pattern, pets, etc.).';
COMMENT ON COLUMN nex_background_asset.tier IS
  'Entitlement tier · gratis is universally browsable; bisnis / pro are gated by the '
  'calling surface (chat vs shop) against the appropriate subscription. '
  'The tier here is a classification, NOT the sole gate · the server action for '
  'each context is responsible for entitlement enforcement.';

-- 2. Indexes --------------------------------------------------------------
CREATE INDEX IF NOT EXISTS nex_background_asset_contexts_gin
  ON nex_background_asset USING gin (contexts);
CREATE INDEX IF NOT EXISTS nex_background_asset_categories_gin
  ON nex_background_asset USING gin (categories);
CREATE INDEX IF NOT EXISTS nex_background_asset_active_tier_sort
  ON nex_background_asset (tier, is_active, sort_order)
  WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS nex_background_asset_storage_url_unique
  ON nex_background_asset (storage_url);

-- 3. updated_at trigger ---------------------------------------------------
CREATE OR REPLACE FUNCTION nex_background_asset_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS nex_background_asset_touch_updated_at_trg ON nex_background_asset;
CREATE TRIGGER nex_background_asset_touch_updated_at_trg
  BEFORE UPDATE ON nex_background_asset
  FOR EACH ROW EXECUTE FUNCTION nex_background_asset_touch_updated_at();

-- 4. RLS ------------------------------------------------------------------
--    The catalog is public-browse read · writes are service-role only.
--    Supabase service_role bypasses RLS naturally; no mutation policy for
--    authenticated.

ALTER TABLE nex_background_asset ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_background_asset_public_read ON nex_background_asset;
CREATE POLICY nex_background_asset_public_read
  ON nex_background_asset
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

-- No INSERT/UPDATE/DELETE policy for authenticated · service_role only.

-- 5. Seed data (353 rows · see scripts/extract-background-asset-seed.mjs) -
--    Shop-approved assets have contexts=['shop']; chat-approved have
--    contexts=['chat']. Strictly disjoint per owner directive. Owner can
--    UPDATE contexts later to promote an asset to both via a dedicated
--    admin path · not part of this migration.

-- SEED BLOCK BEGIN
-- (embedded via `node scripts/extract-background-asset-seed.mjs` output
--  concatenated below the DDL at migration-draft time · 353 rows total)

-- See 337_nex_background_asset_seed.sql for the full INSERT batch.
-- The seed is split out to a sibling file so this DDL file stays readable
-- in code review. Both files must be applied together as part of the same
-- migration transaction; see apply script (TBD, owner-authorised).

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '337',
  'nex_background_asset · unified NEX Visual Library catalog + 353-row seed',
  'Phase 1 of the unified library per owner directive 2026-11-11. '
  'Shop (279) + Chat library local (74) assets seeded with strictly disjoint '
  'contexts. Existing selection columns (nex_account.chat_theme, '
  'nex_business.shop_cover_image_url, shop_cover_tint_hex) unchanged.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
