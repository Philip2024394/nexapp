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
-- 2026-11-04 amendment (owner-authorised): retired the Indonesia-specific
-- QRIS defaults for the Ireland World rollout. Column `qris_image_url`
-- renamed to `support_qr_image_url` (generic · any creator-supplied
-- payment-provider QR image, not specifically QRIS). Default currency
-- 'IDR' dropped; `currency` now has no default and must be supplied on
-- INSERT (the admin programme-config singleton will supply the per-world
-- default · 'EUR' for Ireland). Default `suggested_amounts` dropped for
-- the same reason. New column `qr_source` makes it explicit whether the
-- QR shown to the fan is generated at render time from the creator's
-- external URL (preferred · default) or supplied as an uploaded image
-- (optional · must pass server-side mime/type/safety validation at the
-- storage-write layer). The migration remains structurally the same;
-- this edit only alters the DRAFT file, which has never been applied.
--
-- This table stores the creator-authored payment-destination pointers
-- that the universal Support pop-up shows to fans. NEX never collects,
-- holds, or distributes money · the pop-up just hands the fan the
-- creator's QR image or external payment link.
--
-- Schema:
--   · account_id              FK → nex_account(id). ONE row per account.
--   · enabled                 boolean · false by default. When false the
--                             Support pop-up shows the friendly empty state.
--   · support_qr_image_url    OPTIONAL creator-supplied payment-provider
--                             QR image (e.g. PayPal / Revolut / Wise QR
--                             screenshot). Nullable; when null the app
--                             renders a QR generated at request time from
--                             the creator's primary external URL
--                             (preferred path). NEX NEVER verifies the QR.
--                             Image mime/size/safety validation happens at
--                             the storage-upload layer, NOT in this table.
--   · qr_source               CHECK ('generated_from_url','creator_upload').
--                             Explicit record of which path the UI should
--                             prefer. Default 'generated_from_url'.
--   · paypal_link             external paypal.me / paypal URL ·
--                             text-match-validated server-side.
--   · external_links          jsonb · [{label,url},...] for other platforms
--                             (ko-fi, wise, revolut, stripe payment links,
--                             etc.). Shape stays flexible so new providers
--                             do not require a migration.
--   · suggested_amounts       jsonb · [500,1000,2500] minor-units OR per
--                             creator override. NO default · server action
--                             must supply at INSERT (programme-config
--                             singleton provides the per-world default).
--                             Fans see these as quick-pick chips in the
--                             pop-up.
--   · currency                ISO 4217 3-letter · NO default · must be
--                             supplied on INSERT (Ireland World defaults
--                             to 'EUR' via programme-config).
--   · thank_you_message       optional creator-authored message shown
--                             after the fan taps "Support".
--   · created_at / updated_at
--
-- Explicitly ABSENT:
--   · Payment state. NEX cannot and must not track whether a static
--     QR scan actually paid. The sealed "NEX never handles payments"
--     doctrine covers this.
--   · Fee split / commission. There is none.
--   · Transaction history. None stored.
--   · Reachability / verification of external URLs. Format validation
--     only (regex), at the server-action layer, not at the DB.
--
-- RLS posture:
--   · SELECT · own account by signed-in user; OR anyone when enabled=
--     true (so a fan can read the creator's QR + links in the pop-up).
--   · INSERT / UPDATE / DELETE · own account only.
--   · service_role · full access.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_creator_support_settings (
  account_id              uuid        PRIMARY KEY REFERENCES public.nex_account(id) ON DELETE CASCADE,
  enabled                 boolean     NOT NULL DEFAULT false,
  support_qr_image_url    text        NULL,
  qr_source               text        NOT NULL DEFAULT 'generated_from_url'
                            CHECK (qr_source IN ('generated_from_url','creator_upload')),
  paypal_link             text        NULL,
  external_links          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  suggested_amounts       jsonb       NOT NULL,
  currency                text        NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  thank_you_message       text        NULL CHECK (thank_you_message IS NULL OR char_length(thank_you_message) <= 500),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- Integrity: if qr_source='creator_upload' then support_qr_image_url
  -- must be set. If qr_source='generated_from_url' then support_qr_image
  -- _url may be null (and the app generates a QR from paypal_link or the
  -- first external_links[].url at render time).
  CONSTRAINT nex_creator_support_qr_source_consistent
    CHECK (
      (qr_source = 'creator_upload' AND support_qr_image_url IS NOT NULL)
      OR (qr_source = 'generated_from_url')
    ),

  -- Integrity: when enabled=true the creator must have at least one
  -- payment destination the UI can render.
  CONSTRAINT nex_creator_support_enabled_has_destination
    CHECK (
      enabled = false
      OR paypal_link IS NOT NULL
      OR jsonb_array_length(external_links) > 0
      OR support_qr_image_url IS NOT NULL
    )
);

COMMENT ON TABLE public.nex_creator_support_settings IS
  'Creator-authored payment-destination pointers for NEX Creator Support. NEX NEVER processes payments; this table only stores pointers that the Support pop-up displays to fans. Per-world defaults (currency, suggested_amounts) are supplied by nex_creator_programme_config at INSERT time.';

COMMENT ON COLUMN public.nex_creator_support_settings.support_qr_image_url IS
  'Optional creator-supplied payment-provider QR image reference. Nullable. Must be validated for mime/size/safety at the upload layer, not at the DB. When null + qr_source=generated_from_url, the UI generates a QR at render time from the creator''s external URL.';

COMMENT ON COLUMN public.nex_creator_support_settings.qr_source IS
  'Explicit preference for how to render the fan-facing QR: generated_from_url (preferred · default) or creator_upload (optional · requires support_qr_image_url set).';

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
  'nex_creator_support_settings · creator-authored payment-destination pointers (support QR image + PayPal link + external links + suggested amounts + thank-you) · NEX never handles money · world-neutral defaults',
  'DRAFT · amended 2026-11-04 to retire Indonesia-specific QRIS / IDR defaults for the Ireland World rollout. Requires separate owner authorisation to apply.'
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
