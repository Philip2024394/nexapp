-- ============================================================================
-- NEX-native Migration 274 · nex_account_profile.about_me
-- Owner-authorised DRAFT 2026-11-04 · NOT APPLIED until owner says so.
-- ============================================================================
--
-- Purpose:
--   Add an "about me" free-text field to nex_account_profile.
--   Rendered on the profile edit page (settings/profile/edit) with a
--   500-char hard cap and a soft advisory for ≤ 7 lines.
--
-- Shape:
--   about_me text (nullable · empty treated as null by the server
--                  action · hard cap 500 chars enforced in app layer
--                  AND via CHECK constraint below so a bad client
--                  can't bypass it).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '274';
--     ALTER TABLE nex_account_profile
--       DROP CONSTRAINT IF EXISTS nex_account_profile_about_me_max;
--     ALTER TABLE nex_account_profile DROP COLUMN IF EXISTS about_me;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_account_profile
  ADD COLUMN IF NOT EXISTS about_me text;

ALTER TABLE nex_account_profile
  DROP CONSTRAINT IF EXISTS nex_account_profile_about_me_max;

ALTER TABLE nex_account_profile
  ADD CONSTRAINT nex_account_profile_about_me_max
    CHECK (about_me IS NULL OR char_length(about_me) <= 500);

COMMENT ON COLUMN nex_account_profile.about_me IS
  'User-authored about-me paragraph · 500-char hard cap · optional · rendered on /nex-native/profile/me and /settings/profile/edit · soft advisory of 7 lines in UI.';

INSERT INTO nex_migration_history (version, description, applied_at)
VALUES ('274', 'nex_account_profile.about_me text column + 500-char CHECK', now())
ON CONFLICT (version) DO NOTHING;

COMMIT;
