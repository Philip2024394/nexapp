-- ============================================================================
-- NEX-native Migration 275 · nex_creator_activation
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised DRAFT only (authorisation issued 2026-11-04 to AUTHOR
-- the migration file for review). DO NOT APPLY to the sealed Supabase
-- project `ijvqdvsvwtwxzcqmoqit` or any staging target without a SEPARATE
-- explicit owner authorisation naming this file.
--
-- ----------------------------------------------------------------
-- Purpose
-- ----------------------------------------------------------------
-- NEX Ireland Creator Programme · activation records. One row per
-- verified eligible theme purchase that grants creator status. Rows are
-- insert-only (updates only touch suspension / revocation timestamps ·
-- never the activation snapshot).
--
-- Owner directive 2026-11-04: "nex fee is 1 theme each 12 calendar
-- month". Each activation row therefore carries its OWN duration (as
-- `expires_at`) captured at insert time from the admin-configurable
-- `nex_creator_programme_config.activation_duration_months`. Existing
-- rows are NOT retroactively adjusted when the admin rotates the
-- configured duration · their `expires_at` is locked in on insert.
--
-- To RENEW creator status after expiry, the user buys another eligible
-- theme · the trigger below inserts a NEW activation row with a fresh
-- `expires_at`. Multiple historical rows per account are expected and
-- are kept for audit purposes (not deleted on renewal).
--
-- ----------------------------------------------------------------
-- Dependencies
-- ----------------------------------------------------------------
-- · nex_account (existing · migration 013-ish era)
-- · nex_chat_theme (existing · migration 048)
-- · nex_theme_purchase (migration 193 · APPLIED) · provides the
--   verified-purchase FK target + the state-transition trigger source
-- · nex_creator_programme_config (migration 276 · DRAFT) · read inside
--   the trigger to derive activation_duration_months and the eligibility
--   guards. 276 MUST be applied before 275 would meaningfully activate;
--   the trigger below guards against the absence of a config row by
--   returning without inserting (safe no-op when programme unconfigured).
--
-- ----------------------------------------------------------------
-- Idempotency
-- ----------------------------------------------------------------
-- The UNIQUE constraint on `eligible_purchase_id` guarantees that the
-- same verified purchase cannot generate two activation rows regardless
-- of how many times the state-transition trigger fires. A missed trigger
-- event can be recovered by running `nex_creator_activation_backfill()`
-- (defined below) which iterates verified purchases and inserts any
-- that lack a matching activation row. The backfill uses the same
-- ON CONFLICT DO NOTHING pattern so it is safe to run repeatedly.
--
-- ----------------------------------------------------------------
-- Price-change safety
-- ----------------------------------------------------------------
-- Each activation captures the purchase's own `price_minor` and
-- `currency` at insert time. An admin changing the activation price
-- later affects ONLY new purchases evaluated against the new price;
-- existing verified eligible purchases retain their activation.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nex_creator_activation (
  id                         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id                 uuid         NOT NULL
                               REFERENCES public.nex_account(id) ON DELETE CASCADE,

  -- Snapshot of the purchase that granted this activation. Captured at
  -- insert time so admin price changes do not retroactively alter it.
  eligible_purchase_id       uuid         NOT NULL
                               REFERENCES public.nex_theme_purchase(id) ON DELETE RESTRICT,
  eligible_theme_id          uuid         NOT NULL
                               REFERENCES public.nex_chat_theme(id) ON DELETE RESTRICT,
  eligible_price_minor       integer      NOT NULL CHECK (eligible_price_minor > 0),
  eligible_currency          text         NOT NULL CHECK (eligible_currency ~ '^[A-Z]{3}$'),

  -- Lifecycle timestamps. All timestamptz.
  activated_at               timestamptz  NOT NULL,          -- derived from purchase.verified_at by trigger
  expires_at                 timestamptz  NOT NULL,          -- activated_at + config.activation_duration_months (locked in at insert)
  suspended_at               timestamptz  NULL,              -- admin-set, reactive, reversible by clearing
  suspended_reason           text         NULL,              -- admin audit note · <=500 chars
  revoked_at                 timestamptz  NULL,              -- set by refund trigger · one-way
  revoked_reason             text         NULL,              -- e.g. 'purchase_refunded'

  created_at                 timestamptz  NOT NULL DEFAULT now(),
  updated_at                 timestamptz  NOT NULL DEFAULT now(),

  -- IDEMPOTENCY: one activation row per verified eligible purchase.
  -- Trigger + backfill both use ON CONFLICT (eligible_purchase_id)
  -- DO NOTHING so repeated attempts are safe.
  CONSTRAINT nex_creator_activation_purchase_unique
    UNIQUE (eligible_purchase_id),

  -- Consistency: suspended_reason only meaningful when suspended_at set.
  CONSTRAINT nex_creator_activation_suspension_consistent
    CHECK (
      (suspended_at IS NULL AND suspended_reason IS NULL)
      OR (suspended_at IS NOT NULL)
    ),

  -- Consistency: revoked_reason only meaningful when revoked_at set.
  CONSTRAINT nex_creator_activation_revocation_consistent
    CHECK (
      (revoked_at IS NULL AND revoked_reason IS NULL)
      OR (revoked_at IS NOT NULL)
    ),

  -- Length cap for free-text reason fields.
  CONSTRAINT nex_creator_activation_reason_len
    CHECK (
      (suspended_reason IS NULL OR char_length(suspended_reason) <= 500)
      AND (revoked_reason IS NULL OR char_length(revoked_reason) <= 500)
    ),

  -- Temporal consistency: expires_at must be strictly after activated_at.
  CONSTRAINT nex_creator_activation_expires_after_activated
    CHECK (expires_at > activated_at)
);

