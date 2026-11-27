-- 286_nex_business_operating_country.sql
-- -----------------------------------------------------------------------------
-- NEX Shop · per-business operating country · owner-sealed 2026-11-07.
--
-- STATUS: AUTHORED · NOT YET APPLIED. Owner authorisation covers
-- preparation + content review only. A separate explicit application
-- authorisation is required before this migration touches any database.
--
-- Revision log:
--   · 2026-11-07 · initial authoring (sealed).
--   · 2026-11-27 · syntax correction. PostgreSQL does NOT support
--     `ALTER TABLE … ADD CONSTRAINT IF NOT EXISTS …`; the original
--     attempted-apply failed with a parse error and the sandbox
--     rolled back cleanly. The constraint is now added inside a
--     PL/pgSQL DO block that guards on BOTH `conname` AND `conrelid`
--     so it cannot be fooled by a same-named constraint on a different
--     table. All other content (column definition, backfill, comment)
--     is unchanged. Migration remains safely re-runnable. Correction
--     owner-authorised 2026-11-27 pending separate sandbox-apply
--     approval of this revised SQL.
--
-- Rationale (owner-approved 2026-11-07):
--   Expat sellers · dropshippers · dual-residency sellers · brand-new
--   geo entries · all break the "business country = account country"
--   assumption. A dedicated per-business column lets a seller declare
--   which country their SHOP operates in independently of where they
--   personally live. Downstream consumers (currency default, VAT, SEO
--   hreflang, payment rails, statutory consumer-rights copy) then read
--   this value as the authoritative business location.
--
-- Column shape:
--   · operating_country_code TEXT NULL · ISO 3166-1 alpha-2 (uppercase)
--   · NULL permitted · sellers may skip in the wizard; downstream
--     consumers fall back to NEX_APP_COUNTRY env for null values
--   · CHECK enforces the 2-letter uppercase pattern · rejects garbage
--
-- Backfill:
--   Existing rows get the owner's account profile country_code when
--   it exists. Rows whose owner has no profile.country_code stay null
--   (consumer code falls back to env).

begin;

alter table nex_business
  add column if not exists operating_country_code text;

-- Add the CHECK constraint ONLY if an identically-named constraint on
-- this exact table does not already exist. Postgres has no native
-- `ADD CONSTRAINT IF NOT EXISTS` clause, so we guard via pg_constraint.
-- Guarding on `conrelid = 'public.nex_business'::regclass` ensures we
-- never mistake a same-named constraint on a different table for this
-- one (defence in depth · constraint names are not globally unique in
-- Postgres, only unique per schema+table).
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname  = 'nex_business_operating_country_valid'
       and conrelid = 'public.nex_business'::regclass
  ) then
    alter table public.nex_business
      add constraint nex_business_operating_country_valid
        check (
          operating_country_code is null
          or operating_country_code ~ '^[A-Z]{2}$'
        );
  end if;
end;
$$;

-- Backfill from nex_account_profile.country_code where available.
-- Safe to re-run · only touches rows still null.
update nex_business b
   set operating_country_code = p.country_code
  from nex_account_profile p
 where p.account_id = b.owner_account_id
   and b.operating_country_code is null
   and p.country_code is not null
   and p.country_code ~ '^[A-Z]{2}$';

comment on column nex_business.operating_country_code is
  'Owner-sealed 2026-11-07 · ISO 3166-1 alpha-2 country where THE SHOP
   operates. May differ from the owner''s personal country. Drives
   currency default, VAT/GST overlays, SEO hreflang, payment rail
   selection, and statutory consumer-rights copy. Null = unknown ·
   consumers fall back to NEX_APP_COUNTRY env.';

commit;
