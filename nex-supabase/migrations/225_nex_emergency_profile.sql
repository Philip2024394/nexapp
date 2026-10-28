-- 225_nex_emergency_profile.sql
--
-- NEX Emergency Help · Guardian-owned Emergency Identity Profile.
-- DRAFT ONLY · 2026-10-25 · NOT APPLIED TO ANY DATABASE.
--
-- Owner-sealed decisions reflected in this schema:
--   #1 Account model          : Model A · guardian-owned child profile · child has no nex_account row
--   #2 Minimum eligible age   : 7 (enforced server-side; this schema stores DOB · age gate is in code)
--   #3 Child documents        : akta kelahiran + guardian KTP + guardian-captured child reference photo
--   #4 Guardian verification  : document + liveness via provider + digitally-signed consent · re-consent every 12mo
--   #6 Retention              : minor data tighter · face templates 0-day · audit log 36mo compliance-locked
--   #7 Security               : AES-256-GCM app-layer · external KMS · 3-tier disclosure scope · 6-pt gate · atomic audit
--
-- EXPLICIT NON-GOALS of this schema:
--   · No plaintext PII columns · all identity bytes are encrypted at the application layer BEFORE insert
--   · No face-template columns · templates are never retained (0-day retention per Decision #6)
--   · No notification-fanout tables · that's a separate migration when the provider is chosen
--   · No incident / recipient tables · those live in draft migration 224 (also not applied)
--
-- APPLY-TIME NOTES (for the future authorizer):
--   · Requires NO new Postgres extensions · pgsodium NOT required (encryption is app-layer per Decision #7)
--   · Requires creation of Supabase Storage bucket `emergency-identity` as service-role-only (NOT in this file)
--   · All retention / deletion jobs are enforced by server code · this schema stores retention markers
--   · All reads from these tables go through the disclosure gate server function · RLS below is defence-in-depth
--
-- Rollback limitations:
--   · Dropping these tables is destructive · a compliance-retained audit log is per Decision #6 and
--     MUST survive table drops. If a rollback is required, back the audit log up externally first.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- Schema · namespace all emergency primitives under `nex`
-- (same convention as migration 224).
-- ─────────────────────────────────────────────────────────────────────────

-- Schema is already created in migration 224; CREATE IF NOT EXISTS is
-- a no-op defensively (future-reorder-safe).
CREATE SCHEMA IF NOT EXISTS nex;

-- ─────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────

-- Verification state machine · the Emergency Profile's lifecycle.
-- The sealed VerificationStatusCard renders the matching five states.
DO $$ BEGIN
  CREATE TYPE nex.emergency_profile_verification_state AS ENUM (
    'not_started',       -- draft row exists but no submission
    'in_progress',       -- user is editing · no submission
    'pending_review',    -- submitted · awaiting provider or human review
    'verified',          -- provider returned a pass + consent captured + guardian link active
    'rejected',          -- provider returned a fail or consent not captured
    'expired'            -- past verification validity · re-verification required
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Document type · reflects Decision #3 (adult) + Decision #3 (minor via Combo D).
DO $$ BEGIN
  CREATE TYPE nex.emergency_profile_document_type AS ENUM (
    'passport',                   -- Indonesian Paspor
    'national_id',                -- Indonesian KTP / e-KTP (adult)
    'driving_licence',            -- Indonesian SIM (adult)
    'birth_certificate',          -- Indonesian Akta Kelahiran (minor primary ID)
    'guardian_captured_photo'     -- Minor's current face · guardian-provided reference · NOT independently verified
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Disclosure scope · sealed Decision #7 three-tier model.
DO $$ BEGIN
  CREATE TYPE nex.emergency_profile_disclosure_scope AS ENUM (
    'public_alert',       -- general-area opt-in responder · minimal payload
    'near_responder',     -- committed responder within 2km · + face + first name
    'trusted'             -- on viewer's own trusted-contact list · full profile
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Audit event kind · every read / write / state transition that touches
-- the Emergency Profile emits exactly one of these.
DO $$ BEGIN
  CREATE TYPE nex.emergency_profile_audit_kind AS ENUM (
    'created',
    'updated',
    'submitted',
    'verified',
    'rejected',
    'expired',
    'read_disclosed',           -- a disclosure read fired (scoped-release)
    'read_denied',              -- a disclosure read was refused by the gate
    'deleted',
    'guardian_consent_signed',
    'guardian_consent_revoked'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Table · nex.emergency_profile
--
-- One row per nex_account that has started an Emergency Profile. For
-- Model A (sealed Decision #1), a guardian may own zero or more
-- rows via the `nex.guardian_managed_child` table that references
-- back here. A child's own emergency_profile row exists but has
-- `is_guardian_managed = true` and NO auth linkage; the guardian
-- row is the operator.
--
-- Encryption: every column labelled `encrypted_` is populated with
-- AES-256-GCM ciphertext from the app layer. The `key_version`
-- column is the KMS key generation that encrypted this row's data.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.emergency_profile (
  -- Identity
  account_id                      uuid        PRIMARY KEY REFERENCES public.nex_account(id) ON DELETE RESTRICT,
  -- `is_guardian_managed` distinguishes a Model-A sub-identity (child)
  -- from a guardian / self-managed adult. When true, the matching
  -- row in `nex.guardian_managed_child` must exist, OR the row is
  -- half-populated and the profile is not yet valid.
  is_guardian_managed             boolean     NOT NULL DEFAULT false,

  -- Verification lifecycle
  verification_state              nex.emergency_profile_verification_state NOT NULL DEFAULT 'not_started',
  verification_submitted_at       timestamptz,
  verification_result_at          timestamptz,
  verification_rejection_reason   text,
  verification_expires_at         timestamptz,   -- re-verification required when passed · Decision #4 · default 12mo

  -- Encrypted PII · ciphertext bytea + key_version
  encrypted_full_name             bytea,
  encrypted_dob                   bytea,
  encrypted_sex                   bytea,
  encrypted_address               bytea,
  encrypted_mobile                bytea,
  pii_key_version                 int,

  -- Guardian authorization (minor profiles only)
  guardian_account_id             uuid        REFERENCES public.nex_account(id) ON DELETE RESTRICT,
  guardian_consent_signed_at      timestamptz,
  guardian_consent_version        text,                            -- version of the sealed consent text at signing
  guardian_consent_signature      bytea,                           -- encrypted signature + evidence bundle (device · ip · timestamp)
  guardian_consent_signature_key_version int,

  -- Age gate (server-enforced · see Decision #2)
  -- `dob_age_years_at_submission` is the computed age at the moment
  -- the row was last submitted. The server rejects submissions where
  -- age_years_at_submission < 7 AND !is_guardian_managed.
  dob_age_years_at_submission     smallint,

  -- Retention markers (sealed Decision #6)
  retain_until                    timestamptz NOT NULL DEFAULT (now() + interval '12 months'),
  retain_grace_until              timestamptz,                     -- set when user requests deletion · 30 day grace
  deleted_at                      timestamptz,                     -- soft-delete marker
  deleted_cascaded_from_guardian  boolean     NOT NULL DEFAULT false,

  -- Housekeeping
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  updated_by_account_id           uuid        REFERENCES public.nex_account(id),

  -- Invariants
  CONSTRAINT emergency_profile_guardian_present_for_minor CHECK (
    NOT is_guardian_managed OR guardian_account_id IS NOT NULL
  ),
  CONSTRAINT emergency_profile_guardian_differs_from_child CHECK (
    guardian_account_id IS NULL OR guardian_account_id <> account_id
  ),
  CONSTRAINT emergency_profile_consent_version_present_when_signed CHECK (
    (guardian_consent_signed_at IS NULL) OR
    (guardian_consent_version IS NOT NULL AND guardian_consent_signature IS NOT NULL)
  ),
  CONSTRAINT emergency_profile_key_versions_coherent CHECK (
    (encrypted_full_name IS NULL AND pii_key_version IS NULL) OR
    (encrypted_full_name IS NOT NULL AND pii_key_version IS NOT NULL)
  )
);

COMMENT ON TABLE nex.emergency_profile IS
  'Emergency Help identity profile · one row per account. Model A guardian-owned child flow via is_guardian_managed=true + guardian_account_id FK. All PII columns are AES-256-GCM app-layer-encrypted (not pgsodium). Reads MUST go through the disclosure gate server function.';

CREATE INDEX IF NOT EXISTS emergency_profile_guardian_idx
  ON nex.emergency_profile(guardian_account_id)
  WHERE is_guardian_managed = true;

CREATE INDEX IF NOT EXISTS emergency_profile_retention_idx
  ON nex.emergency_profile(retain_until)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS emergency_profile_deletion_grace_idx
  ON nex.emergency_profile(retain_grace_until)
  WHERE deleted_at IS NULL AND retain_grace_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS emergency_profile_verification_state_idx
  ON nex.emergency_profile(verification_state)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- Table · nex.guardian_managed_child
--
-- Model A primitive: ties a child profile to its guardian. One row
-- per child. Separate from `emergency_profile` so the guardian ↔
-- child linkage can carry its own lifecycle (consent revocation,
-- re-consent, graduation at age 18) independently of profile state.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.guardian_managed_child (
  child_account_id      uuid        PRIMARY KEY REFERENCES public.nex_account(id) ON DELETE RESTRICT,
  guardian_account_id   uuid        NOT NULL REFERENCES public.nex_account(id) ON DELETE RESTRICT,

  -- Consent lifecycle (sealed Decision #4)
  consent_signed_at     timestamptz NOT NULL,
  consent_version       text        NOT NULL,
  consent_expires_at    timestamptz NOT NULL,  -- 12 months post-signing by default
  consent_revoked_at    timestamptz,

  -- Encrypted guardian-captured reference photo pointer (per Decision #3)
  -- Points at a row in `nex.emergency_profile_document`.
  reference_photo_document_id   uuid REFERENCES nex.emergency_profile_document(document_id) ON DELETE SET NULL,

  -- Housekeeping
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT guardian_managed_child_different_accounts CHECK (child_account_id <> guardian_account_id),
  CONSTRAINT guardian_managed_child_consent_lifecycle CHECK (
    consent_expires_at > consent_signed_at AND
    (consent_revoked_at IS NULL OR consent_revoked_at >= consent_signed_at)
  )
);

COMMENT ON TABLE nex.guardian_managed_child IS
  'Model A link row · ties a child emergency profile to its guardian. One child_account_id → exactly one guardian. Consent is explicitly versioned, time-bound, revocable. Graduation to independent adult account is a separate operation that archives this row.';

CREATE INDEX IF NOT EXISTS guardian_managed_child_guardian_idx
  ON nex.guardian_managed_child(guardian_account_id);

CREATE INDEX IF NOT EXISTS guardian_managed_child_consent_expiry_idx
  ON nex.guardian_managed_child(consent_expires_at)
  WHERE consent_revoked_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- Table · nex.emergency_profile_document
--
-- Pointers to files stored in Supabase Storage bucket `emergency-identity`.
-- The file bytes themselves live in Storage (private bucket, service-role
-- only). This table carries the pointer + metadata + verification result.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.emergency_profile_document (
  document_id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner of the document · may be the account under verification, or
  -- a guardian uploading on behalf of a child.
  owner_account_id         uuid        NOT NULL REFERENCES public.nex_account(id) ON DELETE RESTRICT,

  -- Which profile this document attests to.
  profile_account_id       uuid        NOT NULL REFERENCES nex.emergency_profile(account_id) ON DELETE RESTRICT,

  document_type            nex.emergency_profile_document_type NOT NULL,

  -- Storage pointer · Supabase Storage path. Bucket `emergency-identity`.
  storage_bucket           text        NOT NULL,
  storage_path             text        NOT NULL,
  sha256_hex               text        NOT NULL,                   -- integrity hash of the raw bytes

  -- Verification result from provider (Decision #5 provider is open ·
  -- schema is provider-agnostic). `provider_name` identifies which
  -- adapter wrote this result; null means not yet verified.
  provider_name            text,
  provider_verification_id text,
  verification_result      jsonb,                                   -- opaque provider response · may contain explain-fields
  verification_passed      boolean,
  verified_at              timestamptz,

  -- Retention markers · sealed Decision #6
  -- Child documents on tighter schedule (6mo); guardian documents longer (12mo).
  retain_until             timestamptz NOT NULL,

  -- Housekeeping
  uploaded_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz,

  CONSTRAINT emergency_profile_document_storage_pair CHECK (
    length(storage_bucket) > 0 AND length(storage_path) > 0
  ),
  CONSTRAINT emergency_profile_document_sha256_shape CHECK (
    sha256_hex ~ '^[a-f0-9]{64}$'
  )
);

COMMENT ON TABLE nex.emergency_profile_document IS
  'Pointer rows for identity documents (akta kelahiran / KTP / Paspor / SIM / guardian-captured child photo). Bytes live in a private Supabase Storage bucket · access via signed URLs only. verification_result is provider-agnostic jsonb; the chosen provider adapter populates it.';

CREATE UNIQUE INDEX IF NOT EXISTS emergency_profile_document_storage_path_uq
  ON nex.emergency_profile_document(storage_bucket, storage_path);

CREATE INDEX IF NOT EXISTS emergency_profile_document_profile_idx
  ON nex.emergency_profile_document(profile_account_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS emergency_profile_document_retention_idx
  ON nex.emergency_profile_document(retain_until)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- Table · nex.emergency_profile_disclosure_event
--
-- Append-only audit log of every disclosure read + every refused
-- disclosure attempt. Enforces the sealed six-point disclosure gate.
-- Retention: 36 months compliance-locked (user cannot shorten).
-- Writes are atomic with the read they describe · a failed audit
-- insert MUST fail the read (fail-closed).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.emergency_profile_disclosure_event (
  event_id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  profile_account_id    uuid        NOT NULL REFERENCES nex.emergency_profile(account_id) ON DELETE RESTRICT,
  reader_account_id     uuid        NOT NULL REFERENCES public.nex_account(id) ON DELETE RESTRICT,
  incident_id           uuid,                                     -- FK to nex.emergency_incident · may be null for admin reads

  kind                  nex.emergency_profile_audit_kind NOT NULL,
  scope                 nex.emergency_profile_disclosure_scope,   -- which scope was requested
  granted               boolean     NOT NULL,                     -- true if the gate allowed · false if refused
  reason                text,                                     -- human-readable refusal reason (never includes PII)

  -- Preconditions log · for every one of the six checks the gate ran,
  -- was it satisfied? Supports post-hoc audit without storing PII.
  precondition_summary  jsonb       NOT NULL,

  -- Session metadata
  reader_ip             inet,
  reader_user_agent     text,
  rate_limit_counter    int,                                      -- which read in the per-hour window this was

  occurred_at           timestamptz NOT NULL DEFAULT now(),

  -- Retention is 36mo compliance-locked (sealed Decision #6).
  -- No row-level retention marker · global job purges based on
  -- occurred_at + interval '36 months'.

  CONSTRAINT disclosure_event_refusal_has_reason CHECK (
    granted = true OR reason IS NOT NULL
  )
);

COMMENT ON TABLE nex.emergency_profile_disclosure_event IS
  'Append-only audit of every disclosure read + refusal. Retention 36 months compliance-locked. Insert MUST succeed within the same transaction as the matching data read · failed audit insert fails the read (fail-closed).';

CREATE INDEX IF NOT EXISTS disclosure_event_profile_time_idx
  ON nex.emergency_profile_disclosure_event(profile_account_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS disclosure_event_reader_time_idx
  ON nex.emergency_profile_disclosure_event(reader_account_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS disclosure_event_incident_idx
  ON nex.emergency_profile_disclosure_event(incident_id)
  WHERE incident_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- Table · nex.emergency_profile_rate_limit
--
-- Per-reader-per-profile-per-hour rate limiter · sealed Decision #7
-- enforces 20 reads/profile/caller/hour. The disclosure gate uses
-- this table for the counter and resets the window hourly.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.emergency_profile_rate_limit (
  reader_account_id    uuid        NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  profile_account_id   uuid        NOT NULL REFERENCES nex.emergency_profile(account_id) ON DELETE CASCADE,
  window_start         timestamptz NOT NULL,                      -- rounded to hour boundary
  read_count           int         NOT NULL DEFAULT 0,

  PRIMARY KEY (reader_account_id, profile_account_id, window_start),
  CONSTRAINT emergency_profile_rate_limit_count_bounded CHECK (read_count >= 0 AND read_count <= 10000)
);

COMMENT ON TABLE nex.emergency_profile_rate_limit IS
  'Per-reader-per-profile-per-hour disclosure rate limiter. The disclosure gate increments read_count atomically; when it exceeds 20 (sealed Decision #7), the read is refused and an audit event is logged with kind=read_denied.';

CREATE INDEX IF NOT EXISTS emergency_profile_rate_limit_window_idx
  ON nex.emergency_profile_rate_limit(window_start);

-- ─────────────────────────────────────────────────────────────────────────
-- Row-level security (defence in depth; disclosure gate is the primary enforcer)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE nex.emergency_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.guardian_managed_child ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.emergency_profile_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.emergency_profile_disclosure_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.emergency_profile_rate_limit ENABLE ROW LEVEL SECURITY;

-- The default · deny all. Reads/writes go through server-side service-role
-- paths (the disclosure gate + the save/submit server actions).
-- No permissive policies are added by this migration · if anon or
-- authenticated roles need read access to any of these tables, that is
-- a separate authorised migration.

REVOKE ALL ON nex.emergency_profile FROM anon, authenticated;
REVOKE ALL ON nex.guardian_managed_child FROM anon, authenticated;
REVOKE ALL ON nex.emergency_profile_document FROM anon, authenticated;
REVOKE ALL ON nex.emergency_profile_disclosure_event FROM anon, authenticated;
REVOKE ALL ON nex.emergency_profile_rate_limit FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Trigger · auto-update updated_at
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION nex.emergency_profile_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SET search_path = pg_catalog, nex, public;

DROP TRIGGER IF EXISTS emergency_profile_touch_updated_at ON nex.emergency_profile;
CREATE TRIGGER emergency_profile_touch_updated_at
  BEFORE UPDATE ON nex.emergency_profile
  FOR EACH ROW
  EXECUTE FUNCTION nex.emergency_profile_touch_updated_at();

DROP TRIGGER IF EXISTS guardian_managed_child_touch_updated_at ON nex.guardian_managed_child;
CREATE TRIGGER guardian_managed_child_touch_updated_at
  BEFORE UPDATE ON nex.guardian_managed_child
  FOR EACH ROW
  EXECUTE FUNCTION nex.emergency_profile_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Flagged for schema reviewers · residual risks that this file alone
-- cannot resolve:
--
--   R1 · pg_cron (or equivalent scheduler) is required to actually
--        run the retention / deletion job. Not in this migration ·
--        separate authorisation per Safety Constitution §3.
--
--   R2 · The Supabase Storage bucket `emergency-identity` must be
--        created with service-role-only policy. Not in this file ·
--        bucket creation is a Supabase-dashboard action, not SQL.
--
--   R3 · KMS region, key alias, and credentials are environment
--        config · not schema. Decision #7 held open on region
--        pending Persona processing-location response.
--
--   R4 · The sealed six-point disclosure gate is a server function
--        in TypeScript (not a SQL function) · see
--        src/lib/nex-native/emergency/_disclosure-gate.ts.
--
--   R5 · If pgsodium is adopted later for column crypto, this schema
--        needs new encrypted-column variants · the current
--        bytea-plus-key_version shape is app-layer-AES-GCM only.
--
--   R6 · Legal counsel review of UU PDP + PP 71/2019 applicability
--        is required before any real-user traffic hits these tables ·
--        sealed qualification 2026-10-25.
-- ─────────────────────────────────────────────────────────────────────────

COMMIT;
