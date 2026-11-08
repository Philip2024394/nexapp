-- 304_nex_incident_v2.rollback.sql · reverses migration 304.
-- SAFETY · a mid-flight rollback on a database that already has
-- VERIFIED-status rows or new scope values would VIOLATE the
-- narrowed CHECK constraints. The rollback below deletes those
-- extensions first, then narrows the CHECKs. Operate under the
-- assumption no live incidents are in the new states before
-- rolling back; otherwise the operator must reclassify first.
begin;
  delete from nex_migration_history where version = '304';

  drop index if exists idx_nex_incident_last_seen_at;
  drop index if exists idx_nex_incident_dedup_key;
  drop index if exists idx_nex_incident_status_country;
  drop index if exists idx_nex_incident_severity_open;

  alter table nex_incident_event
    drop constraint if exists ck_nex_incident_event_kind,
    add constraint ck_nex_incident_event_kind check (kind in (
      'created','status_transition','recovery_attempt',
      'recovery_success','recovery_failure','acknowledged',
      'assigned','admin_note','escalated','resolved','reopened'
    ));

  alter table nex_incident
    drop constraint if exists ck_nex_incident_verified_shape,
    drop constraint if exists ck_nex_incident_verification_pair,
    drop constraint if exists ck_nex_incident_service_shape,
    drop constraint if exists ck_nex_incident_detection_source,
    drop constraint if exists ck_nex_incident_dedup_key_shape,
    drop column if exists dedup_key,
    drop column if exists verified_at,
    drop column if exists verified_by_admin,
    drop column if exists service,
    drop column if exists detection_source,
    drop column if exists last_seen_at,
    drop constraint if exists ck_nex_incident_severity,
    add constraint ck_nex_incident_severity check (severity in (
      'info','warn','critical'
    )),
    drop constraint if exists ck_nex_incident_status,
    add constraint ck_nex_incident_status check (status in (
      'DETECTED','INVESTIGATING','PROTECTING','RECOVERING',
      'RECOVERED','MONITORING','NEEDS_ADMIN','CLOSED'
    )),
    drop constraint if exists ck_nex_incident_scope,
    add constraint ck_nex_incident_scope check (scope in (
      'chat','shops','feed','live','directory','food','fashion',
      'accommodation','property','hq','infra','auth','storage','db','cron'
    ));

  create index if not exists idx_nex_incident_status_country
    on nex_incident (status, country, detected_at desc)
    where status not in ('CLOSED','RECOVERED');

  create index if not exists idx_nex_incident_severity_open
    on nex_incident (severity, detected_at desc)
    where status not in ('CLOSED','RECOVERED');
commit;
