-- ============================================================================
-- NEX-native Migration 219 · nex_live_session + nex_live_featured_product
-- Phase 2 schema · G2 Live Commerce foundation
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Must not be applied to the sealed production project
-- `ijvqdvsvwtwxzcqmoqit` without explicit owner approval. Apply order:
--   216 (Phase 1 Slice 1C) → 217 (helper harden) → 218 (RLS harden) → 219.
--
-- Owner-authorised Phase 2 foundation per the saved plan at
-- docs/doctrine/nex-commerce-live-relationship-plan-2026-10-24.md §5.4.
--
-- Purpose
-- ----------------------------------------------------------------------------
-- Introduces the authoritative persistence layer for NEX Live sessions
-- and featured-product state. Replaces the current client-memory +
-- Realtime-only pattern used by the Phase 1 Live pilot
-- (src/app/nex-native/live-commerce/go-live/_go-live-client.tsx and the
-- Supabase Realtime broadcast channel at
-- src/lib/nex-native/live-broadcast/featured-product-channel.ts).
--
-- Primitives:
--
--   nex_live_session           · one row per started broadcast
--   nex_live_featured_product  · at most one open row per session
--
-- Both rows are owner-authoritative: the server-side action layer
-- enforces that only the broadcaster_account_id (and, when the session
-- is business-featured, the owner of business_id) can mutate them.
--
-- Design per saved plan §5.4
-- ----------------------------------------------------------------------------
-- · nex_live_session.business_id is NULLABLE. Per the Tier Distinction
--   (§5.0): any NEX user may broadcast Live. Only business + shop
--   broadcasters feature products. For a free-tier broadcast, business_id
--   is NULL and no nex_live_featured_product row can ever reference the
--   session.
--
-- · A session has status: 'open' | 'ended'. Only one 'open' session per
--   broadcaster at a time (partial unique index).
--
-- · nex_live_featured_product has started_featuring_at + ended_featuring_at.
--   An "active" featured product is a row with ended_featuring_at IS NULL.
--   At most ONE active featured_product per session_id (partial unique
--   index). Setting a new featured product closes the previous (service-
--   layer transaction).
--
-- · "Is this user live?" = EXISTS (SELECT 1 FROM nex_live_session
--     WHERE broadcaster_account_id = ? AND status = 'open').
--
-- · "Is this product currently featured in a live session?" =
--     EXISTS (SELECT 1
--             FROM nex_live_featured_product fp
--             JOIN nex_live_session s ON s.id = fp.session_id
--             WHERE fp.product_id = ?
--               AND fp.ended_featuring_at IS NULL
--               AND s.status = 'open').
--
-- RLS model
-- ----------------------------------------------------------------------------
-- nex_live_session:
--   · SELECT · public (anon + authenticated) for status='open' sessions
--     — matches the central Live feed doctrine (§5.1). Ended sessions
--     readable only by the broadcaster (private history).
--   · INSERT · authenticated · broadcaster_account_id must equal
--     nex_current_account_ids(). The caller is creating a session for
--     themselves.
--   · UPDATE · authenticated · broadcaster-only (same identity check).
--     Used to flip status 'open' → 'ended'.
--   · DELETE · service-role only (deny-by-default to authenticated).
--
-- nex_live_featured_product:
--   · SELECT · public for rows whose session is 'open'. Private history
--     after session ended.
--   · INSERT · authenticated · broadcaster of the referenced session
--     must equal nex_current_account_ids().
--   · UPDATE · authenticated · same identity check. Used to close out
--     a featured_product (set ended_featuring_at = now()).
--   · DELETE · service-role only.
--
-- Realtime
-- ----------------------------------------------------------------------------
-- The sealed featured-product-channel.ts (Supabase Realtime broadcast)
-- continues to serve as the fast-path transport for viewer UI updates.
-- The two tables become the authoritative state · broadcaster writes to
-- the DB BEFORE emitting the Realtime broadcast; viewers listen to
-- Realtime but reconcile on reconnect by reading the DB. This matches
-- the saved plan §5.4 "DB remains the authoritative state."
--
-- Dependencies
-- ----------------------------------------------------------------------------
--   APPLIED (verify in sandbox):
--     001 · nex_account identity
--     002 · nex_business + owner_account_id
--     003 · nex_product
--     010 · SECURITY DEFINER helpers (nex_current_account_ids)
--
--   PREREQUISITE (apply in order):
--     216 · Phase 1 Slice 1C discovery-signal enum extensions
--     217 · search_path hardening
--     218 · RLS harden
--
-- Rollback
-- ----------------------------------------------------------------------------
-- See the rollback block at the end of this file. Rollback drops the
-- two new tables (CASCADE drops rows), their policies, their indexes,
-- and their migration ledger row. Zero impact on existing tables.
-- Pure DDL.
--
-- Notes on scope
-- ----------------------------------------------------------------------------
-- This migration is foundation ONLY · it does not wire callers. The
-- live-session service and broadcaster-UI integration are authored in
-- separate files (src/lib/nex-native/live-broadcast/live-session-service.ts
-- and the broadcaster surface update). This migration can be rolled
-- back independently if the service work does not land.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Part A · nex_live_session · broadcaster lifecycle
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex_live_session (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_account_id    uuid        NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  -- NULLABLE per §5.0 tier distinction · free-tier broadcasters have no
  -- business, no shop, no commerce controls.
  business_id               uuid        NULL REFERENCES nex_business(id) ON DELETE SET NULL,
  status                    text        NOT NULL DEFAULT 'open',
  started_at                timestamptz NOT NULL DEFAULT now(),
  ended_at                  timestamptz NULL,
  -- Soft heartbeat · updated by the broadcaster client each N seconds
  -- so stale sessions can be auto-ended by a future worker. NULL means
  -- "no heartbeat observed yet · treat as not-stale on the start_at tick."
  last_heartbeat_at         timestamptz NULL,
  CONSTRAINT nex_live_session_status_values
    CHECK (status IN ('open', 'ended')),
  CONSTRAINT nex_live_session_ended_requires_timestamp
    CHECK ((status = 'ended' AND ended_at IS NOT NULL)
        OR (status = 'open' AND ended_at IS NULL))
);

