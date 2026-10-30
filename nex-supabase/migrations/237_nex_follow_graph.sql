-- ============================================================================
-- NEX-native Migration 237 · nex_follow · one-way follow graph
-- ============================================================================
-- Owner-authorised 2026-10-30 · Stage 1 of the sealed Follow architecture
-- (`docs/doctrine/nex-follow-architecture-draft-2026-10-30.md` §16).
--
-- Scope (sealed in §16 D11 + D12):
--   · One-way creator-follow relationships (follower → followee).
--   · Source column kept (`music` | `live` | `profile`) · strict CHECK per
--     the §12 O-4 resolution. Stage 2 extensions (`directory`, `socials`,
--     `business`) require a follow-up migration.
--   · CASCADE on nex_account deletion per §16 D10.
--
-- Doctrine:
--   · Identity Doctrine · every FK is nex_account.id (UUID)
--   · Anti-fabrication · self-follow blocked by CHECK (follower_id <> followee_id)
--   · Idempotency guaranteed at storage layer by PRIMARY KEY (follower_id, followee_id)
--   · Block enforcement reuses the sealed `nex_friend_edge.status='blocked'`
--     primitive per §12 Q-A — no parallel block table created here.
--
-- Related sealed primitives (NOT modified by this migration):
--   · nex_friend_edge (migration 025 + 034) · mutual friend graph + block
--   · nex_friend_request (migration 215) · friend-request flow
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '237';
--     DROP TABLE IF EXISTS public.nex_follow CASCADE;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_follow (
  follower_id   uuid        NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  followee_id   uuid        NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  source        text        NULL,

  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT nex_follow_no_self_follow CHECK (follower_id <> followee_id),
  CONSTRAINT nex_follow_source_known CHECK (
    source IS NULL OR source IN ('music', 'live', 'profile')
  )
);

COMMENT ON TABLE public.nex_follow IS
  'One-way follow graph · follower_id follows followee_id · idempotent via PK · source attributes discovery path · block check reuses nex_friend_edge.status=''blocked''.';

-- Reverse-direction lookup · "who follows me" / counter-rebuild
-- support · ordered newest-first.
CREATE INDEX IF NOT EXISTS idx_nex_follow_by_followee
  ON public.nex_follow (followee_id, created_at DESC);

-- Forward-direction lookup · "who do I follow" · ordered newest-first.
CREATE INDEX IF NOT EXISTS idx_nex_follow_by_follower
  ON public.nex_follow (follower_id, created_at DESC);

-- RLS · follow rows are a public social signal per §16 D2 default.
-- Private-visibility gating lives in the action layer (which checks
-- the followee's `followers_list_visibility` column added in
-- migration 238).
ALTER TABLE public.nex_follow ENABLE ROW LEVEL SECURITY;

-- SELECT · public. The action layer filters per account privacy.
CREATE POLICY nex_follow_select_all
  ON public.nex_follow
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT · only the follower can create their own follow row. Block
-- enforcement happens at the action layer (RLS cannot efficiently
-- subquery nex_friend_edge for the canonical pair on INSERT).
CREATE POLICY nex_follow_insert_own
  ON public.nex_follow
  FOR INSERT
  TO authenticated
  WITH CHECK (
    follower_id = (SELECT auth.uid())
  );

-- DELETE · follower (unfollow) OR followee (remove-follower).
CREATE POLICY nex_follow_delete_participants
  ON public.nex_follow
  FOR DELETE
  TO authenticated
  USING (
    follower_id = (SELECT auth.uid())
    OR followee_id = (SELECT auth.uid())
  );

-- Service role writes bypass RLS (set via nexSupabaseAdmin). The
-- repository layer calls under service_role for atomic trigger
-- interactions with migration 238's counter triggers.

INSERT INTO public.nex_migration_history (version, description, notes)
  VALUES (
    '237',
    'nex_follow one-way follow graph · Stage 1 of universal Follow architecture',
    'PK on (follower,followee) for idempotency · CHECK no-self-follow · source enum strict (music|live|profile) · CASCADE on account delete · block check via nex_friend_edge in action layer per Q-A.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
