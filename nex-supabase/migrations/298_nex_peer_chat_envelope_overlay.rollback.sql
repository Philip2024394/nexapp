-- 298_nex_peer_chat_envelope_overlay.rollback.sql
-- Drops the overlay table. Historical migrations recorded here are
-- lost on rollback · the public-bucket copies remain, so legacy
-- clients continue to work via storage_url. A subsequent rebuild
-- would re-populate via the migration tool.

begin;
drop table if exists nex_peer_chat_envelope_overlay;
delete from nex_migration_history where version = '298';
commit;
