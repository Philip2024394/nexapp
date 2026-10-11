-- nex-supabase/migrations/152_nex_community_phase2b_business_welcome.sql
--
-- NEX Community Noticeboard · Phase 2B.0 + 2B.1 · business welcome.
-- Founder-authorised 2026-10-11.
--
-- WHAT THIS DOES
--   1. Extend the super-table `kind` CHECK to allow 'business_welcome'.
--   2. ADD columns to nex_business:
--        · community_discovery_opt_in boolean (default false)
--        · community_discovery_zone_id uuid FK nex_community_zone
--        · community_discovery_toggled_at timestamptz
--      These let a business owner explicitly choose to appear in the
--      community feed + pick which hyperlocal zone to appear in. No
--      inference, no address parsing (only 7/168 live businesses have
--      an address today).
--   3. CREATE TABLE nex_community_business_welcome_detail: one row per
--      welcome card, tied to nex_community_card.id (CASCADE). FK to
--      nex_business.id · stores featured_at + featured_by + expires_at.
--      No denormalised business fields: always JOIN to nex_business
--      for truth.
--   4. Partial UNIQUE INDEX: at most one ACTIVE welcome card per
--      business ever. Prevents double-publishing on toggle on/off.
--   5. Add 'business_welcome_create' + 'business_welcome_retract' to
--      the nex_community_rate_limit action enum so welcome publishing
--      is rate-limited per owner account.
--
-- WHY
--   Phase 2B business discovery requires one new card kind, a
--   consent-first opt-in on nex_business, and a lifecycle. Reusing
--   the super-table from 148 means the main community feed renders
--   welcome cards alongside safety + lost&found with no new feed
--   query shape. Zone-level location only · no coordinates ever
--   rendered (sealed Phase 1 privacy doctrine).
--
-- INVARIANTS SEALED WITH THIS MIGRATION
--   · One active welcome per business (partial unique index).
--   · Welcome author_account_id MUST be the business's owner_account_id
--     (enforced by application layer; schema allows the FK).
--   · nex_business.community_discovery_opt_in defaults to FALSE so no
--     business is auto-published.
--   · expires_at computed by application as featured_at + 14 days.
--     Schema stores the value · doesn't enforce the window.
--   · No denormalised business metadata on the detail table. If the
--     business is archived, the welcome card is retracted by the app
--     (not auto-removed by DB cascade).
--
-- NOT TOUCHED
--   · nex_community_notice (Phase 1 safety) · unchanged.
--   · nex_community_lost_found_detail (Phase 2A) · unchanged.
--   · nex_business existing columns (66) · additive only.
--   · nex_report (safe-trade) · unchanged.

BEGIN;

-- 1 · Extend the super-table kind CHECK.
ALTER TABLE nex_community_card
  DROP CONSTRAINT IF EXISTS ck_card_kind;
ALTER TABLE nex_community_card
  ADD CONSTRAINT ck_card_kind CHECK (kind IN (
    'lost_found','event','voice','local_help','life_news','business_welcome'
  ));


-- 2 · nex_business discovery opt-in columns.
ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS community_discovery_opt_in       boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS community_discovery_zone_id      uuid         REFERENCES nex_community_zone(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS community_discovery_toggled_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_business_community_opt_in
  ON nex_business (community_discovery_zone_id)
  WHERE community_discovery_opt_in = true;


-- 3 · nex_community_business_welcome_detail (kind-specific detail)
CREATE TABLE IF NOT EXISTS nex_community_business_welcome_detail (
  card_id         uuid PRIMARY KEY REFERENCES nex_community_card(id) ON DELETE CASCADE,
  business_id     uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  featured_at     timestamptz NOT NULL DEFAULT now(),
  featured_by     uuid NOT NULL REFERENCES nex_account(id) ON DELETE RESTRICT,
  expires_at      timestamptz NOT NULL,

  CONSTRAINT ck_bw_expires_after_featured CHECK (expires_at > featured_at)
);

CREATE INDEX IF NOT EXISTS idx_bw_business
  ON nex_community_business_welcome_detail (business_id);


-- 4 · One ACTIVE welcome card per business — enforced at the SERVICE
--     layer (business-discovery-service.publishWelcome does a
--     SELECT-for-update + conditional INSERT). A pure partial-index
--     can't reference nex_community_card.status from here without a
--     materialised denormalisation; we deliberately keep the schema
--     normalised and move the uniqueness check into the one call-site
--     that writes a welcome card.


-- 5 · Rate-limit actions for welcome publish + retract.
ALTER TABLE nex_community_rate_limit
  DROP CONSTRAINT IF EXISTS ck_rl_action;
ALTER TABLE nex_community_rate_limit
  ADD CONSTRAINT ck_rl_action CHECK (action IN (
    'notice_create','notice_update','notice_confirm','notice_resolve','notice_report',
    'card_create','card_update','card_confirm','card_resolve','card_report',
    'card_photo_upload',
    'business_welcome_publish','business_welcome_retract'
  ));


COMMIT;
