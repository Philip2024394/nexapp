-- 304_nex_incident_v2.sql
-- -----------------------------------------------------------------------------
-- NEX Incident v2 · Priority 2 remediation of the World-Class Safety
-- Audit. Owner-authorised 2026-11-08 (round 8).
-- STATUS · AUTHORED · APPLIED TO SANDBOX ONLY · NOT APPLIED to production
-- (ijvqdvsvwtwxzcqmoqit) per CLAUDE.md §5 Safety Constitution + owner's
-- explicit hold on production application for mig 302, 303, 304, 305.
--
-- Doctrine context (owner directive 2026-11-08 · round 8)
--   1. Add HIGH severity tier between warn and critical.
--   2. Separate incident lifecycle so DETECTED / RECOVERY_ATTEMPTED /
--      VERIFIED_RESOLVED are genuinely distinct. VERIFIED is a NEW
--      status that only an HQ admin can transition to. Historical
--      RECOVERED rows stay RECOVERED · never silently reinterpreted.
--   3. Add last_seen_at + detection_source + service columns.
--   4. Expand scope enum to include 'settings' and 'community'.
--   5. Add a stable incident_dedup_key for country-aware dedup.
--   6. Add 'verified' event kind to nex_incident_event.
--
-- Historical compatibility invariants
--   · Existing nex_incident rows are UNTOUCHED in status + severity.
--   · verified_by_admin + verified_at default to NULL · a historical
--     RECOVERED row without a verification stays "RECOVERED awaiting
--     verification". Only an HQ operator can transition it to
--     VERIFIED (new state).
--   · last_seen_at is backfilled to detected_at for existing rows so
--     the column is non-null and readers can rely on it.
--   · detection_source defaults to 'unknown' for backfilled rows ·
--     honest · we do NOT fabricate a source for historical records.
--   · service defaults to NULL · future signals populate it; old rows
--     have no service column by definition.
--
-- Rollback
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '304';
--     DROP INDEX IF EXISTS idx_nex_incident_last_seen_at;
--     DROP INDEX IF EXISTS idx_nex_incident_dedup_key;
--     ALTER TABLE nex_incident_event
--       DROP CONSTRAINT IF EXISTS ck_nex_incident_event_kind,
--       ADD CONSTRAINT ck_nex_incident_event_kind CHECK (kind in (
--         'created','status_transition','recovery_attempt',
--         'recovery_success','recovery_failure','acknowledged',
--         'assigned','admin_note','escalated','resolved','reopened'
--       ));
--     ALTER TABLE nex_incident
--       DROP COLUMN IF EXISTS last_seen_at,
--       DROP COLUMN IF EXISTS detection_source,
--       DROP COLUMN IF EXISTS service,
--       DROP COLUMN IF EXISTS verified_by_admin,
--       DROP COLUMN IF EXISTS verified_at,
--       DROP COLUMN IF EXISTS dedup_key,
--       DROP CONSTRAINT IF EXISTS ck_nex_incident_severity,
--       ADD CONSTRAINT ck_nex_incident_severity CHECK (severity in (
--         'info','warn','critical'
--       )),
--       DROP CONSTRAINT IF EXISTS ck_nex_incident_status,
--       ADD CONSTRAINT ck_nex_incident_status CHECK (status in (
--         'DETECTED','INVESTIGATING','PROTECTING','RECOVERING',
--         'RECOVERED','MONITORING','NEEDS_ADMIN','CLOSED'
--       )),
--       DROP CONSTRAINT IF EXISTS ck_nex_incident_scope,
--       ADD CONSTRAINT ck_nex_incident_scope CHECK (scope in (
--         'chat','shops','feed','live','directory','food','fashion',
--         'accommodation','property','hq','infra','auth','storage',
--         'db','cron'
--       ));
--   COMMIT;

begin;

-- ─── 1. Expand severity CHECK to add 'high' tier ──────────────────

alter table nex_incident
  drop constraint if exists ck_nex_incident_severity;

alter table nex_incident
  add constraint ck_nex_incident_severity check (severity in (
    'info', 'warn', 'high', 'critical'
  ));

-- ─── 2. Add VERIFIED status (distinct from RECOVERED) ─────────────

alter table nex_incident
  drop constraint if exists ck_nex_incident_status;

alter table nex_incident
  add constraint ck_nex_incident_status check (status in (
    'DETECTED',
    'INVESTIGATING',
    'PROTECTING',
    'RECOVERING',
    'RECOVERED',       -- auto-recovery claimed · awaiting operator verification
    'MONITORING',
    'VERIFIED',        -- NEW · operator has verified the recovery
    'NEEDS_ADMIN',
    'CLOSED'
  ));

-- ─── 3. Expand scope enum (settings + community) ──────────────────

alter table nex_incident
  drop constraint if exists ck_nex_incident_scope;

alter table nex_incident
  add constraint ck_nex_incident_scope check (scope in (
    'chat','shops','feed','live','directory','food','fashion',
    'accommodation','property','hq','infra','auth','storage','db','cron',
    'settings','community'
  ));

-- ─── 4. New columns ───────────────────────────────────────────────

-- last_seen_at · a signal that re-fires (same dedup key) bumps this
-- instead of inserting a new row. Backfill to detected_at.
alter table nex_incident
  add column if not exists last_seen_at timestamptz;

update nex_incident
   set last_seen_at = detected_at
 where last_seen_at is null;

