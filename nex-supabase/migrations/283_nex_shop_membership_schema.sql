-- ============================================================================
-- NEX Migration 283 · Shop Entitlement Contract § G schema
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- -- DRAFT · DO NOT APPLY WITHOUT OWNER AUTHORISATION PER CLAUDE.md § 5
--
-- Owner-authored preparation only (Phase 4 Batch 4.6 · 2026-11-06). DO NOT
-- APPLY to the sealed Supabase project `ijvqdvsvwtwxzcqmoqit` without
-- SEPARATE explicit owner authorisation naming this file.
--
-- This migration authors the full § G schema sealed in
-- `docs/doctrine/nex-shop-entitlement-contract-LOCKED-2026-11-06.md`
-- for the Shop Entitlement Contract (Shop membership + Vault bundling +
-- Daily Discovery one-product-per-shop-per-UTC-day rule + Stripe webhook
-- idempotency). B3 of the contract's § H release checklist stays OPEN
-- until this file is explicitly authorised for apply.
--
-- Table of contents (scope of this migration, strictly):
--
--   1. nex_account · ADD COLUMN country_iso2         text   NULL (ISO-2 shape)
--   2. nex_account · ADD COLUMN shop_subscription_id text   NULL
--   3. nex_account · ADD COLUMN vault_tier           text   NULL (free|shop)
--
--   4. nex_business · ADD COLUMN membership_active          boolean NOT NULL DEFAULT false
--   5. nex_business · ADD COLUMN membership_period_end      timestamptz NULL
--   6. nex_business · ADD COLUMN membership_started_at      timestamptz NULL
--   7. nex_business · ADD COLUMN membership_last_webhook_at timestamptz NULL
--
--   8. nex_product · ADD COLUMN discovered_at timestamptz NULL
--      · partial UNIQUE index on (business_id, ((discovered_at AT TIME ZONE 'UTC')::date))
--        WHERE discovered_at IS NOT NULL
--        — enforces one product per shop per UTC day into NEX-wide Daily
--        Discovery per sealed doctrine 2026-11-05 § C-8.
--
--   9. CREATE TABLE nex_webhook_event_log — idempotent Stripe (and future-
--      provider) webhook processing. Service-role only; no public RLS.
--
--  10. nex_migration_history ledger entry.
--
-- Dependencies:
--   · nex_account must exist (migration 001).
--   · nex_business must exist (migration 002).
--   · nex_product  must exist (migration 003).
--   · This migration is numbered 283 because Phase 4 Batch 4.2 took 282
--     for `nex_vault_export_log`. Phase-u merge adds migrations up to 281;
--     283 is the next sequential slot on this worktree (phase-x).
--
-- NOT in scope (deferred to their own migrations):
--   · The SECURITY DEFINER RPC `nex_shop_publish_as_daily_discovery()` and
--     `nex_shop_publish_idempotency` idempotency table — authored in a
--     later batch once the publication flow is wired.
--   · `nex_ledger_entry` / `nex_ledger_line` — separate ledger-design
--     DRAFT per sealed Social Commerce D1 ledger-only pattern.
--   · All application code that READS these columns is deliberately
--     untouched by this migration · wiring happens when B3 closes, in a
--     future authorised batch.
--
-- Backfill (documented at end of file, not executed here):
--   · country_iso2 stays NULL on existing accounts; new signups populate
--     via createNexAccountAction after this lands.
--   · membership_* columns default to the safe "inactive" state.
--   · nex_product.discovered_at stays NULL on pre-Daily-Discovery rows.
--   · nex_webhook_event_log starts empty.
--
-- Rollback (copy-paste if ever needed):
--
--   BEGIN;
--   DO $$ BEGIN
--     IF session_user NOT IN ('postgres','supabase_admin') THEN
--       RAISE EXCEPTION 'Migration 283 rollback REFUSED · session_user=%', session_user;
--     END IF;
--   END $$;
--   DROP POLICY IF EXISTS nex_webhook_event_log_service_all ON public.nex_webhook_event_log;
--   DROP INDEX  IF EXISTS nex_webhook_event_log_by_account_time;
--   DROP INDEX  IF EXISTS nex_webhook_event_log_by_status_received;
--   DROP TABLE  IF EXISTS public.nex_webhook_event_log;
--   DROP INDEX  IF EXISTS nex_product_business_daily_discovery_uniq;
--   ALTER TABLE public.nex_product  DROP COLUMN IF EXISTS discovered_at;
--   ALTER TABLE public.nex_business DROP COLUMN IF EXISTS membership_last_webhook_at;
--   ALTER TABLE public.nex_business DROP COLUMN IF EXISTS membership_started_at;
--   ALTER TABLE public.nex_business DROP COLUMN IF EXISTS membership_period_end;
--   ALTER TABLE public.nex_business DROP COLUMN IF EXISTS membership_active;
--   ALTER TABLE public.nex_account  DROP COLUMN IF EXISTS vault_tier;
--   ALTER TABLE public.nex_account  DROP COLUMN IF EXISTS shop_subscription_id;
--   ALTER TABLE public.nex_account  DROP COLUMN IF EXISTS country_iso2;
--   DELETE FROM public.nex_migration_history WHERE version = '283';
--   COMMIT;
--
-- Risk level: MEDIUM · 8 column adds across 3 existing tables + 1 new
--   table. All columns NULLABLE or DEFAULT-populated · zero exposure
--   change vs today. Reversible, but downstream `SELECT *` callers see
--   new columns immediately on apply.
--
-- ============================================================================