COMMENT ON TABLE public.nex_creator_activation IS
  'NEX Ireland Creator Programme · one row per verified eligible theme purchase that grants creator status for a configured duration (default 12 months). Idempotent via UNIQUE(eligible_purchase_id). Expiry snapshots the configured duration at insert time · admin duration changes do not retroactively alter existing rows.';

COMMENT ON COLUMN public.nex_creator_activation.activated_at IS
  'Timestamp creator status began · derived from nex_theme_purchase.verified_at via trigger (NOT now() at trigger-fire time) so delayed catch-up still produces a correct activation window.';

COMMENT ON COLUMN public.nex_creator_activation.expires_at IS
  'Timestamp creator status lapses · locked in at insert as activated_at + config.activation_duration_months. Future admin changes to the configured duration do not alter this row.';

COMMENT ON COLUMN public.nex_creator_activation.suspended_at IS
  'Admin-set suspension timestamp · reversible by clearing to NULL. Suspended rows are treated as inactive by read-paths but are preserved for audit.';

COMMENT ON COLUMN public.nex_creator_activation.revoked_at IS
  'One-way revocation timestamp · set automatically by the refund trigger when the eligible purchase flips verified → refunded. Also used for programme-wide revocations (future).';

-- --------------------------------------------------------------------
-- Indexes
-- --------------------------------------------------------------------
-- Read path: "is this account currently an active creator?"
-- Filter on account_id + non-null expires_at window + null suspended + null revoked.
-- Covering index speeds up the common status probe.
CREATE INDEX IF NOT EXISTS idx_nex_creator_activation_account_active
  ON public.nex_creator_activation (account_id, expires_at DESC)
  WHERE suspended_at IS NULL AND revoked_at IS NULL;

-- Read path: admin backfill + report queries by theme / price / currency.
CREATE INDEX IF NOT EXISTS idx_nex_creator_activation_theme_purchase
  ON public.nex_creator_activation (eligible_theme_id, eligible_price_minor, eligible_currency);

-- --------------------------------------------------------------------
-- Row-Level Security
-- --------------------------------------------------------------------
-- Writes are service-role only (activation is server-decided, never
-- user-decided). Reads are own-row only; the public view path reads
-- via the service role and exposes a redacted shape.
ALTER TABLE public.nex_creator_activation ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_creator_activation_select_own
  ON public.nex_creator_activation
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM public.nex_account WHERE supabase_user_id = auth.uid())
  );

-- No INSERT / UPDATE / DELETE policies for authenticated · service_role
-- grants below handle all writes.

-- --------------------------------------------------------------------
-- Grants
-- --------------------------------------------------------------------
REVOKE ALL ON TABLE public.nex_creator_activation FROM PUBLIC;
REVOKE ALL ON TABLE public.nex_creator_activation FROM anon;
GRANT  SELECT ON TABLE public.nex_creator_activation TO authenticated;
GRANT  ALL    ON TABLE public.nex_creator_activation TO service_role;

