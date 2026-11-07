-- 286_nex_business_operating_country.rollback.sql
-- -----------------------------------------------------------------------------
-- Rollback for migration 286.
--
-- Drops the CHECK constraint + the operating_country_code column. Does
-- NOT revert the backfill in the sense of "re-materialise what was
-- there before" · the column is removed entirely so there's no row
-- data to lose/restore. Owner's account.country_code stays untouched.
--
-- After rollback the column-probe pattern in the service detects
-- absence and returns null for every call · consumers already fall
-- back to NEX_APP_COUNTRY so there's zero behaviour difference from
-- the pre-migration state.
--
-- STATUS · PREPARED LOCALLY · NOT APPLIED.

begin;

alter table nex_business
  drop constraint if exists nex_business_operating_country_valid;

alter table nex_business
  drop column if exists operating_country_code;

commit;
