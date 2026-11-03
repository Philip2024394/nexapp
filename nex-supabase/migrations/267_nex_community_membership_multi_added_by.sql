-- nex-supabase/migrations/267_nex_community_membership_multi_added_by.sql
--
-- NEX Community · membership schema upgrade for multi-community + added-by.
-- Owner-authorised 2026-11-03.
--
-- WHAT THIS DOES
--   1. Drops uq_membership_account (sealed single-membership constraint) so
--      an account can belong to MULTIPLE communities (county + any
--      user-added hyperlocal pods · future routing-key tier).
--   2. Adds uq_membership_pair UNIQUE (account_id, hyperlocal_zone_id) so
--      the same user can't join the same zone twice.
--   3. Adds added_by_account_id · tracks WHO added this member. Null =
--      self-join. UUID = another member added them (adder-only can remove,
--      per owner directive 2026-11-03).
--   4. Adds status column · 'active' | 'flagged' | 'suspended' | 'removed' ·
--      member can be flagged by any community peer · suspension/removal
--      requires HQ action.
--
-- WHY
--   Owner directive 2026-11-03 · "a nex user should be able to add
--   another nex contact to the community if that other person is not
--   associated with a community already · the same user that adds
--   another contact can only delete that contact unless reported or
--   flagged".
--
-- IDEMPOTENCY
--   Every ALTER uses IF EXISTS / IF NOT EXISTS or guarded DO blocks ·
--   safe to re-run · no destructive drop of existing data.

BEGIN;

-- 1 · Drop the single-membership constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'uq_membership_account'
       AND conrelid = 'public.nex_community_membership'::regclass
  ) THEN
    ALTER TABLE public.nex_community_membership
      DROP CONSTRAINT uq_membership_account;
  END IF;
END $$;

-- 2 · Add the (account, zone) pair uniqueness
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'uq_membership_pair'
       AND conrelid = 'public.nex_community_membership'::regclass
  ) THEN
    ALTER TABLE public.nex_community_membership
      ADD CONSTRAINT uq_membership_pair
      UNIQUE (account_id, hyperlocal_zone_id);
  END IF;
END $$;

-- 3 · Added-by tracking column
ALTER TABLE public.nex_community_membership
  ADD COLUMN IF NOT EXISTS added_by_account_id uuid NULL
    REFERENCES public.nex_account(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.nex_community_membership.added_by_account_id IS
  'When another member added this account to the community (owner directive 2026-11-03). NULL means self-joined (default signup flow). Only the adder (or a flag + HQ action) can remove the added member.';

-- 4 · Status column with CHECK
ALTER TABLE public.nex_community_membership
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ck_membership_status'
       AND conrelid = 'public.nex_community_membership'::regclass
  ) THEN
    ALTER TABLE public.nex_community_membership
      ADD CONSTRAINT ck_membership_status
      CHECK (status IN ('active','flagged','suspended','removed'));
  END IF;
END $$;

COMMENT ON COLUMN public.nex_community_membership.status IS
  'Member state within the community · active (default) · flagged (reported, under HQ review) · suspended (HQ action, cannot post) · removed (left the community, kept for audit).';

-- Hot read path: find active members of a community
CREATE INDEX IF NOT EXISTS idx_membership_community_active
  ON public.nex_community_membership (hyperlocal_zone_id, status)
  WHERE status = 'active';

-- Hot read path: find who someone added
CREATE INDEX IF NOT EXISTS idx_membership_added_by
  ON public.nex_community_membership (added_by_account_id)
  WHERE added_by_account_id IS NOT NULL;

-- Migration history
INSERT INTO public.nex_migration_history (version, description)
VALUES (
  '267',
  'nex_community_membership · multi-community support · added_by + status columns · (account,zone) pair uniqueness'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
