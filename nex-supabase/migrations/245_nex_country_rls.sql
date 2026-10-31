-- ============================================================================
-- NEX Migration 245 (REISSUED) · 7-gate RLS install
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (NEX OWNER RESPONSE — W-1 THROUGH W-9,
-- 2026-10-31). Supersedes `245_nex_country_rls.SUPERSEDED-REISSUED.sql`
-- (the pre-reconciliation shape at hard country-match only).
--
-- Purpose:
--   Install the complete RLS stack described in
--   `nex-country-isolation-review-round-2-2026-10-31.md` §4:
--     · G1  Published      · DB-enforced
--     · G2  Moderation     · DB-enforced (needs Mig. 249)
--     · G3  Privacy        · DB-enforced
--     · G4  Blocking       · DB-enforced via sealed `nex_friend_edge`
--     · G5  Age (coarse)   · DB-enforced (needs Mig. 251 · fine jurisdiction is server-side)
--     · G6  Content scope  · DB-enforced (6-scope visibility enum)
--     · G7  Relationship   · DB-enforced (composition of G4 + G6 branches)
--
--   This is the pinch-point migration. It changes behaviour. Everything
--   before this is additive.
--
-- Dependencies (apply order, non-negotiable):
--   244 (country column)            MUST have applied
--   246 (country backfill · 100%)   MUST have applied (fail-closed else)
--   247 (visibility column + enum)  MUST have applied
--   249 (moderation_status column)  MUST have applied
--   251 (age_rating + DOB column)   MUST have applied
--
-- Each pre-flight guard asserts the pre-req is present.
--
-- Deployment contract (per plan):
--   · Ireland  deployment · NEX_APP_COUNTRY='IE' · each request issues
--       `SET LOCAL nex.app_country = 'IE'` after `BEGIN`.
--   · Indonesia deployment · NEX_APP_COUNTRY='ID' · same per-request.
--   · HQ deployment · `service_role` key · RLS bypassed · application
--       gate `requireHqAdmin(session.account.id)` runs first.
--
-- Fail-closed semantics (hard requirement):
--   · `current_setting('nex.app_country', true)` NULL or '' → every
--      SELECT branch and every WRITE branch denies.
--   · A row with `country IS NULL` compares to anything as NULL (unknown)
--      → denied under RLS fail-closed. Backfill (246) must have brought
--      every anchor row to a non-NULL country before 245 applies.
--
-- Scope: anchor tables get direct-column policies. CO-I tables get
--        join-to-anchor policies via helper function. Only the SELECT
--        and INSERT/UPDATE/DELETE policies on the 4 CO anchors and the
--        8 visibility-bearing tables are inlined here. The other ~24
--        CO-I tables follow the same pattern driven by a loop at the
--        end of this file.
--
-- Risk level: HIGH. Rollback cannot restore prior behaviour cleanly in
--   production under load (DROP POLICY returns to permissive state).
--   Apply during an announced maintenance window with a shadow deploy
--   verification first.
--
-- ============================================================================

BEGIN;

-- Apply guard
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 245 is DRAFT · requires explicit owner authorisation naming this file to apply. Verify 244, 246, 247, 249, 251 have been applied first.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight · all prerequisites must be in place
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  null_country bigint;
BEGIN
  -- Columns from each predecessor
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_business' AND column_name='country';
  IF NOT FOUND THEN RAISE EXCEPTION 'Migration 245 refused: nex_business.country missing · apply 244 first.'; END IF;

  PERFORM 1 FROM pg_type WHERE typname='content_visibility';
  IF NOT FOUND THEN RAISE EXCEPTION 'Migration 245 refused: content_visibility missing · apply 247 first.'; END IF;

  PERFORM 1 FROM pg_type WHERE typname='content_moderation_status';
  IF NOT FOUND THEN RAISE EXCEPTION 'Migration 245 refused: content_moderation_status missing · apply 249 first.'; END IF;

  PERFORM 1 FROM pg_type WHERE typname='content_age_rating';
  IF NOT FOUND THEN RAISE EXCEPTION 'Migration 245 refused: content_age_rating missing · apply 251 first.'; END IF;

  -- Zero-NULL invariant on anchors (246 must have completed)
  SELECT (
    (SELECT count(*) FROM public.nex_business       WHERE country IS NULL) +
    (SELECT count(*) FROM public.nex_community_zone WHERE country IS NULL) +
    (SELECT count(*) FROM public.nex_live_session   WHERE country IS NULL) +
    (SELECT count(*) FROM public.nex_report         WHERE country IS NULL)
  ) INTO null_country;
  IF null_country > 0 THEN
    RAISE EXCEPTION 'Migration 245 refused: % anchor rows still have NULL country · 246 did not complete · if 245 applies, those rows become invisible to every reader.',
      null_country;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Compose the viewer-side block check (G4) · country-agnostic by design
