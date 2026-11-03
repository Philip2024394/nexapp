-- nex-supabase/migrations/266_nex_community_zone_seed_ie_ireland.sql
--
-- NEX Community Noticeboard · initial reference-zone seed for Ireland (ROI).
-- Founder-authorised 2026-11-03 · "ireland zones so user location will be
-- picked up when create account". Parallel to migration 147's Yogyakarta
-- seed · same ON CONFLICT DO NOTHING idempotency pattern.
--
-- WHAT THIS DOES
--   Idempotently inserts the Republic of Ireland public-admin zone
--   hierarchy under country IE:
--     · 1 country row: Ireland
--     · 4 provinces: Leinster · Munster · Connacht · Ulster (ROI only)
--     · 26 counties (level='city' to match Yogyakarta's "Kota" aggregator
--       pattern · fits the sealed level enum from migration 146):
--         Leinster (12): Carlow · Dublin · Kildare · Kilkenny · Laois ·
--                        Longford · Louth · Meath · Offaly · Westmeath ·
--                        Wexford · Wicklow
--         Munster  (6):  Clare · Cork · Kerry · Limerick · Tipperary · Waterford
--         Connacht (5):  Galway · Leitrim · Mayo · Roscommon · Sligo
--         Ulster   (3):  Cavan · Donegal · Monaghan
--     Total: 31 rows across country/province/county.
--
-- NOT INCLUDED
--   · Northern Ireland counties (Antrim, Armagh, Down, Fermanagh,
--     Londonderry, Tyrone) · ROI-only for v1 · can be added in a
--     follow-up seed if the owner expands scope.
--   · Electoral districts, towns, postcodes (D1/D2/Dublin city) ·
--     reserved for a sub-county seed when needed.
--
-- WHY `level='city'` FOR COUNTIES
--   Ireland's administrative county is the natural picker-level for
--   NEX Community membership (people identify by county). The sealed
--   level enum in migration 146 doesn't include 'county' but DOES
--   include 'city' · we use 'city' as the aggregator level the same
--   way Yogyakarta uses it for "Kota Yogyakarta". The Community card's
--   security copy rule (city-level only · no "2km"/"nearby") is
--   satisfied by county names (Dublin · Cork · Galway).
--
-- IDEMPOTENCY STRATEGY
--   Same two partial unique indexes as migration 147 (defined in 146):
--     uq_zone_parent_slug_root  (country, level, slug)       WHERE parent_zone_id IS NULL
--     uq_zone_parent_slug       (parent_zone_id, slug)       WHERE parent_zone_id IS NOT NULL
--   ON CONFLICT inference against a partial index requires the WHERE
--   predicate to match exactly, so each INSERT below spells it out.
--
-- SIGNUP IMPACT
--   `suggestZonesForOnboarding` in `src/lib/nex-native/community/zone-
--   service.ts` currently HARDCODES Indonesia · Kota Yogyakarta. This
--   migration ships the data · a parallel service-layer change (same
--   PR) makes the suggestion country-aware so Irish signups see the
--   26 counties, Indonesian signups still see Yogyakarta kecamatans.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1 · Country row
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO nex_community_zone (country, level, name, slug, parent_zone_id)
VALUES ('IE', 'country', 'Ireland', 'ie', NULL)
ON CONFLICT (country, level, slug) WHERE parent_zone_id IS NULL
DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 2 · Four provinces
-- ─────────────────────────────────────────────────────────────────────
WITH ie_country AS (
  SELECT id FROM nex_community_zone
   WHERE country = 'IE' AND level = 'country' AND slug = 'ie' AND parent_zone_id IS NULL
)
INSERT INTO nex_community_zone (parent_zone_id, country, level, name, slug)
SELECT (SELECT id FROM ie_country), 'IE', 'province', v.name, v.slug
FROM (VALUES
  ('Leinster', 'leinster'),
  ('Munster',  'munster'),
  ('Connacht', 'connacht'),
  ('Ulster',   'ulster')
) AS v(name, slug)
ON CONFLICT (parent_zone_id, slug) WHERE parent_zone_id IS NOT NULL
DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 3 · 26 counties (ROI only) · level='city' · parent = province
-- ─────────────────────────────────────────────────────────────────────

