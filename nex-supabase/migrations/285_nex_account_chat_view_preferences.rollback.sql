-- 285_nex_account_chat_view_preferences.rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 285.
--
-- Drops the five viewer-side chat preference columns + their CHECK
-- constraints. Does NOT affect any other columns on nex_account.
--
-- After rollback, the application's column-probe pattern detects the
-- absence and returns sealed defaults for every viewer · zero
-- behaviour difference from pre-migration state.
--
-- STATUS · PREPARED LOCALLY · NOT APPLIED.

begin;

alter table nex_account
  drop constraint if exists nex_account_chat_font_family_valid;

alter table nex_account
  drop constraint if exists nex_account_chat_font_size_valid;

alter table nex_account
  drop column if exists screenshot_copy_protection_enabled;

alter table nex_account
  drop column if exists chat_font_family;

alter table nex_account
  drop column if exists chat_font_size;

alter table nex_account
  drop column if exists chat_bg_from_shop_cover;

alter table nex_account
  drop column if exists shop_cover_from_chat_theme;

commit;
