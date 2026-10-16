-- ============================================================================
-- NEX-native Migration 195 · nex_business_theme
-- ============================================================================
--
-- Purpose:
--   Per-business saved themes + per-business active theme pointer, as an
--   OVERRIDE layer on top of the sealed account-level nex_account.chat_theme
--   default. The sealed ONE NEX IDENTITY doctrine is preserved:
--
--     Resolution for "the active theme for business X" (service layer):
--       1. nex_business_theme(business_id=X, state='activated').theme_id if present
--       2. else owner's nex_account.chat_theme
--       3. else 'default'
--
--   Nothing in this migration changes legacy chat routes or forces a
--   migration of existing per-account preferences.
--
-- Doctrine:
--   · One activated row per business is enforced by a partial UNIQUE INDEX.
--   · Only the account that owns the business (via nex_business.owner_account_id
--     → nex_account.supabase_user_id = auth.uid()) can save/activate.
--   · Previewing or saving never grants paid access · activation goes
--     through canActivate() in the service layer (migration 194 + 193 ownership
--     + nex_account.tier + nex_account.bisnis_expires_at). This migration is
--     the persistence layer; policy is purely owner-of-business.
--
-- Schema:
--   · id            uuid PK
--   · business_id   uuid NOT NULL · FK nex_business(id) ON DELETE CASCADE
--   · theme_id      text NOT NULL · FK nex_chat_theme(id) ON DELETE RESTRICT
--   · state         text NOT NULL · CHECK IN ('saved','activated')
--   · saved_at      timestamptz NOT NULL default now()
--   · activated_at  timestamptz NULL · required when state='activated'
--   · note          text NULL
--   · updated_at    timestamptz NOT NULL default now()
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '195';
--     DROP TABLE IF EXISTS nex_business_theme;
--   COMMIT;
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'nex_business' AND relkind = 'r') THEN
    RAISE EXCEPTION 'migration 195 requires nex_business (migration 002)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'nex_chat_theme' AND relkind = 'r') THEN
    RAISE EXCEPTION 'migration 195 requires nex_chat_theme (migration 048)';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS nex_business_theme (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES nex_business(id)   ON DELETE CASCADE,
  theme_id      text        NOT NULL REFERENCES nex_chat_theme(id) ON DELETE RESTRICT,
  state         text        NOT NULL,
  saved_at      timestamptz NOT NULL DEFAULT now(),
  activated_at  timestamptz NULL,
  note          text        NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'nex_business_theme_state_known') THEN
    ALTER TABLE nex_business_theme
      ADD CONSTRAINT nex_business_theme_state_known
      CHECK (state IN ('saved','activated'));
  END IF;
END $$;

-- state=activated requires activated_at; state=saved requires activated_at IS NULL.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'nex_business_theme_activated_requires_timestamp') THEN
    ALTER TABLE nex_business_theme
      ADD CONSTRAINT nex_business_theme_activated_requires_timestamp
      CHECK (
        (state = 'activated' AND activated_at IS NOT NULL)
        OR (state = 'saved' AND activated_at IS NULL)
      );
  END IF;
END $$;

-- One (saved OR activated) row per (business, theme).
CREATE UNIQUE INDEX IF NOT EXISTS nex_business_theme_one_entry_per_business_theme
  ON nex_business_theme(business_id, theme_id);

-- At most one ACTIVATED row per business · DB-enforced one-active invariant.
CREATE UNIQUE INDEX IF NOT EXISTS nex_business_theme_one_activated_per_business
  ON nex_business_theme(business_id)
  WHERE state = 'activated';

CREATE INDEX IF NOT EXISTS nex_business_theme_business_idx
  ON nex_business_theme(business_id);

COMMENT ON TABLE nex_business_theme IS
  'Per-business saved themes + per-business active theme (override layer). Preserves the sealed account-level nex_account.chat_theme default · the active theme for a business is: this row where state=activated, else owner nex_account.chat_theme, else default. Only the business owner can save/activate (RLS); activation eligibility (ownership + subscription + bespoke) is checked in the service layer, not here.';

ALTER TABLE nex_business_theme ENABLE ROW LEVEL SECURITY;

-- SELECT: owner of the business (via owner_account_id → supabase_user_id).
DROP POLICY IF EXISTS nex_business_theme_owner_select ON nex_business_theme;
CREATE POLICY nex_business_theme_owner_select
  ON nex_business_theme FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id
        FROM nex_business b
        JOIN nex_account a ON a.id = b.owner_account_id
       WHERE a.supabase_user_id = auth.uid()
    )
  );

-- INSERT: same gate · can only insert for a business they own.
DROP POLICY IF EXISTS nex_business_theme_owner_insert ON nex_business_theme;
CREATE POLICY nex_business_theme_owner_insert
  ON nex_business_theme FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT b.id
        FROM nex_business b
        JOIN nex_account a ON a.id = b.owner_account_id
       WHERE a.supabase_user_id = auth.uid()
    )
  );

-- UPDATE: same gate · cannot pivot business_id to a foreign business.
DROP POLICY IF EXISTS nex_business_theme_owner_update ON nex_business_theme;
CREATE POLICY nex_business_theme_owner_update
  ON nex_business_theme FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id
        FROM nex_business b
        JOIN nex_account a ON a.id = b.owner_account_id
       WHERE a.supabase_user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT b.id
        FROM nex_business b
        JOIN nex_account a ON a.id = b.owner_account_id
       WHERE a.supabase_user_id = auth.uid()
    )
  );

-- DELETE: same gate.
DROP POLICY IF EXISTS nex_business_theme_owner_delete ON nex_business_theme;
CREATE POLICY nex_business_theme_owner_delete
  ON nex_business_theme FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id
        FROM nex_business b
        JOIN nex_account a ON a.id = b.owner_account_id
       WHERE a.supabase_user_id = auth.uid()
    )
  );

-- Touch updated_at.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'nex_touch_updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS nex_business_theme_touch_updated_at ON nex_business_theme';
    EXECUTE 'CREATE TRIGGER nex_business_theme_touch_updated_at
             BEFORE UPDATE ON nex_business_theme
             FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at()';
  END IF;
END $$;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '195',
    'nex_business_theme · per-business saved + activated · override layer on account-level chat_theme',
    'Preserves sealed ONE NEX IDENTITY: owner nex_account.chat_theme remains the default. Partial UNIQUE enforces one activated row per business; business-owner RLS on every verb; activation eligibility (ownership + subscription + bespoke) is checked server-side via canActivate() in the Stage-3 service layer, not here.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT policyname FROM pg_policies WHERE tablename='nex_business_theme' ORDER BY policyname;
--     → expect 4 owner policies
--   SELECT indexname FROM pg_indexes WHERE tablename='nex_business_theme' ORDER BY indexname;
--     → expect: nex_business_theme_business_idx, nex_business_theme_one_activated_per_business, nex_business_theme_one_entry_per_business_theme, nex_business_theme_pkey
--   SELECT conname FROM pg_constraint
--     WHERE conrelid='nex_business_theme'::regclass
--     ORDER BY conname;
--     → expect FKs + state_known + activated_requires_timestamp + NOT NULLs
--   SELECT count(*) FROM nex_business_theme;
--     → expect 0
--   SELECT * FROM nex_migration_history WHERE version='195';
