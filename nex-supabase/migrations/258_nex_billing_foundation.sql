-- ============================================================================
-- NEX-native Migration 258 · Billing foundation
-- ============================================================================
-- Owner-authorised 2026-11-02 (DRAFT · NOT APPLIED). Author: Claude.
--
-- Extends migration 257 with the infrastructure needed to drive paid access
-- from real Stripe events: subscription/customer linkage, event-log
-- idempotency, independent adverse-event tracking, verified checkout
-- mapping. Shop + Vault remain fully independent.
--
-- Prerequisites (verified at Part 0):
--   046, 207, 224, 257.
--
-- Numbering: next free slot after 255 (hq_role) and 256 (visibility
-- amendment). 258 is the first UNUSED numeric slot following 257.
--
-- Does NOT:
--   · Create any Stripe products/prices/webhooks.
--   · Grant any entitlement by default.
--   · Modify public pricing surfaces.
--   · Change migration 214 (its business_trial_status collision with 257
--     is a separate blocker · see 257's deployment note).
--
-- The ENTITLEMENT RULE (code · ships with the TypeScript helper in
-- src/lib/nex-native/billing/entitlement.ts) is reproduced here as
-- a comment for reviewability:
--
--   function access_level(acct, product, now):
--     if tier is NULL: return 'none'
--     // Hard kill-switch 1 · any open ACCESS-BLOCKING adverse event
--     if EXISTS (SELECT 1 FROM nex_billing_adverse_event
--                WHERE nex_account_id = acct.id
--                  AND product = $product
--                  AND access_blocking = TRUE
--                  AND access_block_cleared_at IS NULL): return 'none'
--     // Hard kill-switch 2 · explicit non-paid status
--     if status IN ('expired','incomplete'): return 'none'
--     if status == 'trialing': return TRIALING_ACCESS_LEVEL (DRAFT · default 'none')
--     // Timestamp governance (unchanged from 257 design)
--     let full_access_until = GREATEST(period_end,
--                                      past_due_at + interval '7 days')
--     if now <= full_access_until: return 'full'
--     if now <= full_access_until + interval '30 days': return 'read-only'
--     return 'none'
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(258000001);

-- ---------------------------------------------------------------------------
-- Part 0 · ledger + prerequisite guards
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '258') THEN
    RAISE EXCEPTION 'Migration 258 already recorded in nex_migration_history.';
  END IF;
  -- Four prerequisites · check each explicitly (clearer failure messages
  -- than a loop and avoids a PL/pgSQL FOR-record vs text comparison bug).
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '046') THEN
    RAISE EXCEPTION 'Prerequisite migration 046 missing.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '207') THEN
    RAISE EXCEPTION 'Prerequisite migration 207 missing (needed for vault_trial_used_at).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '224') THEN
    RAISE EXCEPTION 'Prerequisite migration 224 missing (needed for is_mock_persona).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '257') THEN
    RAISE EXCEPTION 'Prerequisite migration 257 missing (independent Shop + Vault entitlements).';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Part 1 · Stripe linkage columns on nex_account (6 columns · 3 per product)
-- ---------------------------------------------------------------------------
ALTER TABLE nex_account
  -- Shop
  ADD COLUMN IF NOT EXISTS shop_stripe_customer_id      text,
  ADD COLUMN IF NOT EXISTS shop_stripe_subscription_id  text,
  ADD COLUMN IF NOT EXISTS shop_stripe_price_id         text,
  -- Vault
  ADD COLUMN IF NOT EXISTS vault_stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS vault_stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS vault_stripe_price_id        text;

-- Natural uniqueness · one subscription_id maps to at most one account.
CREATE UNIQUE INDEX IF NOT EXISTS nex_account_shop_stripe_sub_unique
  ON nex_account (shop_stripe_subscription_id)
  WHERE shop_stripe_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS nex_account_vault_stripe_sub_unique
  ON nex_account (vault_stripe_subscription_id)
  WHERE vault_stripe_subscription_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Part 2 · Extend shop_status / vault_status enums with pre-paid states
