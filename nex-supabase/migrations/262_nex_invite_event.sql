-- ============================================================================
-- NEX Migration 262 · nex_invite_event · event log with registry-bound FK
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (Scope-A · PR-1 · 2026-11-03). DO NOT
-- APPLY to the sealed Supabase project `ijvqdvsvwtwxzcqmoqit` without a
-- SEPARATE explicit owner authorisation naming this file.
--
-- Purpose:
--   Append-only event log for every invitation state transition and
--   every scheduled-job health signal. Backs:
--     · Invitation funnel dashboards
--     · Scheduled-sweep health detection (watcher reads heartbeat events)
--     · Retention policy monitoring
--     · HQ investigation audit trail (combined with migration 263 holds)
--
-- Classification is DATABASE-ENFORCED through a compound foreign key to
-- `nex_invite_event_type` (migration 260). An INSERT with:
--   · an unknown event_name  → foreign_key_violation
--   · a known event_name but wrong event_class → foreign_key_violation
--   · a never-seeded event_name → foreign_key_violation
-- The Scope-A plpgsql functions (migration 265) catch this structured
-- violation via GET STACKED DIAGNOSTICS and surface it as
-- `event_type_unregistered` so operators see an actionable error.
--
-- Soft reference to nex_friend_request:
--   `request_id` is NULL-able and has NO foreign key. Rationale:
--     · Event rows must outlive their invite rows for audit value.
--     · Deleting an invite (e.g., GDPR right-to-erasure, future) must
--       NOT cascade and destroy audit history.
--     · The HQ hold table (migration 263) can pin events open regardless
--       of the invite's lifecycle.
--
-- Content safety:
--   This table does NOT store:
--     · Invitation message content (never recorded in telemetry)
--     · Introduction note text (never recorded)
--     · Account display names
--     · Chat body content
--     · Password / token / secret material
--   It DOES store:
--     · Internal account UUIDs (admin-RLS only; already pseudonymous)
--     · Structured enum/boolean dims
--     · Correlation IDs for request tracing
--     · Timestamps and durations
--   Account UUIDs are internal identifiers with no cross-system meaning.
--   Admin-only RLS enforces that only operators can read these rows.
--
-- Dependencies:
--   · Migration 260 (nex_invite_event_type · compound FK target)
--   · Migration 261 (registry seed · every emitted event name must be
--     seeded before any plpgsql function tries to emit it)
--
-- Scope (strictly):
--   · CREATE TABLE nex_invite_event with compound FK to registry
--   · 4 indexes for hot query paths
--   · ENABLE RLS · deny-all for anon + authenticated · service_role write
--
-- NOT in scope:
--   · The hold table · see migration 263
--   · The idempotency column adds · see migration 264
--   · The plpgsql functions that INSERT into this table · see migration 265
--   · Retention or reconciliation routes · future PR-3
--
-- Backfill: NONE. New empty table.
--
-- Rollback: trivial if migration 263 is not yet applied (263 adds a FK
--   from the hold table). If 263 has been applied, drop 263's hold table
--   first.
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
  RAISE EXCEPTION 'Migration 262 is DRAFT · requires explicit owner authorisation naming this file to apply. Comment out this guard block only when authorised.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight · migrations 260 and 261 must have landed.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'nex_invite_event_type'
  ) THEN
    RAISE EXCEPTION 'Migration 262 refused: nex_invite_event_type missing. Apply migration 260 first.';
  END IF;

  IF (SELECT count(*) FROM public.nex_invite_event_type) < 15 THEN
    RAISE EXCEPTION 'Migration 262 refused: nex_invite_event_type contains % rows (expected >= 15). Apply migration 261 first.',
      (SELECT count(*) FROM public.nex_invite_event_type);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nex_invite_event (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Correlation across route → RPC → event. Required for every event
  -- so dashboards can trace a cron run or a single invite transition
  -- end to end.
  correlation_id           uuid NOT NULL,

  -- Compound-FK-enforced classification (migration 260).
  event_name               text NOT NULL,
  event_class              text NOT NULL,

  -- Soft reference · intentional: no FK · see doctrine comment above.
  request_id               uuid NULL,

  -- Actor references · all nullable because operational events have no
  -- individual actor. Lifecycle events populate the subset that applies
  -- (e.g., invite.created → sender + recipient; invite.cancelled →
  -- canceller; invite.accepted → acceptor + accepted_category).
  sender_account_id        uuid NULL REFERENCES public.nex_account(id) ON DELETE SET NULL,
  recipient_account_id     uuid NULL REFERENCES public.nex_account(id) ON DELETE SET NULL,
  acceptor_account_id      uuid NULL REFERENCES public.nex_account(id) ON DELETE SET NULL,
  canceller_account_id     uuid NULL REFERENCES public.nex_account(id) ON DELETE SET NULL,

  -- Accept-specific: 'friends' or 'business' (same enum as nex_friend_request.accepted_category).
  category                 text NULL
    CHECK (category IS NULL OR category IN ('friends','business')),

  -- Rejection-specific: reason code on invite.create.rejected.
  -- NULL on every other event name.
  rejection_reason         text NULL
    CHECK (
      rejection_reason IS NULL
      OR rejection_reason IN (
        'cooldown',
        'duplicate_pending',
        'idempotency_key_conflict',
        'idempotency_lookup_lost'
      )
    ),

  -- Elapsed milliseconds between invite creation and this event.
  -- NULL on operational events and on invite.created itself.
  elapsed_ms_from_created  integer NULL
    CHECK (elapsed_ms_from_created IS NULL OR elapsed_ms_from_created >= 0),

  -- Structured operational metadata. Examples:
  --   sweep.run.ok      → {"flipped": 12, "duration_ms": 48}
  --   retention.run.ok  → {"lifecycle_deleted": 1000, "operational_deleted": 0, "duration_ms": 73}
  --   watcher.run.ok    → {"sweep_staleness_min": 42, "retention_staleness_min": 1240, "state": "healthy"}
  --   watcher.run.failed → {"stale_signal": "sweep", "staleness_min": 185}
  --   sweep.run.unresolved → {"reconciliation_attempts": 3, "http_error_class": "network_timeout"}
  -- No PII, no payload previews, no handles.
  dims                     jsonb NOT NULL DEFAULT '{}'::jsonb,

  occurred_at              timestamptz NOT NULL DEFAULT now(),

  -- Compound FK · THE core integrity guarantee of this migration.
  CONSTRAINT nex_invite_event_type_fk
    FOREIGN KEY (event_name, event_class)
    REFERENCES public.nex_invite_event_type (event_name, event_class)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

COMMENT ON TABLE public.nex_invite_event IS
  'Append-only event log for invitation lifecycle and scheduled-job health (sealed Scope-A · 2026-11-03). Classification enforced by compound FK to nex_invite_event_type. Admin-RLS only. Never carries conversation content, handle strings, or PII payload previews.';

COMMENT ON COLUMN public.nex_invite_event.correlation_id IS
  'Request-scoped correlation ID generated at route entry, propagated through RPC, carried onto this row. Enables end-to-end tracing.';
COMMENT ON COLUMN public.nex_invite_event.event_name IS
  'Event identifier. Must exist in nex_invite_event_type together with the matching event_class (compound FK enforced).';
COMMENT ON COLUMN public.nex_invite_event.request_id IS
  'Soft reference to nex_friend_request.id · intentionally not a FK so event rows outlive their invite rows for audit continuity.';
COMMENT ON COLUMN public.nex_invite_event.dims IS
  'Structured operational metadata as jsonb. See migration doctrine for the shape per event_name. MUST NOT contain conversation content, handle strings, display names, or secret material.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Recent-events window query (dashboards)
CREATE INDEX IF NOT EXISTS nex_invite_event_occurred_at_idx
  ON public.nex_invite_event (occurred_at DESC);

-- Per-event-name recency (watcher heartbeat reads, invite funnel widgets)
CREATE INDEX IF NOT EXISTS nex_invite_event_name_occurred_at_idx
  ON public.nex_invite_event (event_name, occurred_at DESC);

-- Correlation-ID lookup (reconciliation path · see docs/doctrine/
-- nex-ireland-world-class-chat-blueprint-2026-11-03.md § 1.2)
CREATE INDEX IF NOT EXISTS nex_invite_event_correlation_idx
  ON public.nex_invite_event (correlation_id);

-- Per-invite event stream (operator investigation of a specific invite)
CREATE INDEX IF NOT EXISTS nex_invite_event_request_id_idx
  ON public.nex_invite_event (request_id, occurred_at DESC)
  WHERE request_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Row-level security · deny-all for anon + authenticated.
-- Only service_role (via Scope-A functions and routes) may write/read.
-- Future HQ dashboard route will proxy reads server-side.
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_invite_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_invite_event_deny_anon_select
  ON public.nex_invite_event FOR SELECT TO anon
  USING (false);
CREATE POLICY nex_invite_event_deny_authenticated_select
  ON public.nex_invite_event FOR SELECT TO authenticated
  USING (false);

CREATE POLICY nex_invite_event_deny_anon_insert
  ON public.nex_invite_event FOR INSERT TO anon
  WITH CHECK (false);
CREATE POLICY nex_invite_event_deny_authenticated_insert
  ON public.nex_invite_event FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY nex_invite_event_deny_anon_update
  ON public.nex_invite_event FOR UPDATE TO anon
  USING (false);
CREATE POLICY nex_invite_event_deny_authenticated_update
  ON public.nex_invite_event FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY nex_invite_event_deny_anon_delete
  ON public.nex_invite_event FOR DELETE TO anon
  USING (false);
CREATE POLICY nex_invite_event_deny_authenticated_delete
  ON public.nex_invite_event FOR DELETE TO authenticated
  USING (false);

GRANT SELECT, INSERT, DELETE ON public.nex_invite_event TO service_role;
-- UPDATE is intentionally omitted · this table is append-only, except
-- for DELETE which the retention job needs. If a future design requires
-- UPDATE (e.g., marking an event as reviewed), add it in a dedicated
-- migration with a clear operational doctrine.

-- ---------------------------------------------------------------------------
-- Migration history
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, notes)
  VALUES (
    '262',
    'nex_invite_event · append-only event log with compound FK to event registry',
    'Owner-authorised 2026-11-03. Classification DB-enforced via compound FK (migration 260). Request_id intentionally soft-reference. Content-safe · no PII payload previews. Scope-A PR-1.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
