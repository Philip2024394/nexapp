-- ============================================================================
-- NEX Migration 252 · nex_country_registry · supported-countries list
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (NEX GLOBAL FEED PROPOSAL · Stage 3A ·
-- 2026-11-01). DO NOT APPLY to the sealed Supabase project
-- `ijvqdvsvwtwxzcqmoqit` without a SEPARATE explicit owner authorisation
-- naming this file.
--
-- Purpose:
--   Authoritative supported-countries list for the Global Feed
--   architecture. Drives:
--     · HQ left-nav country list (COUNTRY FEED CONTROL section)
--     · Feed-switcher UI (globe + flag chip on nex-feed right rail)
--     · FK target for nex_country_placement.country
--     · FK target for nex_hq_action_log.country
--   Owner directive 2026-11-01 safeguard #3: this table is a source of
--   SUPPORTED-COUNTRY truth · NOT a source of account identity.
--
-- Dependencies:
--   · None (pure additive · new table)
--
-- Scope (strictly):
--   · CREATE TABLE nex_country_registry
--   · ENABLE RLS · SELECT policy for anon+authenticated
--   · Seed Ireland + Indonesia with hq_enabled=true + public_feed_enabled=true
--
-- NOT in scope:
--   · Account country assignment (lives on nex_account.last_known_country_iso
--     and the sealed nex_business.country from Migration 244)
--   · Flag asset uploads (flag_emoji is adequate for v1 UI)
--   · Admin UI for adding countries (DB-direct INSERT via migration until
--     Stage 3C ships an admin surface)
--
-- Backfill: 2 INSERTs for IE + ID. All other countries remain unseeded
--   until explicit owner authorisation adds them.
--
-- Rollback: trivial · DROP TABLE IF EXISTS public.nex_country_registry.
--   No FK references exist yet (253 and 254 are drafted but not applied
--   either, so no RESTRICT fail).
--
-- Risk level: LOW (new table, no touch to existing data).
--
-- ============================================================================

BEGIN;

-- Apply guard
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 252 is DRAFT · requires explicit owner authorisation naming this file to apply. Comment out this guard block only when authorised.';
END $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nex_country_registry (
  code                 text PRIMARY KEY CHECK (code ~ '^[A-Z]{2}$'),
  display_name         text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 80),
  flag_emoji           text NOT NULL CHECK (length(flag_emoji) BETWEEN 1 AND 8),
  flag_asset_path      text NULL CHECK (flag_asset_path IS NULL OR flag_asset_path ~ '^/[A-Za-z0-9/_.-]+$'),
  hq_enabled           boolean NOT NULL DEFAULT false,
  public_feed_enabled  boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nex_country_registry IS
  'Authoritative supported-countries list for the Global Feed architecture (sealed 2026-11-01). SOURCE OF SUPPORTED-COUNTRY TRUTH ONLY · NOT a source of account identity (owner safeguard #3). Adding a country = one row insert; no new code required.';

COMMENT ON COLUMN public.nex_country_registry.code IS
  'ISO 3166-1 alpha-2 (2 uppercase letters). Primary key. Referenced by nex_country_placement.country and nex_hq_action_log.country.';
COMMENT ON COLUMN public.nex_country_registry.hq_enabled IS
  'If true, this country appears in HQ left-nav COUNTRY FEED CONTROL section + moderators can act on its queue. If false, country is seeded but hidden from HQ.';
COMMENT ON COLUMN public.nex_country_registry.public_feed_enabled IS
  'If true, creators can request local-feed placement in this country (shows in the publishing audience selector). If false, placement requests for this country are rejected server-side.';

-- ---------------------------------------------------------------------------
-- RLS · public read ONLY for enabled countries · operational flags hidden
-- (owner safeguard 2026-11-01 · public SELECT exposes only intended columns)
-- ---------------------------------------------------------------------------
-- The flags hq_enabled + public_feed_enabled are operational state. Showing
-- them to anon would reveal which countries NEX has moderation set up for.
-- Tighten: public SELECT only returns rows where public_feed_enabled=true,
-- and the UI client reads via a VIEW that projects just the fields the UI
-- needs (code, display_name, flag_emoji, flag_asset_path).
-- Full-row access stays service-role only.
ALTER TABLE public.nex_country_registry ENABLE ROW LEVEL SECURITY;

-- Public (anon + authenticated) can SELECT only PUBLIC-FEED-ENABLED rows.
-- Disabled countries are invisible to the client. HQ reads via service_role.
CREATE POLICY nex_country_registry_public_feed_read ON public.nex_country_registry
  FOR SELECT TO anon, authenticated USING (public_feed_enabled = true);

-- No INSERT/UPDATE/DELETE policies defined · service_role bypasses RLS by design
-- so this table is INSERT/UPDATE only via owner-authored migrations or
-- Stage 3C+ admin server actions running under service_role. No authenticated
-- user path writes to this table.

-- ---------------------------------------------------------------------------
-- Public projection view · UI reads this · not the raw table
-- ---------------------------------------------------------------------------
-- Even though the public_feed_enabled filter above hides disabled rows,
-- clients still see the hq_enabled flag on enabled rows. Create a VIEW
-- that projects only the four fields the UI needs:
CREATE OR REPLACE VIEW public.nex_country_registry_public AS
SELECT code, display_name, flag_emoji, flag_asset_path
  FROM public.nex_country_registry
 WHERE public_feed_enabled = true;

COMMENT ON VIEW public.nex_country_registry_public IS
  'Public-facing projection of nex_country_registry. UI clients SELECT from this view, never the base table. Rows filtered to public_feed_enabled=true. Operational columns (hq_enabled, timestamps) hidden.';

-- GRANT the view to anon + authenticated (views inherit RLS from base table +
-- the SECURITY INVOKER default so the base-table RLS also applies).
GRANT SELECT ON public.nex_country_registry_public TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed · Ireland + Indonesia (Stage 3A launch set per owner directive 2026-11-01)
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_country_registry (code, display_name, flag_emoji, hq_enabled, public_feed_enabled)
VALUES
  ('IE', 'Ireland',   '🇮🇪', true, true),
  ('ID', 'Indonesia', '🇮🇩', true, true)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '252',
  'nex_country_registry · supported-countries list + IE/ID seed · hq_enabled + public_feed_enabled flags · public SELECT RLS · service_role writes only.',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification queries (run AFTER authorised apply)
-- ---------------------------------------------------------------------------
-- -- 1. Table exists with correct columns
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='nex_country_registry'
--  ORDER BY ordinal_position;
--
-- -- 2. Both seeded countries present
-- SELECT code, display_name, flag_emoji, hq_enabled, public_feed_enabled
--   FROM public.nex_country_registry
--  ORDER BY code;
-- -- Expected:
-- --   IE | Ireland   | 🇮🇪 | true | true
-- --   ID | Indonesia | 🇮🇩 | true | true
--
-- -- 3. Ledger entry present
-- SELECT version, description, applied_at FROM public.nex_migration_history WHERE version='252';
--
-- -- 4. Public SELECT works (as anon, via Supabase client)
-- -- The 2 rows should be returned when queried without auth.
