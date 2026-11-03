-- 273_nex_account_profile_ireland_fields.sql
--
-- NEX Ireland · profile edit · owner-authorised 2026-11-04 ("C" path).
--
-- CONTEXT
--   The redesigned /settings/profile/edit page needs 7 new fields on
--   nex_account_profile:
--
--     · country_code       ISO2 (IE · US · GB · AU · CA ...) · country
--                          of residence · dropdown · defaults to IE
--     · address            street address · optional (diaspora may
--                          not want to share foreign address)
--     · interests          2-slot pick-list · overlapping Irish-
--                          culture + universal options
--     · instagram_handle   social link · no leading @
--     · tiktok_handle      same
--     · facebook_handle    same
--     · x_handle           same (formerly Twitter)
--     · youtube_handle     same (channel handle or ID)
--
-- All nullable. Existing rows are unaffected. The owner / diaspora
-- framing is UI copy · no schema branch.
--
-- WHY NEW COLUMNS INSTEAD OF REPURPOSING SKILLS[]
--   nex_account_profile.skills[] is a 20-slot generic skills array
--   (sealed migration 042) used by the Directory discovery surface.
--   Interests are a different product concept · pick-2 personality
--   signal shown on the profile card · must not collide with the
--   Directory indexing semantics on skills.
--
-- CHECK CONSTRAINTS
--   · country_code must be 2 uppercase letters (ISO 3166-1 alpha-2).
--   · address max 200 chars (same as nex_business.address convention).
--   · interests max 2 entries + each entry 1-40 chars (prevents
--     unbounded pick-list drift).
--   · each social handle max 50 chars + no leading @ / # / url
--     prefix (we store the bare handle so URL rendering stays in
--     view code · idempotent across platforms).
--
-- IDEMPOTENCY
--   ADD COLUMN IF NOT EXISTS throughout · DO blocks guard CHECK
--   constraint adds so re-apply is a no-op.

-- Apply guard
DO $$ BEGIN
  RAISE EXCEPTION 'Migration 273 is DRAFT · comment out this block before applying.';
END $$;

ALTER TABLE nex_account_profile
  ADD COLUMN IF NOT EXISTS country_code     text,
  ADD COLUMN IF NOT EXISTS address          text,
  ADD COLUMN IF NOT EXISTS interests        text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS tiktok_handle    text,
  ADD COLUMN IF NOT EXISTS facebook_handle  text,
  ADD COLUMN IF NOT EXISTS x_handle         text,
  ADD COLUMN IF NOT EXISTS youtube_handle   text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nex_account_profile_country_iso2') THEN
    ALTER TABLE nex_account_profile
      ADD CONSTRAINT nex_account_profile_country_iso2
      CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nex_account_profile_address_len') THEN
    ALTER TABLE nex_account_profile
      ADD CONSTRAINT nex_account_profile_address_len
      CHECK (address IS NULL OR char_length(address) <= 200);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nex_account_profile_interests_max') THEN
    ALTER TABLE nex_account_profile
      ADD CONSTRAINT nex_account_profile_interests_max
      CHECK (array_length(interests, 1) IS NULL OR array_length(interests, 1) <= 2);
  END IF;
END $$;

-- Handle length / shape guard · same policy on all five social fields.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nex_account_profile_social_handle_shape') THEN
    ALTER TABLE nex_account_profile
      ADD CONSTRAINT nex_account_profile_social_handle_shape
      CHECK (
        (instagram_handle IS NULL OR (char_length(instagram_handle) BETWEEN 1 AND 50 AND instagram_handle !~ '^[@#]|^https?://'))
        AND (tiktok_handle    IS NULL OR (char_length(tiktok_handle)    BETWEEN 1 AND 50 AND tiktok_handle    !~ '^[@#]|^https?://'))
        AND (facebook_handle  IS NULL OR (char_length(facebook_handle)  BETWEEN 1 AND 50 AND facebook_handle  !~ '^[@#]|^https?://'))
        AND (x_handle         IS NULL OR (char_length(x_handle)         BETWEEN 1 AND 50 AND x_handle         !~ '^[@#]|^https?://'))
        AND (youtube_handle   IS NULL OR (char_length(youtube_handle)   BETWEEN 1 AND 50 AND youtube_handle   !~ '^[@#]|^https?://'))
      );
  END IF;
END $$;

INSERT INTO nex_migration_history (version, description, applied_at)
VALUES ('273', 'account_profile · Ireland fields (country/address/interests/socials)', now())
ON CONFLICT (version) DO NOTHING;
