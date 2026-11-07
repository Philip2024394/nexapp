-- 284_nex_purge_expired_peer_messages.sql
-- -----------------------------------------------------------------------------
-- NEX Chat · disappearing messages purge function · owner-sealed 2026-11-07.
--
-- STATUS: AUTHORED · NOT YET APPLIED. Owner authorisation covers
-- preparation + content review only. A separate explicit application
-- authorisation is required before this migration touches any database.
--
-- Pairs with migration 282 (account default) and 283 (per-message column).
--
-- WHAT THIS DOES
--   · Defines nex_purge_expired_peer_messages() which deletes every
--     nex_peer_message row where disappearing_at is non-null AND has
--     already passed. Returns the count of deleted rows for
--     observability.
--   · Attachment cleanup: the sealed Bridge 78 cascade (which already
--     purges attachments when their message rows are deleted) handles
--     the storage side · no new storage code needed here.
--   · SECURITY DEFINER + pinned search_path for routine
--     privilege-escalation hygiene. GRANTed EXECUTE only to the
--     service_role so Node-side schedulers can call it · the
--     authenticated role must NEVER be able to trigger a mass delete.
--
-- SCHEDULING OPTIONS (pick one at enablement time · owner-authorised
-- separately):
--
--   Option A · pg_cron (preferred when the Supabase project has the
--   extension enabled). Run every minute:
--
--     select cron.schedule(
--       'nex-purge-expired-peer-messages',
--       '* * * * *',
--       $$select public.nex_purge_expired_peer_messages()$$
--     );
--
--   Option B · external scheduler calling the Node-side wrapper
--   scripts/nex-purge-expired-peer-messages.mjs via GitHub Actions
--   cron, Vercel cron, or NEX-internal scheduler. The wrapper uses
--   the service-role client to invoke this SQL function.
--
-- Owner directive 2026-11-07: "Expiry should not introduce server-side
-- storage of message content or unnecessary message retention." This
-- function enforces the retention side · after the timer elapses the
-- row AND its attachment are removed from NEX servers. Device-local
-- copies (recipient's cache, screenshots) are out of scope.

begin;

create or replace function public.nex_purge_expired_peer_messages()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  with deleted as (
    delete from nex_peer_message
    where disappearing_at is not null
      and disappearing_at <= now()
    returning 1
  )
  select count(*) into v_deleted from deleted;
  return v_deleted;
end;
$$;

comment on function public.nex_purge_expired_peer_messages() is
  'Owner-sealed 2026-11-07 · deletes nex_peer_message rows whose
   disappearing_at timestamp has passed. Returns the count deleted.
   Called by the scheduler (pg_cron or external). Attachments cascade
   via the sealed Bridge 78 delete trigger · no extra storage code.
   EXECUTE grant RESTRICTED to service_role.';

-- Lock down · only service_role may execute. Authenticated role must
-- NEVER be able to trigger a mass delete via PostgREST RPC.
revoke all on function public.nex_purge_expired_peer_messages() from public;
revoke all on function public.nex_purge_expired_peer_messages() from authenticated;
grant execute on function public.nex_purge_expired_peer_messages() to service_role;

commit;
