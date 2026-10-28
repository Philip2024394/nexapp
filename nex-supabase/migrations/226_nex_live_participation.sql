-- ============================================================================
-- NEX-native Migration 221 · nex_live_participation
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Must not be applied to the sealed production project
-- `ijvqdvsvwtwxzcqmoqit` without explicit owner approval. Apply in a
-- sandbox after Migration 219 (nex_live_session · the FK target).
--
-- Owner directive 2026-10-24 · Live Shop-Contacts shuffle · see
-- docs/doctrine/nex-live-interaction-feature-contract-2026-10-24.md §6.
--
-- Purpose
-- ----------------------------------------------------------------------------
-- Per-session participant ledger · materialised at `endLiveSessionAction`
-- time · ONE row per NEX identity per session · drives the Shop
-- Contacts shuffle for the broadcaster.
--
-- Key invariants (enforced by schema + service):
--   · one row per (session, participant) · partial unique index
--   · evidence_mask bitfield: like=1, comment=2, share=4
--   · shuffle_anchor_at === the session end time · identical across
--     EVERY row materialised in the same batch (breaks per-event
--     timestamp correlation; the broadcaster cannot infer which card
--     arrived earlier)
--   · shuffle_seed · 16 bytes of random · server-generated at
--     materialisation · stable across re-renders of the same view
--     (so the shuffle doesn't scramble between page reloads)
--   · intro_note NOT present here · intro text lives on
--     nex_friend_request (Migration 220) when the broadcaster actually
--     sends an invite from a card.
--
-- Marketing boundary
-- ----------------------------------------------------------------------------
-- GRANT/REVOKE enforced at migration time (same pattern as 155 for
-- Discovery Signal). This table is NEVER joined into Intelligence /
-- Directory canonical queries. It is a MARKETING / discovery surface
-- only. The broadcaster-visible projection goes through the service
-- which:
--   · drops `first_evidence_at` from the response
--   · drops `evidence_mask` from the response (unless we add a future
--     "What they did" owner-controlled affordance, which is
--     explicitly out of scope)
--   · retains only (participant_account_id, shuffle_anchor_at,
--     shuffle_seed) for the random-order render
--
-- RLS
-- ----------------------------------------------------------------------------
-- Writes: service-role only (nexSupabaseAdmin · same posture as the
-- Live tables in Migration 219). Reads: broadcaster SELECT via a
-- helper policy that checks `nex_live_session.business_id →
-- nex_business.owner_account_id === auth.uid()`-mapped nex_account.id
-- (reuses `nex_current_owned_business_ids()` from Migration 010 /
-- hardened by 217). No DELETE policies (hard-delete remains service-
-- role only).
--
-- Dependencies
-- ----------------------------------------------------------------------------
--   APPLIED (production assumption · must be verified in sandbox):
--     010_nex_rls_recursion_fix.sql
--     217_nex_rls_helper_search_path_harden.sql (apply before this)
--     219_nex_live_session_and_featured_product.sql (apply before this)
--
-- Rollback
-- ----------------------------------------------------------------------------
--   BEGIN;
--     DROP TABLE IF EXISTS nex_live_participation CASCADE;
--     DELETE FROM nex_migration_history WHERE version = '221';
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_live_participation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  session_id uuid NOT NULL
    REFERENCES public.nex_live_session(id) ON DELETE CASCADE,

  participant_account_id uuid NOT NULL
    REFERENCES public.nex_account(id) ON DELETE CASCADE,

  -- Bitmask of evidence kinds · like=1, comment=2, share=4. Readable
  -- by the service for audit only · never surfaced per-event to the
  -- broadcaster in the Shop Contacts projection.
  evidence_mask int NOT NULL DEFAULT 0
    CHECK (evidence_mask >= 0 AND evidence_mask <= 7),

  -- SERVER-side timestamp of first evidence. Audit only. The
  -- broadcaster-visible projection NEVER includes this.
  first_evidence_at timestamptz NOT NULL DEFAULT now(),

  -- Anchor timestamp used by the Shop Contacts projection · set to
  -- the session end time at materialisation · identical across every
  -- row from the same session so the broadcaster cannot infer any
  -- per-event timing from the row set.
  shuffle_anchor_at timestamptz NOT NULL,

  -- Per-session random seed · 16 raw bytes. Server-generated at
  -- materialisation time (not client-supplied). Stable across
  -- re-renders of the same Shop Contacts view (deterministic shuffle).
  shuffle_seed bytea NOT NULL
    CHECK (octet_length(shuffle_seed) = 16),

  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nex_live_participation IS
  'Per-session Live participation ledger · one row per NEX identity per session · drives the broadcaster''s Shop Contacts shuffle. Materialised at session end. Marketing boundary · NEVER joined into Intelligence / Directory canonical queries. Sealed 2026-10-24 · Migration 221.';

-- One row per identity per session.
CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_live_participation_one_per_identity_per_session
  ON public.nex_live_participation (session_id, participant_account_id);

-- Session-scan index for the broadcaster-side query (fetch all rows
-- for a given session + apply random order via shuffle_seed).
CREATE INDEX IF NOT EXISTS idx_nex_live_participation_by_session
  ON public.nex_live_participation (session_id);

-- Enable RLS.
ALTER TABLE public.nex_live_participation ENABLE ROW LEVEL SECURITY;

-- Broadcaster reads · owns the session's business.
--
-- The join path: nex_live_participation → nex_live_session (session_id)
--   → nex_live_session.business_id → nex_business.owner_account_id.
-- We check that owner_account_id is in the caller's owned-business set.
CREATE POLICY nex_live_participation_broadcaster_select
  ON public.nex_live_participation FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM nex_live_session s
       WHERE s.id = session_id
         AND s.business_id IS NOT NULL
         AND s.business_id IN (SELECT nex_current_owned_business_ids())
    )
  );

-- No INSERT policy for authenticated callers · service-role only.
-- (nexSupabaseAdmin bypasses RLS by design; the service-layer
-- `materialiseLiveParticipation` enforces the write contract.)

-- No DELETE policy · hard-delete remains service-role only.

-- Marketing-boundary grants: anon has no access · authenticated gets
-- SELECT only via the policy above. Service-role continues to have
-- full access by default.
REVOKE ALL ON public.nex_live_participation FROM anon;
GRANT SELECT ON public.nex_live_participation TO authenticated;

-- Migration ledger.
INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '221',
  'nex_live_participation · per-session Live participation ledger · Shop Contacts shuffle source',
  'Owner directive 2026-10-24. One row per NEX identity per session. evidence_mask bitfield (like=1, comment=2, share=4). shuffle_anchor_at identical across session batch (breaks timestamp correlation). shuffle_seed 16 raw bytes server-generated. Partial unique index + session-scan index. RLS: broadcaster SELECT via nex_current_owned_business_ids() helper. No DELETE policies. GRANT/REVOKE enforces marketing boundary. Depends on 010, 217, 219. Rollback: DROP TABLE CASCADE. NOT YET APPLIED to any database.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
