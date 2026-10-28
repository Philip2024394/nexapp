-- ============================================================================
-- NEX-native Migration 222 · nex_live_engagement
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Must not be applied to the sealed production project
-- `ijvqdvsvwtwxzcqmoqit` without explicit owner approval. Apply in
-- the sandbox after Migrations 219 (nex_live_session) and 221
-- (nex_live_participation).
--
-- Owner directive 2026-10-24 · wire Live engagement collection to
-- Shop Contacts participation ledger. See
-- docs/doctrine/nex-live-interaction-feature-contract-2026-10-24.md.
--
-- Purpose
-- ----------------------------------------------------------------------------
-- Lightweight per-event log written during an open Live session.
-- The broadcaster's `endLiveSessionAction` reads this table at
-- session end, aggregates one row per identity, and materialises the
-- Shop Contacts participation rows via
-- `materialiseLiveParticipation` (ledger table 221). The engagement
-- log is then dropped-on-cascade when the session row is removed.
--
-- Design invariants
--   · ONE row per (session, viewer, kind). Repeated events of the
--     same kind are a no-op via `ON CONFLICT DO NOTHING`.
--   · `share_evidence` carries the explicit validated evidence (one
--     of 'native-share', 'copy-link', 'chat-send') ONLY for rows
--     where kind='share'. Null for like/comment rows.
--   · The broadcaster NEVER reads this table directly. Access is
--     service-role only · the ledger (221) is the single surface the
--     broadcaster sees, and that is kind-aggregated + stripped of
--     per-event timestamps.
--
-- RLS
-- ----------------------------------------------------------------------------
-- Writes: `TO authenticated` with the viewer_account_id gate via
-- `nex_current_account_ids()` (hardened by Migration 217).
-- Reads: service-role only · no policy for authenticated. The
-- aggregator in `participation-engagement-service.ts` runs via
-- nexSupabaseAdmin.
--
-- Dependencies
-- ----------------------------------------------------------------------------
--   APPLIED (sandbox prerequisites):
--     010_nex_rls_recursion_fix.sql
--     217_nex_rls_helper_search_path_harden.sql
--     219_nex_live_session_and_featured_product.sql
--     221_nex_live_participation.sql
--
-- Rollback
-- ----------------------------------------------------------------------------
--   BEGIN;
--     DROP TABLE IF EXISTS nex_live_engagement CASCADE;
--     DELETE FROM nex_migration_history WHERE version = '222';
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_live_engagement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  session_id uuid NOT NULL
    REFERENCES public.nex_live_session(id) ON DELETE CASCADE,

  viewer_account_id uuid NOT NULL
    REFERENCES public.nex_account(id) ON DELETE CASCADE,

  kind text NOT NULL
    CHECK (kind IN ('like', 'comment', 'share')),

  -- Null for like/comment. For share: validated OS evidence tag.
  share_evidence text
    CHECK (
      share_evidence IS NULL
      OR share_evidence IN ('native-share', 'copy-link', 'chat-send')
    ),

  first_recorded_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nex_live_engagement IS
  'Transient per-event engagement log for Live sessions. One row per (session, viewer, kind). Aggregated at session end by participation-engagement-service.aggregateEngagementBySession and persisted as a Shop Contacts card via materialiseLiveParticipation (ledger table 221). Marketing boundary · NEVER joined into Intelligence/Directory canonical queries. Sealed 2026-10-24 · Migration 222.';

-- One row per (session, viewer, kind) · later events of the same
-- kind are idempotent via ON CONFLICT DO NOTHING at the service.
CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_live_engagement_once_per_viewer_per_kind
  ON public.nex_live_engagement (session_id, viewer_account_id, kind);

-- Session scan · the aggregator reads all rows for a session.
CREATE INDEX IF NOT EXISTS idx_nex_live_engagement_by_session
  ON public.nex_live_engagement (session_id);

ALTER TABLE public.nex_live_engagement ENABLE ROW LEVEL SECURITY;

-- Viewer can insert their own engagement row.
CREATE POLICY nex_live_engagement_viewer_insert
  ON public.nex_live_engagement FOR INSERT
  TO authenticated
  WITH CHECK (
    viewer_account_id IN (SELECT nex_current_account_ids())
    -- The session must be currently OPEN · prevents stale/replayed
    -- events from writing against ended sessions.
    AND EXISTS (
      SELECT 1 FROM nex_live_session s
       WHERE s.id = session_id AND s.status = 'open'
    )
  );

-- No SELECT policy for authenticated · the ledger (221) is the
-- broadcaster's surface. Service-role bypasses RLS.
-- No UPDATE / DELETE policies · hard-delete via session CASCADE only.

REVOKE ALL ON public.nex_live_engagement FROM anon;
GRANT INSERT ON public.nex_live_engagement TO authenticated;

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '222',
  'nex_live_engagement · per-event collection log · aggregated by endLiveSessionAction into Shop Contacts ledger',
  'Owner directive 2026-10-24. One row per (session, viewer, kind) via partial unique index · ON CONFLICT DO NOTHING idempotency at the service. share_evidence enum CHECK (native-share | copy-link | chat-send). Viewer INSERT policy TO authenticated via nex_current_account_ids() + session must be open. No SELECT/UPDATE/DELETE policies · service-role aggregates. Depends on 010, 217, 219, 221. Rollback: DROP TABLE CASCADE. NOT YET APPLIED to any database.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
