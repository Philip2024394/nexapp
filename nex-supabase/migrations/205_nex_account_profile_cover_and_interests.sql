-- Migration 205 · nex_account_profile · cover + interests · 2026-10-17
-- --------------------------------------------------------------------------
-- STATUS: AUTHORED · NOT YET APPLIED. Owner authorisation covers
-- preparation and content review only. A separate explicit application
-- authorisation is required before this migration touches any database.
--
-- Adds two columns to nex_account_profile (migration 042) in support of
-- the sealed 2026-10-17 canonical NEX user-profile UI at
-- /nex-native/profile/[handle]. The design (owner-approved Emma Wilson
-- reference) calls for:
--   · A full-bleed hero cover photo above the identity block
--   · A "Shared Interests" pill grid under the bio
--
-- Columns:
--
--   cover_image_url  : text · nullable
--     URL of the owner's chosen hero background image. NULL means the
--     profile falls back to a gradient hero (no fabricated photo).
--     Hosted on the sealed NEX storage bucket · the URL is a signed
--     public read. Length cap matches existing avatar_url convention
--     (no explicit CHECK · same as avatar_url in migration 042).
--
--   interests        : text[] NOT NULL DEFAULT '{}'
--     Owner-selected personal interests surfaced as the "Shared
--     Interests" pill grid. Separate from `skills` (professional) and
--     `looking_for` (socials intents) · owner-sealed as the "personal
--     interests" axis. Max 20 elements · same array-cap convention as
--     the existing `skills` column.
--
-- Doctrine (owner-approved 2026-10-17):
--   · Additive only · existing rows get cover_image_url=NULL and
--     interests='{}' atomically on apply · zero backfill required ·
--     zero migration-time data loss risk.
--   · Reversible · ALTER TABLE ... DROP COLUMN restores the pre-apply
--     schema shape · stored user data on these two columns is lost on
--     drop (destructive to user intent · same as every DROP COLUMN).
--   · Idempotent · ADD COLUMN IF NOT EXISTS + DO $$ ... $$ CHECK
--     constraint guards · safe to apply repeatedly.
--   · Honest-null · the UI never fabricates a cover photo or an
--     interest · when the column is NULL/empty the surface omits the
--     corresponding section entirely.
--
-- Owner directive 2026-10-17: "Do not apply this to the live database
-- without separate explicit application authorisation."

alter table nex_account_profile
  add column if not exists cover_image_url text,
  add column if not exists interests text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nex_account_profile_interests_max'
  ) then
    alter table nex_account_profile
      add constraint nex_account_profile_interests_max
      check (array_length(interests, 1) is null or array_length(interests, 1) <= 20);
  end if;
end $$;

comment on column nex_account_profile.cover_image_url is
  'Hero cover photo URL · nullable · surfaced on the canonical /nex-native/profile/[handle] page as a full-bleed backdrop above the identity block. NULL falls back to a gradient hero · never fabricated. Sealed 2026-10-17.';

comment on column nex_account_profile.interests is
  'Owner-selected personal interests · surfaced as the "Shared Interests" pill grid on /nex-native/profile/[handle]. Separate axis from the "skills" (professional) and "looking_for" (socials) columns. Max 20 elements. Default empty array means the pill grid is omitted entirely. Sealed 2026-10-17.';
