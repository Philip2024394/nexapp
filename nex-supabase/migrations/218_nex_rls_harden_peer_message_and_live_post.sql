-- ============================================================================
-- NEX-native Migration 218 · RLS harden · peer_message + live_post
-- Boundary #3 follow-up · "B99+rls-harden" (per Migration 102 note)
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Must not be applied to the sealed production project
-- `ijvqdvsvwtwxzcqmoqit` without explicit owner approval and a
-- documented rollback drill. Must not be applied before Migration 217
-- (search_path hardening of Migration 010 helpers) and Migration 216
-- (Phase 1 Slice 1C enum extension).
--
-- Owner-authorised design review 2026-10-24.
-- See docs/doctrine/nex-commerce-live-relationship-plan-2026-10-24.md
-- Risk register R1 + R2 + R11 + R12.
--
-- Purpose
-- ----------------------------------------------------------------------------
-- Closes two G1 security defects and one defence-in-depth gap:
--
--   R1 · nex_peer_message / nex_peer_conversation RLS policies compare
--        nex_account.id against auth.uid() across incompatible identity
--        domains. Policies never fire for authenticated callers.
--        Repair: rewrite 6 Migration 047 policies to use the sealed
--        Migration 010 helper `nex_current_account_ids()` which maps
--        auth.uid() → nex_account.id via `supabase_user_id`. Add
--        `TO authenticated` qualifier.
--
--   R2 · nex_live_post has RLS enabled with no policies defined · deny-
--        by-default to authenticated/anon. Repair: add explicit public
--        SELECT policy for unexpired rows + owner-only INSERT/UPDATE
--        policies via `nex_current_owned_business_ids()`. NO DELETE
--        policy (D3 · hard-delete remains service-role-only).
--
--   R11 · nex_peer_message column immutability has been enforced only
--         by service-layer discipline. Repair: BEFORE UPDATE trigger
--         that rejects any UPDATE that mutates an immutable column.
--
--   R12 · Trigger coordination with the pre-existing Migration 125
--         `nex_peer_message_link_preview_delete_trigger`. Resolved by
--         alphabetical ordering: the new `nex_peer_message_immutability
--         _guard` trigger (name sorts before `_link_preview_delete_
--         trigger` because 'i' < 'l') fires FIRST and sees the client-
--         supplied NEW == OLD on link_preview columns (callers never
--         SET those). Then Migration 125's trigger fires AFTER, nulls
--         link_preview columns during a confirmed retract. The two
--         triggers coexist deterministically.
--
-- Scope of this migration
-- ----------------------------------------------------------------------------
--   Part A · nex_peer_conversation · 3 policy rewrites (select, insert, update)
--   Part B · nex_peer_message       · 3 policy rewrites (select, insert, update_read)
--   Part C · nex_live_post          · 3 new policies (public_select, owner_insert, owner_update)
--   Part D · nex_peer_message       · immutability trigger + function
--
-- Deliberately not in scope
-- ----------------------------------------------------------------------------
--   · No DELETE policy on nex_live_post (D3: hard-delete not granted · the
--     service actions only expose expire-via-UPDATE).
--   · No DELETE policy on nex_peer_message (service-role only · 60-min
--     retract is UPDATE deleted_for_everyone=true, not DELETE).
--   · No change to Migration 010 helpers themselves (hardened in 217).
--   · No change to Migration 125's link-preview delete trigger (coexists).
--   · No change to encrypted-message delivery helper functions in 094.
--   · No change to the service-role path · nexSupabaseAdmin continues to
--     bypass RLS by design. The service-layer participant check in
--     peer-message-service.ts remains the primary enforcement until
--     every caller is migrated to the authenticated client. This
--     migration is defence-in-depth that catches a future developer
--     who tries to use the authenticated client without a participant
--     check.
--
-- Guest-chat compatibility (D4)
-- ----------------------------------------------------------------------------
--   src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts uses
--   `nexSupabaseAdmin.insert` (service-role) for provisional guest
--   messages. Service-role bypasses RLS. The new policies do not
--   evaluate the guest's provisional nex_account (which has NULL
--   supabase_user_id and therefore nex_current_account_ids() returns
--   empty for it). The INSERT via service-role continues to work.
--   DO NOT move guest-chat insertion to the authenticated/anon client
--   without adding a dedicated policy path for provisional accounts.
--
-- Realtime impact (F6)
-- ----------------------------------------------------------------------------
--   Repository has NO `postgres_changes` Realtime subscriptions on
--   nex_peer_message / nex_peer_conversation / nex_live_post (confirmed
--   by grep over src/). Production project may have out-of-repo
--   subscriptions · owner must perform a manual inventory before
--   sandbox apply. Adding a public SELECT on nex_live_post may deliver
--   events to currently-silent subscribers.
--
-- Dependencies and ordering
-- ----------------------------------------------------------------------------
--   APPLIED (verify in sandbox):
--     001_nex_migration_history_and_account.sql  (nex_account identity)
--     002_nex_business.sql                        (nex_business.owner_account_id)
--     010_nex_rls_recursion_fix.sql               (helper functions)
--     029_nex_live_post.sql                       (nex_live_post base)
--     047_nex_peer_chat.sql                       (defective policies)
--     102_bridge99_provisional_state.sql          (claimed_at · Boundary #3 note)
--     125_nex_peer_message_link_preview.sql       (existing trigger · coexist)
--
--   PREREQUISITE:
--     217_nex_rls_helper_search_path_harden.sql   (apply first)
--
--   APPLY ORDER: 216 → 217 → 218.
--
-- Rollback
-- ----------------------------------------------------------------------------
--   See the explicit rollback block at the bottom of this file. Rollback
--   restores the Migration 047 policies as-is (identity-mismatched,
--   deny-safe-for-authenticated), drops the three new nex_live_post
--   policies, and drops the immutability trigger + function. Zero data
--   change · pure DDL.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Part A · nex_peer_conversation · 3 policy rewrites
-- ----------------------------------------------------------------------------
-- Preserve the sealed policy names so a diff against Migration 047 is
-- a clean replacement.

DROP POLICY IF EXISTS nex_peer_conversation_select ON nex_peer_conversation;
CREATE POLICY nex_peer_conversation_select
  ON nex_peer_conversation FOR SELECT
  TO authenticated
  USING (
    participant_a_id IN (SELECT nex_current_account_ids())
    OR participant_b_id IN (SELECT nex_current_account_ids())
  );

DROP POLICY IF EXISTS nex_peer_conversation_insert ON nex_peer_conversation;
CREATE POLICY nex_peer_conversation_insert
  ON nex_peer_conversation FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_a_id IN (SELECT nex_current_account_ids())
    OR participant_b_id IN (SELECT nex_current_account_ids())
  );

