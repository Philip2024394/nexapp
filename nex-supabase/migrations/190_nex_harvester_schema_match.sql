-- 190_nex_harvester_schema_match.sql
--
-- Align nex.business_canonical and nex.aof_cycle with the shape the
-- nexapp OSM harvester (introduced 2026-10-13 in commit 1ea87ec) writes
-- against. Two safe additive changes · zero destructive effects:
--
--   1. nex.business_canonical.metadata jsonb NOT NULL DEFAULT '{}'::jsonb
--      Lets the harvester stamp each DISCOVERED row with the cycle_id
--      that produced it (metadata->>'cycle_id'). ADD COLUMN with a
--      constant DEFAULT is instant on PostgreSQL 11+ (no row rewrite).
--      The 40,738 pre-existing canonical rows get '{}'::jsonb.
--
--   2. nex.aof_cycle.cycle_seq SET DEFAULT nextval('nex.aof_cycle_seq_seq')
--      The sequence nex.aof_cycle_seq_seq already exists in production
--      but was never wired as the column default. Prior writers passed
--      cycle_seq explicitly. The harvester's recordCycle() doesn't,
--      which is why every tick's aof_cycle insert currently fails
--      with SQLSTATE 23502 (null value in column "cycle_seq"). Setting
--      the default lets inserters omit the column.
--
-- Both changes are reversible:
--   ALTER TABLE nex.business_canonical DROP COLUMN IF EXISTS metadata;
--   ALTER TABLE nex.aof_cycle ALTER COLUMN cycle_seq DROP DEFAULT;
--
-- Idempotent via IF NOT EXISTS / IF EXISTS guards. Safe to re-run.

BEGIN;

-- ─── 1. metadata column on business_canonical ──────────────────────
ALTER TABLE nex.business_canonical
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Document the column so operators understand its role. The comment
-- is additive and doesn't block existing readers.
COMMENT ON COLUMN nex.business_canonical.metadata IS
  'Harvester-side bookkeeping · stamped with cycle_id and source origin by nexapp OSM harvester tick route. Not consumer-facing.';

-- ─── 2. aof_cycle.cycle_seq default via existing sequence ──────────
-- First make sure the sequence is OWNED BY the column so that if the
-- column is dropped, the sequence is dropped too (good hygiene).
-- OWNED BY is idempotent · running twice has no effect.
ALTER SEQUENCE IF EXISTS nex.aof_cycle_seq_seq
  OWNED BY nex.aof_cycle.cycle_seq;

-- Now wire the default. If the sequence doesn't exist on this
-- environment (e.g. a very fresh local DB), the ALTER TABLE will fail
-- loudly · we WANT that failure in dev, not a silent miss.
ALTER TABLE nex.aof_cycle
  ALTER COLUMN cycle_seq SET DEFAULT nextval('nex.aof_cycle_seq_seq');

-- ─── 3. Migration history ─────────────────────────────────────────
INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '190',
  now(),
  'Align business_canonical.metadata + aof_cycle.cycle_seq default with nexapp harvester writer. See 190_nex_harvester_schema_match.sql.',
  'Added by nexapp harvester fix 2026-10-13.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
