-- Migration 338 · nex_account.themes_plus_until · Themes Plus access column
-- Owner-authorised 2026-11-11 for drafting only · NOT YET AUTHORISED TO APPLY.
-- -----------------------------------------------------------------------------
-- Purpose · give the application a server-side flag for "this account has
-- an active NEX Themes Plus subscription" that is SEPARATE from the Shop
-- subscription (nex_account.bisnis_expires_at / subscription_plan).
--
-- This is the minimum column needed to enforce the owner's sealed
-- commercial separation:
--   · Shop subscription unlocks Shop customisation only.
--   · Themes Plus unlocks premium Chat themes only.
--   · Neither subscription grants the other's benefits.
--
-- Shape · NULL = no Themes Plus access; timestamp > now() = active
-- access; timestamp <= now() = lapsed (fall back to free themes).
--
-- Scope-restricted:
--   · Adds ONE nullable column to nex_account.
--   · No change to any existing row (all rows start NULL = no access,
--     matching current state where no Themes Plus subscriptions exist).
--   · No change to any existing writer path.
--   · No change to RLS policies.
--
-- Downstream consumer:
--   · src/lib/nex-native/library/entitlement-service.ts
--     canAccessChatTheme(theme, account) reads this column when gating
--     premium themes.
--
-- NOT YET APPLIED to sandbox. Requires separate explicit owner
-- authorisation naming the sandbox ref kdstoyyeygcopkogqsyv before
-- apply. Production project ijvqdvsvwtwxzcqmoqit remains sealed.

BEGIN;

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS themes_plus_until timestamptz;

COMMENT ON COLUMN nex_account.themes_plus_until IS
  'NEX Themes Plus subscription active-until timestamp (owner-sealed '
  '2026-11-11). NULL = no access. timestamp > now() = active. '
  'Separate from nex_account.bisnis_expires_at (shop subscription) '
  'and nex_account.subscription_plan. Themes Plus does NOT unlock '
  'shop; shop subscription does NOT unlock themes.';

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '338',
  'nex_account.themes_plus_until · Themes Plus entitlement column',
  'Owner directive 2026-11-11 Themes Plus commercial separation. '
  'One nullable timestamptz column on nex_account · no backfill · '
  'no change to existing rows. Consumed by '
  'canAccessChatTheme(theme, account) in src/lib/nex-native/library/'
  'entitlement-service.ts to enforce separation from shop tier.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
