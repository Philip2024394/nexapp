-- ============================================================================
-- NEX-native Migration 191 · nex_chat_theme catalogue extension
-- ============================================================================
--
-- Purpose:
--   Extend nex_chat_theme with the fields required by the per-business
--   premium theme & purchase system (origin + bespoke-owner link +
--   purchasable flag + catalogue price). Preserves the sealed ONE NEX
--   IDENTITY doctrine · nex_account.chat_theme remains the owner's
--   default · this migration adds no behaviour, only schema.
--
--   Deliberately NO row-level data for hammerex-products is written
--   here. The bespoke relabel + commission + ownership row for philip
--   lives in the SEPARATE review script
--   scripts/_review-hammerex-products-bespoke-relabel.sql · which runs
--   only on explicit founder authorisation.
--
-- Schema additions:
--   · origin                   text NOT NULL default 'standard'
--                              CHECK IN ('standard','premium_ready_made','bespoke')
--   · bespoke_for_account_id   uuid NULL REFERENCES nex_account(id)
--                              · set only when origin='bespoke'
--   · is_purchasable           boolean NOT NULL default false
--   · catalogue_price_minor    integer NULL · minor units
--   · catalogue_price_currency text NULL · ISO 4217 three-letter code
--
-- Backfill rules (safe · based on existing category axis only):
--   · category='premium' → origin='premium_ready_made'
--   · category='standard' → origin='standard'
--   · NO row becomes 'bespoke' here · bespoke promotion is a separate
--     authorised data step
--
-- Integrity enforced (DB-level, not comment-level):
--   · origin IN known set
--   · (origin='bespoke') ↔ (bespoke_for_account_id IS NOT NULL)
--   · is_purchasable=true requires both price fields NOT NULL
--   · catalogue_price_minor >= 0 (nullable)
--   · catalogue_price_currency matches ^[A-Z]{3}$ (nullable)
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '191';
--     -- Restore the sealed migration-048 SELECT policy as the baseline.
--     DROP POLICY IF EXISTS nex_chat_theme_select ON nex_chat_theme;
--     CREATE POLICY nex_chat_theme_select
--       ON nex_chat_theme FOR SELECT
--       USING (is_active = true);
--     ALTER TABLE nex_chat_theme
--       DROP CONSTRAINT IF EXISTS nex_chat_theme_bespoke_identity,
--       DROP CONSTRAINT IF EXISTS nex_chat_theme_purchasable_requires_price,
--       DROP CONSTRAINT IF EXISTS nex_chat_theme_catalogue_price_minor_nonneg,
--       DROP CONSTRAINT IF EXISTS nex_chat_theme_catalogue_price_currency_shape,
--       DROP CONSTRAINT IF EXISTS nex_chat_theme_origin_known,
--       DROP CONSTRAINT IF EXISTS nex_chat_theme_bespoke_for_account_fk;
--     DROP INDEX IF EXISTS idx_nex_chat_theme_is_purchasable;
--     ALTER TABLE nex_chat_theme
--       DROP COLUMN IF EXISTS catalogue_price_currency,
--       DROP COLUMN IF EXISTS catalogue_price_minor,
--       DROP COLUMN IF EXISTS is_purchasable,
--       DROP COLUMN IF EXISTS bespoke_for_account_id,
--       DROP COLUMN IF EXISTS origin;
--   COMMIT;
-- ============================================================================

BEGIN;

-- 1. Prerequisite: nex_chat_theme must exist (migration 048).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'nex_chat_theme' AND relkind = 'r') THEN
    RAISE EXCEPTION 'migration 191 requires nex_chat_theme (migration 048) to be present';
  END IF;
END $$;

-- 2. Additive columns · all initially nullable so we can backfill before
--    adding NOT NULL + CHECK constraints.
ALTER TABLE nex_chat_theme
  ADD COLUMN IF NOT EXISTS origin                   text,
  ADD COLUMN IF NOT EXISTS bespoke_for_account_id   uuid,
  ADD COLUMN IF NOT EXISTS is_purchasable           boolean,
  ADD COLUMN IF NOT EXISTS catalogue_price_minor    integer,
  ADD COLUMN IF NOT EXISTS catalogue_price_currency text;

