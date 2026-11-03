-- ============================================================================
-- NEX-native Migration 257 · Independent Shop + Vault entitlements
-- ============================================================================
-- Owner-authorised 2026-11-02 (DECISIONS ONLY · application separate).
-- Author: Claude.
--
-- Adds 9 nullable columns to nex_account, 2 table-level CHECK constraints,
-- 3 partial indexes, and backfills exactly 2 known internal bisnis accounts.
--
-- Prerequisites (verified at Part 0): 046, 207, 224.
-- Numbering: 255 and 256 are taken; this is the next free slot.
--
-- External conflict (not resolved here): migration 214 must be amended with
-- IF NOT EXISTS on business_trial_status BEFORE 214 is ever applied.
--
-- Does NOT cover: refunds / chargebacks / manual revocation (see owner
-- revocation-mechanism review · separate follow-up migration 258 proposed).
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(257000001);

-- ---------------------------------------------------------------------------
-- Part 0 · pre-flight guards
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '257') THEN
    RAISE EXCEPTION 'Migration 257 already recorded in nex_migration_history. Aborting.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '046') THEN
    RAISE EXCEPTION 'Prerequisite migration 046 missing.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '207') THEN
    RAISE EXCEPTION 'Prerequisite migration 207 missing (needed for vault_trial_used_at).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '224') THEN
    RAISE EXCEPTION 'Prerequisite migration 224 missing (needed for is_mock_persona).';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Part 1 · EXACT-definition validation for every pre-existing target object
-- Aborts the transaction on any drift. Nothing is silently replaced.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_col record;
  v_check_defs text[];
  v_expected_check text;
  v_actual_constraint_def text;
  v_actual_index_def text;
  v_expected_index_def text;
