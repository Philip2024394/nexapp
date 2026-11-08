-- 301_nex_hq_direct_channel.rollback.sql
-- Owner-authorised 2026-11-08 · reverse of 301_nex_hq_direct_channel.sql.
-- The sentinel nex_account row is intentionally left in place · removing
-- it would FK-cascade historical messages. Delete manually only if the
-- entire HQ direct-channel feature is being retired.

begin;

delete from nex_migration_history where version = '301';

drop function if exists nex_hq_direct_send(uuid, uuid, text);
drop function if exists nex_hq_direct_channel_upsert(uuid, uuid);

drop table if exists nex_hq_direct_channel;

commit;
