-- nex-supabase/migrations/148_nex_community_phase2a_card_primitives.sql
--
-- NEX Community Noticeboard · Phase 2A · super-card primitives.
-- Founder-authorised 2026-10-11.
--
-- WHAT THIS DOES
--   1. Adds `urgency_level` column to nex_community_notice (safety v2).
--   2. Creates `nex_community_card` super-table with a `kind`
--      discriminator for all card kinds other than safety. Safety
--      stays in nex_community_notice (Phase 1 schema untouched) to
--      preserve the live-verified fcc06e8 data path.
--   3. Creates `nex_community_card_update`, `nex_community_card_confirmation`,
--      `nex_community_card_report` — shared primitives for lost_found
--      + future kinds. Shape mirrors Phase 1 notice-update/confirmation/
--      report so service-layer logic can be lifted.
--
-- WHY
--   Phase 2A introduces Lost & Found as the first new card kind. The
--   super-table lets us ship 2B (events), 2C (voice), 2D (local help),
--   2E (life news) by adding ONE detail table per phase — no feed
--   rewrite required. Safety stays in its purpose-built table because:
--     (a) The Phase 1 end-to-end verification (23/23) depends on it.
--     (b) Safety has schema specifics (lifecycle_log, resolution_note)
--         that would complicate the super-table.
--   Feed queries in the services layer UNION ALL safety + super-table
--   kinds so visitors see one unified timeline.
--
-- INVARIANTS SEALED WITH THIS MIGRATION
--   · `kind` is a closed enum. Adding 'event' / 'voice' / 'local_help'
--     / 'life_news' requires a new migration (one per phase).
--   · The super-table never contains kind='safety'. Safety stays in
--     nex_community_notice forever (or until a future unification
--     migration explicitly moves it).
--   · nex_community_card_photo (added in 150) is super-table-scoped;
--     safety is explicitly photo-free (sealed Phase 1 doctrine).
--
-- NOT TOUCHED
--   · nex_community_notice (safety data path)
--   · nex_community_notice_update / confirmation / report (Phase 1 tables)
--   · nex_community_membership (gets per-section decomposition in 149)
--   · nex_community_zone, _rate_limit, _notice_report (unchanged)

BEGIN;

-- 1 · Add urgency_level to Phase 1 safety notices (non-destructive).
--   Default 'moderate' so backfill is safe. All existing rows become
--   'moderate'; authors can revise via /nex-native/community/compose.
ALTER TABLE nex_community_notice
  ADD COLUMN IF NOT EXISTS urgency_level text NOT NULL DEFAULT 'moderate';
ALTER TABLE nex_community_notice
  ADD CONSTRAINT ck_notice_urgency_level
  CHECK (urgency_level IN ('low','moderate','urgent'));

-- Index to list urgent-only quickly for notification pref filtering.
CREATE INDEX IF NOT EXISTS idx_notice_urgent_active
  ON nex_community_notice (hyperlocal_zone_id, created_at DESC)
  WHERE urgency_level = 'urgent' AND status = 'active';


