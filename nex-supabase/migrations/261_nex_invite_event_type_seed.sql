-- ============================================================================
-- NEX Migration 261 · nex_invite_event_type seed · 15 authoritative events
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (Scope-A · PR-1 · 2026-11-03). DO NOT
-- APPLY to the sealed Supabase project `ijvqdvsvwtwxzcqmoqit` without a
-- SEPARATE explicit owner authorisation naming this file.
--
-- Purpose:
--   Seed the authoritative 15-event registry defined in migration 260.
--   Every event name a Scope-A plpgsql function (migration 265) or route
--   (future PR-3) is permitted to emit must exist here BEFORE the
--   function/route can insert into `nex_invite_event` (migration 262).
--
-- Inventory (sealed · 15 events total · 6 lifecycle + 9 operational):
--
--   LIFECYCLE (class='lifecycle'):
--     · invite.created             · created by nex_friend_request_create_tx
--     · invite.accepted            · created by nex_friend_request_accept_tx
--     · invite.cancelled           · created by nex_friend_request_cancel_tx
--     · invite.expired.swept       · created by nex_friend_request_sweep_run (per-row)
--     · invite.create.rejected     · created by nex_friend_request_create_tx on structured reject
--     · invite.view                · created by contacts page server-render (optional)
--
--   OPERATIONAL (class='operational'):
--     · sweep.run.ok               · heartbeat · emitted inside nex_friend_request_sweep_run on success
--     · sweep.run.failed           · emitted by route after confirmed RPC failure
--     · sweep.run.unresolved       · emitted by route after reconciliation timeout
--     · watcher.run.ok             · heartbeat · emitted by watcher route on successful read
--     · watcher.run.failed         · emitted by watcher route on explicit failure
--     · watcher.run.unresolved     · emitted by watcher route on reconciliation timeout
--     · retention.run.ok           · heartbeat · emitted inside nex_invite_event_retention_run
--     · retention.run.failed       · emitted by route after confirmed RPC failure
--     · retention.run.unresolved   · emitted by route after reconciliation timeout
--
-- Heartbeat discipline (database-enforced via check constraint in migration 260):
--   · Only `.ok` events may carry a heartbeat flag.
--   · Each `.ok` event carries at most one heartbeat flag (sweep, watcher,
--     or retention · never two).
--   · `.failed` and `.unresolved` events MUST have alert_severity > 'none'
--     and MUST NOT carry any heartbeat flag.
--
-- Dependencies:
--   · Migration 260 (nex_invite_event_type · the table being seeded)
--
-- Scope (strictly):
--   · INSERT 15 rows · idempotent · safe to re-run.
--   · Detect existing rows that differ from the expected definitions
--     and RAISE EXCEPTION rather than silently overwriting them.
--
-- Backfill: this migration IS the seed.
--
-- Rollback: `DELETE FROM nex_invite_event_type` is safe only before any
--   `nex_invite_event` row references these event names. See the
--   deployment-sequence report for the forward-compatible rollback.
--
-- Risk level: LOW (new row inserts in an isolated registry table).
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Apply guard
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 261 is DRAFT · requires explicit owner authorisation naming this file to apply. Comment out this guard block only when authorised.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight · migration 260 must have created the registry table.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'nex_invite_event_type'
  ) THEN
    RAISE EXCEPTION 'Migration 261 refused: nex_invite_event_type missing. Apply migration 260 first.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Seed · explicit idempotent UPSERT with mismatch detection
-- ---------------------------------------------------------------------------
-- Build the expected inventory as a VALUES list, then LEFT JOIN against the
-- registry. For each expected row:
--   · If no existing row → INSERT.
--   · If existing row matches on every field → NO-OP.
--   · If existing row DIFFERS on any field → RAISE EXCEPTION with a
--     structured description. The operator must manually review the
--     divergence before the seed proceeds.
--
-- This is strictly safer than ON CONFLICT DO UPDATE because the seed will
-- NEVER silently overwrite an in-use registry entry (e.g., if the owner
-- later tightens an alert severity by hand and this migration is re-run,
-- the handwritten value is preserved and the operator is alerted).

DO $$
DECLARE
  v_expected record;
  v_actual   record;
  v_diffs    text[] := ARRAY[]::text[];
  v_inserted int := 0;
  v_matched  int := 0;
  v_total    int := 0;
