-- ============================================================================
-- NEX-native Migration 224 · nex_account.is_mock_persona flag
-- ============================================================================
--
-- STATUS: AUTHORED · APPLY VIA scripts/apply-migration-224.mjs.
--
-- Owner directive 2026-10-26 · seed 24 mock-persona accounts that
-- look identical to real users (chat, live, discoverability) but are
-- flagged in the DB so service code + admin tools can distinguish
-- them from real signups. The flag drives:
--   · the founder-POV impersonation route (Slice 3 · deferred).
--   · the divert-to-founder notification pipeline (Slice 3).
--   · any analytics / abuse metrics that must exclude seed data.
--
-- Scope · ONE additive column.
--
-- Rollback · ALTER TABLE nex_account DROP COLUMN IF EXISTS is_mock_persona;

BEGIN;

ALTER TABLE public.nex_account
  ADD COLUMN IF NOT EXISTS is_mock_persona boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.nex_account.is_mock_persona IS
  'True when the account is a seeded mock persona (presented to end
   users as a real account). Set by the seed script
   `scripts/mock-personas/seed-personas.mjs`. Drives founder-POV
   impersonation + divert routing in later slices. Default false ·
   real signups never set this.';

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '224',
  'nex_account.is_mock_persona flag',
  'Adds a boolean marker so seeded mock personas can be filtered from analytics + routed through the founder-POV impersonation pipeline (Slice 3). Additive · idempotent.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
