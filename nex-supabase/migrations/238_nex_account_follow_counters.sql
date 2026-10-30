-- ============================================================================
-- NEX-native Migration 238 · nex_account follow counters + visibility
-- ============================================================================
-- Owner-authorised 2026-10-30 · Stage 1 of the sealed Follow architecture
-- (`docs/doctrine/nex-follow-architecture-draft-2026-10-30.md` §16).
--
-- Adds five columns to the sealed `nex_account` table and the two
-- triggers that keep counters atomic with follow row writes.
--
-- Dependency: migration 237 (nex_follow table) MUST exist before this
-- migration runs. The AFTER INSERT / AFTER DELETE triggers reference
-- `public.nex_follow`.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '238';
--     DROP TRIGGER IF EXISTS nex_follow_counters_insert_trg ON public.nex_follow;
--     DROP TRIGGER IF EXISTS nex_follow_counters_delete_trg ON public.nex_follow;
--     DROP FUNCTION IF EXISTS public.nex_follow_counters_on_insert();
--     DROP FUNCTION IF EXISTS public.nex_follow_counters_on_delete();
--     DROP FUNCTION IF EXISTS public.nex_follow_recompute_counters(uuid);
--     ALTER TABLE public.nex_account
--       DROP CONSTRAINT IF EXISTS nex_account_followers_visibility_chk,
--       DROP CONSTRAINT IF EXISTS nex_account_following_visibility_chk;
--     ALTER TABLE public.nex_account
--       DROP COLUMN IF EXISTS followers_count,
--       DROP COLUMN IF EXISTS following_count,
--       DROP COLUMN IF EXISTS followers_list_visibility,
--       DROP COLUMN IF EXISTS following_list_visibility,
--       DROP COLUMN IF EXISTS follower_count_hidden;
--   COMMIT;
-- ============================================================================

BEGIN;

-- 1 · Column additions on nex_account.
-- `ADD COLUMN ... DEFAULT ...` is metadata-only in PostgreSQL 11+ · no
-- row rewrite · safe on hot tables.
ALTER TABLE public.nex_account
  ADD COLUMN IF NOT EXISTS followers_count            integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count            integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followers_list_visibility  text    NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS following_list_visibility  text    NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS follower_count_hidden      boolean NOT NULL DEFAULT false;

-- 2 · CHECK constraints on the new visibility columns.
-- Use a DO block so re-running the migration doesn't error on
-- "constraint already exists" (PostgreSQL < 17 lacks ADD CONSTRAINT
-- IF NOT EXISTS universally).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_account_followers_visibility_chk'
  ) THEN
    ALTER TABLE public.nex_account
      ADD CONSTRAINT nex_account_followers_visibility_chk
        CHECK (followers_list_visibility IN ('public','mutuals','private'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_account_following_visibility_chk'
  ) THEN
    ALTER TABLE public.nex_account
      ADD CONSTRAINT nex_account_following_visibility_chk
        CHECK (following_list_visibility IN ('public','mutuals','private'));
  END IF;
END $$;

-- 3 · Counter-maintenance trigger functions.
-- Both fire inside the same transaction as the INSERT/DELETE on
-- nex_follow so counters are always consistent at commit.

CREATE OR REPLACE FUNCTION public.nex_follow_counters_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.nex_account
     SET followers_count = followers_count + 1
   WHERE id = NEW.followee_id;
  UPDATE public.nex_account
     SET following_count = following_count + 1
   WHERE id = NEW.follower_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.nex_follow_counters_on_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- GREATEST(x-1, 0) prevents negative counters even if a stray trigger
  -- fires on a race-dropped row.
  UPDATE public.nex_account
     SET followers_count = GREATEST(followers_count - 1, 0)
   WHERE id = OLD.followee_id;
  UPDATE public.nex_account
     SET following_count = GREATEST(following_count - 1, 0)
   WHERE id = OLD.follower_id;
  RETURN OLD;
END;
$$;

-- 4 · Trigger wiring on nex_follow.
DROP TRIGGER IF EXISTS nex_follow_counters_insert_trg ON public.nex_follow;
CREATE TRIGGER nex_follow_counters_insert_trg
  AFTER INSERT ON public.nex_follow
  FOR EACH ROW EXECUTE FUNCTION public.nex_follow_counters_on_insert();

DROP TRIGGER IF EXISTS nex_follow_counters_delete_trg ON public.nex_follow;
CREATE TRIGGER nex_follow_counters_delete_trg
  AFTER DELETE ON public.nex_follow
  FOR EACH ROW EXECUTE FUNCTION public.nex_follow_counters_on_delete();

-- 5 · Reconciliation RPC · owner-callable from Supabase SQL editor
-- when drift inspection is needed. Idempotent · safe to re-run.
-- Pass NULL to recompute every account · pass a specific uuid to
-- recompute just that one.
CREATE OR REPLACE FUNCTION public.nex_follow_recompute_counters(target_account uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_account IS NULL THEN
    UPDATE public.nex_account a
       SET followers_count = COALESCE((SELECT COUNT(*) FROM public.nex_follow WHERE followee_id = a.id), 0),
           following_count = COALESCE((SELECT COUNT(*) FROM public.nex_follow WHERE follower_id = a.id), 0);
  ELSE
    UPDATE public.nex_account a
       SET followers_count = COALESCE((SELECT COUNT(*) FROM public.nex_follow WHERE followee_id = a.id), 0),
           following_count = COALESCE((SELECT COUNT(*) FROM public.nex_follow WHERE follower_id = a.id), 0)
     WHERE a.id = target_account;
  END IF;
END;
$$;

-- Lock down the RPC · service_role only · never callable from the
-- client. Owner invokes directly from the Supabase SQL editor using
-- the service_role connection.
REVOKE ALL ON FUNCTION public.nex_follow_recompute_counters(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.nex_follow_recompute_counters(uuid) TO service_role;

INSERT INTO public.nex_migration_history (version, description, notes)
  VALUES (
    '238',
    'nex_account follow counters + visibility + maintenance triggers + reconciliation RPC',
    '5 columns · 2 triggers · 1 SECURITY DEFINER RPC (service_role only) · depends on migration 237 nex_follow.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
