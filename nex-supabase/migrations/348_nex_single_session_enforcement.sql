-- Migration 348 · NEX single-session enforcement (Phase 4).
-- -----------------------------------------------------------------------------
-- Owner-authorised 2026-11-15. Sandbox-only · production sealed.
--
-- Enforces "one user signed into one account at a time".
--
-- Additive schema only · no data rewrites · no RLS changes · no drops.
--
-- 1. nex_account.active_single_session_id
--    uuid NULL · pointer to the ONE nex_session row that currently holds
--    the account. When a new sign-in lands, the service layer (see
--    src/lib/nex-native/app/single-session-service.ts · claimSingleSession)
--    atomically swaps this pointer to the freshly minted nex_session row
--    AND marks every other live nex_session for the same account as
--    superseded (fields below). The session resolver refuses requests
--    coming from a superseded session · same net effect as revoked_at.
--
-- 2. nex_session.superseded_at
--    nex_session.superseded_reason
--    timestamptz / text · NULL for the active session. Populated when
--    another sign-in on the same account displaces this row. The
--    resolver check is: if superseded_at IS NOT NULL → return null (as
--    if not signed in). This layers cleanly on top of the existing
--    `revoked_at` check in session.ts · a row can be in either state
--    (or both · supersession then explicit revoke); both short-circuit
--    to null.
--
--    `superseded_reason` is a free-text tag · the Phase 4 writer uses
--    'single_session_claimed' when a newer sign-in bumps a live session;
--    future phases may introduce other reasons (admin force, policy
--    rotation, etc.) without a migration.
--
-- Not covered by this migration (deferred / separate concerns):
--   · Drawer event emission on supersession · Phase 3's security-service
--     already emits its own events; the Phase 4 writer returns the list
--     of superseded session IDs so a future caller can emit per-site.
--   · RLS · writes continue to happen via service-role from inside the
--     sign-in action + session helpers. No existing policy weakened.
--   · Backfill · existing nex_session rows get superseded_at/reason =
--     NULL (nullable columns · no default) so pre-existing sessions
--     remain untouched. `active_single_session_id` on nex_account starts
--     NULL · the next successful sign-in populates it.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.nex_account
  ADD COLUMN IF NOT EXISTS active_single_session_id uuid;

-- Deliberately NOT a FOREIGN KEY: nex_session rows can be hard-deleted
-- (table has no ON DELETE SET NULL back-reference and we don't want a
-- delete on a session row to cascade into the account). We treat a
-- pointer to a missing session as "no active session"; the service
-- layer re-claims on the next sign-in.
COMMENT ON COLUMN public.nex_account.active_single_session_id IS
  'Phase 4 (mig 348) · UUID of the ONE nex_session row that currently '
  'holds this account. Written by single-session-service.claimSingleSession '
  'on successful sign-in. NULL = no active session. Not an FK on purpose '
  '(see mig 348 header).';

CREATE INDEX IF NOT EXISTS idx_nex_account_active_single_session
  ON public.nex_account (active_single_session_id)
  WHERE active_single_session_id IS NOT NULL;

ALTER TABLE public.nex_session
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

ALTER TABLE public.nex_session
  ADD COLUMN IF NOT EXISTS superseded_reason text;

ALTER TABLE public.nex_session
  DROP CONSTRAINT IF EXISTS nex_session_superseded_reason_length;
ALTER TABLE public.nex_session
  ADD CONSTRAINT nex_session_superseded_reason_length
  CHECK (superseded_reason IS NULL OR char_length(superseded_reason) <= 120);

COMMENT ON COLUMN public.nex_session.superseded_at IS
  'Phase 4 (mig 348) · set when a newer sign-in on the same account '
  'claims the single-session slot. Resolver treats non-NULL as equivalent '
  'to revoked_at non-NULL (returns null · not signed in).';

COMMENT ON COLUMN public.nex_session.superseded_reason IS
  'Phase 4 (mig 348) · free-text tag describing why the session was '
  'superseded. Known value: single_session_claimed. Future reasons may '
  'be added without a migration.';

-- Partial index to support the "find live sessions for this account"
-- supersession sweep performed by claimSingleSession. Matches the
-- natural filter: account_id = $1 AND superseded_at IS NULL AND
-- revoked_at IS NULL.
CREATE INDEX IF NOT EXISTS idx_nex_session_account_live_supersede
  ON public.nex_session (account_id)
  WHERE superseded_at IS NULL AND revoked_at IS NULL;
