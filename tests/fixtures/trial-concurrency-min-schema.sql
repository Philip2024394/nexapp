-- tests/fixtures/trial-concurrency-min-schema.sql
--
-- Minimum nex_account schema needed by the G1 concurrency integration tests.
-- NOT an authoritative schema · ONLY the columns T5a/T6a/T6b read or write
-- and the columns migration 214 depends on.
--
-- Rationale (CONCURRENCY-TEST-PLAN.md §3 Option A):
--   Migration 214 adds trial columns to nex_account and defines a trigger
--   that reads `themes_trial_used_at`. The test harness seeds accounts
--   with INSERT (id, display_name, tier) and runs updates that touch:
--     · business_trial_* columns (added by 214)
--     · themes_trial_used_at + themes_trial_package_id (089)
--   Nothing else is read or written. This fixture provides exactly those
--   columns · migration 214 is then applied verbatim.
--
-- The fixture does NOT replace or bypass the invariants being tested:
--   · All CHECK constraints come from migration 214 (unchanged)
--   · The trigger comes from migration 214 (unchanged)
--   · Row-level locking is a Postgres primitive, unaffected by other
--     columns on the row.
--
-- NOT for production use. Dedicated to disposable test databases only.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE nex_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  tier text NOT NULL DEFAULT 'gratis'
    CHECK (tier IN ('gratis','bisnis','pro')),
  bisnis_expires_at timestamptz,
  themes_trial_used_at timestamptz,
  themes_trial_package_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