BEGIN
  -- 1.1 · validate each pre-existing column
  FOR v_col IN
    SELECT c.column_name, c.data_type, c.is_nullable, c.column_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'nex_account'
      AND c.column_name IN (
        'shop_tier','shop_period_end','shop_status','shop_past_due_at',
        'vault_tier','vault_period_end','vault_status','vault_past_due_at',
        'business_trial_status'
      )
  LOOP
    -- Type + nullability
    IF v_col.column_name IN ('shop_tier','shop_status','vault_tier','vault_status','business_trial_status') THEN
      IF v_col.data_type <> 'text' OR v_col.is_nullable <> 'YES' THEN
        RAISE EXCEPTION 'Pre-existing column nex_account.% has wrong type/nullability (type=%, nullable=%).',
          v_col.column_name, v_col.data_type, v_col.is_nullable;
      END IF;
    ELSIF v_col.column_name IN ('shop_period_end','vault_period_end','shop_past_due_at','vault_past_due_at') THEN
      IF v_col.data_type <> 'timestamp with time zone' OR v_col.is_nullable <> 'YES' THEN
        RAISE EXCEPTION 'Pre-existing column nex_account.% has wrong type/nullability (type=%, nullable=%).',
          v_col.column_name, v_col.data_type, v_col.is_nullable;
      END IF;
    END IF;

    -- No DEFAULT expected
    IF v_col.column_default IS NOT NULL THEN
      RAISE EXCEPTION 'Pre-existing column nex_account.% has unexpected DEFAULT %. Expected: no DEFAULT.',
        v_col.column_name, v_col.column_default;
    END IF;

    -- CHECK constraints · collect every CHECK on this column
    SELECT array_agg(pg_get_constraintdef(co.oid) ORDER BY co.conname)
      INTO v_check_defs
    FROM pg_constraint co
    JOIN pg_attribute a ON a.attnum = ANY(co.conkey) AND a.attrelid = co.conrelid
    WHERE co.conrelid = 'public.nex_account'::regclass
      AND co.contype = 'c'
      AND a.attname = v_col.column_name;

    v_expected_check := CASE v_col.column_name
      WHEN 'shop_tier' THEN
        'CHECK (((shop_tier = ANY (ARRAY[''standard''::text, ''unlimited''::text])) OR (shop_tier IS NULL)))'
      WHEN 'shop_status' THEN
        'CHECK (((shop_status = ANY (ARRAY[''active''::text, ''past_due''::text, ''grace''::text, ''cancelled''::text, ''expired''::text])) OR (shop_status IS NULL)))'
      WHEN 'vault_tier' THEN
        'CHECK (((vault_tier = ANY (ARRAY[''gratis''::text, ''5gb''::text, ''25gb''::text, ''50gb''::text, ''100gb''::text])) OR (vault_tier IS NULL)))'
      WHEN 'vault_status' THEN
        'CHECK (((vault_status = ANY (ARRAY[''active''::text, ''past_due''::text, ''grace''::text, ''cancelled''::text, ''expired''::text])) OR (vault_status IS NULL)))'
      WHEN 'business_trial_status' THEN
        'CHECK (((business_trial_status = ANY (ARRAY[''active''::text, ''converted''::text, ''expired''::text])) OR (business_trial_status IS NULL)))'
      ELSE NULL
    END;

    IF v_expected_check IS NOT NULL
       AND (v_check_defs IS NULL OR NOT (v_check_defs @> ARRAY[v_expected_check]))
    THEN
      RAISE EXCEPTION 'Column nex_account.% missing or has wrong CHECK. Found: %. Expected to contain: %.',
        v_col.column_name, v_check_defs, v_expected_check;
    END IF;
  END LOOP;

  -- 1.2 · validate pre-existing table-level CHECK constraints
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'nex_account_shop_tier_requires_expiry'
               AND conrelid = 'public.nex_account'::regclass) THEN
    SELECT pg_get_constraintdef(oid) INTO v_actual_constraint_def
    FROM pg_constraint
    WHERE conname = 'nex_account_shop_tier_requires_expiry'
      AND conrelid = 'public.nex_account'::regclass;
    IF v_actual_constraint_def <>
       'CHECK (((shop_tier IS NULL) OR ((shop_period_end IS NOT NULL) AND (shop_status IS NOT NULL))))'
    THEN
      RAISE EXCEPTION 'nex_account_shop_tier_requires_expiry has wrong definition: %.',
        v_actual_constraint_def;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'nex_account_vault_tier_requires_expiry'
               AND conrelid = 'public.nex_account'::regclass) THEN
    SELECT pg_get_constraintdef(oid) INTO v_actual_constraint_def
    FROM pg_constraint
    WHERE conname = 'nex_account_vault_tier_requires_expiry'
      AND conrelid = 'public.nex_account'::regclass;
    IF v_actual_constraint_def <>
       'CHECK (((vault_tier IS NULL) OR (vault_tier = ''gratis''::text) OR ((vault_period_end IS NOT NULL) AND (vault_status IS NOT NULL))))'
    THEN
      RAISE EXCEPTION 'nex_account_vault_tier_requires_expiry has wrong definition: %.',
        v_actual_constraint_def;
    END IF;
  END IF;

  -- 1.3 · validate pre-existing indexes via FULL pg_get_indexdef comparison
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_nex_account_shop_active') THEN
    SELECT pg_get_indexdef(i.indexrelid) INTO v_actual_index_def
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'idx_nex_account_shop_active';
    v_expected_index_def :=
      'CREATE INDEX idx_nex_account_shop_active ON public.nex_account '
      || 'USING btree (shop_status, shop_period_end) '
      || 'WHERE ((shop_tier IS NOT NULL) AND (shop_status = ANY (ARRAY[''active''::text, ''past_due''::text, ''grace''::text])))';
    IF v_actual_index_def <> v_expected_index_def THEN
      RAISE EXCEPTION 'idx_nex_account_shop_active has wrong definition. Got: % Expected: %.',
        v_actual_index_def, v_expected_index_def;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_nex_account_vault_active') THEN
    SELECT pg_get_indexdef(i.indexrelid) INTO v_actual_index_def
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'idx_nex_account_vault_active';
    v_expected_index_def :=
      'CREATE INDEX idx_nex_account_vault_active ON public.nex_account '
      || 'USING btree (vault_status, vault_period_end) '
      || 'WHERE ((vault_tier IS NOT NULL) AND (vault_tier <> ''gratis''::text) '
      || 'AND (vault_status = ANY (ARRAY[''active''::text, ''past_due''::text, ''grace''::text])))';
    IF v_actual_index_def <> v_expected_index_def THEN
      RAISE EXCEPTION 'idx_nex_account_vault_active has wrong definition. Got: % Expected: %.',
        v_actual_index_def, v_expected_index_def;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_nex_account_business_trial_active') THEN
    SELECT pg_get_indexdef(i.indexrelid) INTO v_actual_index_def
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'idx_nex_account_business_trial_active';
    v_expected_index_def :=
      'CREATE INDEX idx_nex_account_business_trial_active ON public.nex_account '
      || 'USING btree (business_trial_status) '
      || 'WHERE (business_trial_status = ''active''::text)';
    IF v_actual_index_def <> v_expected_index_def THEN
      RAISE EXCEPTION 'idx_nex_account_business_trial_active has wrong definition. Got: % Expected: %.',
        v_actual_index_def, v_expected_index_def;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Part 2 · ADD 9 columns · all idempotent · all nullable · no DEFAULT
