-- ============================================================================
-- NEX-native Migration 276 · nex_creator_programme_config
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised DRAFT only (authorisation issued 2026-11-04 to AUTHOR
-- the migration file for review). DO NOTAPPLY to the sealed Supabase
-- project `ijvqdvsvwtwxzcqmoqit` or any staging target without a SEPARATE
-- explicit owner authorisation naming this file.
--
-- ----------------------------------------------------------------
-- Purpose
-- ----------------------------------------------------------------
-- Singleton configuration row for the NEX Ireland Creator Programme.
-- Admin configures the programme ONCE from a central UI; routine
-- activation, badge computation and support-link setup must operate
-- automatically against this config without further admin intervention.
--
-- Seeded with a safe-default row at MIGRATION TIME: programme_open=false.
-- The programme remains DARK until admin flips programme_open=true from
-- the admin UI. The activation trigger in migration 275 refuses to
-- insert activation rows while programme_open=false.
--
-- Owner directives honoured:
--   · "Admin should only need to configure: €3.99 activation price and
--     eligible theme · Creator eligibility rules · Supported external
--     payment providers · Minimum content requirements · Reuse
--     permission templates · Badge thresholds · Age and safety
--     restrictions · Abuse and copyright reporting rules."
--   · "nex fee is 1 theme each 12 calendar month" · modelled as
--     activation_duration_months (default 12) · each new activation
--     row captures this value at insert time so admin rotations do
--     not retroactively alter existing activations.
--   · "€3.99 is the initial Creator activation eligibility price, not
--     a retroactive requirement for existing verified entitlements."
--   · "This is the Ireland World. Do not use QRIS. Support PayPal,
--     Revolut and Stripe Payment Links." · default currency 'EUR'
--     and the supported_payment_providers array defaults omit QRIS.
--
-- ----------------------------------------------------------------
-- Singleton enforcement
-- ----------------------------------------------------------------
-- id is a smallint PK with CHECK (id = 1). Only ONE row can exist.
-- Admin UPDATEs this row; DELETE is permitted but normally never done.
-- A new row with id=1 cannot be inserted while an existing row exists
-- (PK collision). INSERT with any other id value is refused by CHECK.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nex_creator_programme_config (
  id                           smallint     PRIMARY KEY CHECK (id = 1),

  -- Master switch. false seeds safely; admin flips to true to open
  -- the programme to users. Trigger in migration 275 refuses to
  -- insert activation rows while this is false.
  programme_open               boolean      NOT NULL DEFAULT false,

  -- Eligible theme · a nex_chat_theme row admin designates as the
  -- "creator activation theme" for the Ireland World. Nullable because
  -- the seed row is written before any theme is designated; admin
  -- must set this before flipping programme_open=true (enforced by
  -- a CHECK below).
  eligible_theme_id            uuid         NULL
                                 REFERENCES public.nex_chat_theme(id) ON DELETE RESTRICT,

  -- Activation price · minor units (e.g. 399 for €3.99). CHECK > 0.
  -- Nullable until admin sets it.
  activation_price_minor       integer      NULL CHECK (activation_price_minor IS NULL OR activation_price_minor > 0),
  activation_currency          text         NOT NULL DEFAULT 'EUR'
                                 CHECK (activation_currency ~ '^[A-Z]{3}$'),

  -- Owner directive 2026-11-04: "nex fee is 1 theme each 12 calendar
  -- month". Admin-configurable with a sensible Ireland default of 12.
  -- Minimum of 1 month · maximum 60 months (five years) for sanity.
  activation_duration_months   smallint     NOT NULL DEFAULT 12
                                 CHECK (activation_duration_months BETWEEN 1 AND 60),

  -- Per-section badge thresholds. jsonb keyed by the seven creator
  -- sections. The CREATOR_QUALIFYING_THRESHOLD constant in the sealed
  -- creator-badges resolver ignores this field today (the resolver is
  -- hard-coded to 5 as owner-sealed 2026-10-31). This column exists
  -- for FUTURE admin control once owner authorises the resolver to
  -- read from here. Phase 1 UI shows the values read-only.
  badge_thresholds             jsonb        NOT NULL DEFAULT jsonb_build_object(
                                 'music',    5,
                                 'shop',     5,
                                 'video',    5,
                                 'images',   5,
                                 'food',     5,
                                 'fashion',  5,
                                 'property', 5
                               ),

  -- Minimum age to activate as a creator. Default 18. Phase 1 UI
  -- treats this field as read-only until migration 251 (age-gate
  -- dependency) is applied; before 251, no runtime age check exists.
  age_minimum                  smallint     NOT NULL DEFAULT 18
                                 CHECK (age_minimum BETWEEN 13 AND 25),

  -- Supported external payment providers. Phase 1 defaults are Ireland-
  -- World-appropriate · PayPal, Stripe Payment Links, Revolut, plus a
  -- generic external_link slot. QRIS is intentionally absent.
  supported_payment_providers  text[]       NOT NULL DEFAULT ARRAY[
                                 'paypal_link',
                                 'stripe_payment_link',
                                 'revolut_link',
                                 'external_link'
                               ],

  -- Default support-pop-up currency and suggested amounts shown to
  -- fans when a creator has not overridden them per-row. Ireland
  -- defaults: EUR + €5/€10/€25 in minor units.
  default_support_currency     text         NOT NULL DEFAULT 'EUR'
                                 CHECK (default_support_currency ~ '^[A-Z]{3}$'),
  default_suggested_amounts    jsonb        NOT NULL DEFAULT '[500,1000,2500]'::jsonb,

  updated_at                   timestamptz  NOT NULL DEFAULT now(),
  updated_by_account_id        uuid         NULL
                                 REFERENCES public.nex_account(id) ON DELETE SET NULL,

  -- Guard: if programme_open = true, admin must have set a complete
  -- eligibility snapshot (theme + price). Prevents accidentally opening
  -- the programme in a partially-configured state.
  CONSTRAINT nex_creator_programme_open_requires_eligibility
    CHECK (
      programme_open = false
      OR (
        eligible_theme_id IS NOT NULL
        AND activation_price_minor IS NOT NULL
      )
    )
);

