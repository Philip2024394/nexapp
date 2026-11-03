-- ============================================================================
-- NEX Migration 260 · nex_invite_event_type · authoritative event registry
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (Scope-A · PR-1 · 2026-11-03). DO NOT
-- APPLY to the sealed Supabase project `ijvqdvsvwtwxzcqmoqit` without a
-- SEPARATE explicit owner authorisation naming this file.
--
-- Purpose:
--   Authoritative registry of every event name that `nex_invite_event`
--   (migration 262) is permitted to carry. The registry is the single
--   source of truth for:
--     · which `(event_name, event_class)` pairs may be emitted
--     · which events count as successful heartbeats (sweep · watcher ·
--       retention) · failed and unresolved events never carry a heartbeat
--       flag · the watcher reads this registry, not a hardcoded list
--     · default alert severity on emission
--     · machine-readable description for operators
--
--   migration 262 attaches a compound foreign key
--   `(event_name, event_class)` → `(event_name, event_class)` on this
--   table with `ON UPDATE RESTRICT ON DELETE RESTRICT`. Attempts to emit
--   an unregistered event name OR to mix a known name with the wrong
--   class produce a `foreign_key_violation` at insert time, caught by
--   the Scope-A plpgsql functions and surfaced as a structured error.
--
-- Design rationale (owner-corrected Scope-A design, final revision):
--   · A plain `CHECK (event_class IN ('lifecycle','operational'))`
--     validates the VALUE of event_class but not its RELATIONSHIP to
--     event_name. The registry + compound FK makes misclassification
--     impossible at the database layer.
--   · Adding a new event requires an explicit migration that INSERTs
--     into this registry; code paths cannot emit a never-registered
--     event because the FK blocks it.
--
-- Dependencies:
--   · None (pure additive · new table)
--
-- Scope (strictly):
--   · CREATE TABLE nex_invite_event_type
--   · ENABLE RLS · deny-all for anon + authenticated · service_role
--     writes via the Scope-A functions, admin reads via future HQ UI
--   · Add UNIQUE (event_name, event_class) index to support the
--     compound FK target referenced by migration 262
--
-- NOT in scope:
--   · The seed rows · see migration 261
--   · The event table · see migration 262
--   · The hold table · see migration 263
--   · Any plpgsql function · see migration 265
--
-- Backfill: NONE. Seed lands in migration 261.
--
-- Rollback: trivial IF no rows have been seeded AND migration 262 is
--   not yet applied. Once migration 262 lands, the FK makes DROP TABLE
--   impossible until the dependent table is dropped first. See the
--   deployment-sequence report in docs/doctrine/nex-ireland-world-class-
--   chat-blueprint-2026-11-03.md § 4.6 (forward-compatible rollback).
--
-- Risk level: LOW (new empty table, no touch to existing data).
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Apply guard · prevents accidental application. Comment this block out
-- only when applying under explicit owner authorisation naming this file.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 260 is DRAFT · requires explicit owner authorisation naming this file to apply. Comment out this guard block only when authorised.';
END $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nex_invite_event_type (
  event_name              text PRIMARY KEY
    CHECK (length(trim(event_name)) BETWEEN 1 AND 64
           AND event_name = lower(event_name)
           AND event_name ~ '^[a-z0-9._]+$'),

  -- Class · lifecycle events describe invitation state transitions,
  -- operational events describe the health of scheduled jobs.
  -- Retention policy differs between the two classes · see migration 265
  -- `nex_invite_event_retention_run`.
  event_class             text NOT NULL
    CHECK (event_class IN ('lifecycle','operational')),

  -- Heartbeat flags · the watcher queries by these flags, NOT by event
  -- name string match. Only ".ok" events may carry heartbeat flags;
  -- ".failed" and ".unresolved" events never do (registry seed in
  -- migration 261 enforces this discipline).
  is_sweep_heartbeat      boolean NOT NULL DEFAULT false,
  is_watcher_heartbeat    boolean NOT NULL DEFAULT false,
  is_retention_heartbeat  boolean NOT NULL DEFAULT false,

  -- Default alert severity when the event is emitted.
  -- Per-event-row dims may override at the route layer (e.g., retention
  -- row count spike) but the registry default is the baseline.
  alert_severity          text NOT NULL DEFAULT 'none'
    CHECK (alert_severity IN ('none','medium','high')),

  description             text NOT NULL
    CHECK (length(trim(description)) BETWEEN 1 AND 500),

  added_at                timestamptz NOT NULL DEFAULT now(),

  -- A heartbeat event must NEVER have alert_severity > 'none'. Enforced
  -- at the database layer so a future seed drift cannot create a
  -- "heartbeat that also alerts" misclassification.
  CONSTRAINT nex_invite_event_type_heartbeat_severity_coherent CHECK (
    (NOT (is_sweep_heartbeat OR is_watcher_heartbeat OR is_retention_heartbeat))
    OR alert_severity = 'none'
  ),

  -- At most one heartbeat flag per row · an event cannot simultaneously
  -- be a sweep heartbeat AND a watcher heartbeat (they monitor different
  -- jobs). The watcher's `getLastSweepAt` / `getLastRetentionAt` /
  -- `getLastWatcherAt` readers each filter by a single flag.
  CONSTRAINT nex_invite_event_type_at_most_one_heartbeat CHECK (
    (CASE WHEN is_sweep_heartbeat THEN 1 ELSE 0 END) +
    (CASE WHEN is_watcher_heartbeat THEN 1 ELSE 0 END) +
    (CASE WHEN is_retention_heartbeat THEN 1 ELSE 0 END)
    <= 1
  )
);

