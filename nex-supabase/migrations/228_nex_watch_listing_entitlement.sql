-- ============================================================================
-- NEX-native Migration 228 · nex_watch_listing_entitlement
-- NEX Watches v1 · Rp 30,000-per-30-days entitlement ledger · 2026-10-26
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Must not be applied to the sealed production project
-- `ijvqdvsvwtwxzcqmoqit` without explicit owner approval.
--
-- Purpose
-- ----------------------------------------------------------------------------
-- Records every PAID entitlement window that extends a watch listing's
-- public visibility. One row per successful payment event. The listing
-- row (Migration 227) stores the current effective
-- `entitlement_expires_at`; this ledger is the audit trail.
--
-- Scope boundary (payment-doctrine amendment §2.4a · 2026-10-26)
-- ----------------------------------------------------------------------------
-- This table records a NEX service fee (owner collects for the
-- listing-entitlement service). The sealed clause at §2.4 clause 3
-- continues to govern buyer-to-seller marketplace payments · NEX does
-- not intermediate, hold, or take commission on those.
--
-- Payment-provider shape (owner-approved · P0)
-- ----------------------------------------------------------------------------
--   · `payment_reference text` · the external payment-provider's
--     identifier for the transaction (never fabricated · NEX never
--     invents a payment-provider identifier).
--   · `internal_event_id uuid` · NEX's own unique event id for this
--     entitlement window · idempotency key so retries do not
--     double-grant.
--   · `provider text` · 'manual' | 'xendit' | 'midtrans' | 'other'
--     (launch default: 'manual' until a real processor is wired).
--
-- Idempotency
-- ----------------------------------------------------------------------------
--   · UNIQUE(internal_event_id) · the service layer's event-id
--     generation key is the single source of truth for "has this
--     purchase already been credited?"
--   · UNIQUE(provider, payment_reference) WHERE payment_reference
--     IS NOT NULL · a payment-provider's unique transaction id is
--     also unique in NEX, preventing double-crediting of the same
--     real-world payment.
--
-- Window arithmetic
-- ----------------------------------------------------------------------------
-- When a new entitlement is granted, the service layer:
--   1. INSERT nex_watch_listing_entitlement (window_start, window_end).
--   2. UPDATE nex_watch_listing SET entitlement_expires_at = GREATEST
--      (coalesce(entitlement_expires_at, now()), new.window_end).
-- window_start defaults to GREATEST(now(), prior entitlement_expires_at)
-- so stacking multiple entitlements extends the window instead of
-- overlapping. Window length is 30 days unless the owner-approved
-- policy changes it.
--
-- RLS
-- ----------------------------------------------------------------------------
-- SELECT (authenticated · listing owner):
--   · Owners can read their own entitlement ledger rows.
--
-- SELECT (public):
--   · Not allowed · entitlement amounts and payment references are
--     private financial data.
--
-- INSERT / UPDATE / DELETE:
--   · service-role only · all entitlement writes go via the server
--     action `grantWatchListingEntitlementAction` which runs as
--     admin after validating the payment-provider webhook.
--
-- Dependencies
-- ----------------------------------------------------------------------------
--   PREREQUISITE:
--     001 · nex_account
--     010 · helper functions (nex_current_account_ids)
--     217 · search_path hardening
--     227 · nex_watch_listing
--
-- Rollback
-- ----------------------------------------------------------------------------
--   BEGIN;
--     DROP TABLE IF EXISTS nex_watch_listing_entitlement CASCADE;
--     DELETE FROM nex_migration_history WHERE version = '228';
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_watch_listing_entitlement (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  listing_id           uuid        NOT NULL
    REFERENCES nex_watch_listing(id) ON DELETE CASCADE,
  owner_account_id     uuid        NOT NULL
    REFERENCES nex_account(id) ON DELETE CASCADE,

  -- Idempotency keys
  internal_event_id    uuid        NOT NULL,
  provider             text        NOT NULL DEFAULT 'manual',
  payment_reference    text        NULL,

  -- Window
  window_start         timestamptz NOT NULL DEFAULT now(),
  window_end           timestamptz NOT NULL,

  -- Economics (sen / minor units · ×100 convention)
  amount_pence         bigint      NOT NULL,
  currency             text        NOT NULL DEFAULT 'IDR',

  -- Audit
  granted_at           timestamptz NOT NULL DEFAULT now(),
  granted_by_role      text        NOT NULL DEFAULT 'service_role',
  notes                text        NULL,

  CONSTRAINT nex_watch_listing_entitlement_provider_values
    CHECK (provider IN ('manual','xendit','midtrans','other')),

  CONSTRAINT nex_watch_listing_entitlement_window_valid
    CHECK (window_end > window_start),

  CONSTRAINT nex_watch_listing_entitlement_amount_positive
    CHECK (amount_pence > 0),

  CONSTRAINT nex_watch_listing_entitlement_currency_shape
    CHECK (currency ~ '^[A-Z]{3}$')
);

COMMENT ON TABLE nex_watch_listing_entitlement IS
  'Audit ledger of PAID visibility windows for watch listings. One row per successful payment event. Rp 30,000-per-30-days per P0 S-decisions 2026-10-26. NEX service fee only · does NOT intermediate buyer-seller transactions (sealed §2.4 clause 3).';

COMMENT ON COLUMN nex_watch_listing_entitlement.internal_event_id IS
  'NEX-generated idempotency key. Service layer uses this as the unique replay key so webhook retries do not double-credit.';

COMMENT ON COLUMN nex_watch_listing_entitlement.payment_reference IS
  'External payment-provider transaction id. Must never be fabricated · NEX never invents a provider id (owner directive · P0 D1 2026-10-20).';

COMMENT ON COLUMN nex_watch_listing_entitlement.amount_pence IS
  'Amount collected in minor units (sen for IDR · ×100 convention). Example: Rp 30,000 → 3_000_000.';

-- ----------------------------------------------------------------------------
-- Indexes · idempotency + lookup
-- ----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_watch_listing_entitlement_internal_event_id
  ON nex_watch_listing_entitlement (internal_event_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_watch_listing_entitlement_provider_reference
  ON nex_watch_listing_entitlement (provider, payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nex_watch_listing_entitlement_listing
  ON nex_watch_listing_entitlement (listing_id, granted_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_watch_listing_entitlement_owner
  ON nex_watch_listing_entitlement (owner_account_id, granted_at DESC);

-- ----------------------------------------------------------------------------
-- RLS policies
-- ----------------------------------------------------------------------------

ALTER TABLE nex_watch_listing_entitlement ENABLE ROW LEVEL SECURITY;

-- Owners read their own entitlement history (billing surface).
CREATE POLICY nex_watch_listing_entitlement_owner_select
  ON nex_watch_listing_entitlement FOR SELECT
  TO authenticated
  USING (owner_account_id IN (SELECT nex_current_account_ids()));

-- No public SELECT policy · entitlement amounts and payment references
-- are private financial data.

-- No authenticated INSERT / UPDATE / DELETE policies · service-role
-- only. Grants happen via the admin-privileged action
-- `grantWatchListingEntitlementAction`.

COMMIT;