COMMENT ON TABLE public.nex_creator_programme_config IS
  'Singleton configuration for the NEX Ireland Creator Programme. Admin writes via service-role-guarded server actions only. Phase 1 seed: programme_open=false. The activation trigger in migration 275 reads this row to gate every activation.';

-- --------------------------------------------------------------------
-- Change log · append-only audit trail
-- --------------------------------------------------------------------
-- Records every admin change to the singleton. Essential for the
-- "admin configures once · audit who changed what" requirement.
--
-- Seeded automatically by the trigger below on every UPDATE.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nex_creator_programme_config_change_log (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_at           timestamptz  NOT NULL DEFAULT now(),
  changed_by           uuid         NULL
                         REFERENCES public.nex_account(id) ON DELETE SET NULL,
  field                text         NOT NULL,
  old_value            jsonb        NULL,
  new_value            jsonb        NULL,
  note                 text         NULL CHECK (note IS NULL OR char_length(note) <= 500)
);

COMMENT ON TABLE public.nex_creator_programme_config_change_log IS
  'Append-only audit trail of changes to nex_creator_programme_config. Rows inserted automatically by trigger · never deleted or updated.';

CREATE INDEX IF NOT EXISTS idx_nex_creator_programme_config_change_log_changed_at
  ON public.nex_creator_programme_config_change_log (changed_at DESC);

-- --------------------------------------------------------------------
-- Row-Level Security · config table
-- --------------------------------------------------------------------
-- SELECT: anyone authenticated (programme info is public to allow the
--   "coin button visible if programme_open" check client-side via the
--   server read path).
-- INSERT / UPDATE / DELETE: service_role only. Admin server actions run
--   under service_role after a sealed requireHqAdmin gate in the app
--   layer.
-- --------------------------------------------------------------------
ALTER TABLE public.nex_creator_programme_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_creator_programme_config_select_all
  ON public.nex_creator_programme_config
  FOR SELECT
  TO authenticated
  USING (true);

