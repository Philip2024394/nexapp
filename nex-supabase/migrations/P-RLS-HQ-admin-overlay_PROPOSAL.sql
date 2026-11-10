-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY · sandbox only
-- HQ admin overlay · owner-approved 2026-11-10 Option B
-- =========================================================================
-- Drafted 2026-11-10 to implement the dual-track RLS doctrine described in
--   docs/doctrine/hq-admin-access-control-2026-11-10.md (Option B).
-- Target sandbox envelope: kdstoyyeygcopkogqsyv.
-- Production ijvqdvsvwtwxzcqmoqit remains sealed · a separate explicit
--   owner authorisation is required before any production apply.
--
-- Scope: this migration adds SELECT-only RLS overlay policies that allow
-- an HQ admin (nex_account.hq_role IS NOT NULL) to read sensitive
-- user-data tables via their session JWT · defence-in-depth so the HQ
-- surface no longer depends solely on the service-role bypass.
--
-- Write semantics: UNCHANGED. Admin WRITES continue to flow through
-- sealed server-actions that re-check requireHqAdmin and log via
-- recordAuditEvent · service_role still bypasses RLS for those paths.
-- This migration adds ZERO admin INSERT/UPDATE/DELETE policies.
--
-- SAFETY INVARIANT · AUDIT TABLES ARE NOT INCLUDED
-- --------------------------------------------------------------------------
-- The following two tables are DELIBERATELY EXCLUDED from the overlay.
-- Admins MUST NOT be able to read them via their own JWT · otherwise a
-- compromised admin session could view (or correlate for later erase via
-- a separate exploit) the breadcrumbs that record its own actions.
--
--   · nex_pilot_operator_audit   (migration 214 · operator intervention log)
--   · nex_security_audit_log     (migration 292 · HQ gate + action trail)
--
-- Both remain service-role-only. Admin dashboards that surface audit
-- rows must go through a dedicated read-only RPC (future work) that
-- itself writes an audit row for each admin query.

BEGIN;

-- ---------------------------------------------------------------------------
-- Reusable predicate · one declaration · many policy references
-- ---------------------------------------------------------------------------
-- STABLE + SECURITY INVOKER: the function only reads nex_account rows
-- the caller is already permitted to read (their own row, via the
-- existing nex_account_self_read policy from migration 001). It does
-- not elevate privileges.
CREATE OR REPLACE FUNCTION nex_is_hq_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY INVOKER
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM nex_account
      WHERE supabase_user_id = auth.uid()
        AND hq_role IS NOT NULL
    );
  $$;

COMMENT ON FUNCTION nex_is_hq_admin() IS
  'Returns true when the current authenticated user is an HQ admin or reviewer (nex_account.hq_role IS NOT NULL). Used by admin-overlay SELECT policies. Added by P-RLS-HQ-admin-overlay proposal 2026-11-10.';

-- ---------------------------------------------------------------------------
-- 1 · Emergency-help surface (migration 224 · schema `nex.*`)
-- ---------------------------------------------------------------------------

ALTER TABLE nex.trusted_contact ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_trusted_contact_admin_read ON nex.trusted_contact;
CREATE POLICY nex_trusted_contact_admin_read
  ON nex.trusted_contact FOR SELECT
  TO authenticated
  USING (nex_is_hq_admin());

ALTER TABLE nex.emergency_incident ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_emergency_incident_admin_read ON nex.emergency_incident;
CREATE POLICY nex_emergency_incident_admin_read
  ON nex.emergency_incident FOR SELECT
  TO authenticated
  USING (nex_is_hq_admin());

ALTER TABLE nex.incident_recipient ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_incident_recipient_admin_read ON nex.incident_recipient;
CREATE POLICY nex_incident_recipient_admin_read
  ON nex.incident_recipient FOR SELECT
  TO authenticated
  USING (nex_is_hq_admin());

ALTER TABLE nex.emergency_fanout_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_emergency_fanout_log_admin_read ON nex.emergency_fanout_log;
CREATE POLICY nex_emergency_fanout_log_admin_read
  ON nex.emergency_fanout_log FOR SELECT
  TO authenticated
  USING (nex_is_hq_admin());

ALTER TABLE nex.emergency_location_update ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_emergency_location_update_admin_read ON nex.emergency_location_update;
CREATE POLICY nex_emergency_location_update_admin_read
  ON nex.emergency_location_update FOR SELECT
  TO authenticated
  USING (nex_is_hq_admin());

-- ---------------------------------------------------------------------------
-- 2 · Support-ticket surface (migration 315 · schema `nex.*`)
-- ---------------------------------------------------------------------------
-- Note: admin ability to REPLY on tickets still requires the opt-in
-- row in nex.support_admin_grant AND goes through the server action
-- layer · these SELECT policies do not grant any write.

