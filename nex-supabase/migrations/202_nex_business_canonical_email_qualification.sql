-- Migration 202 · nex.business_canonical · email qualification columns
-- · 2026-10-16
-- --------------------------------------------------------------------------
-- STATUS: AUTHORED · NOT YET APPLIED. Owner authorisation covers
-- preparation and content review only. A separate explicit application
-- authorisation is required before this migration touches any database.
--
-- Adds six columns to nex.business_canonical to support the owner-
-- directed harvester-email qualification pipeline (sealed 2026-10-16):
--
--   email                      : text · the current best-known public
--                                business email · nullable · lightweight
--                                format CHECK · never derived from name
--   email_source_url           : text · the public URL where the email
--                                was observed · OSM feature URL for
--                                tag-sourced emails, or the walked page
--                                URL for website-walked ones · nullable
--   email_verified_at          : timestamptz · when the current email
--                                was last re-checked (freshness · not
--                                deliverability verification) · nullable
--   email_status               : text · one of 'FOUND' / 'VALIDATED' /
--                                'INVALID' / 'NOT_FOUND' · nullable
--                                (never-attempted = NULL)
--   qualification_status       : text · one of 'PENDING' / 'QUALIFIED'
--                                / 'UNQUALIFIED' / 'DISQUALIFIED' ·
--                                NOT NULL DEFAULT 'PENDING'
--   email_last_attempted_at    : timestamptz · set by the backfill
--                                orchestrator every time it walks a
--                                business page looking for an email ·
--                                drives the resumable backfill cursor
--
-- CHECK constraints enforce the enumerated vocabularies. The email
-- format CHECK is intentionally LIGHTWEIGHT (`<local>@<domain>.<tld>`)
-- so a syntactically-valid-but-undeliverable address can still be
-- stored with `email_status = 'INVALID'`. Real-world deliverability
-- verification happens later and updates `email_status` + possibly
-- clears `email` if confirmed-bad.
--
-- Partial index on `qualification_status` powers the HQ dashboard
-- "pending vs qualified" split without scanning the full table.
--
-- Separate partial index on `email_last_attempted_at NULLS FIRST`
-- (where qualification_status = 'PENDING') is the sealed cursor the
-- resumable backfill driver uses to resume at the oldest-attempted
-- (or never-attempted) row on every tick.
--
-- Doctrine (owner-approved 2026-10-16 · REVISED same day to decouple
-- FOUND from QUALIFIED):
--   · Discovery vs qualification are SEPARATE axes. `email_status`
--     records what was observed; `qualification_status` records
--     whether the business meets the NEX HQ qualification rule. An
--     email-shaped string in a source does NOT auto-qualify a business.
--   · State machine (sealed · enforced in the orchestrator UPDATE at
--     src/lib/nex-native/harvest/email-backfill-orchestrator.ts):
--
--       email_status='VALIDATED' → qualification_status='QUALIFIED'
--       email_status='FOUND'     → qualification_status='PENDING'
--       email_status='NOT_FOUND' → qualification_status='UNQUALIFIED'
--       email_status='INVALID'   → qualification_status='UNQUALIFIED'
--
--     PRESERVATION guards (short-circuit the transitions above):
--       qualification_status='DISQUALIFIED' is an admin lock · never
--         overwritten by the backfill.
--       qualification_status='QUALIFIED' is never downgraded by a
--         re-walk observing only FOUND or NOT_FOUND · user verification
--         survives transient fetch failures.
--
--   · Fail-closed · a missing email keeps the row at PENDING on
--     insert; it moves to UNQUALIFIED only after the walker explicitly
--     reports NOT_FOUND. Pre-existing rows (DEFAULT 'PENDING' on apply)
--     correctly stay PENDING until the backfill produces evidence.
--   · Never fabricate · the six-method extractor at
--     src/lib/nex/discovery-world/email-extractor.ts is authoritative ·
--     no name-based construction, no info@ guessing, no MX-invention.
--   · Public directory rule stays SEPARATE · the directory-reader
--     predicate (not shipped in this migration) decides what to show
--     to end users; QUALIFIED is a prerequisite but not the whole
--     visibility rule.
--
-- Rollback (owner-approved · forward-only by default · drop only after
--  dumping to a side table if any user data has landed in the columns):
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '202';
--     ALTER TABLE nex.business_canonical
--       DROP CONSTRAINT IF EXISTS ck_bc_email_status,
--       DROP CONSTRAINT IF EXISTS ck_bc_qualification_status,
--       DROP CONSTRAINT IF EXISTS ck_bc_email_format,
--       DROP COLUMN IF EXISTS email,
--       DROP COLUMN IF EXISTS email_source_url,
--       DROP COLUMN IF EXISTS email_verified_at,
--       DROP COLUMN IF EXISTS email_status,
--       DROP COLUMN IF EXISTS qualification_status,
--       DROP COLUMN IF EXISTS email_last_attempted_at;
--     DROP INDEX IF EXISTS nex.idx_bc_qualification_status;
--     DROP INDEX IF EXISTS nex.idx_bc_email_backfill_cursor;
--   COMMIT;

BEGIN;

