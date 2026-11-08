-- 306_nex_peer_message_call_invite.rollback.sql · reverses mig 306.
-- WARNING · fails if any row currently has attachment_type='call_invite'.
begin;
  delete from nex_migration_history where version = '306';
  alter table nex_peer_message
    drop constraint if exists nex_peer_message_attachment_type_check,
    add constraint nex_peer_message_attachment_type_check check (
      attachment_type is null
      or attachment_type in ('image', 'video', 'audio')
    );
commit;
