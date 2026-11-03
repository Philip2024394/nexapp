-- scripts/audit/b0-device-key-coverage.sql
--
-- Stage B0-B · owner-authorised 2026-11-03 (local draft only)
-- -----------------------------------------------------------------------------
-- Returns ONLY aggregate counts (zero PII) for the Option 2 plaintext-freeze
-- impact assessment. Not for production execution without separate
-- authorisation. Safe to review in-repo.
--
-- Schema anchors (verified against actual migrations before writing):
--   · nex_account                 (001) · columns: id, supabase_user_id,
--                                        display_name, created_at
--     ·  no last_sign_in_at or deleted_at column exists on nex_account
--     ·  the owner's "active" signal must therefore come from a different
--        source · we use TWO independent signals and report both so a
--        single stale signal doesn't understate blast radius
--   · nex_peer_conversation       (047) · columns: id, participant_a_id,
--                                        participant_b_id, created_at,
--                                        last_message_at
--     ·  participant_a_id < participant_b_id canonical ordering
--   · nex_peer_message            (047 + 093 + 054) · immutable append-log
--     ·  encrypted boolean (false = plaintext path · >= 093 defaults false
--        on legacy rows, true on new encrypted-path rows)
--   · nex_account_device_key      (092) · columns: id, account_id, device_id,
--                                        public_key, created_at, last_seen_at
--     ·  revoked_at NOT present in 092 · added in 141 under Vault Phase A ·
--        this query uses `revoked_at IS NULL` as the "trusted-currently"
--        predicate · if the column truly doesn't exist in the target DB,
--        the query will fail cleanly with "column does not exist" rather
--        than silently return wrong numbers
--
-- Owner's six required categories (corrects the previous blueprint which
-- under-counted by filtering on sign-in activity · the previous query
-- excluded conversations where one participant had been inactive 30 days
-- even if those conversations were the exact ones most at risk of silent
-- freeze):
--
--   1. active_accounts_with_device_key
--   2. active_accounts_without_device_key
--   3. recent_conversations_both_keyed
--   4. recent_conversations_sender_keyed_recipient_not
--   5. recent_conversations_sender_not_keyed
--   6. recent_conversations_participant_inactive
--
-- "Recent conversation" = last_message_at >= now() - interval '30 days'
-- "Active account"      = account has ANY device_key row with last_seen_at
--                         >= now() - 30 days  OR  participates in a recent
--                         conversation. We report BOTH signals so the owner
--                         can judge whether to trust them separately.
--
-- Returns ONE row with 10 columns · 9 integer counts + 1 timestamp
-- (`run_at`, which is `now()` captured at execution and is not PII).
-- No account_ids, no device_ids, no display names, no email hashes.
-- Zero row-level data. Safe to share by email.

WITH
  -- Any account participating in a conversation that saw a message in 30d
  participants_of_recent_conv AS (
    SELECT DISTINCT a.id AS account_id
    FROM nex_account a
    JOIN nex_peer_conversation c
      ON (c.participant_a_id = a.id OR c.participant_b_id = a.id)
    WHERE c.last_message_at >= now() - interval '30 days'
  ),
  -- Any account whose device_key last_seen_at is within 30 days
  accounts_with_recent_device AS (
    SELECT DISTINCT k.account_id
    FROM nex_account_device_key k
    WHERE k.last_seen_at >= now() - interval '30 days'
      AND k.revoked_at IS NULL
  ),
  -- Union of both signals · "activity" via either path
  active_accounts AS (
    SELECT account_id FROM participants_of_recent_conv
    UNION
    SELECT account_id FROM accounts_with_recent_device
  ),
  -- Account has ANY non-revoked device key (freeze-ready)
  accounts_with_any_key AS (
    SELECT DISTINCT account_id
    FROM nex_account_device_key
    WHERE revoked_at IS NULL
  ),
  -- Conversations active in the last 30 days
  recent_conversations AS (
    SELECT
      c.id,
      c.participant_a_id,
      c.participant_b_id,
      -- Who was the MOST RECENT sender in this conversation · they would
      -- be blocked first if the plaintext freeze fires without their key
      (
        SELECT m.sender_account_id
        FROM nex_peer_message m
        WHERE m.conversation_id = c.id
        ORDER BY m.sent_at DESC
        LIMIT 1
      ) AS most_recent_sender_id
    FROM nex_peer_conversation c
    WHERE c.last_message_at >= now() - interval '30 days'
  ),
  classified_recent AS (
    SELECT
      r.id,
      r.participant_a_id IN (SELECT account_id FROM active_accounts) AS a_active,
      r.participant_b_id IN (SELECT account_id FROM active_accounts) AS b_active,
      r.participant_a_id IN (SELECT account_id FROM accounts_with_any_key) AS a_keyed,
      r.participant_b_id IN (SELECT account_id FROM accounts_with_any_key) AS b_keyed,
      r.most_recent_sender_id,
      r.participant_a_id,
      r.participant_b_id
    FROM recent_conversations r
  )
