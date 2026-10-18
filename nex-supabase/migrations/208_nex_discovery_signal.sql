-- 208_nex_discovery_signal.sql
--
-- NEX Discovery · behaviour-signal table · P2 of the recommended
-- discovery system · owner-authorised 2026-10-18 as a MIGRATION
-- FILE only · APPLICATION requires separate explicit approval per
-- the sealed CLAUDE.md DB-migration-approval gate.
-- ---------------------------------------------------------------------------
-- Pairs with:
--   · src/lib/nex-native/discovery/discovery-signal-types.ts
--   · src/lib/nex-native/discovery/discovery-signal-service.ts
--   · src/app/nex-native/directory/_log-discovery-signal-action.ts
--
-- Doctrine (sealed Directory Spine, 2026-10-07):
--
--   NEX Intelligence  = what-is-TRUE
--   NEX Directory     = what-is-safe-to-PUBLISH
--   NEX Business      = owner-CONTROLS
--   NEX Marketing     = acquisition-opportunities · DOWNSTREAM ONLY
--
-- This table is MARKETING-layer data. It MUST never be:
--   · joined into canonical Intelligence queries,
--   · used to derive business truth / verification state,
--   · exposed to a business owner about THEIR customers (that
--     surface, when it exists, aggregates across accounts and
--     never leaks individual-account behaviour).
--
-- Privacy posture:
--   · RLS enabled · row visibility is limited to the owning
--     account OR the service_role.
--   · No PII beyond `account_id` · `metadata` is opaque jsonb.
--   · Signals age out · a nightly worker (future · not scoped in
--     P2) can delete rows older than N days per the retention
--     policy the owner approves at the data-governance review.

BEGIN;

-- ─── Enum: signal type ────────────────────────────────────────────
-- Keep the enum in sync with discovery-signal-types.ts
-- DISCOVERY_SIGNAL_TYPES. Adding a value here REQUIRES a matching
-- update to the TS enum · drift breaks the service's isSignalType
-- validator.

CREATE TYPE nex.discovery_signal_type AS ENUM (
  'view',
  'tap',
  'chat_open',
  'save',
  'dismiss'
);

-- ─── Table: discovery_signal ─────────────────────────────────────

CREATE TABLE nex.discovery_signal (
  id            uuid                            PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid                            NOT NULL,
  signal_type   nex.discovery_signal_type       NOT NULL,
  -- business_id is nullable so future "pure navigation" signals
  -- (e.g. "opened directory landing") can be recorded. Today every
  -- real signal references a business.
  business_id   uuid                            NULL,
  metadata      jsonb                           NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz                     NOT NULL DEFAULT now(),

  -- Foreign key to the sealed nex_account table · ON DELETE CASCADE
  -- so a GDPR / account-deletion flow removes the user's signal
  -- history atomically with their account row.
  CONSTRAINT discovery_signal_account_fk
    FOREIGN KEY (account_id) REFERENCES public.nex_account(id) ON DELETE CASCADE,

  -- business_id has NO foreign key · it may reference either
  -- nex_business.id OR nex.business_canonical.canonical_business_id
  -- (the signal doesn't care which surface the user interacted
  -- with). The ranking policy resolves business identity at query
  -- time via the sealed canonical layer.

  -- Metadata size guard · the service module enforces the same
  -- limit but defence-in-depth protects against direct SQL writes.
  CONSTRAINT discovery_signal_metadata_bounds
    CHECK (octet_length(metadata::text) <= 2048)
);

-- ─── Indexes ──────────────────────────────────────────────────────

-- Primary read pattern: "give me this user's recent signals"
-- (feeds the per-user ranking policy in P3+). Composite covers
-- the hot path (account_id + ORDER BY created_at DESC).
CREATE INDEX discovery_signal_account_time_idx
  ON nex.discovery_signal (account_id, created_at DESC);

-- Secondary read pattern: "how many users signalled interest in
-- this business this week" (used by business-insights surfaces,
-- aggregated · never per-user). Partial index on recent rows
-- keeps the index small.
CREATE INDEX discovery_signal_business_recent_idx
  ON nex.discovery_signal (business_id, created_at DESC)
  WHERE business_id IS NOT NULL;

-- ─── Row-Level Security ──────────────────────────────────────────

ALTER TABLE nex.discovery_signal ENABLE ROW LEVEL SECURITY;

-- Users can SELECT their own signals (future "my activity" view).
CREATE POLICY discovery_signal_own_select
  ON nex.discovery_signal
  FOR SELECT
  USING (auth.uid() = account_id);

-- Only service_role writes · the server action proxies all
-- inserts through the sealed admin client. No direct client
-- INSERT path · zero risk of a malicious client firing fake
-- signals against another account.
CREATE POLICY discovery_signal_service_write
  ON nex.discovery_signal
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Users can DELETE their own rows (future "clear my activity"
-- surface in Settings · Privacy). Admin can delete any row via
-- service_role · which bypasses RLS by design.
CREATE POLICY discovery_signal_own_delete
  ON nex.discovery_signal
  FOR DELETE
  USING (auth.uid() = account_id);

-- ─── Grants ──────────────────────────────────────────────────────

GRANT SELECT, DELETE ON nex.discovery_signal TO authenticated;
GRANT USAGE ON TYPE nex.discovery_signal_type TO authenticated, service_role;
GRANT ALL ON nex.discovery_signal TO service_role;

-- ─── Comment / documentation ─────────────────────────────────────

COMMENT ON TABLE nex.discovery_signal IS
  'NEX Discovery · P2 behaviour-signal store · owner-authorised 2026-10-18. '
  'MARKETING-LAYER data · never joined into Intelligence / Directory '
  'canonical queries. Sealed enum type in discovery-signal-types.ts.';

COMMENT ON COLUMN nex.discovery_signal.metadata IS
  'Opaque jsonb · ranking policies may read · Intelligence layer may NOT. '
  '≤ 2048 bytes serialised (CHECK constraint).';

COMMIT;

-- ─── Deployment notes ────────────────────────────────────────────
--
-- Before applying this migration:
--   1. Confirm the sealed Supabase project id is `ijvqdvsvwtwxzcqmoqit`
--      (per CLAUDE.md section 8 · the one source of truth).
--   2. Confirm `nex` schema exists · migrations 146-157 should have
--      created it as part of the Directory Spine seal.
--   3. Confirm `public.nex_account` exists (should · sealed since
--      the earliest consumer migrations).
--
-- After applying:
--   4. Set env var `NEX_DISCOVERY_SIGNAL_ENABLED=1` in the Vercel
--      project (or local .env.local for dev). The service module
--      is a no-op until this flag flips.
--   5. (Optional) Instrument a first signal site · e.g. directory
--      card tap · to prove the pipeline. The sealed
--      `_log-discovery-signal-action.ts` is ready to receive.
