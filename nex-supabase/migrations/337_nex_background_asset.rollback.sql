-- Migration 337 ROLLBACK · nex_background_asset
-- -----------------------------------------------------------------------------
-- Clean removal. Safe even if called multiple times (uses IF EXISTS).
-- Does NOT touch any existing writer path · existing selection columns
-- (nex_account.chat_theme, nex_business.shop_cover_image_url, shop_cover_tint_hex)
-- are not referenced by this migration, so rollback is a strict reversal.

BEGIN;

DROP TRIGGER IF EXISTS nex_background_asset_touch_updated_at_trg ON nex_background_asset;
DROP FUNCTION IF EXISTS nex_background_asset_touch_updated_at();

DROP POLICY IF EXISTS nex_background_asset_public_read ON nex_background_asset;
DROP INDEX IF EXISTS nex_background_asset_storage_url_unique;
DROP INDEX IF EXISTS nex_background_asset_active_tier_sort;
DROP INDEX IF EXISTS nex_background_asset_categories_gin;
DROP INDEX IF EXISTS nex_background_asset_contexts_gin;
DROP TABLE IF EXISTS nex_background_asset;

DELETE FROM nex_migration_history WHERE version = '337';

COMMIT;
