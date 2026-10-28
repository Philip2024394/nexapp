-- ============================================================================
-- NEX-native Migration 223 · nex_uploaded_video + nex-live-uploaded bucket
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Must not be applied to the sealed production project
-- `ijvqdvsvwtwxzcqmoqit` without explicit owner approval. Owner
-- answered 2026-10-24 "Not now · wait for isolated sandbox" on the
-- DB target question · this migration + the companion storage bucket
-- are drafted FOR that sandbox apply window only.
--
-- Owner directive 2026-10-24 · uploaded videos appear in the TBD
-- "Recorded videos" slot of the Live discovery feed · they are
-- NEVER labelled as currently Live · they coexist with real-time
-- Live sessions as a distinct content type.
--
-- Scope
-- ----------------------------------------------------------------------------
--   Part A · `nex_uploaded_video` row table
--   Part B · `nex-live-uploaded` storage bucket (soft doc · the bucket
--            must be created in the Supabase dashboard/CLI by the
--            operator at apply time · this migration cannot create a
--            storage bucket via SQL)
--
-- Doctrine (sealed · never drifted)
-- ----------------------------------------------------------------------------
--   · Uploaded videos are NEVER labelled "Live" in UI. The feed
--     renders them in a separate section below the Live sessions
--     with a distinct chip ("RECORDED" or similar). This mirrors
--     the owner directive "Never label non-live content as currently
--     Live."
--   · Rights declaration is REQUIRED at publish time
--     (`owner_content` | `licensed` | `public_domain`). Writing a
--     row without a declaration fails the CHECK.
--   · Marketing-boundary · this table is a MARKETING / discovery
--     surface. It MUST NOT be joined into Intelligence / Directory
--     canonical queries.
--   · Soft-delete only · no hard DELETE for authenticated callers.
--     Removal is `visibility='removed'` via service-role.
--
-- Dependencies
-- ----------------------------------------------------------------------------
--   APPLIED (sandbox prerequisites):
--     001_nex_migration_history_and_account.sql (nex_account identity)
--     002_nex_business.sql (nex_business reference)
--     010_nex_rls_recursion_fix.sql (helper functions)
--     217_nex_rls_helper_search_path_harden.sql (hardened helpers)
--
-- Rollback
-- ----------------------------------------------------------------------------
--   BEGIN;
--     DROP TABLE IF EXISTS nex_uploaded_video CASCADE;
--     DELETE FROM nex_migration_history WHERE version = '223';
--   COMMIT;
--
--   Storage bucket rollback (dashboard):
--     Empty the `nex-live-uploaded` bucket, then delete it.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_uploaded_video (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_account_id uuid NOT NULL
    REFERENCES public.nex_account(id) ON DELETE CASCADE,

  -- Optional business attachment · when non-null, the video appears
  -- on that business's shop page. Null = owner's personal content.
  business_id uuid NULL
    REFERENCES public.nex_business(id) ON DELETE SET NULL,

  title text NOT NULL
    CHECK (char_length(title) BETWEEN 1 AND 120),

  caption text NULL
    CHECK (caption IS NULL OR char_length(caption) <= 500),

  storage_bucket text NOT NULL DEFAULT 'nex-live-uploaded',
  storage_object_path text NOT NULL
    CHECK (char_length(storage_object_path) BETWEEN 1 AND 512),

  -- Optional media metadata (set at upload time if the uploader
  -- can inspect the file). Null until known.
  duration_seconds int NULL
    CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  width int NULL CHECK (width IS NULL OR width > 0),
  height int NULL CHECK (height IS NULL OR height > 0),
  byte_size bigint NULL CHECK (byte_size IS NULL OR byte_size > 0),

  mime_type text NOT NULL DEFAULT 'video/mp4'
    CHECK (mime_type IN ('video/mp4', 'video/webm', 'video/quicktime')),

  -- Rights declaration · required at publish time per owner directive
  -- 2026-10-24 ("make sure non-owned content never gets published
  -- without a licence"). Writing a row with any other value fails.
  rights_declaration text NOT NULL
    CHECK (rights_declaration IN ('owner_content', 'licensed', 'public_domain')),

  -- ISO-3166 alpha-2 country of origin (uppercase). Powers the
  -- 70/20/10 country-weighted feed ranking (see brainstorm doc
  -- `nex-live-feed-ranking-brainstorm-2026-10-24.md`). Required ·
  -- the uploader MUST declare where this content belongs so the
  -- feed can privilege a viewer's home market first.
  country_of_origin text NOT NULL
    CHECK (country_of_origin ~ '^[A-Z]{2}$'),

  -- Freeform topic tags · lowercase · 1..32 chars each · up to 10
  -- per video. Powers the 20% "same-topic" slice when the viewer
  -- shows in-session interest in a topic. Owner-authored at publish
  -- time · future admin surfaces may append machine-inferred tags
  -- but at the data layer these are a plain text[] array.
  topic_tags text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (
      array_length(topic_tags, 1) IS NULL
      OR array_length(topic_tags, 1) <= 10
    ),

  source text NOT NULL DEFAULT 'owner_upload'
    CHECK (source IN ('owner_upload', 'imported')),

  visibility text NOT NULL DEFAULT 'draft'
    CHECK (visibility IN ('draft', 'public', 'unlisted', 'removed')),

  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL,

  -- Consistency: published_at is set iff visibility is public/unlisted.
  CHECK (
    (visibility = 'public' OR visibility = 'unlisted') = (published_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.nex_uploaded_video IS
  'Owner-uploaded videos surfaced in the NEX Live discovery feed as a distinct content type · NEVER labelled as currently Live. Rights declaration required at publish time. Marketing-boundary · do not join into Intelligence/Directory canonical queries. Sealed 2026-10-24 · Migration 223.';

-- Feed-order index · published videos newest-first.
CREATE INDEX IF NOT EXISTS idx_nex_uploaded_video_published
  ON public.nex_uploaded_video (published_at DESC)
  WHERE visibility = 'public' AND published_at IS NOT NULL;

-- Country-sharded index · the 70% home-country slice reads
-- (country_of_origin, published_at DESC) scoped to published rows.
CREATE INDEX IF NOT EXISTS idx_nex_uploaded_video_published_by_country
  ON public.nex_uploaded_video (country_of_origin, published_at DESC)
  WHERE visibility = 'public' AND published_at IS NOT NULL;

-- GIN index on topic_tags · the 20% same-topic slice reads
-- `topic_tags && viewer_interest_tags` (overlap).
CREATE INDEX IF NOT EXISTS idx_nex_uploaded_video_topic_tags
  ON public.nex_uploaded_video USING GIN (topic_tags)
  WHERE visibility = 'public' AND published_at IS NOT NULL;

-- Owner scan · drafts + published alike.
CREATE INDEX IF NOT EXISTS idx_nex_uploaded_video_by_owner
  ON public.nex_uploaded_video (owner_account_id, created_at DESC);

ALTER TABLE public.nex_uploaded_video ENABLE ROW LEVEL SECURITY;

-- Public SELECT · only visibility='public' AND published_at IS NOT NULL.
CREATE POLICY nex_uploaded_video_public_select
  ON public.nex_uploaded_video FOR SELECT
  TO anon, authenticated
  USING (
    visibility = 'public'
    AND published_at IS NOT NULL
  );

-- Owner SELECT · drafts + unlisted + public · all their own rows.
CREATE POLICY nex_uploaded_video_owner_select
  ON public.nex_uploaded_video FOR SELECT
  TO authenticated
  USING (
    owner_account_id IN (SELECT nex_current_account_ids())
  );

-- Owner INSERT · must set owner_account_id to self.
CREATE POLICY nex_uploaded_video_owner_insert
  ON public.nex_uploaded_video FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_account_id IN (SELECT nex_current_account_ids())
  );

-- Owner UPDATE · only their own rows · service-role bypasses by
-- design (used by any moderation / takedown path).
CREATE POLICY nex_uploaded_video_owner_update
  ON public.nex_uploaded_video FOR UPDATE
  TO authenticated
  USING (
    owner_account_id IN (SELECT nex_current_account_ids())
  )
  WITH CHECK (
    owner_account_id IN (SELECT nex_current_account_ids())
  );

-- No DELETE policy · hard-delete is service-role only. Owner UI uses
-- UPDATE visibility='removed' for soft-delete.

-- Marketing-boundary grants.
REVOKE ALL ON public.nex_uploaded_video FROM anon;
GRANT SELECT ON public.nex_uploaded_video TO anon;
GRANT SELECT, INSERT, UPDATE ON public.nex_uploaded_video TO authenticated;

-- Migration ledger.
INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '223',
  'nex_uploaded_video table · uploaded videos distinct from Live sessions · appears in feed as separate section',
  'Owner directive 2026-10-24. Required fields: title, storage_bucket+storage_object_path, mime_type, rights_declaration. Visibility state machine draft/public/unlisted/removed · published_at is set iff visible. Rights declaration enum owner_content/licensed/public_domain. Partial unique index for feed order. Public SELECT only on published+public. Owner SELECT on own rows (drafts included). No DELETE policy · service-role only · soft-delete via visibility=removed. Companion storage bucket nex-live-uploaded must be created in Supabase dashboard at apply time (SQL cannot create storage buckets). NEVER labelled as currently Live in UI. Marketing-boundary · do not join into Intelligence/Directory. NOT YET APPLIED to any database.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
