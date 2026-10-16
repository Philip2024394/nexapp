-- Migration 198 · Per-account notification preferences · Stage 3 · 2026-10-15
-- --------------------------------------------------------------------------
-- One row per account. Row absence = all defaults applied by the server-
-- side preference service (ON for message/call/reaction/mention · OFF for
-- marketing). The dispatch service consults this table BEFORE fanning out
-- to nex_account_push_subscription endpoints (migration 098).
--
-- Companion to migration 098. The two tables are intentionally separate:
--   · 098 holds device subscriptions (write-often · one row per device)
--   · 198 holds user preferences (write-rarely · one row per account)
-- The dispatch service joins them in-code · no DB join.
--
-- Doctrine:
--   · Marketing defaults FALSE · users must explicitly opt INTO
--     promotional content. Flipping this default requires a sealed
--     consent-doctrine revision.
--   · The dispatch service fails CLOSED for EVERY category if the
--     preference read fails · an explicit saved OFF must always win,
--     and an unreachable service must never override a user's intent.
--   · The dispatch service rejects pushes targeting Vault-origin
--     conversations server-side (not caller-dependent) · see
--     notification-dispatch-service.ts for the enforcement path.

create table if not exists nex_account_notification_prefs (
  account_id          uuid primary key references nex_account(id) on delete cascade,
  message_enabled     boolean not null default true,
  call_enabled        boolean not null default true,
  reaction_enabled    boolean not null default true,
  mention_enabled     boolean not null default true,
  marketing_enabled   boolean not null default false,
  updated_at          timestamptz not null default now()
);

comment on table nex_account_notification_prefs is
  'Stage 3 · Sealed 2026-10-15. Per-account push-notification category preferences. Row absence = all defaults (ON for message/call/reaction/mention · OFF for marketing). The sealed notification-dispatch-service consults this table BEFORE fanning out to nex_account_push_subscription endpoints · a disabled category skips the fanout · a service-layer read error fails CLOSED for every category (an explicit saved OFF must always win · an unreachable service must never override a user''s intent). Marketing defaults OFF to match consent best practice.';

comment on column nex_account_notification_prefs.marketing_enabled is
  'Promotional / product-announcement notifications. Defaults FALSE to require explicit opt-in · do not flip this default without an owner-signed consent-doctrine revision.';

comment on column nex_account_notification_prefs.message_enabled is
  'Peer-chat message notifications. Enforced in the sealed notification-dispatch-service · recipient must have this flag set to true AND the conversation must NOT be in the recipient''s Vault (sealed Vault policy §P0.3).';

-- RLS: owners can read and write their own row. Server-role bypasses RLS
-- as usual for the dispatch helper (which runs via nexSupabaseAdmin).
-- Mirrors the sealed migration 098 ownership pattern.

alter table nex_account_notification_prefs enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nex_account_notification_prefs'
      and policyname = 'nex_account_notification_prefs_owner_rw'
  ) then
    create policy nex_account_notification_prefs_owner_rw
      on nex_account_notification_prefs
      for all
      to authenticated
      using (
        exists (
          select 1 from nex_account
          where nex_account.id = nex_account_notification_prefs.account_id
            and nex_account.supabase_user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from nex_account
          where nex_account.id = nex_account_notification_prefs.account_id
            and nex_account.supabase_user_id = auth.uid()
        )
      );
  end if;
end $$;