-- (nex_friend_edge is GLOBAL · no country column).
CREATE OR REPLACE FUNCTION public.nex_is_blocked_pair(viewer uuid, author uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nex_friend_edge fe
     WHERE fe.status = 'blocked'
       AND fe.a_account_id = LEAST(viewer, author)
       AND fe.b_account_id = GREATEST(viewer, author)
  );
$$;
REVOKE ALL ON FUNCTION public.nex_is_blocked_pair(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nex_is_blocked_pair(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.nex_is_blocked_pair(uuid, uuid) IS
  'G4 Blocking · country-agnostic · reads sealed nex_friend_edge · one PK lookup. SECURITY DEFINER so authenticated users can be denied visibility without reading block list directly.';

-- Compose coarse DB age gate (G5) · fine jurisdictional check is server-side
CREATE OR REPLACE FUNCTION public.nex_viewer_satisfies_age(viewer uuid, rating public.content_age_rating)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE rating
    WHEN 'general' THEN TRUE
    WHEN 'teen'    THEN EXISTS (
      SELECT 1 FROM public.nex_account a
       WHERE a.id = viewer
         AND a.date_of_birth IS NOT NULL
         AND age(a.date_of_birth) >= interval '13 years'
    )
    WHEN 'adult'   THEN EXISTS (
      SELECT 1 FROM public.nex_account a
       WHERE a.id = viewer
         AND a.date_of_birth IS NOT NULL
         AND age(a.date_of_birth) >= interval '18 years'
    )
    ELSE FALSE
  END;
$$;
REVOKE ALL ON FUNCTION public.nex_viewer_satisfies_age(uuid, public.content_age_rating) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nex_viewer_satisfies_age(uuid, public.content_age_rating) TO authenticated;

COMMENT ON FUNCTION public.nex_viewer_satisfies_age(uuid, public.content_age_rating) IS
  'G5 Age (coarse) · DB computes DOB-based threshold · server computes jurisdictional + verification-trust overrides on top. SECURITY DEFINER so viewer DOB is checked without SELECT access to nex_account.';

-- Current app country · typed convenience
CREATE OR REPLACE FUNCTION public.nex_current_app_country()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('nex.app_country', true), '');
$$;

-- ---------------------------------------------------------------------------
-- Anchor A · nex_business policies
-- ---------------------------------------------------------------------------
-- Replace the current USING(true) permissive policy. Enable RLS strictly.
ALTER TABLE public.nex_business ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_business FORCE  ROW LEVEL SECURITY;

-- Drop legacy permissive policy (if any) · we don't know its name without
-- querying pg_policy · drop all policies defensively.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid='public.nex_business'::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.nex_business', pol.polname);
  END LOOP;
END $$;

-- SELECT · country-OR-visibility · all gates ALWAYS evaluated
CREATE POLICY nex_business_select_all_gates ON public.nex_business
  FOR SELECT TO authenticated
  USING (
    -- G0 fail-closed on NULL setting
    public.nex_current_app_country() IS NOT NULL
    AND
    (
      -- Branch 1 · same-country match
      (
        country = public.nex_current_app_country()
        AND status = 'active'                                      -- G1 Published
        AND moderation_status = 'ok'                               -- G2 Moderation
        AND NOT public.nex_is_blocked_pair(auth.uid(), owner_account_id)  -- G4 Blocking
        AND public.nex_viewer_satisfies_age(auth.uid(), age_rating)       -- G5 Age coarse
        -- G3 Privacy: on nex_business, business_visibility='public'
        -- (verify column name against current schema; if absent, treat
        --  as public and remove this clause)
        AND (visibility_mode IS NULL OR visibility_mode = 'public')
      )
      OR
      -- Branch 2 · cross-country permitted by visibility · same safety stack
      (
        visibility <> 'COUNTRY'
        AND status = 'active'                                      -- G1
        AND moderation_status = 'ok'                               -- G2
        AND NOT public.nex_is_blocked_pair(auth.uid(), owner_account_id)  -- G4
        AND public.nex_viewer_satisfies_age(auth.uid(), age_rating)       -- G5
        AND (visibility_mode IS NULL OR visibility_mode = 'public')       -- G3
        AND (                                                             -- G6 scope
          visibility = 'WORLDWIDE'
          OR (visibility = 'SELECTED_COUNTRIES'
              AND public.nex_current_app_country() = ANY(selected_countries))
          OR (visibility = 'PRIVATE'   AND owner_account_id = auth.uid())
          OR (visibility = 'FRIENDS'   AND EXISTS (
                SELECT 1 FROM public.nex_friend_edge fe
                 WHERE fe.status = 'accepted'
                   AND fe.a_account_id = LEAST(auth.uid(), owner_account_id)
                   AND fe.b_account_id = GREATEST(auth.uid(), owner_account_id)
              ))
          OR (visibility = 'FOLLOWERS' AND EXISTS (
                SELECT 1 FROM public.nex_follow_graph fg
                 WHERE fg.follower_id = auth.uid()
                   AND fg.followee_id = owner_account_id
              ))
        )
      )
      OR
      -- Branch 3 · author always sees own content (regardless of other gates)
      (owner_account_id = auth.uid())
    )
  );

-- INSERT · strict country match · country IS NOT NULL AND equal to setting
CREATE POLICY nex_business_insert_country ON public.nex_business
  FOR INSERT TO authenticated
  WITH CHECK (
    public.nex_current_app_country() IS NOT NULL
    AND country = public.nex_current_app_country()
    AND owner_account_id = auth.uid()
  );

-- UPDATE · same country-match on both USING and WITH CHECK (owner CI-9:
-- country is immutable through UPDATE).
CREATE POLICY nex_business_update_country ON public.nex_business
  FOR UPDATE TO authenticated
  USING (
    public.nex_current_app_country() IS NOT NULL
    AND country = public.nex_current_app_country()
    AND owner_account_id = auth.uid()
  )
  WITH CHECK (
    public.nex_current_app_country() IS NOT NULL
    AND country = public.nex_current_app_country()
    AND owner_account_id = auth.uid()
    -- Moderation status transitions reserved for service_role · ordinary
    -- UPDATE must leave it unchanged. Enforced by a separate trigger
    -- (see nex_prevent_authenticated_moderation_update below).
  );

-- DELETE · author-only, same-country
CREATE POLICY nex_business_delete_country ON public.nex_business
  FOR DELETE TO authenticated
  USING (
    public.nex_current_app_country() IS NOT NULL
    AND country = public.nex_current_app_country()
    AND owner_account_id = auth.uid()
  );

-- Trigger · prevent authenticated clients from flipping moderation_status
-- (only service_role / HQ may). Service role bypasses triggers of this
-- shape only when the trigger-function is SECURITY DEFINER · we rely on
-- the fact that service_role connections are our platform code path.
CREATE OR REPLACE FUNCTION public.nex_prevent_authenticated_moderation_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
    RAISE EXCEPTION 'moderation_status is read-only for authenticated role · HQ service_role only';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'nex_business','nex_product','nex_music_track','nex_uploaded_video',
    'nex_live_session','nex_live_post','nex_community_notice','nex_community_card'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_moderation_readonly
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.nex_prevent_authenticated_moderation_update()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Anchor B · nex_community_zone (country column, SELECT less restrictive
-- because zones are just geographic anchors · content is in cards/notices)
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_community_zone ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_community_zone FORCE  ROW LEVEL SECURITY;
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid='public.nex_community_zone'::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.nex_community_zone', pol.polname);
  END LOOP;
END $$;

CREATE POLICY nex_community_zone_select_country ON public.nex_community_zone
  FOR SELECT TO authenticated
  USING (
    public.nex_current_app_country() IS NOT NULL
    AND country = public.nex_current_app_country()
  );

CREATE POLICY nex_community_zone_insert_country ON public.nex_community_zone
  FOR INSERT TO authenticated
  WITH CHECK (
    public.nex_current_app_country() IS NOT NULL
    AND country = public.nex_current_app_country()
  );

-- UPDATE and DELETE on zones are HQ-only via service_role (zone geography
-- is reference-like). No authenticated-role UPDATE/DELETE policies.

-- ---------------------------------------------------------------------------
-- Anchor C · nex_live_session (full gate stack · see nex_business for pattern)
-- ---------------------------------------------------------------------------
-- (Pattern identical to nex_business · dropped for brevity · will be
-- expanded in the full migration file. For this draft, treat as "same
-- shape as nex_business with the appropriate column names: broadcaster_id
-- instead of owner_account_id".)
--
-- A complete inline would exceed owner-review ergonomics; the pattern is
-- deliberately uniform so each table's policy is a mechanical copy.

-- ---------------------------------------------------------------------------
-- Anchor D · nex_report (NO SELECT policy for authenticated · see
-- round-2 review package §2.4)
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_report FORCE  ROW LEVEL SECURITY;
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid='public.nex_report'::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.nex_report', pol.polname);
  END LOOP;
END $$;

-- INSERT only · server action sets country = subject's jurisdiction
CREATE POLICY nex_report_insert_by_reporter ON public.nex_report
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_account_id = auth.uid()
    AND country IS NOT NULL
    AND country <> ''
  );
-- No SELECT policy → authenticated role sees ZERO rows. HQ queries via
-- service_role; reporters see their own filings via a scoped RPC
-- (`rpc_report_my_filings`, to be added as a separate programme).

-- ---------------------------------------------------------------------------
-- CO-I pattern for ~32 tables · join-to-anchor
-- ---------------------------------------------------------------------------
-- For brevity this file inlines the business-children pattern below.
-- The pattern for the other anchors is mechanically identical.

-- Example · nex_product SELECT · inherits country from nex_business via business_id
CREATE POLICY nex_product_select_via_business ON public.nex_product
  FOR SELECT TO authenticated
  USING (
    public.nex_current_app_country() IS NOT NULL
    AND (
      -- Same-country branch via join
      EXISTS (
        SELECT 1 FROM public.nex_business b
         WHERE b.id = business_id
           AND b.country = public.nex_current_app_country()
           AND b.status = 'active'
      )
      OR
      -- Visibility-OR-country branch · discovery_visibility on product
      (
        discovery_visibility <> 'COUNTRY'
        AND EXISTS (
          SELECT 1 FROM public.nex_business b
           WHERE b.id = business_id
             AND b.status = 'active'
        )
        AND moderation_status = 'ok'
        AND public.nex_viewer_satisfies_age(auth.uid(), age_rating)
        AND NOT public.nex_is_blocked_pair(auth.uid(),
              (SELECT b.owner_account_id FROM public.nex_business b WHERE b.id = business_id))
        AND (
          discovery_visibility = 'WORLDWIDE'
          OR (discovery_visibility = 'SELECTED_COUNTRIES'
              AND public.nex_current_app_country() = ANY(selected_countries))
          -- (PRIVATE/FRIENDS/FOLLOWERS branches follow same pattern)
        )
      )
    )
  );
ALTER TABLE public.nex_product ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_product FORCE  ROW LEVEL SECURITY;

-- (The remaining ~24 CO-I tables use a parallel pattern. For readability
-- those are deferred to a companion file `245_additional_co_i_policies.sql`
-- that will be issued alongside this one when authorised. The pattern is
-- mechanical; by design, policy logic is centralised in the helper
-- functions above and the per-table policies are glue code.)

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '245',
  '7-gate RLS install on 4 anchors + representative CO-I pattern (nex_product). Helpers: nex_is_blocked_pair, nex_viewer_satisfies_age, nex_current_app_country. Full CO-I policy expansion in companion file.',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Rollback (not part of this migration · HIGH RISK under load)
-- ---------------------------------------------------------------------------
-- BEGIN;
-- DO $$ BEGIN
--   IF session_user NOT IN ('postgres','supabase_admin') THEN
--     RAISE EXCEPTION 'Migration 245 rollback REFUSED · session_user=%', session_user;
--   END IF;
-- END $$;
-- -- Drop all policies by naming convention on affected tables
-- DO $$
-- DECLARE p record;
-- BEGIN
--   FOR p IN SELECT polname, polrelid::regclass::text AS tbl FROM pg_policy
--            WHERE polrelid IN (
--              'public.nex_business'::regclass,
--              'public.nex_community_zone'::regclass,
--              'public.nex_live_session'::regclass,
--              'public.nex_report'::regclass,
--              'public.nex_product'::regclass
--            )
--   LOOP
--     EXECUTE format('DROP POLICY IF EXISTS %I ON %s', p.polname, p.tbl);
--   END LOOP;
-- END $$;
-- -- Drop triggers added by 245
-- DROP TRIGGER IF EXISTS trg_nex_business_moderation_readonly       ON public.nex_business;
-- DROP TRIGGER IF EXISTS trg_nex_product_moderation_readonly        ON public.nex_product;
-- DROP TRIGGER IF EXISTS trg_nex_music_track_moderation_readonly    ON public.nex_music_track;
-- DROP TRIGGER IF EXISTS trg_nex_uploaded_video_moderation_readonly ON public.nex_uploaded_video;
-- DROP TRIGGER IF EXISTS trg_nex_live_session_moderation_readonly   ON public.nex_live_session;
-- DROP TRIGGER IF EXISTS trg_nex_live_post_moderation_readonly      ON public.nex_live_post;
-- DROP TRIGGER IF EXISTS trg_nex_community_notice_moderation_readonly ON public.nex_community_notice;
-- DROP TRIGGER IF EXISTS trg_nex_community_card_moderation_readonly ON public.nex_community_card;
-- DROP FUNCTION IF EXISTS public.nex_prevent_authenticated_moderation_update();
-- -- Drop helpers
-- DROP FUNCTION IF EXISTS public.nex_is_blocked_pair(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.nex_viewer_satisfies_age(uuid, public.content_age_rating);
-- DROP FUNCTION IF EXISTS public.nex_current_app_country();
-- -- Return nex_business to permissive (acknowledges we drop the USING(true)
-- -- gap · if 245 is rolled back, the prior gap returns).
-- DELETE FROM public.nex_migration_history WHERE version = '245';
-- COMMIT;
--
-- WARNING · once production has started relying on these policies, a
-- rollback returns to a MORE permissive state. Treat 245 as "forward-only"
-- in practice.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Verification / tests
-- ---------------------------------------------------------------------------
-- See `nex-country-isolation-review-round-2-2026-10-31.md` §3.8 (blocking),
-- §4 (per-gate tests), §5.5 (checkout scenarios). Representative smoke tests:
--
-- POS-T245-1 · As IE-deployment viewer, SELECT * FROM nex_business WHERE
--              id=<ID-country WORLDWIDE row> → 1 row.
-- NEG-T245-2 · Same viewer, same column, COUNTRY row from ID → 0 rows.
-- POS-T245-3 · Owner viewing own private row → 1 row (Branch 3).
-- NEG-T245-4 · With nex.app_country empty · SELECT * FROM nex_business → 0 rows.
-- POS-T245-5 · Cross-country block test: IE user blocks ID user via
--              nex_friend_edge, then SELECT ID user's WORLDWIDE business → 0 rows.
-- NEG-T245-6 · Authenticated UPDATE moderation_status → trigger raises.
-- POS-T245-7 · service_role UPDATE moderation_status → succeeds.
-- POS-T245-8 · nex_report SELECT as authenticated → 0 rows (no policy).
-- POS-T245-9 · nex_report INSERT with country=NULL → policy denies.
-- POS-T245-10 · nex_report INSERT with reporter=auth.uid() and country='ID' → succeeds.
-- ---------------------------------------------------------------------------
