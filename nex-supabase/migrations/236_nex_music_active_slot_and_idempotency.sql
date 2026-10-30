-- ============================================================================
-- NEX-native Migration 236 · nex_creator_active_music + nex_music_publish_idempotency
-- M-1 draft for review only · AUTHORED 2026-10-30
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised draft only · DO NOT APPLY to the sealed Supabase project
-- `ijvqdvsvwtwxzcqmoqit` or any staging target without a SEPARATE explicit
-- owner authorisation. This file encodes the design decisions recorded in
-- the sealed memory `project_nex_music_publishing_locks_sealed_2026_10_30.md`
-- (Rounds 1-10 of the NEX Music Publishing contract review). Any deviation
-- from the locked decisions is a bug in this draft and must be flagged on
-- review, not reconciled by altering the lock.
--
-- Locked design decisions encoded here
-- ----------------------------------------------------------------------------
--   A  · Option X · hard enforcement · REVOKE direct writes from service_role
--        on both new tables; writes flow only via the two SECURITY DEFINER
--        functions defined below.
--   C  · Option C1 · explicit class-45 SQLSTATE codes; SQLSTATE 23505 is NOT
--        normalised to idempotency-rejected (server translates 23505 to
--        public `internal-error` + operational alert).
--   D  · Option D2 · authenticated-only metadata on nex_creator_active_music.
--        RLS SELECT policy denies anon.
--   E  · Option E1-schema · nex_account_music_rights_ack is a SEPARATE
--        Migration 237 · this migration does NOT create or reference it.
--        Rights-acknowledgement enforcement lives in the M-2 server action.
--   F  · Option F1 · required publish_request_id; durable DB-backed dedup via
--        nex_music_publish_idempotency per R5-4 + R6-1.
--   R7-2 · explicit `GRANT EXECUTE ... TO service_role` on BOTH function
--          signatures; REVOKEs on PUBLIC/anon/authenticated.
--   Correction §1 · publish function does NOT reference the ack table.
--   Correction §2 · "step-5 unique_violation is unreachable" holds only
--                   under Option X enforced + advisory-lock-first intact.
--                   Server treats any 23505 at this surface as an incident.
--
-- Technical baseline items encoded
-- ----------------------------------------------------------------------------
--   R5-1 single idempotency-rejected · R5-2 SELECT FOR UPDATE eligibility ·
--   R5-3 plpgsql + RPC · R5-4 publish_generation NOT NULL CHECK ≥ 1 ·
--   R6-1 advisory-lock-first keyed on request_id (Migration 105 pattern) ·
--   R6-2 SECURITY DEFINER + pinned search_path (Migration 232 pattern) ·
--   R7-1 no inner EXCEPTION block · every error path uses RAISE propagated ·
--   R7-3 server-action is the end-user authentication boundary (doctrine) ·
--   R8-1 step-5 unique_violation documented as unreachable under Option X ·
--   R8-2 Option X evidence verified against repo convention ·
--   R8-4 narrow server-side SQLSTATE mapping.
--
-- Prerequisites (apply order, verify in sandbox before any production apply)
-- ----------------------------------------------------------------------------
--   APPLIED (verify in sandbox):
--     001 · nex_account identity
--     010 · nex_current_account_ids / RLS helpers
--     217 · search_path hardening pattern
--
--   PREREQUISITE (not yet applied; must land first):
--     235 · nex_music_track (defines the FK target + visibility + rights
--           CHECK constraints the publish function reads)
--
--   Migration 219 (nex_live_session) is NOT a strict dependency for this
--   migration · 236 can be applied without 219 and vice versa. The feed
--   reader (M-3) depends on BOTH 219 and 236 being applied.
--
-- Prerequisites explicitly NOT included here
-- ----------------------------------------------------------------------------
--   237 · nex_account_music_rights_ack · owner locked as a separate
--         migration. Rights-ack enforcement lives in the M-2 server action.
--
-- Apply-time role prerequisite (3-A · documented, not asserted in SQL)
-- ----------------------------------------------------------------------------
--   This migration does NOT contain `ALTER FUNCTION ... OWNER TO ...`
--   statements. The owner of both SECURITY DEFINER functions is implicitly
--   the role that executes `CREATE OR REPLACE FUNCTION`. The functions
--   execute under that owner's privileges (not the invoker's), and must
--   have:
--     · INSERT / UPDATE / SELECT on nex_creator_active_music
--     · INSERT / SELECT on nex_music_publish_idempotency
--     · DELETE on nex_music_publish_idempotency (cleanup function)
--     · SELECT (with FOR UPDATE) and UPDATE on nex_music_track
--     · USAGE on the public schema
--
--   Verification BEFORE applying this migration (manual check only; no
--   production query is authorised by this draft):
--     1. `SELECT current_user;` returns the intended migration-apply role
--        (standard Supabase convention: `postgres`).
--     2. Confirm the apply-role has all privileges listed above via
--        `has_table_privilege('<role>', 'public.<table>', '<priv>')`.
--     3. If the apply-role is NOT `postgres` and does NOT have all required
--        privileges, add a separate `ALTER FUNCTION ... OWNER TO postgres`
--        step BEFORE applying 236, under a separately authorised migration
--        or operations ticket.
--
--   This migration deliberately does NOT execute an ALTER FUNCTION OWNER
--   TO postgres statement because the apply-role may not have the
--   privilege to reassign ownership, and because the correct role name
--   is a project-configuration decision outside this file's scope.
--
--   RUNTIME SYMPTOM if the apply-role lacks the required privileges:
--   step 6 of the publish function (`UPDATE nex_music_track SET visibility
--   = 'shared_live'`) returns SQLSTATE 42501 (`permission denied for
--   table nex_music_track`) and the RPC transaction rolls back. This is
--   NOT one of the 450NN application codes · the server action must map
--   42501 to the public `internal-error` response + operational alert.
--
-- Rollback
-- ----------------------------------------------------------------------------
-- See the comment block at the end of this file. Rolling back 236 after any
-- active-slot data has been persisted DESTROYS that data. The rollback must
-- be preceded by `pg_dump --table=public.nex_creator_active_music
-- --table=public.nex_music_publish_idempotency` and a verified restore
-- rehearsal on staging before any production rollback.
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- Part A · nex_creator_active_music · one active slot per creator
-- ============================================================================
--
-- Single row per creator (PK on owner_account_id). Replacing the active
-- track is `ON CONFLICT (owner_account_id) DO UPDATE` inside the publish
-- function. The underlying nex_music_track row is NEVER deleted by a
-- replace · the creator's library is preserved.
--
-- track_id is nullable only because `ON DELETE SET NULL` is required for
-- the FK: if a creator deletes a track that is currently the active slot,
-- the slot's track_id becomes NULL and the reader filters it out
-- (presenting an empty-slot feed state). publish_as_mode and
-- rights_declaration_frozen retain their last values for audit.
--
-- FK on_delete asymmetry (6-A · documented intent)
-- ----------------------------------------------------------------------------
-- nex_creator_active_music.track_id → nex_music_track(id) · ON DELETE
--   SET NULL · the slot is deliberately preserved as an audit-visible
--   empty-state when the referenced track is deleted. publish_generation,
--   rights_declaration_frozen, published_at, and (new/preserved)
--   unpublished_at retain their last values so a service-role audit can
--   see "this creator previously had an active slot pointing at a now-
--   deleted track." The reader filters this row out via the server-side
--   JOIN (track_id IS NULL check).
--
-- nex_music_publish_idempotency.track_id → nex_music_track(id) · ON DELETE
--   CASCADE · dedup rows are a cache, not an audit log. A dedup row's
--   purpose is to make retries idempotent against the lifetime of a
--   publish. When the referenced track is deleted, the publish's "stored
--   result" is no longer meaningful · a retry would hit the fresh track-
--   not-found path at step 3 regardless. Removing the dedup row with the
--   track keeps the table small and does not weaken any invariant.
--
-- Both choices are intentional. Reversing either would break the stated
-- audit (SET NULL preserves history) or stated cache semantics (CASCADE
-- keeps the cache tidy).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex_creator_active_music (
  owner_account_id          uuid        PRIMARY KEY REFERENCES nex_account(id) ON DELETE CASCADE,
  track_id                  uuid        NULL REFERENCES nex_music_track(id) ON DELETE SET NULL,
  publish_as_mode           text        NOT NULL,
  publish_generation        bigint      NOT NULL,
  rights_declaration_frozen text        NOT NULL,
  published_at              timestamptz NOT NULL DEFAULT clock_timestamp(),
  unpublished_at            timestamptz NULL,
  CONSTRAINT nex_creator_active_music_publish_mode_values
    CHECK (publish_as_mode IN ('cover_audio', 'music_video')),
  CONSTRAINT nex_creator_active_music_publish_generation_positive
    CHECK (publish_generation >= 1),
  CONSTRAINT nex_creator_active_music_rights_frozen_values
    CHECK (rights_declaration_frozen IN ('owner_content', 'licensed', 'public_domain'))
);

