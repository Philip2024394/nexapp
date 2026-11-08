-- 295_nex_peer_chat_ciphertext_bucket.rollback.sql
-- Drops the three RLS policies scoped to nex-peer-chat-ciphertext.
-- Does NOT delete the bucket or its objects · bucket deletion is
-- done via the Supabase Storage API only.

begin;

drop policy if exists nex_peer_chat_ciphertext_service_role_all on storage.objects;
drop policy if exists nex_peer_chat_ciphertext_anon_deny on storage.objects;
drop policy if exists nex_peer_chat_ciphertext_authenticated_deny on storage.objects;

delete from nex_migration_history where version = '295';

commit;
