-- ============================================================================
-- NEX-native Migration 240 · nex_account_music_rights_ack
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised draft only · DO NOT APPLY to the sealed Supabase project
-- `ijvqdvsvwtwxzcqmoqit` or any staging target without a SEPARATE explicit
-- owner authorisation.
--
-- Encodes the sealed design lock E1 from
-- `project_nex_music_publishing_locks_sealed_2026_10_30.md`:
--
--   > Separate versioned table nex_account_music_rights_ack(account_id,
--   > terms_version, acknowledged_at). Composite PK (account_id, terms_version).
--   > No IP field. Moved to a separate Migration 237. Migration 236 does NOT
--   > create or reference this table. Rights-ack enforcement lives in the
--   > M-2 server action.
--
-- Naming note (owner-flagged 2026-10-31):
--   The sealed memory refers to this migration as "Migration 237", but
--   filesystem slot 237 was reassigned to `nex_follow` on 2026-10-30
--   (sealed Follow architecture Stage 1 · Migration 237_nex_follow_graph).
--   This file takes the next available number (240) to preserve both
--   sealed designs. Update the music-publishing-locks memory on the next
--   authorised doctrine pass, or renumber this file if owner prefers.
--
-- Design points
-- ----------------------------------------------------------------------------
--   1. Composite PK (account_id, terms_version) · one ack per account per
--      version. Re-ack after a terms bump creates a new row, never updates.
--   2. acknowledged_at defaults to now() · immutable record.
--   3. NO IP field · explicitly dropped per sealed E1. If the compliance
--      posture ever requires IP, add in a separate migration with a
--      separate retention policy.
--   4. terms_version is `text`, not an enum · versions evolve, text is
--      forward-compatible. Suggest convention `v1-2026-10-31` so order is
--      obvious at a glance.
--   5. RLS: owner can SELECT + INSERT their own rows. No UPDATE/DELETE
--      (acks are permanent record · retention is a separate decision).
--      service_role has full access for the M-2 server-action gate.
--
-- Rollback: a corresponding manual DOWN block is included at the bottom.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_account_music_rights_ack (
  account_id       uuid         NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  terms_version    text         NOT NULL CHECK (char_length(terms_version) BETWEEN 1 AND 64),
  acknowledged_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, terms_version)
);

COMMENT ON TABLE  public.nex_account_music_rights_ack IS
  'Per-account acknowledgement of the music rights/licensing terms, one row per terms version. Immutable. No IP recorded (sealed E1 · 2026-10-30).';
COMMENT ON COLUMN public.nex_account_music_rights_ack.terms_version IS
  'Opaque identifier for the terms text version. Suggested convention: v1-YYYY-MM-DD.';
COMMENT ON COLUMN public.nex_account_music_rights_ack.acknowledged_at IS
  'Server timestamp at the moment of acknowledgement. Immutable.';

-- --------------------------------------------------------------------
-- Index · lookup of latest ack per account (common query from M-2
-- server action: "has this account acked current terms?"). The PK
-- covers (account_id, terms_version); for a single-account lookup
-- the PK is sufficient. No additional index at this time.
-- --------------------------------------------------------------------

-- --------------------------------------------------------------------
-- Row-Level Security
-- --------------------------------------------------------------------
ALTER TABLE public.nex_account_music_rights_ack ENABLE ROW LEVEL SECURITY;

-- SELECT · owner reads their own rows (M-2 server action also reads
-- via service_role which bypasses RLS).
CREATE POLICY nex_account_music_rights_ack_select_own
  ON public.nex_account_music_rights_ack
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM public.nex_account WHERE supabase_user_id = auth.uid())
  );

-- INSERT · owner inserts their own ack row only.
CREATE POLICY nex_account_music_rights_ack_insert_own
  ON public.nex_account_music_rights_ack
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (SELECT id FROM public.nex_account WHERE supabase_user_id = auth.uid())
  );

-- NO UPDATE policy · acks are immutable.
-- NO DELETE policy · retention decision is separate.
-- anon has no access.

-- --------------------------------------------------------------------
-- Grants · align with the sealed Option X pattern from Migration 236:
-- authenticated gets scoped INSERT + SELECT via RLS; anon has nothing;
-- service_role retains full access for the M-2 server action.
-- --------------------------------------------------------------------
REVOKE ALL ON TABLE public.nex_account_music_rights_ack FROM PUBLIC;
REVOKE ALL ON TABLE public.nex_account_music_rights_ack FROM anon;
GRANT  SELECT, INSERT ON TABLE public.nex_account_music_rights_ack TO authenticated;
GRANT  ALL           ON TABLE public.nex_account_music_rights_ack TO service_role;

COMMIT;

-- ----------------------------------------------------------------
-- Rollback (manual):
--   BEGIN;
--     DROP POLICY IF EXISTS nex_account_music_rights_ack_select_own
--       ON public.nex_account_music_rights_ack;
--     DROP POLICY IF EXISTS nex_account_music_rights_ack_insert_own
--       ON public.nex_account_music_rights_ack;
--     DROP TABLE IF EXISTS public.nex_account_music_rights_ack;
--   COMMIT;
-- ----------------------------------------------------------------
