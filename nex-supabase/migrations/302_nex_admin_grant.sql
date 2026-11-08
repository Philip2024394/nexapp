-- 302_nex_admin_grant.sql
-- -----------------------------------------------------------------------------
-- NEX HQ Admin Grants · manual-override entitlement surface.
-- Owner-authorised 2026-11-08 (round 2).
-- STATUS · AUTHORED · APPLIED TO SANDBOX ONLY · NOT APPLIED to production
-- (ijvqdvsvwtwxzcqmoqit) per CLAUDE.md §5 Safety Constitution.
--
-- Doctrine context
--   · Owner requirement 2026-11-08 · HQ admins must be able to activate
--     a shop membership for a member (1-12 months) when the member has
--     paid the admin directly OR has a payment issue · AND activate one
--     free chat theme any time.
--   · This table is ADDITIVE to the sealed shop-tier model
--     (`nex_account.shop_tier` · 3-tier Entry/Professional/Pro+). It
--     does NOT replace or mutate shop_tier · it stacks alongside, so
--     when the sealed Package Contract DRAFT eventually lands we can
--     migrate these rows into the final entitlement contract without
--     unwinding the admin-override surface.
--   · Grants are APPEND-ONLY · the writer INSERTs a new row to grant
--     or to mark a prior grant revoked (revoke writes a new row with
--     revoked_at + revoke_reason, not an UPDATE). Keeps the surface
--     identical to the sealed Security Programme write discipline.
--   · Each grant triggers a system chat message to the member from the
--     sealed "Nex" sentinel (migration 301) · the message carries a
--     link to the correct destination page.
--
-- Columns (why these exist)
--   id              · PK · surrogate so repeated grants are
--                     distinguishable in the audit timeline
--   account_id      · target member · FK → nex_account
--   kind            · 'shop' | 'theme' · CHECK-constrained
--   shop_months     · 1..12 · NULL unless kind='shop'
--   theme_id        · free text id of the unlocked theme · NULL unless
--                     kind='theme'
--   granted_by      · HQ admin account id · FK → nex_account
--   granted_at      · UTC · default now()
--   expires_at      · UTC · set for kind='shop' (granted_at + months),
--                     NULL for kind='theme' (one-time unlock)
--   revoked_at      · UTC · operator-written revoke timestamp
--   revoke_reason   · short reason text · required when revoked_at set
--   note            · optional operator note (why the grant)
--
-- Role scoping · identical to migrations 290-301 · service_role INSERT
-- + SELECT, zero anon/authenticated, RLS enabled with zero policies.
--
-- Rollback
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '302';
--     DROP TABLE IF EXISTS nex_admin_grant;
--   COMMIT;

begin;

create table if not exists nex_admin_grant (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references nex_account(id) on delete cascade,
  kind          text not null,
  shop_months   integer,
  theme_id      text,
  granted_by    uuid not null references nex_account(id),
  granted_at    timestamptz not null default now(),
  expires_at    timestamptz,
  revoked_at    timestamptz,
  revoke_reason text,
  note          text,

  constraint ck_admin_grant_kind
    check (kind in ('shop', 'theme')),

  -- Shop grants must carry a bounded month count + a concrete expiry +
  -- must NOT also carry a theme_id. Preserves intent at write time so
  -- a downstream reader can trust the row shape.
  constraint ck_admin_grant_shop_shape check (
    kind <> 'shop' or (
      shop_months between 1 and 12
      and expires_at is not null
      and theme_id is null
    )
  ),
  -- Theme grants must carry a theme_id, no shop_months, no expiry
  -- (theme unlocks are one-time · the user has that theme forever).
  constraint ck_admin_grant_theme_shape check (
    kind <> 'theme' or (
      theme_id is not null
      and shop_months is null
      and expires_at is null
    )
  ),

  -- Revoke invariants · a revoke_reason must accompany a revoked_at
  -- (prevents silent revokes with no operator justification).
  constraint ck_admin_grant_revoke_reason check (
    (revoked_at is null and revoke_reason is null)
    or
    (revoked_at is not null and revoke_reason is not null
     and char_length(revoke_reason) between 1 and 400)
  )
);

comment on table nex_admin_grant is
  'Owner-sealed 2026-11-08 · HQ admin-grant surface. Additive to '
  'nex_account.shop_tier · never mutates it. Shop grants carry '
  'shop_months (1-12) + expires_at; theme grants carry theme_id. '
  'Append-only writes · service_role INSERT + SELECT only.';

-- Active-grant lookup index · partial, excludes revoked rows so the
-- common query (does this account have an active grant of KIND?) is a
-- single bounded seek.
create index if not exists idx_nex_admin_grant_active
  on nex_admin_grant (account_id, kind, expires_at)
  where revoked_at is null;

-- Grant-history-per-account index (unfiltered) for the HQ UI's
-- revoke + audit timeline.
create index if not exists idx_nex_admin_grant_account_granted_at
  on nex_admin_grant (account_id, granted_at desc);

-- Role scoping · zero anon/authenticated · service_role INSERT + SELECT.
alter table nex_admin_grant enable row level security;
revoke all on nex_admin_grant from public;
revoke all on nex_admin_grant from authenticated;
revoke all on nex_admin_grant from anon;
revoke all on nex_admin_grant from service_role;
grant select, insert on nex_admin_grant to service_role;

insert into nex_migration_history (version, applied_at, note)
  values ('302', now(), 'nex_admin_grant · HQ admin override for shop + theme entitlement')
  on conflict do nothing;

commit;
