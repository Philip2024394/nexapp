-- ============================================================================
-- NEX-native Migration 194 · nex_theme_ownership
-- ============================================================================
--
-- Purpose:
--   Permanent, auditable per-account theme ownership. Separate from
--   subscription-based access · subscription unlocks all premium themes
--   while a subscription is active · ownership here persists even when
--   a subscription later expires.
--
-- Doctrine:
--   · Three acquisition sources (CHECK-constrained): bespoke · direct_purchase · grant.
--   · Direct-purchase ownership can only come from a verified
--     nex_theme_purchase (migration 193). Enforced by:
--       (a) composite FK (purchase_id, account_id, theme_id) →
--           nex_theme_purchase(id, account_id, theme_id) · guarantees the
--           referenced purchase belongs to this exact account + theme.
--       (b) trigger that raises unless the referenced purchase.state='verified'.
--   · One durable row per (theme_id, account_id).
--   · No public write path · ownership rows are created exclusively by
--     service-role code paths (bespoke backfill, verified-purchase webhook,
--     administrative grant).
--
-- Schema:
--   · id            uuid PK
--   · theme_id      text NOT NULL · FK nex_chat_theme(id) ON DELETE RESTRICT
--   · account_id    uuid NOT NULL · FK nex_account(id)    ON DELETE RESTRICT
--   · acquired_via  text NOT NULL · CHECK IN (bespoke, direct_purchase, grant)
--   · acquired_at   timestamptz NOT NULL default now()
--   · purchase_id   uuid NULL · FK nex_theme_purchase(id)
--                              · NULL for bespoke/grant · required for direct_purchase
--   · revoked_at    timestamptz NULL · set when ownership is revoked
--   · created_at    timestamptz NOT NULL default now()
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '194';
--     -- Drop the refund-revocation trigger that lives on nex_theme_purchase
--     -- (it was added by this migration, so it must also be removed on rollback).
--     DROP TRIGGER IF EXISTS nex_theme_purchase_refund_revokes_ownership_trg
--       ON nex_theme_purchase;
--     DROP FUNCTION IF EXISTS nex_theme_purchase_refund_revokes_ownership;
--     -- Drop triggers + functions on nex_theme_ownership before the table.
--     DROP TRIGGER IF EXISTS nex_theme_ownership_revoked_at_terminal_trg
--       ON nex_theme_ownership;
--     DROP FUNCTION IF EXISTS nex_theme_ownership_revoked_at_is_terminal;
--     DROP TRIGGER IF EXISTS nex_theme_ownership_require_verified_purchase_trg
--       ON nex_theme_ownership;
--     DROP FUNCTION IF EXISTS nex_theme_ownership_require_verified_purchase;
--     DROP TABLE IF EXISTS nex_theme_ownership;
--   COMMIT;
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'nex_chat_theme' AND relkind = 'r') THEN
    RAISE EXCEPTION 'migration 194 requires nex_chat_theme (migration 048)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'nex_account' AND relkind = 'r') THEN
    RAISE EXCEPTION 'migration 194 requires nex_account (migration 001)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'nex_theme_purchase' AND relkind = 'r') THEN
    RAISE EXCEPTION 'migration 194 requires nex_theme_purchase (migration 193)';
  END IF;
  -- Composite FK target index must exist (migration 193 creates it).
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'nex_theme_purchase_id_account_theme_unique') THEN
    RAISE EXCEPTION 'migration 194 requires UNIQUE INDEX nex_theme_purchase_id_account_theme_unique (migration 193)';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS nex_theme_ownership (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id      text        NOT NULL REFERENCES nex_chat_theme(id) ON DELETE RESTRICT,
  account_id    uuid        NOT NULL REFERENCES nex_account(id)    ON DELETE RESTRICT,
  acquired_via  text        NOT NULL,
  acquired_at   timestamptz NOT NULL DEFAULT now(),
  purchase_id   uuid        NULL,
  revoked_at    timestamptz NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'nex_theme_ownership_acquired_via_known') THEN
    ALTER TABLE nex_theme_ownership
      ADD CONSTRAINT nex_theme_ownership_acquired_via_known
      CHECK (acquired_via IN ('bespoke','direct_purchase','grant'));
  END IF;
END $$;

