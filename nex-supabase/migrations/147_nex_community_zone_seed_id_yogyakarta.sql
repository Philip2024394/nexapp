-- nex-supabase/migrations/147_nex_community_zone_seed_id_yogyakarta.sql
--
-- NEX Community Noticeboard · initial reference-zone seed for Yogyakarta, Indonesia.
-- Founder-authorised 2026-10-11.
--
-- WHAT THIS DOES
--   Idempotently inserts a real public-admin zone hierarchy for Kota
--   Yogyakarta (14 kecamatans) under Daerah Istimewa Yogyakarta
--   province under country ID. All 14 names are standard BPS admin
--   units — verifiable public reference data.
--
-- NOT INCLUDED
--   · Kelurahan, RW, RT levels — reserved for admin / future seed.
--   · Other provinces + cities — add in later per-region seeds.
--
-- IDEMPOTENCY STRATEGY
--   The two partial unique indexes on nex_community_zone are:
--     uq_zone_parent_slug_root  (country, level, slug)       WHERE parent_zone_id IS NULL
--     uq_zone_parent_slug       (parent_zone_id, slug)       WHERE parent_zone_id IS NOT NULL
--   ON CONFLICT inference against a partial index requires the WHERE
--   predicate to match exactly, so each INSERT below spells it out.

BEGIN;

-- 1 · Country row.
INSERT INTO nex_community_zone (country, level, name, slug, parent_zone_id)
VALUES ('ID', 'country', 'Indonesia', 'id', NULL)
ON CONFLICT (country, level, slug) WHERE parent_zone_id IS NULL
DO NOTHING;

-- 2 · Province: Daerah Istimewa Yogyakarta.
WITH country_id AS (
  SELECT id FROM nex_community_zone
   WHERE country = 'ID' AND level = 'country' AND slug = 'id' AND parent_zone_id IS NULL
)
INSERT INTO nex_community_zone (parent_zone_id, country, level, name, slug)
SELECT (SELECT id FROM country_id), 'ID', 'province',
       'Daerah Istimewa Yogyakarta', 'di-yogyakarta'
ON CONFLICT (parent_zone_id, slug) WHERE parent_zone_id IS NOT NULL
DO NOTHING;

-- 3 · City: Kota Yogyakarta.
WITH province_id AS (
  SELECT id FROM nex_community_zone
   WHERE country = 'ID' AND level = 'province' AND slug = 'di-yogyakarta'
)
INSERT INTO nex_community_zone (parent_zone_id, country, level, name, slug)
SELECT (SELECT id FROM province_id), 'ID', 'city',
       'Kota Yogyakarta', 'kota-yogyakarta'
ON CONFLICT (parent_zone_id, slug) WHERE parent_zone_id IS NOT NULL
DO NOTHING;

-- 4 · 14 kecamatans of Kota Yogyakarta.
WITH city_id AS (
  SELECT id FROM nex_community_zone
   WHERE country = 'ID' AND level = 'city' AND slug = 'kota-yogyakarta'
)
INSERT INTO nex_community_zone (parent_zone_id, country, level, name, slug)
SELECT (SELECT id FROM city_id), 'ID', 'kecamatan',
       kecamatan_name, kecamatan_slug
FROM (VALUES
  ('Danurejan',     'danurejan'),
  ('Gedongtengen',  'gedongtengen'),
  ('Gondokusuman',  'gondokusuman'),
  ('Gondomanan',    'gondomanan'),
  ('Jetis',         'jetis'),
  ('Kotagede',      'kotagede'),
  ('Kraton',        'kraton'),
  ('Mantrijeron',   'mantrijeron'),
  ('Mergangsan',    'mergangsan'),
  ('Ngampilan',     'ngampilan'),
  ('Pakualaman',    'pakualaman'),
  ('Tegalrejo',     'tegalrejo'),
  ('Umbulharjo',    'umbulharjo'),
  ('Wirobrajan',    'wirobrajan')
) AS kecamatans(kecamatan_name, kecamatan_slug)
ON CONFLICT (parent_zone_id, slug) WHERE parent_zone_id IS NOT NULL
DO NOTHING;

COMMIT;
