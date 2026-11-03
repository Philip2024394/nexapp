-- nex-supabase/migrations/269_nex_hq_action_log_community_actions.sql
--
-- NEX HQ · expand nex_hq_action_log action enum with Community actions.
-- Owner-authorised 2026-11-03.
--
-- Adds 5 new action values so HQ Community operations are auditable
-- via the sealed append-only log (migration 254).

BEGIN;

-- Drop + recreate the CHECK to add new values. Keep every existing
-- value so existing rows remain valid.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_hq_action_log_action_check'
       AND conrelid = 'public.nex_hq_action_log'::regclass
  ) THEN
    ALTER TABLE public.nex_hq_action_log
      DROP CONSTRAINT nex_hq_action_log_action_check;
  END IF;
END $$;

ALTER TABLE public.nex_hq_action_log
  ADD CONSTRAINT nex_hq_action_log_action_check
  CHECK (action IN (
    'country_placement_approved',
    'country_placement_rejected',
    'country_placement_held',
    'country_placement_removed',
    'worldwide_moderation_set',
    'account_warn',
    'account_suspend',
    'content_takedown',
    'community_member_flag_upheld',
    'community_member_flag_dismissed',
    'community_member_removed_by_hq',
    'community_zone_archived_by_hq',
    'community_zone_created_by_hq'
  ));

INSERT INTO public.nex_migration_history (version, description)
VALUES (
  '269',
  'nex_hq_action_log · expand action enum with 5 Community HQ actions'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