-- --------------------------------------------------------------------
-- updated_at trigger
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nex_creator_activation_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_creator_activation_touch
  ON public.nex_creator_activation;
CREATE TRIGGER trg_nex_creator_activation_touch
  BEFORE UPDATE ON public.nex_creator_activation
  FOR EACH ROW
  EXECUTE FUNCTION public.nex_creator_activation_touch_updated_at();

-- --------------------------------------------------------------------
-- Auto-insert on verified purchase · idempotent
-- --------------------------------------------------------------------
-- Fires on nex_theme_purchase AFTER UPDATE when state transitions INTO
-- 'verified' from any other state. Reads the programme config singleton
-- (nex_creator_programme_config, migration 276). If programme_open=true
-- AND the purchase matches the configured eligible_theme_id +
-- activation_price_minor + activation_currency, inserts an activation
-- row. Otherwise no-op.
--
-- The INSERT uses ON CONFLICT (eligible_purchase_id) DO NOTHING so
-- repeated firings never duplicate.
--
-- `activated_at` is set to the purchase's verified_at (NOT now()) so
-- delayed catch-up still yields a correct activation window.
--
-- `expires_at` is computed as activated_at + the configured duration;
-- the duration is captured at insert · future admin changes do not
-- alter existing rows.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nex_creator_activation_auto_on_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cfg RECORD;
BEGIN
  -- Only process transitions INTO verified.
  IF NEW.state IS DISTINCT FROM 'verified' THEN
    RETURN NEW;
  END IF;
  IF OLD.state IS NOT DISTINCT FROM 'verified' THEN
    RETURN NEW;
  END IF;
  IF NEW.verified_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Read programme config. If no row exists OR programme_open=false OR
  -- the purchase doesn't match the configured eligibility snapshot,
  -- no-op. This is a SAFE DEFAULT · activation never fires without
  -- explicit admin configuration.
  SELECT *
    INTO cfg
    FROM public.nex_creator_programme_config
   WHERE id = 1;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  IF cfg.programme_open IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.theme_id      IS DISTINCT FROM cfg.eligible_theme_id     THEN RETURN NEW; END IF;
  IF NEW.price_minor   IS DISTINCT FROM cfg.activation_price_minor THEN RETURN NEW; END IF;
  IF NEW.currency      IS DISTINCT FROM cfg.activation_currency    THEN RETURN NEW; END IF;

  -- Insert idempotently.
  INSERT INTO public.nex_creator_activation (
    account_id,
    eligible_purchase_id,
    eligible_theme_id,
    eligible_price_minor,
    eligible_currency,
    activated_at,
    expires_at
  )
  VALUES (
    NEW.account_id,
    NEW.id,
    NEW.theme_id,
    NEW.price_minor,
    NEW.currency,
    NEW.verified_at,
    NEW.verified_at + make_interval(months => cfg.activation_duration_months)
  )
  ON CONFLICT (eligible_purchase_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_creator_activation_auto_on_verified
  ON public.nex_theme_purchase;
CREATE TRIGGER trg_nex_creator_activation_auto_on_verified
  AFTER UPDATE ON public.nex_theme_purchase
  FOR EACH ROW
  EXECUTE FUNCTION public.nex_creator_activation_auto_on_verified();

-- --------------------------------------------------------------------
-- Refund → revocation trigger
-- --------------------------------------------------------------------
-- When nex_theme_purchase transitions verified → refunded, revoke the
-- matching activation (set revoked_at + revoked_reason). Mirrors the
-- pattern established by nex_theme_ownership refund-revocation.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nex_creator_activation_refund_revokes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.state IS DISTINCT FROM 'verified' THEN
    RETURN NEW;
  END IF;
  IF NEW.state IS DISTINCT FROM 'refunded' THEN
    RETURN NEW;
  END IF;

  UPDATE public.nex_creator_activation
     SET revoked_at    = COALESCE(revoked_at, now()),
         revoked_reason = COALESCE(revoked_reason, 'purchase_refunded')
   WHERE eligible_purchase_id = NEW.id
     AND revoked_at IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_creator_activation_refund_revokes
  ON public.nex_theme_purchase;
CREATE TRIGGER trg_nex_creator_activation_refund_revokes
  AFTER UPDATE ON public.nex_theme_purchase
  FOR EACH ROW
  EXECUTE FUNCTION public.nex_creator_activation_refund_revokes();

-- --------------------------------------------------------------------
-- Manual backfill function · service_role only
-- --------------------------------------------------------------------
-- Iterates every VERIFIED eligible purchase that lacks an activation
-- row and inserts one. Uses the same ON CONFLICT (eligible_purchase_id)
-- DO NOTHING pattern so it is safe to run repeatedly. Returns the
-- number of rows inserted · callable from an admin action without any
-- further gate (RLS enforces service_role is the only writer).
--
-- Rationale per owner directive 2026-11-04: "catch-up mechanism must
-- not depend solely on someone visiting the Creator page". This
-- function + a scheduled service-role job (authorised separately) is
-- the recovery path for missed trigger events.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nex_creator_activation_backfill()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cfg RECORD;
  inserted_count integer := 0;
BEGIN
  SELECT *
    INTO cfg
    FROM public.nex_creator_programme_config
   WHERE id = 1;
  IF NOT FOUND OR cfg.programme_open IS NOT TRUE THEN
    RETURN 0;
  END IF;

  INSERT INTO public.nex_creator_activation (
    account_id,
    eligible_purchase_id,
    eligible_theme_id,
    eligible_price_minor,
    eligible_currency,
    activated_at,
    expires_at
  )
  SELECT
    p.account_id,
    p.id,
    p.theme_id,
    p.price_minor,
    p.currency,
    p.verified_at,
    p.verified_at + make_interval(months => cfg.activation_duration_months)
  FROM public.nex_theme_purchase p
  WHERE p.state = 'verified'
    AND p.verified_at IS NOT NULL
    AND p.theme_id    = cfg.eligible_theme_id
    AND p.price_minor = cfg.activation_price_minor
    AND p.currency    = cfg.activation_currency
    AND NOT EXISTS (
      SELECT 1 FROM public.nex_creator_activation a
       WHERE a.eligible_purchase_id = p.id
    )
  ON CONFLICT (eligible_purchase_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.nex_creator_activation_backfill() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nex_creator_activation_backfill() FROM anon;
REVOKE ALL ON FUNCTION public.nex_creator_activation_backfill() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.nex_creator_activation_backfill() TO service_role;

-- --------------------------------------------------------------------
-- Migration ledger
-- --------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, notes)
VALUES (
  '275',
  'nex_creator_activation · per-verified-purchase activation rows with configurable duration (default 12 months) + idempotent auto-insert trigger on verified-purchase transition + refund-revocation trigger + manual backfill function',
  'DRAFT · authored 2026-11-04. Requires migration 276 (programme config) applied first. Requires separate owner authorisation to apply.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Rollback (manual · preserves nex_theme_purchase + nex_chat_theme)
-- ============================================================================
--   BEGIN;
--     DROP TRIGGER IF EXISTS trg_nex_creator_activation_refund_revokes
--       ON public.nex_theme_purchase;
--     DROP FUNCTION IF EXISTS public.nex_creator_activation_refund_revokes();
--
--     DROP TRIGGER IF EXISTS trg_nex_creator_activation_auto_on_verified
--       ON public.nex_theme_purchase;
--     DROP FUNCTION IF EXISTS public.nex_creator_activation_auto_on_verified();
--
--     DROP FUNCTION IF EXISTS public.nex_creator_activation_backfill();
--
--     DROP TRIGGER IF EXISTS trg_nex_creator_activation_touch
--       ON public.nex_creator_activation;
--     DROP FUNCTION IF EXISTS public.nex_creator_activation_touch_updated_at();
--
--     DROP POLICY IF EXISTS nex_creator_activation_select_own
--       ON public.nex_creator_activation;
--
--     DROP INDEX IF EXISTS public.idx_nex_creator_activation_account_active;
--     DROP INDEX IF EXISTS public.idx_nex_creator_activation_theme_purchase;
--
--     DROP TABLE IF EXISTS public.nex_creator_activation;
--
--     DELETE FROM public.nex_migration_history WHERE version = '275';
--   COMMIT;
-- ============================================================================
