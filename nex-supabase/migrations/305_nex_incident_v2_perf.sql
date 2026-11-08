-- 305_nex_incident_v2_perf.sql
-- -----------------------------------------------------------------------------
-- NEX Incident v2 · performance + burst-depth companion to migration 304.
-- Owner-authorised 2026-11-08 (round 11).
-- STATUS · AUTHORED · APPLIED TO SANDBOX ONLY · NOT APPLIED to production
-- (ijvqdvsvwtwxzcqmoqit) per CLAUDE.md §5 Safety Constitution.
--
-- Doctrine context (owner directive 2026-11-08 · round 11)
--   Migration 304 landed the Priority-2 schema v2 (HIGH severity +
--   VERIFIED state + 6 new columns + scope expansion + event kind
--   'verified'). Priority 3 added the 5-state readers and bump-last-
--   seen helper. Owner-exact: "The priority remains protected
--   recovery and verified resolution · not a count of commits."
--
--   305 closes two concrete follow-ups from 304:
--   1. A `dedup_count` column so a repeated signal that just bumps
--      last_seen_at can also track BURST DEPTH (how many times the
--      same signal fired). Operators see "this incident has
--      recurred 247 times" at a glance. Existing bump helper is
--      updated in the same commit to increment it.
--   2. Three performance indexes for the Priority-3 read paths:
--      · (status, verified_at desc) WHERE status='VERIFIED' ·
--        fetchVerifiedIncidents.
--      · (status, resolved_at desc) WHERE status='CLOSED' ·
--        fetchRecentlyClosed.
--      · (correlation_id, status) WHERE correlation_id IS NOT NULL ·
--        fetchReopened two-step lookup.
--
-- Historical compatibility invariants
--   · `dedup_count` defaults to 1 for new rows and is backfilled to
--     1 for historical rows · we do NOT retroactively claim a burst
--     depth for incidents that pre-date the counter.
--   · No status / severity / scope changes · 304 covers those.
--   · No RLS / grant changes · service_role retains INSERT + SELECT
--     + UPDATE from 300.
--
-- Rollback
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '305';
--     DROP INDEX IF EXISTS idx_nex_incident_verified_at;
--     DROP INDEX IF EXISTS idx_nex_incident_closed_at;
--     DROP INDEX IF EXISTS idx_nex_incident_correlation_status;
--     ALTER TABLE nex_incident DROP COLUMN IF EXISTS dedup_count;
--   COMMIT;

begin;

-- ─── 1. dedup_count ─────────────────────────────────────────────

alter table nex_incident
  add column if not exists dedup_count integer;

update nex_incident
   set dedup_count = 1
 where dedup_count is null;

alter table nex_incident
  alter column dedup_count set not null,
  alter column dedup_count set default 1;

alter table nex_incident
  drop constraint if exists ck_nex_incident_dedup_count;

alter table nex_incident
  add constraint ck_nex_incident_dedup_count
    check (dedup_count >= 1);

comment on column nex_incident.dedup_count is
  'Owner-sealed 2026-11-08 (round 11) · number of times this '
  'signal has been observed. Starts at 1 on insert · bumped by '
  'bumpIncidentLastSeen() when a repeated signal re-fires in the '
  'in-process dedup window OR when a cross-request lookup matches '
  'the dedup_key + country.';

-- ─── 2. Priority-3 read-path indexes ───────────────────────────

-- fetchVerifiedIncidents · ORDER BY verified_at DESC WHERE status='VERIFIED'.
create index if not exists idx_nex_incident_verified_at
  on nex_incident (verified_at desc)
  where status = 'VERIFIED' and verified_at is not null;

-- fetchRecentlyClosed · ORDER BY resolved_at DESC WHERE status='CLOSED'.
create index if not exists idx_nex_incident_closed_at
  on nex_incident (resolved_at desc)
  where status = 'CLOSED' and resolved_at is not null;

-- fetchReopened step-1 · VERIFIED rows by correlation_id · partial.
create index if not exists idx_nex_incident_correlation_status
  on nex_incident (correlation_id, status, verified_at desc)
  where correlation_id is not null;

-- ─── 3. History ledger ──────────────────────────────────────────

insert into nex_migration_history (version, description, notes)
  values (
    '305',
    'nex_incident v2 perf · dedup_count + 3 read-path indexes',
    'Owner-authorised 2026-11-08 (round 11) · sandbox only · closes Priority-2 follow-ups from migration 304 · historical rows default dedup_count=1.'
  )
  on conflict do nothing;

commit;
