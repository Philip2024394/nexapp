-- 307_nex_group_call_country.sql
-- -----------------------------------------------------------------------------
-- NEX Call Center · country-aware group calls (Option C · hybrid).
-- Owner-authorised 2026-11-08 (round 25).
-- STATUS · AUTHORED · APPLIED TO SANDBOX ONLY · NOT APPLIED to production
-- (ijvqdvsvwtwxzcqmoqit) per CLAUDE.md §5 + owner's standing hold on
-- production application for every migration in this programme.
--
-- Doctrine · owner-exact 2026-11-08 round 25 · 7 principles
--   1. Calls within the same country work normally.
--   2. Cross-country calls are permitted when participants
--      explicitly initiate or accept them.
--   3. Country restrictions MUST NOT prevent an authorised personal
--      invitation.
--   4. Country identity must remain visible for safety, moderation
--      and reporting.
--   5. HQ retains global oversight without automatically granting
--      every operator unrestricted access to private calls.
--   6. No recording or server-side storage of private call content.
--   7. Country restrictions + permissions enforced server-side.
--
-- Schema changes (additive · no breaking changes)
--
--   nex_group_call_session
--     + host_country text NOT NULL default 'worldwide'
--       · Backfilled on existing rows to 'worldwide' (we do NOT
--         fabricate country attribution for historical rows ·
--         'worldwide' is the honest unknown-country fallback that
--         matches the sealed nex_incident enum).
--       · Set on new rows by the inviteToCall service from the
--         host's nex_account_profile.country_code (ISO2 mapped to
--         the sealed word enum). When the host's profile has no
--         country_code · default to 'worldwide'.
--       · CHECK enforces the sealed enum (ireland · indonesia ·
--         worldwide · global).
--
--   nex_group_call_participant
--     + joined_from_country text NULL
--       · Set on the participant row AT joined_at time (the receiver
--         derives this from their own profile · never from an IP).
--       · Nullable because pending (invited but not joined) rows
--         have no derived country yet. A declined row keeps it
--         null · it was never joined.
--     + cross_country_consent_at timestamptz NULL
--       · Set when a cross-country invitee taps Accept with the
--         "you are joining from <country>" disclosure visible.
--         Honest consent signal · if the host's country equals the
--         joiner's country, this column stays NULL (same-country
--         joins require no consent).
--
-- Integrity invariants (CHECK constraints)
--   · host_country ∈ sealed country enum.
--   · joined_from_country NULL or ∈ sealed country enum.
--   · cross_country_consent_at NULL → either same-country join OR
--     pending/declined · the service writes the timestamp ONLY on
--     a cross-country accept.
--   · cross_country_consent_at NOT NULL implies joined_from_country
--     is also set (consent only matters when a joiner has a country
--     of record on their participant row).
--
-- Rollback
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '307';
--     ALTER TABLE nex_group_call_participant
--       DROP CONSTRAINT IF EXISTS ck_group_call_participant_consent_shape,
--       DROP CONSTRAINT IF EXISTS ck_group_call_participant_joined_from_country,
--       DROP COLUMN IF EXISTS cross_country_consent_at,
--       DROP COLUMN IF EXISTS joined_from_country;
--     ALTER TABLE nex_group_call_session
--       DROP CONSTRAINT IF EXISTS ck_group_call_session_host_country,
--       DROP COLUMN IF EXISTS host_country;
--   COMMIT;

begin;

-- ─── Session · host_country ──────────────────────────────────────

alter table nex_group_call_session
  add column if not exists host_country text;

update nex_group_call_session
   set host_country = 'worldwide'
 where host_country is null;

alter table nex_group_call_session
  alter column host_country set not null,
  alter column host_country set default 'worldwide';

alter table nex_group_call_session
  drop constraint if exists ck_group_call_session_host_country;

alter table nex_group_call_session
  add constraint ck_group_call_session_host_country
    check (host_country in ('ireland', 'indonesia', 'worldwide', 'global'));

comment on column nex_group_call_session.host_country is
  'Owner-sealed 2026-11-08 (round 25 · Option C hybrid) · country '
  'of record for the host at session creation · drives the cross-'
  'country consent decision at invite + join time. Never NULL · '
  'backfilled to ''worldwide'' for historical rows. Bounded enum '
  '(ireland · indonesia · worldwide · global).';

-- ─── Participant · joined_from_country + consent ─────────────────

alter table nex_group_call_participant
  add column if not exists joined_from_country text;

alter table nex_group_call_participant
  drop constraint if exists ck_group_call_participant_joined_from_country;

alter table nex_group_call_participant
  add constraint ck_group_call_participant_joined_from_country
    check (
      joined_from_country is null
      or joined_from_country in ('ireland', 'indonesia', 'worldwide', 'global')
    );

alter table nex_group_call_participant
  add column if not exists cross_country_consent_at timestamptz;

-- Integrity · a cross-country consent timestamp only makes sense
-- when the joiner has a country of record on their row. Prevents
-- an orphan consent write.
alter table nex_group_call_participant
  drop constraint if exists ck_group_call_participant_consent_shape;

alter table nex_group_call_participant
  add constraint ck_group_call_participant_consent_shape
    check (
      cross_country_consent_at is null
      or joined_from_country is not null
    );

comment on column nex_group_call_participant.joined_from_country is
  'Owner-sealed 2026-11-08 (round 25) · country of the participant '
  'at joined_at time · derived from their nex_account_profile.'
  'country_code mapped to the sealed word enum · NULL for pending '
  '(invited but not joined) + declined (never joined) rows. '
  'Bounded enum.';

comment on column nex_group_call_participant.cross_country_consent_at is
  'Owner-sealed 2026-11-08 (round 25) · timestamp the participant '
  'tapped Accept on a cross-country invite with the country '
  'disclosure visible. NULL on same-country joins (no consent '
  'needed) + pending + declined. Implies joined_from_country is '
  'also set (ck_group_call_participant_consent_shape).';

-- Operator read index · HQ dashboard filters by host_country.
create index if not exists idx_nex_group_call_session_host_country
  on nex_group_call_session (host_country, started_at desc);

-- Cross-country audit index · "show me recent cross-country joins"
-- · partial index because the majority of joins will be same-
-- country (cross_country_consent_at is NULL).
create index if not exists idx_nex_group_call_participant_cross_country
  on nex_group_call_participant (session_id, cross_country_consent_at desc)
  where cross_country_consent_at is not null;

insert into nex_migration_history (version, description, notes)
  values (
    '307',
    'nex_group_call country-aware (Option C hybrid) · host_country + joined_from_country + cross_country_consent_at',
    'Owner-authorised 2026-11-08 (round 25) · sandbox only · production sealed. Preserves 7-principle doctrine · same-country normal · cross-country permitted with explicit consent · restrictions enforced server-side.'
  )
  on conflict do nothing;

commit;
