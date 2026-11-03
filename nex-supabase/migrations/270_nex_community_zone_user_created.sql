-- 270_nex_community_zone_user_created.sql
--
-- NEX Community · user-created sub-county communities with HQ moderation.
-- Owner-authorised 2026-11-03 (D3b path).
--
-- CONTEXT
--   The sealed level enum from migration 146 already includes
--   'neighbourhood'. The all-Ireland parish-sourced community dataset
--   (seeded in a separate migration, drafted neutrally with no
--   religious labels in `name` or `slug`) maps to level='neighbourhood'
--   under the county (level='city') parents from migration 266.
--
--   This migration adds the moderation surface so END USERS can also
--   create their own community row when none of the seeded names fits
--   (e.g. a townland like Lacken that isn't a parish in its own right).
--   HQ then Approve / Reject / Merge the submission.
--
-- WHAT CHANGES
--   1. nex_community_zone gains two nullable columns:
--        · moderation_status (default 'approved' for existing + future
--          seeded rows; user-created rows insert as 'pending')
--        · created_by_account_id (nullable FK · null for seeded rows ·
--          set to the submitting account for user-created rows)
--   2. A CHECK constraint restricts moderation_status to a known set.
--   3. A partial unique index enforces the "max 1 pending per account"
--      spam guard · users can't flood HQ with 20 submissions.
--
-- WHAT STAYS UNCHANGED
--   · The sealed level CHECK (migration 146) · 'neighbourhood' is
--     already in the allowed set.
--   · The sealed partial unique indexes on (parent_zone_id, slug) ·
--     the moderation workflow deletes rejected rows (so the slug is
--     freed for reuse) and merged rows (membership is moved first).
--   · nex_community_membership shape · the sealed uq_membership_pair
--     (migration 267) already handles multi-membership.
--
-- IDEMPOTENCY
--   ALTER TABLE ... ADD COLUMN IF NOT EXISTS and CREATE INDEX IF NOT
--   EXISTS make this safe to re-apply during the apply-and-verify
--   dance.

-- Apply guard
DO $$ BEGIN
  RAISE EXCEPTION 'Migration 270 is DRAFT · comment out this block before applying.';
END $$;

ALTER TABLE nex_community_zone
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS created_by_account_id uuid REFERENCES nex_account(id) ON DELETE SET NULL;

-- Allowed moderation states · approved=public and in search; pending=
-- user-submitted, waiting on HQ review (visible only within parent-county
-- discover search); the two terminal states (rejected · merged) are
-- intentionally OMITTED here because the server actions HARD-DELETE
-- rows on reject/merge. Keeping them absent means a stale 'rejected' or
-- 'merged' row cannot exist by accident.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_zone_moderation_status'
  ) THEN
    ALTER TABLE nex_community_zone
      ADD CONSTRAINT ck_zone_moderation_status
      CHECK (moderation_status IN ('approved','pending'));
  END IF;
END $$;

-- Spam guard: a single account can only have ONE pending submission in
-- flight at any time · HQ moderation drains the queue linearly. Rows
-- that are 'approved' (post-review) do NOT count against the quota.
CREATE UNIQUE INDEX IF NOT EXISTS uq_zone_pending_per_creator
  ON nex_community_zone (created_by_account_id)
  WHERE moderation_status = 'pending'
    AND created_by_account_id IS NOT NULL;

-- Discovery index · HQ moderation page scans "pending in my country"
-- in roughly O(1) per country · without this it'd seq-scan the whole
-- zones table once we grow past a few thousand user submissions.
CREATE INDEX IF NOT EXISTS ix_zone_moderation_country
  ON nex_community_zone (country, moderation_status)
  WHERE moderation_status = 'pending';

-- Audit entry · the sealed nex_migration_history table records this
-- apply · the string must not exceed 80 chars (sealed convention).
INSERT INTO nex_migration_history (version, description, applied_at)
VALUES ('270', 'community · user-created zones · moderation surface', now())
ON CONFLICT (version) DO NOTHING;