COMMENT ON TABLE nex_creator_active_music IS
  'NEX one-active-music-slot-per-creator pointer · writes flow exclusively through nex_music_publish_as_active_slot() per Option X · underlying library tracks are not deleted on replace · M-1 2026-10-30.';

CREATE INDEX IF NOT EXISTS idx_nex_creator_active_music_track
  ON nex_creator_active_music (track_id)
  WHERE track_id IS NOT NULL AND unpublished_at IS NULL;

-- ============================================================================
-- Part B · nex_music_publish_idempotency · durable DB-backed dedup
-- ============================================================================
--
-- PK on request_id (uuid). Composite dedup is NOT used · the owner-locked
-- design keeps `request_id` globally unique on its own.
--
-- publish_generation is NOT NULL (R5-4): the function writes this table
-- AFTER the slot UPSERT returns its generation, so the known-value
-- invariant is maintained in a single transaction.
--
-- Cleanup: nex_music_publish_idempotency_cleanup() deletes rows where
-- expires_at < now(). Expired-but-present rows are still honoured as
-- dedup hits (R4-#5).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nex_music_publish_idempotency (
  request_id         uuid        PRIMARY KEY,
  account_id         uuid        NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  track_id           uuid        NOT NULL REFERENCES nex_music_track(id) ON DELETE CASCADE,
  publish_as_mode    text        NOT NULL,
  publish_generation bigint      NOT NULL,
  observed_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at         timestamptz NOT NULL,
  CONSTRAINT nex_music_publish_idempotency_publish_mode_values
    CHECK (publish_as_mode IN ('cover_audio', 'music_video')),
  CONSTRAINT nex_music_publish_idempotency_publish_generation_positive
    CHECK (publish_generation >= 1)
);

