-- ============================================================================
-- NEX-native Migration 193 · nex_theme_purchase
-- ============================================================================
--
-- Purpose:
--   Direct-purchase intent + state machine for a single theme buy. One
--   purchase row per intent · state transitions are the sole writer of
--   verified-payment metadata · ownership is NEVER derived from a
--   purchase whose state is not 'verified'.
--
-- Doctrine:
--   · Payment provider is NOT WIRED YET. The purchase table exists so
--     the catalogue + service layer can be built, but every verified
--     state transition will come from a trusted webhook adapter later.
--     No simulated payment path is granted here.
--   · Idempotent replay protection via partial UNIQUE on
--     (provider, provider_event_id).
--   · Clients may insert their own 'pending' intent (and only pending);
--     every subsequent state transition is service-role only.
--
-- State machine (enforced by CHECK):
--   pending  → verified | failed | cancelled | expired
--   verified → refunded
--   terminal: failed · cancelled · expired · refunded
--
-- Schema:
--   · id                   uuid PK
--   · theme_id             text NOT NULL · FK nex_chat_theme(id)
--   · account_id           uuid NOT NULL · FK nex_account(id)
--   · intent_token         text NOT NULL UNIQUE · opaque server-generated
--   · state                text NOT NULL default 'pending' · enum CHECK
--   · price_minor          integer NOT NULL · > 0 · minor units
--   · currency             text NOT NULL · ISO 4217
--   · provider             text NULL · 'stripe'/'xendit'/etc · NULL until wired
--   · provider_payment_id  text NULL
--   · provider_event_id    text NULL
--   · event_received_at    timestamptz NULL
--   · verified_at          timestamptz NULL
--   · created_at           timestamptz NOT NULL default now()
--   · updated_at           timestamptz NOT NULL default now()
--
-- DB invariants:
--   · state='verified' requires provider · provider_payment_id ·
--     provider_event_id · verified_at ALL NOT NULL.
--   · (provider, provider_event_id) UNIQUE when both NOT NULL
--     (duplicate-webhook replay protection).
--   · (id, account_id, theme_id) UNIQUE · composite FK target for
--     nex_theme_ownership → nex_theme_purchase in migration 194.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '193';
--     DROP TRIGGER IF EXISTS nex_theme_purchase_guard_transitions_trg
--       ON nex_theme_purchase;
--     DROP FUNCTION IF EXISTS nex_theme_purchase_guard_transitions;
--     -- DROP TABLE cascades the touch_updated_at trigger as well.
--     DROP TABLE IF EXISTS nex_theme_purchase;
--   COMMIT;
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'nex_chat_theme' AND relkind = 'r') THEN
    RAISE EXCEPTION 'migration 193 requires nex_chat_theme (migration 048)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'nex_account' AND relkind = 'r') THEN
    RAISE EXCEPTION 'migration 193 requires nex_account (migration 001)';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS nex_theme_purchase (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id             text        NOT NULL REFERENCES nex_chat_theme(id) ON DELETE RESTRICT,
  account_id           uuid        NOT NULL REFERENCES nex_account(id)    ON DELETE RESTRICT,
  intent_token         text        NOT NULL,
  state                text        NOT NULL DEFAULT 'pending',
  price_minor          integer     NOT NULL CHECK (price_minor > 0),
  currency             text        NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider             text        NULL,
  provider_payment_id  text        NULL,
  provider_event_id    text        NULL,
  event_received_at    timestamptz NULL,
  verified_at          timestamptz NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Enum CHECK for state.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'nex_theme_purchase_state_known') THEN
    ALTER TABLE nex_theme_purchase
      ADD CONSTRAINT nex_theme_purchase_state_known
      CHECK (state IN ('pending','verified','failed','cancelled','expired','refunded'));
  END IF;
END $$;

-- Verified-state evidence invariant: cannot land in verified without
-- provider + provider_payment_id + provider_event_id + verified_at all set.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'nex_theme_purchase_verified_requires_evidence') THEN
    ALTER TABLE nex_theme_purchase
      ADD CONSTRAINT nex_theme_purchase_verified_requires_evidence
      CHECK (
        state <> 'verified'
        OR (verified_at IS NOT NULL
            AND provider IS NOT NULL
            AND provider_payment_id IS NOT NULL
            AND provider_event_id IS NOT NULL)
      );
  END IF;
END $$;

-- Opaque intent-token uniqueness (one-way check for client lookups).
CREATE UNIQUE INDEX IF NOT EXISTS nex_theme_purchase_intent_token_unique
  ON nex_theme_purchase(intent_token);

-- Composite FK target for nex_theme_ownership (migration 194 adds the FK).
CREATE UNIQUE INDEX IF NOT EXISTS nex_theme_purchase_id_account_theme_unique
  ON nex_theme_purchase(id, account_id, theme_id);

