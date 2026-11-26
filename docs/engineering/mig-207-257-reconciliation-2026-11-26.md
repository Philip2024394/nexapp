# Mig 207 + 257 · Ground-Truth Reconciliation Plan

**Sealed**: 2026-11-26 · **Status**: AWAITING OWNER APPROVAL ·
**Author**: Claude

Per Founder directive 2026-11-25 strict-completion rule 6:

> "mig 207/257 ground-truth is AUTHORITATIVE · stop at approval
>  checkpoint no fabrication."

This document surfaces the actual sandbox-DB state vs. the migration
files as authored. It proposes a reconciliation path. It does NOT
apply anything. The owner must choose Option A, B, or C and issue
the approval trigger before any migration runs.

## 1 · Ground truth · sandbox `kdstoyyeygcopkogqsyv` · 2026-11-26 01:50 SEAST

### 1.1 · Migration history table (`nex_migration_history`)

Applied versions in the 200-299 range:

```
202, 204, 206, 213, 217, 218, 219, 220, 221, 222, 223, 224,
235, 236, 237, 238, 239, 240, 241, 242,
252, 253, 254,
274,
290, 291, 292, 293, 294, 295, 296, 297, 298, 299
```

**Missing from history that the files exist for**: 200, 201, 203, 205,
**207**, 208, 209, 251, 255, 256, **257**, 258, 259. The history table
is DEMONSTRABLY INCOMPLETE — several columns these numbers introduced
are actually present in the schema (see §1.2). This means at some
point past migrations were applied via a path that did not insert
into `nex_migration_history`.

### 1.2 · Mig 207 schema state

Migration file `nex-supabase/migrations/207_nex_onboarding_and_vault_trial.sql`
adds three nullable columns to `nex_account`:

| Column | Expected (file) | Actual (sandbox) | Match |
|---|---|---|---|
| `onboarding_step` | text, default `'chat_theme'` | text, default `'chat_theme'::text` | ✅ |
| `shop_theme_id` | text | text | ✅ |
| `vault_trial_used_at` | timestamptz | timestamp with time zone | ✅ |

**Conclusion**: schema is FULLY applied. Only the history row is
missing.

### 1.3 · Mig 257 schema state

Migration file `nex-supabase/migrations/257_nex_account_independent_shop_vault_entitlements.sql`
is 420 lines long. It adds 9 columns + 2 CHECK constraints + 3
partial indexes to `nex_account`, plus backfills 2 known internal
bisnis accounts.

| Column from mig 257 | Present in sandbox? |
|---|---|
| `shop_tier` | ✅ present (text, nullable) |
| `shop_period_end` | ❌ MISSING |
| `shop_status` | ❌ MISSING |
| `shop_past_due_at` | ❌ MISSING |
| `vault_tier` | ❌ MISSING |
| `vault_period_end` | ❌ MISSING |
| `vault_status` | ❌ MISSING |
| `vault_past_due_at` | ❌ MISSING |
| `business_trial_status` | ✅ present (text, nullable) |

| CHECK constraints from mig 257 | Present? |
|---|---|
| `nex_account_shop_tier_check` | ✅ present |
| `nex_account_business_trial_status_check` | ✅ present |

| Indexes from mig 257 | Present? |
|---|---|
| `idx_nex_account_shop_tier` | ✅ present |
| `idx_nex_account_vault_tier` (implied by file) | ❌ MISSING |
| `idx_nex_account_shop_past_due` (implied) | ❌ MISSING |

**Conclusion**: mig 257 is **PARTIALLY APPLIED**. Two of nine columns
and their constraints/indexes exist; seven columns and their
constraints/indexes do not. The schema is in a **split state**.

### 1.4 · Pre-flight guards blocking a clean 257 re-run

If someone ran mig 257 today, Part 0 (lines 28-42) would abort
immediately at:

```sql
IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '046')
  THEN RAISE EXCEPTION 'Prerequisite migration 046 missing.'
```

Mig 046 is likely applied in the schema but the history row is
missing, so this guard rejects a full re-run. The guards exist
precisely to prevent accidental partial double-application.

## 2 · What this means for launch readiness

