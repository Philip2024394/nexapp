-- 289_nex_business_shipping_methods_and_dispatch.sql
-- -----------------------------------------------------------------------------
-- NEX Shop · multi-method shipping + shop-level dispatch time ·
-- owner-sealed 2026-11-07.
--
-- STATUS: AUTHORED · NOT YET APPLIED. Owner directive 2026-11-07
-- authorises preparation + review only. A separate explicit
-- application authorisation is required before this migration touches
-- any database.
--
-- Rationale:
--   Migration 108 made `nex_business.shipping_scope` a single-value
--   enum (local_delivery · local_and_export · international_only ·
--   pickup_only · dine_in · digital). Owner directive 2026-11-07
--   requires a MULTI-SELECT across three shipping methods: Postal ·
--   Sea Freight · Airfreight. Selecting Sea Freight or Airfreight
--   implicitly means the shop exports.
--
--   This migration adds `shipping_methods text[]` for the new
--   multi-select AND keeps `shipping_scope` populated on save via a
--   deterministic derivation in the service layer. Downstream readers
--   of `shipping_scope` (Directory · cover · info-pages · search) keep
--   working unchanged. New readers may prefer `shipping_methods` for
--   finer granularity.
--
--   Also adds `dispatch_time_days integer` for shop-level dispatch
--   estimate (0..365). Product-level dispatch_time already exists on
--   nex_product · this is the shop default shown on Shipping & Returns.
--
-- Columns added:
--
--   shipping_methods       text[]  · array subset of
--                                    {'postal','pickup','sea_freight','airfreight'}
--                                    · nullable · empty array allowed
--                                    (seller may skip the whole step).
--
--   dispatch_time_days     integer · 0..365 · nullable (not set).
--
-- Rollback (destructive · never run in production without founder approval):
--
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '289';
--     ALTER TABLE nex_business
--       DROP CONSTRAINT IF EXISTS nex_business_shipping_methods_valid,
--       DROP CONSTRAINT IF EXISTS nex_business_dispatch_time_days_bounds,
--       DROP COLUMN IF EXISTS dispatch_time_days,
--       DROP COLUMN IF EXISTS shipping_methods;
--   COMMIT;

begin;

alter table nex_business
  add column if not exists shipping_methods text[],
  add column if not exists dispatch_time_days integer;

alter table nex_business
  drop constraint if exists nex_business_shipping_methods_valid,
  drop constraint if exists nex_business_dispatch_time_days_bounds;

alter table nex_business
  add constraint nex_business_shipping_methods_valid
    check (
      shipping_methods is null
      or shipping_methods <@ array['postal','pickup','sea_freight','airfreight']::text[]
    ),
  add constraint nex_business_dispatch_time_days_bounds
    check (
      dispatch_time_days is null
      or (dispatch_time_days >= 0 and dispatch_time_days <= 365)
    );

comment on column nex_business.shipping_methods is
  'Owner-sealed 2026-11-07 · multi-select subset of
   {postal, pickup, sea_freight, airfreight}. Postal = local/regional.
   Pickup = buyer collects. Sea Freight or Airfreight present ⇒ the
   shop exports. Derived single-value shipping_scope stays populated
   on save for backward compatibility with Directory + cover readers.';

comment on column nex_business.dispatch_time_days is
  'Owner-sealed 2026-11-07 · shop-level default dispatch time in
   days (0..365). Shown on the Shipping & Returns surface and used
   as the per-product dispatch_time fallback. Nullable when the
   seller has not yet set it.';

insert into nex_migration_history (version, description, notes)
  values (
    '289',
    'Phase B · nex_business.shipping_methods + dispatch_time_days',
    'Owner-sealed 2026-11-07. Multi-method shipping (Postal/Sea Freight/Airfreight) + shop-level dispatch time. shipping_scope legacy column stays populated on save via a deterministic derivation.'
  )
  on conflict (version) do nothing;

commit;
