-- ============================================================================
-- NEX Migration 254 · nex_hq_action_log · append-only audit of HQ decisions
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (NEX GLOBAL FEED PROPOSAL · Stage 3A ·
-- 2026-11-01). DO NOT APPLY to the sealed Supabase project
-- `ijvqdvsvwtwxzcqmoqit` without a SEPARATE explicit owner authorisation
-- naming this file.
--
-- Purpose:
--   Durable, immutable audit trail for every HQ enforcement decision across
--   the Global Feed architecture. Fills the "no audit log" gap identified
--   in Stage 1 audit · 2026-11-01 (nex_report has reviewed_by/reviewed_at
--   but no action-outcome field).
--
-- Immutability guarantee (owner question 2026-11-01):
--   Append-only by RLS design. authenticated + anon are denied INSERT,
--   UPDATE, DELETE, SELECT. Only service_role can write · and the Stage 3C
--   server action layer will ONLY emit INSERT statements · never UPDATE
--   or DELETE. Even a signed-in HQ admin cannot modify their prior action
--   through the Supabase client. The only non-service-role access path is
--   a Stage 3C read-only API that returns filtered + redacted entries.
--
-- Dependencies:
--   · Migration 252 (nex_country_registry · FK target for optional country)
--   · nex_account (FK target for actor_account_id)
--
-- Scope (strictly):
--   · CREATE TABLE nex_hq_action_log · UUID PK · 3 indexes
--   · ENABLE RLS + 4 deny-all policies on authenticated+anon
--
-- NOT in scope:
--   · The read API that HQ uses to review the log · Stage 3C
--   · UI (log viewer page) · Stage 3C
--   · Retention policy (if any) · owner decision deferred
--
-- Backfill: NONE. New empty table.
--
-- Rollback: trivial · DROP TABLE IF EXISTS. No downstream FK references.
--
-- Risk level: LOW (new empty table, no touch to existing data).
--
-- ============================================================================

BEGIN;

-- Apply guard
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 254 is DRAFT · requires explicit owner authorisation naming this file to apply.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='nex_country_registry') THEN
    RAISE EXCEPTION 'Migration 254 refused: nex_country_registry missing. Apply 252 first.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nex_hq_action_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Attribution · WHO performed the action
  actor_account_id   uuid NOT NULL REFERENCES public.nex_account(id),

  -- Action enum · covers Global Feed workflow actions. Expand only with
  -- owner authorisation (preserves audit semantic stability).
  action             text NOT NULL CHECK (action IN (
                       'country_placement_approved',   -- Stage 3C · HQ OK
                       'country_placement_rejected',   -- Stage 3C · HQ REJECT
                       'country_placement_held',        -- Stage 3C · HQ HOLD
                       'country_placement_removed',     -- Stage 3C · HQ MOVE
                       'worldwide_moderation_set',      -- Future · HQ sets content.moderation_status
                       'account_warn',                   -- Future · HQ warns an account
                       'account_suspend',                -- Future · HQ suspends an account
                       'content_takedown'                -- Future · HQ removes content worldwide
                     )),

  -- Target identification · nullable so account-level actions don't require
  -- a content row.
  content_type       text NULL CHECK (
                       content_type IS NULL
                       OR content_type IN ('music_track','uploaded_video','live_post','live_session','business','product','community_notice','community_card')
                     ),
  content_id         uuid NULL,

  -- Country · NULL for Worldwide-level actions, FK-set for country-scoped actions
  country            text NULL REFERENCES public.nex_country_registry(code),

  -- Transition clarity · what was the status before/after this action
  previous_status    text NULL,
  new_status         text NULL,

  -- Narrative + extensibility
  reason             text NULL CHECK (reason IS NULL OR length(reason) <= 2000),
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nex_hq_action_log IS
  'Append-only audit of every HQ enforcement decision. IMMUTABLE by RLS design (sealed 2026-11-01 safeguard): authenticated+anon denied INSERT/UPDATE/DELETE/SELECT. Only service_role writes · server actions emit INSERTs only · no UPDATE or DELETE path will ever be granted.';

COMMENT ON COLUMN public.nex_hq_action_log.action IS
  'Action enum · covers Global Feed moderation + future account/content actions. Each enum value must map to a specific server-action code path in src/lib/nex-native/hq/ (Stage 3C).';
COMMENT ON COLUMN public.nex_hq_action_log.metadata IS
  'JSONB free-form for action-specific extras · e.g. {"old_placement_id":"<uuid>","worldwide_feed_unchanged":true} to prove safeguard #1.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_nex_hq_action_log_actor_time
  ON public.nex_hq_action_log (actor_account_id, created_at DESC);

