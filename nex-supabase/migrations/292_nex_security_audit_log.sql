-- 292_nex_security_audit_log.sql
-- -----------------------------------------------------------------------------
-- NEX Security Programme · Item 5 · append-only security audit log.
-- Owner-sealed 2026-11-08.
--
-- STATUS: AUTHORED · NOT YET APPLIED. Owner directive 2026-11-08
-- authorises the schema design + application-side writer. Explicit
-- separate authorisation is required before applying this migration
-- to any environment.
--
-- Doctrine
--   · One row per security-relevant event · outcome enum covers
--     attempted, denied, completed, failed.
--   · Append-only at the DB permission level · service_role is
--     granted INSERT + SELECT · UPDATE, DELETE, TRUNCATE are revoked.
--     Pruning (if ever authorised) runs through a SECURITY DEFINER
--     function that is the only path to DELETE.
--   · actor_account_id is NULLABLE · ON DELETE SET NULL. Account
--     deletion does NOT cascade-delete audit history. The separate
--     deletion-integration (not in this migration) pseudonymises the
--     actor_identity snapshot at the same time.
--   · actor_identity is a snapshot of the key at the time of the
--     event · may be hashed-IP (ip:<sha256>) or account-scoped
--     (acct:<uuid>) · after pseudonymisation becomes erased:<random>.
--   · metadata is jsonb · the application layer enforces a per-event
--     allow-list before INSERT · unknown keys are stripped (writer
--     responsibility · DB does not enforce field names).
--   · NO retention policy rows inserted by this migration. An empty
--     nex_security_audit_retention table means "retain forever" by
--     default. Owner activates pruning explicitly via a separate
--     HQ-authorised insert.
--   · RLS enabled · zero policies for anon or authenticated · all
--     reads must go through requireHqAdmin() + a SECURITY DEFINER
--     helper function. No public exposure.

begin;

-- ─── Main table ───────────────────────────────────────────────────────

create table if not exists nex_security_audit_log (
  id                 bigserial    primary key,

  -- Event classification
  event              text         not null,
  outcome            text         not null,

  -- Actor · nullable so audit rows survive FK-target deletion
  actor_account_id   uuid         null
                       references nex_account(id)
                       on delete set null,
  actor_identity     text         null,

  -- Target · string column (no FK) so deleting the target does not
  -- cascade-break the audit trail. Callers populate with the stringified
  -- id · types specify the referenced table.
  target_type        text         null,
  target_id          text         null,

  -- Allow-listed structured context · writer validates keys.
  metadata           jsonb        not null default '{}'::jsonb,

  occurred_at        timestamptz  not null default now(),

  constraint ck_sec_audit_event
    check (event ~ '^[a-z][a-z0-9_]{2,127}\.[a-z][a-z0-9_]{2,63}(\.[a-z][a-z0-9_]{2,63})?$'),
  constraint ck_sec_audit_outcome
    check (outcome in ('attempted','denied','completed','failed')),
  constraint ck_sec_audit_actor_ident
    check (
      actor_identity is null
      or actor_identity ~ '^(acct|ip|erased):[a-z0-9-]{10,128}$'
    ),
  constraint ck_sec_audit_target_type
    check (target_type is null or target_type ~ '^[a-z][a-z0-9_]{2,63}$'),
  -- metadata must be a JSON object (never a scalar / array at top level)
  constraint ck_sec_audit_metadata_shape
    check (jsonb_typeof(metadata) = 'object')
);

-- Query indexes · aligned with the HQ viewer's filter surface.
create index if not exists idx_nex_sec_audit_occurred
  on nex_security_audit_log (occurred_at desc, id desc);
create index if not exists idx_nex_sec_audit_actor
  on nex_security_audit_log (actor_account_id, occurred_at desc)
  where actor_account_id is not null;
create index if not exists idx_nex_sec_audit_event
  on nex_security_audit_log (event, occurred_at desc);
create index if not exists idx_nex_sec_audit_outcome
  on nex_security_audit_log (outcome, occurred_at desc)
  where outcome in ('failed','denied');
create index if not exists idx_nex_sec_audit_target
  on nex_security_audit_log (target_type, target_id, occurred_at desc)
  where target_id is not null;