BEGIN
  FOR v_expected IN
    SELECT * FROM (VALUES
      -- (event_name,                   event_class,     sweep_hb, watcher_hb, retention_hb, severity, description)
      ('invite.created',                'lifecycle',     false,    false,      false,        'none',    'Pending invitation inserted into nex_friend_request'),
      ('invite.accepted',               'lifecycle',     false,    false,      false,        'none',    'Pending invitation flipped to accepted; category recorded'),
      ('invite.cancelled',              'lifecycle',     false,    false,      false,        'none',    'Sender cancelled a pending invitation'),
      ('invite.expired.swept',          'lifecycle',     false,    false,      false,        'none',    'Scheduled sweep flipped a pending invitation to expired'),
      ('invite.create.rejected',        'lifecycle',     false,    false,      false,        'none',    'Create attempt rejected after structured validation (cooldown, duplicate_pending, idempotency_key_conflict, idempotency_lookup_lost)'),
      ('invite.view',                   'lifecycle',     false,    false,      false,        'none',    'Server rendered the pending-invitations section'),
      ('sweep.run.ok',                  'operational',   true,     false,      false,        'none',    'Scheduled sweep completed successfully (heartbeat)'),
      ('sweep.run.failed',              'operational',   false,    false,      false,        'high',    'Sweep RPC returned confirmed failure'),
      ('sweep.run.unresolved',          'operational',   false,    false,      false,        'medium',  'Sweep RPC outcome unresolved after bounded reconciliation retries'),
      ('watcher.run.ok',                'operational',   false,    true,       false,        'none',    'Watcher read sweep and retention health successfully (heartbeat)'),
      ('watcher.run.failed',            'operational',   false,    false,      false,        'high',    'Watcher detected stale health signal or watcher operation failed'),
      ('watcher.run.unresolved',        'operational',   false,    false,      false,        'medium',  'Watcher outcome unresolved after bounded reconciliation retries'),
      ('retention.run.ok',              'operational',   false,    false,      true,         'none',    'Retention passes completed successfully (heartbeat); dims carry per-class deleted counts'),
      ('retention.run.failed',          'operational',   false,    false,      false,        'high',    'Retention RPC returned confirmed failure'),
      ('retention.run.unresolved',      'operational',   false,    false,      false,        'medium',  'Retention RPC outcome unresolved after bounded reconciliation retries')
    ) AS t(event_name, event_class, is_sweep_heartbeat, is_watcher_heartbeat, is_retention_heartbeat, alert_severity, description)
  LOOP
    v_total := v_total + 1;

    SELECT * INTO v_actual
      FROM public.nex_invite_event_type
      WHERE event_name = v_expected.event_name;

    IF NOT FOUND THEN
      INSERT INTO public.nex_invite_event_type (
        event_name, event_class,
        is_sweep_heartbeat, is_watcher_heartbeat, is_retention_heartbeat,
        alert_severity, description
      )
      VALUES (
        v_expected.event_name, v_expected.event_class,
        v_expected.is_sweep_heartbeat, v_expected.is_watcher_heartbeat, v_expected.is_retention_heartbeat,
        v_expected.alert_severity, v_expected.description
      );
      v_inserted := v_inserted + 1;
    ELSE
      -- Mismatch detection · if ANY field differs, record it and continue.
      IF v_actual.event_class            IS DISTINCT FROM v_expected.event_class
         OR v_actual.is_sweep_heartbeat     IS DISTINCT FROM v_expected.is_sweep_heartbeat
         OR v_actual.is_watcher_heartbeat   IS DISTINCT FROM v_expected.is_watcher_heartbeat
         OR v_actual.is_retention_heartbeat IS DISTINCT FROM v_expected.is_retention_heartbeat
         OR v_actual.alert_severity         IS DISTINCT FROM v_expected.alert_severity
         OR v_actual.description            IS DISTINCT FROM v_expected.description
      THEN
        v_diffs := v_diffs || format(
          '%s: class=%s/%s sweep_hb=%s/%s watcher_hb=%s/%s retention_hb=%s/%s severity=%s/%s desc=%s/%s',
          v_expected.event_name,
          v_actual.event_class,            v_expected.event_class,
          v_actual.is_sweep_heartbeat,     v_expected.is_sweep_heartbeat,
          v_actual.is_watcher_heartbeat,   v_expected.is_watcher_heartbeat,
          v_actual.is_retention_heartbeat, v_expected.is_retention_heartbeat,
          v_actual.alert_severity,         v_expected.alert_severity,
          left(coalesce(v_actual.description,'<null>'), 40),
          left(v_expected.description, 40)
        );
      ELSE
        v_matched := v_matched + 1;
      END IF;
    END IF;
  END LOOP;

  IF array_length(v_diffs, 1) > 0 THEN
    RAISE EXCEPTION 'Migration 261 refused: % registry row(s) differ from expected definitions. Review manually before re-running. Divergences: %',
      array_length(v_diffs, 1), array_to_string(v_diffs, ' | ');
  END IF;

  -- Sanity-check: the registry must now contain EXACTLY the 15 expected rows
  -- (no extra rows, no missing rows). An extra row would indicate the owner
  -- (or an unrelated migration) has added events that this seed doesn't
  -- know about · we DO NOT delete them, but we DO report them so the
  -- operator can decide whether to roll back or update this migration.
  IF (SELECT count(*) FROM public.nex_invite_event_type) <> 15 THEN
    DECLARE
      v_extras text;
    BEGIN
      SELECT string_agg(event_name, ', ' ORDER BY event_name) INTO v_extras
        FROM public.nex_invite_event_type
        WHERE event_name NOT IN (
          'invite.created','invite.accepted','invite.cancelled','invite.expired.swept',
          'invite.create.rejected','invite.view',
          'sweep.run.ok','sweep.run.failed','sweep.run.unresolved',
          'watcher.run.ok','watcher.run.failed','watcher.run.unresolved',
          'retention.run.ok','retention.run.failed','retention.run.unresolved'
        );
      RAISE EXCEPTION 'Migration 261 refused: registry has unexpected row count (expected 15, found %). Unexpected rows: %',
        (SELECT count(*) FROM public.nex_invite_event_type),
        coalesce(v_extras, '<none>');
    END;
  END IF;

  RAISE NOTICE 'Migration 261 seed complete: total=%, inserted=%, matched=%',
    v_total, v_inserted, v_matched;
END $$;

-- ---------------------------------------------------------------------------
-- Migration history
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, notes)
  VALUES (
    '261',
    'nex_invite_event_type seed · 15 authoritative events (6 lifecycle · 9 operational)',
    'Owner-authorised 2026-11-03. Idempotent · mismatch-detecting · never silently overwrites. Scope-A PR-1.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
