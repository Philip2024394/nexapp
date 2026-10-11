-- nex-supabase/migrations/149_nex_community_phase2a_notification_prefs.sql
--
-- NEX Community Noticeboard · Phase 2A · decompose notification pref.
-- Founder-authorised 2026-10-11.
--
-- WHAT THIS DOES
--   Decomposes the single-column `notification_preference` on
--   nex_community_membership into per-section preferences:
--     · safety_pref      — Phase 1 Safety & Watch
--     · lost_found_pref  — Phase 2A Lost & Found
--     · events_pref      — Phase 2B (reserved, default 'off')
--     · voting_pref      — Phase 2C (reserved, default 'off')
--     · life_news_pref   — Phase 2E (reserved, default 'off', opt-in-only)
--
--   The old `notification_preference` column is kept for one migration
--   cycle as a soft backfill source and removed in a later migration
--   once all code paths have moved to the new columns.
--
-- WHY
--   The directive specifies: "Keep your three notification choices,
--   but define which categories qualify. Calendar reminders and event
--   invitations should have separate, optional controls so a meeting
--   reminder doesn't become an emergency alert." That is only possible
--   with per-section columns.
--
--   Default for new sections is 'off' so adding a section never
--   silently opts users into notifications they never asked for.
--
-- NOT TOUCHED
--   · nex_community_notice (safety data unchanged)
--   · nex_community_card (new super-table from 148)
--   · nex_community_zone (unchanged)

BEGIN;

-- 1 · Add per-section columns (nullable → backfill → set NOT NULL).
ALTER TABLE nex_community_membership
  ADD COLUMN IF NOT EXISTS safety_pref     text,
  ADD COLUMN IF NOT EXISTS lost_found_pref text,
  ADD COLUMN IF NOT EXISTS events_pref     text,
  ADD COLUMN IF NOT EXISTS voting_pref     text,
  ADD COLUMN IF NOT EXISTS life_news_pref  text;

-- 2 · Backfill from the old monolithic column.
--   quiet       → everything off / quiet
--   urgent_only → safety urgent_only, lost_found urgent_only, rest off
--   all         → safety all,         lost_found all,         rest off (life_news stays off, opt-in)
UPDATE nex_community_membership
SET safety_pref     = COALESCE(safety_pref, notification_preference, 'urgent_only'),
    lost_found_pref = COALESCE(lost_found_pref,
                               CASE notification_preference
                                 WHEN 'quiet'       THEN 'quiet'
                                 WHEN 'urgent_only' THEN 'urgent_only'
                                 WHEN 'all'         THEN 'all'
                                 ELSE 'urgent_only'
                               END),
    events_pref     = COALESCE(events_pref,    'off'),
    voting_pref     = COALESCE(voting_pref,    'off'),
    life_news_pref  = COALESCE(life_news_pref, 'off');

-- 3 · Lock the columns NOT NULL + CHECK constraints.
ALTER TABLE nex_community_membership
  ALTER COLUMN safety_pref     SET NOT NULL,
  ALTER COLUMN lost_found_pref SET NOT NULL,
  ALTER COLUMN events_pref     SET NOT NULL,
  ALTER COLUMN voting_pref     SET NOT NULL,
  ALTER COLUMN life_news_pref  SET NOT NULL;

-- Safety and Lost & Found share the same three-way scale (quiet/urgent_only/all).
ALTER TABLE nex_community_membership
  ADD CONSTRAINT ck_membership_safety_pref
    CHECK (safety_pref IN ('quiet','urgent_only','all'));
ALTER TABLE nex_community_membership
  ADD CONSTRAINT ck_membership_lost_found_pref
    CHECK (lost_found_pref IN ('quiet','urgent_only','all'));

-- Reserved sections use a wider enum but default 'off' so no leakage.
ALTER TABLE nex_community_membership
  ADD CONSTRAINT ck_membership_events_pref
    CHECK (events_pref IN ('off','invited_only','rsvp_reminders','all'));
ALTER TABLE nex_community_membership
  ADD CONSTRAINT ck_membership_voting_pref
    CHECK (voting_pref IN ('off','my_proposals','closing_soon','all'));
ALTER TABLE nex_community_membership
  ADD CONSTRAINT ck_membership_life_news_pref
    CHECK (life_news_pref IN ('off','subscribed_families','all'));

-- 4 · Keep legacy column for one cycle (deprecated); drop in a later
--     migration after all code paths have moved to per-section reads.
COMMENT ON COLUMN nex_community_membership.notification_preference IS
  'DEPRECATED 2026-10-11 · superseded by safety_pref / lost_found_pref / events_pref / voting_pref / life_news_pref. Will be dropped in a later migration once all code paths read per-section columns.';

COMMIT;
