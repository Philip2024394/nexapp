-- 305_nex_incident_v2_perf.rollback.sql · reverses migration 305.
begin;
  delete from nex_migration_history where version = '305';
  drop index if exists idx_nex_incident_verified_at;
  drop index if exists idx_nex_incident_closed_at;
  drop index if exists idx_nex_incident_correlation_status;
  alter table nex_incident
    drop constraint if exists ck_nex_incident_dedup_count,
    drop column if exists dedup_count;
commit;
