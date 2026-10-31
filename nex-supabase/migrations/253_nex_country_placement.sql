-- ============================================================================
-- NEX Migration 253 · nex_country_placement · per-content per-country placements
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
--   Per-country placement row for a single piece of content. Supports the
--   master spec's §9 requirement: ONE post identity, MANY country placements
--   each with their own moderation lifecycle.
--
-- Owner safeguard #1 (sealed 2026-11-01):
--   Approving / rejecting / holding / removing a placement row NEVER
--   mutates the content row's own Worldwide publication state. The
--   content's `visibility` and `moderation_status` columns are
--   independent and remain untouched by any country-placement action.
--
-- Dependencies:
--   · Migration 252 (nex_country_registry · provides FK target)
--   · nex_account must exist (FK target for requested_by + reviewed_by)
--
-- Scope (strictly):
--   · CREATE TABLE nex_country_placement
--   · UNIQUE (content_type, content_id, country)
--   · 2 indexes · partial queue + content lookup
--   · ENABLE RLS (no policies defined · service_role writes/reads;
--     authenticated reader policies arrive in Stage 3B via migration 245 or
--     a dedicated placement-RLS migration)
--
-- NOT in scope:
--   · Reader RLS policy (authenticated users seeing their own pending +
--     all approved) · deferred to Stage 3B
--   · Writer RLS policy (HQ moderators updating by country) · deferred
--     to Stage 3B
--   · Server actions (requestCountryPlacement, moderateCountryPlacement) ·
--     Stage 3C
--   · Content-existence enforcement trigger · Stage 3C via server action
--     path (server-side check before INSERT · see security notes below)
--
-- Backfill: NONE. Per owner Decision D2 (Stage 2 approval 2026-11-01), all
--   existing content remains Worldwide-published with ZERO country
--   placements. Irish Pride's 6 tracks + any other existing content are
--   untouched by this migration.
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
  RAISE EXCEPTION 'Migration 253 is DRAFT · requires explicit owner authorisation naming this file to apply.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='nex_country_registry') THEN
    RAISE EXCEPTION 'Migration 253 refused: nex_country_registry missing. Apply 252 first.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nex_country_placement (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic reference · content_type names the sibling table, content_id
  -- is the UUID of that row. Enforced in-app by the server action which
  -- verifies the row exists AND belongs to requested_by before INSERT (see
  -- security notes at bottom of file for the full validation chain).
  content_type       text NOT NULL CHECK (content_type IN (
                       'music_track','uploaded_video','live_post','live_session'
                     )),
  content_id         uuid NOT NULL,

  -- Target country · FK against the authoritative registry (252). Attempting
  -- to request a placement in a country not in the registry fails at the
  -- DB layer, before any application code runs.
  country            text NOT NULL REFERENCES public.nex_country_registry(code),

  -- Placement lifecycle · strictly separate from the content row's Worldwide
  -- visibility + moderation_status. HQ moderation transitions this field
  -- only. Content row is untouched by every placement_status write.
  placement_status   text NOT NULL DEFAULT 'pending'
                       CHECK (placement_status IN (
                         'pending',    -- awaiting HQ decision for this country
                         'approved',   -- live in the local feed
                         'rejected',   -- HQ said no · creator notified (future)
                         'on_hold',    -- HQ paused pending investigation
                         'removed'     -- HQ MOVE action · ex-approved, now out of local feed
                       )),

  -- Attribution
  requested_by       uuid NOT NULL REFERENCES public.nex_account(id),
  reviewed_by        uuid NULL REFERENCES public.nex_account(id),
  reviewed_at        timestamptz NULL,
  reviewer_reason    text NULL CHECK (reviewer_reason IS NULL OR length(reviewer_reason) <= 1000),

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  -- One placement per (content, country). Supports multi-country future
  -- per master spec §9 but prevents duplicate rows for the same pair.
  UNIQUE (content_type, content_id, country),

  -- Audit integrity: reviewed_at pairs with reviewed_by (both NULL or both set)
  CHECK ((reviewed_by IS NULL) = (reviewed_at IS NULL))
);