DROP POLICY IF EXISTS nex_peer_conversation_update ON nex_peer_conversation;
CREATE POLICY nex_peer_conversation_update
  ON nex_peer_conversation FOR UPDATE
  TO authenticated
  USING (
    participant_a_id IN (SELECT nex_current_account_ids())
    OR participant_b_id IN (SELECT nex_current_account_ids())
  );

-- ----------------------------------------------------------------------------
-- Part B · nex_peer_message · 3 policy rewrites
-- ----------------------------------------------------------------------------
-- Policies gate rows by conversation participation. Column-level
-- immutability is enforced by the trigger in Part D.

DROP POLICY IF EXISTS nex_peer_message_select ON nex_peer_message;
CREATE POLICY nex_peer_message_select
  ON nex_peer_message FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM nex_peer_conversation c
       WHERE c.id = conversation_id
         AND (
           c.participant_a_id IN (SELECT nex_current_account_ids())
           OR c.participant_b_id IN (SELECT nex_current_account_ids())
         )
    )
  );

DROP POLICY IF EXISTS nex_peer_message_insert ON nex_peer_message;
CREATE POLICY nex_peer_message_insert
  ON nex_peer_message FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_account_id IN (SELECT nex_current_account_ids())
    AND EXISTS (
      SELECT 1 FROM nex_peer_conversation c
       WHERE c.id = conversation_id
         AND (
           c.participant_a_id IN (SELECT nex_current_account_ids())
           OR c.participant_b_id IN (SELECT nex_current_account_ids())
         )
    )
  );

DROP POLICY IF EXISTS nex_peer_message_update_read ON nex_peer_message;
CREATE POLICY nex_peer_message_update_read
  ON nex_peer_message FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM nex_peer_conversation c
       WHERE c.id = conversation_id
         AND (
           c.participant_a_id IN (SELECT nex_current_account_ids())
           OR c.participant_b_id IN (SELECT nex_current_account_ids())
         )
    )
  );

