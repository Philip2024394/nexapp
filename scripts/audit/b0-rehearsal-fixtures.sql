-- scripts/audit/b0-rehearsal-fixtures.sql
--
-- Stage B0-C-light · owner-authorised 2026-11-03 (artefact · unexecuted)
-- -----------------------------------------------------------------------------
-- 100% synthetic fixtures. No production export. No sanitised real data.
-- Every uuid is deterministic (hard-coded) so the expected counts match
-- the assertions in `b0-rehearsal-expected.md`.
--
-- Scenario deliberately covers every category the coverage query reports:
--   · active account WITH device key
--   · active account WITHOUT device key
--   · conversation where both keyed
--   · conversation sender-keyed, recipient-unkeyed
--   · conversation sender-unkeyed
--   · conversation with one inactive participant
--   · an account with ONLY a REVOKED device key (counts as unkeyed)
--   · an account with ONLY a STALE last_seen_at device key (keyed but inactive)
--
-- Nothing in this file resembles a real user. Names are `alpha..zulu`.

-- -----------------------------------------------------------------------------
-- Accounts
-- -----------------------------------------------------------------------------

INSERT INTO nex_account (id, display_name, created_at) VALUES
  -- Active + keyed
  ('11111111-1111-4111-8111-111111111001', 'alpha', now() - interval '400 days'),
  ('11111111-1111-4111-8111-111111111002', 'bravo', now() - interval '350 days'),
  -- Active + keyed (second pair for recent_conversations_both_keyed)
  ('11111111-1111-4111-8111-111111111003', 'charlie', now() - interval '200 days'),
  ('11111111-1111-4111-8111-111111111004', 'delta', now() - interval '180 days'),
  -- Active + NOT keyed (never provisioned a device_key)
  ('11111111-1111-4111-8111-111111111005', 'echo', now() - interval '90 days'),
  ('11111111-1111-4111-8111-111111111006', 'foxtrot', now() - interval '70 days'),
  -- Active · ONLY has a REVOKED key (counts as unkeyed per the query)
  ('11111111-1111-4111-8111-111111111007', 'golf', now() - interval '60 days'),
  -- Inactive (no device activity, no conversation activity in 30d)
  ('11111111-1111-4111-8111-111111111008', 'hotel', now() - interval '500 days'),
  ('11111111-1111-4111-8111-111111111009', 'india', now() - interval '500 days'),
  -- Keyed but stale device (last_seen_at > 30 days)
  ('11111111-1111-4111-8111-111111111010', 'juliet', now() - interval '400 days');

-- -----------------------------------------------------------------------------
-- Device keys
-- -----------------------------------------------------------------------------
-- alpha, bravo, charlie, delta have active recent keys · "keyed + active"
-- juliet has a stale key (last_seen_at = 60 days ago) · still "keyed"
-- golf has only a REVOKED key · counts as unkeyed
-- echo, foxtrot, hotel, india have NO key rows at all

INSERT INTO nex_account_device_key
  (account_id, device_id, public_key, created_at, last_seen_at, revoked_at)
VALUES
  ('11111111-1111-4111-8111-111111111001', 'device-alpha-01',
   'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
   now() - interval '100 days', now() - interval '2 days',  NULL),
  ('11111111-1111-4111-8111-111111111002', 'device-bravo-01',
   'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
   now() - interval '80 days',  now() - interval '5 days',  NULL),
  ('11111111-1111-4111-8111-111111111003', 'device-charlie-01',
   'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
   now() - interval '60 days',  now() - interval '1 day',   NULL),
  ('11111111-1111-4111-8111-111111111004', 'device-delta-01',
   'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
   now() - interval '40 days',  now() - interval '7 days',  NULL),
  -- golf has only a REVOKED key
  ('11111111-1111-4111-8111-111111111007', 'device-golf-01',
   'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
   now() - interval '50 days',  now() - interval '10 days', now() - interval '5 days'),
  -- juliet has a key, but stale last_seen_at (older than 30 days)
  ('11111111-1111-4111-8111-111111111010', 'device-juliet-01',
   'JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ',
   now() - interval '400 days', now() - interval '60 days', NULL);

-- -----------------------------------------------------------------------------
-- Conversations
-- -----------------------------------------------------------------------------
-- Enforced: participant_a_id < participant_b_id (ordered pair constraint)
-- alpha(001) < bravo(002) · ok
-- charlie(003) < delta(004) · ok
-- alpha(001) < echo(005) · ok (sender keyed, recipient not)
-- echo(005) < foxtrot(006) · ok (neither keyed)
-- bravo(002) < hotel(008) · ok (bravo active, hotel inactive)
-- bravo(002) < juliet(010) · ok (bravo active-keyed, juliet active-keyed-but-stale)

