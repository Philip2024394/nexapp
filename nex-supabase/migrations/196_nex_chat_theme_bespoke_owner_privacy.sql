-- ============================================================================
-- NEX-native Migration 196 · nex_chat_theme · column-level privacy for bespoke_for_account_id
-- ============================================================================
--
-- Purpose:
--   Close the Stage-2 security-review privacy gap for bespoke themes
--   that are flipped to is_purchasable=true. The row-level policy added
--   by migration 191 hides bespoke+non-purchasable rows from non-owners,
--   but once a bespoke theme is made publicly purchasable the full row
--   becomes visible AND the row carries bespoke_for_account_id. This
--   migration removes that column from the public read surface so the
--   commissioning account identity is NEVER readable by anon or by any
--   non-owner authenticated client, regardless of is_purchasable.
--
-- Why column-level REVOKE alone (without first REVOKing table SELECT)
-- is insufficient:
--   PostgreSQL's documented semantics are that a role with table-level
--   SELECT has implicit SELECT on every column. A later column-level
--   REVOKE does NOT reduce the table-level grant. The documented
--   correct pattern is:
--       REVOKE SELECT ON <table> FROM <role>;
--       GRANT SELECT (col1, col2, …) ON <table> TO <role>;
--
--   Supabase's bootstrap grants anon + authenticated full CRUD on
--   public tables; RLS gates row visibility. The REVOKE below clears
--   the all-column grant on this specific table; the subsequent GRANT
--   re-adds SELECT only on the 22 non-sensitive columns.
--
-- Service-role is unaffected · service_role has superuser-equivalent
-- privilege on this schema and is the only client the existing app
-- code uses to read nex_chat_theme (verified across every call site
-- in src/ · all go through nexSupabaseAdmin).
--
-- Column enumeration source of truth:
--   The 22 names below are derived from the migration SQL itself (048
--   CREATE TABLE + 051 bubble_rim_hex + 051 composer_rim_hex + 056
--   wallpaper_config + 085 layout_style + 135 intro_video_url +
--   intro_duration_ms + intro_poster_url + 191 origin + is_purchasable
--   + catalogue_price_minor + catalogue_price_currency · 23 columns
--   minus bespoke_for_account_id = 22). TypeScript was used as a
--   cross-check only.
--
-- CRITICAL · UNVERIFIED AGAINST LIVE POSTGRES:
--   This file is written statically from the migration SQL. The
--   Supabase bootstrap grants are not visible in the repo; the actual
--   effective privileges on nex_chat_theme can only be confirmed by
--   running psql \dp nex_chat_theme after applying this migration
--   against the real database. Static review is NOT sufficient to
--   claim the REVOKE achieves the intended effect. An authorised
--   isolated-postgres test harness MUST exercise the following
--   assertions before this migration is applied to Supabase:
--     1. anon SELECT bespoke_for_account_id FROM nex_chat_theme → DENIED
--     2. authenticated SELECT bespoke_for_account_id FROM nex_chat_theme → DENIED
--     3. anon SELECT id, name, ... FROM nex_chat_theme → ALLOWED (RLS gates rows)
--     4. service_role SELECT bespoke_for_account_id FROM nex_chat_theme → ALLOWED
--     5. anon SELECT * FROM nex_chat_theme → DENIED (because * includes the sensitive col)
--
-- Future-column rule:
--   Any later `ALTER TABLE nex_chat_theme ADD COLUMN` migration MUST
--   include an explicit `GRANT SELECT (<new_col>) ON nex_chat_theme TO
--   anon, authenticated` for that column, OR explicitly document that
--   the new column is sensitive (like bespoke_for_account_id). A new
--   column without an explicit grant is invisible to public reads.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '196';
--     REVOKE SELECT (
--       id, name, tagline, accent_hex, bubble_rim_hex, composer_rim_hex,
--       tier, category, hero_image_url, is_active, sort_order,
--       wallpaper_config, layout_style,
--       intro_video_url, intro_duration_ms, intro_poster_url,
--       origin, is_purchasable, catalogue_price_minor, catalogue_price_currency,
--       created_at, updated_at
--     ) ON nex_chat_theme FROM anon, authenticated;
--     GRANT SELECT ON nex_chat_theme TO anon, authenticated;
--   COMMIT;
-- ============================================================================

BEGIN;

-- Prerequisites: migration 191 must be applied (adds bespoke_for_account_id).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'nex_chat_theme' AND column_name = 'bespoke_for_account_id'
  ) THEN
    RAISE EXCEPTION 'migration 196 requires migration 191 (nex_chat_theme.bespoke_for_account_id column) to be applied';
  END IF;
