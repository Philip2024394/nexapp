-- nex-supabase/migrations/153_nex_theme_view_counter.sql
--
-- NEX Theme view counter · Step 1G (2026-10-11).
-- ----------------------------------------------
-- Replaces the hand-picked POPULAR_THEME_IDS list on the Theme
-- Library landing with real view-driven ranking. The counter table
-- is keyed by the TEXT theme_id (not a FK) so it holds both:
--
--   · live-world ids (code-registered packages · ocean/food/etc)
--   · DB-registered theme ids (nex_chat_theme rows)
--
-- without the FK direction confusion that would otherwise appear.
--
-- Shape:
--   theme_id         · text PK · the public theme id as used by
--                       /nex-native/themes/<id> and the Library
--                       grid.
--   view_count       · bigint · monotonically-increasing total
--                       views. Live rank is `ORDER BY view_count
--                       DESC`.
--   last_viewed_at   · timestamptz · informational · surfaces how
--                       recent the activity is in future ranking
--                       functions (not used by the first ranker).
--
-- The counter is incremented via UPSERT on every /themes/<id> page
-- load. The call is fire-and-forget on the server; failure to
-- increment is non-fatal (page still renders). No user-identifying
-- information is stored · the counter is aggregate only.
--
-- RLS: service-role only. Clients never read / write directly ·
-- the server reads via nexSupabaseAdmin.

BEGIN;

CREATE TABLE IF NOT EXISTS nex_theme_view_counter (
  theme_id         text PRIMARY KEY,
  view_count       bigint NOT NULL DEFAULT 0,
  last_viewed_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT nex_theme_view_counter_count_nonneg CHECK (view_count >= 0),
  CONSTRAINT nex_theme_view_counter_id_shape CHECK (
    theme_id ~ '^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$'
  )
);

CREATE INDEX IF NOT EXISTS idx_nex_theme_view_counter_view_count_desc
  ON nex_theme_view_counter (view_count DESC);

ALTER TABLE nex_theme_view_counter ENABLE ROW LEVEL SECURITY;

-- No PUBLIC policy · service-role bypasses RLS. If a future
-- requirement surfaces view counts to clients, add an explicit
-- read-only policy here.

COMMENT ON TABLE nex_theme_view_counter IS
  'Aggregate theme view counter. Keyed by text theme_id so both live-world and DB-registered themes share one ranking surface. No user data stored.';
COMMENT ON COLUMN nex_theme_view_counter.theme_id IS
  'Public theme id (as used by /nex-native/themes/<id>). Format matches live-world package ids and nex_chat_theme.id · lowercase + hyphen only.';
COMMENT ON COLUMN nex_theme_view_counter.view_count IS
  'Total view count. Incremented via UPSERT on every /themes/<id> load.';

COMMIT;
