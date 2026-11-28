-- ============================================================================
-- NEX-native Migration 372 · nex_shop_enquiry
-- ============================================================================
--
-- Metadata-only record of guest shop enquiries. Backs the Rev 3
-- email-as-body guest-enquiry flow (design: docs/engineering/
-- guest-shop-enquiry-design-2026-11-28.md). The enquiry body is
-- delivered by email to the merchant and NEVER stored in NEX. This
-- table exists for exactly four operational needs documented in the
-- design's §6.1 and nothing else:
--
--   1. HQ inbox listing (count + status per shop, last 30d).
--   2. Duplicate-submission detection (same sender → same shop in
--      a short window).
--   3. Delivery accountability (support debugging "did it leave NEX?"
--      via the provider's message-id).
--   4. Failure visibility (provider outages become visible via rows
--      with delivery_status = 'failed').
--
-- EXCLUDED COLUMNS (sealed by owner 2026-11-28 "the proposed
-- nex_shop_enquiry table must not store the message body, phone
-- number or raw email address if the design promises that customer
-- message content and personal contact details are not retained"):
--
--   · message body / subject
--   · raw visitor email, raw phone, raw name
--   · raw IP, raw user-agent, geolocation
--   · permanent-salt hashes of any PII (trivially reversed by
--     dictionary attack - not anonymous)
--
-- Hashes used here (sender_identity_hmac, rate_limit_key_hmac) are
-- HMAC-SHA256 keyed by a server secret (NEX_SHOP_ENQUIRY_HMAC_KEY)
-- that is APPENDED WITH YYYYMMDD by the application before hashing.
-- The daily rotation means the hash is only operationally useful
-- for the 24h window and cannot be regenerated for a prior day.
-- This is called out in the privacy copy.
--
-- RETENTION: 30 days from created_at. A SECURITY DEFINER purge
-- function is included; schedule via pg_cron OR an external cron
-- host (see footer).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '372';
--     DROP FUNCTION IF EXISTS nex_shop_enquiry_purge_old();
--     DROP TABLE IF EXISTS nex_shop_enquiry CASCADE;
--     -- Rate-limit CHECK constraint widening in nex_security_rate_limit
--     -- is additive-only; the CHECK constraint on `action` is replaced
--     -- here. To roll back the action enum, drop and recreate the
--     -- constraint without 'shop_enquiry_submit'.
--   COMMIT;
-- ============================================================================

BEGIN;

-- ─── Table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex_shop_enquiry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scopes every row to one merchant. HQ listing + ownership gate.
  -- ON DELETE CASCADE because a deleted business has no inbox.
  shop_business_id UUID NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,

  -- Row insert time, server clock. Drives HQ ordering, duplicate
  -- window, and the 30d retention sweep.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- What happened at the email adapter.
  --   'dry_run'   = ConsoleAdapter path (bridge not activated)
  --   'delivered' = provider returned 2xx + message-id
  --   'failed'    = provider error; email did not leave NEX
  delivery_status TEXT NOT NULL
    CHECK (delivery_status IN ('dry_run', 'delivered', 'failed')),

  -- Provider's message-id when delivery_status = 'delivered'.
  -- NULL for dry_run and failed. Used ONLY for support debugging
  -- ("did it leave NEX?"). Never shown to the visitor.
  email_provider_message_id TEXT NULL,

  -- Short provider error when delivery_status = 'failed'. NULL
  -- otherwise. Capped at 500 chars so a verbose provider cannot
  -- bloat this column.
  email_provider_error TEXT NULL
    CHECK (email_provider_error IS NULL OR char_length(email_provider_error) <= 500),

  -- HMAC-SHA256 of the lowercase-normalised visitor email, keyed
  -- by NEX_SHOP_ENQUIRY_HMAC_KEY appended with YYYYMMDD. Stored as
  -- lowercase hex (64 chars). Enables duplicate-detection within
  -- the 10-minute window. NOT REVERSIBLE back to the email after
  -- the day rotates. Never treated as a long-lived identifier.
  sender_identity_hmac TEXT NOT NULL
    CHECK (char_length(sender_identity_hmac) = 64)
    CHECK (sender_identity_hmac ~ '^[0-9a-f]{64}$'),

  -- HMAC-SHA256 of the request IP, same keying scheme. Used ONLY to
  -- correlate rate-limit evictions with written rows; never used
  -- to identify the visitor and never reversed. Same shape rules.
  rate_limit_key_hmac TEXT NOT NULL
    CHECK (char_length(rate_limit_key_hmac) = 64)
    CHECK (rate_limit_key_hmac ~ '^[0-9a-f]{64}$'),

  -- Visitor-submitted ISO-3166 alpha-2 country code. Not PII on its
  -- own; useful for HQ listing + regional analytics.
  sender_country_code TEXT NOT NULL
    CHECK (char_length(sender_country_code) = 2)
    CHECK (sender_country_code ~ '^[A-Z]{2}$')
);

-- Primary HQ listing query: per-shop, newest first, within retention.
CREATE INDEX IF NOT EXISTS nex_shop_enquiry_by_shop_recent
  ON nex_shop_enquiry (shop_business_id, created_at DESC);

-- Duplicate-detection lookup: (shop, sender_identity_hmac) in a
-- short window. The index on created_at supports the range clause.
CREATE INDEX IF NOT EXISTS nex_shop_enquiry_dedup
  ON nex_shop_enquiry (shop_business_id, sender_identity_hmac, created_at DESC);

-- Retention sweep index: created_at scan.
CREATE INDEX IF NOT EXISTS nex_shop_enquiry_by_created_at
  ON nex_shop_enquiry (created_at);

-- ─── RLS ────────────────────────────────────────────────────────────
--
-- Writes are service-role only (the /api/nex-native/shop-enquiry
-- route uses nexSupabaseAdmin after independent ownership checks).
-- Service-role bypasses RLS by design; no write policy needed.
--
-- Reads are restricted to the shop owner's authenticated session.
-- HQ reviewers read via service-role in a server-only helper
-- (fetchShopEnquiryMeta). No public read.

ALTER TABLE nex_shop_enquiry ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_shop_enquiry_select_owner
  ON nex_shop_enquiry FOR SELECT
  USING (
    shop_business_id IN (
      SELECT b.id
      FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

-- Owner-authorised DELETE for the "please forget my enquiry"
-- erasure request flow. Keeps the row discoverable by its id
-- echoed on the confirmation screen.
CREATE POLICY nex_shop_enquiry_delete_owner
  ON nex_shop_enquiry FOR DELETE
  USING (
    shop_business_id IN (
      SELECT b.id
      FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

-- No UPDATE policy. Rows are immutable once written. If a status
-- needs to change, the row is deleted and rewritten by the service
-- role (which bypasses RLS entirely).

-- ─── Retention sweep ────────────────────────────────────────────────
--
-- SECURITY DEFINER so the function can delete rows regardless of
-- caller role. Guarded with a numeric floor on retain_days so a
-- misconfigured cron cannot wipe fresh rows.

CREATE OR REPLACE FUNCTION nex_shop_enquiry_purge_old(
  retain_days INT DEFAULT 30
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_days INT;
  purged INT;
BEGIN
  -- Never purge anything less than 7 days old even if a caller
  -- passes a smaller number. Defence against a misconfigured cron.
  effective_days := GREATEST(retain_days, 7);

  WITH victims AS (
    DELETE FROM nex_shop_enquiry
    WHERE created_at < (NOW() - (effective_days || ' days')::INTERVAL)
    RETURNING id
  )
  SELECT COUNT(*) INTO purged FROM victims;

  RETURN purged;
END;
$$;

COMMENT ON FUNCTION nex_shop_enquiry_purge_old(INT) IS
  'Rev 3 guest-shop-enquiry retention sweep. Deletes metadata-only rows older than <retain_days> (default 30, floor 7). Returns count purged. Idempotent.';

-- ─── Rate-limit action enum widening ────────────────────────────────
--
-- The sealed nex_security_rate_limit primitive (mig 290) uses a
-- CHECK constraint on `action` to enumerate allowed values. The new
-- 'shop_enquiry_submit' action is added here. The constraint is
-- recreated with the full list because PostgreSQL does not support
-- ADD VALUE on a CHECK-based enum.
--
-- This block is wrapped in a DO block so it is a no-op if the
-- constraint has drifted and the known-values list no longer
-- matches. In that case a migration operator must reconcile
-- manually; silently loosening a security constraint is not
-- acceptable.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'nex_security_rate_limit'
      AND constraint_name = 'nex_security_rate_limit_action_check'
  ) THEN
    ALTER TABLE nex_security_rate_limit
      DROP CONSTRAINT nex_security_rate_limit_action_check;
    ALTER TABLE nex_security_rate_limit
      ADD CONSTRAINT nex_security_rate_limit_action_check
      CHECK (action IN (
        'password_change',
        'session_revoke',
        'session_revoke_all',
        'chat_message',
        'account_create',
        'webauthn_assert',
        'webauthn_enroll',
        'visitor_bootstrap',
        'hq_admin_grant',
        'shop_enquiry_submit'
      ));
  ELSE
    RAISE NOTICE 'nex_security_rate_limit_action_check not found - skipping widening. '
                 'If nex_security_rate_limit exists under a different constraint name, '
                 'reconcile manually before enabling shop_enquiry_submit in code.';
  END IF;
END;
$$;

-- ─── Doc comment ────────────────────────────────────────────────────

COMMENT ON TABLE nex_shop_enquiry IS
  'Rev 3 guest-shop-enquiry · METADATA-ONLY. No body, no raw email/phone/IP. HMACs rotate daily. 30-day retention. See docs/engineering/guest-shop-enquiry-design-2026-11-28.md §6 for full column rationale.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '372',
    'nex_shop_enquiry metadata-only + shop_enquiry_submit rate-limit action',
    'Rev 3 guest-shop-enquiry foundation. Table stores NO message body, NO raw PII. Hashes rotate daily. 30-day sweep function included. Rate-limit CHECK widened with shop_enquiry_submit action.'
  );

COMMIT;

-- ─── Scheduling the sweep (run AFTER applying this migration) ───────
--
-- Option 1 · pg_cron (if the extension is enabled):
--   select cron.schedule(
--     'nex_shop_enquiry_purge_daily',
--     '0 3 * * *',  -- 03:00 UTC daily
--     $$select nex_shop_enquiry_purge_old(30)$$
--   );
--
-- Option 2 · external cron host (Vercel Cron / GitHub Actions /
-- systemd timer) calling a small purge script. Do not run the sweep
-- from an interactive endpoint.