The strict-completion banned-phrase rule applies: "launch-ready" is
BANNED while the 207/257 drift is unreconciled. Features that lean
on the missing columns will fail at runtime:

- `vault_tier` column read in
  `src/lib/nex-native/vault/*` (Cycle 14 F1 entitlement gate) — the
  gate currently relies on `vault_trial_used_at` (present) alone;
  the authoritative paid-tier source `vault_tier` does NOT exist in
  sandbox DB and any code reading it will throw.
- `shop_status` / `shop_period_end` / `shop_past_due_at` — the shop
  past-due dunning logic cannot read these.
- `vault_status` / `vault_period_end` / `vault_past_due_at` — same
  for vault dunning.

An audit of code call-sites referencing these column names is listed
in §5 below.

## 3 · Reconciliation options · Owner picks one

### Option A · Additive delta migration (`260_nex_entitlements_delta.sql`)

1. Author a new migration file `260_nex_entitlements_delta.sql` that
   only adds the 7 missing columns + 2 missing indexes + their 2
   constraints.
2. Record `207` and `257` in `nex_migration_history` as applied with
   an explicit `applied_via = 'retroactive_reconciliation_260'`
   note column (requires one-time column add).
3. Apply `260` in sandbox under named approval.
4. Pre-flight guards for any future migration that depends on 207 or
   257 will pass because history rows now exist.

**Pros**: smallest delta, safest; no risk of re-adding existing
columns; preserves the sealed guard discipline for future migrations.

**Cons**: adds one more migration number; requires authoring and
review.

### Option B · Teardown + full re-run of 257

1. Amend the Part 0 guard in 257 to detect the partial state and
   either (a) skip steps that are already present, or (b) drop them
   and re-add atomically.
2. Clear the `shop_tier` / `business_trial_status` columns of any
   non-fixture rows first (to avoid CHECK constraint violations on
   re-add).
3. Re-run the amended 257.

**Pros**: keeps the numbering clean; mig 257 becomes the canonical
source again.

**Cons**: amending a sealed migration file after partial application
breaks the "migration files are append-only" discipline. Also
requires touching real account rows that may have `shop_tier`
values set; losing those values is unacceptable without a backfill
plan. **Not recommended.**

### Option C · History-only reconciliation + accept schema drift

1. Insert `('207')` and `('257')` into `nex_migration_history`
   manually (with a fresh `applied_at`) and leave the 7 missing
   columns unresolved.
2. Any feature that needs the missing columns gets its OWN new
   additive migration later.

**Pros**: zero schema change.

**Cons**: the "migration file" is no longer a faithful record of
what ran. Any future developer reading mig 257 will assume the 7
columns exist. **Dishonest.** Only acceptable if the owner decides
those columns are permanently out of scope.

## 4 · Recommendation

**Option A.** Smallest, most honest, most reversible. Does not touch
existing data. Preserves the sealed guard discipline. Produces one
new migration file (`260`) that any reviewer can audit in isolation.

## 5 · Audit checkpoint before the owner decides

Before approving Option A, the owner should see a code audit of
every call site that reads the 7 missing columns. If no call site
actually reads them yet, Option C has a stronger case (yagni);
if any call site reads them, Option A is required.

**Call-site survey** (run ahead of approval):

```
rg -g '*.ts' -g '*.tsx' \
   -e 'shop_period_end' -e 'shop_status' -e 'shop_past_due_at' \
   -e 'vault_tier' -e 'vault_period_end' -e 'vault_status' \
   -e 'vault_past_due_at' \
   src/
```

(Deferred to the approval cycle — not run here because the fix is
different under each option.)

## 6 · What this document explicitly DOES NOT do

- Does NOT apply any migration.
- Does NOT insert history rows.
- Does NOT modify `nex_account` data.
- Does NOT amend mig 257.
- Does NOT touch production (sandbox-only inspection; guard
  `assertSandboxRef` enforces this).

## 7 · Call-site survey · columns used in production code

Run against `src/` on 2026-11-26. Only non-test production files.

### 7.1 · `vault_tier` · LOAD-BEARING · 3 production sites