-- Duplicate-webhook replay protection: when both provider fields are set,
-- their pair must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS nex_theme_purchase_provider_event_idempotent
  ON nex_theme_purchase(provider, provider_event_id)
  WHERE provider IS NOT NULL AND provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS nex_theme_purchase_account_idx
  ON nex_theme_purchase(account_id);

COMMENT ON TABLE nex_theme_purchase IS
  'Direct-purchase intents + state. Clients may insert their own pending intent (RLS); all subsequent state transitions are service-role only (webhook adapter). Ownership (nex_theme_ownership.direct_purchase) is granted only when state=verified via trigger in migration 194.';

ALTER TABLE nex_theme_purchase ENABLE ROW LEVEL SECURITY;

-- SELECT: owner reads their own rows.
DROP POLICY IF EXISTS nex_theme_purchase_owner_select ON nex_theme_purchase;
CREATE POLICY nex_theme_purchase_owner_select
  ON nex_theme_purchase FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- INSERT: owner creates a pending intent for THEIR OWN account only, and
-- cannot set any verified-only fields (provider_payment_id · verified_at ·
-- state must be 'pending').
DROP POLICY IF EXISTS nex_theme_purchase_owner_insert_pending ON nex_theme_purchase;
CREATE POLICY nex_theme_purchase_owner_insert_pending
  ON nex_theme_purchase FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
    AND state = 'pending'
    AND provider_payment_id IS NULL
    AND provider_event_id IS NULL
    AND verified_at IS NULL
  );

-- No authenticated UPDATE/DELETE policy · state transitions and
-- provider-field writes are service-role only.

-- Touch updated_at (shared helper from migration 002).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'nex_touch_updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS nex_theme_purchase_touch_updated_at ON nex_theme_purchase';
    EXECUTE 'CREATE TRIGGER nex_theme_purchase_touch_updated_at
             BEFORE UPDATE ON nex_theme_purchase
             FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at()';
  END IF;
END $$;

-- State-transition guard · Stage-2 security review finding #1a.
--
-- CHECK alone encodes allowed VALUES, not allowed EDGES. Without this
-- trigger, a service-role UPDATE could move a row directly from
-- failed / cancelled / refunded / expired back to pending or verified.
-- The verified-requires-evidence CHECK does NOT prevent this · it only
-- demands that the four provider fields are populated.
--
-- Allowed transitions (closed matrix):
--   pending  → verified | failed | cancelled | expired
--   verified → refunded
--   same-state is a no-op (useful for idempotent UPDATEs with other
--   column edits · we do not want to block operator UPDATEs of
--   provider_payment_id et al. when state is unchanged).
--
-- Everything else RAISES. search_path is pinned to pg_catalog, public
-- (Stage-2 finding #4d).
CREATE OR REPLACE FUNCTION nex_theme_purchase_guard_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.state = NEW.state THEN
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD.state = 'pending'  AND NEW.state IN ('verified','failed','cancelled','expired'))
    OR (OLD.state = 'verified' AND NEW.state = 'refunded')
  ) THEN
    RAISE EXCEPTION
      'illegal nex_theme_purchase transition: % → % (purchase_id=%)',
      OLD.state, NEW.state, OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nex_theme_purchase_guard_transitions_trg ON nex_theme_purchase;
CREATE TRIGGER nex_theme_purchase_guard_transitions_trg
  BEFORE UPDATE OF state ON nex_theme_purchase
  FOR EACH ROW
  EXECUTE FUNCTION nex_theme_purchase_guard_transitions();

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '193',
    'nex_theme_purchase · direct-purchase intent + state machine + transition guard',
    'Payment provider NOT WIRED. Clients may INSERT a pending intent for their own account only; verified transitions are service-role only; verified state requires provider + provider_payment_id + provider_event_id + verified_at. Duplicate-webhook replay protected by partial UNIQUE on (provider, provider_event_id). Composite UNIQUE (id, account_id, theme_id) is the FK target for nex_theme_ownership in migration 194. BEFORE UPDATE OF state trigger enforces the closed transition matrix pending → {verified,failed,cancelled,expired} and verified → refunded; every other transition raises.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT policyname FROM pg_policies WHERE tablename = 'nex_theme_purchase' ORDER BY policyname;
--     → expect: nex_theme_purchase_owner_select + nex_theme_purchase_owner_insert_pending
--   SELECT indexname FROM pg_indexes WHERE tablename = 'nex_theme_purchase' ORDER BY indexname;
--     → expect 5 indexes (pkey + account_idx + id_account_theme_unique + intent_token_unique + provider_event_idempotent)
--   SELECT conname FROM pg_constraint
--     WHERE conrelid='nex_theme_purchase'::regclass
--     ORDER BY conname;
--     → expect 7 constraints (FKs + CHECKs + state_known + verified_requires_evidence + currency + price_minor_positive + NOT NULLs)
--   SELECT count(*) FROM nex_theme_purchase;
--     → expect 0
--   SELECT * FROM nex_migration_history WHERE version = '193';