COMMENT ON TABLE nex_music_publish_idempotency IS
  'NEX durable dedup for music publish requests · writes flow exclusively through nex_music_publish_as_active_slot() · reads retained for service_role audit · M-1 2026-10-30.';

CREATE INDEX IF NOT EXISTS idx_nex_music_publish_idempotency_expires_at
  ON nex_music_publish_idempotency (expires_at);

-- ============================================================================
-- Part C · nex_music_publish_as_active_slot() · publish function
-- ============================================================================
--
-- Flow per sealed design (see memory doc):
--   1. Advisory lock keyed on request_id (R6-1; Migration 105 pattern).
--   2. Dedup fast-path SELECT · fingerprint re-check · return stored
--      result OR RAISE 45001 idempotency-rejected (R5-1).
--   3. SELECT visibility, rights_declaration, owner FOR UPDATE from
--      nex_music_track · validate (R5-2). Owner-match protects against
--      server-action BUGS only · not against server COMPROMISE (R7-3).
--   4. UPSERT nex_creator_active_music · increment publish_generation.
--   5. Plain INSERT into nex_music_publish_idempotency with the known
--      generation. NO EXCEPTION block (R7-1). A unique_violation here is
--      unreachable under Option X + advisory-lock-first intact; if raised,
--      it propagates to the RPC transaction and rolls back everything.
--   6. If observed visibility was 'private', UPDATE nex_music_track SET
--      visibility = 'shared_live'. Verify ROW_COUNT = 1 else RAISE 45006.
--   7. RETURN jsonb payload.
--
-- The function receives p_owner_account_id as a parameter. This is NOT an
-- end-user authentication; the server action is the authentication
-- boundary (R7-3). The function independently checks that the submitted
-- track belongs to the submitted account; this is defense-in-depth against
-- server-action BUGS, not against server COMPROMISE.
--
-- NO INNER EXCEPTION BLOCKS. Every error path uses `RAISE EXCEPTION USING
-- ERRCODE = '450NN'`. The lint rule in the migration-review checklist
-- rejects any `EXCEPTION WHEN` clause inside this function body (R7-1).
--
-- SQLSTATE table (R8-4):
--   45001 · idempotency-rejected (fingerprint mismatch; ALSO maps to the
--           step-5 unreachable 23505 only at the server-translation layer,
--           not inside this function)
--   45002 · track-not-found
--   45003 · not-authorized
--   45004 · track-removed
--   45005 · rights-invalid
--   45006 · eligibility-race
--   45007 · eligibility-invalid-state (defensive-case: track visibility
--           is a value other than 'private', 'shared_live', or 'removed')
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nex_music_publish_as_active_slot(
  p_request_id       uuid,
  p_owner_account_id uuid,
  p_track_id         uuid,
  p_publish_as_mode  text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock_key       bigint;
  v_existing       nex_music_publish_idempotency%ROWTYPE;
  v_track          RECORD;
  v_new_generation bigint;
  v_was_private    boolean;
BEGIN
  -- Guard: null-parameter inputs are rejected before any DB mutation.
  IF p_request_id IS NULL OR p_owner_account_id IS NULL
     OR p_track_id IS NULL OR p_publish_as_mode IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '45001', MESSAGE = 'idempotency-rejected';
  END IF;
  IF p_publish_as_mode NOT IN ('cover_audio', 'music_video') THEN
    RAISE EXCEPTION USING ERRCODE = '45001', MESSAGE = 'idempotency-rejected';
  END IF;

  -- Step 1 · Advisory lock keyed on request_id (transaction-scoped).
  v_lock_key := ('x' || substring(md5(p_request_id::text), 1, 15))::bit(60)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Step 2 · Idempotency fast-path · fingerprint re-check.
  SELECT * INTO v_existing
    FROM public.nex_music_publish_idempotency
   WHERE request_id = p_request_id;

  IF FOUND THEN
    IF v_existing.account_id      <> p_owner_account_id
       OR v_existing.track_id        <> p_track_id
       OR v_existing.publish_as_mode <> p_publish_as_mode THEN
      -- R5-1 · single generic response for all idempotency rejection classes.
      RAISE EXCEPTION USING ERRCODE = '45001', MESSAGE = 'idempotency-rejected';
    END IF;
    -- Idempotent retry · returns the stored success result as-of-the-
    -- original-publish. Current track eligibility is NOT re-validated here:
    -- if the track was removed, rights-revoked, or otherwise became
    -- ineligible between the original publish and this retry, the feed
    -- reader's JOIN with nex_music_track (M-3 scope) is responsible for
    -- filtering the slot out downstream. This surface honestly reports
    -- that the earlier publish was accepted · it does NOT re-check live
    -- eligibility on retry.
    RETURN jsonb_build_object(
      'requestId',         p_request_id,
      'trackId',           v_existing.track_id,
      'publishGeneration', v_existing.publish_generation
    );
  END IF;

  -- Step 3 · Track eligibility: SELECT FOR UPDATE + validate (R5-2).
  SELECT visibility, rights_declaration, owner_account_id
    INTO v_track
    FROM public.nex_music_track
   WHERE id = p_track_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '45002', MESSAGE = 'track-not-found';
  END IF;

  IF v_track.owner_account_id <> p_owner_account_id THEN
    RAISE EXCEPTION USING ERRCODE = '45003', MESSAGE = 'not-authorized';
  END IF;

  IF v_track.visibility = 'removed' THEN
    RAISE EXCEPTION USING ERRCODE = '45004', MESSAGE = 'track-removed';
  END IF;

  -- 45007 · defensive · the owner-locked design permits publishing only
  -- when the track's current visibility is 'private' or 'shared_live'
  -- ('removed' was caught above). Any other value is either a future
  -- schema extension to nex_music_track that has not been reflected in
  -- this migration, or a data-integrity anomaly. Fail-closed with a
  -- distinct SQLSTATE so an operator can distinguish this from the
  -- expected error classes.
  IF v_track.visibility NOT IN ('private', 'shared_live') THEN
    RAISE EXCEPTION USING ERRCODE = '45007', MESSAGE = 'eligibility-invalid-state';
  END IF;

  IF v_track.rights_declaration NOT IN ('owner_content', 'licensed', 'public_domain') THEN
    RAISE EXCEPTION USING ERRCODE = '45005', MESSAGE = 'rights-invalid';
  END IF;

  v_was_private := (v_track.visibility = 'private');

  -- Step 4 · Slot UPSERT · deterministic serialisation on the PK row lock.
  INSERT INTO public.nex_creator_active_music (
    owner_account_id, track_id, publish_as_mode,
    publish_generation, rights_declaration_frozen,
    published_at, unpublished_at
  ) VALUES (
    p_owner_account_id, p_track_id, p_publish_as_mode,
    1, v_track.rights_declaration,
    clock_timestamp(), NULL
  )
  ON CONFLICT (owner_account_id) DO UPDATE
    SET track_id                  = EXCLUDED.track_id,
        publish_as_mode           = EXCLUDED.publish_as_mode,
        publish_generation        = public.nex_creator_active_music.publish_generation + 1,
        rights_declaration_frozen = EXCLUDED.rights_declaration_frozen,
        published_at              = clock_timestamp(),
        unpublished_at            = NULL
  RETURNING publish_generation INTO v_new_generation;

  -- Step 5 · Dedup INSERT · PLAIN · no ON CONFLICT · no EXCEPTION block.
  -- Under Option X + advisory-lock-first, this cannot raise unique_violation
  -- in the designed system. If it ever does (operational anomaly), the
  -- exception propagates out of the function, the RPC transaction rolls
  -- back everything (including step 4's slot UPSERT), and the server-side
  -- SQLSTATE translator maps `23505` from THIS surface to the public
  -- `internal-error` response + operational alert (R8-4). It is NOT
  -- translated to `idempotency-rejected`.
  INSERT INTO public.nex_music_publish_idempotency (
    request_id, account_id, track_id, publish_as_mode,
    publish_generation, observed_at, expires_at
  ) VALUES (
    p_request_id, p_owner_account_id, p_track_id, p_publish_as_mode,
    v_new_generation, clock_timestamp(),
    clock_timestamp() + interval '72 hours'
  );

  -- Step 6 · Visibility flip (only if observed-at-step-3 visibility was
  -- 'private'; already-shared_live tracks skip the UPDATE per the locked
  -- decision in R5-2).
  IF v_was_private THEN
    UPDATE public.nex_music_track
       SET visibility = 'shared_live'
     WHERE id = p_track_id
       AND visibility = 'private';
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '45006', MESSAGE = 'eligibility-race';
    END IF;
  END IF;

  -- Step 7 · Return.
  RETURN jsonb_build_object(
    'requestId',         p_request_id,
    'trackId',           p_track_id,
    'publishGeneration', v_new_generation
  );
END;
$$;

COMMENT ON FUNCTION nex_music_publish_as_active_slot IS
  'NEX music publish RPC · advisory-lock-first idempotency + atomic slot replace + visibility flip · SECURITY DEFINER with pinned search_path · caller is the server action which pre-authenticates the session · no inner EXCEPTION block · M-1 2026-10-30.';

-- ============================================================================
-- Part D · nex_music_publish_idempotency_cleanup() · expired-token sweep
-- ============================================================================
--
-- Deletes dedup rows where expires_at < clock_timestamp(). Idempotent;
-- intended to run on a schedule (owner decision H5: 15-minute cadence
-- recommended). Returns the count of deleted rows for operational logging.
-- Must be invoked via RPC by service_role (R7-2 lock); REVOKEs below.
--
-- SECURITY DEFINER so the function writes under its owner's privileges
-- even after Option X REVOKEs service_role's direct DELETE on the table.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nex_music_publish_idempotency_cleanup()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.nex_music_publish_idempotency
     WHERE expires_at < clock_timestamp()
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_deleted FROM deleted;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION nex_music_publish_idempotency_cleanup IS
  'NEX scheduled sweep for expired music-publish idempotency rows · service_role invokes via RPC · SECURITY DEFINER writes under function owner privileges even after Option X REVOKEs service_role direct DELETE · M-1 2026-10-30.';

-- ============================================================================
-- Part E · RLS · authenticated-only metadata (D2); dedup is service-role only
-- ============================================================================

ALTER TABLE nex_creator_active_music ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_music_publish_idempotency ENABLE ROW LEVEL SECURITY;

-- D2 lock · Option 2a · NO direct-client SELECT path on nex_creator_active_music.
-- ALL metadata reads flow through the server-side feed reader (service_role
-- via nexSupabaseAdmin). Service_role bypasses RLS entirely. The SECURITY
-- DEFINER publish function also bypasses RLS (runs under the function
-- owner's privileges). Authenticated clients cannot query this table
-- directly · the server-side reader's JOIN with nex_music_track filters
-- removed/revoked tracks that a bare RLS predicate on this table alone
-- could not catch.

-- No CREATE POLICY statements on nex_creator_active_music · no direct-client
-- read path. No INSERT/UPDATE/DELETE policies on either table · writes flow
-- exclusively through the SECURITY DEFINER functions.

-- No SELECT/INSERT/UPDATE/DELETE policies on nex_music_publish_idempotency.
-- Service_role audit reads bypass RLS. Writes flow through the two
-- SECURITY DEFINER functions above.

-- ============================================================================
-- Part F · Table privileges · Option X enforcement
-- ============================================================================
--
-- Option X · REVOKE INSERT/UPDATE/DELETE from all roles on both tables ·
-- writes flow only through the SECURITY DEFINER functions (which run under
-- the function owner's privileges, not the invoker's).
--
-- SELECT · GRANTed to service_role only (admin / feed-reader path).
-- Under D2 Option 2a, authenticated and anon have NO SELECT grant on
-- nex_creator_active_music · all metadata reads go through the server-side
-- feed reader. Dedup table SELECT is also service_role only.
-- ----------------------------------------------------------------------------

REVOKE INSERT, UPDATE, DELETE ON nex_creator_active_music       FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON nex_creator_active_music       FROM anon;
REVOKE INSERT, UPDATE, DELETE ON nex_creator_active_music       FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON nex_creator_active_music       FROM service_role;

REVOKE INSERT, UPDATE, DELETE ON nex_music_publish_idempotency  FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON nex_music_publish_idempotency  FROM anon;
REVOKE INSERT, UPDATE, DELETE ON nex_music_publish_idempotency  FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON nex_music_publish_idempotency  FROM service_role;

GRANT SELECT                   ON nex_creator_active_music      TO service_role;
-- No SELECT grant to anon or authenticated (D2 Option 2a) · all metadata
-- reads go via the server-side feed reader, which runs under service_role
-- and JOINs with nex_music_track to filter removed/revoked tracks.

GRANT SELECT                   ON nex_music_publish_idempotency TO service_role;
-- No SELECT grant to anon or authenticated · dedup table is service-only.

-- ============================================================================
-- Part G · Function execute privileges · R7-2 lock
-- ============================================================================
--
-- Explicit · do not rely on default retention after REVOKE FROM PUBLIC.
-- Both functions are callable only by service_role (via nexSupabaseAdmin.rpc).
-- Direct anon/authenticated calls return `permission denied for function`.
-- ----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION nex_music_publish_as_active_slot(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION nex_music_publish_as_active_slot(uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION nex_music_publish_as_active_slot(uuid, uuid, uuid, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION nex_music_publish_as_active_slot(uuid, uuid, uuid, text) TO   service_role;

REVOKE EXECUTE ON FUNCTION nex_music_publish_idempotency_cleanup()                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION nex_music_publish_idempotency_cleanup()                  FROM anon;
REVOKE EXECUTE ON FUNCTION nex_music_publish_idempotency_cleanup()                  FROM authenticated;
GRANT  EXECUTE ON FUNCTION nex_music_publish_idempotency_cleanup()                  TO   service_role;

-- ============================================================================
-- Part H · Migration ledger
-- ============================================================================

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '236',
  'nex_creator_active_music + nex_music_publish_idempotency + two SECURITY DEFINER functions · M-1 of NEX Music Publishing · Option X hard-enforce + R7-2 explicit service_role GRANT + D2 authenticated-only metadata + Option C1 explicit SQLSTATE codes · owner-authorised design per sealed memory 2026-10-30',
  'AUTHORED only · not applied to any database. All D11-* operational decisions remain unsealed. Rights-ack table (Migration 237) is a separate owner authorisation. Depends on Migration 235 (nex_music_track) being applied first. Rollback is destructive if active-slot rows exist · pg_dump + verified staging restore rehearsal required before any production rollback.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Rollback (manual · single transaction · destructive if any rows exist)
-- ============================================================================
--
-- Pre-rollback MANDATORY: `pg_dump --table=public.nex_creator_active_music
--   --table=public.nex_music_publish_idempotency > backup.sql` and verify
-- restorable on a staging database before executing on production.
--
-- BEGIN;
--   DROP FUNCTION IF EXISTS nex_music_publish_idempotency_cleanup();
--   DROP FUNCTION IF EXISTS nex_music_publish_as_active_slot(uuid, uuid, uuid, text);
--   DROP TABLE    IF EXISTS nex_music_publish_idempotency CASCADE;
--   DROP TABLE    IF EXISTS nex_creator_active_music CASCADE;
--   DELETE FROM nex_migration_history WHERE version = '236';
-- COMMIT;
--
-- CASCADE drops any dependent indexes + RLS policies defined above.
-- Dependent FKs are limited to this migration's own scope · no other
-- tables point into nex_creator_active_music or nex_music_publish_idempotency.
-- Rolling back does NOT affect nex_music_track or nex_account.
-- ============================================================================