| File:Line | Operation |
|---|---|
| `src/app/nex-native/vault/page.tsx:65` | `SELECT vault_tier, vault_trial_used_at FROM nex_account` |
| `src/app/nex-native/vault/page.tsx:73` | reads `row.vault_tier` into `vaultTier` |
| `src/lib/nex-native/vault/vault-service.ts:23,39` | entitlement decision: `account.vault_tier && account.vault_tier !== "gratis"` |

The file at `vault/page.tsx:54-58` carries an explicit comment
acknowledging "If `vault_tier` is absent (mig 257 not yet applied…)"
and the code path tolerates NULL by returning the `vault_trial_used_at`-
only answer. So the Vault page does NOT throw today, but it ALSO
cannot ever grant paid-tier access until `vault_tier` exists.

### 7.2 · `shop_status`, `shop_period_end`, `shop_past_due_at`, `vault_status`, `vault_period_end`, `vault_past_due_at` · dynamic writer

Grep'd literally finds no matches outside tests. **BUT** the actual
write path is dynamic, built via template-string concatenation at:

```
src/lib/nex-native/billing/supabase-store.ts:470-501
  updateProductSubscription(accountId, product, patch)
    SETs: `${prefix}_tier` · `${prefix}_status` · `${prefix}_period_end`
           · `${prefix}_past_due_at` · `${prefix}_stripe_customer_id`
           · `${prefix}_stripe_subscription_id` · `${prefix}_stripe_price_id`
    where prefix ∈ { "shop", "vault" }
```

The webhook processor (`webhook-processor.ts`, 1064 lines) calls this
when a Stripe subscription event arrives. If the 7 missing columns do
not exist, the UPDATE throws at the DB with an unknown-column error.

**Material consequence**: once `STRIPE_WEBHOOK_SECRET` is configured
and the first real Shop / Vault subscription event lands, the webhook
processor will 500 with `column "shop_status" does not exist` (or
similar) **until mig 207/257 drift is reconciled**. Negative-path
tests cover unsigned / bad-sig / missing-config today; the positive-
path exercise (once creds arrive) would surface this at first fire.

### 7.3 · `${prefix}_stripe_customer_id` / `_subscription_id` / `_price_id`

**Not defined by mig 257.** These three columns are expected by
`supabase-store.ts:489-494` but are NOT in the mig 257 schema. They
are likely defined by the proposed mig 258 (billing foundation).
Mig 258 is a separate concern from this reconciliation; flagged here
so the owner is aware there is a SECOND schema dependency the webhook
processor needs and this plan does NOT address.

### 7.4 · `business_trial_status` · PRESENT today

Mig 257 added `business_trial_status` as nullable text with CHECK. The
sandbox schema has this column already. Separate from the 7 missing.
Mig 214 collision note persists (see §12 destructive-risk below).

## 8 · Precise proposed correction · per option

### 8.1 · Option A · additive delta `260_nex_entitlements_delta.sql`

File skeleton (NOT yet written; will be authored only on approval):

