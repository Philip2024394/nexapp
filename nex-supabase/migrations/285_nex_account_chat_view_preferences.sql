-- 285_nex_account_chat_view_preferences.sql
-- -----------------------------------------------------------------------------
-- NEX Chat · viewer-side chat view preferences · owner-sealed 2026-11-07.
--
-- STATUS: AUTHORED · NOT YET APPLIED. Owner authorisation covers
-- preparation + content review only. A separate explicit application
-- authorisation is required before this migration touches any database.
--
-- Adds five preference columns to nex_account covering the remaining
-- Chat Settings Hub sections 5, 6 and 7 per owner directive 2026-11-07
-- ("yes all sections fully wired and ready for live user").
--
-- Semantics (sealed 2026-11-07):
--
--   screenshot_copy_protection_enabled  boolean · default FALSE
--     Viewer-side preference. When TRUE the chat page applies CSS
--     user-select:none + contextmenu-block + copy-event-block to the
--     chat message list in the VIEWER's own browser. Does NOT force
--     protection on other users who view the same chat · that would
--     require sender-forced "view once" semantics (future phase).
--     Web platform cannot fully block OS-level screenshots · the UI
--     copy says so honestly.
--
--   chat_font_family  text · default 'default' · CHECK IN
--     ('default', 'system', 'serif', 'monospace', 'handwritten')
--     Viewer-side preference. Applies to the viewer's own chat view
--     only · contacts never see a different font because of this
--     setting.
--
--   chat_font_size  text · default 'medium' · CHECK IN
--     ('small', 'medium', 'large')
--     Viewer-side preference. Applies to the viewer's own chat view
--     only.
--
--   chat_bg_from_shop_cover  boolean · default FALSE
--     Viewer-side preference. When TRUE the viewer's chat page
--     background renders using their own shop's cover image instead
--     of the default chat-theme background. Falls back to the theme
--     default when the viewer has no shop OR the shop has no cover.
--
--   shop_cover_from_chat_theme  boolean · default FALSE
--     Viewer-side preference. When TRUE the viewer's own shop page
--     renders their chat theme's hero image as the cover background.
--     Visible only when the viewer is logged in on their OWN shop
--     page · non-owners always see the real shop cover.
--
-- Doctrine:
--   · Fail-safe · unapplied column reads return the sealed default
--     via the service's column-probe pattern. The UI + render surfaces
--     degrade gracefully before this migration lands.
--   · All five columns are viewer-side only · no sender-forced
--     semantics in this phase · future phases may add them with
--     separate authorisation.

begin;

alter table nex_account
  add column if not exists screenshot_copy_protection_enabled boolean not null default false;

alter table nex_account
  add column if not exists chat_font_family text not null default 'default';

alter table nex_account
  add column if not exists chat_font_size text not null default 'medium';

alter table nex_account
  add column if not exists chat_bg_from_shop_cover boolean not null default false;

alter table nex_account
  add column if not exists shop_cover_from_chat_theme boolean not null default false;

-- Owner directive 2026-11-13 hotfix · Postgres doesn't support
-- `ADD CONSTRAINT IF NOT EXISTS` on CHECK constraints · wrap in a DO
-- block that probes pg_constraint first.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'nex_account_chat_font_family_valid'
  ) then
    alter table nex_account
      add constraint nex_account_chat_font_family_valid
      check (chat_font_family in ('default', 'system', 'serif', 'monospace', 'handwritten'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'nex_account_chat_font_size_valid'
  ) then
    alter table nex_account
      add constraint nex_account_chat_font_size_valid
      check (chat_font_size in ('small', 'medium', 'large'));
  end if;
end $$;

comment on column nex_account.screenshot_copy_protection_enabled is
  'Owner-sealed 2026-11-07 · when TRUE the viewer''s chat UI applies
   user-select:none + contextmenu/copy event blocks. Does NOT block
   OS-level screenshots on web · honest limit stated in UI.';
comment on column nex_account.chat_font_family is
  'Owner-sealed 2026-11-07 · viewer''s chat font family preset. One of
   default / system / serif / monospace / handwritten. Applies to the
   viewer''s own chat view only.';
comment on column nex_account.chat_font_size is
  'Owner-sealed 2026-11-07 · viewer''s chat font size preset. small /
   medium / large. Applies to the viewer''s own chat view only.';
comment on column nex_account.chat_bg_from_shop_cover is
  'Owner-sealed 2026-11-07 · when TRUE the viewer''s chat page uses
   their own shop cover image as the chat background instead of the
   chat theme''s default background.';
comment on column nex_account.shop_cover_from_chat_theme is
  'Owner-sealed 2026-11-07 · when TRUE the viewer''s own shop page
   renders their chat theme hero as the cover background. Visible
   only to the shop owner · non-owners always see the real cover.';

commit;
