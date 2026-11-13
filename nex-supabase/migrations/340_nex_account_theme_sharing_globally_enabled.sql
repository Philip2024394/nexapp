-- 340_nex_account_theme_sharing_globally_enabled.sql
-- -----------------------------------------------------------------------------
-- NEX Chat Settings · global "Show my theme to contacts" toggle.
-- Owner-authorised 2026-11-12 for drafting only · NOT YET AUTHORISED TO APPLY.
-- -----------------------------------------------------------------------------
-- Purpose · give the viewer a single top-level ON/OFF switch that
-- overrides their per-contact theme-sharing preferences without
-- deleting them.
--
-- Semantics (owner-sealed 2026-11-12 Chat Settings Control Centre doc):
--   · TRUE (default)  ·  per-contact a_shares_theme / b_shares_theme
--                        decide visibility as today. (preserves current
--                        behaviour for every existing account.)
--   · FALSE           ·  nobody sees the viewer's shared theme — the
--                        standard emerald NEX theme renders for all
--                        contacts regardless of their per-contact row.
--                        Per-contact rows are NOT deleted so flipping
--                        back to TRUE restores the previous intent
--                        exactly.
--
-- Effective visibility formula consumed by
-- `isThemeMutuallyVisibleSafe(viewer, other)`:
--
--   can_viewer_see_others_theme =
--     other.theme_sharing_globally_enabled         -- OWNER gate only
--     AND (
--       prefs_row_absent                           -- grandfather
--       OR (actor_toggle(viewer → other)           -- mutual-consent
--           AND actor_toggle(other → viewer))      -- (sealed 2026-10-16)
--     )
--
-- CLARIFICATION 2026-11-12 (owner follow-up): the global flag is a
-- ONE-WAY gate on the OWNER'S side. A viewer who has turned their own
-- sharing OFF is saying "don't show my theme to anyone" — they are
-- NOT giving up the ability to see other people's themes. So only the
-- OWNER'S flag (`other.theme_sharing_globally_enabled` when rendering
-- the other party's theme to the viewer) participates in the gate.
--
-- The reciprocal per-contact AND (both parties' per-contact toggles
-- must be ON) is a SEPARATE mutual-consent rule sealed 2026-10-16 and
-- is preserved exactly — it protects both sides from one-sided theme
-- visibility; it is not the same concept as the global flag.
--
-- The viewer's OWN chat appearance is unaffected by any flag · this
-- column only gates what OTHER PEOPLE see of the viewer's theme.
--
-- Scope-restricted:
--   · Adds ONE non-null boolean column (default TRUE) to nex_account.
--   · No existing row is semantically changed: TRUE = today's
--     behaviour for everyone.
--   · No change to `nex_account_relationship_prefs` rows.
--   · No RLS policy change · the column is readable + updatable under
--     the same policies that already gate nex_account read/update.
--   · No indexes · query always reads this alongside the account row
--     by primary key.
--
-- Rollback compatibility:
--   · Dropping the column restores the pre-migration state exactly ·
--     consumers degrade to the per-contact-only visibility they had
--     before this column existed.
--   · See 340_nex_account_theme_sharing_globally_enabled_rollback.sql.
--
-- Downstream consumers (must ship with the apply, or sandbox stays
-- consistent because the service degrades on missing column):
--   · src/lib/nex-native/theme-sharing-service.ts (new) ·
--     getGlobalThemeSharingEnabled + setGlobalThemeSharingEnabled.
--   · src/lib/nex-native/relationship-service.ts ·
--     isThemeMutuallyVisibleSafe extended to AND both parties' globals.
--
-- NOT YET APPLIED to sandbox or production. Requires separate explicit
-- owner authorisation naming sandbox ref kdstoyyeygcopkogqsyv before
-- apply. Production project ijvqdvsvwtwxzcqmoqit remains sealed.

BEGIN;

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS theme_sharing_globally_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN nex_account.theme_sharing_globally_enabled IS
  'Owner-sealed 2026-11-12 · global master switch for "Show my theme to '
  'contacts". TRUE (default) = per-contact prefs decide visibility. '
  'FALSE = nobody sees the viewer''s shared theme regardless of per-contact '
  'row. ANDed with nex_account_relationship_prefs.a_shares_theme / '
  'b_shares_theme in isThemeMutuallyVisibleSafe. The viewer''s own chat '
  'appearance is unaffected · this flag only gates what other people see.';

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '340',
  'nex_account.theme_sharing_globally_enabled · global show-my-theme switch',
  'Owner directive 2026-11-12 Chat Settings Control Centre. One '
  'non-null boolean column default TRUE on nex_account · no backfill '
  'needed · default preserves today''s behaviour for every account. '
  'Consumed by theme-sharing-service and relationship-service'
  '.isThemeMutuallyVisibleSafe.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