BEGIN;

-- Apply guard · DRAFT (CLAUDE.md § 5 · sealed project ijvqdvsvwtwxzcqmoqit)
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 283 is DRAFT · requires explicit owner authorisation naming this file to apply.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight audit
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Parent tables must exist.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='nex_account'
  ) THEN
    RAISE EXCEPTION 'Migration 283 refused: public.nex_account missing (required parent).';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='nex_business'
  ) THEN
    RAISE EXCEPTION 'Migration 283 refused: public.nex_business missing (required parent).';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='nex_product'
  ) THEN
    RAISE EXCEPTION 'Migration 283 refused: public.nex_product missing (required parent).';
  END IF;

  -- 283 itself must not have been applied (apply-idempotency).
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='nex_webhook_event_log'
  ) THEN
    RAISE EXCEPTION 'Migration 283 refused: public.nex_webhook_event_log already exists. Did you apply 283 already? See `nex_migration_history`.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1–3 · nex_account additions
-- ---------------------------------------------------------------------------

ALTER TABLE public.nex_account
  ADD COLUMN IF NOT EXISTS country_iso2 text NULL;

-- Shape check · ISO-3166 alpha-2 (two uppercase A-Z). NULL remains allowed
-- (existing accounts; new signups populate from `nex_country_hint` cookie).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_account_country_iso2_shape_chk'
  ) THEN
    ALTER TABLE public.nex_account
      ADD CONSTRAINT nex_account_country_iso2_shape_chk
      CHECK (country_iso2 IS NULL OR country_iso2 ~ '^[A-Z]{2}$');
  END IF;
END $$;

ALTER TABLE public.nex_account
  ADD COLUMN IF NOT EXISTS shop_subscription_id text NULL;

ALTER TABLE public.nex_account
  ADD COLUMN IF NOT EXISTS vault_tier text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_account_vault_tier_chk'
  ) THEN
    ALTER TABLE public.nex_account
      ADD CONSTRAINT nex_account_vault_tier_chk
      CHECK (vault_tier IS NULL OR vault_tier IN ('free','shop'));
  END IF;
END $$;

COMMENT ON COLUMN public.nex_account.country_iso2 IS
  'ISO-3166 alpha-2 country code persisted at account creation. Mirrors the `nex_country_hint` cookie into durable storage so entitlement checks need not depend on the cookie. Shape-enforced by nex_account_country_iso2_shape_chk. Backfill plan documented at end of migration 283.';

COMMENT ON COLUMN public.nex_account.shop_subscription_id IS
  'Stripe customer or subscription identifier for Shop membership. Set on first successful Stripe Checkout; cleared on cancel+expiry. NULL when the account has never held a Shop membership.';

COMMENT ON COLUMN public.nex_account.vault_tier IS
  'Explicit Vault tier for entitlement checks: free | shop | NULL (treated as free by the entitlement helper). Fixes the Vault code reference at vault-service.ts:9-35 that previously had no backing column (Vault LOCKED W3 · 2026-10-20).';

