-- 277_seed_ireland_mock_contacts.sql
-- Owner-authorised 2026-11-04 later-same-day.
--
-- Seeds 6 Irish mock-persona contacts for nex-99901 (Padraig Murphy ·
-- Ireland dev-impersonation viewer sealed 2026-11-03).
--
-- Every row is idempotent · ON CONFLICT DO NOTHING / UPDATE so this
-- migration is safe to re-run. The seed script companion at
-- scripts/mock-personas/seed-ireland-contacts.mjs applies the same
-- inserts over the pooler connection for local dev; this SQL is the
-- versioned documentation of what gets written.
--
-- Target database: canonical NEX Supabase ijvqdvsvwtwxzcqmoqit (sealed
-- 2026-10-12 · CLAUDE.md §8). Any other project is a mistake.
--
-- Handles:   nex-99911 ... nex-99916
-- Viewer:    nex-99901 (Padraig Murphy · Wexford)
-- Friendship: accepted · requested_by = nex-99901
--
-- Deterministic UUIDs follow the nex-99901 variant (variant/version bits
-- valid): 11111111-aaaa-4aaa-8aaa-11111111111X · X = 2..7.

BEGIN;

-- ─── 1 · Accounts ───────────────────────────────────────────────────
--
-- chat_theme='gold' · owner directive 2026-11-04 later-same-day · every
-- Ireland mock persona ships with the sealed gratis 'gold' theme active
-- (migration 021 CHECK constraint allowed values: default · titanium ·
-- pink · gold · night · aurora · sunset · obsidian). Same theme across
-- all six so the chat bubble vocabulary stays consistent when the
-- viewer hops between Irish contacts. Gratis tier · zero entitlement
-- gates.

INSERT INTO nex_account (id, display_name, nex_handle, is_mock_persona, tier, chat_theme)
VALUES
  ('11111111-aaaa-4aaa-8aaa-111111111112'::uuid, 'Aoife Byrne',       'nex-99911', true, 'gratis', 'gold'),
  ('11111111-aaaa-4aaa-8aaa-111111111113'::uuid, 'Síle O''Brien',      'nex-99912', true, 'gratis', 'gold'),
  ('11111111-aaaa-4aaa-8aaa-111111111114'::uuid, 'Rónán Fitzgerald',  'nex-99913', true, 'gratis', 'gold'),
  ('11111111-aaaa-4aaa-8aaa-111111111115'::uuid, 'Cillian Walsh',     'nex-99914', true, 'gratis', 'gold'),
  ('11111111-aaaa-4aaa-8aaa-111111111116'::uuid, 'Niamh Kavanagh',    'nex-99915', true, 'gratis', 'gold'),
  ('11111111-aaaa-4aaa-8aaa-111111111117'::uuid, 'Eoin Gallagher',    'nex-99916', true, 'gratis', 'gold')
ON CONFLICT (nex_handle) DO UPDATE
  SET display_name    = EXCLUDED.display_name,
      is_mock_persona = true,
      chat_theme      = 'gold';

-- ─── 2 · Profiles ───────────────────────────────────────────────────

INSERT INTO nex_account_profile (
  account_id, kind, profession, headline, bio, location_label,
  is_public, is_discoverable
) VALUES
  ('11111111-aaaa-4aaa-8aaa-111111111112'::uuid, 'professional',
   'Graphic designer', 'Brand + identity in Dublin 2',
   'Freelance graphic designer working with Dublin cafés and small galleries. Partial to a strong serif.',
   'Dublin, Ireland', true, true),
  ('11111111-aaaa-4aaa-8aaa-111111111113'::uuid, 'business_owner',
   'Barista · roaster', '3rd-wave coffee in Cork city',
   'Barista at a small roastery on the quays. Fáilte if you want to talk origins and brew ratios.',
   'Cork, Ireland', true, true),
  ('11111111-aaaa-4aaa-8aaa-111111111114'::uuid, 'professional',
   'Photographer', 'Wedding + landscape · Connemara base',
   'Documenting weddings around the west and landscape work whenever the light turns up.',
   'Galway, Ireland', true, true),
  ('11111111-aaaa-4aaa-8aaa-111111111115'::uuid, 'professional',
   'Software engineer', 'Backend · Dublin · open-source',
   'Backend engineer, mostly Postgres + Go. Weekends on an open-source CLI project.',
   'Dublin, Ireland', true, true),
  ('11111111-aaaa-4aaa-8aaa-111111111116'::uuid, 'business_owner',
   'Pub manager', 'Running the Treaty for 6 years',
   'Running the Treaty Bar in town. Trad on Thursdays, quiz on Tuesdays.',
   'Limerick, Ireland', true, true),
  ('11111111-aaaa-4aaa-8aaa-111111111117'::uuid, 'professional',
   'Musician · trad fiddle', 'Sessions · lessons · recording',
   'Fiddle player and teacher. Sessions around the southeast · open to collaboration.',
   'Wexford, Ireland', true, true)
ON CONFLICT (account_id) DO UPDATE
  SET kind            = EXCLUDED.kind,
      profession      = EXCLUDED.profession,
      headline        = EXCLUDED.headline,
      bio             = EXCLUDED.bio,
      location_label  = EXCLUDED.location_label,
      is_public       = EXCLUDED.is_public,
      is_discoverable = EXCLUDED.is_discoverable,
      updated_at      = now();

-- ─── 3 · Friend edges · nex-99901 ↔ each contact · accepted ────────
--
-- The nex_friend_edge table enforces a_account_id < b_account_id
-- lex-wise; nex-99901's UUID (…111111111111) is lex-less than all six
-- new persona UUIDs so nex-99901 is always `a_account_id`.

INSERT INTO nex_friend_edge (
  a_account_id, b_account_id, requested_by, status
) VALUES
  ('11111111-aaaa-4aaa-8aaa-111111111111'::uuid,
   '11111111-aaaa-4aaa-8aaa-111111111112'::uuid,
   '11111111-aaaa-4aaa-8aaa-111111111111'::uuid, 'accepted'),
  ('11111111-aaaa-4aaa-8aaa-111111111111'::uuid,
   '11111111-aaaa-4aaa-8aaa-111111111113'::uuid,
   '11111111-aaaa-4aaa-8aaa-111111111111'::uuid, 'accepted'),
  ('11111111-aaaa-4aaa-8aaa-111111111111'::uuid,
   '11111111-aaaa-4aaa-8aaa-111111111114'::uuid,
   '11111111-aaaa-4aaa-8aaa-111111111111'::uuid, 'accepted'),
  ('11111111-aaaa-4aaa-8aaa-111111111111'::uuid,
   '11111111-aaaa-4aaa-8aaa-111111111115'::uuid,
   '11111111-aaaa-4aaa-8aaa-111111111111'::uuid, 'accepted'),
  ('11111111-aaaa-4aaa-8aaa-111111111111'::uuid,
   '11111111-aaaa-4aaa-8aaa-111111111116'::uuid,
   '11111111-aaaa-4aaa-8aaa-111111111111'::uuid, 'accepted'),
  ('11111111-aaaa-4aaa-8aaa-111111111111'::uuid,
   '11111111-aaaa-4aaa-8aaa-111111111117'::uuid,
   '11111111-aaaa-4aaa-8aaa-111111111111'::uuid, 'accepted')
ON CONFLICT (a_account_id, b_account_id) DO UPDATE
  SET status     = 'accepted',
      updated_at = now();

COMMIT;