-- ---------------------------------------------------------------------------
-- 257 defined shop_status IN ('active','past_due','grace','cancelled','expired')
-- 258 extends to allow 'incomplete' (sub created · payment not yet confirmed)
-- and 'trialing' (Stripe-defined trial · access per owner policy · DRAFT).
--
-- Postgres auto-names column-level CHECK constraints as
-- '<table>_<column>_check' (usually), BUT this is a convention we cannot
-- blindly assume. Here we introspect pg_constraint to find the actual
-- constraint name attached to shop_status / vault_status and drop it by
-- its real name, then re-add a NAMED constraint we control explicitly.
--
-- IMPORTANT · if 258 is applied LATER (after real customers exist), this
-- block will succeed only if every existing row's shop_status/vault_status
-- is already a valid value in the NEW enum (which it is · the new enum
-- is a strict superset of 257's).

DO $$
DECLARE
  v_shop_conname text;
  v_vault_conname text;
BEGIN
  -- Shop · find the actual CHECK constraint name on shop_status column
  SELECT co.conname INTO v_shop_conname
  FROM pg_constraint co
  JOIN pg_attribute a ON a.attnum = ANY(co.conkey) AND a.attrelid = co.conrelid
  WHERE co.conrelid = 'public.nex_account'::regclass
    AND co.contype = 'c'
    AND a.attname = 'shop_status'
    AND array_length(co.conkey, 1) = 1  -- single-column check only
  ORDER BY co.conname
  LIMIT 1;
  IF v_shop_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE nex_account DROP CONSTRAINT %I', v_shop_conname);
  END IF;

  -- Vault · same
  SELECT co.conname INTO v_vault_conname
  FROM pg_constraint co
  JOIN pg_attribute a ON a.attnum = ANY(co.conkey) AND a.attrelid = co.conrelid
  WHERE co.conrelid = 'public.nex_account'::regclass
    AND co.contype = 'c'
    AND a.attname = 'vault_status'
    AND array_length(co.conkey, 1) = 1
  ORDER BY co.conname
  LIMIT 1;
  IF v_vault_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE nex_account DROP CONSTRAINT %I', v_vault_conname);
  END IF;
END $$;

ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_shop_status_check CHECK (
    shop_status IN ('incomplete','trialing','active','past_due','grace','cancelled','expired')
    OR shop_status IS NULL
  );

ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_vault_status_check CHECK (
    vault_status IN ('incomplete','trialing','active','past_due','grace','cancelled','expired')
    OR vault_status IS NULL
  );

-- ---------------------------------------------------------------------------
-- Part 3 · nex_billing_event_log · atomic idempotency + audit trail
-- ---------------------------------------------------------------------------
-- Every webhook event we see is logged. stripe_event_id is PRIMARY KEY · an
-- INSERT ... ON CONFLICT DO NOTHING RETURNING claims the event atomically.
-- The handler holds the row-level lock until COMMIT · any concurrent dup
-- delivery blocks on the lock, then DO-NOTHINGs when it unblocks.
--
-- The row's `outcome` is a required column with a strict enum. The handler
-- MUST write a final outcome before COMMIT so the row is never left in a
-- half-processed state. An error path writes outcome='error' with detail.
--
-- Duplicate deliveries do NOT re-insert · they do NOT create duplicate rows
-- with the same stripe_event_id. The duplicate-delivery OUTCOME is logged
-- in the processing side's response (200 OK · nothing to do · the primary
-- key enforces it).