-- No authenticated INSERT / UPDATE / DELETE policies · service_role bypasses.

-- --------------------------------------------------------------------
-- Row-Level Security · change log
-- --------------------------------------------------------------------
-- SELECT: service_role only (audit data is admin-internal).
-- Writes: inserted only by the trigger below (service_role runs it).
-- --------------------------------------------------------------------
ALTER TABLE public.nex_creator_programme_config_change_log ENABLE ROW LEVEL SECURITY;

-- No authenticated policies at all · only service_role reads/writes.

-- --------------------------------------------------------------------
-- Grants
-- --------------------------------------------------------------------
REVOKE ALL ON TABLE public.nex_creator_programme_config FROM PUBLIC;
REVOKE ALL ON TABLE public.nex_creator_programme_config FROM anon;
GRANT  SELECT ON TABLE public.nex_creator_programme_config TO authenticated;
GRANT  ALL    ON TABLE public.nex_creator_programme_config TO service_role;

REVOKE ALL ON TABLE public.nex_creator_programme_config_change_log FROM PUBLIC;
REVOKE ALL ON TABLE public.nex_creator_programme_config_change_log FROM anon;
REVOKE ALL ON TABLE public.nex_creator_programme_config_change_log FROM authenticated;
GRANT  ALL    ON TABLE public.nex_creator_programme_config_change_log TO service_role;

-- --------------------------------------------------------------------
-- updated_at + change-log trigger
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nex_creator_programme_config_touch_and_log()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();

  -- Record every changed scalar / jsonb field. updated_by_account_id
  -- carries the identity if the server action supplies it.
  IF OLD.programme_open             IS DISTINCT FROM NEW.programme_open THEN
    INSERT INTO public.nex_creator_programme_config_change_log (changed_by, field, old_value, new_value)
    VALUES (NEW.updated_by_account_id, 'programme_open', to_jsonb(OLD.programme_open), to_jsonb(NEW.programme_open));
  END IF;
  IF OLD.eligible_theme_id          IS DISTINCT FROM NEW.eligible_theme_id THEN
    INSERT INTO public.nex_creator_programme_config_change_log (changed_by, field, old_value, new_value)
    VALUES (NEW.updated_by_account_id, 'eligible_theme_id', to_jsonb(OLD.eligible_theme_id), to_jsonb(NEW.eligible_theme_id));
  END IF;
  IF OLD.activation_price_minor     IS DISTINCT FROM NEW.activation_price_minor THEN
    INSERT INTO public.nex_creator_programme_config_change_log (changed_by, field, old_value, new_value)
    VALUES (NEW.updated_by_account_id, 'activation_price_minor', to_jsonb(OLD.activation_price_minor), to_jsonb(NEW.activation_price_minor));
  END IF;
  IF OLD.activation_currency        IS DISTINCT FROM NEW.activation_currency THEN
    INSERT INTO public.nex_creator_programme_config_change_log (changed_by, field, old_value, new_value)
    VALUES (NEW.updated_by_account_id, 'activation_currency', to_jsonb(OLD.activation_currency), to_jsonb(NEW.activation_currency));
  END IF;
  IF OLD.activation_duration_months IS DISTINCT FROM NEW.activation_duration_months THEN
    INSERT INTO public.nex_creator_programme_config_change_log (changed_by, field, old_value, new_value)
    VALUES (NEW.updated_by_account_id, 'activation_duration_months', to_jsonb(OLD.activation_duration_months), to_jsonb(NEW.activation_duration_months));
  END IF;
  IF OLD.badge_thresholds           IS DISTINCT FROM NEW.badge_thresholds THEN
    INSERT INTO public.nex_creator_programme_config_change_log (changed_by, field, old_value, new_value)
    VALUES (NEW.updated_by_account_id, 'badge_thresholds', OLD.badge_thresholds, NEW.badge_thresholds);
  END IF;
  IF OLD.age_minimum                IS DISTINCT FROM NEW.age_minimum THEN
    INSERT INTO public.nex_creator_programme_config_change_log (changed_by, field, old_value, new_value)
    VALUES (NEW.updated_by_account_id, 'age_minimum', to_jsonb(OLD.age_minimum), to_jsonb(NEW.age_minimum));
  END IF;
  IF OLD.supported_payment_providers IS DISTINCT FROM NEW.supported_payment_providers THEN
    INSERT INTO public.nex_creator_programme_config_change_log (changed_by, field, old_value, new_value)
    VALUES (NEW.updated_by_account_id, 'supported_payment_providers', to_jsonb(OLD.supported_payment_providers), to_jsonb(NEW.supported_payment_providers));
  END IF;
  IF OLD.default_support_currency   IS DISTINCT FROM NEW.default_support_currency THEN
    INSERT INTO public.nex_creator_programme_config_change_log (changed_by, field, old_value, new_value)
    VALUES (NEW.updated_by_account_id, 'default_support_currency', to_jsonb(OLD.default_support_currency), to_jsonb(NEW.default_support_currency));
  END IF;
  IF OLD.default_suggested_amounts  IS DISTINCT FROM NEW.default_suggested_amounts THEN
    INSERT INTO public.nex_creator_programme_config_change_log (changed_by, field, old_value, new_value)
    VALUES (NEW.updated_by_account_id, 'default_suggested_amounts', OLD.default_suggested_amounts, NEW.default_suggested_amounts);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_creator_programme_config_touch
  ON public.nex_creator_programme_config;
