-- 187_nex_source_registry_osm_products.sql
--
-- NEX Canonical · seed `osm_overpass_products_v1` into
-- `nex.source_registry` (the sealed source-registry table from
-- migration 166).
--
-- WHY · WHAT · HOW TO APPLY
-- -------------------------
-- `scripts/supabase-osm-overpass-walker.mjs` runs OSM Overpass queries
-- against the Indonesian area for 15 new category tiles registered
-- by the owner (leather-products, fish-seller, property-agent,
-- builder, car-taxi, shoe-seller, coat-seller, handbag-seller,
-- brick-layer, baby-clothes, vitamins, make-up, pet-supplies,
-- garden-supplies, home-appliances).
--
-- Unlike migrations 179/185/186, this source does NOT read from an
-- intermediate NEX vertical table (`nex.food_business`,
-- `nex.accommodation_business`, `nex.service_business`). The walker
-- writes directly to the sealed canonical primitives:
--
--   · `nex.business_canonical`              (identity row)
--   · `nex.business_evidence`               (one evidence row per
--                                            canonical, citing this
--                                            source_id)
--   · `nex.business_canonical_lifecycle_log` (DISCOVERED→VERIFIED
--                                            transition for each row)
--
-- Downstream enforcement — the FK `fk_be_source` on
-- `nex.business_evidence(source_id)` from migration 170 — refuses any
-- evidence insert whose cited `source_id` is not present in
-- `nex.source_registry`. This migration adds the row so the walker
-- can proceed.
--
-- POLICY FLAGS
--   can_derive            = TRUE   · we are the derivation point ·
--                                    OSM → NEX canonical
--   can_display           = TRUE   · OSM data is openly licensed
--                                    under ODbL and the directory
--                                    doctrine R-A1 permits display
--                                    with attribution
--   can_redistribute      = FALSE  · the directory serves listings
--                                    to end users; wholesale
--                                    redistribution is a separate
--                                    legal decision
--   attribution_required  = TRUE   · ODbL mandates visible attribution
--   attribution_template  = '© OpenStreetMap contributors (ODbL)'
--                                  · same string rendered on every
--                                    directory card and detail page
--                                    for OSM-sourced listings
--
-- HEALTH CARVE-OUT (doctrine R-S2)
--   The walker's category whitelist deliberately excludes
--   pharmacies, dentists, opticians, hospitals and clinics. Those
--   categories carry regulatory responsibilities that NEX will not
--   publish without qualified Indonesian health-regulator review.
--   No OSM tags matching those are queried, so this registry entry
--   never attributes health-category content.
--
-- IDEMPOTENCY
--   INSERT ... ON CONFLICT (source_id) DO UPDATE for the display
--   fields so a re-apply refreshes the policy if the operator has
--   edited the earlier shape. Safe to re-apply.
--
-- ROLLBACK
--   DELETE FROM nex.source_registry
--     WHERE source_id = 'osm_overpass_products_v1';
--   Safe only when no business_evidence or business_media row
--   references this source_id yet. Downstream FKs are RESTRICT by
--   default; the DELETE will refuse itself if any dependent rows
--   exist.
--
-- SAFE ON POPULATED DB
--   Yes. Pure UPSERT on a seed row. No ALTERs, no GRANT/REVOKE,
--   no DML on any other row.

INSERT INTO nex.source_registry (
  source_id,
  source_type,
  display_name,
  can_derive,
  can_display,
  can_redistribute,
  attribution_required,
  attribution_template
)
VALUES (
  'osm_overpass_products_v1',
  'osm_overpass',
  'OpenStreetMap (Overpass) · retail and service businesses',
  TRUE,
  TRUE,
  FALSE,
  TRUE,
  '© OpenStreetMap contributors (ODbL)'
)
ON CONFLICT (source_id) DO UPDATE SET
  source_type           = EXCLUDED.source_type,
  display_name          = EXCLUDED.display_name,
  can_derive            = EXCLUDED.can_derive,
  can_display           = EXCLUDED.can_display,
  can_redistribute      = EXCLUDED.can_redistribute,
  attribution_required  = EXCLUDED.attribution_required,
  attribution_template  = EXCLUDED.attribution_template;

-- End of migration 187.
--
-- Verification (operator runs this after apply):
--
--   SELECT source_id, source_type, can_derive, can_display,
--          can_redistribute, attribution_required, attribution_template
--   FROM nex.source_registry
--   WHERE source_id = 'osm_overpass_products_v1';
--
-- Expected: exactly one row with can_derive=t, can_display=t,
--           can_redistribute=f, attribution_required=t,
--           attribution_template='© OpenStreetMap contributors (ODbL)'.
