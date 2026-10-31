-- ============================================================================
-- NEX-native Migration 243 · nex_world_state (singleton)
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised draft only · DO NOT APPLY to the sealed Supabase project
-- `ijvqdvsvwtwxzcqmoqit` or any staging target without a SEPARATE explicit
-- owner authorisation.
--
-- NEX World Engine · Stage 1 persistence.
-- Owner directive 2026-10-31: "One NEX application · two selectable visual
-- worlds (Ireland + Indonesia) · controlled from NEX HQ · preview is
-- owner-only + non-persistent · activate is global + persistent."
--
-- This table holds the GLOBAL active-world setting · one row max. Preview
-- is NOT persisted here (preview is a signed owner-only cookie · see
-- `src/lib/nex-worlds/world-cookie.ts`) · the preview_world_id column was
-- considered but rejected in favour of a cookie so cross-device confusion
-- cannot happen.
--
-- Columns:
--   · id                           singleton PK (always 1)
--   · active_world_id              text · the world the app renders
--     globally. Known values today: 'nex-original', 'ireland', 'indonesia'.
--     Validation lives in the application layer (world-registry.ts) · the
--     DB check is open-ended so new worlds can land without a schema
--     change.
--   · previous_active_world_id     text NULL · the world that was active
--     before the current one. Enables the "Restore previous world" HQ
--     control without an audit-log scan.
--   · activated_by_account_id      uuid NULL FK → nex_account · the HQ
--     admin who performed the current activation. NULL on the seed row.
--   · activated_at                 timestamptz · when the current world
--     was activated.
--   · updated_at                   timestamptz · touched by trigger on
--     every UPDATE.
--
-- Seed: one row inserted at migration time with active_world_id =
--   'nex-original' so the app has a defined state immediately after apply.
--   This is the "zero visual change for existing users" baseline per the
--   sealed non-regression rule.
--
-- RLS posture:
--   · SELECT · authenticated (every signed-in user needs to know which
--     world is active so pages render consistently). anon has no access.
--   · INSERT/UPDATE/DELETE · service_role ONLY. HQ server actions
--     (`activateWorldAction`) run under service_role AFTER verifying
--     `requireHqAdmin()`. Direct writes from authenticated clients are
--     REVOKEd (sealed Option X pattern).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_world_state (
  id                         integer       PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_world_id            text          NOT NULL CHECK (char_length(active_world_id) BETWEEN 1 AND 64),
  previous_active_world_id   text          NULL CHECK (previous_active_world_id IS NULL OR char_length(previous_active_world_id) BETWEEN 1 AND 64),
  activated_by_account_id    uuid          NULL REFERENCES public.nex_account(id) ON DELETE SET NULL,
  activated_at               timestamptz   NOT NULL DEFAULT now(),
  updated_at                 timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nex_world_state IS
  'Singleton table · one row (id=1) · holds the globally active NEX visual world. Preview is a per-session owner cookie, NOT stored here (sealed design 2026-10-31). HQ admin writes via server actions · direct authenticated writes REVOKEd.';
COMMENT ON COLUMN public.nex_world_state.active_world_id IS
  'World id · validated by the application (src/lib/nex-worlds/world-registry.ts). Open-ended at the DB layer so new worlds can land without a schema change.';
COMMENT ON COLUMN public.nex_world_state.previous_active_world_id IS
  'The world that was active immediately before the current one. Powers the "Restore previous world" HQ control.';

-- --------------------------------------------------------------------
-- updated_at trigger
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nex_world_state_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_world_state_touch ON public.nex_world_state;
CREATE TRIGGER trg_nex_world_state_touch
  BEFORE UPDATE ON public.nex_world_state
  FOR EACH ROW
  EXECUTE FUNCTION public.nex_world_state_touch_updated_at();

-- --------------------------------------------------------------------
-- Seed · one row · 'nex-original' baseline (zero visual change on apply).
-- --------------------------------------------------------------------
INSERT INTO public.nex_world_state (id, active_world_id, previous_active_world_id, activated_by_account_id)
VALUES (1, 'nex-original', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------
-- Row-Level Security
-- --------------------------------------------------------------------
ALTER TABLE public.nex_world_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_world_state_select_authenticated
  ON public.nex_world_state
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies · authenticated clients cannot
-- modify. service_role (used by HQ server actions) bypasses RLS.

-- --------------------------------------------------------------------
-- Grants · sealed Option X pattern (writes flow only via server actions)
-- --------------------------------------------------------------------
REVOKE ALL ON TABLE public.nex_world_state FROM PUBLIC;
REVOKE ALL ON TABLE public.nex_world_state FROM anon;
GRANT  SELECT ON TABLE public.nex_world_state TO authenticated;
GRANT  ALL    ON TABLE public.nex_world_state TO service_role;

-- --------------------------------------------------------------------
-- Migration ledger
-- --------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, notes)
VALUES (
  '243',
  'nex_world_state singleton · one row (id=1) · active_world_id + previous_active_world_id + activated_by_account_id · seeded with ''nex-original'' baseline · HQ admin writes via server action only',
  'DRAFT 2026-10-31 · NEX World Engine Stage 1 · requires separate owner authorisation to apply.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ----------------------------------------------------------------
-- Rollback (manual · destructive once activated worlds have shipped)
--   BEGIN;
--     DROP TRIGGER IF EXISTS trg_nex_world_state_touch
--       ON public.nex_world_state;
--     DROP FUNCTION IF EXISTS public.nex_world_state_touch_updated_at();
--     DROP POLICY IF EXISTS nex_world_state_select_authenticated
--       ON public.nex_world_state;
--     DROP TABLE IF EXISTS public.nex_world_state;
--     DELETE FROM public.nex_migration_history WHERE version = '243';
--   COMMIT;
-- ----------------------------------------------------------------