-- ---------------------------------------------------------------------------
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS shop_tier text
    CHECK (shop_tier IN ('standard','unlimited') OR shop_tier IS NULL),
  ADD COLUMN IF NOT EXISTS shop_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS shop_status text
    CHECK (shop_status IN ('active','past_due','grace','cancelled','expired') OR shop_status IS NULL),
  ADD COLUMN IF NOT EXISTS shop_past_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS vault_tier text
    CHECK (vault_tier IN ('gratis','5gb','25gb','50gb','100gb') OR vault_tier IS NULL),
  ADD COLUMN IF NOT EXISTS vault_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS vault_status text
    CHECK (vault_status IN ('active','past_due','grace','cancelled','expired') OR vault_status IS NULL),
  ADD COLUMN IF NOT EXISTS vault_past_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS business_trial_status text
    CHECK (business_trial_status IN ('active','converted','expired') OR business_trial_status IS NULL);

-- ---------------------------------------------------------------------------
-- Part 3 · table-level CHECK constraints · guarded by existence
-- (Part 1 already validated the definition if the constraint pre-existed.)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'nex_account_shop_tier_requires_expiry'
                   AND conrelid = 'public.nex_account'::regclass) THEN
    ALTER TABLE nex_account
      ADD CONSTRAINT nex_account_shop_tier_requires_expiry CHECK (
        shop_tier IS NULL
        OR (shop_period_end IS NOT NULL AND shop_status IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'nex_account_vault_tier_requires_expiry'
                   AND conrelid = 'public.nex_account'::regclass) THEN
    ALTER TABLE nex_account
      ADD CONSTRAINT nex_account_vault_tier_requires_expiry CHECK (
        vault_tier IS NULL
        OR vault_tier = 'gratis'
        OR (vault_period_end IS NOT NULL AND vault_status IS NOT NULL)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Part 4 · column comments
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN nex_account.shop_tier IS
  'NEX Shop package. standard=€19.99 · unlimited=€29.99. NULL=no sub. Independent from vault_tier.';
COMMENT ON COLUMN nex_account.shop_period_end IS
  'Last-paid Stripe current_period_end for Shop. Grace cutoff = this + 30 days. Code enforces the ceiling.';
COMMENT ON COLUMN nex_account.shop_status IS
  'active|past_due|grace|cancelled|expired. Webhook-driven. Status alone never grants access.';
COMMENT ON COLUMN nex_account.shop_past_due_at IS
  'Timestamp of first invoice.payment_failed. Enables 7-day retry window to extend past period_end. Monotonic: once set, never regresses.';
COMMENT ON COLUMN nex_account.vault_tier IS
  'NEX Vault storage: 5gb/25gb/50gb/100gb (paid) · gratis (trial) · NULL (no sub). Independent from shop_tier.';
COMMENT ON COLUMN nex_account.vault_period_end IS
  'Last-paid Vault current_period_end. 30-day grace per sealed Vault B4.';
COMMENT ON COLUMN nex_account.vault_status IS
  'Lifecycle · same semantics as shop_status.';
COMMENT ON COLUMN nex_account.vault_past_due_at IS
  '7-day Vault retry anchor. Same monotonic semantics as shop_past_due_at.';
COMMENT ON COLUMN nex_account.business_trial_status IS
  'Reconciles with migration 214 code. 214 must be amended with IF NOT EXISTS before 214 is applied.';

-- ---------------------------------------------------------------------------
-- Part 5 · partial indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_nex_account_shop_active
  ON nex_account (shop_status, shop_period_end)
  WHERE shop_tier IS NOT NULL AND shop_status IN ('active','past_due','grace');

CREATE INDEX IF NOT EXISTS idx_nex_account_vault_active
  ON nex_account (vault_status, vault_period_end)
  WHERE vault_tier IS NOT NULL AND vault_tier != 'gratis' AND vault_status IN ('active','past_due','grace');

CREATE INDEX IF NOT EXISTS idx_nex_account_business_trial_active
  ON nex_account (business_trial_status)
  WHERE business_trial_status = 'active';

-- ---------------------------------------------------------------------------
-- Part 6 · backfill 2 internal bisnis accounts · HARD precondition verification
-- Expected values are a snapshot of 2026-11-02 canonical state. If the mock
-- persona's expiry is intentionally refreshed, this migration DELIBERATELY
-- fails and requires owner re-authorisation with updated sentinels.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_total_bisnis int;
  v_bisnis_with_expiry int;
  v_sentinel_count int;
  v_dated_count int;
  v_sentinel_expiry timestamptz := '9999-12-31T00:00:00+00:00';
  v_dated_expiry_expected timestamptz := '2027-10-27T22:32:30.372842+00:00';
BEGIN
  SELECT COUNT(*) INTO v_total_bisnis
  FROM nex_account WHERE tier = 'bisnis';
  IF v_total_bisnis <> 2 THEN
    RAISE EXCEPTION 'Backfill precondition failed: expected exactly 2 bisnis accounts, found %. Aborting.',
      v_total_bisnis;
  END IF;

  SELECT COUNT(*) INTO v_bisnis_with_expiry
  FROM nex_account WHERE tier = 'bisnis' AND bisnis_expires_at IS NOT NULL;
  IF v_bisnis_with_expiry <> 2 THEN
    RAISE EXCEPTION 'Backfill precondition failed: expected both bisnis accounts to have populated bisnis_expires_at, found % with expiry.',
      v_bisnis_with_expiry;
  END IF;

  SELECT COUNT(*) INTO v_sentinel_count
  FROM nex_account WHERE tier = 'bisnis' AND bisnis_expires_at = v_sentinel_expiry;
  IF v_sentinel_count <> 1 THEN
    RAISE EXCEPTION 'Backfill precondition failed: expected exactly 1 bisnis account with forever-sentinel expiry (%), found %.',
      v_sentinel_expiry, v_sentinel_count;
  END IF;

  SELECT COUNT(*) INTO v_dated_count
  FROM nex_account WHERE tier = 'bisnis' AND bisnis_expires_at = v_dated_expiry_expected;
  IF v_dated_count <> 1 THEN
    RAISE EXCEPTION 'Backfill precondition failed: expected exactly 1 bisnis account with dated expiry %, found %. Owner must re-verify current canonical state and reauthorise this migration with updated sentinels if dates have changed.',
      v_dated_expiry_expected, v_dated_count;
  END IF;
END $$;

-- Snapshot bisnis_expires_at BEFORE the UPDATE so we can prove the
-- original Business expiry values are preserved by the post-check.
CREATE TEMP TABLE _nex_257_pre_backfill_snapshot
  ON COMMIT DROP
AS SELECT id, bisnis_expires_at
   FROM nex_account WHERE tier = 'bisnis';

UPDATE nex_account
SET
  shop_tier       = 'unlimited',
  shop_period_end = bisnis_expires_at,
  shop_status     = 'active'
WHERE
  tier = 'bisnis'
  AND bisnis_expires_at IS NOT NULL
  AND shop_tier IS NULL;

DO $$
DECLARE
  v_migrated int;
  v_bad_tier int;
  v_bad_status int;
  v_bad_period_end int;
  v_bad_original_expiry int;
  v_mismatch_count int;
BEGIN
  -- Post-check 1: exactly 2 rows now have shop_tier='unlimited'
  SELECT COUNT(*) INTO v_migrated
  FROM nex_account WHERE tier='bisnis' AND shop_tier='unlimited';
  IF v_migrated <> 2 THEN
    RAISE EXCEPTION 'Backfill post-check 1 failed: expected 2 rows with shop_tier=unlimited, found %.',
      v_migrated;
  END IF;

  -- Post-check 2: every bisnis row has shop_tier='unlimited' (no missed row)
  SELECT COUNT(*) INTO v_bad_tier
  FROM nex_account WHERE tier='bisnis' AND shop_tier IS DISTINCT FROM 'unlimited';
  IF v_bad_tier <> 0 THEN
    RAISE EXCEPTION 'Backfill post-check 2 failed: % bisnis rows have shop_tier not unlimited.',
      v_bad_tier;
  END IF;

  -- Post-check 3: every bisnis row has shop_status='active'
  SELECT COUNT(*) INTO v_bad_status
  FROM nex_account WHERE tier='bisnis' AND shop_status IS DISTINCT FROM 'active';
  IF v_bad_status <> 0 THEN
    RAISE EXCEPTION 'Backfill post-check 3 failed: % bisnis rows have shop_status not active.',
      v_bad_status;
  END IF;

  -- Post-check 4: every bisnis row has shop_period_end = its own bisnis_expires_at
  SELECT COUNT(*) INTO v_bad_period_end
  FROM nex_account
  WHERE tier='bisnis' AND shop_period_end IS DISTINCT FROM bisnis_expires_at;
  IF v_bad_period_end <> 0 THEN
    RAISE EXCEPTION 'Backfill post-check 4 failed: % bisnis rows have shop_period_end != bisnis_expires_at.',
      v_bad_period_end;
  END IF;

  -- Post-check 5: original bisnis_expires_at values are preserved
  -- (migration did NOT touch bisnis_expires_at · snapshot-based verification)
  SELECT COUNT(*) INTO v_bad_original_expiry
  FROM nex_account a
  JOIN _nex_257_pre_backfill_snapshot s ON s.id = a.id
  WHERE a.tier = 'bisnis'
    AND a.bisnis_expires_at IS DISTINCT FROM s.bisnis_expires_at;
  IF v_bad_original_expiry <> 0 THEN
    RAISE EXCEPTION 'Backfill post-check 5 failed: % bisnis rows have bisnis_expires_at changed from pre-update value.',
      v_bad_original_expiry;
  END IF;

  -- Post-check 6: no non-bisnis account was accidentally updated
  SELECT COUNT(*) INTO v_mismatch_count
  FROM nex_account WHERE shop_tier='unlimited' AND tier IS DISTINCT FROM 'bisnis';
  IF v_mismatch_count <> 0 THEN
    RAISE EXCEPTION 'Backfill post-check 6 failed: % non-bisnis accounts have shop_tier=unlimited.',
      v_mismatch_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Part 7 · ledger write · ONLY after all pre/post checks have passed
-- ---------------------------------------------------------------------------
INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '257',
  NOW(),
  'nex_account · independent Shop + Vault entitlements · 9 columns, 2 CHECK, 3 partial indexes · backfill of exactly 2 bisnis accounts to shop_tier=unlimited',
  'Owner-authorised 2026-11-02. Prerequisites: 046, 207, 224. Advisory-lock protected. Exact-definition pre-flight validator aborts on drift. Hard precondition + post-check on backfill (expects exactly 2 bisnis rows with sentinel+dated expiries). 7-day retry extended via shop_past_due_at + vault_past_due_at. 214 compatibility requires IF NOT EXISTS amendment before 214 applies. Does NOT include revocation columns · see follow-up migration 258 proposal before Stripe webhook ships.'
);

COMMIT;
