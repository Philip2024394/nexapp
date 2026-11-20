-- =============================================================================
-- Migration 352 · nex_prelaunch_signup · launch-notification email list
-- STATUS: AUTHORISED FOR SANDBOX APPLY · founder handoff (host IPv6-only blocker)
-- Target: sandbox kdstoyyeygcopkogqsyv ONLY
-- Prod ijvqdvsvwtwxzcqmoqit remains sealed · no production apply authorised
-- Authored 2026-11-18 for the Nexcorner prelaunch landing.
-- Promoted (filename stripped of _PROPOSAL suffix) 2026-11-20 per owner
-- authorisation "apply mig-352 prelaunch sandbox". Apply-script lives at
-- scripts/apply-migration-352-sandbox.mjs.
-- =============================================================================
--
-- CONTEXT
-- The public Nexcorner prelaunch page (§1 of the 2026-11-18 prompt) captures
-- "notify me at launch" email submissions. The service-side wrapper lives at
-- `src/lib/nex-native/prelaunch/signup-service.ts` and its envelope is defined
-- so that unapplied-migration is treated as a honest BLOCKED state at the UI
-- boundary, not silently discarded.
--
-- This migration CREATES that table. It is a PROPOSAL — the signup-service
-- was written to fail-closed on 42P01 (undefined_table) so the site may run
-- against the current (unmigrated) sandbox without silently losing data.
--
-- DESIGN
--   · `email_normalised` is the single source of truth. Normalisation is
--     client-side-plus-server-side (`email-normalise.ts`): trimmed, lower-
--     cased, RFC §4.5.3.1 length bounds (254 total, 64 local).
--   · UNIQUE on `email_normalised` enforces idempotent re-submits. The
--     service-side wrapper maps 23505 back to `{ok:true,state:"already_
--     registered"}` so the attacker cannot probe list membership through
--     error messages.
--   · `email_hash` is SHA-256 of the normalised address, persisted for
--     diagnostic/log analysis WITHOUT ever logging the raw email.
--   · `source` is a constrained enum via CHECK (not a Postgres enum type
--     to keep ALTER cheap); only one value is accepted today.
--   · `consent_version` records which consent copy the subscriber saw.
--     Changing the launch-notification copy means bumping the version so
--     future outreach can respect only the subscribers who agreed to the
--     current text.
--   · `user_agent` and `ip_hash` are OPTIONAL · short · bounded. We do NOT
--     persist the raw IP — only a hash the caller may generate for abuse
--     analysis. If a caller does not supply either, NULL is stored.
--   · No `unsubscribed_at` column in v1. Any unsubscribe requires a design
--     conversation (who holds the link, where it routes, how to reconcile
--     with Resend-side list state) that is explicitly out-of-scope today.
--
-- RLS
--   · Table is strict-INSERT only, through the service-role admin client.
--     RLS stays ON with NO policies granted to `authenticated` or `anon`.
--     This means no anon/authenticated SELECT · no anon/authenticated INSERT.
--     The server action at `/api/nex-native/prelaunch/notify` uses
--     `nexSupabaseAdmin` (service role, bypasses RLS by design).
--
-- ROLLBACK · see 352_..._rollback.sql · DROP TABLE CASCADE.
--
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.nex_prelaunch_signup (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalised  text        NOT NULL,
  email_hash        text        NOT NULL,
  source            text        NOT NULL,
  consent_version   text        NOT NULL,
  user_agent        text        NULL,
  ip_hash           text        NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT nex_prelaunch_signup_email_len
    CHECK (char_length(email_normalised) BETWEEN 3 AND 254),
  CONSTRAINT nex_prelaunch_signup_hash_shape
    CHECK (char_length(email_hash) = 64),
  CONSTRAINT nex_prelaunch_signup_source_allowed
    CHECK (source IN ('nexcorner_landing_v1')),
  CONSTRAINT nex_prelaunch_signup_consent_shape
    CHECK (char_length(consent_version) BETWEEN 1 AND 128),
  CONSTRAINT nex_prelaunch_signup_user_agent_len
    CHECK (user_agent IS NULL OR char_length(user_agent) <= 512),
  CONSTRAINT nex_prelaunch_signup_ip_hash_len
    CHECK (ip_hash IS NULL OR char_length(ip_hash) <= 128)
);

-- Unique on normalised email · the dedup key. Idempotent re-submits land
-- on 23505 which the service wrapper hides as "already_registered".
CREATE UNIQUE INDEX IF NOT EXISTS nex_prelaunch_signup_email_normalised_uq
  ON public.nex_prelaunch_signup (email_normalised);

-- Helpful ordering index for any future analytics on when the list grew.
CREATE INDEX IF NOT EXISTS nex_prelaunch_signup_created_at_idx
  ON public.nex_prelaunch_signup (created_at DESC);

-- RLS is enabled with NO policies · service role writes only.
ALTER TABLE public.nex_prelaunch_signup ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.nex_prelaunch_signup IS
  'NEX Nexcorner prelaunch · launch-notification signups. Service-role '
  'INSERT only. RLS enabled with no policies. See '
  'src/lib/nex-native/prelaunch/signup-service.ts.';

COMMENT ON COLUMN public.nex_prelaunch_signup.email_normalised IS
  'Trimmed, lowercased, RFC-bounded email. UNIQUE. The dedup key.';
COMMENT ON COLUMN public.nex_prelaunch_signup.email_hash IS
  'SHA-256 hex of email_normalised. For log diagnostics without echoing raw.';
COMMENT ON COLUMN public.nex_prelaunch_signup.source IS
  'Which signup surface accepted the submission (constrained enum).';
COMMENT ON COLUMN public.nex_prelaunch_signup.consent_version IS
  'The consent-text version shown to the subscriber at submission time.';
COMMENT ON COLUMN public.nex_prelaunch_signup.ip_hash IS
  'Optional caller-supplied hash of the submitter IP. Raw IP is NEVER stored.';
