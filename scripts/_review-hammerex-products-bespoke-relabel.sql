-- ============================================================================
-- SEPARATE HISTORICAL DATA SCRIPT · REVIEW ONLY · NOT A MIGRATION
-- scripts/_review-hammerex-products-bespoke-relabel.sql
-- ============================================================================
--
-- Status:
--   DRAFT · UNAPPLIED. Prepared for founder review as part of Stage 2.
--   This file is deliberately NOT in nex-supabase/migrations/ so it does
--   not run as part of a migration pass. It applies ONLY on explicit
--   authorisation, with the exact command recorded at the bottom.
--
-- Purpose:
--   Record the historical reality of the hammerex-products theme:
--     1. Relabel nex_chat_theme.hammerex-products:
--          origin                   : premium_ready_made → bespoke
--          bespoke_for_account_id   : NULL → philip's account id
--     2. Record philip's one-off €100 commission in nex_theme_commission
--        with paid_at = NULL (exact transaction date not on record)
--     3. Record philip's permanent ownership in nex_theme_ownership
--        with acquired_via = 'bespoke', purchase_id = NULL
--
-- Hard rules:
--   · No field is invented. paid_at stays NULL · we do not fabricate a date.
--   · evidence_note is honest about the unknown.
--   · The public catalogue price (nex_chat_theme.catalogue_price_minor)
--     is NOT set to 10000 by this script · the historical commission and
--     the public price are deliberately separate records.
--   · hammerex-industrial (the old theme row) is NOT touched.
--   · Wrapped in a single transaction · all three writes succeed together
--     or roll back together.
--   · Preconditions are validated inside the transaction; any failure
--     RAISES and causes a ROLLBACK (no partial apply).
--
-- Preconditions:
--   · Migrations 191 · 192 · 193 · 194 applied.
--   · nex_chat_theme row id='hammerex-products' exists.
--   · The owner-resolution business slug 'nex-10842' exists and points
--     to philip's nex_account.
--
-- Apply ONLY on explicit founder authorisation:
--     psql $NEX_POSTGRES_URL -v ON_ERROR_STOP=1 -1 \
--       -f scripts/_review-hammerex-products-bespoke-relabel.sql
--
-- Verify after apply:
--   SELECT id, origin, bespoke_for_account_id, is_purchasable,
--          catalogue_price_minor, catalogue_price_currency
--     FROM nex_chat_theme
--    WHERE id = 'hammerex-products';
--      → expect origin='bespoke'; bespoke_for_account_id set;
--        is_purchasable=false; catalogue_price_* still NULL.
--   SELECT theme_id, account_id, price_minor, currency, paid_at
--     FROM nex_theme_commission
--    WHERE theme_id = 'hammerex-products';
--      → expect 1 row · 10000 EUR · paid_at NULL · evidence_note set.
--   SELECT theme_id, account_id, acquired_via, purchase_id
--     FROM nex_theme_ownership
--    WHERE theme_id = 'hammerex-products';
--      → expect 1 row · acquired_via='bespoke' · purchase_id NULL.
--
-- Rollback (destructive · founder-authorised only):
--   BEGIN;
--     DELETE FROM nex_theme_ownership
--      WHERE theme_id = 'hammerex-products' AND acquired_via = 'bespoke';
--     DELETE FROM nex_theme_commission
--      WHERE theme_id = 'hammerex-products';
--     UPDATE nex_chat_theme
--        SET origin = 'premium_ready_made',
--            bespoke_for_account_id = NULL
--      WHERE id = 'hammerex-products';
--   COMMIT;
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_philip_id uuid;
BEGIN
  -- Resolve philip's nex_account via the sealed sentinel business slug
  -- 'nex-10842' (the exact same resolution scripts/seed-hammerexproducts.mjs
  -- uses).
  SELECT a.id INTO v_philip_id
    FROM nex_account a
    JOIN nex_business b ON b.owner_account_id = a.id
   WHERE b.slug = 'nex-10842'
   LIMIT 1;
  IF v_philip_id IS NULL THEN
    RAISE EXCEPTION 'precondition failed: founder sentinel nex-10842 not found';
  END IF;

  -- Theme row must exist from the Hammerex seed.
  IF NOT EXISTS (SELECT 1 FROM nex_chat_theme WHERE id = 'hammerex-products') THEN
    RAISE EXCEPTION 'precondition failed: nex_chat_theme.hammerex-products not present';
  END IF;

  -- Migration 191 columns must exist (defensive check for prerequisite).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'nex_chat_theme' AND column_name = 'origin'
  ) THEN
    RAISE EXCEPTION 'precondition failed: migration 191 (nex_chat_theme.origin column) not applied';
  END IF;

  -- Prerequisite tables for commission + ownership.
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'nex_theme_commission' AND relkind = 'r') THEN
    RAISE EXCEPTION 'precondition failed: migration 192 (nex_theme_commission) not applied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'nex_theme_ownership'  AND relkind = 'r') THEN
    RAISE EXCEPTION 'precondition failed: migration 194 (nex_theme_ownership) not applied';
  END IF;

  -- 1. Relabel the theme row.
  UPDATE nex_chat_theme
     SET origin                 = 'bespoke',
         bespoke_for_account_id = v_philip_id,
         updated_at             = now()
   WHERE id = 'hammerex-products';

  -- 2. Record the historical commission. Idempotent on (theme_id, account_id).
  INSERT INTO nex_theme_commission
    (theme_id, account_id, price_minor, currency, paid_at, evidence_note)
  VALUES
    ('hammerex-products', v_philip_id, 10000, 'EUR', NULL,
     'Historical commission paid by owner for bespoke theme creation (€100.00). Exact transaction date not on record · paid_at left NULL to avoid fabricated evidence.')
  ON CONFLICT (theme_id, account_id) DO NOTHING;

  -- 3. Record the owner's permanent bespoke ownership. Idempotent on
  --    (theme_id, account_id). purchase_id is NULL (bespoke, not purchase).
  INSERT INTO nex_theme_ownership
    (theme_id, account_id, acquired_via, purchase_id)
  VALUES
    ('hammerex-products', v_philip_id, 'bespoke', NULL)
  ON CONFLICT (theme_id, account_id) DO NOTHING;

  RAISE NOTICE 'hammerex-products relabel complete · owner=%', v_philip_id;
END $$;

COMMIT;