CREATE TABLE IF NOT EXISTS nex_billing_event_log (
  stripe_event_id          text        PRIMARY KEY,
  stripe_event_type        text        NOT NULL,
  stripe_event_created     timestamptz NOT NULL,
  stripe_api_version       text        NOT NULL,
  received_at              timestamptz NOT NULL DEFAULT NOW(),
  processed_at             timestamptz NULL,
  stripe_customer_id       text        NULL,
  stripe_subscription_id   text        NULL,
  stripe_invoice_id        text        NULL,
  stripe_payment_intent_id text        NULL,
  stripe_charge_id         text        NULL,
  stripe_dispute_id        text        NULL,
  stripe_refund_id         text        NULL,
  stripe_checkout_session_id text      NULL,
  invoice_period_start     timestamptz NULL,
  invoice_period_end       timestamptz NULL,
  nex_account_id           uuid        NULL REFERENCES nex_account(id) ON DELETE SET NULL,
  product                  text        NULL,
  outcome                  text        NOT NULL,
  outcome_detail           text        NULL,
  CONSTRAINT nex_billing_event_log_product_check CHECK (
    product IN ('shop','vault') OR product IS NULL
  ),
  CONSTRAINT nex_billing_event_log_outcome_check CHECK (
    outcome IN (
      'processing',
      'applied',
      'skipped_duplicate_already_processed',
      'skipped_stale_subscription',
      'skipped_partial_refund_historical',
      'skipped_unverified_checkout',
      'skipped_unknown_sub',
      'pending_checkout_mapping',
      'orphaned_pending_mapping',
      'error'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_billing_event_log_sub
  ON nex_billing_event_log (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_event_log_account
  ON nex_billing_event_log (nex_account_id);
CREATE INDEX IF NOT EXISTS idx_billing_event_log_type
  ON nex_billing_event_log (stripe_event_type);
CREATE INDEX IF NOT EXISTS idx_billing_event_log_outcome_pending
  ON nex_billing_event_log (outcome, received_at)
  WHERE outcome = 'pending_checkout_mapping';

-- ---------------------------------------------------------------------------
-- Part 4 · nex_billing_adverse_event · open restrictions · multi-dispute safe
-- ---------------------------------------------------------------------------
-- One row per adverse event (dispute, refund, fraud, admin). The access
-- rule denies access iff AT LEAST ONE row for (account, product) has:
--   access_blocking = TRUE AND access_block_cleared_at IS NULL
-- Multiple simultaneous disputes/refunds/fraud each produce separate rows ·
-- resolving one does not clear the others.
--
-- Stripe-side resolution (`stripe_dispute_status`) and NEX access state
-- (`access_blocking` + `access_block_cleared_at`) are INDEPENDENT axes.
-- A lost dispute is Stripe-resolved but access remains blocked until admin
-- clears it explicitly.

CREATE TABLE IF NOT EXISTS nex_billing_adverse_event (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nex_account_id            uuid        NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  product                   text        NOT NULL,
  adverse_type              text        NOT NULL,

  -- Stripe object linkage (nullable for admin/fraud events)
  stripe_subscription_id    text        NULL,
  stripe_invoice_id         text        NULL,
  stripe_payment_intent_id  text        NULL,
  stripe_charge_id          text        NULL,
  stripe_dispute_id         text        NULL,
  stripe_refund_id          text        NULL,
  invoice_period_start      timestamptz NULL,
  invoice_period_end        timestamptz NULL,

  -- Stripe-side dispute lifecycle (NULL for non-dispute events)
  stripe_dispute_status     text        NULL,
  stripe_dispute_closed_at  timestamptz NULL,

  -- NEX-side access restriction (independent axis)
  access_blocking           boolean     NOT NULL,
  access_block_cleared_at   timestamptz NULL,
  access_block_cleared_by   text        NULL,

  opened_at                 timestamptz NOT NULL DEFAULT NOW(),
  opened_by_event_id        text        NULL REFERENCES nex_billing_event_log(stripe_event_id),
  admin_action_id           text        NULL,  -- for fraud/admin · UI-generated UUID for admin-dedup

  CONSTRAINT nex_adverse_product_check     CHECK (product IN ('shop','vault')),
  CONSTRAINT nex_adverse_type_check        CHECK (adverse_type IN
    ('full_refund','partial_refund','dispute_pending','dispute_lost','fraud','admin')),
  CONSTRAINT nex_adverse_dispute_status_check CHECK (
    stripe_dispute_status IN
      ('pending','won','lost','warning_closed','charge_refunded','other')
    OR stripe_dispute_status IS NULL
  ),
  CONSTRAINT nex_adverse_cleared_by_check  CHECK (
    access_block_cleared_by IN ('dispute_won','admin','superseded','other')
    OR access_block_cleared_by IS NULL
  ),
  -- Invariant · if cleared_at is set, cleared_by must be set too
  CONSTRAINT nex_adverse_cleared_pair_check CHECK (
    (access_block_cleared_at IS NULL AND access_block_cleared_by IS NULL)
    OR (access_block_cleared_at IS NOT NULL AND access_block_cleared_by IS NOT NULL)
  ),
  -- Invariant · dispute types require stripe_dispute_id
  CONSTRAINT nex_adverse_dispute_requires_id CHECK (
    adverse_type NOT IN ('dispute_pending','dispute_lost')
    OR stripe_dispute_id IS NOT NULL
  ),
  -- Invariant · refund types require stripe_refund_id
  CONSTRAINT nex_adverse_refund_requires_id CHECK (
    adverse_type NOT IN ('full_refund','partial_refund')
    OR stripe_refund_id IS NOT NULL
  )
);

-- Partial unique indexes for duplicate protection.
--
-- UI1 · One OPEN adverse row per (account, product, dispute) · prevents a
-- replay of dispute.created from inserting a duplicate row. NULL values
-- are naturally distinct in btree, so we scope with `WHERE access_block_
-- cleared_at IS NULL AND stripe_dispute_id IS NOT NULL`.
CREATE UNIQUE INDEX IF NOT EXISTS nex_adverse_open_dispute_unique
  ON nex_billing_adverse_event (nex_account_id, product, stripe_dispute_id)
  WHERE access_block_cleared_at IS NULL
    AND stripe_dispute_id IS NOT NULL;

-- UI2 · Each Stripe refund corresponds to at most ONE adverse row
-- (regardless of open/closed state). stripe_refund_id is globally unique
-- in Stripe so the uniqueness is natural.
CREATE UNIQUE INDEX IF NOT EXISTS nex_adverse_refund_unique
  ON nex_billing_adverse_event (stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

-- UI3 · Each originating webhook event corresponds to at most ONE adverse
-- row forever · defence in depth over UI1 and UI2.
CREATE UNIQUE INDEX IF NOT EXISTS nex_adverse_origin_unique
  ON nex_billing_adverse_event (opened_by_event_id)
  WHERE opened_by_event_id IS NOT NULL;

-- UI4 · Admin/fraud rows dedup on admin_action_id so a repeated admin
-- action does not create multiple blocking rows.
CREATE UNIQUE INDEX IF NOT EXISTS nex_adverse_admin_action_unique
  ON nex_billing_adverse_event (nex_account_id, product, admin_action_id)
  WHERE admin_action_id IS NOT NULL;

-- Query-performance partial index for the access rule's hot path:
--   SELECT 1 FROM nex_billing_adverse_event
--   WHERE nex_account_id=? AND product=? AND access_blocking AND access_block_cleared_at IS NULL
CREATE INDEX IF NOT EXISTS idx_adverse_open_blocking_by_account
  ON nex_billing_adverse_event (nex_account_id, product)
  WHERE access_blocking = true AND access_block_cleared_at IS NULL;

-- ---------------------------------------------------------------------------
-- Part 5 · nex_billing_checkout_session · verified account/product mapping
-- ---------------------------------------------------------------------------
-- Durable record of the user's intent to purchase. The row is INSERTED
-- BEFORE the Stripe Checkout API is called (so if the webhook arrives
-- before the server-side action completes, the webhook finds no mapping,
-- logs outcome='pending_checkout_mapping', and the reconciliation cron
-- revisits it).
--
-- The DB row is the authority. Stripe metadata.internal_session_id is
-- just a lookup key.

CREATE TABLE IF NOT EXISTS nex_billing_checkout_session (
  internal_session_id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nex_account_id             uuid        NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  product                    text        NOT NULL,
  intended_tier              text        NOT NULL,
  stripe_idempotency_key     text        NOT NULL,
  stripe_checkout_session_id text        NULL,
  stripe_customer_id         text        NULL,
  stripe_subscription_id     text        NULL,
  status                     text        NOT NULL DEFAULT 'pending',
  created_at                 timestamptz NOT NULL DEFAULT NOW(),
  completed_at               timestamptz NULL,
  CONSTRAINT nex_checkout_product_check CHECK (product IN ('shop','vault')),
  CONSTRAINT nex_checkout_status_check  CHECK (
    status IN ('pending','awaiting_payment','completed','abandoned','orphaned')
  ),
  -- Shop and Vault use the same intended_tier enum per product.
  CONSTRAINT nex_checkout_tier_shape CHECK (
    (product = 'shop'  AND intended_tier IN ('standard','unlimited'))
    OR
    (product = 'vault' AND intended_tier IN ('5gb','25gb','50gb','100gb'))
  )
);

-- Idempotency key uniqueness · guarantees exactly one Stripe session per
-- intent even if the client retries the server action.
CREATE UNIQUE INDEX IF NOT EXISTS nex_checkout_idempotency_unique
  ON nex_billing_checkout_session (stripe_idempotency_key);

-- Each Stripe Checkout session maps to AT MOST one of our rows.
CREATE UNIQUE INDEX IF NOT EXISTS nex_checkout_stripe_session_unique
  ON nex_billing_checkout_session (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- Each Stripe subscription (once bound by checkout.completed) maps to
-- exactly ONE checkout row.
CREATE UNIQUE INDEX IF NOT EXISTS nex_checkout_stripe_sub_unique
  ON nex_billing_checkout_session (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checkout_by_account
  ON nex_billing_checkout_session (nex_account_id, product);

CREATE INDEX IF NOT EXISTS idx_checkout_by_status
  ON nex_billing_checkout_session (status, created_at);

-- ---------------------------------------------------------------------------
-- Part 6 · column comments
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN nex_account.shop_stripe_customer_id IS
  'Stripe customer ID bound to this account for Shop subscription. Independent from vault_stripe_customer_id · customer may be the same person in Stripe but we track per-product for safety.';
COMMENT ON COLUMN nex_account.shop_stripe_subscription_id IS
  'Current Shop subscription ID. Updated on new checkout.completed. Old subs become historical (preserved in nex_billing_event_log).';

COMMENT ON TABLE nex_billing_event_log IS
  'Idempotent record of every Stripe webhook event we have claimed. Primary key stripe_event_id · duplicate deliveries fail INSERT ON CONFLICT and are naturally skipped. One row per Stripe event · never two.';
COMMENT ON TABLE nex_billing_adverse_event IS
  'Open and historical adverse billing events (disputes, refunds, fraud, admin). Access rule denies access iff AT LEAST ONE row for (account, product) has access_blocking=TRUE AND access_block_cleared_at IS NULL. Stripe dispute resolution and NEX access state are independent axes.';
COMMENT ON TABLE nex_billing_checkout_session IS
  'Durable account/product/tier intent record · inserted BEFORE Stripe Checkout call. The DB row is the authority for account linkage · Stripe metadata is only the lookup key.';

-- ---------------------------------------------------------------------------
-- Part 7 · ledger write · only after all schema succeeded
-- ---------------------------------------------------------------------------
INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '258',
  NOW(),
  'nex_billing foundation · 6 columns on nex_account (Stripe linkage) + 3 new tables (event_log, adverse_event, checkout_session) · partial unique indexes for dispute/refund/event dedup · status enum extended with incomplete+trialing',
  'Owner-authorised 2026-11-02. Prerequisites: 046, 207, 224, 257. No Stripe products created · no public pricing surfaces changed · no entitlements granted. 214/257 business_trial_status collision still a deployment-order blocker (unchanged by 258). Trial access policy is DRAFT · owner must select option A/B/C before trialing status grants access.'
);

COMMIT;
