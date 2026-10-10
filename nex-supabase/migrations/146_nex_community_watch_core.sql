-- nex-supabase/migrations/146_nex_community_watch_core.sql
--
-- NEX Community Watch · Phase 1 MVP · founder-authorised 2026-10-11.
--
-- WHAT THIS DOES
--   Introduces the full data substrate for NEX Community Watch:
--     1. nex_community_zone           · hierarchical geographic zones
--                                        (country → province → city →
--                                         kecamatan → kelurahan → rw → rt
--                                         with extensibility for other
--                                         countries' admin units).
--     2. nex_community_membership     · one membership row per account
--                                        linking the account to its chosen
--                                        hyperlocal zone + its district
--                                        zone, plus notification pref.
--     3. nex_community_notice         · the actual notices (power/water
--                                        outage, road closure, weather
--                                        hazard, other infrastructure).
--     4. nex_community_notice_update  · append-only update history on
--                                        a notice.
--     5. nex_community_notice_confirmation · "me too" corroboration.
--     6. nex_community_notice_report  · dedicated moderation report
--                                        table (separate from nex_report
--                                        per sealed doctrine).
--     7. nex_community_rate_limit     · per-account per-action rolling
--                                        rate-limit counter.
--
-- WHY
--   Community Watch is place-based (NEX Chat is person-based, Vault is
--   private, Family Safety is a separate trust domain). The directive
--   is explicit that these trust domains do not share tables,
--   permissions, or notification rules. This migration therefore
--   introduces a self-contained namespace prefixed `nex_community_*`
--   with its own authorisation and lifecycle.
--
--   Phase 1 category list is intentionally narrow — physical
--   infrastructure hazards only. No "suspicious person", no "crime",
--   no photos, no DMs. Enforced at the CHECK constraint on
--   nex_community_notice.category.
--
-- INVARIANTS SEALED WITH THIS MIGRATION
--   · Zone hierarchy is a strict tree (parent_zone_id self-FK, no cycles
--     enforced at the application layer).
--   · One nex_community_membership per nex_account (unique(account_id)).
--   · Reports NEVER re-use nex_report (sealed 2026-09-28 for safe-trade
--     reports) — Community Watch has its own report table.
--   · Confirmations are 1-per-(notice, account) unique — no vote stacking.
--   · Notice categories are a closed set — adding "suspicious_person" or
--     "crime" requires a new migration + explicit founder authorisation
--     (see directive 2026-10-11).
--   · Author's exact address is NEVER stored on a notice. `affected_area_text`
--     is free-form by design but is the single surface for geographic
--     specificity — enforced by schema (not storing coordinates).
--   · Rate-limit windows are account+action+window-start — the service
--     layer trims the window.
--
-- NOT TOUCHED
--   · nex_account, nex_account_profile, nex_friend_edge
--   · nex_conversation, nex_message, nex_peer_message, nex_peer_conversation
--   · nex_vault_*
--   · nex_report (safe-trade reports — sealed, do not repurpose)
--   · nex_chat_theme, nex_theme_* (unrelated domain)

BEGIN;

-- Required extension for the fuzzy-name trigram index on zone.name.
-- No-op if already present. Supabase projects ship this but it must
-- be explicitly enabled.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ========================================================================
-- 1 · nex_community_zone · hierarchical geographic zones
-- ========================================================================

CREATE TABLE IF NOT EXISTS nex_community_zone (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_zone_id  uuid REFERENCES nex_community_zone(id) ON DELETE RESTRICT,

  -- ISO 3166-1 alpha-2 country code (ID, GB, US, ...). Required even at
  -- the country-level row (where country === the row itself).
  country         text NOT NULL,

  -- Admin level. 'country'/'province'/'city'/'kecamatan'/'kelurahan'/
  -- 'rw'/'rt' for Indonesia. Extended values ('ward','postcode',
  -- 'district','neighbourhood') allow other-country admin units without
  -- another migration. New values added only via explicit migration.
  level           text NOT NULL,

  -- Display name in the local language (UTF-8). <=120 chars.
  name            text NOT NULL,

  -- Lowercase URL-safe slug, scoped to parent_zone_id. e.g. "mantrijeron",
  -- "rt-05", "jalan-malioboro".
  slug            text NOT NULL,

  -- Country-specific extras (e.g. { "rw_number": "05", "rt_number": "01" }).
  -- jsonb · never queried for identity, only for display + import audit.
  extra           jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Soft-delete for admin corrections; app layer treats NULL as live.
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_zone_country_iso    CHECK (country ~ '^[A-Z]{2}$'),
  CONSTRAINT ck_zone_level_allowed  CHECK (level IN (
    'country','province','city','kecamatan','kelurahan','rw','rt',
    'ward','postcode','district','neighbourhood'
  )),
  CONSTRAINT ck_zone_name_nonblank  CHECK (length(trim(name)) > 0),
  CONSTRAINT ck_zone_slug_shape     CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$' OR slug ~ '^[a-z0-9]$')
);

-- Uniqueness: siblings cannot share a slug within the same parent.
-- Country-level rows have NULL parent → use (country, level, slug) alone.
CREATE UNIQUE INDEX IF NOT EXISTS uq_zone_parent_slug_root
  ON nex_community_zone (country, level, slug)
  WHERE parent_zone_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_zone_parent_slug
  ON nex_community_zone (parent_zone_id, slug)
  WHERE parent_zone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_zone_parent    ON nex_community_zone (parent_zone_id);
CREATE INDEX IF NOT EXISTS idx_zone_country   ON nex_community_zone (country, level);
CREATE INDEX IF NOT EXISTS idx_zone_name_trgm ON nex_community_zone USING gin (name gin_trgm_ops);


-- ========================================================================
-- 2 · nex_community_membership · one zone claim per account
-- ========================================================================

CREATE TABLE IF NOT EXISTS nex_community_membership (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id             uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,

  -- The user's chosen hyperlocal zone (RT, kelurahan, neighbourhood).
  hyperlocal_zone_id     uuid NOT NULL REFERENCES nex_community_zone(id) ON DELETE RESTRICT,

  -- The district the hyperlocal belongs to (kelurahan→kecamatan, or
  -- for v1 users who pick a kecamatan this may equal the kecamatan).
  -- Denormalised from the zone hierarchy for fast district-feed queries.
  district_zone_id       uuid NOT NULL REFERENCES nex_community_zone(id) ON DELETE RESTRICT,

  -- Explicit user confirmation timestamp. The directive requires
  -- "Suggest the local area; user explicitly confirms" — this column
  -- is the single source of truth that confirmation happened.
  confirmed_at           timestamptz NOT NULL DEFAULT now(),

  -- Notification preference. 'quiet' = no push at all. 'urgent_only' =
  -- weather hazards + confirmed outages. 'all' = every new notice.
  -- Default is 'urgent_only' per the sealed "quiet by default" rule.
  notification_preference text NOT NULL DEFAULT 'urgent_only',

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_membership_account        UNIQUE (account_id),
  CONSTRAINT ck_membership_notification   CHECK (notification_preference IN ('quiet','urgent_only','all'))
);

CREATE INDEX IF NOT EXISTS idx_membership_hyperlocal ON nex_community_membership (hyperlocal_zone_id);
CREATE INDEX IF NOT EXISTS idx_membership_district   ON nex_community_membership (district_zone_id);


-- ========================================================================
-- 3 · nex_community_notice · the authored notice
-- ========================================================================

CREATE TABLE IF NOT EXISTS nex_community_notice (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The hyperlocal zone the notice is primarily tagged to. Required.
  hyperlocal_zone_id        uuid NOT NULL REFERENCES nex_community_zone(id) ON DELETE RESTRICT,

  -- Denormalised district the hyperlocal belongs to. Required.
  -- Allows "show me everything in my kelurahan" without a recursive CTE.
  district_zone_id          uuid NOT NULL REFERENCES nex_community_zone(id) ON DELETE RESTRICT,

  -- Author account. CASCADE delete is intentional — if the user is
  -- deleted their notices disappear (future admin "keep anonymised"
  -- flow can set this to a tombstone account instead).
  author_account_id         uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,

  -- Phase 1 closed category set. Adding a value requires a new migration
  -- + founder authorisation per the directive.
  category                  text NOT NULL,

  -- Short title. <=120 chars. Required.
  title                     text NOT NULL,

  -- Longer body. <=2000 chars. Nullable (short notices can be
  -- title-only; e.g. "Mati listrik Blok C sejak pukul 14:00").
  body                      text,

  -- Current status.
  status                    text NOT NULL DEFAULT 'active',

  -- Free-form approximate area string. e.g. "RW 05, Jalan Malioboro".
  -- Author-supplied, moderated at the content layer. The schema never
  -- stores precise coordinates — this is the single geographic surface
  -- within a notice (beyond the zone FK).
  affected_area_text        text,

  -- When the described event started (author-reported).
  started_at                timestamptz NOT NULL DEFAULT now(),

  -- Optional expiry — the app will mark the notice 'expired' when
  -- now() > expires_at. Default 24h set by application, not SQL default,
  -- so admin can override.
  expires_at                timestamptz,

  -- Resolution lifecycle timestamps.
  resolved_at               timestamptz,
  resolved_by_account_id    uuid REFERENCES nex_account(id) ON DELETE SET NULL,
  resolution_note           text,

  -- Moderation removal lifecycle.
  removed_at                timestamptz,
  removed_by_account_id     uuid REFERENCES nex_account(id) ON DELETE SET NULL,
  removal_reason            text,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_notice_category CHECK (category IN (
    'power_outage','water_outage','road_closure','weather_hazard','other_hazard'
  )),
  CONSTRAINT ck_notice_status   CHECK (status IN (
    'active','resolved','expired','removed'
  )),
  CONSTRAINT ck_notice_title_len   CHECK (length(title)  BETWEEN 1 AND 120),
  CONSTRAINT ck_notice_body_len    CHECK (body IS NULL OR length(body) <= 2000),
  CONSTRAINT ck_notice_area_len    CHECK (affected_area_text IS NULL OR length(affected_area_text) <= 200),
  CONSTRAINT ck_notice_resolution_consistency CHECK (
    (status = 'resolved' AND resolved_at IS NOT NULL) OR
    (status <> 'resolved' AND resolved_at IS NULL)
  ),
  CONSTRAINT ck_notice_removal_consistency CHECK (
    (status = 'removed' AND removed_at IS NOT NULL) OR
    (status <> 'removed' AND removed_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_notice_hyperlocal_recent
  ON nex_community_notice (hyperlocal_zone_id, created_at DESC)
  WHERE status IN ('active','resolved');

CREATE INDEX IF NOT EXISTS idx_notice_district_recent
  ON nex_community_notice (district_zone_id, created_at DESC)
  WHERE status IN ('active','resolved');

CREATE INDEX IF NOT EXISTS idx_notice_author
  ON nex_community_notice (author_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notice_expires_active
  ON nex_community_notice (expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;


-- ========================================================================
-- 4 · nex_community_notice_update · append-only update history
-- ========================================================================

CREATE TABLE IF NOT EXISTS nex_community_notice_update (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id          uuid NOT NULL REFERENCES nex_community_notice(id) ON DELETE CASCADE,
  author_account_id  uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  update_text        text NOT NULL,
  -- Optional status transition captured on this update row. The notice
  -- row itself is the source of truth for the current status; this
  -- column is a HISTORY entry — never read for the "current" status.
  status_change      text,
  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_update_text_len     CHECK (length(update_text) BETWEEN 1 AND 1000),
  CONSTRAINT ck_update_status_value CHECK (status_change IS NULL OR status_change IN ('active','resolved'))
);

CREATE INDEX IF NOT EXISTS idx_update_notice_recent
  ON nex_community_notice_update (notice_id, created_at DESC);


-- ========================================================================
-- 5 · nex_community_notice_confirmation · "me too" corroboration
-- ========================================================================

CREATE TABLE IF NOT EXISTS nex_community_notice_confirmation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id     uuid NOT NULL REFERENCES nex_community_notice(id) ON DELETE CASCADE,
  account_id    uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  confirmed_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_confirmation_notice_account UNIQUE (notice_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_confirmation_notice ON nex_community_notice_confirmation (notice_id);


-- ========================================================================
-- 6 · nex_community_notice_report · moderation report (dedicated)
--
-- Per sealed doctrine 2026-09-28, nex_report is reserved for safe-trade
-- reports and must not be repurposed. Community Watch reports therefore
-- live in their own table with their own status machine.
-- ========================================================================

CREATE TABLE IF NOT EXISTS nex_community_notice_report (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id               uuid NOT NULL REFERENCES nex_community_notice(id) ON DELETE CASCADE,
  reporter_account_id     uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  reason                  text NOT NULL,
  note                    text,
  -- Snapshot of the notice at report time (per sealed report doctrine).
  -- jsonb · typically { title, body, category, affected_area_text, author_account_id, created_at }.
  notice_snapshot         jsonb NOT NULL,
  -- Status machine: pending → under_review → (action_taken | dismissed) → appealed? → final.
  status                  text NOT NULL DEFAULT 'pending',
  appeal_text             text,
  appealed_at             timestamptz,
  reviewed_by_account_id  uuid REFERENCES nex_account(id) ON DELETE SET NULL,
  reviewed_at             timestamptz,
  resolution_note         text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_report_reason CHECK (reason IN (
    'spam','harassment','doxxing','misinformation','off_topic','illegal_claim','other'
  )),
  CONSTRAINT ck_report_status CHECK (status IN (
    'pending','under_review','action_taken','dismissed','appealed','appeal_dismissed','appeal_upheld'
  )),
  CONSTRAINT ck_report_not_self_report
    CHECK (reporter_account_id <> COALESCE((notice_snapshot ->> 'author_account_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid))
);

CREATE INDEX IF NOT EXISTS idx_report_pending_recent
  ON nex_community_notice_report (status, created_at DESC)
  WHERE status IN ('pending','under_review','appealed');


-- ========================================================================
-- 7 · nex_community_rate_limit · per-account rolling window counter
-- ========================================================================

CREATE TABLE IF NOT EXISTS nex_community_rate_limit (
  account_id          uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  action              text NOT NULL,
  -- Rounded-down window start, e.g. floor(now, '1 hour'). The service
  -- layer picks the window size per action (default 1h).
  window_started_at   timestamptz NOT NULL,
  count               integer NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (account_id, action, window_started_at),
  CONSTRAINT ck_rl_action CHECK (action IN (
    'notice_create','notice_update','notice_confirm','notice_resolve','notice_report'
  )),
  CONSTRAINT ck_rl_count  CHECK (count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_rl_window
  ON nex_community_rate_limit (account_id, action, window_started_at DESC);


COMMIT;
