-- nex-supabase/migrations/268_nex_community_member_flag.sql
--
-- NEX Community · member-level flagging table.
-- Owner-authorised 2026-11-03.
--
-- WHAT THIS DOES
--   Creates nex_community_member_flag · stores every "this member isn't
--   from here" (or any other) report. Separate from the sealed
--   nex_community_notice_report (migration 146) which flags POSTS.
--
-- OWNER DIRECTIVE (2026-11-03)
--   · "each report or flag must have a text field why the person is
--     been flagged or their comments" · reason text REQUIRED (10-500
--     chars, enforced CHECK + UI validation).
--   · "admin will get pill notification of the person that flagged
--     and the explanation of why flagged" · HQ dashboard queries this
--     table for pending flags, surfaces reporter + reason + flagged
--     identity.
--   · "admin can direct connect with the person been flagged or the
--     person that reported" · the table stores both account IDs so
--     the HQ UI can link to /chat/peer/[accountId] for either party.
--
-- Flagger identity is PRIVATE to NEX staff per sealed Community
-- doctrine (2026-10-23) · the flagged account must NOT learn who
-- reported them.
--
-- IDEMPOTENCY: CREATE TABLE IF NOT EXISTS. All constraints guarded.

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_community_member_flag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which community is the flag against?
  community_zone_id uuid NOT NULL
    REFERENCES public.nex_community_zone(id) ON DELETE RESTRICT,

  -- Who was flagged.
  flagged_account_id uuid NOT NULL
    REFERENCES public.nex_account(id) ON DELETE CASCADE,

  -- Who flagged them (private to NEX staff · never surfaced to flagged).
  flagger_account_id uuid NOT NULL
    REFERENCES public.nex_account(id) ON DELETE SET NULL,

  -- Why. REQUIRED. 10-500 chars so flags are substantive.
  reason text NOT NULL
    CHECK (length(trim(reason)) BETWEEN 10 AND 500),

  -- Flag lifecycle · pending (new) · reviewed (HQ saw it, no action yet)
  -- · upheld (HQ removed the member) · dismissed (HQ saw it, no action
  -- taken, flag cleared). HQ can transition pending → reviewed → upheld
  -- or dismissed.
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','reviewed','upheld','dismissed')),

  -- Admin action trail
  reviewed_by_account_id uuid NULL
    REFERENCES public.nex_account(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  admin_note text NULL
    CHECK (admin_note IS NULL OR length(trim(admin_note)) BETWEEN 1 AND 500),

  created_at timestamptz NOT NULL DEFAULT now(),

  -- Flagger can't flag themselves · catches a bug not an attack but
  -- defence in depth.
  CONSTRAINT ck_member_flag_not_self
    CHECK (flagged_account_id <> flagger_account_id),

  -- Review fields must land together
  CONSTRAINT ck_member_flag_review_coherent CHECK (
    (status = 'pending' AND reviewed_by_account_id IS NULL AND reviewed_at IS NULL)
    OR (status <> 'pending' AND reviewed_by_account_id IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.nex_community_member_flag IS
  'Member-level flags in a NEX Community · owner-authorised 2026-11-03. Reason text REQUIRED (10-500 chars). Flagger identity private to NEX staff per sealed Community doctrine (2026-10-23 · flagger ALWAYS private). HQ reviews pending flags via /nex-native/hq/communities and can direct-chat either party.';

COMMENT ON COLUMN public.nex_community_member_flag.reason IS
  'Required explanation of why the member was flagged. 10-500 chars. Shown to HQ reviewer · never shown to the flagged person.';
COMMENT ON COLUMN public.nex_community_member_flag.flagger_account_id IS
  'Private to NEX staff · the flagged user must NOT be able to discover who reported them.';
COMMENT ON COLUMN public.nex_community_member_flag.status IS
  'pending (new · needs review) · reviewed (seen by HQ, no action yet) · upheld (member removed) · dismissed (no action taken).';

-- Hot read: pending flags count + list per community
CREATE INDEX IF NOT EXISTS idx_member_flag_community_pending
  ON public.nex_community_member_flag (community_zone_id, status)
  WHERE status = 'pending';

-- Hot read: all pending flags across communities (HQ pill count)
CREATE INDEX IF NOT EXISTS idx_member_flag_all_pending
  ON public.nex_community_member_flag (created_at DESC)
  WHERE status = 'pending';

-- Flagged-account history (for HQ "has this account been flagged before?")
CREATE INDEX IF NOT EXISTS idx_member_flag_flagged_history
  ON public.nex_community_member_flag (flagged_account_id, created_at DESC);

-- RLS: deny-all for anon + authenticated. Only service_role (via server
-- actions after requireHqAdmin / sealed authorisation) can read/write.
ALTER TABLE public.nex_community_member_flag ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_flag_deny_anon_select
  ON public.nex_community_member_flag FOR SELECT TO anon USING (false);
CREATE POLICY member_flag_deny_authenticated_select
  ON public.nex_community_member_flag FOR SELECT TO authenticated USING (false);
CREATE POLICY member_flag_deny_anon_insert
  ON public.nex_community_member_flag FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY member_flag_deny_authenticated_insert
  ON public.nex_community_member_flag FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY member_flag_deny_anon_update
  ON public.nex_community_member_flag FOR UPDATE TO anon USING (false);
CREATE POLICY member_flag_deny_authenticated_update
  ON public.nex_community_member_flag FOR UPDATE TO authenticated USING (false);
CREATE POLICY member_flag_deny_anon_delete
  ON public.nex_community_member_flag FOR DELETE TO anon USING (false);
CREATE POLICY member_flag_deny_authenticated_delete
  ON public.nex_community_member_flag FOR DELETE TO authenticated USING (false);

GRANT SELECT, INSERT, UPDATE ON public.nex_community_member_flag TO service_role;
REVOKE DELETE ON public.nex_community_member_flag FROM service_role;
-- Flags are append-only · HQ transitions status in-place · never deletes.

INSERT INTO public.nex_migration_history (version, description)
VALUES (
  '268',
  'nex_community_member_flag · member-level reports with mandatory reason text · HQ review lifecycle'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
