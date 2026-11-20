-- ============================================================================
-- CANDIDATE · DESIGN PREVIEW rollback · nex_group_call_invite 4-cap lock
-- UNAPPLIED · UNASSIGNED NUMBER · PREVIEW-ONLY · DO NOT APPLY
-- ============================================================================
--
-- Rollback for `CANDIDATE_nex_group_call_4cap_lock_DESIGN_PREVIEW.sql`.
--
-- Semantics: DROPs the FOR-UPDATE-locked function only. Does NOT restore
-- the prior mig-356 body · doing so would reopen GB-4CAP at the exact
-- severity it has today (still-OPEN). After rollback, callers of
-- `nex_invite_to_call_tx` error with `function does not exist` and the
-- TypeScript wrapper stays disabled. The mig-133 cap trigger remains in
-- place as defence-in-depth.
--
-- GB-4CAP remains OPEN regardless of whether this preview is applied or
-- rolled back · "preview" is design-only; GB-4CAP closure requires
-- fresh owner authorisation naming sandbox `kdstoyyeygcopkogqsyv`,
-- fresh fixture provisioning, and a bounded concurrent-invite battery
-- against the real database.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS nex_invite_to_call_tx(
  UUID,  -- p_invitee_account_id
  TEXT,  -- p_media_type
  TEXT,  -- p_host_country
  JSONB, -- p_attachment_meta
  TEXT,  -- p_invite_body
  TEXT,  -- p_attachment_url
  UUID   -- p_existing_session_id
);

-- No nex_migration_history row to delete (preview wrote none).
COMMIT;
