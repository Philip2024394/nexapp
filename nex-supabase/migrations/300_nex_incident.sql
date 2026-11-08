-- 300_nex_incident.sql
-- -----------------------------------------------------------------------------
-- NEX Security & Recovery · incident model.
-- Owner-sealed 2026-11-08.
-- STATUS · AUTHORED · NOT YET APPLIED to production.
--
-- Scope · the existing nex_surface_health_event table remains for
-- FRONTEND surface failures (render errors, theme asset loads,
-- renderer crashes). This NEW nex_incident table covers BACKEND,
-- SERVICE, SECURITY, DATABASE, STORAGE and JOB incidents · the
-- domains a Security & Recovery Centre needs to surface and act on.
--
-- Doctrine · one incident per correlated event cluster. The incident
-- carries status (lifecycle), severity, scope (which NEX section),
-- country, and a running history of status transitions in a
-- companion table so the main row stays append-only-ish (operator
-- resolution fields are the only in-place updates · see RLS).
--
-- Status lifecycle (owner-sealed)
--   DETECTED → INVESTIGATING → PROTECTING → RECOVERING → RECOVERED
--     → MONITORING → CLOSED
--   NEEDS_ADMIN is a parallel terminal-ish state · reachable from
--     DETECTED/INVESTIGATING/PROTECTING/RECOVERING when automatic
--     recovery is unsafe or has repeatedly failed.
--
-- Legal transitions enforced at the application layer (not a DB
-- trigger · gives the service module clear control + explainability).
--
-- Content safety · NEVER store passwords, tokens, chat body, private
-- IPs, stack traces or user identifiers that are not the intended
-- actor_account_id. The `summary` column is operator-facing text
-- redacted by the recorder service · never raw log output.
--
-- Role scoping · identical pattern to migrations 290-299 · service_role
-- INSERT + SELECT + UPDATE (operator resolution fields) · anon +
-- authenticated explicit REVOKE + ENABLE ROW LEVEL SECURITY with zero
-- policies for those roles so service_role is the only writer.

begin;

create table if not exists nex_incident (
  id                      uuid         primary key default gen_random_uuid(),
  correlation_id          text         null,

  -- Classification
  category                text         not null,
  severity                text         not null,
  scope                   text         not null,
  country                 text         not null,

  -- Current state
  status                  text         not null default 'DETECTED',
  users_affected_count    integer      not null default 0,
  admin_action_required   boolean      not null default false,

  -- Narrative · operator-facing, redacted summary and the last
  -- recovery_action_taken (short free text)
  summary                 text         null,
  recovery_action_taken   text         null,

  -- Timestamps
  detected_at             timestamptz  not null default now(),
  resolved_at             timestamptz  null,
  updated_at              timestamptz  not null default now(),

  -- Operator resolution
  acknowledged_by         uuid         null,
  acknowledged_at         timestamptz  null,
  assigned_to             uuid         null,
  resolution_notes        text         null,

  constraint ck_nex_incident_category check (category in (
    'security','recovery','database','service','backend','storage','job','auth','rate_limit','attack','degraded'
  )),
  constraint ck_nex_incident_severity check (severity in (
    'info','warn','critical'
  )),
  constraint ck_nex_incident_status check (status in (
    'DETECTED','INVESTIGATING','PROTECTING','RECOVERING','RECOVERED','MONITORING','NEEDS_ADMIN','CLOSED'
  )),
  constraint ck_nex_incident_scope check (scope in (
    'chat','shops','feed','live','directory','food','fashion','accommodation','property','hq','infra','auth','storage','db','cron'
  )),
  constraint ck_nex_incident_country check (country in (
    'ireland','indonesia','worldwide','hq','global'
  )),
  constraint ck_nex_incident_users_affected check (users_affected_count >= 0)
);

create index if not exists idx_nex_incident_detected_at
  on nex_incident (detected_at desc);
create index if not exists idx_nex_incident_status_country
  on nex_incident (status, country, detected_at desc)
  where status not in ('CLOSED','RECOVERED');
create index if not exists idx_nex_incident_scope
  on nex_incident (scope, detected_at desc);
create index if not exists idx_nex_incident_severity_open
  on nex_incident (severity, detected_at desc)
  where status not in ('CLOSED','RECOVERED');

-- Companion table · append-only lifecycle event log per incident.
create table if not exists nex_incident_event (
  id                      bigserial    primary key,
  incident_id             uuid         not null references nex_incident(id) on delete cascade,
  kind                    text         not null,
  at                      timestamptz  not null default now(),
  actor_account_id        uuid         null,
  from_status             text         null,
  to_status               text         null,
  note                    text         null,
  metadata                jsonb        not null default '{}'::jsonb,

  constraint ck_nex_incident_event_kind check (kind in (
    'created','status_transition','recovery_attempt','recovery_success','recovery_failure',
    'acknowledged','assigned','admin_note','escalated','resolved','reopened'
  )),
  constraint ck_nex_incident_event_metadata_shape check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_nex_incident_event_incident
  on nex_incident_event (incident_id, at desc);

-- RLS + grants (identical discipline to migrations 290-299)

alter table nex_incident enable row level security;
revoke all on nex_incident from public;
revoke all on nex_incident from authenticated;
revoke all on nex_incident from anon;
revoke all on nex_incident from service_role;
grant select, insert, update on nex_incident to service_role;

alter table nex_incident_event enable row level security;
revoke all on nex_incident_event from public;
revoke all on nex_incident_event from authenticated;
revoke all on nex_incident_event from anon;
revoke all on nex_incident_event from service_role;
grant select, insert on nex_incident_event to service_role;
grant usage, select on sequence nex_incident_event_id_seq to service_role;

comment on table nex_incident is
  'Owner-sealed 2026-11-08 · backend/service/security incident model
  for the Security & Recovery Centre. Separate from nex_surface_health_
  event which covers frontend surfaces. service_role writers only.';
comment on table nex_incident_event is
  'Owner-sealed 2026-11-08 · append-only lifecycle event log per
  incident. INSERT-only for service_role · no UPDATE/DELETE granted.';

insert into nex_migration_history (version, description, notes)
  values (
    '300',
    'Security & Recovery · nex_incident + nex_incident_event',
    'Owner-sealed 2026-11-08. Distinct from nex_surface_health_event (frontend surfaces). Lifecycle: DETECTED→INVESTIGATING→PROTECTING→RECOVERING→RECOVERED/MONITORING→CLOSED; NEEDS_ADMIN parallel.'
  )
  on conflict (version) do nothing;

commit;
