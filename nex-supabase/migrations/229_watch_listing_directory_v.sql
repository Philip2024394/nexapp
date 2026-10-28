-- ============================================================================
-- NEX-native Migration 229 · watch_listing_directory_v
-- NEX Watches v1 · Option Y view-only projection · 2026-10-26
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Must not be applied to the sealed production project
-- `ijvqdvsvwtwxzcqmoqit` without explicit owner approval.
--
-- Purpose (owner-approved P0 S2 · 2026-10-26 · Option Y)
-- ----------------------------------------------------------------------------
-- Produces the authoritative projection the NEX directory consumes
-- for watch-listing tiles. "View-only" means it holds no persistent
-- data of its own · it is recomputed from `nex_watch_listing` on
-- every read, so drift between the listing row and the directory
-- tile is structurally impossible.
--
-- Scope (G3 amendment · 2026-10-26 ·
-- docs/doctrine/nex-directory-tile-uniqueness-g3-amendment-2026-10-26.md)
-- ----------------------------------------------------------------------------
-- The sealed G3 "one card per shop" rule is unchanged. The amendment
-- adds "one card per eligible paid individual listing." A listing is
-- eligible iff:
--     status = 'published'  AND  entitlement_expires_at > now()
--
-- Deliberately NOT a condition (per G3 amendment "Deliberate scope
-- limit"): no moderation-hold predicate. Moderation integration is a
-- future owner-signed amendment.
--
-- Why a view (not a materialised view, not a cache)
-- ----------------------------------------------------------------------------
-- `watch_listing_directory_v` is a plain SQL view. Reads re-execute
-- the predicate every time, so:
--   · a listing that expires in the next second disappears from the
--     next read · no stale cache window.
--   · a listing newly paid-and-published appears on the next read ·
--     no refresh cron.
--   · no second row to keep in sync · no drift possible.
--
-- The underlying index
-- `idx_nex_watch_listing_published_window` (Migration 227) covers the
-- hot predicate so the read stays O(matching rows).
--
-- Zero touch to sealed tables
-- ----------------------------------------------------------------------------
--   · Does NOT read `nex_product` / `nex_menu_item` / `nex_service`
--     (sealed G3 original).
--   · Does NOT write anywhere.
--   · Does NOT fabricate fields · every emitted field is derived from
--     a non-null source column, with explicit fallbacks for the
--     nullable ones (image, description).
--
-- Projection shape
-- ----------------------------------------------------------------------------
-- The shape mirrors `ListingCardViewModel` in
-- `src/lib/nex-native/directory/landing-feed-service.ts` so the
-- consumer can merge rows into the existing feed with no additional
-- transform step. `source` emits the literal string 'watch_listing'
-- so the consumer can distinguish watch-listing tiles from the two
-- original sources ('nex_business', 'canonical') and the mock-seed
-- preview ('mock_seed').
--
-- RLS
-- ----------------------------------------------------------------------------
-- Views inherit the RLS of their underlying tables. Because the view
-- only selects rows that match the public SELECT policy on
-- nex_watch_listing (status='published' AND window), the view is safe
-- to expose to anon + authenticated callers without a separate GRANT
-- loop. The explicit WHERE in the view body is defence-in-depth so
-- that even service-role reads of the view only see eligible rows.
--
-- Dependencies
-- ----------------------------------------------------------------------------
--   PREREQUISITE:
--     227 · nex_watch_listing
--
-- Rollback
-- ----------------------------------------------------------------------------
--   BEGIN;
--     DROP VIEW IF EXISTS watch_listing_directory_v CASCADE;
--     DELETE FROM nex_migration_history WHERE version = '229';
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW watch_listing_directory_v
WITH (security_invoker = true) AS
SELECT
  l.id                                                 AS id,
  -- Stable slug for dedup and routing. We synthesize from brand +
  -- short-form uuid so the slug does not collide with nex_business
  -- or canonical slugs.
  ('watch-' || lower(regexp_replace(l.brand, '[^A-Za-z0-9]+', '-', 'g')) || '-' ||
   substring(l.id::text, 1, 8))                        AS slug,

  -- Title · brand + model_name (always non-null per schema)
  (l.brand || ' ' || l.model_name)                     AS title,

  -- Category · fixed for watch listings
  'Watches'::text                                      AS category_label,
  'watches'::text                                      AS category_id,
  '#C8A24B'::text                                      AS category_accent,
  3::smallint                                          AS category_icon_col,
  1::smallint                                          AS category_icon_row,

  -- Media
  l.cover_image_url                                    AS image_url,

  -- Description · explicit fallback. If no free-text description, show
  -- the reference_number (if present), else NULL (card handles honest
  -- no-description state).
  COALESCE(
    NULLIF(trim(l.description), ''),
    NULLIF(l.reference_number, '')
  )                                                    AS description,

  -- Featured offering · displayed as the bold headline per owner
  -- directive 2026-10-18. For watch listings we lean on model_name,
  -- so the business title becomes the brand eyebrow. This mirrors
  -- the sealed two-line card template.
  l.model_name                                         AS featured_offering,

  -- City is only available indirectly via the owner business (if any).
  -- For standalone listings we return NULL rather than fabricate.
  NULL::text                                           AS city,

  -- Dedicated route
  ('/nex-native/watches/' || l.id::text)               AS href,

  -- Source discriminator for the consumer
  'watch_listing'::text                                AS source,

  -- Carry fields the consumer / search surface may want
  l.price_pence                                        AS price_pence,
  l.currency                                           AS currency,
  l.pricing_mode                                       AS pricing_mode,
  l.business_id                                        AS business_id,
  l.owner_account_id                                   AS owner_account_id,
  l.published_at                                       AS published_at,
  l.entitlement_expires_at                             AS entitlement_expires_at
FROM nex_watch_listing l
WHERE l.status = 'published'
  AND l.entitlement_expires_at IS NOT NULL
  AND l.entitlement_expires_at > now()
  -- Owner directive 2026-10-26 (Directory Integration Fix) · "if
  -- product does not have price added it does not get entered into
  -- the nex search directory". Chat-mode listings (price_pence NULL)
  -- do NOT enter the public directory projection. The watch's own
  -- /nex-native/watches/{listingId} page can still render a chat-
  -- mode listing · the DIRECTORY surface requires a usable price.
  AND l.price_pence IS NOT NULL
  AND l.price_pence > 0;

COMMENT ON VIEW watch_listing_directory_v IS
  'Option Y view-only projection of eligible paid individual watch listings. One row per nex_watch_listing where status=published AND entitlement_expires_at > now(). Drift-prevention by construction: no persisted copy. G3 amendment 2026-10-26 · one tile per eligible paid individual listing · sibling to one-tile-per-shop.';

-- Allow anon + authenticated to read. security_invoker=true ensures the
-- caller''s RLS still applies, so even if a GRANT is widened the
-- underlying nex_watch_listing RLS keeps non-eligible rows invisible.
GRANT SELECT ON watch_listing_directory_v TO anon, authenticated;

COMMIT;