ALTER TABLE nex.support_ticket ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_support_ticket_admin_read ON nex.support_ticket;
CREATE POLICY nex_support_ticket_admin_read
  ON nex.support_ticket FOR SELECT
  TO authenticated
  USING (nex_is_hq_admin());

ALTER TABLE nex.support_message ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_support_message_admin_read ON nex.support_message;
CREATE POLICY nex_support_message_admin_read
  ON nex.support_message FOR SELECT
  TO authenticated
  USING (nex_is_hq_admin());

ALTER TABLE nex.support_admin_grant ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_support_admin_grant_admin_read ON nex.support_admin_grant;
CREATE POLICY nex_support_admin_grant_admin_read
  ON nex.support_admin_grant FOR SELECT
  TO authenticated
  USING (nex_is_hq_admin());

-- ---------------------------------------------------------------------------
-- 3 · Business directory enforcement surface (schema `nex.*`)
-- ---------------------------------------------------------------------------

ALTER TABLE nex.business_claim ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_business_claim_admin_read ON nex.business_claim;
CREATE POLICY nex_business_claim_admin_read
  ON nex.business_claim FOR SELECT
  TO authenticated
  USING (nex_is_hq_admin());

ALTER TABLE nex.business_outreach_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_business_outreach_queue_admin_read ON nex.business_outreach_queue;
CREATE POLICY nex_business_outreach_queue_admin_read
  ON nex.business_outreach_queue FOR SELECT
  TO authenticated
  USING (nex_is_hq_admin());

ALTER TABLE nex.business_outreach_suppression ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_business_outreach_suppression_admin_read ON nex.business_outreach_suppression;
CREATE POLICY nex_business_outreach_suppression_admin_read
  ON nex.business_outreach_suppression FOR SELECT
  TO authenticated
  USING (nex_is_hq_admin());

-- ---------------------------------------------------------------------------
-- 4 · Community moderation reports (schema `public`)
-- ---------------------------------------------------------------------------
-- Admin can SELECT the full report row to moderate. Reporter identity
-- masking in the UI is enforced by a SEPARATE rule at the reader /
-- server-action layer · not by this policy. This overlay merely
-- unblocks the admin read path · it does not weaken reporter privacy
-- against other actors (the existing reporter-only SELECT policy from
-- the per-table proposal keeps non-admins scoped to their own rows).

ALTER TABLE nex_community_notice_report ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_community_notice_report_admin_read ON nex_community_notice_report;
CREATE POLICY nex_community_notice_report_admin_read
  ON nex_community_notice_report FOR SELECT
  TO authenticated
  USING (nex_is_hq_admin());

ALTER TABLE nex_community_card_report ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_community_card_report_admin_read ON nex_community_card_report;
CREATE POLICY nex_community_card_report_admin_read
  ON nex_community_card_report FOR SELECT
  TO authenticated
  USING (nex_is_hq_admin());

COMMIT;

-- =========================================================================
-- ROLLBACK · drops every policy added above + the shared predicate.
-- Non-destructive to data. RLS enable state is left ON (ENABLE is
-- idempotent + several of these tables are targeted by sibling P-RLS
-- proposals that also enable RLS · toggling it off here would fight
-- those proposals). To fully revert RLS enablement, pair this with
-- the matching DISABLE line from each per-table proposal's rollback.
-- =========================================================================
--
-- BEGIN;
--   DROP POLICY IF EXISTS nex_trusted_contact_admin_read ON nex.trusted_contact;
--   DROP POLICY IF EXISTS nex_emergency_incident_admin_read ON nex.emergency_incident;
--   DROP POLICY IF EXISTS nex_incident_recipient_admin_read ON nex.incident_recipient;
--   DROP POLICY IF EXISTS nex_emergency_fanout_log_admin_read ON nex.emergency_fanout_log;
--   DROP POLICY IF EXISTS nex_emergency_location_update_admin_read ON nex.emergency_location_update;
--   DROP POLICY IF EXISTS nex_support_ticket_admin_read ON nex.support_ticket;
--   DROP POLICY IF EXISTS nex_support_message_admin_read ON nex.support_message;
--   DROP POLICY IF EXISTS nex_support_admin_grant_admin_read ON nex.support_admin_grant;
--   DROP POLICY IF EXISTS nex_business_claim_admin_read ON nex.business_claim;
--   DROP POLICY IF EXISTS nex_business_outreach_queue_admin_read ON nex.business_outreach_queue;
--   DROP POLICY IF EXISTS nex_business_outreach_suppression_admin_read ON nex.business_outreach_suppression;
--   DROP POLICY IF EXISTS nex_community_notice_report_admin_read ON nex_community_notice_report;
--   DROP POLICY IF EXISTS nex_community_card_report_admin_read ON nex_community_card_report;
--   DROP FUNCTION IF EXISTS nex_is_hq_admin();
-- COMMIT;
