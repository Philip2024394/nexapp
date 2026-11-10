-- Migration 327 · nex_ciphertext_orphan_scan · D5 · 2026-11-10
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY · SANDBOX ONLY
-- =========================================================================
--
-- Owner-sealed 2026-11-10 (chat-decisions-locked-2026-11-10.md D5):
--   · Daily cron sweeps for orphan ciphertext storage objects in the
--     nex-peer-chat-ciphertext bucket (mig 295) that are not referenced
--     by any live nex_peer_message row, with a 48-hour grace window
--     before an orphan is hard-deleted.
--   · This table backs the sweep's RESUME cursor so the job is
--     idempotent across restarts and can be paginated.
--
-- Table shape:
--   · One scan row per cron invocation · keyed by id (uuid).
--   · last_cursor records the storage key (storage_path) the sweep
--     stopped at · the next run starts at WHERE storage_path > last_cursor.
--   · scanned_count / deleted_count / orphan_count report throughput.
--   · started_at / completed_at bound the window · NULL completed_at
--     means the run is in-flight or crashed · the next run detects it
--     and takes over.
--   · service_role is the ONLY writer · RLS blocks anon + authenticated.
--
-- I-1 compliance · stores storage_path (opaque) · never ciphertext or keys.
-- Depends on: mig 295 · sweep caller code (/api/nex-native/cron/orphan-sweep)
-- is NOT authorised by this document.
--
-- Apply target: SANDBOX ONLY (kdstoyyeygcopkogqsyv) · production
-- (ijvqdvsvwtwxzcqmoqit) stays sealed.

BEGIN;

CREATE TABLE IF NOT EXISTS nex_ciphertext_orphan_scan (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz NULL,
  last_cursor     text        NULL,
  scanned_count   bigint      NOT NULL DEFAULT 0,
  orphan_count    bigint      NOT NULL DEFAULT 0,
  deleted_count   bigint      NOT NULL DEFAULT 0,
  notes           text        NULL
);

COMMENT ON TABLE nex_ciphertext_orphan_scan IS
  'D5 · sealed 2026-11-10. Marker table for the daily nex-peer-chat-ciphertext orphan sweep. last_cursor = resume key · completed_at NULL = run in flight. Service-role write only · anon + authenticated denied.';

COMMENT ON COLUMN nex_ciphertext_orphan_scan.last_cursor IS
  'Storage key (storage_path) the sweep stopped at · next run starts at WHERE storage_path > last_cursor. Opaque ciphertext-bucket pointer · never plaintext.';

CREATE INDEX IF NOT EXISTS nex_ciphertext_orphan_scan_started_idx
  ON nex_ciphertext_orphan_scan (started_at DESC);

-- RLS · service_role bypasses by default. We explicitly block anon +
-- authenticated so a mistaken grant upstream cannot expose the cursor.
ALTER TABLE nex_ciphertext_orphan_scan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_ciphertext_orphan_scan_anon_deny
  ON nex_ciphertext_orphan_scan;
CREATE POLICY nex_ciphertext_orphan_scan_anon_deny
  ON nex_ciphertext_orphan_scan
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS nex_ciphertext_orphan_scan_authenticated_deny
  ON nex_ciphertext_orphan_scan;
CREATE POLICY nex_ciphertext_orphan_scan_authenticated_deny
  ON nex_ciphertext_orphan_scan
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '327',
    'D5 · nex_ciphertext_orphan_scan marker table + RLS (service-role only)',
    'Sealed 2026-11-10. Resume cursor for daily nex-peer-chat-ciphertext orphan sweep · 48h grace enforced in caller · not at DB level. Anon + authenticated restricted.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '327';
--     DROP POLICY IF EXISTS nex_ciphertext_orphan_scan_authenticated_deny ON nex_ciphertext_orphan_scan;
--     DROP POLICY IF EXISTS nex_ciphertext_orphan_scan_anon_deny ON nex_ciphertext_orphan_scan;
--     DROP INDEX IF EXISTS nex_ciphertext_orphan_scan_started_idx;
--     DROP TABLE IF EXISTS nex_ciphertext_orphan_scan;
--   COMMIT;
--
--   Rollback consequence: resume cursor is lost · next sweep (if the
--   caller code is still active) will fail to persist state · caller
--   should be stopped before rollback. No private content exposed · I-5
--   satisfied.