COMMENT ON TABLE nex_live_session IS
  'NEX Live session lifecycle · one row per started broadcast · owner-authoritative via action-layer check + RLS owner-only writes · public SELECT only while status=open · ended sessions are private history to the broadcaster. Sealed 2026-10-24 · Migration 219 · Phase 2 foundation per saved plan §5.4.';

CREATE INDEX IF NOT EXISTS idx_nex_live_session_broadcaster_status
  ON nex_live_session (broadcaster_account_id, status);

CREATE INDEX IF NOT EXISTS idx_nex_live_session_business_status
  ON nex_live_session (business_id, status)
  WHERE business_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nex_live_session_open_started
  ON nex_live_session (started_at DESC)
  WHERE status = 'open';

-- At most one 'open' session per broadcaster. A broadcaster cannot
-- start a second session while the first is still open · the client
-- must either end the previous session or the server-side `startSession`
-- action rejects. The partial unique index enforces this at the DB
-- layer regardless of service-layer discipline.
CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_live_session_one_open_per_broadcaster
  ON nex_live_session (broadcaster_account_id)
  WHERE status = 'open';

-- ----------------------------------------------------------------------------
-- Part B · nex_live_featured_product · product-pin lifecycle
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex_live_featured_product (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                uuid        NOT NULL REFERENCES nex_live_session(id) ON DELETE CASCADE,
  product_id                uuid        NOT NULL REFERENCES nex_product(id) ON DELETE CASCADE,
  started_featuring_at      timestamptz NOT NULL DEFAULT now(),
  ended_featuring_at        timestamptz NULL,
  CONSTRAINT nex_live_featured_product_ended_after_started
    CHECK (ended_featuring_at IS NULL OR ended_featuring_at >= started_featuring_at)
);

COMMENT ON TABLE nex_live_featured_product IS
  'Product-pin lifecycle inside a live session · at most one active row per session (partial unique index) · active = ended_featuring_at IS NULL · setting a new pin closes the previous in a service-layer transaction. Owner-authoritative via action-layer check (broadcaster owns the session) + RLS owner-only writes. Sealed 2026-10-24 · Migration 219.';

