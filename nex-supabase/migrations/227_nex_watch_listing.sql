-- ============================================================================
-- NEX-native Migration 227 · nex_watch_listing
-- NEX Watches v1 · sibling-table approach · P0 S-decisions · 2026-10-26
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Must not be applied to the sealed production project
-- `ijvqdvsvwtwxzcqmoqit` without explicit owner approval.
--
-- Supersedes
-- ----------------------------------------------------------------------------
-- The withdrawn §8h proposal in
-- `docs/doctrine/nex-shop-watches-upload-draft-2026-10-26.md` (which
-- would have made `nex_product.business_id` NULLABLE and added a
-- `standalone_account_id` column there) is REPLACED by this
-- separate sibling table. See the §8h "Withdrawn" block in the same
-- doctrine file for the full rationale.
--
-- The sealed `nex_product.business_id NOT NULL` constraint is
-- preserved exactly as it was · this migration does NOT touch
-- `nex_product`.
--
-- Purpose
-- ----------------------------------------------------------------------------
-- Introduces the authoritative persistence layer for individually-sold
-- watch listings · the Rp 30,000-per-30-days single-watch flow (per
-- the payment-doctrine amendment at
-- `docs/doctrine/nex-commerce-live-relationship-plan-2026-10-24.md`
-- §2.4a · 2026-10-26). NEX collects its own listing fee; buyer-to-
-- seller transactions remain prohibited from NEX intermediation per
-- the sealed clause at §2.4 clause 3.
--
-- Ownership model
--   · `owner_account_id` NOT NULL · every listing has a seller
--     account that owns it (sealed per §8h withdrawal).
--   · `business_id` NULL · optional shop association. When present,
--     the listing is also visible on the business's shop surface.
--     When NULL, the listing is a standalone individual listing (the
--     "sellers without a shop" fallback) and surfaces only in:
--       · the central NEX Watches directory tile (via
--         `watch_listing_directory_v` · Migration 229)
--       · the dedicated route `/nex-native/watches/[listingId]`
--       · Live-card projection on the owner's Live feed
--     Never on a non-existent shop surface.
--
-- Lifecycle
--   · `status` · 'draft' | 'published' | 'expired' | 'removed'
--     · 'draft'     · created, not yet paid, not visible publicly
--     · 'published' · paid, within entitlement window, publicly visible
--     · 'expired'   · entitlement window elapsed, not visible publicly
--     · 'removed'   · owner- or admin-removed, not visible publicly
--   · `entitlement_expires_at` · nullable timestamp. When present,
--     the listing is visible to the public only while
--     `status='published' AND entitlement_expires_at > now()`.
--     Non-null is set / extended by the entitlement service
--     (Migration 228).
--
-- Retention (owner directive · P0 S6 · 2026-10-26)
--   · After expiry or removal, listing rows are retained for 90 days
--     before hard delete. The sweep is service-layer (not a DB trigger)
--     so it can be audited and paused. See the planned
--     `nex-watch-listing-retention.ts` worker.
--
-- Pricing (owner directive · sealed ×100 convention)
--   · `price_pence bigint` · amount in minor units. For IDR, 1 Rp = 100
--     "sen" per the sealed convention. Example: Rp 30,000,000 → 3_000_000_000.
--   · `currency text` · ISO-ish code. 'IDR' is the default launch currency.
--   · `pricing_mode text` · one of the 4 seller setup modes
--     (chat / price_only / shop_product / auction). The listing may
--     publish without a hard price (chat mode) · the DB tolerates
--     NULL `price_pence` in that case via the CHECK below.
--
-- Watch specification (world-standard set · per upload doctrine §1)
--   · Essential fields are NOT NULL (brand, model, condition, etc.).
--   · Detailed + Verified Premium fields are nullable so the 3-tier
--     progressive form can save a partial listing without blocking
--     publish. The upload service decides which combinations are
--     publishable.
--
-- Full-text search (reserved · populated by Migration 230)
--   · `search_tsv tsvector` is NOT added here. Migration 230 adds the
--     column + GIN index + trigger so the search surface in v1 can
--     use real `websearch_to_tsquery` against the listing fields.
--     Keeping schema + indexes in separate migrations isolates
--     search-related rollback.
--
-- RLS
-- ----------------------------------------------------------------------------
-- SELECT (public · anon + authenticated):
--   · Rows where (status='published' AND entitlement_expires_at > now())
--     only. Draft / expired / removed rows are never public.
--
-- SELECT (authenticated · owner):
--   · Owners may read ALL their own rows (any status). This is the
--     "my listings" surface.
--
-- INSERT (authenticated):
--   · `owner_account_id IN (SELECT nex_current_account_ids())` AND
--     (business_id IS NULL OR business_id IN
--      (SELECT nex_current_owned_business_ids()))
--
-- UPDATE (authenticated · owner):
--   · Same identity check. The service layer gates status transitions.
--
-- DELETE: service-role only (owner-initiated delete routes through the
-- removal workflow which updates `status='removed'`, not a DB DELETE).
--
-- Dependencies
-- ----------------------------------------------------------------------------
--   PREREQUISITE:
--     001 · nex_account identity
--     002 · nex_business + owner_account_id
--     010 · SECURITY DEFINER helpers (nex_current_account_ids,
--           nex_current_owned_business_ids)
--     217 · search_path hardening on the helpers
--
--   DOWNSTREAM (apply in order after this):
--     228 · nex_watch_listing_entitlement
--     229 · watch_listing_directory_v view (Option Y projection)
--     230 · search_tsv column + GIN + trigger
--
-- Rollback
-- ----------------------------------------------------------------------------
--   BEGIN;
--     DROP TABLE IF EXISTS nex_watch_listing CASCADE;
--     DELETE FROM nex_migration_history WHERE version = '227';
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_watch_listing (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  owner_account_id          uuid        NOT NULL
    REFERENCES nex_account(id) ON DELETE CASCADE,
  business_id               uuid        NULL
    REFERENCES nex_business(id) ON DELETE SET NULL,

  -- Lifecycle
  status                    text        NOT NULL DEFAULT 'draft',
  entitlement_expires_at    timestamptz NULL,
  published_at              timestamptz NULL,
  removed_at                timestamptz NULL,

  -- Pricing
  pricing_mode              text        NOT NULL DEFAULT 'price_only',
  price_pence               bigint      NULL,
  currency                  text        NOT NULL DEFAULT 'IDR',

  -- Essential watch specification (world-standard · upload doctrine §1)
  brand                     text        NOT NULL,
  brand_is_custom           boolean     NOT NULL DEFAULT false,
  model_name                text        NOT NULL,
  reference_number          text        NULL,
  watch_type                text        NOT NULL,
  movement                  text        NOT NULL,
  case_diameter_mm          numeric(5,2) NULL,
  dial_color                text        NULL,
  strap_material            text        NULL,
  condition                 text        NOT NULL,
  description               text        NULL,

  -- Detailed (progressive · nullable)
  case_shape                text        NULL,
  case_material_category    text        NULL,
  crystal_material          text        NULL,
  clasp_type                text        NULL,
  water_resistance_m        integer     NULL,
  bezel_style               text        NULL,
  dial_finish               text        NULL,
  hand_style                text        NULL,
  case_finish               text        NULL,
  style_audience            text        NULL,
  strap_interchangeability  text        NULL,
  lug_type                  text        NULL,
  crown_position            text        NULL,
  case_size_category        text        NULL,

  -- Verified Premium (progressive · nullable)
  authenticity              text        NULL,
  seller_type               text        NULL,
  shipping_scope            text        NULL,
  packaging_items           text[]      NULL,
  availability              text        NULL,
  warranty_note             text        NULL,
  provenance_note           text        NULL,

  -- Media
  video_url                 text        NULL,
  cover_image_url           text        NULL,
  gallery_image_urls        text[]      NULL,

  -- Timestamps
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT nex_watch_listing_status_values
    CHECK (status IN ('draft','published','expired','removed')),

  CONSTRAINT nex_watch_listing_pricing_mode_values
    CHECK (pricing_mode IN ('chat','price_only','shop_product','auction')),

  CONSTRAINT nex_watch_listing_price_requires_mode
    CHECK (
      -- chat mode may publish with no hard price
      pricing_mode = 'chat'
      -- all other modes require a non-null, positive price_pence
      OR (price_pence IS NOT NULL AND price_pence > 0)
    ),

  CONSTRAINT nex_watch_listing_published_requires_entitlement
    CHECK (
      status <> 'published'
      OR (published_at IS NOT NULL AND entitlement_expires_at IS NOT NULL)
    ),

  CONSTRAINT nex_watch_listing_removed_requires_timestamp
    CHECK (
      status <> 'removed'
      OR removed_at IS NOT NULL
    ),

  CONSTRAINT nex_watch_listing_description_length
    CHECK (description IS NULL OR char_length(description) <= 1000),

  CONSTRAINT nex_watch_listing_currency_shape
    CHECK (currency ~ '^[A-Z]{3}$')
);