```sql
BEGIN;
SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(260000001);

-- Part 0 · pre-flight guards reflecting the actual history gap
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '260') THEN
    RAISE EXCEPTION 'Migration 260 already recorded.';
  END IF;
  -- Deliberately skip the 046/207/224 history-row checks because the
  -- history table is known-incomplete (see §1.1). Rely on COLUMN
  -- EXISTENCE as the real pre-condition instead:
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_account'
      AND column_name='shop_tier'
  ) THEN
    RAISE EXCEPTION 'Prerequisite column shop_tier missing — mig 257 Part 2 must run first.';
  END IF;
END $$;

-- Part 1 · add the 7 missing columns (IF NOT EXISTS · nullable · no DEFAULT)
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS shop_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS shop_status text
    CHECK (shop_status IN ('active','past_due','grace','cancelled','expired') OR shop_status IS NULL),
  ADD COLUMN IF NOT EXISTS shop_past_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS vault_tier text
    CHECK (vault_tier IN ('gratis','5gb','25gb','50gb','100gb') OR vault_tier IS NULL),
  ADD COLUMN IF NOT EXISTS vault_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS vault_status text
    CHECK (vault_status IN ('active','past_due','grace','cancelled','expired') OR vault_status IS NULL),
  ADD COLUMN IF NOT EXISTS vault_past_due_at timestamptz;

-- Part 2 · table-level CHECKs (guarded by existence)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'nex_account_shop_tier_requires_expiry'
                   AND conrelid = 'public.nex_account'::regclass) THEN
    ALTER TABLE nex_account
      ADD CONSTRAINT nex_account_shop_tier_requires_expiry CHECK (
        shop_tier IS NULL
        OR (shop_period_end IS NOT NULL AND shop_status IS NOT NULL)
      ) NOT VALID;  -- NOT VALID because shop_tier already set on 2 bisnis rows
    -- Validate AFTER the bisnis backfill below
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

-- Part 3 · partial indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_nex_account_shop_active
  ON nex_account (shop_status, shop_period_end)
  WHERE shop_tier IS NOT NULL AND shop_status IN ('active','past_due','grace');
CREATE INDEX IF NOT EXISTS idx_nex_account_vault_active
  ON nex_account (vault_status, vault_period_end)
  WHERE vault_tier IS NOT NULL AND vault_tier != 'gratis' AND vault_status IN ('active','past_due','grace');

-- Part 4 · bisnis back-fill continuation
-- Mig 257 Part 6 ran a UPDATE that set shop_tier='unlimited' AND
-- shop_period_end = bisnis_expires_at AND shop_status = 'active'
-- on 2 bisnis rows. In sandbox, shop_tier is set but the two
-- dependent columns do NOT exist today (confirmed §1.3), which means
-- the Part 6 UPDATE either partially succeeded (unlikely given
-- transactional semantics) or ran against a different column set.
-- Either way we must re-run the back-fill against the NEW columns:

UPDATE nex_account
SET
  shop_period_end = bisnis_expires_at,
  shop_status     = 'active'
WHERE
  tier = 'bisnis'
  AND bisnis_expires_at IS NOT NULL
  AND shop_tier = 'unlimited'
  AND (shop_period_end IS NULL OR shop_status IS NULL);

-- Post-check 1 · exactly 2 bisnis rows now have all 3 shop_* columns set
DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM nex_account
  WHERE tier = 'bisnis'
    AND shop_tier = 'unlimited'
    AND shop_status = 'active'
    AND shop_period_end IS NOT NULL;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Mig 260 backfill post-check failed: expected 2 bisnis rows ready, found %.', v_count;
  END IF;
END $$;

-- Part 5 · validate the NOT VALID shop constraint now that back-fill is complete
ALTER TABLE nex_account VALIDATE CONSTRAINT nex_account_shop_tier_requires_expiry;

-- Part 6 · ledger write for mig 260 AND the two retroactive rows for 207 + 257
INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES
  ('207', NOW(), 'RETROACTIVE · mig 207 schema present prior to history-table existence · recorded via mig 260',
          'See docs/engineering/mig-207-257-reconciliation-2026-11-26.md Option A'),
  ('257', NOW(), 'RETROACTIVE · mig 257 was PARTIALLY applied; completed by mig 260',
          'See docs/engineering/mig-207-257-reconciliation-2026-11-26.md Option A'),
  ('260', NOW(), 'nex_account · entitlements delta · completes mig 257 by adding 7 missing columns + 2 indexes + 1 constraint, extends bisnis backfill, retro-records 207+257',
          'Owner-authorised 2026-11-26 Option A. Additive only. No existing data mutated beyond extending bisnis shop_period_end + shop_status (which were targeted by mig 257 Part 6 but columns did not exist).');

COMMIT;
```

### 8.2 · Option B · amend mig 257

Edit `257_nex_account_independent_shop_vault_entitlements.sql` to:
1. Relax Part 0 history-row prerequisite checks to column-existence
   checks (as in Option A).