-- ----------------------------------------------------------------------------
-- Part C · nex_live_post · 3 new policies
-- ----------------------------------------------------------------------------
-- D1 · public SELECT (anon + authenticated) for unexpired rows.
-- D3 · no DELETE policy · service-role only.
-- Owner INSERT and UPDATE via Migration 010's helper
-- `nex_current_owned_business_ids()`.
--
-- No role qualifier on the SELECT policy → applies to PUBLIC (anon +
-- authenticated + service_role), matching the sealed phase-1 doctrine
-- that live posts are business-anchored public announcements.

CREATE POLICY nex_live_post_public_select
  ON nex_live_post FOR SELECT
  USING (
    expires_at IS NULL OR expires_at > now()
  );

CREATE POLICY nex_live_post_owner_insert
  ON nex_live_post FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (SELECT nex_current_owned_business_ids())
  );

CREATE POLICY nex_live_post_owner_update
  ON nex_live_post FOR UPDATE
  TO authenticated
  USING (
    business_id IN (SELECT nex_current_owned_business_ids())
  );

-- ----------------------------------------------------------------------------
-- Part D · nex_peer_message · immutability trigger (F4 · R11)
-- ----------------------------------------------------------------------------
-- Fires BEFORE UPDATE on nex_peer_message. Rejects any UPDATE that
-- changes an immutable column. Permits updates to the sealed mutable
-- set: read_at, deleted_for_everyone, deleted_at, reactions,
-- reactions_order, delivered_at.
--
-- Alphabetical ordering guarantees this trigger fires BEFORE
-- `nex_peer_message_link_preview_delete_trigger` from Migration 125
-- (because 'i' < 'l' in the trigger name sort). At evaluation, the
-- client-supplied NEW column values are compared against OLD. The
-- four legitimate UPDATE call sites in peer-message-service.ts
-- (lines 581, 635, 730, 850) all set only columns from the mutable
-- set in their UPDATE SET clause, so link_preview NEW == OLD at this
-- trigger's evaluation → DISTINCT returns false → trigger permits.
-- Migration 125's trigger then fires second and nulls link_preview
-- columns during a confirmed retract transition.
--
-- SECURITY DEFINER + pinned search_path matches the hardened pattern
-- adopted by Migration 217.

