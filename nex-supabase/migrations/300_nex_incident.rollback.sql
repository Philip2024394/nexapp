begin;
drop table if exists nex_incident_event;
drop table if exists nex_incident;
delete from nex_migration_history where version = '300';
commit;