alter table nex_incident
  alter column last_seen_at set not null,
  alter column last_seen_at set default now();

-- detection_source · how we knew. Bounded enum.
alter table nex_incident
  add column if not exists detection_source text;

update nex_incident
   set detection_source = 'unknown'
 where detection_source is null;

alter table nex_incident
  alter column detection_source set not null,
  alter column detection_source set default 'unknown';

alter table nex_incident
  drop constraint if exists ck_nex_incident_detection_source;

alter table nex_incident
  add constraint ck_nex_incident_detection_source check (detection_source in (
    'section_boundary',    -- SegmentErrorBoundary or SectionBoundary POST
    'section_probe',       -- /api/nex-native/health ?scope=sections
    'core_probe',          -- /api/nex-native/health core
    'security_signal',     -- security-monitor.ts reportX fns
    'audit_reconciler',    -- nightly audit-reconcile cron
    'manual',              -- HQ operator opened an incident by hand
    'external_webhook',    -- future · third-party source
    'unknown'              -- backfilled historical rows only
  ));

-- service · optional free-text dependency name. Short bound.
alter table nex_incident
  add column if not exists service text;

alter table nex_incident
  drop constraint if exists ck_nex_incident_service_shape;

alter table nex_incident
  add constraint ck_nex_incident_service_shape check (
    service is null
    or (char_length(service) between 1 and 64 and service ~ '^[a-z][a-z0-9_.-]{0,63}$')
  );

-- verified_by_admin + verified_at · set ONLY when an HQ operator
-- transitions an incident to VERIFIED. Historical RECOVERED rows
-- stay NULL · they are NOT retroactively verified.
alter table nex_incident
  add column if not exists verified_by_admin uuid references nex_account(id) on delete set null;

alter table nex_incident
  add column if not exists verified_at timestamptz;

-- Integrity · verified_by_admin AND verified_at must either BOTH be
-- NULL or BOTH be set. Prevents partial writes.
alter table nex_incident
  drop constraint if exists ck_nex_incident_verification_pair;

alter table nex_incident
  add constraint ck_nex_incident_verification_pair check (
    (verified_by_admin is null and verified_at is null)
    or
    (verified_by_admin is not null and verified_at is not null)
  );

-- VERIFIED status requires the verification pair to be set. An
-- incident cannot be in VERIFIED with no verifier.
alter table nex_incident
  drop constraint if exists ck_nex_incident_verified_shape;

alter table nex_incident
  add constraint ck_nex_incident_verified_shape check (
    status <> 'VERIFIED'
    or (verified_by_admin is not null and verified_at is not null)
  );

-- dedup_key · stable per (scope, category, country, correlation).
-- Nullable because historical rows don't have it; new rows written
-- by security-monitor.ts always populate it.
alter table nex_incident
  add column if not exists dedup_key text;

alter table nex_incident
  drop constraint if exists ck_nex_incident_dedup_key_shape;

alter table nex_incident
  add constraint ck_nex_incident_dedup_key_shape check (
    dedup_key is null
    or (char_length(dedup_key) between 1 and 256 and dedup_key ~ '^[a-z][a-z0-9_.|:-]{0,255}$')
  );

-- ─── 5. Event kind expansion · add 'verified' ─────────────────────

alter table nex_incident_event
  drop constraint if exists ck_nex_incident_event_kind;

alter table nex_incident_event
  add constraint ck_nex_incident_event_kind check (kind in (
    'created','status_transition','recovery_attempt',
    'recovery_success','recovery_failure','acknowledged',
    'assigned','admin_note','escalated','resolved','reopened',
    'verified'           -- NEW · operator-marked VERIFIED transition
  ));

-- ─── 6. Indexes ───────────────────────────────────────────────────

-- Hot read · "incidents that haven't been seen for N minutes" for
-- retention / auto-close logic.
create index if not exists idx_nex_incident_last_seen_at
  on nex_incident (last_seen_at desc);

-- Hot read · country-aware dedup lookup (scope + country + status).
-- The service reads this to find an open-same-signature incident
-- before inserting a new one.
create index if not exists idx_nex_incident_dedup_key
  on nex_incident (dedup_key, country, status)
  where dedup_key is not null and status not in ('CLOSED','VERIFIED');

-- Replace the old open-incidents index to include VERIFIED as a
-- terminal/closed-ish state for display filtering. VERIFIED rows
-- appear separately in HQ UI; they are NOT "open" for operator
-- action.
drop index if exists idx_nex_incident_status_country;
create index if not exists idx_nex_incident_status_country
  on nex_incident (status, country, detected_at desc)
  where status not in ('CLOSED','RECOVERED','VERIFIED');

drop index if exists idx_nex_incident_severity_open;
create index if not exists idx_nex_incident_severity_open
  on nex_incident (severity, detected_at desc)
  where status not in ('CLOSED','RECOVERED','VERIFIED');

-- ─── 7. History ledger ────────────────────────────────────────────

insert into nex_migration_history (version, description, notes)
  values (
    '304',
    'nex_incident v2 · HIGH severity + VERIFIED state + 5 new columns + dedup_key + verified event kind + settings/community scope',
    'Owner-authorised 2026-11-08 (round 8) Priority 2. Sandbox only · production sealed. Historical incident data preserved · no retroactive reinterpretation of RECOVERED as VERIFIED.'
  )
  on conflict do nothing;

commit;