CREATE INDEX idx_nex_hq_action_log_content
  ON public.nex_hq_action_log (content_type, content_id, created_at DESC)
  WHERE content_id IS NOT NULL;

CREATE INDEX idx_nex_hq_action_log_country
  ON public.nex_hq_action_log (country, created_at DESC)
  WHERE country IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Immutability layer 1 · DB-ENFORCED triggers (role-agnostic · owner safeguard 2026-11-01)
-- ---------------------------------------------------------------------------
-- RLS alone is insufficient · service_role bypasses RLS. Owner directive
-- 2026-11-01: audit log must be append-only REGARDLESS of role, including
-- against accidental privileged application code paths.
--
-- These triggers fire BEFORE UPDATE and BEFORE DELETE on every row,
-- regardless of session_user. The only way to UPDATE or DELETE a row
-- is to first DROP these triggers — which is a schema change requiring
-- owner-authored migration + explicit intent. Even a postgres superuser
-- or service_role cannot modify a row without that explicit step.
CREATE OR REPLACE FUNCTION public.nex_hq_action_log_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'nex_hq_action_log is append-only · % blocked regardless of role (session_user=%). To intentionally mutate audit history, author a dedicated migration that drops this trigger with explicit owner authorisation.',
    TG_OP, session_user
    USING ERRCODE = '42501';  -- insufficient_privilege
END;
$$;

CREATE TRIGGER trg_nex_hq_action_log_block_update
  BEFORE UPDATE ON public.nex_hq_action_log
  FOR EACH ROW EXECUTE FUNCTION public.nex_hq_action_log_block_mutation();

CREATE TRIGGER trg_nex_hq_action_log_block_delete
  BEFORE DELETE ON public.nex_hq_action_log
  FOR EACH ROW EXECUTE FUNCTION public.nex_hq_action_log_block_mutation();

-- ---------------------------------------------------------------------------
-- Immutability layer 2 · RLS deny-all for authenticated + anon
-- ---------------------------------------------------------------------------
-- Belt + braces · trigger protects against role bypass · RLS still enforces
-- the normal zero-trust pattern (anon + authenticated get nothing).
ALTER TABLE public.nex_hq_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_hq_action_log_deny_insert ON public.nex_hq_action_log
  FOR INSERT TO authenticated, anon WITH CHECK (false);

CREATE POLICY nex_hq_action_log_deny_update ON public.nex_hq_action_log
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY nex_hq_action_log_deny_delete ON public.nex_hq_action_log
  FOR DELETE TO authenticated, anon USING (false);

CREATE POLICY nex_hq_action_log_deny_select ON public.nex_hq_action_log
  FOR SELECT TO authenticated, anon USING (false);

-- ---------------------------------------------------------------------------
-- Write + read paths · how legitimate HQ activity reaches this table
-- ---------------------------------------------------------------------------
-- WRITE (Stage 3C server actions · all run under service_role):
--   Every HQ moderation server action in src/lib/nex-native/hq/ ends its
--   transaction with ONE INSERT into nex_hq_action_log. The server actions
--   must NEVER issue UPDATE or DELETE against this table · the triggers
--   above would raise a 42501 error and roll back the entire transaction.
--   Code review of every HQ server action before Stage 3C ship must confirm
--   this contract.
--
-- READ (Stage 3C log viewer route · also runs under service_role):
--   `/nex-native/hq/audit/page.tsx` + `/api/nex-native/hq/audit/list/route.ts`
--   uses nexSupabaseAdmin to SELECT. Server-side filters apply RBAC:
--     · admin role → sees all
--     · country_moderator:XX → sees only entries where country=XX
--     · reviewer → read-only slice (future)
--   The route returns a redacted projection to the client · the raw audit
--   row is never shipped to the browser.

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '254',
  'nex_hq_action_log · append-only audit of HQ enforcement actions · explicit deny policies for authenticated+anon on INSERT/UPDATE/DELETE/SELECT · service_role bypasses · 3 indexes.',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification queries (run AFTER authorised apply)
-- ---------------------------------------------------------------------------
-- -- 1. Table exists · 0 rows
-- SELECT count(*) AS n FROM public.nex_hq_action_log;
--
-- -- 2. All 4 deny policies in place
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname='public' AND tablename='nex_hq_action_log'
--  ORDER BY policyname;
--
-- -- 3. As authenticated · INSERT should FAIL
-- -- (manual test via Supabase client with user JWT · policy denies)
--
-- -- 4. As service_role · INSERT should SUCCEED
-- -- (Stage 3C server action proves this)