COMMENT ON TABLE public.nex_country_placement IS
  'Per-country distribution placement for a single piece of content. ONE music_track / uploaded_video / live_post / live_session row can have MANY placement rows · one per country · each with its own moderation lifecycle. Independent of Worldwide publication state (which lives on the content row itself as visibility + moderation_status). Sealed 2026-11-01 safeguard #1: approving / rejecting / holding / removing a placement NEVER mutates the content row.';

COMMENT ON COLUMN public.nex_country_placement.content_type IS
  'Which sibling table content_id references. Enum-like text CHECK. Expand only when a new content type gains per-country placement support (requires owner authorisation + explicit value add).';
COMMENT ON COLUMN public.nex_country_placement.placement_status IS
  'Country-feed lifecycle only. Independent of the content row''s own Worldwide visibility/moderation. HQ MOVE action sets this to ''removed''; the content row remains untouched.';
COMMENT ON COLUMN public.nex_country_placement.requested_by IS
  'The account that requested this placement. In normal flow = the content owner. HQ moderators do NOT create placements · they only act on existing ones.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Partial queue index · HQ moderators often query a single country's open items
CREATE INDEX idx_nex_country_placement_queue
  ON public.nex_country_placement (country, placement_status, created_at DESC)
  WHERE placement_status IN ('pending','on_hold');

-- Content lookup · "show all country placements for this track" (creator UI)
CREATE INDEX idx_nex_country_placement_content
  ON public.nex_country_placement (content_type, content_id);

-- ---------------------------------------------------------------------------
-- Integrity trigger · content_id must point at an existing row
-- (owner safeguard 2026-11-01 · polymorphic validation step 1 of 2)
-- ---------------------------------------------------------------------------
-- The polymorphic reference has no FK · but we CAN enforce row existence
-- via a trigger that dynamically selects from the sibling table. This
-- blocks orphan placements at the DB layer regardless of role.
--
-- Ownership check (requested_by = content.owner_account_id) is NOT in this
-- trigger because the ownership column name differs per content type:
--   nex_music_track.owner_account_id
--   nex_uploaded_video.owner_account_id
--   nex_live_post.business_id         (ownership via business, not direct account)
--   nex_live_session.broadcaster_account_id
-- The Stage 3C `requestCountryPlacement` server action resolves this
-- per-type and validates ownership against the viewer's account.
CREATE OR REPLACE FUNCTION public.nex_country_placement_verify_content_exists()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _found integer;
  _query text;
BEGIN
  -- content_type is CHECK-constrained to a closed enum, so %I is safe here
  -- (we are not using free-form user input in the identifier position).
  _query := format(
    'SELECT 1 FROM public.nex_%I WHERE id = $1 LIMIT 1',
    NEW.content_type
  );
  EXECUTE _query INTO _found USING NEW.content_id;
  IF _found IS NULL THEN
    RAISE EXCEPTION
      'nex_country_placement refused: no row in nex_% with id=% (orphan placement)',
      NEW.content_type, NEW.content_id
      USING ERRCODE = '23503';  -- foreign_key_violation (closest fit)
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_nex_country_placement_verify_content
  BEFORE INSERT ON public.nex_country_placement
  FOR EACH ROW EXECUTE FUNCTION public.nex_country_placement_verify_content_exists();

-- ---------------------------------------------------------------------------
-- RLS · service_role only in Stage 3A · reader policies arrive in Stage 3B
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_country_placement ENABLE ROW LEVEL SECURITY;

-- Explicit deny for authenticated+anon until Stage 3B scopes a reader policy
CREATE POLICY nex_country_placement_no_insert ON public.nex_country_placement
  FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY nex_country_placement_no_update ON public.nex_country_placement
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY nex_country_placement_no_delete ON public.nex_country_placement
  FOR DELETE TO authenticated, anon USING (false);
CREATE POLICY nex_country_placement_no_select_yet ON public.nex_country_placement
  FOR SELECT TO authenticated, anon USING (false);
-- service_role bypasses RLS · HQ reads + the Stage 3C server action writes
-- continue to work.

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '253',
  'nex_country_placement · per-content per-country placement rows · FK to nex_country_registry · UNIQUE(content_type, content_id, country) · partial queue index · reviewer-pairing check · explicit deny RLS until 3B reader policies ship.',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- SECURITY NOTES · polymorphic safety chain
