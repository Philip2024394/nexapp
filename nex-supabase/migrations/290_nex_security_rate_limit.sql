-- 290_nex_security_rate_limit.sql
-- -----------------------------------------------------------------------------
-- NEX Security Programme · Phase 0 · Item 4 · per-identity + per-action
-- rolling-window rate-limit counter. Owner-sealed 2026-11-08.
--
-- STATUS: AUTHORED · NOT YET APPLIED. Owner directive 2026-11-07
-- authorises preparation + review only. A separate explicit
-- application authorisation is required before this migration touches
-- any database.
--
-- Mirrors the sealed nex_community_rate_limit pattern (migration 146)
-- but generalises the identity column from `account_id uuid` to a
-- plain `key text` so unauthenticated endpoints can be limited by a
-- hashed IP instead of an account id. Same cold-bucket race caveat
-- as the community limiter · two concurrent calls at a fresh window
-- can both pass. Stricter atomicity (advisory lock / stored proc)
-- is a Phase 1.1 upgrade.
--
-- Identity key format (owner-sealed · enforced by the service layer):
--   · acct:<uuid>   · authenticated endpoints (password change,
--                     session revoke, chat message, webauthn enroll)
--   · ip:<sha256>   · unauthenticated endpoints (account create,
--                     webauthn assert). Service hashes the IP so
--                     the DB never stores raw IPs.
--
-- Columns:
--   key                 text        · identity for the counter (see above)
--   action              text        · one of ACTION_LIST below
--   window_started_at   timestamptz · floored to the windowMinutes boundary
--   count               integer     · 0..max_per_window
--   updated_at          timestamptz · last mutation of the row
--
-- PRIMARY KEY (key, action, window_started_at)
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '290';
--     DROP INDEX IF EXISTS idx_nex_security_rate_limit_window;
--     DROP TABLE IF EXISTS nex_security_rate_limit;
--   COMMIT;

begin;

create table if not exists nex_security_rate_limit (
  key                 text        not null,
  action              text        not null,
  window_started_at   timestamptz not null,
  count               integer     not null default 0,
  updated_at          timestamptz not null default now(),

  primary key (key, action, window_started_at),
  constraint ck_sec_rl_action check (action in (
    'password_change',
    'session_revoke',
    'session_revoke_all',
    'chat_message',
    'account_create',
    'webauthn_assert',
    'webauthn_enroll',
    'visitor_bootstrap'
  )),
  constraint ck_sec_rl_count check (count >= 0),
  constraint ck_sec_rl_key_shape check (
    key ~ '^(acct|ip):[a-z0-9-]{16,}$'
  )
);

create index if not exists idx_nex_security_rate_limit_window
  on nex_security_rate_limit (key, action, window_started_at desc);

comment on table nex_security_rate_limit is
  'Owner-sealed 2026-11-08 · per-identity + per-action rolling-window
   rate-limit counters for sensitive security endpoints. Service
   layer: src/lib/nex-native/security-rate-limit.ts. Fail-open by
   design when the row read errors · fail-safe by design when the
   count hits max (service throws SecurityRateLimitError + the
   route returns 429 with Retry-After).';

comment on column nex_security_rate_limit.key is
  'Identity for the counter · "acct:<uuid>" for authenticated endpoints
   or "ip:<sha256>" for unauthenticated endpoints. CHECK enforces
   the shape; the service layer is responsible for correct derivation.';

insert into nex_migration_history (version, description, notes)
  values (
    '290',
    'Phase 0 Security · nex_security_rate_limit table',
    'Owner-sealed 2026-11-08. Mirrors nex_community_rate_limit (mig 146) but keyed by text (acct:<uuid> or ip:<sha256>) so unauthenticated endpoints are covered. Service has a process-local in-memory fallback when this table is absent · NOT distributed · warn-logged. Apply this migration to activate full cross-instance enforcement.'
  )
  on conflict (version) do nothing;

commit;
