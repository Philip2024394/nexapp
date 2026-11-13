-- ============================================================================
-- NEX-native Migration 339 · ROLLBACK
-- Reverses 339_nex_account_profile_ireland_fields.sql.
-- ============================================================================
--
-- Safety:
--   · Drops CHECK constraints first, then columns, then migration_history
--     row. All IF EXISTS so partial-apply states roll back cleanly.
--   · Data in these 7 columns is DELETED as part of DROP COLUMN · the
--     purpose is to undo an unapproved apply. If you need to preserve
--     data, snapshot first with:
--       CREATE TABLE _rollback_339_snapshot AS
--         SELECT account_id, country_code, address, instagram_handle,
--                tiktok_handle, facebook_handle, x_handle, youtube_handle
--           FROM nex_account_profile;
--
-- Do not run without separate authorisation. This is a review artefact.
-- ============================================================================

BEGIN;

-- Drop CHECK constraints
ALTER TABLE nex_account_profile
  DROP CONSTRAINT IF EXISTS nex_account_profile_country_code_iso2,
  DROP CONSTRAINT IF EXISTS nex_account_profile_address_len,
  DROP CONSTRAINT IF EXISTS nex_account_profile_instagram_handle_len,
  DROP CONSTRAINT IF EXISTS nex_account_profile_tiktok_handle_len,
  DROP CONSTRAINT IF EXISTS nex_account_profile_facebook_handle_len,
  DROP CONSTRAINT IF EXISTS nex_account_profile_x_handle_len,
  DROP CONSTRAINT IF EXISTS nex_account_profile_youtube_handle_len;

-- Drop columns
ALTER TABLE nex_account_profile
  DROP COLUMN IF EXISTS country_code,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS instagram_handle,
  DROP COLUMN IF EXISTS tiktok_handle,
  DROP COLUMN IF EXISTS facebook_handle,
  DROP COLUMN IF EXISTS x_handle,
  DROP COLUMN IF EXISTS youtube_handle;

-- Remove migration history row so a re-apply can run cleanly
DELETE FROM nex_migration_history WHERE version = '339';

COMMIT;