comment on table nex_security_audit_log is
  'Owner-sealed 2026-11-08 · append-only security audit log. Writer
  (service_role) has INSERT + SELECT only · UPDATE/DELETE/TRUNCATE are
  revoked at the role level. Readers must go through requireHqAdmin().
  Account-deletion pseudonymisation is a separate workflow · see the
  application-side audit writer.';

-- ─── RLS ─────────────────────────────────────────────────────────────

alter table nex_security_audit_log enable row level security;
-- Zero policies for anon or authenticated · all access flows through
-- service_role (writer + HQ-gated reader helpers).

-- ─── Permission grants · append-only at the DB level ────────────────

revoke all on nex_security_audit_log from public;
revoke all on nex_security_audit_log from authenticated;
revoke all on nex_security_audit_log from anon;
grant insert, select on nex_security_audit_log to service_role;
-- UPDATE, DELETE, TRUNCATE are intentionally NOT granted. The only
-- mutating operation possible under this permission set is INSERT ·
-- which is correct for an append-only log.
grant usage, select on sequence nex_security_audit_log_id_seq to service_role;

-- ─── Retention configuration ·  empty = retain forever ──────────────
--
-- Owner directive 2026-11-08 · no default retention rows. An empty
-- table means no pruning runs. Authorised retention policies are
-- inserted by HQ later · never by this migration.

create table if not exists nex_security_audit_retention (
  event_prefix   text         primary key,
  retain_days    integer      not null,
  authorised_by  text         not null,
  authorised_at  timestamptz  not null default now(),

  constraint ck_sec_audit_retain_prefix
    check (event_prefix ~ '^[a-z][a-z0-9_]{2,63}(\.[a-z][a-z0-9_]{2,63})?$'),
  constraint ck_sec_audit_retain_days
    check (retain_days > 0)
);

revoke all on nex_security_audit_retention from public;
revoke all on nex_security_audit_retention from authenticated;
revoke all on nex_security_audit_retention from anon;
grant select on nex_security_audit_retention to service_role;
-- INSERT/UPDATE/DELETE on retention is schema-owner only · HQ UI must
-- call a SECURITY DEFINER function that gates on requireHqAdmin
-- (defined in a later migration when the HQ UI ships).

comment on table nex_security_audit_retention is
  'Owner-sealed 2026-11-08 · HQ-authorised retention policy per event
  prefix. Empty table = retain forever. No default rows.';

-- ─── Sidecar · attempted-event reconciliation ───────────────────────
--
-- Writer protocol for external-system actions:
--   1. INSERT attempted row.  (if INSERT fails · abort action)
--   2. Perform external call.
--   3. INSERT completed or failed row.
--
-- Reconciliation detects attempted-without-completed/failed within the
-- event's declared window. Each reconciliation decision writes ONE row
-- here (not an UPDATE on the original · the original is immutable).

create table if not exists nex_security_audit_reconciliation (
  id                     bigserial    primary key,
  attempted_log_id       bigint       not null
                           references nex_security_audit_log(id),
  decision               text         not null,
  decided_at             timestamptz  not null default now(),
  notes                  text         null,

  constraint ck_sec_audit_recon_decision
    check (decision in ('unresolved','manually_resolved','matched_late')),
  -- One reconciliation row per original attempted · prevents duplicate
  -- noise if the reconciler runs more than once.
  unique (attempted_log_id)
);

revoke all on nex_security_audit_reconciliation from public;
revoke all on nex_security_audit_reconciliation from authenticated;
revoke all on nex_security_audit_reconciliation from anon;
grant insert, select, update on nex_security_audit_reconciliation to service_role;
-- update is permitted here (only on the sidecar · the main log stays
-- append-only) so the reconciler can transition unresolved → matched_late
-- when a very-late completion arrives.
grant usage, select on sequence nex_security_audit_reconciliation_id_seq to service_role;

comment on table nex_security_audit_reconciliation is
  'Owner-sealed 2026-11-08 · per-attempted-event reconciliation outcome.
  One row per attempted_log_id (unique). The main audit log stays
  append-only · this sidecar carries the reconciliation decision.';

-- ─── Migration history ──────────────────────────────────────────────

insert into nex_migration_history (version, description, notes)
  values (
    '292',
    'Phase 0 Security · nex_security_audit_log + retention + reconciliation',
    'Owner-sealed 2026-11-08. Append-only at the role level. RLS enabled with zero policies for anon/authenticated. Deletion-integration pseudonymisation is a separate workflow.'
  )
  on conflict (version) do nothing;

commit;