CREATE TRIGGER trg_nex_creator_programme_config_touch
  BEFORE UPDATE ON public.nex_creator_programme_config
  FOR EACH ROW
  EXECUTE FUNCTION public.nex_creator_programme_config_touch_and_log();

-- --------------------------------------------------------------------
-- Seed the singleton row · safe defaults · programme_open=false
-- --------------------------------------------------------------------
INSERT INTO public.nex_creator_programme_config (
  id,
  programme_open,
  eligible_theme_id,
  activation_price_minor,
  activation_currency,
  activation_duration_months,
  age_minimum,
  supported_payment_providers,
  default_support_currency,
  default_suggested_amounts
) VALUES (
  1,
  false,                 -- programme stays dark until admin opens it
  NULL,                  -- admin must designate the eligible theme
  NULL,                  -- admin must set the activation price
  'EUR',
  12,
  18,
  ARRAY['paypal_link','stripe_payment_link','revolut_link','external_link'],
  'EUR',
  '[500,1000,2500]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------
-- Migration ledger
-- --------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, notes)
VALUES (
  '276',
  'nex_creator_programme_config · singleton admin config for the Ireland Creator Programme (eligible theme + €3.99 activation price + 12-month duration + badge thresholds + supported payment providers) · plus append-only change log',
  'DRAFT · authored 2026-11-04. Required by migration 275 trigger. Seed inserts a safe-default row with programme_open=false. Requires separate owner authorisation to apply.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Rollback (manual · destructive once admin has configured the programme)
-- ============================================================================
--   BEGIN;
--     DROP TRIGGER IF EXISTS trg_nex_creator_programme_config_touch
--       ON public.nex_creator_programme_config;
--     DROP FUNCTION IF EXISTS public.nex_creator_programme_config_touch_and_log();
--
--     DROP POLICY IF EXISTS nex_creator_programme_config_select_all
--       ON public.nex_creator_programme_config;
--
--     DROP INDEX IF EXISTS public.idx_nex_creator_programme_config_change_log_changed_at;
--
--     DROP TABLE IF EXISTS public.nex_creator_programme_config_change_log;
--     DROP TABLE IF EXISTS public.nex_creator_programme_config;
--
--     DELETE FROM public.nex_migration_history WHERE version = '276';
--   COMMIT;
-- ============================================================================
