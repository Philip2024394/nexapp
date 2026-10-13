-- Migration 187 · Seed US + AU into nex.world_country and opt both
--                into nex.discovery_programme_country ("scaffolding").
-- -------------------------------------------------------------------
-- Status: DRAFT · founder authorisation required before applying to
-- Supabase project `ijvqdvsvwtwxzcqmoqit`.
--
-- Change plan verified against live state (2026-10-13):
--   · nex.world_country already contains 17 ISOs including GB + 15
--     European countries + JP + KR. US and AU are NOT present.
--   · nex.discovery_programme_country already has all 17 of those
--     opted in to programme_id = 00000000-0000-4000-8000-000000000001
--     (slug=scaffolding, status=active, cadence_seconds=300).
--   · Highest applied migration version in nex_migration_history: 186.
--     This file is the next slot (187).
--
-- Rollback (HARDENED 2026-10-13 · scoped by metadata.added_by_migration):
--   The naïve rollback (DELETE … WHERE iso_alpha_2 IN ('US','AU'))
--   would also remove any US/AU row somebody else inserted manually
--   before this migration ever ran. The scoped version below only
--   touches rows this migration itself created, verified by the
--   `added_by_migration=187` marker baked into metadata / policy_json.
--
--   BEGIN;
--     DELETE FROM nex.discovery_programme_country
--      WHERE programme_id = '00000000-0000-4000-8000-000000000001'
--        AND iso_alpha_2 IN ('US', 'AU')
--        AND policy_json->>'added_by_migration' = '187';
--
--     DELETE FROM nex.world_country
--      WHERE iso_alpha_2 IN ('US', 'AU')
--        AND metadata->>'added_by_migration' = '187';
--
--     DELETE FROM nex_migration_history WHERE version = '187';
--   COMMIT;
--
-- Why this is safer:
--   · If someone adds US/AU manually BEFORE 187 is applied, rollback
--     leaves their row intact (added_by_migration marker missing).
--   · If someone edits one of the migration-added rows and clears
--     the marker, rollback leaves it alone (opt-out behaviour).
--   · If the migration ran twice (ON CONFLICT DO NOTHING on second),
--     rollback still cleans up the one row that is actually ours.
--   · Rollback never touches unrelated world_country rows (GB, DE, …
--     were seeded by earlier migrations and carry no 187 marker).
--
-- Non-goals of this migration:
--   · Does NOT activate the harvester daemon · that runs from
--     D:/trades/scripts/nex-harvest-daemon.mjs on a Windows Scheduled
--     Task · adding countries to world_country only tells the
--     discovery programme that they exist and are opt-in.
--   · Does NOT change source_registry flags · US+AU sources inherit
--     the existing OSM Overpass connectors (which have country-
--     agnostic coverage via bbox / country-filtered Overpass queries).
--   · Does NOT populate business_canonical for US/AU · that only
--     happens when the daemon actually runs cycles against those
--     territories.
--   · Does NOT configure city rotation for US/AU cities · the
--     daemon's cursor file (data/harvest-osm/cursor.json) sits in
--     D:/trades and needs its city list extended separately by the
--     operator who runs the daemon.
--
-- Idempotent · ON CONFLICT guards every insert so re-running is safe.
--
BEGIN;

-- ─── Seed world_country rows ─────────────────────────────────────
INSERT INTO nex.world_country (
  iso_alpha_2, iso_alpha_3, numeric_code, name, official_name,
  region, subregion, un_member, sovereign, currency, languages,
  metadata, active_in_nex
) VALUES
  (
    'US', 'USA', '840',
    'United States',
    'United States of America',
    'Americas', 'Northern America',
    TRUE, TRUE,
    'USD', ARRAY['en']::text[],
    jsonb_build_object(
      'added_by_migration', 187,
      'added_at', now(),
      'note', 'Seeded for discovery programme opt-in · OSM Overpass + Nominatim coverage · harvester activation gated on operator-side Task Scheduler'
    ),
    TRUE
  ),
  (
    'AU', 'AUS', '036',
    'Australia',
    'Commonwealth of Australia',
    'Oceania', 'Australia and New Zealand',
    TRUE, TRUE,
    'AUD', ARRAY['en']::text[],
    jsonb_build_object(
      'added_by_migration', 187,
      'added_at', now(),
      'note', 'Seeded for discovery programme opt-in · OSM Overpass + Nominatim coverage · harvester activation gated on operator-side Task Scheduler'
    ),
    TRUE
  )
ON CONFLICT (iso_alpha_2) DO NOTHING;

-- ─── Opt both into the scaffolding discovery programme ─────────────
INSERT INTO nex.discovery_programme_country (
  programme_id, iso_alpha_2, included, priority, policy_json
) VALUES
  (
    '00000000-0000-4000-8000-000000000001', 'US', TRUE, 100,
    jsonb_build_object(
      'added_by_migration', 187,
      'cold_start_cycle_cap', 20,
      'rate_limit_rps', 1,
      'notes', 'Cold-start cap keeps the first harvest window bounded while the operator validates Overpass + Nominatim behaviour against US bounding boxes.'
    )
  ),
  (
    '00000000-0000-4000-8000-000000000001', 'AU', TRUE, 100,
    jsonb_build_object(
      'added_by_migration', 187,
      'cold_start_cycle_cap', 20,
      'rate_limit_rps', 1,
      'notes', 'Cold-start cap keeps the first harvest window bounded while the operator validates Overpass + Nominatim behaviour against AU bounding boxes.'
    )
  )
ON CONFLICT (programme_id, iso_alpha_2) DO NOTHING;

-- ─── Record this migration ────────────────────────────────────────
INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '187',
  'Seed US + AU into nex.world_country + nex.discovery_programme_country',
  '187_nex_world_country_us_au_seed.sql · founder-authorised 2026-10-13 · does not activate harvester; operator must extend city rotation + enable Windows Scheduled Task separately'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
