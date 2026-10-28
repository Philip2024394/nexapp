-- Migration 234 · nex_live_jail
-- Owner-authorised 2026-10-29 · Jail Phase B schema.
--
-- Enforces the viewer-side "You've Been Jailed" 10-minute block
-- on the server. Phase A (overlay, countdown) was shipped in commit
-- c089c51. Phase B needs this table so comment-send + DM-send can
-- reject messages from jailed viewers to the broadcaster who
-- jailed them.
--
-- Doctrine:
--   · One row per (viewer_id, broadcaster_id, started_at). The sealed
--     JailPickerSheet dedupes on the client; this table assumes the
--     action layer calls INSERT only once per (viewer, broadcaster,
--     session) and does not try to upsert.
--   · `released_at` is non-NULL only when the broadcaster explicitly
--     lifts the jail early (future · owner-authored feature). Lazy
--     release is primary: isJailed() is true iff
--     `ends_at > now() AND released_at IS NULL`.
--   · The row persists forever once written. It is an audit log
--     (owner can see "I jailed these N viewers over Q1"). Keeping
--     old rows costs ~100 bytes/jail · acceptable.
--   · RLS: viewer can SELECT own rows (so client can read remaining
--     time), broadcaster can SELECT rows they issued, no one else.
--     Service role writes (via server actions · no client INSERT).

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_live_jail (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id      uuid        NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  broadcaster_id uuid        NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  session_id     uuid        NOT NULL REFERENCES public.nex_live_session(id) ON DELETE CASCADE,
  started_at     timestamptz NOT NULL DEFAULT now(),
  ends_at        timestamptz NOT NULL,
  released_at    timestamptz NULL,

  -- Owner-sealed 10-min default · callers pass explicit ends_at but
  -- the check guarantees ends_at is strictly in the future of
  -- started_at. Prevents accidental zero-duration jails.
  CHECK (ends_at > started_at),

  -- One active jail per (viewer, broadcaster, session). Repeat
  -- jailing within the same session is a no-op · the broadcaster
  -- cannot double-jail someone on the same broadcast.
  UNIQUE (viewer_id, broadcaster_id, session_id)
);

-- Hot-path index · the gate helper queries
-- `WHERE viewer_id = $1 AND ends_at > now() AND released_at IS NULL`
-- for every comment-send + DM-send attempt. Partial-index skips
-- expired/released rows at the index level.
CREATE INDEX IF NOT EXISTS idx_nex_live_jail_active_by_viewer
  ON public.nex_live_jail (viewer_id, ends_at)
  WHERE released_at IS NULL;

-- Audit-path index · owner-side "my jails this month" listing.
CREATE INDEX IF NOT EXISTS idx_nex_live_jail_by_broadcaster
  ON public.nex_live_jail (broadcaster_id, started_at DESC);

-- RLS
ALTER TABLE public.nex_live_jail ENABLE ROW LEVEL SECURITY;

-- Viewer can read own jail rows (so client can show the countdown
-- + muted-composer state).
CREATE POLICY nex_live_jail_viewer_select
  ON public.nex_live_jail
  FOR SELECT
  TO authenticated
  USING (viewer_id = (SELECT auth.uid()));

-- Broadcaster can read rows they issued (audit log on their side).
CREATE POLICY nex_live_jail_broadcaster_select
  ON public.nex_live_jail
  FOR SELECT
  TO authenticated
  USING (broadcaster_id = (SELECT auth.uid()));

-- No INSERT/UPDATE/DELETE policies for `authenticated` · writes
-- flow exclusively via server actions running with service role.
-- This closes the obvious attack vector where a jailed viewer
-- `DELETE`s their own row to unjail themselves.

-- Permissions
REVOKE ALL ON public.nex_live_jail FROM anon;
GRANT SELECT ON public.nex_live_jail TO authenticated;

COMMIT;