-- Composite FK: when purchase_id is set, the referenced purchase MUST
-- belong to this exact (account_id, theme_id). Non-deferrable · the
-- purchase row MUST already exist (verified) before ownership is inserted.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'nex_theme_ownership_purchase_consistency_fk') THEN
    ALTER TABLE nex_theme_ownership
      ADD CONSTRAINT nex_theme_ownership_purchase_consistency_fk
      FOREIGN KEY (purchase_id, account_id, theme_id)
      REFERENCES nex_theme_purchase(id, account_id, theme_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Composite integrity: direct_purchase requires purchase_id; bespoke/grant
-- MUST have NULL purchase_id (prevents stale FK linkage on free grants).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'nex_theme_ownership_purchase_id_matches_source') THEN
    ALTER TABLE nex_theme_ownership
      ADD CONSTRAINT nex_theme_ownership_purchase_id_matches_source
      CHECK (
        (acquired_via = 'direct_purchase' AND purchase_id IS NOT NULL)
        OR (acquired_via IN ('bespoke','grant') AND purchase_id IS NULL)
      );
  END IF;
END $$;

-- One durable ownership row per (theme, account) · UPSERT target for the
-- webhook / bespoke / grant paths.
CREATE UNIQUE INDEX IF NOT EXISTS nex_theme_ownership_one_per_theme_account
  ON nex_theme_ownership(theme_id, account_id);

CREATE INDEX IF NOT EXISTS nex_theme_ownership_account_idx
  ON nex_theme_ownership(account_id);

-- DB-level trigger · direct_purchase ownership can only exist when the
-- referenced purchase has state='verified'. Belt-and-braces alongside
-- the composite FK (which guarantees the row matches account_id/theme_id
-- but does NOT itself verify state).
--
-- Stage-2 security review correction #2b · BEFORE INSERT ONLY (not UPDATE).
-- Rationale: this trigger's job is to gate the initial grant · it should
-- not run on later UPDATEs (e.g. setting revoked_at after a refund) because
-- a refunded purchase would then make legitimate revocation impossible.
-- The composite FK + the CHECK on acquired_via/purchase_id still enforce
-- shape on UPDATE; this trigger only enforces verified-state at creation.
--
-- Stage-2 security review correction #4d · SET search_path pinned.
CREATE OR REPLACE FUNCTION nex_theme_ownership_require_verified_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  purchase_state text;
BEGIN
  IF NEW.acquired_via <> 'direct_purchase' THEN
    RETURN NEW;
  END IF;
  SELECT p.state INTO purchase_state
    FROM nex_theme_purchase p
   WHERE p.id = NEW.purchase_id;
  IF purchase_state IS NULL OR purchase_state <> 'verified' THEN
    RAISE EXCEPTION
      'nex_theme_ownership.direct_purchase requires referenced nex_theme_purchase.state = verified (purchase_id=%, state=%)',
      NEW.purchase_id, COALESCE(purchase_state, '<missing>');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nex_theme_ownership_require_verified_purchase_trg
  ON nex_theme_ownership;
CREATE TRIGGER nex_theme_ownership_require_verified_purchase_trg
  BEFORE INSERT ON nex_theme_ownership
  FOR EACH ROW
  EXECUTE FUNCTION nex_theme_ownership_require_verified_purchase();

-- Revocation-is-terminal · Stage-2 security review correction #5.
--
-- Once revoked_at is set, it may NOT be modified. Prevents a service-role
-- mistake (or a replay) from "un-revoking" ownership whose underlying
-- purchase was refunded. The acceptable remediation path, if revocation
-- was itself an error, is to INSERT a NEW ownership row (acquired_via =
-- 'grant', purchase_id = NULL, which bypasses the verified-purchase
-- trigger · it is intended for admin-granted access).
CREATE OR REPLACE FUNCTION nex_theme_ownership_revoked_at_is_terminal()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.revoked_at IS NOT NULL
     AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    RAISE EXCEPTION
      'nex_theme_ownership.revoked_at is terminal · cannot be modified once set (ownership_id=%, was=%)',
      OLD.id, OLD.revoked_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nex_theme_ownership_revoked_at_terminal_trg
  ON nex_theme_ownership;
CREATE TRIGGER nex_theme_ownership_revoked_at_terminal_trg
  BEFORE UPDATE OF revoked_at ON nex_theme_ownership
  FOR EACH ROW
  EXECUTE FUNCTION nex_theme_ownership_revoked_at_is_terminal();