COMMENT ON TABLE public.nex_invite_event_type IS
  'Authoritative event-name registry for nex_invite_event (sealed Scope-A · 2026-11-03). Rows here are the ONLY event_name/event_class pairs that migration 262 permits. Heartbeat flags are the authoritative health signal (never a hardcoded event-name match in application code).';

COMMENT ON COLUMN public.nex_invite_event_type.event_name IS
  'Dotted-lowercase event name (regex `^[a-z0-9._]+$`). Primary key. Referenced by nex_invite_event via compound FK (migration 262).';
COMMENT ON COLUMN public.nex_invite_event_type.event_class IS
  'lifecycle = invitation state transition event · operational = scheduled job health event. Retention windows differ by class (migration 265).';
COMMENT ON COLUMN public.nex_invite_event_type.is_sweep_heartbeat IS
  'If true, emission of this event constitutes proof the sweep job ran successfully. Only one ".ok" event may carry this flag. .failed and .unresolved events MUST NOT carry it.';
COMMENT ON COLUMN public.nex_invite_event_type.is_watcher_heartbeat IS
  'If true, emission of this event constitutes proof the watcher ran successfully.';
COMMENT ON COLUMN public.nex_invite_event_type.is_retention_heartbeat IS
  'If true, emission of this event constitutes proof the retention job ran successfully.';
COMMENT ON COLUMN public.nex_invite_event_type.alert_severity IS
  'Default alert severity when this event is emitted · none | medium | high. Routes read this on emission to decide webhook dispatch. Spike-based alerts (e.g., invite.create.rejected rate spike) are a separate layer.';

-- ---------------------------------------------------------------------------
-- Compound-FK target index
-- ---------------------------------------------------------------------------
-- The PRIMARY KEY already provides uniqueness on event_name alone, but
-- the compound FK in migration 262 references `(event_name, event_class)`
-- as a pair. PostgreSQL requires that the referenced columns be covered
-- by a UNIQUE or PRIMARY KEY constraint on the same column set.
CREATE UNIQUE INDEX IF NOT EXISTS nex_invite_event_type_name_class_unique
  ON public.nex_invite_event_type (event_name, event_class);

-- ---------------------------------------------------------------------------
-- Row-level security · deny-all for anon + authenticated.
-- Only service_role may insert/update/select. HQ admin UI (future) will
-- surface a read-only view via a dedicated server-side route.
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_invite_event_type ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_invite_event_type_deny_anon_select
  ON public.nex_invite_event_type FOR SELECT TO anon
  USING (false);

CREATE POLICY nex_invite_event_type_deny_authenticated_select
  ON public.nex_invite_event_type FOR SELECT TO authenticated
  USING (false);

CREATE POLICY nex_invite_event_type_deny_anon_insert
  ON public.nex_invite_event_type FOR INSERT TO anon
  WITH CHECK (false);

CREATE POLICY nex_invite_event_type_deny_authenticated_insert
  ON public.nex_invite_event_type FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY nex_invite_event_type_deny_anon_update
  ON public.nex_invite_event_type FOR UPDATE TO anon
  USING (false);

CREATE POLICY nex_invite_event_type_deny_authenticated_update
  ON public.nex_invite_event_type FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY nex_invite_event_type_deny_anon_delete
  ON public.nex_invite_event_type FOR DELETE TO anon
  USING (false);

CREATE POLICY nex_invite_event_type_deny_authenticated_delete
  ON public.nex_invite_event_type FOR DELETE TO authenticated
  USING (false);

-- Service-role bypasses RLS by Supabase convention; explicit GRANTs are
-- still required for the role to see the table.
GRANT SELECT, INSERT, UPDATE ON public.nex_invite_event_type TO service_role;
REVOKE DELETE ON public.nex_invite_event_type FROM service_role;  -- registry is append-only; destructive updates require a separate migration.

-- ---------------------------------------------------------------------------
-- Migration history
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, notes)
  VALUES (
    '260',
    'nex_invite_event_type · authoritative event registry for Scope-A observability',
    'Owner-authorised 2026-11-03. Compound FK target for migration 262. Append-only (DELETE revoked). Scope-A PR-1.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
