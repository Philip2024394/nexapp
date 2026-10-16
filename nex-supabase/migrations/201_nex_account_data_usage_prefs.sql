-- Migration 201 · Per-account data-usage preferences · R14 Stage 6
-- · 2026-10-15
-- --------------------------------------------------------------------------
-- STATUS: AUTHORED · NOT YET APPLIED. Owner authorisation covers
-- preparation and content review only. A separate explicit application
-- authorisation is required before this migration touches any database.
--
-- Adds four preference columns to nex_account for media auto-download
-- + upload quality.
--
-- Approved values (owner directive 2026-10-15):
--   auto_download_images, auto_download_videos, auto_download_audio
--     : text · default per column · CHECK IN
--       ('always', 'wifi_only', 'never')
--     Per-media auto-download policy. 'wifi_only' is BEST-EFFORT ·
--     depends on navigator.connection API where available. The UI
--     surfaces this limitation honestly · do NOT claim Wi-Fi-only
--     enforcement is guaranteed.
--
--     Defaults:
--       images → 'always'      (small payload · usual expectation)
--       videos → 'wifi_only'   (bandwidth-sensitive)
--       audio  → 'always'      (usually small voice notes)
--     These defaults are permissive by design · existing user
--     behaviour before this migration already auto-downloads
--     everything, so defaulting to 'always' / 'wifi_only' matches
--     current product behaviour and does NOT silently restrict
--     existing users (owner directive: "Never silently delete media
--     or existing user data").
--
--   upload_quality : text · default 'standard' · CHECK IN
--     ('standard', 'hd')
--     Upload-time compression tier. 'standard' downsamples large
--     images/videos; 'hd' preserves original. Enforced in the
--     client-side upload path before encryption · the server-side
--     attachment route stores whatever bytes it receives.
--
-- Enforcement surfaces (sealed services the data-usage-preferences-
-- service will be consulted from):
--   · src/lib/nex-native/crypto/encrypted-attachment-upload.ts ·
--     client-side upload path · reads upload_quality from a server-
--     resolved prop before compressing
--   · src/lib/nex-native/crypto/encrypted-receive.ts · client-side
--     auto-download gate · reads auto_download_* from a server-
--     resolved prop before fetching ciphertext bytes
--
-- Both enforcement sites are client-side (where the UI needs the
-- preference) · the preference VALUE is server-sourced via the
-- sealed data-usage-preferences-service and passed as a prop.
--
-- Honest limitation: Wi-Fi detection relies on
-- `navigator.connection.type === 'wifi'` which has limited browser
-- support. When the API is unavailable, 'wifi_only' falls through to
-- 'always' and the UI surfaces this limitation.
--
-- Doctrine (owner-approved 2026-10-15):
--   · Fail-closed · a service-layer error reading preferences
--     returns the SEALED DEFAULTS (not privacy-maximum · media
--     preferences are UX, not privacy). Same discipline as other
--     preference services for row-absence.
--   · Permissive defaults match current product behaviour · do NOT
--     silently restrict existing users.
--
-- Owner directive 2026-10-15: "Do not apply this to the live database
-- without separate explicit application authorisation."

alter table nex_account
  add column if not exists auto_download_images text not null default 'always',
  add column if not exists auto_download_videos text not null default 'wifi_only',
  add column if not exists auto_download_audio text not null default 'always',
  add column if not exists upload_quality text not null default 'standard';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nex_account_auto_download_images_check'
  ) then
    alter table nex_account
      add constraint nex_account_auto_download_images_check
      check (auto_download_images in ('always', 'wifi_only', 'never'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nex_account_auto_download_videos_check'
  ) then
    alter table nex_account
      add constraint nex_account_auto_download_videos_check
      check (auto_download_videos in ('always', 'wifi_only', 'never'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nex_account_auto_download_audio_check'
  ) then
    alter table nex_account
      add constraint nex_account_auto_download_audio_check
      check (auto_download_audio in ('always', 'wifi_only', 'never'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nex_account_upload_quality_check'
  ) then
    alter table nex_account
      add constraint nex_account_upload_quality_check
      check (upload_quality in ('standard', 'hd'));
  end if;
end $$;

comment on column nex_account.auto_download_images is
  'R14 Stage 6 · per-media auto-download policy for images. One of ''always'' / ''wifi_only'' / ''never''. ''wifi_only'' is best-effort via navigator.connection (unreliable in some browsers · falls through to ''always'' when the API is unavailable). Default ''always'' matches existing product behaviour.';

comment on column nex_account.auto_download_videos is
  'R14 Stage 6 · per-media auto-download policy for videos. One of ''always'' / ''wifi_only'' / ''never''. Default ''wifi_only'' acknowledges bandwidth sensitivity · users on cellular see a "tap to download" placeholder.';

comment on column nex_account.auto_download_audio is
  'R14 Stage 6 · per-media auto-download policy for audio. One of ''always'' / ''wifi_only'' / ''never''. Default ''always'' · voice-note sized.';

comment on column nex_account.upload_quality is
  'R14 Stage 6 · upload-time compression tier. One of ''standard'' / ''hd''. Enforced client-side in the sealed encrypted-attachment-upload path before encryption. ''standard'' downsamples large images/videos; ''hd'' preserves original. Default ''standard'' matches historic bandwidth-conscious behaviour.';