-- 3. Backfill origin from existing category (no row becomes 'bespoke').
UPDATE nex_chat_theme
   SET origin = CASE
     WHEN category = 'premium' THEN 'premium_ready_made'
     ELSE 'standard'
   END
 WHERE origin IS NULL;

-- 4. Backfill is_purchasable to false everywhere.
UPDATE nex_chat_theme
   SET is_purchasable = false
 WHERE is_purchasable IS NULL;

-- 5. Promote origin + is_purchasable to NOT NULL with defaults now the backfill
--    is complete.
ALTER TABLE nex_chat_theme
  ALTER COLUMN origin SET NOT NULL,
  ALTER COLUMN origin SET DEFAULT 'standard',
  ALTER COLUMN is_purchasable SET NOT NULL,
  ALTER COLUMN is_purchasable SET DEFAULT false;

-- 6. FK on bespoke_for_account_id · ON DELETE SET NULL preserves the theme
--    row if the account is ever hard-deleted (which the sealed Identity
--    Doctrine already restricts).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'nex_chat_theme_bespoke_for_account_fk') THEN
    ALTER TABLE nex_chat_theme
      ADD CONSTRAINT nex_chat_theme_bespoke_for_account_fk
      FOREIGN KEY (bespoke_for_account_id)
      REFERENCES nex_account(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 7. origin enum CHECK.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'nex_chat_theme_origin_known') THEN
    ALTER TABLE nex_chat_theme
      ADD CONSTRAINT nex_chat_theme_origin_known
      CHECK (origin IN ('standard','premium_ready_made','bespoke'));
  END IF;
END $$;

-- 8. Price shape CHECKs (currency + non-negative).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'nex_chat_theme_catalogue_price_currency_shape') THEN
    ALTER TABLE nex_chat_theme
      ADD CONSTRAINT nex_chat_theme_catalogue_price_currency_shape
      CHECK (catalogue_price_currency IS NULL
             OR catalogue_price_currency ~ '^[A-Z]{3}$');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'nex_chat_theme_catalogue_price_minor_nonneg') THEN
    ALTER TABLE nex_chat_theme
      ADD CONSTRAINT nex_chat_theme_catalogue_price_minor_nonneg
      CHECK (catalogue_price_minor IS NULL
             OR catalogue_price_minor >= 0);
  END IF;
END $$;

-- 9. is_purchasable=true requires both price fields set (DB-enforced
--    invariant · stops anyone marking a theme purchasable without a price).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'nex_chat_theme_purchasable_requires_price') THEN
    ALTER TABLE nex_chat_theme
      ADD CONSTRAINT nex_chat_theme_purchasable_requires_price
      CHECK (
        is_purchasable = false
        OR (catalogue_price_minor IS NOT NULL
            AND catalogue_price_currency IS NOT NULL)
      );
  END IF;
END $$;

-- 10. origin='bespoke' ↔ bespoke_for_account_id IS NOT NULL (DB-enforced
--     invariant · stops bespoke metadata leaking onto non-bespoke rows and
--     stops bespoke rows losing their owner).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'nex_chat_theme_bespoke_identity') THEN
    ALTER TABLE nex_chat_theme
      ADD CONSTRAINT nex_chat_theme_bespoke_identity
      CHECK (
        (origin = 'bespoke' AND bespoke_for_account_id IS NOT NULL)
        OR (origin <> 'bespoke' AND bespoke_for_account_id IS NULL)
      );
  END IF;
END $$;

-- 11. Partial index for the purchasable catalogue surface.
CREATE INDEX IF NOT EXISTS idx_nex_chat_theme_is_purchasable
  ON nex_chat_theme (is_purchasable, is_active, sort_order)
  WHERE is_purchasable = true AND is_active = true;