END $$;

-- Clear anon/authenticated's implicit all-column SELECT privilege. After
-- this REVOKE, any `SELECT *` from these roles fails until the GRANT
-- below re-adds specific columns.
REVOKE SELECT ON nex_chat_theme FROM anon;
REVOKE SELECT ON nex_chat_theme FROM authenticated;

-- Re-grant SELECT on every column EXCEPT bespoke_for_account_id.
-- Column list sourced from SQL migrations 048/051/056/085/135/191.
-- Keep this list sorted the same way the columns appear in the schema
-- so a drift between the two is easy to spot in diff view.
GRANT SELECT (
  id,
  name,
  tagline,
  accent_hex,
  bubble_rim_hex,
  composer_rim_hex,
  tier,
  category,
  hero_image_url,
  is_active,
  sort_order,
  wallpaper_config,
  layout_style,
  intro_video_url,
  intro_duration_ms,
  intro_poster_url,
  origin,
  is_purchasable,
  catalogue_price_minor,
  catalogue_price_currency,
  created_at,
  updated_at
) ON nex_chat_theme TO anon, authenticated;

-- Document the sensitive column so future reviewers understand WHY it
-- was omitted from the grant list.
COMMENT ON COLUMN nex_chat_theme.bespoke_for_account_id IS
  'Historical commissioning account for a bespoke theme. Visible ONLY to service_role (admin/webhook code). Column-level SELECT is deliberately NOT granted to anon or authenticated via migration 196 · exposing it would leak which account commissioned which bespoke theme, even for publicly-purchasable bespoke rows. Combined with migration 191''s row-level policy (bespoke+non-purchasable rows are entirely hidden from non-owners), this column is now protected across both scenarios: non-purchasable bespoke is row-hidden; purchasable bespoke is column-hidden. If an application component needs this field, it MUST run under service_role.';

-- Migration history.
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '196',
    'nex_chat_theme · column-level SELECT revocation for bespoke_for_account_id',
    'Closes the Stage-2 privacy gap for bespoke themes that are flipped to is_purchasable=true. Table-level SELECT is revoked from anon + authenticated and re-granted only on the 22 non-sensitive columns (sourced from migrations 048/051/056/085/135/191). Service-role is unaffected because it has independent full-privilege access. UNVERIFIED against live PostgreSQL in this review turn · an authorised isolated test harness MUST exercise anon/authenticated/service_role access-matrix assertions before this migration is applied to Supabase. Future ALTER TABLE ADD COLUMN on nex_chat_theme MUST grant the new column or document it as sensitive.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification (run against an authorised isolated database):
--   -- 1. The sensitive column is hidden from anon.
--   SET ROLE anon;
--   SELECT bespoke_for_account_id FROM nex_chat_theme LIMIT 1;
--     → expect: ERROR · permission denied for column bespoke_for_account_id
--
--   -- 2. The 22 public columns remain readable (RLS gates row visibility).
--   SELECT id, name, origin, is_purchasable FROM nex_chat_theme
--    WHERE origin <> 'bespoke' OR is_purchasable = true LIMIT 3;
--     → expect: rows returned
--
--   -- 3. SELECT * fails from anon because it attempts the sensitive column.
--   SELECT * FROM nex_chat_theme LIMIT 1;
--     → expect: ERROR · permission denied for column bespoke_for_account_id
--
--   RESET ROLE;
--
--   -- 4. Service-role has full access (independent of grant model).
--   SET ROLE service_role;
--   SELECT bespoke_for_account_id FROM nex_chat_theme WHERE origin = 'bespoke' LIMIT 1;
--     → expect: row returned
--   RESET ROLE;
--
--   -- 5. Policy ladder is intact (191's row-level filter still works).
--   SELECT polname, polqual::text FROM pg_policy
--    WHERE polrelid = 'nex_chat_theme'::regclass AND polname = 'nex_chat_theme_select';
--     → expect: the bespoke-privacy OR-chain from migration 191
--
--   -- 6. The 22 columns are correctly granted; the 1 sensitive column is not.
--   SELECT privilege_type, column_name
--     FROM information_schema.column_privileges
--    WHERE table_name = 'nex_chat_theme' AND grantee IN ('anon','authenticated')
--      AND privilege_type = 'SELECT'
--    ORDER BY grantee, column_name;
--     → expect: 44 rows (22 columns × 2 grantees) · bespoke_for_account_id NOT in list
--
--   SELECT * FROM nex_migration_history WHERE version = '196';
