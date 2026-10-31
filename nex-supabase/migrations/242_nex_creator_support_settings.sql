-- ============================================================================
-- NEX-native Migration 242 · nex_creator_support_settings
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised draft only · DO NOT APPLY to the sealed Supabase project
-- `ijvqdvsvwtwxzcqmoqit` or any staging target without a SEPARATE explicit
-- owner authorisation.
--
-- NEX Creator Programme · Stage 1 · "NEX Creator Support" settings.
-- Owner directive 2026-10-31 verbatim: "NEX must NOT become a payment
-- processor. The creator supplies their own payment destinations."
--
-- This table stores the creator-authored payment-destination pointers
-- that the universal Support pop-up shows to fans. NEX never collects,
-- holds, or distributes money · the pop-up just hands the fan the
-- creator's QR image or external payment link.
--
-- Schema:
--   · account_id         FK → nex_account(id). ONE row per account.
--   · enabled            boolean · false by default. When false the
--                        Support pop-up shows the friendly empty state.
--   · qris_image_url     the creator-uploaded QRIS image reference ·
--                        points at an object in nex-business-assets or
--                        a dedicated creator-support bucket (follow-up
--                        migration). NEX NEVER verifies the QR.
--   · paypal_link        external paypal.me / paypal URL ·
--                        text-match-validated server-side.
--   · external_links     jsonb · [{label,url},...] for other platforms
--                        (ko-fi, wise, revolut, etc.). Shape stays
--                        flexible so new providers do not require a
--                        migration.
--   · suggested_amounts  jsonb · [10000,25000,50000] in minor units
--                        of currency · creator-overridable. Fans see
--                        these as quick-pick chips in the pop-up.
--   · currency           ISO 4217 3-letter · defaults to "IDR".
--   · thank_you_message  optional creator-authored message shown
--                        after the fan taps "Support".
--   · created_at / updated_at
--
-- Explicitly ABSENT:
--   · Payment state. NEX cannot and must not track whether a static
--     QR scan actually paid. The sealed "NEX never handles payments"
--     doctrine covers this.
--   · Fee split / commission. There is none.
--   · Transaction history. None stored.
--
-- RLS posture:
--   · SELECT · own account by signed-in user; OR anyone when enabled=
--     true (so a fan can read the creator's QR + links in the pop-up).
--   · INSERT / UPDATE / DELETE · own account only.
--   · service_role · full access.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_creator_support_settings (
  account_id         uuid        PRIMARY KEY REFERENCES public.nex_account(id) ON DELETE CASCADE,
  enabled            boolean     NOT NULL DEFAULT false,
  qris_image_url     text        NULL,
  paypal_link        text        NULL,
  external_links     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  suggested_amounts  jsonb       NOT NULL DEFAULT '[10000,25000,50000]'::jsonb,
  currency           text        NOT NULL DEFAULT 'IDR' CHECK (currency ~ '^[A-Z]{3}$'),
  thank_you_message  text        NULL CHECK (thank_you_message IS NULL OR char_length(thank_you_message) <= 500),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nex_creator_support_settings IS
  'Creator-authored payment-destination pointers for NEX Creator Support. NEX NEVER processes payments; this table only stores pointers that the Support pop-up displays to fans.';

-- --------------------------------------------------------------------
-- Row-Level Security
-- --------------------------------------------------------------------
ALTER TABLE public.nex_creator_support_settings ENABLE ROW LEVEL SECURITY;

-- SELECT · own row OR any enabled row. Enabled=true is the public
-- opt-in; otherwise other users cannot read your draft settings.
CREATE POLICY nex_creator_support_select_own_or_enabled
  ON public.nex_creator_support_settings
  FOR SELECT
  TO authenticated
  USING (
    enabled = true
    OR account_id IN (SELECT id FROM public.nex_account WHERE supabase_user_id = auth.uid())
  );

-- INSERT · own account only.
CREATE POLICY nex_creator_support_insert_own
  ON public.nex_creator_support_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (SELECT id FROM public.nex_account WHERE supabase_user_id = auth.uid())
  );

-- UPDATE · own account only.
CREATE POLICY nex_creator_support_update_own
  ON public.nex_creator_support_settings
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (SELECT id FROM public.nex_account WHERE supabase_user_id = auth.uid())
  )
  WITH CHECK (
    account_id IN (SELECT id FROM public.nex_account WHERE supabase_user_id = auth.uid())
  );

-- DELETE · own account only.
CREATE POLICY nex_creator_support_delete_own
  ON public.nex_creator_support_settings
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (SELECT id FROM public.nex_account WHERE supabase_user_id = auth.uid())
  );

-- --------------------------------------------------------------------
-- Grants · align with Option X pattern. service_role has full access
-- for the server actions that read/write these settings. anon has
-- nothing (unauthenticated fans cannot read support settings).
-- --------------------------------------------------------------------
REVOKE ALL ON TABLE public.nex_creator_support_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.nex_creator_support_settings FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON TABLE public.nex_creator_support_settings TO authenticated;
GRANT  ALL ON TABLE public.nex_creator_support_settings TO service_role;

-- --------------------------------------------------------------------
-- updated_at trigger
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nex_creator_support_settings_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_creator_support_settings_touch
  ON public.nex_creator_support_settings;
CREATE TRIGGER trg_nex_creator_support_settings_touch
  BEFORE UPDATE ON public.nex_creator_support_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.nex_creator_support_settings_touch_updated_at();

-- --------------------------------------------------------------------
-- Migration ledger
-- --------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, notes)
VALUES (
  '242',
  'nex_creator_support_settings · creator-authored payment-destination pointers (QRIS image + PayPal link + external links + suggested amounts + thank-you) · NEX never handles money',
  'DRAFT 2026-10-31 · NEX Creator Programme Stage 1 · requires separate owner authorisation to apply.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ----------------------------------------------------------------
-- Rollback (manual · destructive once rows exist)
--   BEGIN;
--     DROP TRIGGER IF EXISTS trg_nex_creator_support_settings_touch
--       ON public.nex_creator_support_settings;
--     DROP FUNCTION IF EXISTS public.nex_creator_support_settings_touch_updated_at();
--     DROP POLICY IF EXISTS nex_creator_support_select_own_or_enabled
--       ON public.nex_creator_support_settings;
--     DROP POLICY IF EXISTS nex_creator_support_insert_own
--       ON public.nex_creator_support_settings;
--     DROP POLICY IF EXISTS nex_creator_support_update_own
--       ON public.nex_creator_support_settings;
--     DROP POLICY IF EXISTS nex_creator_support_delete_own
--       ON public.nex_creator_support_settings;
--     DROP TABLE IF EXISTS public.nex_creator_support_settings;
--     DELETE FROM public.nex_migration_history WHERE version = '242';
--   COMMIT;
-- ----------------------------------------------------------------