2. Guard Part 6 UPDATE against the current state (2 bisnis rows
   already have `shop_tier='unlimited'`; the UPDATE's `WHERE shop_tier
   IS NULL` clause already handles this — so it would no-op, which
   would then fail Part 6 post-check 1 that expects exactly 2 rows
   with `shop_tier='unlimited'` (currently satisfied) AND
   `shop_period_end = bisnis_expires_at` (NOT satisfied because the
   column did not exist when that assertion last ran).

Requires editing the sealed file (breaks append-only discipline) and
creates ambiguity for anyone auditing migration history. **Not
recommended.**

### 8.3 · Option C · history-only

Execute:
```sql
INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES
  ('207', NOW(), 'RETROACTIVE · schema already applied', '...'),
  ('257', NOW(), 'RETROACTIVE · schema PARTIALLY applied (7 columns missing · accepted drift)', '...');
```

Does not add the 7 missing columns. Webhook processor writes continue
to throw at the DB. **Only acceptable if owner decides to permanently
retire Vault paid tiers + Shop past-due dunning (very unlikely per
current roadmap).**

## 9 · Additive / destructive / data-affecting classification

### Option A

| Operation | Classification |
|---|---|
| `ADD COLUMN IF NOT EXISTS shop_period_end timestamptz` | **ADDITIVE** · nullable · no DEFAULT · no existing data read or written |
| `ADD COLUMN IF NOT EXISTS shop_status / shop_past_due_at / vault_tier / vault_period_end / vault_status / vault_past_due_at` | **ADDITIVE** · same |
| `ADD CONSTRAINT nex_account_shop_tier_requires_expiry NOT VALID` | **ADDITIVE** · NOT VALID means existing rows are not re-checked until explicit VALIDATE |
| `ADD CONSTRAINT nex_account_vault_tier_requires_expiry` | **ADDITIVE** · vault_tier is NULL on all rows so no existing row is constrained |
| `CREATE INDEX IF NOT EXISTS idx_nex_account_shop_active / _vault_active` | **ADDITIVE** · indexes are observational |
| `UPDATE nex_account SET shop_period_end = bisnis_expires_at, shop_status = 'active' WHERE tier='bisnis' AND shop_tier='unlimited' AND (shop_period_end IS NULL OR shop_status IS NULL)` | **DATA-AFFECTING** · modifies exactly 2 rows · writes NEW columns only · does NOT overwrite any non-NULL value |
| `VALIDATE CONSTRAINT nex_account_shop_tier_requires_expiry` | **DATA-AFFECTING** · validates existing rows against the constraint · will succeed ONLY if the bisnis backfill above ran · rollback-safe: if it fails, COMMIT rolls back |
| 3 ledger INSERTs | **ADDITIVE** · metadata rows |

**Net**: zero destructive operations. One data-affecting write that
only writes to columns that did not exist before this migration.

### Option B

| Operation | Classification |
|---|---|
| Amend a sealed migration file on disk | **ADDITIVE on disk** (edit, not delete) · **DISCIPLINE-BREAKING** (append-only rule) |
| Re-run amended 257 | Same operations as Option A but under 257's identity, PLUS runs 257 Part 1 validator which will warn if sandbox schema pre-conditions differ from the authored expectation |

### Option C

| Operation | Classification |
|---|---|
| 2 ledger INSERTs | **ADDITIVE** |
| No schema change | - |

## 10 · Dependencies and effects on existing Shop, Vault, and account data

### 10.1 · Shop

- Only the 2 bisnis rows touch `shop_tier` today (`='unlimited'`).
- The `shop_tier_check` CHECK constraint already enforces
  `IN ('standard','unlimited') OR NULL` — no change from this migration.
- Shop past-due dunning code at `webhook-processor.ts` currently
  cannot write `shop_status='past_due'` or `shop_past_due_at=NOW()`
  because the columns don't exist. Any attempt would throw at the DB.
  Under Option A, those writes become possible; existing rows are
  unaffected.
- The `idx_nex_account_shop_active` partial index is new; no existing
  index is dropped or renamed.

### 10.2 · Vault

- `vault_tier` is NULL on all rows today (column doesn't exist).
- `vault_trial_used_at` (mig 207) is present and some rows carry
  values. The vault service's entitlement decision favours
  `vault_tier != 'gratis' && != NULL` first and falls back to the
  trial. After Option A, the paid-tier branch becomes exercisable.
- No existing vault data is mutated by Option A.

### 10.3 · Other nex_account rows

- Options A/B do NOT touch non-bisnis rows at all.
- `business_trial_status` column is already present with its CHECK
  constraint. The 214 collision described in mig 257 comments is a
  **separate pending issue** (`214` needs `ADD COLUMN IF NOT EXISTS`
  before it is ever applied). This plan does NOT address mig 214;
  flagged for the owner.

### 10.4 · Billing/webhook integration

- Currently `supabase-store.ts:470-501 updateProductSubscription` can
  write to `shop_tier` (column present) but will throw on
  `shop_status`, `shop_period_end`, `shop_past_due_at`,
  `vault_tier`, `vault_status`, `vault_period_end`, `vault_past_due_at`.
- Additionally expects `shop_stripe_customer_id`, `_subscription_id`,
  `_price_id` (and vault equivalents) which are NOT in mig 257.
  **This is a SECOND dependency**: mig 258 (billing foundation) is
  the authoritative source for those columns. Option A does NOT add
  them; mig 258 is a separate owner-approval cycle.

## 11 · Sandbox verification procedure

**Before apply (snapshot current state)**:
```sql
-- 1. Confirm sandbox ref
SELECT current_database();  -- expected 'postgres' on project kdstoyyeygcopkogqsyv
-- 2. Capture pre-state column list
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='nex_account'
   AND column_name IN ('shop_tier','shop_period_end','shop_status','shop_past_due_at',
                       'vault_tier','vault_period_end','vault_status','vault_past_due_at')
 ORDER BY column_name;
-- 3. Capture bisnis rows
SELECT id, tier, bisnis_expires_at, shop_tier FROM nex_account WHERE tier='bisnis';
-- 4. Capture migration history
SELECT version, applied_at FROM nex_migration_history
 WHERE version IN ('207','257','260') ORDER BY version;
```
Expected pre-state: 2 columns present (`shop_tier`,
`business_trial_status`) · 7 missing · 2 bisnis rows with
`shop_tier='unlimited'` · 0 history rows for 207/257/260.

**Apply** (only on written approval of mig 260 file review):
```
psql "$SANDBOX_DATABASE_URL" -f nex-supabase/migrations/260_nex_entitlements_delta.sql
```
(Note: pooler URL used, with IPv4 guarantee. `$SANDBOX_DATABASE_URL`
must resolve to ref `kdstoyyeygcopkogqsyv` — the sandbox-ref guard in
all test harnesses already enforces this check.)

**After apply (verify end state)**:
```sql
-- 1. All 9 columns present
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name='nex_account'
   AND column_name IN ('shop_tier','shop_period_end','shop_status','shop_past_due_at',
                       'vault_tier','vault_period_end','vault_status','vault_past_due_at','business_trial_status')
 ORDER BY column_name;
-- expected: 9 rows
-- 2. 2 bisnis rows have complete shop state
SELECT id, shop_tier, shop_status, shop_period_end FROM nex_account WHERE tier='bisnis';
-- expected: shop_tier='unlimited' · shop_status='active' · shop_period_end=bisnis_expires_at
-- 3. Indexes present
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='nex_account'
 AND indexname IN ('idx_nex_account_shop_active','idx_nex_account_vault_active');
-- expected: 2 rows
-- 4. Constraints present + validated
SELECT conname, convalidated FROM pg_constraint
 WHERE conrelid='public.nex_account'::regclass
   AND conname IN ('nex_account_shop_tier_requires_expiry','nex_account_vault_tier_requires_expiry');
-- expected: 2 rows, convalidated=true
-- 5. History rows written
SELECT version, applied_at FROM nex_migration_history WHERE version IN ('207','257','260') ORDER BY version;
-- expected: 3 rows
-- 6. Spec rerun
npx playwright test tests/e2e/journey-vault-standalone-access.spec.ts
-- expected: all 6 scenarios now PASS (currently 3 PASS + 3 SKIP under
-- mig 257 absence · 3 formerly-skipped exercise `vault_tier`)
```

Rollback window: BEGIN/COMMIT wraps all of Part 0-6 in a single
transaction. If any post-check fails, COMMIT rolls back cleanly.

## 12 · Destructive-risk assessment

| Risk | Option A | Option B | Option C |
|---|---|---|---|
| Overwrite existing data | None · UPDATE only writes to new columns | Same as A but harder to review | None |
| Drop / rename existing column | None | None | None |
| Drop / rename existing index | None | None | None |
| Rename / drop existing constraint | None | None | None |
| Fail during apply, leaving inconsistent state | Transaction-wrapped; failure = rollback | Same | Trivial |
| Interfere with concurrent writes | `pg_advisory_xact_lock(260000001)` serialises; read path unaffected during write | Same under 257's lock id | n/a |
| Affect production | **NONE · sandbox-only** | Same | Same |
| Mig 214 collision (downstream) | Unchanged (separate issue) | Unchanged | Unchanged |
| Create future auditor confusion | Low · new mig file is self-describing + cross-links this plan | High · sealed file mutated | High · history vs. file disagree |

## 13 · Rollback strategy

### Option A rollback (if post-apply issue discovered within the same
session):

```sql
BEGIN;
-- Reverse the bisnis backfill (columns go back to NULL)
UPDATE nex_account
   SET shop_period_end = NULL, shop_status = NULL
 WHERE tier='bisnis' AND shop_tier='unlimited';
-- Drop the new constraint before the columns (dependency order)
ALTER TABLE nex_account DROP CONSTRAINT IF EXISTS nex_account_shop_tier_requires_expiry;
ALTER TABLE nex_account DROP CONSTRAINT IF EXISTS nex_account_vault_tier_requires_expiry;
-- Drop the new indexes
DROP INDEX IF EXISTS idx_nex_account_shop_active;
DROP INDEX IF EXISTS idx_nex_account_vault_active;
-- Drop the 7 columns (reverse order of ADD)
ALTER TABLE nex_account
  DROP COLUMN IF EXISTS vault_past_due_at,
  DROP COLUMN IF EXISTS vault_status,
  DROP COLUMN IF EXISTS vault_period_end,
  DROP COLUMN IF EXISTS vault_tier,
  DROP COLUMN IF EXISTS shop_past_due_at,
  DROP COLUMN IF EXISTS shop_status,
  DROP COLUMN IF EXISTS shop_period_end;
-- Remove the 3 history rows
DELETE FROM nex_migration_history WHERE version IN ('260','257','207')
  AND notes LIKE '%mig 260%';
COMMIT;
```

The rollback script is **sandbox-only** per the same sandbox-ref
guard. Would require a new named approval; not proposed for automatic
use.

### Option B rollback

Same as Option A plus restoring the pre-edit mig 257 file from git.

### Option C rollback

```sql
DELETE FROM nex_migration_history WHERE version IN ('207','257')
  AND applied_at >= '2026-11-26';
```

## 14 · Production confirmation

- Production Supabase project: `ijvqdvsvwtwxzcqmoqit` (sealed by
  CLAUDE.md §8).
- Sandbox Supabase project: `kdstoyyeygcopkogqsyv`.
- Every DB helper used in test code enforces `assertSandboxRef()`
  which rejects any connection string that does not include the
  sandbox ref.
- This plan **DOES NOT PROPOSE ANY PRODUCTION DATABASE OPERATION**.
- Production will not be touched by Option A/B/C unless the owner
  issues a **separate, explicitly-named production approval** at a
  later gate. CLAUDE.md §5 reaffirms: "Do not manually deploy,
  change deployment project linkage, change production branches,
  alter production environment variables, or apply database
  migrations without separate explicit approval."

## 15 · Approval trigger

Owner must reply with one of:

- `APPROVE OPTION A FILE REVIEW` → Claude authors
  `260_nex_entitlements_delta.sql` exactly as drafted in §8.1, then
  STOPS again for owner review of the actual file BEFORE applying.
  Separate `APPROVE OPTION A APPLY SANDBOX` is required to execute
  against `kdstoyyeygcopkogqsyv`.
- `APPROVE OPTION B` (not recommended) → Claude amends 257, STOPS
  for review; same two-stage gate.
- `APPROVE OPTION C` → Claude writes 2 history rows after a separate
  second confirmation.
- `HOLD` → no action, this doc stands as the record.

Per CLAUDE.md §5 ("Production deployment is a separate gate") and
the sealed migration-approval rule, nothing moves without this
trigger.