-- ─── 1 · Columns (idempotent · ADD COLUMN IF NOT EXISTS) ──────────────
ALTER TABLE nex.business_canonical
  ADD COLUMN IF NOT EXISTS email                   text,
  ADD COLUMN IF NOT EXISTS email_source_url        text,
  ADD COLUMN IF NOT EXISTS email_verified_at       timestamptz,
  ADD COLUMN IF NOT EXISTS email_status            text,
  ADD COLUMN IF NOT EXISTS qualification_status    text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS email_last_attempted_at timestamptz;

-- ─── 2 · CHECK constraints (idempotent via DO block) ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_bc_email_status'
  ) THEN
    ALTER TABLE nex.business_canonical
      ADD CONSTRAINT ck_bc_email_status
      CHECK (
        email_status IS NULL
        OR email_status IN ('FOUND', 'VALIDATED', 'INVALID', 'NOT_FOUND')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_bc_qualification_status'
  ) THEN
    ALTER TABLE nex.business_canonical
      ADD CONSTRAINT ck_bc_qualification_status
      CHECK (
        qualification_status IN
          ('PENDING', 'QUALIFIED', 'UNQUALIFIED', 'DISQUALIFIED')
      );
  END IF;

  -- Lightweight format gate · catches obvious garbage without
  -- rejecting edge-case-valid international addresses the deliverable
  -- check will handle later.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_bc_email_format'
  ) THEN
    ALTER TABLE nex.business_canonical
      ADD CONSTRAINT ck_bc_email_format
      CHECK (
        email IS NULL
        OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      );
  END IF;
END $$;

-- ─── 3 · Indexes · dashboard split + backfill cursor ─────────────────
-- 3a · HQ dashboard reads "qualified vs pending" counts a lot · a
-- partial index on PENDING / UNQUALIFIED rows is both small and fast.
CREATE INDEX IF NOT EXISTS idx_bc_qualification_status
  ON nex.business_canonical (qualification_status)
  WHERE qualification_status IN ('PENDING', 'UNQUALIFIED');

-- 3b · Resumable backfill cursor · the orchestrator picks the oldest-
-- attempted (or never-attempted · NULL via NULLS FIRST) PENDING row
-- on each tick. Partial index keeps it small as QUALIFIED rows age out.
CREATE INDEX IF NOT EXISTS idx_bc_email_backfill_cursor
  ON nex.business_canonical (email_last_attempted_at NULLS FIRST)
  WHERE qualification_status = 'PENDING';

-- ─── 4 · Column comments · load-bearing doctrine references ──────────
COMMENT ON COLUMN nex.business_canonical.email IS
  'Public business email · nullable · never derived from name · set by the sealed six-method extractor at src/lib/nex/discovery-world/email-extractor.ts or extracted directly from OSM contact tags.';

COMMENT ON COLUMN nex.business_canonical.email_source_url IS
  'URL at which the current email was observed (OSM feature URL or walked page). Attribution-only · deletions here never cascade.';

COMMENT ON COLUMN nex.business_canonical.email_verified_at IS
  'Last time the current email was re-observed at its source · drives freshness, NOT deliverability. Deliverability status is email_status.';

COMMENT ON COLUMN nex.business_canonical.email_status IS
  'Email lifecycle label · NULL (never attempted) / FOUND (set, not deliverability-verified) / VALIDATED (deliverable per the acceptance matrix) / INVALID (format rejected or bounced) / NOT_FOUND (walked the website, no email there).';

COMMENT ON COLUMN nex.business_canonical.qualification_status IS
  'NEX HQ qualification gate · PENDING (not yet validated · includes OSM-FOUND addresses awaiting the deliverability check) / QUALIFIED (email_status=VALIDATED only · reached via the orchestrator state machine) / UNQUALIFIED (NOT_FOUND or INVALID observation on last attempt) / DISQUALIFIED (admin removal · do not retry · never overwritten by the backfill). Decoupled from email_status so an OSM-shaped address cannot auto-qualify a business.';

COMMENT ON COLUMN nex.business_canonical.email_last_attempted_at IS
  'Backfill cursor · set each time the email walker attempts this row. The resumable backfill driver uses the matching partial index to resume at the oldest-attempted PENDING row.';

-- ─── 5 · Migration history row ──────────────────────────────────────
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '202',
    'nex.business_canonical · email + qualification_status + resumable-backfill cursor',
    'Owner-authorised 2026-10-16 · harvester-email qualification pipeline · ADDITIVE · idempotent · forward-only by default · no legacy data touched · pre-existing rows default to qualification_status=PENDING. REVISED 2026-10-16 to decouple FOUND from QUALIFIED · only email_status=VALIDATED promotes a row to QUALIFIED; FOUND stays PENDING. Preservation: DISQUALIFIED is an admin lock, QUALIFIED is never downgraded by a FOUND/NOT_FOUND re-walk.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- Post-apply verification queries (operator reviews before signing off):
--
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='nex' AND table_name='business_canonical'
--      AND column_name IN ('email','email_source_url','email_verified_at',
--                          'email_status','qualification_status',
--                          'email_last_attempted_at')
--    ORDER BY column_name;
--   -- expect: 6 rows
--
--   SELECT conname FROM pg_constraint
--    WHERE conname IN ('ck_bc_email_status','ck_bc_qualification_status',
--                      'ck_bc_email_format');
--   -- expect: 3 rows
--
--   SELECT qualification_status, count(*) FROM nex.business_canonical
--    GROUP BY qualification_status;
--   -- expect: all pre-existing rows under 'PENDING'
-- ═══════════════════════════════════════════════════════════════════
