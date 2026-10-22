-- ============================================================================
-- NEX-native Migration 214 · G1 · nex_business_trial_system
-- ============================================================================
--
-- Owner-authorised 2026-10-22. Implements the G1 schema for the NEX Business
-- Trial system per the sealed G1 Design Package at
-- `docs/doctrine/nex-trial-system-g1-design-package-2026-10-22.md` and the
-- governing trial doctrine at
-- `docs/doctrine/nex-trial-system-draft-2026-10-22.md` (Section N
-- consolidated authorisation 2026-10-22).
--
-- STATUS: AUTHORED FOR G1 IMPLEMENTATION · NOT YET APPLIED TO PRODUCTION
-- Application to any Supabase project (including sandbox) requires the
-- repository's authorised local/test database workflow and separate
-- deployment authorisation. This migration must NOT be applied to the
-- live NEX project `ijvqdvsvwtwxzcqmoqit` without explicit owner approval.
--
-- Depends on (APPLIED):
--   046_nex_account_tier.sql           (tier + bisnis_expires_at)
--   089_themes_trial.sql               (themes_trial_used_at)
--
-- MUST NOT be bundled with (UNAPPLIED · per X3 of the sealed trial doctrine):
--   207_nex_onboarding_and_vault_trial.sql (vault_trial_used_at)
--   The sealed Vault Entitlements Policy LOCKED stands untouched.
--
-- Deferred to later gates (NOT in this migration):
--   `tier_activated_at`, `payment_provider`, `payment_provider_customer_id` → G3
--   `nex_billing_attempt` table                                              → G3
--   `nex_data_sunset_schedule` table                                         → G5
--
-- Scope summary (per design §3.1):
--   · 4 trial columns on nex_account
--   · 2 CHECK constraints (K9 exact-168h · opt_out requires active)
--   · 1 partial index for G4 cron sweep efficiency
--   · 1 function + trigger (S1 fail-safe coexistence enforcement)
--   · 1 new table nex_pilot_operator_audit (S4 three-transaction durability)
--
-- Rollback: see §3.3 of design. Pre-activation rollback (destructive · safe)
-- is defined; post-activation recovery is NOT provided by G1.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Part 1 · Columns on nex_account (4 columns only · reduced scope per
--          2026-10-22 revision)
-- ---------------------------------------------------------------------------

ALTER TABLE nex_account
  ADD COLUMN business_trial_status text
    CHECK (business_trial_status IN ('active', 'converted', 'expired')
           OR business_trial_status IS NULL)
    DEFAULT NULL,
  ADD COLUMN business_trial_start_at timestamptz DEFAULT NULL,
  ADD COLUMN business_trial_end_at   timestamptz DEFAULT NULL,
  ADD COLUMN business_trial_conversion_opt_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN nex_account.business_trial_status IS
  'G1 · nullable one-shot: NULL (never used) | active | converted | expired. '
  'K1 one-trial-per-lifetime enforced by precondition `IS NULL` on /trial/start.';

COMMENT ON COLUMN nex_account.business_trial_start_at IS
  'G1 · UTC timestamp when the Business trial activated. Written exactly once '
  'by /trial/start. Required for K9 (168h duration) and /trial/status.';

COMMENT ON COLUMN nex_account.business_trial_end_at IS
  'G1 · UTC timestamp of trial expiry. ALWAYS equals start + interval ''168 hours'' '
  'per K9 (enforced by CHECK below). Read by /trial/status, /trial/resume-conversion-interest '
  '(24h cutoff), and future G4 cron sweep.';

COMMENT ON COLUMN nex_account.business_trial_conversion_opt_out IS
  'G1 · set by /trial/opt-out-conversion (D2 Action 1). When true, G3 payment '
  'code (future) MUST NOT attempt a charge (S3 contract). Does NOT end the trial '
  'early · shop remains editable until business_trial_end_at.';

-- K9: trial_end_at is exactly 168 hours after trial_start_at when both are set
ALTER TABLE nex_account ADD CONSTRAINT nex_account_business_trial_end_matches_start CHECK (
  (business_trial_start_at IS NULL AND business_trial_end_at IS NULL)
  OR
  (business_trial_end_at = business_trial_start_at + interval '168 hours')
);

-- Defensive: opt_out can only be true while trial is 'active' (sanity)
ALTER TABLE nex_account ADD CONSTRAINT nex_account_opt_out_requires_active CHECK (
  business_trial_conversion_opt_out = false
  OR business_trial_status = 'active'
);

-- Partial index for G4 cron efficient sweep (future gate · cheap future-staging)
CREATE INDEX idx_nex_account_business_trial_active_end
  ON nex_account (business_trial_end_at)
  WHERE business_trial_status = 'active';

