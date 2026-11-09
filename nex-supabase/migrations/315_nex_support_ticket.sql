-- ============================================================================
-- NEX-native Migration 315 · Support Tickets (NEX 1)
-- ============================================================================
--
-- Owner-sealed 2026-11-10 Phase 2 DRAFT · NOT YET APPLIED.
--
-- STATUS: AUTHORED FOR REVIEW ONLY · NOT APPLIED TO ANY DATABASE.
-- Application requires separate explicit owner approval under Safety
-- Constitution §5. Sandbox apply uses scripts/apply-migration-315-
-- sandbox.mjs (hard prod-ref refusal); production apply needs a
-- second owner authorisation.
--
-- Purpose
--   Server-side store for the NEX 1 support chat surface (/nex-native/
--   nex-1). Replaces the client-only localStorage-backed Phase 1
--   implementation so HQ admins can see / reply / mute tickets from
--   /nex-native/hq/support-tickets.
--
-- Scope (3 tables · zero RLS policies in this migration):
--
--   · nex.support_ticket          · one row per ticket · immutable
--                                   ticket_number · muted boolean ·
--                                   country_iso snapshot at creation.
--   · nex.support_message         · append-only chat log · sender_kind
--                                   = 'user' | 'admin' | 'auto'.
--   · nex.support_admin_grant     · which admin accounts can read /
--                                   reply / mute. Zero rows at apply;
--                                   owner opts in each admin
--                                   explicitly after apply.
--
-- Grants: service_role only · anon + authenticated roles have ZERO
-- grants on these tables (mirror of mig 224 §40-45 defence-in-depth).
-- HQ admin page reads/writes via server actions backed by service
-- role · browser never touches these tables directly.
--
-- Rollback (destructive · safe when no production data exists):
--   BEGIN;
--     DROP TABLE IF EXISTS nex.support_message;
--     DROP TABLE IF EXISTS nex.support_ticket;
--     DROP TABLE IF EXISTS nex.support_admin_grant;
--   COMMIT;
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Part 1 · nex.support_ticket · one row per opened ticket
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.support_ticket (
  ticket_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number        text NOT NULL UNIQUE,
  requester_account_id uuid NOT NULL
    REFERENCES nex_account(id) ON DELETE CASCADE,
  requester_country_iso text,
  status               text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'awaiting_user', 'awaiting_admin', 'resolved', 'closed')),
  muted                boolean NOT NULL DEFAULT false,
  last_user_message_at  timestamptz,
  last_admin_message_at timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_support_ticket_requester
  ON nex.support_ticket (requester_account_id);
CREATE INDEX IF NOT EXISTS idx_nex_support_ticket_status
  ON nex.support_ticket (status)
  WHERE status IN ('open', 'awaiting_admin');

-- updated_at touch trigger
CREATE OR REPLACE FUNCTION nex.support_ticket_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nex_support_ticket_touch_updated_at
  ON nex.support_ticket;
CREATE TRIGGER trg_nex_support_ticket_touch_updated_at
  BEFORE UPDATE ON nex.support_ticket
  FOR EACH ROW
  EXECUTE FUNCTION nex.support_ticket_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Part 2 · nex.support_message · append-only chat log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.support_message (
  message_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    uuid NOT NULL
    REFERENCES nex.support_ticket(ticket_id) ON DELETE CASCADE,
  sender_kind  text NOT NULL
    CHECK (sender_kind IN ('user', 'admin', 'auto')),
  sender_account_id uuid
    REFERENCES nex_account(id) ON DELETE SET NULL,
  body         text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  sent_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_support_message_ticket
  ON nex.support_message (ticket_id, sent_at);

-- ---------------------------------------------------------------------------
-- Part 3 · nex.support_admin_grant · opt-in admin access
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.support_admin_grant (
  account_id uuid PRIMARY KEY
    REFERENCES nex_account(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Part 4 · Defence-in-depth grants · REVOKE from anon + authenticated
-- ---------------------------------------------------------------------------

REVOKE ALL ON nex.support_ticket FROM anon, authenticated;
REVOKE ALL ON nex.support_message FROM anon, authenticated;
REVOKE ALL ON nex.support_admin_grant FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Part 5 · Migration history
-- ---------------------------------------------------------------------------

INSERT INTO nex_migration_history (version, description, applied_at)
VALUES ('315', 'nex.support_ticket + support_message + support_admin_grant', now())
ON CONFLICT (version) DO UPDATE
  SET description = EXCLUDED.description,
      applied_at  = EXCLUDED.applied_at;

COMMIT;