COMMENT ON TABLE nex_watch_listing IS
  'NEX Watches v1 · individually-sold watch listings · sibling table to nex_product (does NOT modify nex_product). owner_account_id NOT NULL, business_id NULL · supports sellers without a shop (per §8h withdrawal 2026-10-26). Public SELECT gated on status=published AND entitlement_expires_at > now(). Rp 30,000-per-30-days entitlement per payment-doctrine amendment §2.4a. Sealed scope · P0 S-decisions 2026-10-26.';

COMMENT ON COLUMN nex_watch_listing.owner_account_id IS
  'The seller account that owns this listing · always present per §8h withdrawal · sibling-table approach.';

COMMENT ON COLUMN nex_watch_listing.business_id IS
  'Optional shop association · NULL for sellers without a shop · when present the listing is also visible on the shop surface.';

COMMENT ON COLUMN nex_watch_listing.pricing_mode IS
  'One of the 4 seller setup modes · chat / price_only / shop_product / auction. chat may publish with no hard price_pence (CHECK constraint allows the exception).';

COMMENT ON COLUMN nex_watch_listing.price_pence IS
  'Amount in minor units (sen for IDR · ×100 convention sealed codebase-wide). Example: Rp 30,000,000 → 3_000_000_000. NULL only in chat pricing_mode.';