INSERT INTO nex_peer_conversation
  (id, participant_a_id, participant_b_id, created_at, last_message_at)
VALUES
  -- recent + both keyed
  ('22222222-2222-4222-8222-222222222001',
   '11111111-1111-4111-8111-111111111001',
   '11111111-1111-4111-8111-111111111002',
   now() - interval '100 days', now() - interval '1 day'),
  -- recent + both keyed · second pair
  ('22222222-2222-4222-8222-222222222002',
   '11111111-1111-4111-8111-111111111003',
   '11111111-1111-4111-8111-111111111004',
   now() - interval '60 days',  now() - interval '5 days'),
  -- recent + sender keyed · recipient NOT keyed
  --   sender = alpha, recipient = echo
  ('22222222-2222-4222-8222-222222222003',
   '11111111-1111-4111-8111-111111111001',
   '11111111-1111-4111-8111-111111111005',
   now() - interval '50 days', now() - interval '2 days'),
  -- recent + sender NOT keyed
  --   sender = echo, recipient = foxtrot
  ('22222222-2222-4222-8222-222222222004',
   '11111111-1111-4111-8111-111111111005',
   '11111111-1111-4111-8111-111111111006',
   now() - interval '40 days', now() - interval '3 days'),
  -- recent + ONE participant inactive (hotel)
  ('22222222-2222-4222-8222-222222222005',
   '11111111-1111-4111-8111-111111111002',
   '11111111-1111-4111-8111-111111111008',
   now() - interval '30 days', now() - interval '10 days'),
  -- recent + both keyed · juliet is "stale-keyed" but has a key row
  ('22222222-2222-4222-8222-222222222006',
   '11111111-1111-4111-8111-111111111002',
   '11111111-1111-4111-8111-111111111010',
   now() - interval '45 days', now() - interval '2 days'),
  -- NOT recent (last_message_at > 30 days ago · outside the window)
  ('22222222-2222-4222-8222-222222222007',
   '11111111-1111-4111-8111-111111111008',
   '11111111-1111-4111-8111-111111111009',
   now() - interval '400 days', now() - interval '200 days');

-- -----------------------------------------------------------------------------
-- Messages
-- -----------------------------------------------------------------------------
-- The query only cares about:
--   · which conversations have activity in 30d (covered by last_message_at)
--   · who the MOST RECENT sender is per conversation (determines the
--     "sender-keyed-recipient-not" vs "sender-not-keyed" split)
--
-- One message per conversation is enough. Body text is placeholder.

INSERT INTO nex_peer_message
  (conversation_id, sender_account_id, body, sent_at)
VALUES
  -- Conv 001 (alpha+bravo): most recent sender = alpha
  ('22222222-2222-4222-8222-222222222001',
   '11111111-1111-4111-8111-111111111001',
   'hello bravo', now() - interval '1 day'),
  -- Conv 002 (charlie+delta): most recent sender = delta
  ('22222222-2222-4222-8222-222222222002',
   '11111111-1111-4111-8111-111111111004',
   'hey charlie', now() - interval '5 days'),
  -- Conv 003 (alpha+echo): most recent sender = alpha (keyed) · echo not keyed
  ('22222222-2222-4222-8222-222222222003',
   '11111111-1111-4111-8111-111111111001',
   'echo, open the app!', now() - interval '2 days'),
  -- Conv 004 (echo+foxtrot): most recent sender = echo (NOT keyed)
  ('22222222-2222-4222-8222-222222222004',
   '11111111-1111-4111-8111-111111111005',
   'foxtrot?', now() - interval '3 days'),
  -- Conv 005 (bravo+hotel): most recent sender = bravo · hotel inactive
  ('22222222-2222-4222-8222-222222222005',
   '11111111-1111-4111-8111-111111111002',
   'hotel · still there?', now() - interval '10 days'),
  -- Conv 006 (bravo+juliet): most recent sender = bravo (both keyed)
  ('22222222-2222-4222-8222-222222222006',
   '11111111-1111-4111-8111-111111111002',
   'juliet, long time', now() - interval '2 days'),
  -- Conv 007 (hotel+india): old · outside the window · query ignores
  ('22222222-2222-4222-8222-222222222007',
   '11111111-1111-4111-8111-111111111008',
   'legacy chat', now() - interval '200 days');
