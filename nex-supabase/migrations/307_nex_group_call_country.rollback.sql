-- 307_nex_group_call_country.rollback.sql · reverses mig 307.
begin;
  delete from nex_migration_history where version = '307';
  drop index if exists idx_nex_group_call_participant_cross_country;
  drop index if exists idx_nex_group_call_session_host_country;
  alter table nex_group_call_participant
    drop constraint if exists ck_group_call_participant_consent_shape,
    drop constraint if exists ck_group_call_participant_joined_from_country,
    drop column if exists cross_country_consent_at,
    drop column if exists joined_from_country;
  alter table nex_group_call_session
    drop constraint if exists ck_group_call_session_host_country,
    drop column if exists host_country;
commit;