-- ---------------------------------------------------------------------------
-- 4–7 · nex_business membership columns (§ G core)
-- ---------------------------------------------------------------------------

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS membership_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS membership_period_end timestamptz NULL;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS membership_started_at timestamptz NULL;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS membership_last_webhook_at timestamptz NULL;

COMMENT ON COLUMN public.nex_business.membership_active IS
  'Primary Shop-entitlement gate. All Shop surfaces (§ C of the Shop Entitlement Contract LOCKED 2026-11-06) read this column. Defaults to false; the shim that upgrades past archived_at reads this value.';

COMMENT ON COLUMN public.nex_business.membership_period_end IS
  'End of the current paid Shop period. Grace flow § E-2 compares this against now() to decide read-only grace vs hard expiry.';

COMMENT ON COLUMN public.nex_business.membership_started_at IS
  'When the current active membership first began (reset only on fresh paid resume after full expiry). Used for anniversary / retention analytics.';

COMMENT ON COLUMN public.nex_business.membership_last_webhook_at IS
  'When the last Stripe webhook touched this row. Diagnostic column for support and the webhook-health dashboard · never a source of truth for entitlements.';

-- ---------------------------------------------------------------------------
-- 8 · nex_product.discovered_at + Daily Discovery partial unique
-- ---------------------------------------------------------------------------

ALTER TABLE public.nex_product
  ADD COLUMN IF NOT EXISTS discovered_at timestamptz NULL;

COMMENT ON COLUMN public.nex_product.discovered_at IS
  'Timestamp (UTC-partitioned at the index level) at which this product was published into NEX-wide Daily Discovery. Immutable after publication per sealed Daily Discovery doctrine 2026-11-05 § C-8: edit never writes it, archived products retain it (prevents archive-and-recreate bypass).';

-- Partial unique index · enforces "one product per shop per UTC day enters
-- Daily Discovery". Pre-doctrine products (`discovered_at IS NULL`) are not
-- under the uniqueness constraint. The expression
-- `((discovered_at AT TIME ZONE 'UTC')::date)` is IMMUTABLE (timezone-literal
-- + constant SQL cast · unlike `date_trunc` which is STABLE and cannot be
-- used in an index predicate directly).
CREATE UNIQUE INDEX IF NOT EXISTS nex_product_business_daily_discovery_uniq
  ON public.nex_product (
    business_id,
    ((discovered_at AT TIME ZONE 'UTC')::date)
  )
  WHERE discovered_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 9 · nex_webhook_event_log — idempotent webhook processing
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.nex_webhook_event_log (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider             text        NOT NULL,
  provider_event_id    text        NOT NULL,
  received_at          timestamptz NOT NULL DEFAULT now(),
  processed_at         timestamptz NULL,
  status               text        NOT NULL
                       CHECK (status IN ('received','processed','failed','skipped')),
  payload              jsonb       NULL,
  error_message        text        NULL,
  account_id           uuid        NULL REFERENCES public.nex_account(id) ON DELETE SET NULL,
  UNIQUE (provider, provider_event_id)
);

COMMENT ON TABLE public.nex_webhook_event_log IS
  'Idempotent provider webhook ledger. UNIQUE (provider, provider_event_id) is the dedupe key: a Stripe retry with the same event.id is a no-op at insert time. Service-role only — public RLS denies all access. Sealed Shop Entitlement Contract § D-3 reliability requirement.';

COMMENT ON COLUMN public.nex_webhook_event_log.provider IS
  'Provider name · currently always ''stripe''. Future-proofed for additional payment or auth webhook sources.';

COMMENT ON COLUMN public.nex_webhook_event_log.provider_event_id IS
  'The provider-side event identifier (e.g. Stripe event.id). Combined with provider forms the idempotency key.';

COMMENT ON COLUMN public.nex_webhook_event_log.status IS
  'received = row inserted but not yet processed. processed = handler ran to completion. failed = handler raised (error_message set). skipped = intentionally ignored (e.g. event type we do not handle).';

COMMENT ON COLUMN public.nex_webhook_event_log.payload IS
  'Raw provider payload (jsonb). NEVER rendered to end users. Retained for support debugging · retention policy out of scope here.';

