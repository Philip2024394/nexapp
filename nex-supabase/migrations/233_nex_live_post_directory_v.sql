-- ============================================================================
-- NEX-native Migration 233 · nex_live_post_directory_v
-- Directory Integration Fix 2026-10-26 · G3-amendment-compatible paid-live-post
-- projection · NOT APPLIED
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Must not be applied to the sealed production project
-- `ijvqdvsvwtwxzcqmoqit` without explicit owner approval.
--
-- Purpose (owner directive · Directory Integration Fix · 2026-10-26)
-- ----------------------------------------------------------------------------
-- Produces one row per currently-eligible paid live post for the NEX
-- directory. "Paid live post" is defined using fields that already
-- exist on sealed tables · NO new entitlement rail is invented:
--
--   · `nex_live_session.status = 'open'`                   (currently broadcasting)
--   · `nex_live_session.business_id IS NOT NULL`           (Business-tier broadcaster
--                                                           per Migration 219
--                                                           §5.0 Tier Distinction)
--   · `nex_live_featured_product.ended_featuring_at IS NULL`
--                                                          (product is currently pinned)
--   · `nex_product.price_pence IS NOT NULL AND price_pence > 0`
--                                                          (owner directive · no-price
--                                                           listings are excluded from
--                                                           the public directory)
--
-- At the per-partial-unique-index level (Migration 219) at most ONE
-- open session per broadcaster + at most ONE active featured product
-- per session. The row count per broadcaster is therefore 0 or 1
-- at any instant · aligns with the owner's "1 post live" directive.
--
-- G3 compatibility
-- ----------------------------------------------------------------------------
-- The sealed G3 ("one card per shop") was amended on 2026-10-26 to add
-- "one tile per eligible paid individual listing" (originally scoped
-- to watches). This view is a SECOND source of eligible paid
-- individual listings · one row per currently-broadcasting Business-
-- tier live post with a priced featured product.
--
-- Section M (sealed boundary of `nex.business_canonical`) is NOT
-- touched · this view projects from unrelated `nex_live_session` +
-- `nex_live_featured_product` + `nex_product` tables.
--
-- Projection shape
-- ----------------------------------------------------------------------------
-- Mirrors `ListingCardViewModel` in
-- `src/lib/nex-native/directory/landing-feed-service.ts` so the
-- consumer can merge rows without a transform step. `source` emits
-- the literal `'live_post'`.
--
-- NEX never handles payments doctrine (sealed §2.4 clause 3)
-- ----------------------------------------------------------------------------
-- The eligibility predicate above does NOT infer that NEX has
-- intermediated a payment. The predicate reads existing fields and
-- treats "Business-tier broadcaster with a priced featured product"
-- as evidence that the live post is a paid-tier publication. If the
-- owner wants a stricter entitlement proof (e.g. a per-post
-- entitlement row analogous to `nex_watch_listing_entitlement`), that
-- can be added by a future owner-signed amendment without changing
-- this view's consumer contract.
--
-- Dependencies
-- ----------------------------------------------------------------------------
--   PREREQUISITE:
--     001 · nex_account
--     002 · nex_business
--     003 · nex_product
--     219 · nex_live_session + nex_live_featured_product
--
-- Rollback
-- ----------------------------------------------------------------------------
--   BEGIN;
--     DROP VIEW IF EXISTS nex_live_post_directory_v CASCADE;
--     DELETE FROM nex_migration_history WHERE version = '233';
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW nex_live_post_directory_v
WITH (security_invoker = true) AS
SELECT
  -- Identity · one row per active featured product in an open session
  fp.id                                                 AS id,
  s.id                                                  AS session_id,
  fp.id                                                 AS featured_product_id,

  -- Stable slug · never collides with shop slugs or watch-listing
  -- slugs because of the "live-" prefix + short-form uuid.
  ('live-' || substring(s.id::text, 1, 8))              AS slug,

  -- Title · nex_product name (NOT NULL by nex_product schema)
  p.name                                                AS title,

  -- Fixed category label · "Live" category is a new discovery slot.
  -- Owner may re-map it to Products / Food / etc via the landing-
  -- category-mapping update in a follow-on; for now Live is its
  -- own slot so the UI can render the live-pulse badge if desired.
  'Live'::text                                          AS category_label,
  'live'::text                                          AS category_id,
  '#FF3355'::text                                       AS category_accent,
  3::smallint                                           AS category_icon_col,
  0::smallint                                           AS category_icon_row,

  -- Media · nex_product.image_url if present
  p.image_url                                           AS image_url,

  -- Description · explicit fallback · product description if any
  COALESCE(NULLIF(trim(p.description), ''), NULL)       AS description,

  -- Featured offering (owner directive 2026-10-18) · product name
  p.name                                                AS featured_offering,

  -- City · not projected today · live-post surface prioritises time
  -- + commerce signal over location. Explicit NULL preserves the
  -- "never fabricate" contract.
  NULL::text                                            AS city,

  -- Dedicated route · live viewer page keyed by session id
  ('/nex-native/live-commerce/' || s.id::text)          AS href,

  -- Source discriminator
  'live_post'::text                                     AS source,

  -- Carry fields the consumer / search surface may want
  p.price_pence                                         AS price_pence,
  p.currency                                            AS currency,
  s.business_id                                         AS business_id,
  s.broadcaster_account_id                              AS broadcaster_account_id,
  s.started_at                                          AS live_started_at,
  fp.started_featuring_at                               AS featured_at
FROM nex_live_session s
JOIN nex_live_featured_product fp
  ON fp.session_id = s.id
JOIN nex_product p
  ON p.id = fp.product_id
WHERE s.status = 'open'
  AND s.business_id IS NOT NULL
  AND fp.ended_featuring_at IS NULL
  AND p.price_pence IS NOT NULL
  AND p.price_pence > 0;

COMMENT ON VIEW nex_live_post_directory_v IS
  'Directory Integration Fix 2026-10-26 · eligible paid live posts for the NEX directory. Pure view-only projection · drift-prevention by construction. Eligibility uses existing fields on nex_live_session (open + business_id non-null) + nex_live_featured_product (actively pinned) + nex_product (price_pence > 0). No new entitlement rail invented. Compatible with G3 amendment · one tile per eligible paid individual listing.';

GRANT SELECT ON nex_live_post_directory_v TO anon, authenticated;

COMMIT;
