-- ============================================================================
-- NEX-native Migration 154 · nex_account.last_known_* (user saved location)
-- ============================================================================
--
-- Purpose:
--   Add optional saved-location columns on nex_account to support the
--   hybrid user-location system: local-first for anonymous visitors,
--   server-side for signed-in accounts. 30-day application-layer TTL;
--   the DB itself does NOT enforce freshness.
--
-- Doctrine references:
--   · Identity Doctrine · nex_account.id is the anchor; these columns
--     are optional attributes on that identity, not a new table.
--   · Privacy · these coordinates are PRIVATE user data · readable only
--     by the owning user's session · never exposed on business pages or
--     to other users.
--
-- Columns (all nullable · additive):
--   · last_known_lat          numeric(9,6) · WGS84 · [-90, 90]
--   · last_known_lng          numeric(9,6) · WGS84 · [-180, 180]
--   · last_known_city_label   text         · human-readable (max 120)
--   · last_known_country_iso  text         · ISO 3166-1 alpha-2
--   · last_known_source       text         · 'gps' | 'manual_city'
--   · last_known_set_at       timestamptz  · UTC
--
-- Constraints:
--   · lat/lng ranges enforced by DB CHECK
--   · lat + lng must be both NULL or both set (never half)
--   · source ∈ {'gps','manual_city'}
--   · country_iso matches ^[A-Z]{2}$
--   · city_label capped at 120 chars
--
-- Compatibility:
--   The user-location service degrades gracefully when these columns
--   are absent (try/catch at the server-store layer · falls back to
--   localStorage-only). Deploying this migration is therefore safe
--   whether rolled out before or after the service code.
--
-- Rollback:
--   BEGIN;
--     ALTER TABLE nex_account
--       DROP CONSTRAINT IF EXISTS nex_account_last_known_city_label_len,
--       DROP CONSTRAINT IF EXISTS nex_account_last_known_country_iso_shape,
--       DROP CONSTRAINT IF EXISTS nex_account_last_known_source_enum,
--       DROP CONSTRAINT IF EXISTS nex_account_last_known_both_or_neither,
--       DROP CONSTRAINT IF EXISTS nex_account_last_known_lng_range,
--       DROP CONSTRAINT IF EXISTS nex_account_last_known_lat_range,
--       DROP COLUMN IF EXISTS last_known_set_at,
--       DROP COLUMN IF EXISTS last_known_source,
--       DROP COLUMN IF EXISTS last_known_country_iso,
--       DROP COLUMN IF EXISTS last_known_city_label,
--       DROP COLUMN IF EXISTS last_known_lng,
--       DROP COLUMN IF EXISTS last_known_lat;
--     DELETE FROM nex_migration_history WHERE version = '154';
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS last_known_lat          numeric(9,6),
  ADD COLUMN IF NOT EXISTS last_known_lng          numeric(9,6),
  ADD COLUMN IF NOT EXISTS last_known_city_label   text,
  ADD COLUMN IF NOT EXISTS last_known_country_iso  text,
  ADD COLUMN IF NOT EXISTS last_known_source       text,
  ADD COLUMN IF NOT EXISTS last_known_set_at       timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nex_account_last_known_lat_range') THEN
    ALTER TABLE nex_account
      ADD CONSTRAINT nex_account_last_known_lat_range CHECK (
        last_known_lat IS NULL OR (last_known_lat >= -90 AND last_known_lat <= 90)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nex_account_last_known_lng_range') THEN
    ALTER TABLE nex_account
      ADD CONSTRAINT nex_account_last_known_lng_range CHECK (
        last_known_lng IS NULL OR (last_known_lng >= -180 AND last_known_lng <= 180)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nex_account_last_known_both_or_neither') THEN
    ALTER TABLE nex_account
      ADD CONSTRAINT nex_account_last_known_both_or_neither CHECK (
        (last_known_lat IS NULL) = (last_known_lng IS NULL)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nex_account_last_known_source_enum') THEN
    ALTER TABLE nex_account
      ADD CONSTRAINT nex_account_last_known_source_enum CHECK (
        last_known_source IS NULL OR last_known_source IN ('gps', 'manual_city')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nex_account_last_known_country_iso_shape') THEN
    ALTER TABLE nex_account
      ADD CONSTRAINT nex_account_last_known_country_iso_shape CHECK (
        last_known_country_iso IS NULL OR last_known_country_iso ~ '^[A-Z]{2}$'
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nex_account_last_known_city_label_len') THEN
    ALTER TABLE nex_account
      ADD CONSTRAINT nex_account_last_known_city_label_len CHECK (
        last_known_city_label IS NULL OR char_length(last_known_city_label) <= 120
      );
  END IF;
END$$;

COMMENT ON COLUMN nex_account.last_known_lat IS
  'Optional saved latitude · WGS84 · set by user via GPS grant or manual city centroid · PRIVATE · never exposed to businesses or other users.';
COMMENT ON COLUMN nex_account.last_known_lng IS
  'Optional saved longitude · WGS84 · paired with last_known_lat (both NULL or both set) · PRIVATE.';
COMMENT ON COLUMN nex_account.last_known_city_label IS
  'Optional user-chosen location label (e.g. "Yogyakarta, Indonesia") · 120-char cap · PRIVATE.';
COMMENT ON COLUMN nex_account.last_known_country_iso IS
  'Optional ISO 3166-1 alpha-2 of the saved location.';
COMMENT ON COLUMN nex_account.last_known_source IS
  'How this location was obtained · gps (navigator.geolocation grant) or manual_city (user-entered area resolved to a city centroid).';
COMMENT ON COLUMN nex_account.last_known_set_at IS
  'Timestamp the location was last written. Freshness window (30 days by default) enforced in application layer, not DB.';

INSERT INTO nex_migration_history (version, description, applied_at)
VALUES ('154', 'nex_account.last_known_* saved-location columns (hybrid user-location system)', now())
ON CONFLICT (version) DO NOTHING;

COMMIT;
