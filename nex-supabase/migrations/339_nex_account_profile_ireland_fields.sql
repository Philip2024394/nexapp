-- ============================================================================
-- NEX-native Migration 339 · nex_account_profile · Ireland profile fields
-- Owner-authorised DRAFT 2026-11-12 · NOT APPLIED · pending owner approval.
-- ============================================================================
--
-- Purpose:
--   Add the seven profile fields the sealed Ireland profile-edit
--   surface already writes but which the sandbox schema is missing,
--   causing every save to fail with PGRST204. This migration ONLY
--   adds nullable text columns with length CHECK constraints · zero
--   impact on existing rows · zero RLS change · zero index change.
--
-- Columns added (all nullable text):
--   · country_code         · ISO-3166-1 alpha-2 (2 upper-case letters)
--   · address              · free-text postal address · cap 300 chars
--   · instagram_handle     · bare handle · app strips @/URL · cap 50 chars
--   · tiktok_handle        · bare handle · app strips @/URL · cap 50 chars
--   · facebook_handle      · bare handle · app strips URL      · cap 50 chars
--   · x_handle             · bare handle · app strips @/URL · cap 50 chars
--   · youtube_handle       · bare handle · app strips @/URL · cap 50 chars
--
-- All CHECK names follow the sealed convention
-- `nex_account_profile_<field>_<dimension>` seen on existing columns
-- (profession_len, headline_len, location_label_len, about_me_max,
-- bio_len, interests_max, …).
--
-- Idempotency:
--   · ADD COLUMN IF NOT EXISTS so re-apply is a no-op.
--   · DROP CONSTRAINT IF EXISTS then ADD CONSTRAINT so a corrupt
--     half-applied state can be healed by a second run.
--   · nex_migration_history uses ON CONFLICT DO NOTHING.
--
-- Rollback: see 339_nex_account_profile_ireland_fields_rollback.sql
-- (dedicated file · intentionally kept separate so a rollback can be
-- reviewed and run independently of the forward script).
-- ============================================================================

BEGIN;

-- ─── 1 · country_code · ISO-3166-1 alpha-2 ──────────────────────────────────
ALTER TABLE nex_account_profile
  ADD COLUMN IF NOT EXISTS country_code text;

ALTER TABLE nex_account_profile
  DROP CONSTRAINT IF EXISTS nex_account_profile_country_code_iso2;

ALTER TABLE nex_account_profile
  ADD CONSTRAINT nex_account_profile_country_code_iso2
    CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

COMMENT ON COLUMN nex_account_profile.country_code IS
  'ISO-3166-1 alpha-2 country of residence · 2 upper-case letters · nullable · server coerces input to upper-case before persisting.';

-- ─── 2 · address · free-text postal address ─────────────────────────────────
ALTER TABLE nex_account_profile
  ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE nex_account_profile
  DROP CONSTRAINT IF EXISTS nex_account_profile_address_len;

ALTER TABLE nex_account_profile
  ADD CONSTRAINT nex_account_profile_address_len
    CHECK (address IS NULL OR char_length(address) <= 300);

COMMENT ON COLUMN nex_account_profile.address IS
  'User-authored postal address · cap 300 chars · nullable · optional on the profile edit page · diaspora-friendly.';

-- ─── 3 · instagram_handle ───────────────────────────────────────────────────
ALTER TABLE nex_account_profile
  ADD COLUMN IF NOT EXISTS instagram_handle text;

ALTER TABLE nex_account_profile
  DROP CONSTRAINT IF EXISTS nex_account_profile_instagram_handle_len;

ALTER TABLE nex_account_profile
  ADD CONSTRAINT nex_account_profile_instagram_handle_len
    CHECK (instagram_handle IS NULL OR char_length(instagram_handle) <= 50);

COMMENT ON COLUMN nex_account_profile.instagram_handle IS
  'Bare Instagram handle · leading @ + URL stripped server-side · cap 50 chars · nullable · optional.';

-- ─── 4 · tiktok_handle ──────────────────────────────────────────────────────
ALTER TABLE nex_account_profile
  ADD COLUMN IF NOT EXISTS tiktok_handle text;