COMMENT ON COLUMN public.nex_webhook_event_log.account_id IS
  'Best-effort link to nex_account when the event can be associated to a known account. ON DELETE SET NULL keeps the audit trail even after account deletion.';

-- Secondary indexes for the common support / health queries.
CREATE INDEX IF NOT EXISTS nex_webhook_event_log_by_account_time
  ON public.nex_webhook_event_log (account_id, received_at DESC);

CREATE INDEX IF NOT EXISTS nex_webhook_event_log_by_status_received
  ON public.nex_webhook_event_log (status, received_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
--
-- nex_account and nex_business already have RLS enabled and policies that
-- scope SELECT/UPDATE to the owning user (migrations 001 / 002 / 010). The
-- new columns inherit those policies automatically — no new policy is
-- required for them. Service-role bypasses RLS as normal.
--
-- nex_webhook_event_log is service-role ONLY · no end-user access. Enable
-- RLS with zero permissive policies so authenticated and anon roles are
-- denied by default; service_role bypasses via BYPASSRLS.
-- ---------------------------------------------------------------------------

ALTER TABLE public.nex_webhook_event_log ENABLE ROW LEVEL SECURITY;

-- Explicit "deny all" is the absence of policies · documenting intent here
-- with a no-op policy helps future readers understand the shape is
-- intentional, not an oversight.
CREATE POLICY nex_webhook_event_log_service_all
  ON public.nex_webhook_event_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No policy for authenticated / anon · they get nothing.

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '283',
  'Shop Entitlement Contract § G schema · nex_account (country_iso2, shop_subscription_id, vault_tier) + nex_business (membership_active, membership_period_end, membership_started_at, membership_last_webhook_at) + nex_product.discovered_at with Daily Discovery partial unique + nex_webhook_event_log. Phase 4 Batch 4.6 · 2026-11-06.',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Positive / negative tests
-- ---------------------------------------------------------------------------
-- POS-T283-1 · Pre-apply: columns 1..8 absent; nex_webhook_event_log absent.
-- POS-T283-2 · Post-apply: all 8 columns present with documented defaults
--              and CHECK constraints; nex_webhook_event_log exists with 9
--              columns and UNIQUE (provider, provider_event_id).
-- POS-T283-3 · INSERT nex_account with country_iso2='GB' → succeeds.
-- POS-T283-4 · INSERT nex_account with country_iso2='gb' → fails (CHECK).
-- POS-T283-5 · INSERT nex_account with country_iso2=NULL → succeeds.
-- POS-T283-6 · INSERT nex_account with vault_tier='premium' → fails (CHECK).
-- POS-T283-7 · INSERT two nex_product rows for (biz A, today-UTC) with
--              non-NULL discovered_at → second fails 23505 on
--              nex_product_business_daily_discovery_uniq.
-- POS-T283-8 · INSERT nex_product with discovered_at=NULL for (biz A) any
--              number of times → all succeed (partial index excludes NULL).
-- POS-T283-9 · INSERT two nex_webhook_event_log rows with same (provider,
--              provider_event_id) → second fails 23505 (idempotency).
-- POS-T283-10 · As authed user X, SELECT FROM nex_webhook_event_log → 0 rows
--               (no policy for authenticated role).
-- POS-T283-11 · As service_role, SELECT FROM nex_webhook_event_log → full
--               visibility.
-- NEG-T283-12 · Re-apply after successful apply → pre-flight sees
--               nex_webhook_event_log exists → raises.
-- ---------------------------------------------------------------------------

-- =============================================================================
-- BACKFILL PLAN (not executed by this migration)
-- =============================================================================
-- After this migration is applied:
-- 1. Existing nex_account rows have country_iso2 = NULL. A separate backfill
--    job reads `nex_country_hint` cookies when users next sign in and writes
--    the column. New signups populate immediately via createNexAccountAction.
-- 2. Existing nex_business rows have membership_active = false. A separate
--    backfill reads account.tier='bisnis' + bisnis_expires_at to bootstrap
--    the first wave of active memberships. Owner authorises separately.
-- 3. nex_product.discovered_at left NULL on existing rows (pre-Daily-Discovery
--    products). New product publishes via the RPC in a later batch.
-- 4. nex_webhook_event_log starts empty.
-- =============================================================================
