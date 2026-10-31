-- migrations/203_nex_outreach_queue_and_lease.sql
--
-- NEX Harvester · Phase 1.4 · outreach queue + suppression + atomic
-- lease columns on business_canonical.
-- --------------------------------------------------------------------
-- STATUS: DRAFT · NOT APPLIED.
--
-- This migration pairs with the Phase 1.4 code modules under
-- src/lib/nex-native/outreach/* and the lease-aware changes to
-- src/lib/nex-native/harvest/email-backfill-orchestrator.ts. All
-- consumers of these columns + tables are built with a fail-safe
-- information_schema probe · they return skip-sentinels when the
-- schema is absent (no exceptions bubble up), so the migration can
-- be applied asynchronously to the code.
--
-- No live rollout is authorised by this file. The owner's three gates
-- remain:
--   1. Apply this migration to the live DB (separate explicit grant)
--   2. Fill in the legal basis + opt-out mechanism in the Phase 1.3
--      doctrine (owner-blank today)
--   3. Enable NEX_OUTREACH_ENABLED=true (fresh env flag introduced in
--      Phase 1.4 · default OFF)
--
-- Companion migration (not shipped here) is 202 which adds the
-- email + qualification columns to business_canonical. 203 assumes
-- 202 is live and references its columns (email, qualification_status).

BEGIN;

-- =========================================================
-- SECTION A · atomic lease columns on business_canonical
-- =========================================================
--
-- Phase 1.3 shipped a soft cursor on `email_last_attempted_at`.
-- Phase 1.4 adds a hard atomic lease so two concurrent Vercel ticks
-- never walk the same domain. The lease is held FOR the duration of
-- the walker (~5 min) and expires automatically if the walker crashes,
-- so a stuck row recovers without manual intervention.
--
-- Design mirrors `nex.delivery_jobs.lease_owner + lease_expires_at`
-- in src/lib/nex/delivery/queue.ts (sealed · the pattern is proven).

ALTER TABLE nex.business_canonical
  ADD COLUMN IF NOT EXISTS email_lease_token uuid NULL,
  ADD COLUMN IF NOT EXISTS email_lease_expires_at timestamptz NULL;

COMMENT ON COLUMN nex.business_canonical.email_lease_token IS
  'Phase 1.4 · opaque worker claim token. Set by the backfill '
  'orchestrator inside a `FOR UPDATE SKIP LOCKED` CTE; cleared on '
  'result-write (CAS on the same token). Non-null = row is being '
  'walked right now by SOME tick.';

COMMENT ON COLUMN nex.business_canonical.email_lease_expires_at IS
  'Phase 1.4 · lease expiry (default now()+5min). Rows with '
  '`email_lease_expires_at < now()` are reclaimable by the next tick '
  'even if `email_lease_token` is still set (the previous walker '
  'crashed without clearing).';

-- Partial index on the "claimable right now" subset. Covers both
-- virgin rows (lease NULL) and expired-lease recovery.
--
-- 2026-10-31 · dropped the `OR email_lease_expires_at < now()` branch
-- of the WHERE clause. Postgres requires index predicates to be
-- IMMUTABLE and `now()` is STABLE. The lease-recovery path is now
-- handled by the worker's query-time WHERE (which is free to use
-- now()); the index still accelerates the primary virgin-rows claim
-- path (`email_lease_token IS NULL`), which is the dominant workload.
-- Expired-lease recovery is rare (only after a crashed walker) and
-- can tolerate the slightly wider scan.
CREATE INDEX IF NOT EXISTS idx_bc_email_lease_claimable
  ON nex.business_canonical (email_last_attempted_at NULLS FIRST, canonical_business_id)
  WHERE
    (
      qualification_status = 'PENDING'
      OR qualification_status = 'UNQUALIFIED'
    )
    AND email_lease_token IS NULL;

-- =========================================================
-- SECTION B · nex.business_outreach_suppression
-- =========================================================
--
-- One row per suppressed email address. Any row here means "do not
-- enqueue, do not send." Reasons are enumerated so the HQ dashboard
-- can report hard-bounce rate vs opt-out rate vs admin-block rate.
--
-- The suppression layer is checked BOTH at enqueue (prevents a
-- newly-queued job for a suppressed address) AND at send (prevents a
-- previously-queued job if the address was suppressed after enqueue).
-- Belt-and-braces because the queue is persistent · an opt-out that
-- lands between enqueue and send must still be honoured.
--
-- The email is lowercased + trimmed at write time via the trigger
-- below · the application layer should do the same for symmetry.

CREATE TABLE IF NOT EXISTS nex.business_outreach_suppression (
  suppression_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL,
  reason            text NOT NULL,
  source            text NULL,         -- 'webhook:ses' · 'owner_admin' · 'user_opt_out' · 'manual'
  evidence          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_outreach_suppression_reason_check
    CHECK (reason IN ('hard_bounce', 'opt_out', 'admin_block', 'complaint')),
  CONSTRAINT business_outreach_suppression_email_shape_check
    CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- One active row per email · a repeat suppression updates evidence.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bos_email_lower
  ON nex.business_outreach_suppression (lower(email));

-- Normaliser trigger · lowercases + trims the stored email so every
-- lookup can rely on the UNIQUE INDEX exact-match path.
CREATE OR REPLACE FUNCTION nex.fn_normalise_outreach_suppression_email()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bos_normalise_email
  ON nex.business_outreach_suppression;
CREATE TRIGGER trg_bos_normalise_email
  BEFORE INSERT OR UPDATE OF email ON nex.business_outreach_suppression
  FOR EACH ROW
  EXECUTE FUNCTION nex.fn_normalise_outreach_suppression_email();

COMMENT ON TABLE nex.business_outreach_suppression IS
  'Phase 1.4 · global do-not-contact list. Checked at BOTH enqueue '
  'and send. Reasons: hard_bounce (ESP webhook), opt_out (user '
  'request), admin_block (HQ decision), complaint (ESP complaint '
  'webhook). Suppression is permanent until an admin reactivates by '
  'DELETE from this table.';

-- =========================================================
-- SECTION C · nex.business_outreach_queue
-- =========================================================
--
-- Persistent outreach queue. One row per (canonical_business_id,
-- template_id) attempt. Workers claim with SELECT ... FOR UPDATE SKIP
-- LOCKED + lease TTL, same pattern as nex.delivery_jobs.
--
-- status machine:
--   pending   → inserted, awaiting worker
--   running   → leased by a worker, lease_expires_at is in the future
--   sent      → send-adapter returned ok
--   failed    → send-adapter returned not-ok · requeue if attempts <
--               max_attempts via a cron sweep
--   suppressed → eligibility check at send-time flagged this email
--                as suppressed · do not retry · HQ records the reason

CREATE TABLE IF NOT EXISTS nex.business_outreach_queue (
  queue_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_business_id uuid NOT NULL REFERENCES nex.business_canonical(canonical_business_id) ON DELETE CASCADE,
  email                 text NOT NULL,
  template_id           text NOT NULL,
  status                text NOT NULL DEFAULT 'pending',
  priority              integer NOT NULL DEFAULT 100,
  scheduled_for         timestamptz NOT NULL DEFAULT now(),
  lease_owner           text NULL,
  lease_expires_at      timestamptz NULL,
  attempts              integer NOT NULL DEFAULT 0,
  max_attempts          integer NOT NULL DEFAULT 3,
  last_error            text NULL,
  suppression_reason    text NULL,       -- when status='suppressed'
  payload               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  started_at            timestamptz NULL,
  completed_at          timestamptz NULL,
  CONSTRAINT business_outreach_queue_status_check
    CHECK (status IN ('pending','running','sent','failed','suppressed','dead_letter')),
  CONSTRAINT business_outreach_queue_email_shape_check
    CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- One active (pending|running) job per (business, template). Lets us
-- re-queue a (business, template) once the previous attempt is in a
-- terminal state (sent/failed/suppressed/dead_letter) without creating
-- a parallel row during a cron re-sweep.
CREATE UNIQUE INDEX IF NOT EXISTS uq_boq_active_per_business_template
  ON nex.business_outreach_queue (canonical_business_id, template_id)
  WHERE status IN ('pending','running');

-- Worker-claim index. Partial so it only covers claim-eligible rows.
-- 2026-10-31 · narrowed the WHERE predicate to drop the `lease_expires_at
-- < now()` branch (now() is STABLE; Postgres requires index predicates
-- to be IMMUTABLE). The index still covers status='pending' (the
-- dominant claim path) and status='running' with NULL lease. The
-- expired-running recovery path falls through to a wider scan on crash
-- recovery, which is acceptable given recovery is rare.
CREATE INDEX IF NOT EXISTS idx_boq_claimable
  ON nex.business_outreach_queue (priority ASC, scheduled_for ASC, queue_id)
  WHERE
    status = 'pending'
    OR (status = 'running' AND lease_expires_at IS NULL);

-- Dashboard-count index · partial, so counting pending by itself is
-- O(index) not O(table scan).
CREATE INDEX IF NOT EXISTS idx_boq_status
  ON nex.business_outreach_queue (status, created_at);

CREATE TRIGGER trg_boq_normalise_email
  BEFORE INSERT OR UPDATE OF email ON nex.business_outreach_queue
  FOR EACH ROW
  EXECUTE FUNCTION nex.fn_normalise_outreach_suppression_email();

COMMENT ON TABLE nex.business_outreach_queue IS
  'Phase 1.4 · persistent outreach job queue. Workers claim with '
  'SELECT ... FOR UPDATE SKIP LOCKED + lease_expires_at TTL. '
  'Modeled on nex.delivery_jobs. Suppression is checked at BOTH '
  'enqueue and send; a mid-flight opt-out flips the row to '
  'status=suppressed without the ESP ever being contacted.';

COMMIT;

-- =========================================================
-- Rollback (manual · forward-only by default)
-- =========================================================
-- DROP TABLE IF EXISTS nex.business_outreach_queue;
-- DROP TABLE IF EXISTS nex.business_outreach_suppression;
-- DROP FUNCTION IF EXISTS nex.fn_normalise_outreach_suppression_email();
-- ALTER TABLE nex.business_canonical
--   DROP COLUMN IF EXISTS email_lease_token,
--   DROP COLUMN IF EXISTS email_lease_expires_at;
-- DROP INDEX IF EXISTS nex.idx_bc_email_lease_claimable;