-- ---------------------------------------------------------------------------
-- Part 2 · S1 fail-safe · function + trigger (defence-in-depth layer)
--
-- PRIMARY enforcement is the service-layer `SELECT ... FOR UPDATE` row lock
-- in src/lib/nex-native/business-trial/service.ts. This trigger is a
-- defence-in-depth layer that protects direct SQL (admin operations) and
-- any future code that forgets to acquire the row lock.
--
-- Honest limits of trigger-only approach:
-- Under default READ COMMITTED, concurrent UPDATEs on the SAME nex_account
-- row serialise correctly via row-level locking. The trigger sees the
-- committed state when its lock is acquired. Primary serialisation comes
-- from `SELECT ... FOR UPDATE` in the service layer; this trigger is the
-- safety net.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nex_enforce_trial_coexistence()
RETURNS trigger AS $$
BEGIN
  -- Case A: Business trial activation (NULL/non-active -> 'active')
  IF NEW.business_trial_status = 'active'
     AND (OLD.business_trial_status IS NULL
          OR OLD.business_trial_status IS DISTINCT FROM 'active')
  THEN
    IF NEW.themes_trial_used_at IS NOT NULL
       AND NEW.themes_trial_used_at >= (now() - interval '168 hours')
    THEN
      RAISE EXCEPTION 'business_trial_blocked_by_active_themes_trial'
        USING ERRCODE = 'exclusion_violation',
              HINT = 'Wait until the themes-trial expires before starting a Business trial.';
    END IF;
  END IF;

  -- Case B: Themes trial activation (NULL -> set timestamp)
  IF NEW.themes_trial_used_at IS NOT NULL
     AND OLD.themes_trial_used_at IS NULL
  THEN
    IF NEW.business_trial_status = 'active' THEN
      RAISE EXCEPTION 'themes_trial_blocked_by_active_business_trial'
        USING ERRCODE = 'exclusion_violation',
              HINT = 'Wait until the Business trial ends before starting a themes-trial.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION nex_enforce_trial_coexistence() IS
  'G1 · D1 mutually-exclusive-activation fail-safe · raises exclusion_violation '
  'if an UPDATE would create overlapping active Business and Themes trials. '
  'Primary enforcement is service-layer SELECT ... FOR UPDATE (service.ts). '
  'Does NOT alter the tier-elevation behaviour of startThemesTrial.';

CREATE TRIGGER tr_nex_account_trial_coexistence
BEFORE UPDATE ON nex_account
FOR EACH ROW
EXECUTE FUNCTION nex_enforce_trial_coexistence();

-- ---------------------------------------------------------------------------
-- Part 3 · nex_pilot_operator_audit (S4 pilot audit mechanism)
--
-- Three-transaction durable audit flow (design §9.2):
--   T1 (OUTSIDE op) · INSERT attempt row with attempt_status='pending'
--   T2 (operation's own tx) · the actual UPDATE / destructive statement
--   T3 (OUTSIDE op) · UPDATE attempt row with outcome
--
-- Failed operations leave attempt_status='failed' durably on the row.
-- A rolled-back T2 does NOT roll back the attempt row because T1 committed
-- in its own transaction first.
-- ---------------------------------------------------------------------------

CREATE TABLE nex_pilot_operator_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  operator_identity text NOT NULL,
  action text NOT NULL,
  target_account_id uuid REFERENCES nex_account(id),
  justification text NOT NULL,
  sql_executed text,
  before_state jsonb,
  attempt_status text NOT NULL DEFAULT 'pending'
    CHECK (attempt_status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  outcome_at timestamptz,
  after_state jsonb,
  error_message text,
  request_id text
);

COMMENT ON TABLE nex_pilot_operator_audit IS
  'G1 · S4 pilot audit · three-transaction durable audit (T1 begins, T2 does, T3 outcome). '
  'Supports manual pilot operator interventions (e.g. abuse-review trial reset) '
  'while the admin override endpoint remains deferred per Q1 (migration 206 unapplied). '
  'operator_identity is a hashed value (A4 PROPOSED: SHA-256 + env pepper NEX_AUDIT_HASH_PEPPER).';

CREATE INDEX idx_nex_pilot_operator_audit_attempted
  ON nex_pilot_operator_audit (attempted_at DESC);

CREATE INDEX idx_nex_pilot_operator_audit_target
  ON nex_pilot_operator_audit (target_account_id, attempted_at DESC)
  WHERE target_account_id IS NOT NULL;

-- Reconciliation index · finds stale pending rows (operator session crashed
-- between T2 and T3)
CREATE INDEX idx_nex_pilot_operator_audit_pending
  ON nex_pilot_operator_audit (attempted_at)
  WHERE attempt_status = 'pending';

-- Service-role-only via application code · no RLS added by G1. Owner may
-- elect to add RLS policies in a later migration.

COMMIT;
