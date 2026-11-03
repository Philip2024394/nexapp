-- ============================================================================
-- NEX Migration 263 · nex_invite_event_hold · retention protection for events
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (Scope-A · PR-1 · 2026-11-03). DO NOT
-- APPLY to the sealed Supabase project `ijvqdvsvwtwxzcqmoqit` without a
-- SEPARATE explicit owner authorisation naming this file.
--
-- Purpose:
--   Explicit retention protection for specific `nex_invite_event` rows.
--   Rows referenced by an ACTIVE hold (cleared_at IS NULL) are exempt
--   from BOTH retention passes (lifecycle 90d · operational 365d) in
--   the retention RPC (migration 265).
--
--   The HQ UI (future PR-3+) will offer HQ admins a "pin event" action
--   for ongoing investigations · gated by sealed `requireHqAdmin` ·
--   each hold/clear writes a corresponding row to `nex_hq_action_log`
--   (migration 254) for audit continuity.
--
-- Hold-clear lifecycle:
--   · Insert → status is "active" (cleared_at IS NULL · retention
--     exempt). Only one active hold per event is allowed by partial
--     unique index.
--   · Clear → UPDATE sets cleared_at and cleared_by_account_id ·
--     retention eligibility returns at the next normal cutoff.
--   · No deletion of hold rows · they remain as audit trail.
--
-- Dependencies:
--   · Migration 262 (nex_invite_event · the table being held)
--   · Pre-existing nex_account (FK target for held_by/cleared_by)
--
-- Scope (strictly):
--   · CREATE TABLE nex_invite_event_hold
--   · ENABLE RLS · deny-all for anon + authenticated · service_role
--     writes via future HQ server action
--   · Indexes for the retention pass's `NOT EXISTS` guard and for
--     per-event hold inspection
--
-- NOT in scope:
--   · HQ UI (future PR)
--   · The retention RPC that reads this table (migration 265)
--   · The nex_hq_action_log audit entry writer (future server action)
--
-- Backfill: NONE. New empty table.
--
-- Rollback: trivial if no retention passes have yet consulted this
--   table. If retention has consulted it, dropping it changes behaviour
--   (events previously protected become eligible for deletion on next
--   run); must be a conscious choice.
--
-- Risk level: LOW (new empty table, no touch to existing data).
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Apply guard
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 263 is DRAFT · requires explicit owner authorisation naming this file to apply. Comment out this guard block only when authorised.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight · migration 262 must have created nex_invite_event.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'nex_invite_event'
  ) THEN
    RAISE EXCEPTION 'Migration 263 refused: nex_invite_event missing. Apply migration 262 first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'nex_account'
  ) THEN
    RAISE EXCEPTION 'Migration 263 refused: nex_account missing. This is a baseline dependency.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nex_invite_event_hold (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which event is being held. ON DELETE RESTRICT so the retention
  -- pass CANNOT delete an event that still has an active hold · the
  -- NOT EXISTS clause in the retention query already enforces this,
  -- but the FK is the defence in depth.
  invite_event_id           uuid NOT NULL
    REFERENCES public.nex_invite_event(id) ON DELETE RESTRICT,

  -- Who placed the hold (HQ admin). Not auth.uid() because the row is
  -- written server-side by the HQ action after `requireHqAdmin` passes.
  held_by_account_id        uuid NOT NULL
    REFERENCES public.nex_account(id) ON DELETE RESTRICT,

  -- Human-readable reason supplied by the HQ admin at hold time.
  -- 1-500 chars · must contain non-whitespace content.
  reason                    text NOT NULL
    CHECK (length(trim(reason)) BETWEEN 1 AND 500),

  held_at                   timestamptz NOT NULL DEFAULT now(),

  -- Clear-time fields · populated when the hold is released.
  -- The three MUST be set together or all remain NULL (coherence CHECK).
  cleared_at                timestamptz NULL,
  cleared_by_account_id     uuid NULL
    REFERENCES public.nex_account(id) ON DELETE RESTRICT,
  clear_reason              text NULL
    CHECK (clear_reason IS NULL OR length(trim(clear_reason)) BETWEEN 1 AND 500),

  CONSTRAINT nex_invite_event_hold_cleared_coherent CHECK (
    (cleared_at IS NULL AND cleared_by_account_id IS NULL AND clear_reason IS NULL)
    OR (cleared_at IS NOT NULL AND cleared_by_account_id IS NOT NULL AND clear_reason IS NOT NULL)
  ),

  CONSTRAINT nex_invite_event_hold_clear_after_hold CHECK (
    cleared_at IS NULL OR cleared_at >= held_at
  )
);