-- 2 · nex_community_card · super-table (discriminator = kind)
CREATE TABLE IF NOT EXISTS nex_community_card (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Closed enum of non-safety kinds. 'safety' NEVER appears here.
  kind                    text NOT NULL,

  hyperlocal_zone_id      uuid NOT NULL REFERENCES nex_community_zone(id) ON DELETE RESTRICT,
  district_zone_id        uuid NOT NULL REFERENCES nex_community_zone(id) ON DELETE RESTRICT,
  author_account_id       uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,

  title                   text NOT NULL,
  body                    text,
  status                  text NOT NULL DEFAULT 'active',
  expires_at              timestamptz,

  resolved_at             timestamptz,
  resolved_by_account_id  uuid REFERENCES nex_account(id) ON DELETE SET NULL,
  resolution_note         text,

  removed_at              timestamptz,
  removed_by_account_id   uuid REFERENCES nex_account(id) ON DELETE SET NULL,
  removal_reason          text,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_card_kind CHECK (kind IN (
    'lost_found','event','voice','local_help','life_news'
  )),
  CONSTRAINT ck_card_status CHECK (status IN (
    'active','resolved','expired','removed'
  )),
  CONSTRAINT ck_card_title_len CHECK (length(title) BETWEEN 1 AND 120),
  CONSTRAINT ck_card_body_len  CHECK (body IS NULL OR length(body) <= 2000),
  CONSTRAINT ck_card_resolution_consistency CHECK (
    (status = 'resolved' AND resolved_at IS NOT NULL) OR
    (status <> 'resolved' AND resolved_at IS NULL)
  ),
  CONSTRAINT ck_card_removal_consistency CHECK (
    (status = 'removed' AND removed_at IS NOT NULL) OR
    (status <> 'removed' AND removed_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_card_hyperlocal_recent
  ON nex_community_card (hyperlocal_zone_id, created_at DESC)
  WHERE status IN ('active','resolved');

CREATE INDEX IF NOT EXISTS idx_card_district_recent
  ON nex_community_card (district_zone_id, created_at DESC)
  WHERE status IN ('active','resolved');

CREATE INDEX IF NOT EXISTS idx_card_kind_zone_recent
  ON nex_community_card (kind, hyperlocal_zone_id, created_at DESC)
  WHERE status IN ('active','resolved');

CREATE INDEX IF NOT EXISTS idx_card_author_recent
  ON nex_community_card (author_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_card_expires_active
  ON nex_community_card (expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;


-- 3 · nex_community_card_update · append-only history for super-table cards
CREATE TABLE IF NOT EXISTS nex_community_card_update (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id            uuid NOT NULL REFERENCES nex_community_card(id) ON DELETE CASCADE,
  author_account_id  uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  update_text        text NOT NULL,
  status_change      text,
  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_card_update_text_len     CHECK (length(update_text) BETWEEN 1 AND 1000),
  CONSTRAINT ck_card_update_status_value CHECK (status_change IS NULL OR status_change IN ('active','resolved'))
);
CREATE INDEX IF NOT EXISTS idx_card_update_recent
  ON nex_community_card_update (card_id, created_at DESC);


-- 4 · nex_community_card_confirmation · corroboration
CREATE TABLE IF NOT EXISTS nex_community_card_confirmation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       uuid NOT NULL REFERENCES nex_community_card(id) ON DELETE CASCADE,
  account_id    uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  confirmed_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_card_confirmation_card_account UNIQUE (card_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_card_confirmation_card
  ON nex_community_card_confirmation (card_id);


-- 5 · nex_community_card_report · moderation (snapshot-at-report-time)
CREATE TABLE IF NOT EXISTS nex_community_card_report (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id                 uuid NOT NULL REFERENCES nex_community_card(id) ON DELETE CASCADE,
  reporter_account_id     uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  reason                  text NOT NULL,
  note                    text,
  card_snapshot           jsonb NOT NULL,
  status                  text NOT NULL DEFAULT 'pending',
  appeal_text             text,
  appealed_at             timestamptz,
  reviewed_by_account_id  uuid REFERENCES nex_account(id) ON DELETE SET NULL,
  reviewed_at             timestamptz,
  resolution_note         text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_card_report_reason CHECK (reason IN (
    'spam','harassment','doxxing','misinformation','off_topic','illegal_claim','other'
  )),
  CONSTRAINT ck_card_report_status CHECK (status IN (
    'pending','under_review','action_taken','dismissed','appealed','appeal_dismissed','appeal_upheld'
  ))
);
CREATE INDEX IF NOT EXISTS idx_card_report_pending_recent
  ON nex_community_card_report (status, created_at DESC)
  WHERE status IN ('pending','under_review','appealed');


COMMIT;
