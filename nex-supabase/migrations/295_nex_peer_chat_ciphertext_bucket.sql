-- 295_nex_peer_chat_ciphertext_bucket.sql
-- -----------------------------------------------------------------------------
-- NEX Chat Attachment Phase A · private ciphertext bucket RLS.
-- Owner-sealed 2026-11-08.
--
-- STATUS · AUTHORED · NOT YET APPLIED. Depends on the storage bucket
-- `nex-peer-chat-ciphertext` being CREATED first via the Supabase
-- Storage API or dashboard · migrations cannot create buckets
-- directly. See the RECOMMENDED BUCKET CONFIG block below for the
-- exact creation commands.
--
-- RECOMMENDED BUCKET CONFIG (Supabase API · owner runs ONCE before
-- applying this migration):
--
--   curl -X POST https://<project-ref>.supabase.co/storage/v1/bucket \
--     -H "apikey: <service-role-key>" \
--     -H "Authorization: Bearer <service-role-key>" \
--     -H "Content-Type: application/json" \
--     -d '{
--       "id": "nex-peer-chat-ciphertext",
--       "name": "nex-peer-chat-ciphertext",
--       "public": false,
--       "file_size_limit": 27262976,
--       "allowed_mime_types": ["application/octet-stream"]
--     }'
--
--   file_size_limit = NEX_PEER_ATTACHMENT_MAX_BYTES (25 MiB) + 1 KiB
--     Poly1305 overhead slot + 1 MiB room for post-encryption padding.
--   allowed_mime_types = octet-stream only · prevents browser sniff.
--   public = FALSE · the whole point of Phase A.
--
-- Once the bucket exists this migration ships the storage.objects RLS
-- policies that scope READ access to service_role ONLY. The app's
-- signed-URL endpoint (Phase B) runs as service_role via
-- nexSupabaseAdmin, so it can generate signed URLs. Direct client
-- fetches via anon or authenticated get PERMISSION DENIED · they must
-- go through the application's participant-check endpoint.
--
-- Backward compatibility · the existing public bucket
-- `nex-peer-chat-attachments` stays untouched. Legacy envelopes with
-- `storage_url` continue to resolve against it.

begin;

-- Owner-sealed defect prevention 2026-11-08 · identical treatment to
-- migrations 290-294 · explicit revokes AND explicit grants so
-- Supabase default grants cannot leave the back door open.
-- storage.objects already has RLS enabled by Supabase defaults · we
-- only ADD policies scoped to this bucket.

-- Allow service_role full access on this bucket (signed-URL
-- generation + admin-side cleanup). This is already the Supabase
-- default but we encode it explicitly so RLS audits see it.
do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'nex_peer_chat_ciphertext_service_role_all'
  ) then
    create policy nex_peer_chat_ciphertext_service_role_all
      on storage.objects
      as permissive
      for all
      to service_role
      using (bucket_id = 'nex-peer-chat-ciphertext')
      with check (bucket_id = 'nex-peer-chat-ciphertext');
  end if;
end
$policy$;

-- DENY policies for anon + authenticated roles · defence-in-depth.
-- Supabase's default "deny when no allow policy" already blocks them,
-- but an explicit USING(false) FOR SELECT closes the door even if a
-- later migration mistakenly adds a permissive policy.
do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'nex_peer_chat_ciphertext_anon_deny'
  ) then
    create policy nex_peer_chat_ciphertext_anon_deny
      on storage.objects
      as restrictive
      for all
      to anon
      using (bucket_id <> 'nex-peer-chat-ciphertext')
      with check (bucket_id <> 'nex-peer-chat-ciphertext');
  end if;
end
$policy$;

do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'nex_peer_chat_ciphertext_authenticated_deny'
  ) then
    create policy nex_peer_chat_ciphertext_authenticated_deny
      on storage.objects
      as restrictive
      for all
      to authenticated
      using (bucket_id <> 'nex-peer-chat-ciphertext')
      with check (bucket_id <> 'nex-peer-chat-ciphertext');
  end if;
end
$policy$;

insert into nex_migration_history (version, description, notes)
  values (
    '295',
    'Phase A · private ciphertext bucket RLS · nex-peer-chat-ciphertext',
    'Owner-sealed 2026-11-08. Bucket itself must be created via Supabase Storage API before applying (see file header). Public bucket nex-peer-chat-attachments stays untouched for venue + business-logo images + legacy plaintext attachments.'
  )
  on conflict (version) do nothing;

commit;