-- Protection matrix (owner question 2026-11-01 · amended with explicit split)
-- ---------------------------------------------------------------------------
--
-- (A) Content exists at (content_type, content_id)
--     ENFORCED BY: trg_nex_country_placement_verify_content (SQL trigger, this file)
--     Role-agnostic. Dynamic SELECT via EXECUTE format(). Orphan INSERTs blocked
--     at DB layer regardless of session_user. Safe against:
--       · service_role mistakenly inserting a placement for a deleted track
--       · server action race condition where content was deleted between
--         ownership check and INSERT (trigger re-checks at INSERT time)
--
-- (B) Content belongs to requested_by
--     ENFORCED BY: Stage 3C server action (requestCountryPlacement)
--     NOT ENFORCED BY SQL because the ownership column name varies per
--     content_type (owner_account_id vs broadcaster_account_id vs business_id).
--     Server action resolves per-type:
--       SELECT 1 FROM public.nex_<content_type>
--        WHERE id = $contentId
--          AND <ownership_column_for_type> = $viewerAccountId
--     If zero rows → 404 Not Found before INSERT. requested_by always = $viewerAccountId.
--
-- (C) Country code is in registry
--     ENFORCED BY: FOREIGN KEY country REFERENCES nex_country_registry(code)
--     DB layer. INSERT fails with FK violation on unregistered code.
--
-- (D) Country is enabled for public feed
--     ENFORCED BY: Stage 3C server action
--     SELECT public_feed_enabled FROM nex_country_registry WHERE code=$country
--     Server refuses if false. SQL FK doesn't filter on this flag.
--
-- (E) Spoofed country from client payload
--     ENFORCED BY: Stage 3C server action
--     Server derives eligible country list from the viewer's TRUSTED account
--     country (nex_account.last_known_country_iso + nex_business.country via
--     account→business FK). Client payload is validated against this trusted
--     list, never accepted verbatim.
--
-- (F) Duplicate placement for same (content, country)
--     ENFORCED BY: UNIQUE (content_type, content_id, country)
--     DB layer. ON CONFLICT handling in server action for idempotent retries.
--
-- (G) Moderator approves wrong country
--     ENFORCED BY: Stage 3C requireHqCountryModerator(country) helper
--     Server-side authorisation gate. Validates that the moderator's
--     hq_role is either 'admin' (covers all) or 'country_moderator:XX'
--     where XX exactly equals the target country of the placement being
--     moderated. Server action refuses to proceed if not.
--     NOT ENFORCED BY SQL · the DB has no bind between the acting role
--     and the country column on the placement row. SQL-level enforcement
--     would require session-level GUC (nex.app_country) + RLS policy
--     referencing it, which is a Stage 3B concern (migration 245 scope).
--
-- (H) Rate limits on placement requests
--     ENFORCED BY: Stage 3C server action (future · not in 3A).
--
-- (I) Content deletion cascade cleanup
--     DEFERRED TO: Stage 3B · add BEFORE DELETE triggers on each content
--     table that cascade to nex_country_placement, OR a nightly cron sweep.
--     Not in Stage 3A scope · orphan placements become dormant data if a
--     content row is deleted today, but trigger (A) prevents NEW orphan
--     INSERTs from ever happening.
--
-- (J) Owner safeguard #1 · Worldwide independence
--     ENFORCED BY: strict code-review contract. No server action touching
--     this table may UPDATE the content row's visibility or moderation_status
--     column as a side effect. Stage 3C code review before ship must confirm.
--     NOT ENFORCED BY SQL · cross-table writes are inherently possible under
--     service_role. Code review is the gate.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Verification queries (run AFTER authorised apply)
-- ---------------------------------------------------------------------------
-- -- 1. Table exists · 0 rows
-- SELECT count(*) AS n FROM public.nex_country_placement;
--
-- -- 2. Columns + types + FKs
-- SELECT conname, pg_get_constraintdef(c.oid)
--   FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
--  WHERE t.relname='nex_country_placement';
--
-- -- 3. Indexes
-- SELECT indexname, indexdef
--   FROM pg_indexes
--  WHERE schemaname='public' AND tablename='nex_country_placement';
--
-- -- 4. RLS policies in place
-- SELECT policyname, cmd, roles, qual, with_check
--   FROM pg_policies
--  WHERE schemaname='public' AND tablename='nex_country_placement';