COMMENT ON TABLE public.nex_invite_event_hold IS
  'Retention protection for specific nex_invite_event rows (sealed Scope-A · 2026-11-03). Active holds (cleared_at IS NULL) exempt the referenced event from both retention passes. Append-only · never deleted · HQ admin UI inserts/clears via requireHqAdmin-gated server action.';

COMMENT ON COLUMN public.nex_invite_event_hold.invite_event_id IS
  'Event being held. FK with ON DELETE RESTRICT · retention cannot delete a held event even if the retention query is bypassed.';
COMMENT ON COLUMN public.nex_invite_event_hold.cleared_at IS
  'When the hold was released. NULL means the hold is active (retention still exempt). Coherent with cleared_by_account_id and clear_reason via check constraint.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Retention pass hot path · `WHERE EXISTS (SELECT 1 FROM holds WHERE invite_event_id = e.id AND cleared_at IS NULL)`
CREATE INDEX IF NOT EXISTS nex_invite_event_hold_active_idx
  ON public.nex_invite_event_hold (invite_event_id)
  WHERE cleared_at IS NULL;

-- Per-event hold history (operator inspection)
CREATE INDEX IF NOT EXISTS nex_invite_event_hold_event_history_idx
  ON public.nex_invite_event_hold (invite_event_id, held_at DESC);

-- Partial unique index · at most ONE active hold per event. Prevents
-- an HQ admin double-clicking "Hold" from creating two active rows.
CREATE UNIQUE INDEX IF NOT EXISTS nex_invite_event_hold_single_active_per_event
  ON public.nex_invite_event_hold (invite_event_id)
  WHERE cleared_at IS NULL;

-- ---------------------------------------------------------------------------
-- Row-level security · deny-all for anon + authenticated.
-- HQ admin server actions use service_role.
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_invite_event_hold ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_invite_event_hold_deny_anon_select
  ON public.nex_invite_event_hold FOR SELECT TO anon
  USING (false);
CREATE POLICY nex_invite_event_hold_deny_authenticated_select
  ON public.nex_invite_event_hold FOR SELECT TO authenticated
  USING (false);

CREATE POLICY nex_invite_event_hold_deny_anon_insert
  ON public.nex_invite_event_hold FOR INSERT TO anon
  WITH CHECK (false);
CREATE POLICY nex_invite_event_hold_deny_authenticated_insert
  ON public.nex_invite_event_hold FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY nex_invite_event_hold_deny_anon_update
  ON public.nex_invite_event_hold FOR UPDATE TO anon
  USING (false);
CREATE POLICY nex_invite_event_hold_deny_authenticated_update
  ON public.nex_invite_event_hold FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY nex_invite_event_hold_deny_anon_delete
  ON public.nex_invite_event_hold FOR DELETE TO anon
  USING (false);
CREATE POLICY nex_invite_event_hold_deny_authenticated_delete
  ON public.nex_invite_event_hold FOR DELETE TO authenticated
  USING (false);

GRANT SELECT, INSERT, UPDATE ON public.nex_invite_event_hold TO service_role;
REVOKE DELETE ON public.nex_invite_event_hold FROM service_role;  -- hold table is append-only; destructive deletes require separate migration.

-- ---------------------------------------------------------------------------
-- Migration history
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, notes)
  VALUES (
    '263',
    'nex_invite_event_hold · retention protection for events under HQ investigation',
    'Owner-authorised 2026-11-03. One active hold per event. ON DELETE RESTRICT belt-and-braces alongside retention NOT EXISTS guard. HQ action writes nex_hq_action_log in parallel (future PR). Scope-A PR-1.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
