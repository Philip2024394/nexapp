-- 271_nex_community_zone_seed_ie_wexford_areas.sql
--
-- NEX Ireland · Co Wexford · local community seed (42 rows).
-- Owner-authorised 2026-11-03 (pilot before the all-Ireland seed).
--
-- SCOPE
--   Seeds 42 secular placenames inside Co Wexford at level='neighbourhood'
--   under the sealed Wexford county row (country='IE', level='city',
--   slug='wexford' · from migration 266). These names are the ones a
--   Wexford resident will immediately recognise on a road sign:
--   Adamstown · Ballindaggin · Bannow · Bree · ... · Taghmon ·
--   Wexford Town.
--
-- NEUTRALITY (owner directive 2026-11-03)
--   Source data was compiled from the Diocese of Ferns parish directory
--   (public), but EVERY religious marker was stripped before insertion:
--     · No saint names ("St Aidan's" / "St Senan's" → "Enniscorthy")
--     · No "trinity"/"faith community" labels (dropped)
--     · No diocese or province labels in `name` or `slug`
--     · The user-facing word everywhere is "community"
--   The CHECK constraint on the level enum already includes
--   'neighbourhood' (sealed in migration 146) · no CHECK change needed.
--
-- MODERATION STATUS
--   All 42 rows insert as moderation_status='approved' (migration 270
--   default) · they are HQ-curated · not user-submitted.
--
-- IDEMPOTENCY
--   ON CONFLICT (parent_zone_id, slug) DO NOTHING against the sealed
--   partial unique index uq_zone_parent_slug (defined in migration 146).

-- Apply guard
DO $$ BEGIN
  RAISE EXCEPTION 'Migration 271 is DRAFT · comment out this block before applying.';
END $$;

WITH wexford AS (
  SELECT id FROM nex_community_zone
   WHERE country = 'IE'
     AND level = 'city'
     AND slug = 'wexford'
     AND parent_zone_id IS NOT NULL
)
INSERT INTO nex_community_zone (parent_zone_id, country, level, name, slug)
SELECT (SELECT id FROM wexford), 'IE', 'neighbourhood', v.name, v.slug
FROM (VALUES
  ('Adamstown',        'adamstown'),
  ('Ballindaggin',     'ballindaggin'),
  ('Ballycanew',       'ballycanew'),
  ('Ballycullane',     'ballycullane'),
  ('Ballyduff',        'ballyduff'),
  ('Ballygarrett',     'ballygarrett'),
  ('Bannow',           'bannow'),
  ('Blackwater',       'blackwater'),
  ('Bree',             'bree'),
  ('Bunclody',         'bunclody'),
  ('Camolin',          'camolin'),
  ('Castlebridge',     'castlebridge'),
  ('Clongeen',         'clongeen'),
  ('Clonard',          'clonard'),
  ('Cloughbawn',       'cloughbawn'),
  ('Crossabeg',        'crossabeg'),
  ('Curracloe',        'curracloe'),
  ('Cushinstown',      'cushinstown'),
  ('Davidstown',       'davidstown'),
  ('Duncannon',        'duncannon'),
  ('Enniscorthy',      'enniscorthy'),
  ('Ferns',            'ferns'),
  ('Fethard-on-Sea',   'fethard-on-sea'),
  ('Glynn',            'glynn'),
  ('Gorey',            'gorey'),
  ('Horeswood',        'horeswood'),
  ('Kilanerin',        'kilanerin'),
  ('Kilmore',          'kilmore'),
  ('Kilmore Quay',     'kilmore-quay'),
  ('Kilmuckridge',     'kilmuckridge'),
  ('Marshalstown',     'marshalstown'),
  ('Mayglass',         'mayglass'),
  ('Monageer',         'monageer'),
  ('New Ross',         'new-ross'),
  ('Oulart',           'oulart'),
  ('Oylegate',         'oylegate'),
  ('Piercestown',      'piercestown'),
  ('Rathangan',        'rathangan'),
  ('Rathnure',         'rathnure'),
  ('Rosslare',         'rosslare'),
  ('Taghmon',          'taghmon'),
  ('Wexford Town',     'wexford-town')
) AS v(name, slug)
ON CONFLICT (parent_zone_id, slug) WHERE parent_zone_id IS NOT NULL DO NOTHING;

INSERT INTO nex_migration_history (version, description, applied_at)
VALUES ('271', 'community · IE · Wexford local areas (42)', now())
ON CONFLICT (version) DO NOTHING;