CREATE OR REPLACE FUNCTION nex_peer_message_enforce_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
BEGIN
  -- 5 columns from Migration 047 (base)
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'nex_peer_message.id is immutable (sealed Migration 047)';
  END IF;
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
    RAISE EXCEPTION 'nex_peer_message.conversation_id is immutable (sealed Migration 047)';
  END IF;
  IF NEW.sender_account_id IS DISTINCT FROM OLD.sender_account_id THEN
    RAISE EXCEPTION 'nex_peer_message.sender_account_id is immutable (sealed Migration 047)';
  END IF;
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    RAISE EXCEPTION 'nex_peer_message.body is immutable (sealed Migration 047 · retract uses deleted_for_everyone, not body nulling)';
  END IF;
  IF NEW.sent_at IS DISTINCT FROM OLD.sent_at THEN
    RAISE EXCEPTION 'nex_peer_message.sent_at is immutable (sealed Migration 047)';
  END IF;

  -- 1 column from Migration 052 (reply_to)
  IF NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id THEN
    RAISE EXCEPTION 'nex_peer_message.reply_to_id is immutable (sealed Migration 052)';
  END IF;

  -- 3 columns from Migration 054 (attachments)
  IF NEW.attachment_url IS DISTINCT FROM OLD.attachment_url THEN
    RAISE EXCEPTION 'nex_peer_message.attachment_url is immutable (sealed Migration 054)';
  END IF;
  IF NEW.attachment_type IS DISTINCT FROM OLD.attachment_type THEN
    RAISE EXCEPTION 'nex_peer_message.attachment_type is immutable (sealed Migration 054)';
  END IF;
  IF (NEW.attachment_meta IS DISTINCT FROM OLD.attachment_meta) THEN
    RAISE EXCEPTION 'nex_peer_message.attachment_meta is immutable (sealed Migration 054 · snapshot frozen at send-time)';
  END IF;

  -- 7 columns from Migration 093 (encrypted); delivered_at excluded (mutable)
  IF NEW.encrypted IS DISTINCT FROM OLD.encrypted THEN
    RAISE EXCEPTION 'nex_peer_message.encrypted is immutable (sealed Migration 093)';
  END IF;
  IF NEW.ciphertext IS DISTINCT FROM OLD.ciphertext THEN
    RAISE EXCEPTION 'nex_peer_message.ciphertext is immutable (sealed Migration 093 · plaintext tamper-evidence)';
  END IF;
  IF NEW.nonce IS DISTINCT FROM OLD.nonce THEN
    RAISE EXCEPTION 'nex_peer_message.nonce is immutable (sealed Migration 093)';
  END IF;
  IF NEW.sender_public_key IS DISTINCT FROM OLD.sender_public_key THEN
    RAISE EXCEPTION 'nex_peer_message.sender_public_key is immutable (sealed Migration 093)';
  END IF;
  IF NEW.sender_device_id IS DISTINCT FROM OLD.sender_device_id THEN
    RAISE EXCEPTION 'nex_peer_message.sender_device_id is immutable (sealed Migration 093)';
  END IF;
  IF NEW.recipient_device_id IS DISTINCT FROM OLD.recipient_device_id THEN
    RAISE EXCEPTION 'nex_peer_message.recipient_device_id is immutable (sealed Migration 093)';
  END IF;
  IF NEW.message_group_id IS DISTINCT FROM OLD.message_group_id THEN
    RAISE EXCEPTION 'nex_peer_message.message_group_id is immutable (sealed Migration 093)';
  END IF;

  -- 1 column from Migration 102 Part C (idempotency)
  IF NEW.send_intent_id IS DISTINCT FROM OLD.send_intent_id THEN
    RAISE EXCEPTION 'nex_peer_message.send_intent_id is immutable (sealed Migration 102 Part C · idempotency key)';
  END IF;

  -- Note on Migration 125 link_preview columns:
  --   NOT checked by this trigger. They are permanent columns on
  --   nex_peer_message but are conditionally mutable: Migration 125's
  --   trigger (`nex_peer_message_link_preview_delete_trigger`, fires
  --   alphabetically AFTER this one) nulls them during a confirmed
  --   retract transition when attachment_type = 'link_preview' AND
  --   deleted_for_everyone transitions false → true. The four
  --   legitimate caller UPDATE paths never include link_* columns in
  --   their SET clause, so at this trigger's evaluation NEW == OLD on
  --   link_* columns anyway. If a future caller ever SETs link_* in
  --   its UPDATE, this trigger will NOT reject · that caller must
  --   ensure the write makes sense. Defence-in-depth is deferred to a
  --   subsequent slice if needed.
  --
  -- Mutable columns deliberately not checked (allowed to change):
  --   read_at                 (recipient marks read)
  --   deleted_for_everyone    (sender retract within 60-min window)
  --   deleted_at              (paired with deleted_for_everyone)
  --   reactions               (any participant emoji-reacts)
  --   reactions_order         (paired with reactions)
  --   delivered_at            (recipient device delivery mark · encrypted)

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION nex_peer_message_enforce_immutability() IS
  'Enforces column-level immutability on nex_peer_message. Fires BEFORE UPDATE. Rejects mutation of 17 sealed-immutable columns · permits the 6-column sealed mutable set (read_at · deleted_for_everyone · deleted_at · reactions · reactions_order · delivered_at). Trigger name sorts before nex_peer_message_link_preview_delete_trigger (Migration 125) · fires first · coexists deterministically. Sealed 2026-10-24 · Migration 218.';

DROP TRIGGER IF EXISTS nex_peer_message_immutability_guard ON nex_peer_message;

CREATE TRIGGER nex_peer_message_immutability_guard
  BEFORE UPDATE ON nex_peer_message
  FOR EACH ROW
  EXECUTE FUNCTION nex_peer_message_enforce_immutability();