SELECT
  -- Category 1 · active accounts with a device key
  (
    SELECT count(*) FROM active_accounts a
    WHERE a.account_id IN (SELECT account_id FROM accounts_with_any_key)
  ) AS active_accounts_with_device_key,

  -- Category 2 · active accounts WITHOUT a device key (will be blocked
  -- by freeze until they open the app on a device that provisions one)
  (
    SELECT count(*) FROM active_accounts a
    WHERE a.account_id NOT IN (SELECT account_id FROM accounts_with_any_key)
  ) AS active_accounts_without_device_key,

  -- Category 3 · recent conversations where BOTH participants are keyed
  -- These continue to work normally after freeze.
  (
    SELECT count(*) FROM classified_recent c
    WHERE c.a_keyed AND c.b_keyed
  ) AS recent_conversations_both_keyed,

  -- Category 4 · recent conversations where the MOST RECENT SENDER has
  -- a key but the OTHER participant does not. The next time the sender
  -- tries to send, encrypted-path fan-out will fail against the keyless
  -- recipient device. These are the "silent-freeze blast radius" rows.
  (
    SELECT count(*) FROM classified_recent c
    WHERE (
      (c.most_recent_sender_id = c.participant_a_id AND c.a_keyed AND NOT c.b_keyed)
      OR
      (c.most_recent_sender_id = c.participant_b_id AND c.b_keyed AND NOT c.a_keyed)
    )
  ) AS recent_conversations_sender_keyed_recipient_not,

  -- Category 5 · recent conversations where the MOST RECENT SENDER does
  -- not have a key. Freeze blocks their next send until they provision
  -- a key by opening the app (device-key-hub auto-provisions on open).
  (
    SELECT count(*) FROM classified_recent c
    WHERE (
      (c.most_recent_sender_id = c.participant_a_id AND NOT c.a_keyed)
      OR
      (c.most_recent_sender_id = c.participant_b_id AND NOT c.b_keyed)
    )
  ) AS recent_conversations_sender_not_keyed,

  -- Category 6 · recent conversations where AT LEAST ONE participant is
  -- inactive by both signals. These may be dead chats OR users who just
  -- happen to be on a long break · counted separately so we don't
  -- conflate them with freeze-blocked conversations.
  (
    SELECT count(*) FROM classified_recent c
    WHERE NOT c.a_active OR NOT c.b_active
  ) AS recent_conversations_participant_inactive,

  -- Diagnostic · total recent conversations (sanity check for sum)
  (
    SELECT count(*) FROM recent_conversations
  ) AS recent_conversations_total,

  -- Diagnostic · total active accounts (sanity check)
  (
    SELECT count(*) FROM active_accounts
  ) AS active_accounts_total,

  -- Diagnostic · run timestamp
  now() AS run_at,

  -- Diagnostic · explicit signal that revoked_at column exists on
  -- device_key (migration 141 applied) · if the query fails here with
  -- "column does not exist", the target DB predates 141 and the audit
  -- needs to run the pre-141 variant (ask owner · do not auto-fallback)
  (
    SELECT count(*) FROM nex_account_device_key WHERE revoked_at IS NULL
  ) AS device_keys_not_revoked_total;