-- Refund-revokes-ownership · Stage-2 security review correction #5.
--
-- When a nex_theme_purchase transitions verified → refunded, revoke the
-- matching direct_purchase ownership row atomically within the same
-- transaction. The composite FK guarantees the ownership row (if any)
-- belongs to the same (account_id, theme_id). Idempotent: the UPDATE
-- only touches rows with revoked_at IS NULL.
--
-- Scope rules:
--   · Only acts on direct_purchase ownership rows (bespoke and grant
--     rows are intentionally untouched · subscription-based access is
--     not represented in this table at all).
--   · Only fires on the exact transition verified → refunded · same-
--     state refunded → refunded is a no-op by the WHEN clause.
--
-- Recursive-trigger analysis:
--   · This trigger updates nex_theme_ownership.
--   · The triggers on nex_theme_ownership are:
--       (a) require_verified_purchase_trg · BEFORE INSERT ONLY · not fired by UPDATE.
--       (b) revoked_at_terminal_trg · BEFORE UPDATE OF revoked_at ·
--           allows NULL → not-NULL exactly once; this trigger does
--           exactly that, so (b) passes.
--     Neither (a) nor (b) touches nex_theme_purchase · no recursion possible.
--
-- Duplicate-refund-event analysis:
--   · The partial UNIQUE on (provider, provider_event_id) in migration
--     193 prevents duplicate webhook rows from being inserted.
--   · If a service-role UPDATE re-sets state='refunded' on an already-
--     refunded row, the guard_transitions trigger early-returns (same
--     state) and this trigger's WHEN clause rejects (OLD.state <>
--     'verified'). No double-revocation.
CREATE OR REPLACE FUNCTION nex_theme_purchase_refund_revokes_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE nex_theme_ownership
     SET revoked_at = now()
   WHERE purchase_id = NEW.id
     AND acquired_via = 'direct_purchase'
     AND revoked_at IS NULL;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS nex_theme_purchase_refund_revokes_ownership_trg
  ON nex_theme_purchase;
CREATE TRIGGER nex_theme_purchase_refund_revokes_ownership_trg
  AFTER UPDATE OF state ON nex_theme_purchase
  FOR EACH ROW
  WHEN (OLD.state = 'verified' AND NEW.state = 'refunded')
  EXECUTE FUNCTION nex_theme_purchase_refund_revokes_ownership();

COMMENT ON TABLE nex_theme_ownership IS
  'Permanent per-account theme ownership · bespoke · direct_purchase · grant. Direct-purchase rows require a matching verified nex_theme_purchase (enforced by composite FK + trigger). Service-role writes only · no public write path. Subscription-based access is NOT recorded here (that is read directly from nex_account.tier + bisnis_expires_at by the canActivate service).';

ALTER TABLE nex_theme_ownership ENABLE ROW LEVEL SECURITY;

-- SELECT: the owning account can read their own ownership rows (for the
-- "My Themes" surface).
DROP POLICY IF EXISTS nex_theme_ownership_owner_select ON nex_theme_ownership;
CREATE POLICY nex_theme_ownership_owner_select
  ON nex_theme_ownership FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- No authenticated INSERT/UPDATE/DELETE · service_role bypasses RLS and
-- is the only writer. (Bespoke backfill, verified-purchase handler,
-- admin grant.)

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '194',
    'nex_theme_ownership · permanent per-account theme ownership · verified-purchase + refund-revocation + revoked-is-terminal enforcement',
    'Service-role writes only. Composite FK (purchase_id, account_id, theme_id) ensures a direct-purchase ownership can only reference a purchase belonging to the same (account, theme). Trigger require_verified_purchase fires BEFORE INSERT ONLY (ownership can still be revoked after refund). Trigger revoked_at_is_terminal makes revocation write-once. Trigger refund_revokes_ownership lives on nex_theme_purchase and automatically sets revoked_at on the matching direct_purchase ownership when a verified purchase transitions to refunded · same-transaction, idempotent, non-recursive. Bespoke and grant ownership rows are NOT revoked by this trigger · subscription expiry is not represented in this table at all. One durable row per (theme_id, account_id).'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT policyname FROM pg_policies WHERE tablename='nex_theme_ownership' ORDER BY policyname;
--     → expect: nex_theme_ownership_owner_select
--   SELECT indexname FROM pg_indexes WHERE tablename='nex_theme_ownership' ORDER BY indexname;
--     → expect 3 indexes (pkey + one_per_theme_account + account_idx)
--   SELECT conname FROM pg_constraint
--     WHERE conrelid='nex_theme_ownership'::regclass
--     ORDER BY conname;
--     → expect FKs + acquired_via_known + purchase_id_matches_source + purchase_consistency_fk + NOT NULLs
--   SELECT tgname FROM pg_trigger
--     WHERE tgrelid='nex_theme_ownership'::regclass AND NOT tgisinternal
--     ORDER BY tgname;
--     → expect:
--         nex_theme_ownership_require_verified_purchase_trg
--         nex_theme_ownership_revoked_at_terminal_trg
--   SELECT tgname FROM pg_trigger
--     WHERE tgrelid='nex_theme_purchase'::regclass AND NOT tgisinternal
--     ORDER BY tgname;
--     → expect (after migration 193 + 194 applied):
--         nex_theme_purchase_guard_transitions_trg
--         nex_theme_purchase_refund_revokes_ownership_trg
--         nex_theme_purchase_touch_updated_at
--   SELECT count(*) FROM nex_theme_ownership;
--     → expect 0
--   SELECT * FROM nex_migration_history WHERE version='194';