COMMENT ON COLUMN nex_watch_listing.entitlement_expires_at IS
  'Current effective end-of-visibility · set / extended by the entitlement service (Migration 228) when a Rp 30,000 payment lands. Public SELECT requires this to be > now().';

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

-- Owner "my listings" surface
CREATE INDEX IF NOT EXISTS idx_nex_watch_listing_owner
  ON nex_watch_listing (owner_account_id, status, created_at DESC);

-- Business "shop watches" surface (optional business association)
CREATE INDEX IF NOT EXISTS idx_nex_watch_listing_business
  ON nex_watch_listing (business_id, status, created_at DESC)
  WHERE business_id IS NOT NULL;

-- Public directory filter · the hot path for watch_listing_directory_v
-- + the dedicated search surface. Covers the standard predicate:
--   WHERE status='published' AND entitlement_expires_at > now()
CREATE INDEX IF NOT EXISTS idx_nex_watch_listing_published_window
  ON nex_watch_listing (entitlement_expires_at DESC, created_at DESC)
  WHERE status = 'published';

-- Retention sweep · "removed or expired for > 90 days" scan
CREATE INDEX IF NOT EXISTS idx_nex_watch_listing_retention
  ON nex_watch_listing (status, removed_at, entitlement_expires_at)
  WHERE status IN ('removed','expired');

-- Reference / brand lookups for the fallback non-tsvector search
CREATE INDEX IF NOT EXISTS idx_nex_watch_listing_brand_model
  ON nex_watch_listing (lower(brand), lower(model_name));

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nex_watch_listing_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_watch_listing_updated_at ON nex_watch_listing;
CREATE TRIGGER trg_nex_watch_listing_updated_at
  BEFORE UPDATE ON nex_watch_listing
  FOR EACH ROW
  EXECUTE FUNCTION nex_watch_listing_touch_updated_at();

-- ----------------------------------------------------------------------------
-- RLS policies
-- ----------------------------------------------------------------------------

ALTER TABLE nex_watch_listing ENABLE ROW LEVEL SECURITY;

-- Public can SELECT only live listings (published + within window).
CREATE POLICY nex_watch_listing_public_select_live
  ON nex_watch_listing FOR SELECT
  USING (
    status = 'published'
    AND entitlement_expires_at IS NOT NULL
    AND entitlement_expires_at > now()
  );

-- Owners can SELECT all of their own listings (any status).
CREATE POLICY nex_watch_listing_owner_select_all
  ON nex_watch_listing FOR SELECT
  TO authenticated
  USING (owner_account_id IN (SELECT nex_current_account_ids()));

-- Owners can INSERT only for themselves · business_id (when non-null)
-- must be one of their own businesses.
CREATE POLICY nex_watch_listing_owner_insert
  ON nex_watch_listing FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_account_id IN (SELECT nex_current_account_ids())
    AND (
      business_id IS NULL
      OR business_id IN (SELECT nex_current_owned_business_ids())
    )
  );

-- Owners can UPDATE only their own listings · identity check for
-- both USING (which rows they see) and WITH CHECK (which rows they
-- can produce). Business reassignment honours ownership.
CREATE POLICY nex_watch_listing_owner_update
  ON nex_watch_listing FOR UPDATE
  TO authenticated
  USING (owner_account_id IN (SELECT nex_current_account_ids()))
  WITH CHECK (
    owner_account_id IN (SELECT nex_current_account_ids())
    AND (
      business_id IS NULL
      OR business_id IN (SELECT nex_current_owned_business_ids())
    )
  );

-- No DELETE policy · service-role only. Owners "remove" by UPDATE
-- status='removed' (soft delete · retained 90d per S6).

COMMIT;
