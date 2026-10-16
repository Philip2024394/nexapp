-- ============================================================================
-- NEX-native Migration 192 · nex_theme_commission
-- ============================================================================
--
-- Purpose:
--   Historical ledger of one-off bespoke theme commissions paid by an
--   account to NEX for a bespoke theme to be built for them. Separate
--   from the catalogue price (nex_chat_theme.catalogue_price_minor) ·
--   a commission is never automatically copied onto the public price.
--
-- Doctrine:
--   · Append-only · no public write path · service-role only.
--   · One row per (theme_id, account_id) · uniqueness enforced.
--   · paid_at may be NULL when the exact transaction date is unknown ·
--     evidence_note documents the reason. Never fabricate a date.
--
-- Schema:
--   · id            uuid PK · gen_random_uuid()
--   · theme_id      text NOT NULL · FK nex_chat_theme(id) ON DELETE RESTRICT
--   · account_id    uuid NOT NULL · FK nex_account(id)    ON DELETE RESTRICT
--   · price_minor   integer NOT NULL · > 0 (minor units)
--   · currency      text NOT NULL · ISO 4217 three-letter
--   · paid_at       timestamptz NULL · unknown is permitted
--   · evidence_note text NULL · free text
--   · created_at    timestamptz NOT NULL default now()
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '192';
--     DROP TABLE IF EXISTS nex_theme_commission;
--   COMMIT;
-- ============================================================================

BEGIN;

-- Prerequisite tables.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'nex_chat_theme' AND relkind = 'r') THEN
    RAISE EXCEPTION 'migration 192 requires nex_chat_theme (migration 048)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'nex_account' AND relkind = 'r') THEN
    RAISE EXCEPTION 'migration 192 requires nex_account (migration 001)';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS nex_theme_commission (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id      text        NOT NULL REFERENCES nex_chat_theme(id) ON DELETE RESTRICT,
  account_id    uuid        NOT NULL REFERENCES nex_account(id)    ON DELETE RESTRICT,
  price_minor   integer     NOT NULL CHECK (price_minor > 0),
  currency      text        NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  paid_at       timestamptz NULL,
  evidence_note text        NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS nex_theme_commission_one_per_theme_account
  ON nex_theme_commission(theme_id, account_id);

CREATE INDEX IF NOT EXISTS nex_theme_commission_account_idx
  ON nex_theme_commission(account_id);

COMMENT ON TABLE nex_theme_commission IS
  'Historical bespoke theme commissions · owner-paid-to-NEX fees for a bespoke theme to be built. Append-only, service-role write only. Separate from the public catalogue price. paid_at may be NULL when exact date is unknown.';

ALTER TABLE nex_theme_commission ENABLE ROW LEVEL SECURITY;

-- Deny-by-default · explicit service-role-only policies for every verb.
-- supabase_user_id-based policies are intentionally omitted here · the
-- commission history is not user-visible.
DROP POLICY IF EXISTS nex_theme_commission_service_select ON nex_theme_commission;
CREATE POLICY nex_theme_commission_service_select
  ON nex_theme_commission FOR SELECT
  TO authenticated
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS nex_theme_commission_service_insert ON nex_theme_commission;
CREATE POLICY nex_theme_commission_service_insert
  ON nex_theme_commission FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS nex_theme_commission_service_update ON nex_theme_commission;
CREATE POLICY nex_theme_commission_service_update
  ON nex_theme_commission FOR UPDATE
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS nex_theme_commission_service_delete ON nex_theme_commission;
CREATE POLICY nex_theme_commission_service_delete
  ON nex_theme_commission FOR DELETE
  TO authenticated
  USING (auth.role() = 'service_role');

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '192',
    'nex_theme_commission · historical bespoke commission ledger',
    'Service-role only · append-only. One row per (theme_id, account_id). paid_at nullable to permit honest "date unknown" records. No row is inserted by this migration; the hammerex-products €100 record lives in the separate authorised historical review script.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT policyname FROM pg_policies WHERE tablename = 'nex_theme_commission' ORDER BY policyname;
--     → expect 4 service-role-only policies
--   SELECT indexname FROM pg_indexes WHERE tablename = 'nex_theme_commission' ORDER BY indexname;
--     → expect: nex_theme_commission_account_idx + nex_theme_commission_one_per_theme_account + nex_theme_commission_pkey
--   SELECT count(*) FROM nex_theme_commission;
--     → expect 0
--   SELECT * FROM nex_migration_history WHERE version = '192';
