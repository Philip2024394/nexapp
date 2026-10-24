-- ============================================================================
-- NEX-native Migration 224 · Emergency Help · schema (DRAFT · REVIEW ONLY)
-- ============================================================================
--
-- Owner-authorised 2026-10-24 Phase 1 · AUTHOR-ONLY.
--
-- STATUS: AUTHORED FOR REVIEW ONLY · NOT YET APPLIED TO ANY DATABASE.
-- Application to any Supabase project (sandbox or production), including the
-- sealed live NEX project `ijvqdvsvwtwxzcqmoqit`, requires separate explicit
-- owner approval under the Safety Constitution §5 and the sealed Supabase
-- directive §8. Local testing against `localhost:5433/nex_dev` requires owner
-- approval of the test plan.
--
-- CAVEAT ON MIGRATION NUMBER: at the time of authoring, migrations 215-223
-- exist as untracked local files from prior sessions and are not yet on
-- origin/main (last committed = 214). The filename `224_` assumes those nine
-- migrations will land first. If their fate changes, this file must be
-- renumbered to the next free slot before application. Content is otherwise
-- independent of 215-223.
--
-- Depends on (APPLIED):
--   001_nex_migration_history_and_account.sql  (nex_account.id)
--
-- Does NOT depend on 215-223 for content; no FK or data references to those.
--
-- Scope summary:
--   · 7 tables under schema `nex`:
--       emergency_incident               · incident lifecycle (8-state machine)
--       incident_recipient               · fan-out tracking + response status
--       emergency_location_update        · append-only live location pings
--       emergency_responder_optin        · opted-in responder pool
--       trusted_contact                  · Layer-1 pre-selected recipients
--                                          (multi-channel: account | email | phone)
--       emergency_fanout_log             · delivery audit + idempotency
--       emergency_rate_limit             · hourly-bucket abuse protection
--   · Enum CHECK constraints inline on every state/category/channel column.
--   · Partial UNIQUE indexes for multi-channel trusted_contact dedup +
--     fan-out idempotency.
--   · Service-role-only writes via application code · NO RLS policies added
--     in this migration (owner directive · RLS deferred to a separate
--     migration so policy sign-off happens independently of the schema).
--   · Deferred-RLS fail-safe: explicit REVOKE ALL ... FROM anon, authenticated
--     on all 7 tables (Part 8) so PostgREST cannot leak rows via the Supabase
--     SDK if a client-side read is later added without RLS. Service-role
--     connections bypass this and keep working.
--
-- Explicitly NOT in this migration (deferred to later rounds · see audit
-- report):
--   · RLS policies for owner / trusted-contact / responder / service-role.
--   · Response-group chat table (`nex.group_chat.incident_id` FK).
--   · Discreet-mode / child-safety columns on emergency_incident.
--   · Transaction wrapper for incident+recipients+activate (service-layer
--     fix, not a schema fix).
--
-- Rate-limit doctrine (enforced at service layer):
--   · Max 3 concurrent live incidents per user (state IN ('active',
--     'responders_assigned')).
--   · Max 10 incidents per rolling 24h per user (via nex.emergency_rate_limit).
--   · The DB-level UNIQUE constraint for 1-live-per-user is INCLUDED (not
--     commented out) because it costs almost nothing and closes a race.
--
-- Rollback (destructive · safe when no production data exists):
--   BEGIN;
--     DROP TABLE IF EXISTS nex.emergency_fanout_log;
--     DROP TABLE IF EXISTS nex.emergency_rate_limit;
--     DROP TABLE IF EXISTS nex.trusted_contact;
--     DROP TABLE IF EXISTS nex.emergency_responder_optin;
--     DROP TABLE IF EXISTS nex.emergency_location_update;
--     DROP TABLE IF EXISTS nex.incident_recipient;
--     DROP TABLE IF EXISTS nex.emergency_incident;
--   COMMIT;
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Part 1 · nex.emergency_incident · incident lifecycle machine
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.emergency_incident (
  incident_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_account_id       uuid NOT NULL
    REFERENCES nex_account(id) ON DELETE CASCADE,

  -- Sealed state machine. Transitions enforced at service layer in
  -- src/lib/nex-native/emergency/incident-service.ts.
  state                      text NOT NULL
    DEFAULT 'draft'
    CHECK (state IN (
      'draft',
      'pending_confirmation',
      'active',
      'responders_assigned',
      'resolved',
      'cancelled',
      'revoked_within_window',
      'expired'
    )),

  category                   text NOT NULL
    CHECK (category IN (
      'general_assistance',
      'medical_concern',
      'safety_concern',
      'other'
    )),

  -- Location captured at the moment the user tapped Emergency.
  -- IMMUTABLE post-creation per doctrine · later updates land in
  -- nex.emergency_location_update, not here.
  location_lat               numeric
    CHECK (location_lat IS NULL OR (location_lat >= -90  AND location_lat <= 90)),
  location_lng               numeric
    CHECK (location_lng IS NULL OR (location_lng >= -180 AND location_lng <= 180)),
  location_accuracy_meters   numeric
    CHECK (location_accuracy_meters IS NULL OR location_accuracy_meters >= 0),
  location_captured_at       timestamptz,

  -- v1 pilot: every row simulated. Service rejects simulated=false writes.
  simulated                  boolean NOT NULL DEFAULT true,

  -- Lifecycle timestamps.
  created_at                 timestamptz NOT NULL DEFAULT now(),
  activated_at               timestamptz,
  pending_confirmed_at       timestamptz,
  revoked_within_window_at   timestamptz,
  resolved_at                timestamptz,
  cancelled_at               timestamptz,

  -- Auto-sweep boundary. Default to 24 hours from creation so the
  -- service layer does not need to compute this on every INSERT and
  -- so a row created without an explicit value still has a sane
  -- sweep boundary. Service may still override. 24h chosen to match
  -- the typical pilot "incident goes stale within a day" assumption
  -- · if the owner locks a different retention policy later this
  -- default migrates with the policy change.
  expires_at                 timestamptz NOT NULL
    DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_nex_emergency_incident_requester_live
  ON nex.emergency_incident (requester_account_id)
  WHERE state IN ('active', 'responders_assigned');

CREATE INDEX idx_nex_emergency_incident_expires
  ON nex.emergency_incident (expires_at)
  WHERE state IN ('active', 'responders_assigned');

-- Race-protection: one live-or-pending incident per user.
-- Service layer also enforces · DB level is defence in depth.
CREATE UNIQUE INDEX idx_nex_emergency_incident_one_live_per_user
  ON nex.emergency_incident (requester_account_id)
  WHERE state IN ('pending_confirmation', 'active');

COMMENT ON TABLE nex.emergency_incident IS
  'v1 pilot · incident lifecycle (8 states). Location immutable post-creation. '
  'All writes simulated=true. Service layer enforces 3-concurrent / 10-per-24h '
  'rate limits via nex.emergency_rate_limit.';

-- ---------------------------------------------------------------------------
-- Part 2 · nex.incident_recipient · fan-out tracking + response status
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.incident_recipient (
  recipient_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id               uuid NOT NULL
    REFERENCES nex.emergency_incident(incident_id) ON DELETE CASCADE,
  recipient_account_id      uuid NOT NULL
    REFERENCES nex_account(id) ON DELETE CASCADE,

  layer                     text NOT NULL
    CHECK (layer IN ('trusted_contact', 'nearby_opted_in', 'wider_community')),

  -- Haversine distance at resolve-time (L2 responders only · NULL for L1).
  distance_meters           integer,

  notified_at               timestamptz NOT NULL DEFAULT now(),

  response_status           text NOT NULL
    DEFAULT 'pending'
    CHECK (response_status IN ('pending', 'accepted', 'declined', 'withdrawn')),

  responded_at              timestamptz,

  -- Caller-provided ETA on accept · validated at service layer.
  eta_minutes               integer
    CHECK (eta_minutes IS NULL OR (eta_minutes >= 1 AND eta_minutes <= 480))
);

-- Idempotency: writeRecipientRows uses ON CONFLICT (incident_id, recipient_account_id) DO NOTHING.
CREATE UNIQUE INDEX idx_nex_incident_recipient_dedup
  ON nex.incident_recipient (incident_id, recipient_account_id);

CREATE INDEX idx_nex_incident_recipient_status
  ON nex.incident_recipient (incident_id, response_status);

CREATE INDEX idx_nex_incident_recipient_responder
  ON nex.incident_recipient (recipient_account_id, response_status);

COMMENT ON TABLE nex.incident_recipient IS
  'Layer 1-3 recipients for an incident. Idempotent per (incident, recipient). '
  'RLS (future migration) will gate recipient visibility to active incidents '
  'only · pending_confirmation rows are not exposed to responders.';

-- ---------------------------------------------------------------------------
-- Part 3 · nex.emergency_location_update · append-only live pings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.emergency_location_update (
  update_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id               uuid NOT NULL
    REFERENCES nex.emergency_incident(incident_id) ON DELETE CASCADE,

  lat                       numeric NOT NULL
    CHECK (lat >= -90  AND lat <= 90),
  lng                       numeric NOT NULL
    CHECK (lng >= -180 AND lng <= 180),
  accuracy_meters           numeric
    CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0),
  heading_degrees           numeric
    CHECK (heading_degrees IS NULL OR (heading_degrees >= 0 AND heading_degrees <= 360)),
  speed_mps                 numeric
    CHECK (speed_mps IS NULL OR speed_mps >= 0),

  source                    text NOT NULL
    DEFAULT 'browser_watch_position'
    CHECK (source IN (
      'browser_watch_position',
      'manual_pin',
      'service_worker_sync'
    )),

  simulated                 boolean NOT NULL DEFAULT true,

  -- Client-supplied geolocation.timestamp · service enforces 10s min interval.
  captured_at               timestamptz NOT NULL,

  -- Server receipt time.
  received_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nex_emergency_location_update_incident_captured
  ON nex.emergency_location_update (incident_id, captured_at DESC);

COMMENT ON TABLE nex.emergency_location_update IS
  'Append-only location history. Latest ping is mirrored to parent incident '
  'row in the same transaction for cheap "where are they now" reads.';

-- ---------------------------------------------------------------------------
-- Part 4 · nex.emergency_responder_optin · opted-in responder pool
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.emergency_responder_optin (
  account_id                      uuid PRIMARY KEY
    REFERENCES nex_account(id) ON DELETE CASCADE,

  opted_in_at                     timestamptz NOT NULL DEFAULT now(),

  -- Safety guidance acknowledgment · service enforces freshness (<30 days).
  acknowledged_safety_guidance_at timestamptz NOT NULL,

  -- Declared service radius · constrains L2 resolution.
  radius_km                       integer NOT NULL
    CHECK (radius_km >= 1 AND radius_km <= 25),

  simulated                       boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE nex.emergency_responder_optin IS
  'Single row per responder. UPSERT on opt-in · DELETE on opt-out. In v1 '
  'pilot the recipient resolver stubs L2 and never actually queries live '
  'responders · all nearby fan-out stays simulated.';

-- ---------------------------------------------------------------------------
-- Part 5 · nex.trusted_contact · Layer-1 pre-selected recipients (multi-channel)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.trusted_contact (
  trusted_contact_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id          uuid NOT NULL
    REFERENCES nex_account(id) ON DELETE CASCADE,

  -- Multi-channel identifiers · at least one of (account_id, email, phone)
  -- must be non-NULL. Enforced at service layer today; a CHECK constraint
  -- is included below for defence in depth.
  contact_account_id        uuid REFERENCES nex_account(id) ON DELETE SET NULL,
  contact_email             text,
  contact_phone             text,

  added_at                  timestamptz NOT NULL DEFAULT now(),
  contact_label             text
    CHECK (contact_label IS NULL OR length(contact_label) <= 60),

  CONSTRAINT nex_trusted_contact_has_identifier CHECK (
    contact_account_id IS NOT NULL
    OR contact_email IS NOT NULL
    OR contact_phone IS NOT NULL
  )
);

-- Dedup within each identifier channel · partial UNIQUE indexes.
CREATE UNIQUE INDEX idx_nex_trusted_contact_account
  ON nex.trusted_contact (owner_account_id, contact_account_id)
  WHERE contact_account_id IS NOT NULL;

CREATE UNIQUE INDEX idx_nex_trusted_contact_email
  ON nex.trusted_contact (owner_account_id, lower(contact_email))
  WHERE contact_email IS NOT NULL;

CREATE UNIQUE INDEX idx_nex_trusted_contact_phone
  ON nex.trusted_contact (owner_account_id, contact_phone)
  WHERE contact_phone IS NOT NULL;

COMMENT ON TABLE nex.trusted_contact IS
  'Layer-1 recipients pre-selected by the account owner. Multi-channel: at '
  'least one of (account_id | email | phone) required · enforced by '
  'nex_trusted_contact_has_identifier CHECK plus service-layer validation. '
  'Service stores lowercased email + normalized phone (digits + leading +).';

-- ---------------------------------------------------------------------------
-- Part 6 · nex.emergency_fanout_log · delivery audit + idempotency
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.emergency_fanout_log (
  log_id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id               uuid NOT NULL
    REFERENCES nex.emergency_incident(incident_id) ON DELETE CASCADE,

  transition                text NOT NULL
    CHECK (transition IN (
      'pending_confirmation',
      'active',
      'revoked_within_window',
      'cancelled',
      'resolved'
    )),

  channel                   text NOT NULL
    CHECK (channel IN ('email', 'sms', 'whatsapp', 'in_app')),

  -- Opaque recipient identifier · hashed PII:
  --   account:<uuid>
  --   email:<sha256-hex-16>
  --   phone:<sha256-hex-16>
  recipient_identifier      text NOT NULL,

  outcome                   text NOT NULL
    CHECK (outcome IN (
      'ok',
      'skipped',
      'honest_blocked',
      'rate_limited',
      'provider_error'
    )),

  reason                    text,

  -- SHA-256 of (incident_id || transition || channel || recipient_identifier).
  idempotency_key           text NOT NULL,

  simulated                 boolean NOT NULL DEFAULT true,

  attempted_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_nex_emergency_fanout_log_idempotency
  ON nex.emergency_fanout_log (idempotency_key);

CREATE INDEX idx_nex_emergency_fanout_log_incident
  ON nex.emergency_fanout_log (incident_id, attempted_at DESC);

CREATE INDEX idx_nex_emergency_fanout_log_failures
  ON nex.emergency_fanout_log (incident_id)
  WHERE outcome != 'ok';

COMMENT ON TABLE nex.emergency_fanout_log IS
  'Service-role-only audit log. Records every fan-out ATTEMPT with opaque '
  'recipient identifiers (no raw PII). Idempotency enforced at DB layer. '
  'In v1 pilot all rows carry simulated=true and the fan-out hook is a no-op.';

-- ---------------------------------------------------------------------------
-- Part 7 · nex.emergency_rate_limit · hourly bucket (10/24h · 3 concurrent)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex.emergency_rate_limit (
  account_id                uuid NOT NULL
    REFERENCES nex_account(id) ON DELETE CASCADE,
  -- UTC hour boundary · date_trunc('hour', now())
  window_start              timestamptz NOT NULL,
  count                     integer NOT NULL DEFAULT 1
    CHECK (count > 0),

  PRIMARY KEY (account_id, window_start)
);

CREATE INDEX idx_nex_emergency_rate_limit_rolling_24h
  ON nex.emergency_rate_limit (account_id, window_start DESC);

COMMENT ON TABLE nex.emergency_rate_limit IS
  'Hourly bucket rate limiting (10 incidents per rolling 24h, 3 concurrent). '
  'window_start truncated to UTC hour. Upsert pattern: INSERT + ON CONFLICT '
  'DO UPDATE count = count + 1. Service may cron-sweep stale buckets.';

-- ---------------------------------------------------------------------------
-- Part 8 · Deferred-RLS fail-safe · REVOKE direct Supabase client access
-- ---------------------------------------------------------------------------
--
-- Owner-authorised 2026-10-24 · Row-Level Security policies are deferred to
-- a separate migration so policy review can happen independently of the
-- schema. In the interim, Supabase's PostgREST auto-exposes any table that
-- has GRANT to the `anon` or `authenticated` roles. These REVOKE statements
-- are a defence-in-depth fail-safe: even if someone later adds a direct
-- Supabase SDK client read, PostgREST will return `permission denied` instead
-- of leaking rows.
--
-- The application service-role connection (via the pooler using the sealed
-- `NEX_SUPABASE_SERVICE_ROLE_KEY`) bypasses GRANT/REVOKE in Supabase, so all
-- current server-side service functions in `src/lib/nex-native/emergency/*`
-- continue to work.
--
-- When RLS policies land in a future migration, these REVOKEs stay (RLS +
-- deny-GRANT is a correct layered pattern).

REVOKE ALL ON nex.emergency_incident           FROM anon, authenticated;
REVOKE ALL ON nex.incident_recipient           FROM anon, authenticated;
REVOKE ALL ON nex.emergency_location_update    FROM anon, authenticated;
REVOKE ALL ON nex.emergency_responder_optin    FROM anon, authenticated;
REVOKE ALL ON nex.trusted_contact              FROM anon, authenticated;
REVOKE ALL ON nex.emergency_fanout_log         FROM anon, authenticated;
REVOKE ALL ON nex.emergency_rate_limit         FROM anon, authenticated;

COMMIT;