-- ----------------------------------------------------------------------------
-- Migration ledger
-- ----------------------------------------------------------------------------

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '218',
  'RLS harden · nex_peer_message + nex_peer_conversation + nex_live_post · B99+rls-harden · R1 + R2 + R11 + R12 closure',
  'Owner-authorised design review 2026-10-24. Part A: rewrites 3 nex_peer_conversation policies to use nex_current_account_ids() + TO authenticated (R1 identity mismatch repair). Part B: rewrites 3 nex_peer_message policies similarly (R1). Part C: adds 3 new nex_live_post policies · public_select on unexpired · owner_insert + owner_update via nex_current_owned_business_ids() · NO delete policy per D3 (R2). Part D: nex_peer_message_enforce_immutability trigger + function (R11); 17 immutable columns · 6 mutable; trigger name sorts before nex_peer_message_link_preview_delete_trigger from Migration 125 so the two coexist (R12). SECURITY DEFINER with pinned search_path. Service-role continues to bypass RLS as a documented defence-in-depth model until the full authenticated-client migration is executed. NOT YET APPLIED to any database.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Rollback (manual · must be applied in a single transaction)
-- ============================================================================
--
-- BEGIN;
--
--   -- Part D rollback · drop trigger + function
--   DROP TRIGGER IF EXISTS nex_peer_message_immutability_guard ON nex_peer_message;
--   DROP FUNCTION IF EXISTS nex_peer_message_enforce_immutability();
--
--   -- Part C rollback · drop new nex_live_post policies
--   DROP POLICY IF EXISTS nex_live_post_public_select ON nex_live_post;
--   DROP POLICY IF EXISTS nex_live_post_owner_insert ON nex_live_post;
--   DROP POLICY IF EXISTS nex_live_post_owner_update ON nex_live_post;
--
--   -- Part B rollback · restore Migration 047 nex_peer_message policies
--   DROP POLICY IF EXISTS nex_peer_message_select ON nex_peer_message;
--   CREATE POLICY nex_peer_message_select
--     ON nex_peer_message FOR SELECT
--     USING (
--       EXISTS (
--         SELECT 1 FROM nex_peer_conversation c
--          WHERE c.id = conversation_id
--            AND (c.participant_a_id = auth.uid() OR c.participant_b_id = auth.uid())
--       )
--     );
--   DROP POLICY IF EXISTS nex_peer_message_insert ON nex_peer_message;
--   CREATE POLICY nex_peer_message_insert
--     ON nex_peer_message FOR INSERT
--     WITH CHECK (
--       sender_account_id = auth.uid()
--       AND EXISTS (
--         SELECT 1 FROM nex_peer_conversation c
--          WHERE c.id = conversation_id
--            AND (c.participant_a_id = auth.uid() OR c.participant_b_id = auth.uid())
--       )
--     );
--   DROP POLICY IF EXISTS nex_peer_message_update_read ON nex_peer_message;
--   CREATE POLICY nex_peer_message_update_read
--     ON nex_peer_message FOR UPDATE
--     USING (
--       EXISTS (
--         SELECT 1 FROM nex_peer_conversation c
--          WHERE c.id = conversation_id
--            AND (c.participant_a_id = auth.uid() OR c.participant_b_id = auth.uid())
--       )
--     );
--
--   -- Part A rollback · restore Migration 047 nex_peer_conversation policies
--   DROP POLICY IF EXISTS nex_peer_conversation_select ON nex_peer_conversation;
--   CREATE POLICY nex_peer_conversation_select
--     ON nex_peer_conversation FOR SELECT
--     USING (
--       participant_a_id = auth.uid() OR participant_b_id = auth.uid()
--     );
--   DROP POLICY IF EXISTS nex_peer_conversation_insert ON nex_peer_conversation;
--   CREATE POLICY nex_peer_conversation_insert
--     ON nex_peer_conversation FOR INSERT
--     WITH CHECK (
--       participant_a_id = auth.uid() OR participant_b_id = auth.uid()
--     );
--   DROP POLICY IF EXISTS nex_peer_conversation_update ON nex_peer_conversation;
--   CREATE POLICY nex_peer_conversation_update
--     ON nex_peer_conversation FOR UPDATE
--     USING (
--       participant_a_id = auth.uid() OR participant_b_id = auth.uid()
--     );
--
--   DELETE FROM nex_migration_history WHERE version = '218';
--
-- COMMIT;
--
-- Zero data touched by rollback. Service-role access to the three
-- tables is preserved throughout. Rollback restores the Boundary #3
-- pre-R1-repair state (identity-mismatched policies, zero live-post
-- policies). Phase 1 slices 1A-1G remain functional at the service
-- layer independently of this migration's state.
-- ============================================================================