-- Leinster · 12 counties
WITH prov AS (
  SELECT id FROM nex_community_zone
   WHERE country = 'IE' AND level = 'province' AND slug = 'leinster' AND parent_zone_id IS NOT NULL
)
INSERT INTO nex_community_zone (parent_zone_id, country, level, name, slug)
SELECT (SELECT id FROM prov), 'IE', 'city', v.name, v.slug
FROM (VALUES
  ('Carlow',    'county-carlow'),
  ('Dublin',    'county-dublin'),
  ('Kildare',   'county-kildare'),
  ('Kilkenny',  'county-kilkenny'),
  ('Laois',     'county-laois'),
  ('Longford',  'county-longford'),
  ('Louth',     'county-louth'),
  ('Meath',     'county-meath'),
  ('Offaly',    'county-offaly'),
  ('Westmeath', 'county-westmeath'),
  ('Wexford',   'county-wexford'),
  ('Wicklow',   'county-wicklow')
) AS v(name, slug)
ON CONFLICT (parent_zone_id, slug) WHERE parent_zone_id IS NOT NULL
DO NOTHING;

-- Munster · 6 counties
WITH prov AS (
  SELECT id FROM nex_community_zone
   WHERE country = 'IE' AND level = 'province' AND slug = 'munster' AND parent_zone_id IS NOT NULL
)
INSERT INTO nex_community_zone (parent_zone_id, country, level, name, slug)
SELECT (SELECT id FROM prov), 'IE', 'city', v.name, v.slug
FROM (VALUES
  ('Clare',     'county-clare'),
  ('Cork',      'county-cork'),
  ('Kerry',     'county-kerry'),
  ('Limerick',  'county-limerick'),
  ('Tipperary', 'county-tipperary'),
  ('Waterford', 'county-waterford')
) AS v(name, slug)
ON CONFLICT (parent_zone_id, slug) WHERE parent_zone_id IS NOT NULL
DO NOTHING;

-- Connacht · 5 counties
WITH prov AS (
  SELECT id FROM nex_community_zone
   WHERE country = 'IE' AND level = 'province' AND slug = 'connacht' AND parent_zone_id IS NOT NULL
)
INSERT INTO nex_community_zone (parent_zone_id, country, level, name, slug)
SELECT (SELECT id FROM prov), 'IE', 'city', v.name, v.slug
FROM (VALUES
  ('Galway',    'county-galway'),
  ('Leitrim',   'county-leitrim'),
  ('Mayo',      'county-mayo'),
  ('Roscommon', 'county-roscommon'),
  ('Sligo',     'county-sligo')
) AS v(name, slug)
ON CONFLICT (parent_zone_id, slug) WHERE parent_zone_id IS NOT NULL
DO NOTHING;

-- Ulster (ROI only) · 3 counties
WITH prov AS (
  SELECT id FROM nex_community_zone
   WHERE country = 'IE' AND level = 'province' AND slug = 'ulster' AND parent_zone_id IS NOT NULL
)
INSERT INTO nex_community_zone (parent_zone_id, country, level, name, slug)
SELECT (SELECT id FROM prov), 'IE', 'city', v.name, v.slug
FROM (VALUES
  ('Cavan',     'county-cavan'),
  ('Donegal',   'county-donegal'),
  ('Monaghan',  'county-monaghan')
) AS v(name, slug)
ON CONFLICT (parent_zone_id, slug) WHERE parent_zone_id IS NOT NULL
DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 4 · Migration history
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO nex_migration_history (version, description)
VALUES (
  '266',
  'nex_community_zone seed · Ireland (IE) · 1 country + 4 provinces + 26 ROI counties'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