-- 11a. Bespoke-privacy · row-level tightening of the sealed SELECT policy.
--
-- Rationale (Stage-2 security review finding #3a):
--   Migration 048's base policy is `USING (is_active = true)` with no TO
--   clause · it grants row-visibility to both anon and authenticated.
--   The new bespoke_for_account_id column added above would therefore be
--   publicly readable, leaking the identity of every account that
--   commissioned a bespoke theme.
--
--   Column-level REVOKE cannot reliably override a whole-table SELECT
--   grant in PostgreSQL, so we filter at the row level instead · the
--   entire bespoke-not-purchasable row is invisible to non-owner /
--   non-service callers. Standard + premium_ready_made rows remain
--   publicly visible. Bespoke rows explicitly flipped to is_purchasable
--   = true also remain publicly visible (so the premium showcase works).
--
--   Server-side consumers (chat-theme-service.ts et al.) all read via
--   the service_role admin client, which bypasses RLS entirely · so
--   this tightening does not break any sealed read path.
--
-- Safety for a reapplied migration: DROP POLICY IF EXISTS + CREATE
-- POLICY makes the replacement idempotent. The sealed migration 048
-- file is NOT modified · only the policy on the live table is
-- superseded.
DROP POLICY IF EXISTS nex_chat_theme_select ON nex_chat_theme;
CREATE POLICY nex_chat_theme_select
  ON nex_chat_theme FOR SELECT
  USING (
    is_active = true
    AND (
      origin <> 'bespoke'
      OR is_purchasable = true
      OR bespoke_for_account_id IN (
        SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()
      )
    )
  );

-- 12. Column documentation.
COMMENT ON COLUMN nex_chat_theme.origin IS
  'How this theme was created · standard (free picker) · premium_ready_made (built-in premium) · bespoke (commissioned by a specific account identified by bespoke_for_account_id). Separate from category (UI section) and tier (free vs. Bisnis gate).';
COMMENT ON COLUMN nex_chat_theme.bespoke_for_account_id IS
  'The nex_account that commissioned this bespoke theme. NULL for non-bespoke. Historical record · never used as an entitlement gate on its own; ownership for other buyers lives in nex_theme_ownership.';
COMMENT ON COLUMN nex_chat_theme.is_purchasable IS
  'Whether this theme is listed for direct purchase in the public catalogue. Default false · bespoke themes default false and must be explicitly flipped.';
COMMENT ON COLUMN nex_chat_theme.catalogue_price_minor IS
  'Public catalogue price in minor currency units (e.g. cents for EUR/USD/GBP, rupiah for IDR which has 0 decimals). NULL when not purchasable.';
COMMENT ON COLUMN nex_chat_theme.catalogue_price_currency IS
  'ISO 4217 three-letter currency code (e.g. EUR, USD, IDR). NULL when not purchasable.';

-- 13. Migration history.
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '191',
    'nex_chat_theme catalogue extension · origin · bespoke_for_account_id · is_purchasable · catalogue_price_{minor,currency} + bespoke-privacy policy tighten',
    'Additive. Backfill: existing category=premium rows → origin=premium_ready_made; else origin=standard. No row becomes bespoke here; the hammerex-products relabel is a SEPARATE historical script. No price is written. DB-enforces: is_purchasable requires price; bespoke requires owner; non-bespoke must not carry an owner. SELECT policy supersedes sealed migration-048 version · bespoke rows that are not purchasable are now invisible to anon + non-owner authenticated callers.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT origin, count(*) FROM nex_chat_theme GROUP BY origin ORDER BY origin;
--     → expect: standard=27, premium_ready_made=11, bespoke=0
--   SELECT id FROM nex_chat_theme WHERE is_purchasable = true;
--     → expect: 0 rows
--   SELECT conname FROM pg_constraint
--     WHERE conrelid = 'nex_chat_theme'::regclass
--       AND conname LIKE 'nex_chat_theme_%'
--     ORDER BY conname;
--     → expect 6 new constraint rows
--   SELECT polname, polqual::text FROM pg_policy
--     WHERE polrelid = 'nex_chat_theme'::regclass AND polname = 'nex_chat_theme_select';
--     → expect the tightened policy with the bespoke-privacy OR-chain
--   SELECT * FROM nex_migration_history WHERE version = '191';