ALTER TABLE nex_account_profile
  DROP CONSTRAINT IF EXISTS nex_account_profile_tiktok_handle_len;

ALTER TABLE nex_account_profile
  ADD CONSTRAINT nex_account_profile_tiktok_handle_len
    CHECK (tiktok_handle IS NULL OR char_length(tiktok_handle) <= 50);

COMMENT ON COLUMN nex_account_profile.tiktok_handle IS
  'Bare TikTok handle · leading @ + URL stripped server-side · cap 50 chars · nullable · optional.';

-- ─── 5 · facebook_handle ────────────────────────────────────────────────────
ALTER TABLE nex_account_profile
  ADD COLUMN IF NOT EXISTS facebook_handle text;

ALTER TABLE nex_account_profile
  DROP CONSTRAINT IF EXISTS nex_account_profile_facebook_handle_len;

ALTER TABLE nex_account_profile
  ADD CONSTRAINT nex_account_profile_facebook_handle_len
    CHECK (facebook_handle IS NULL OR char_length(facebook_handle) <= 50);

COMMENT ON COLUMN nex_account_profile.facebook_handle IS
  'Bare Facebook handle · URL stripped server-side · cap 50 chars · nullable · optional.';

-- ─── 6 · x_handle ───────────────────────────────────────────────────────────
ALTER TABLE nex_account_profile
  ADD COLUMN IF NOT EXISTS x_handle text;

ALTER TABLE nex_account_profile
  DROP CONSTRAINT IF EXISTS nex_account_profile_x_handle_len;

ALTER TABLE nex_account_profile
  ADD CONSTRAINT nex_account_profile_x_handle_len
    CHECK (x_handle IS NULL OR char_length(x_handle) <= 50);

COMMENT ON COLUMN nex_account_profile.x_handle IS
  'Bare X / Twitter handle · leading @ + URL stripped server-side · cap 50 chars · nullable · optional.';

-- ─── 7 · youtube_handle ─────────────────────────────────────────────────────
ALTER TABLE nex_account_profile
  ADD COLUMN IF NOT EXISTS youtube_handle text;

ALTER TABLE nex_account_profile
  DROP CONSTRAINT IF EXISTS nex_account_profile_youtube_handle_len;

ALTER TABLE nex_account_profile
  ADD CONSTRAINT nex_account_profile_youtube_handle_len
    CHECK (youtube_handle IS NULL OR char_length(youtube_handle) <= 50);

COMMENT ON COLUMN nex_account_profile.youtube_handle IS
  'Bare YouTube handle · leading @ + URL stripped server-side · cap 50 chars · nullable · optional.';

-- ─── Migration history row ──────────────────────────────────────────────────
INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '339',
  'nex_account_profile · 7 Ireland profile fields (country_code, address, 5 social handles)',
  'Owner-authorised 2026-11-12. All nullable text columns with length / format CHECK constraints. Zero impact on existing rows. No RLS or index changes. Unblocks the sealed /settings/profile/edit server action which already writes these columns.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification queries (run manually or via apply script)
-- ============================================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='nex_account_profile'
--    AND column_name IN ('country_code','address','instagram_handle',
--                        'tiktok_handle','facebook_handle','x_handle',
--                        'youtube_handle')
--  ORDER BY column_name;
--
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'public.nex_account_profile'::regclass
--    AND conname IN ('nex_account_profile_country_code_iso2',
--                    'nex_account_profile_address_len',
--                    'nex_account_profile_instagram_handle_len',
--                    'nex_account_profile_tiktok_handle_len',
--                    'nex_account_profile_facebook_handle_len',
--                    'nex_account_profile_x_handle_len',
--                    'nex_account_profile_youtube_handle_len')
--  ORDER BY conname;
--
-- SELECT version, description FROM nex_migration_history WHERE version='339';
--
-- Expected row count unchanged:
-- SELECT COUNT(*) FROM nex_account_profile;   -- was 7 pre-apply