CREATE INDEX IF NOT EXISTS idx_nex_live_featured_product_session
  ON nex_live_featured_product (session_id, started_featuring_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_live_featured_product_product_active
  ON nex_live_featured_product (product_id)
  WHERE ended_featuring_at IS NULL;

-- At most one active featured_product per session at any time.
-- The "replace pin" flow (service-layer) must UPDATE the previous row
-- to set ended_featuring_at BEFORE INSERTing a new row · otherwise the
-- partial unique index rejects the second active row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_live_featured_product_one_active_per_session
  ON nex_live_featured_product (session_id)
  WHERE ended_featuring_at IS NULL;

-- ----------------------------------------------------------------------------
-- Part C · RLS policies
-- ----------------------------------------------------------------------------

ALTER TABLE nex_live_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_live_featured_product ENABLE ROW LEVEL SECURITY;

-- Public can read open sessions (central Live feed). Ended sessions
-- are history and are not public.
CREATE POLICY nex_live_session_public_select_open
  ON nex_live_session FOR SELECT
  USING (status = 'open');

-- The broadcaster can also read their own ended sessions.
CREATE POLICY nex_live_session_broadcaster_select_history
  ON nex_live_session FOR SELECT
  TO authenticated
  USING (broadcaster_account_id IN (SELECT nex_current_account_ids()));

-- Create a session as yourself.
CREATE POLICY nex_live_session_broadcaster_insert
  ON nex_live_session FOR INSERT
  TO authenticated
  WITH CHECK (
    broadcaster_account_id IN (SELECT nex_current_account_ids())
    AND (
      business_id IS NULL
      OR business_id IN (SELECT nex_current_owned_business_ids())
    )
  );

-- End your own session (status open → ended, set ended_at, etc.).
CREATE POLICY nex_live_session_broadcaster_update
  ON nex_live_session FOR UPDATE
  TO authenticated
  USING (broadcaster_account_id IN (SELECT nex_current_account_ids()));

-- NO DELETE policy · service-role only (admin cleanup only).

-- Featured-product rows: public read when the session is open. Ended
-- history is private to the broadcaster.
CREATE POLICY nex_live_featured_product_public_select_open_session
  ON nex_live_featured_product FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nex_live_session s
       WHERE s.id = session_id AND s.status = 'open'
    )
  );

CREATE POLICY nex_live_featured_product_broadcaster_select_history
  ON nex_live_featured_product FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM nex_live_session s
       WHERE s.id = session_id
         AND s.broadcaster_account_id IN (SELECT nex_current_account_ids())
    )
  );

-- Only the broadcaster of the referenced session may pin a product.
CREATE POLICY nex_live_featured_product_broadcaster_insert
  ON nex_live_featured_product FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nex_live_session s
       WHERE s.id = session_id
         AND s.broadcaster_account_id IN (SELECT nex_current_account_ids())
         AND s.business_id IS NOT NULL
         AND s.business_id IN (SELECT nex_current_owned_business_ids())
    )
  );

-- Close out a pin (set ended_featuring_at) · same ownership.
CREATE POLICY nex_live_featured_product_broadcaster_update
  ON nex_live_featured_product FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM nex_live_session s
       WHERE s.id = session_id
         AND s.broadcaster_account_id IN (SELECT nex_current_account_ids())
    )
  );

-- NO DELETE policy · service-role only.

-- ----------------------------------------------------------------------------
-- Migration ledger
-- ----------------------------------------------------------------------------

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '219',
  'nex_live_session + nex_live_featured_product · Phase 2 Live foundation · R3 + R4 schema closure',
  'Owner-authorised Phase 2 foundation 2026-10-24 per saved plan §5.4. Introduces authoritative persistence for Live sessions + featured products. business_id is nullable to support §5.0 free-tier broadcasters. Partial unique indexes enforce at-most-one-open-session-per-broadcaster and at-most-one-active-featured-product-per-session. RLS: public SELECT on open-only · broadcaster SELECT on history · broadcaster-only INSERT/UPDATE via nex_current_account_ids + nex_current_owned_business_ids helpers. NO DELETE policy · service-role only. Service layer (live-session-service.ts) wires callers in a separate file. NOT YET APPLIED to any database.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Rollback (manual · single transaction)
-- ============================================================================
--
-- BEGIN;
--   DROP TABLE IF EXISTS nex_live_featured_product CASCADE;
--   DROP TABLE IF EXISTS nex_live_session CASCADE;
--   DELETE FROM nex_migration_history WHERE version = '219';
-- COMMIT;
--
-- Rollback drops the two new tables, their indexes, their policies,
-- and the migration ledger row. CASCADE handles FK cleanup. Existing
-- tables are not affected. Zero data loss on tables outside this
-- migration's scope.
-- ============================================================================
