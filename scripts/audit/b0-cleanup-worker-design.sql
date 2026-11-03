-- scripts/audit/b0-cleanup-worker-design.sql
--
-- Stage B0-C-light · owner-authorised 2026-11-03 (design artefact · DRAFT)
-- -----------------------------------------------------------------------------
-- Corrected cleanup-worker SQL for Option 2 all-devices-ACK + TTL sweep.
--
-- Context · this file supersedes the pseudocode in the previous blueprint,
-- which proposed `SELECT DISTINCT ... FOR UPDATE SKIP LOCKED` on
-- nex_peer_message. PostgreSQL does not permit that combination (DISTINCT
-- and locking clauses are mutually exclusive on the same SELECT). The
-- corrected pattern locks candidate ROWS first, then derives distinct
-- GROUPS from the locked set in a subsequent CTE step.
--
-- Correction 2 · the device-key join uses the composite (account_id,
-- device_id) key · migration 092 declares `UNIQUE (account_id, device_id)`
-- so device_id alone is NOT globally unique. We derive the recipient
-- account_id from the conversation participants (recipient = whichever
-- participant is NOT the sender).
--
-- Correction 3 · owner-authorised 2026-11-03 (revised) · missing
-- device-key records go to QUARANTINE · NEVER automatic cleanup.
-- A missing k.id row for a target device_id does not reliably mean
-- the device is revoked · it could mean:
--   · a temporarily unavailable key-service query
--   · an incomplete device registration mid-write
--   · an inadvertent/unexpected delete of the device_key row
--   · a schema-migration transient
-- Deleting queued ciphertext in any of those situations could
-- permanently lose messages for an offline recipient. The cleanup
-- worker's five eligibility inputs are now:
--
--   ACKED                 · delivered_at IS NOT NULL
--   TTL_EXPIRED           · ttl_expires_at < now()
--   REVOKED_BEFORE_SEND   · device existed BUT revoked_at <= sent_at
--                           (row should not have been created · dead
--                           on arrival · safe to clean up)
--   REVOKED_AFTER_SEND    · device existed when sent, revoked after,
--                           NOT yet delivered, NOT yet TTL-expired
--                           → RETAIN until TTL (there may be an in-
--                           flight delivery already fetched by the
--                           device just before revocation · we don't
--                           know for certain · wait for the TTL to
--                           settle the question).
--   MISSING_KEY           · k.id IS NULL · routed to the quarantine
--                           queue · NOT deleted. A separate human-
--                           reviewed workflow examines quarantined
--                           groups and chooses one of: register the
--                           missing device-key record (ops), purge
--                           after confirming device is truly gone,
--                           or wait longer. The cleanup worker never
--                           deletes a group that contains any missing-
--                           key row.
--
-- This file is NOT a migration · not applied automatically · it is
-- the authoritative SQL design that a future stage (B4 · all-devices-ACK
-- sweep) would ship once separately authorised.
--
-- Companion table referenced below:
--   nex_message_group_quarantine
--     message_group_id       uuid PK
--     first_flagged_at       timestamptz
--     reason                 text  CHECK IN ('missing_device_key')
--     rows_count             int
--     missing_device_ids     text[]
--     reviewed_at            timestamptz NULL
--     reviewed_by            uuid NULL
--     resolution             text NULL  CHECK IN ('registered','purged','waiting')
--   The quarantine table is populated by a SEPARATE worker scan
--   (defined after the cleanup query below). The cleanup worker and
--   the quarantine worker share zero mutation surface · they operate
--   on disjoint input predicates.

-- -----------------------------------------------------------------------------
-- Prerequisites referenced below (NOT yet created · listed for completeness)
-- -----------------------------------------------------------------------------
--   nex_peer_message
--     + ttl_expires_at         timestamptz    (added by future M-260)
--     + attachment_storage_path text          (added by future M-261)
--     + recipient_device_id    text           (added by Bridge 76 · 093)
--     + sender_account_id      uuid           (base 047)
--     + conversation_id        uuid           (base 047)
--     + delivered_at           timestamptz    (added by 093)
--   nex_peer_conversation
--     + participant_a_id       uuid           (base 047)
--     + participant_b_id       uuid           (base 047)
--   nex_account_device_key
--     + account_id             uuid           (base 092)
--     + device_id              text           (base 092)
--     + revoked_at             timestamptz    (added by 141)
--     + UNIQUE (account_id, device_id)        (base 092)
--   nex_attachment_purge_queue
--     + storage_path           text PK        (future M-263)
--     + enqueued_at            timestamptz    (future M-263)
--     + attempts               int DEFAULT 0  (future M-263)

-- -----------------------------------------------------------------------------
-- Cleanup worker · runs every 5 minutes on a dedicated cron
-- -----------------------------------------------------------------------------
-- Concurrency-safe:
--   · FOR UPDATE OF m SKIP LOCKED on the row-level CTE lets multiple
--     worker instances run in parallel without stepping on each other.
--   · Idempotent: a repeat run processes zero rows if nothing new
--     became cleanup-eligible between runs.
--   · Deletion + attachment enqueue happen in ONE transaction · we
--     never delete a row and then forget to enqueue its attachment.
--
-- This is the authoritative SQL. Review it against the real schema
-- before applying.

BEGIN;

WITH
  -- Step 1 · lock candidate rows (one row per fan-out destination).
  -- A row is a candidate when its OWN state is cleanup-eligible, i.e.
  -- the row cannot (or need not) be delivered. We lock these rows so
  -- a parallel worker can't try to re-ACK them under us. We use a
  -- plain SELECT · no DISTINCT · no aggregation · so FOR UPDATE is
  -- legal.
  candidate_rows AS (
    SELECT
      m.id,
      m.message_group_id,
      m.conversation_id,
      m.sender_account_id,
      m.recipient_device_id,
      m.attachment_storage_path,
      m.delivered_at,
      m.ttl_expires_at,
      m.sent_at
    FROM nex_peer_message m
    LEFT JOIN nex_peer_conversation c
      ON c.id = m.conversation_id
    -- Derive the recipient account_id · the conversation participant
    -- that is NOT the sender.
    LEFT JOIN LATERAL (
      SELECT CASE
        WHEN c.participant_a_id = m.sender_account_id THEN c.participant_b_id
        WHEN c.participant_b_id = m.sender_account_id THEN c.participant_a_id
        ELSE NULL
      END AS recipient_account_id
    ) r ON TRUE
    -- Join device_key on BOTH (account_id, device_id) · the UNIQUE
    -- constraint from migration 092 scopes the match correctly even if
    -- the same device_id string happened to be reused by a different
    -- account. Correction 2.
    LEFT JOIN nex_account_device_key k
      ON  k.account_id = r.recipient_account_id
      AND k.device_id  = m.recipient_device_id
    WHERE
      -- Row is cleanup-eligible IF any one of these holds. Note:
      -- k.id IS NULL (MISSING_KEY) is deliberately NOT in this list
      -- · those rows are picked up by the quarantine worker (defined
      -- separately below) and never auto-deleted by the cleanup
      -- worker. See Correction 3 at the top of this file.
      m.delivered_at IS NOT NULL                                  -- ACKED
      OR m.ttl_expires_at < now()                                 -- TTL_EXPIRED
      OR (
        -- REVOKED_BEFORE_SEND · device existed in the registry when
        -- the sender encrypted (otherwise the row wouldn't exist with
        -- this recipient_device_id) BUT the revoked_at timestamp
        -- predates the send. The row is a sender-side artefact that
        -- should never have been persisted · safe to clean up.
        k.id IS NOT NULL
        AND k.revoked_at IS NOT NULL
        AND k.revoked_at <= m.sent_at
      )
      -- Deliberately NOT included:
      --   REVOKED_AFTER_SEND · k.revoked_at > m.sent_at AND
      --   delivered_at IS NULL AND ttl_expires_at >= now() · we RETAIN
      --   those rows until TTL expiry. A device that was legitimate at
      --   send time + revoked afterwards may have already fetched the
      --   message in the window before revocation · we cannot know
      --   without an explicit delivered_at. Waiting for TTL settles it
      --   deterministically.
      --
      --   MISSING_KEY · k.id IS NULL · routed to the quarantine queue
      --   by a separate worker · never deleted here.
    ORDER BY m.sent_at
    LIMIT 10000
    FOR UPDATE OF m SKIP LOCKED
  ),

  -- Step 2 · derive the distinct candidate groups from the LOCKED
  -- rows · DISTINCT allowed here because this CTE is read-only.
  candidate_groups AS (
    SELECT DISTINCT message_group_id
    FROM candidate_rows
  ),

  -- Step 3 · filter to groups where EVERY row (not only the ones we
  -- locked) is cleanup-eligible. Three distinct patterns can block a
  -- group:
  --   · an UNDELIVERED row within TTL targeting a trusted device
  --   · an UNDELIVERED row for a device REVOKED_AFTER_SEND (we wait
  --     for TTL)
  --   · ANY row with k.id IS NULL (missing-key · quarantine, not
  --     delete · see Correction 3)
  -- The NOT EXISTS predicate matches ALL THREE blocker patterns.
  sweepable_groups AS (
    SELECT g.message_group_id
    FROM candidate_groups g
    WHERE NOT EXISTS (
      SELECT 1
      FROM nex_peer_message m2
      LEFT JOIN nex_peer_conversation c2
        ON c2.id = m2.conversation_id
      LEFT JOIN LATERAL (
        SELECT CASE
          WHEN c2.participant_a_id = m2.sender_account_id THEN c2.participant_b_id
          WHEN c2.participant_b_id = m2.sender_account_id THEN c2.participant_a_id
          ELSE NULL
        END AS recipient_account_id
      ) r2 ON TRUE
      LEFT JOIN nex_account_device_key k2
        ON  k2.account_id = r2.recipient_account_id
        AND k2.device_id  = m2.recipient_device_id
      WHERE m2.message_group_id = g.message_group_id
        AND (
          -- Blocker 1 · UNDELIVERED + within TTL + known-trusted device
          -- (either not revoked, or revoked AFTER send and still within
          -- the TTL window)
          (
            m2.delivered_at IS NULL
            AND m2.ttl_expires_at >= now()
            AND k2.id IS NOT NULL
            AND (k2.revoked_at IS NULL OR k2.revoked_at > m2.sent_at)
          )
          OR
          -- Blocker 2 · ANY row with a missing device-key record. This
          -- is the critical correction: the whole group stays alive
          -- until the quarantine worker + an operator decide what to
          -- do. One missing-key row cannot destroy delivery to other
          -- trusted recipient devices in the same fan-out.
          k2.id IS NULL
        )
    )
  ),

  -- Step 4 · enqueue attachment references BEFORE deleting the rows,
  -- so a worker crash between CTEs doesn't orphan the bucket objects.
  attachment_enqueue AS (
    INSERT INTO nex_attachment_purge_queue (storage_path, enqueued_at, attempts)
    SELECT DISTINCT m.attachment_storage_path, now(), 0
    FROM nex_peer_message m
    WHERE m.message_group_id IN (SELECT message_group_id FROM sweepable_groups)
      AND m.attachment_storage_path IS NOT NULL
    ON CONFLICT (storage_path) DO NOTHING
    RETURNING 1
  ),

  -- Step 5 · delete the message rows · ciphertext gone from server.
  row_delete AS (
    DELETE FROM nex_peer_message
    WHERE message_group_id IN (SELECT message_group_id FROM sweepable_groups)
    RETURNING 1
  )
SELECT
  (SELECT count(*) FROM sweepable_groups)   AS groups_swept,
  (SELECT count(*) FROM attachment_enqueue) AS attachments_enqueued,
  (SELECT count(*) FROM row_delete)         AS rows_deleted,
  now()                                     AS run_at;

COMMIT;

-- -----------------------------------------------------------------------------
-- QUARANTINE WORKER · separate · runs every 15 minutes
-- -----------------------------------------------------------------------------
-- Scans for groups containing ANY row with a missing device-key record
-- (k.id IS NULL after the composite join). Upserts one row per such
-- group into nex_message_group_quarantine for human review. Never
-- deletes anything · never ACKs anything · pure read-and-flag.
--
-- Operator workflow (out of band · not SQL):
--   1. Alerting pipeline watches COUNT(*) FROM nex_message_group_quarantine
--      WHERE reviewed_at IS NULL · pages ops if above threshold.
--   2. Operator inspects a quarantined group · identifies the missing
--      device_ids · chooses a resolution:
--        · 'registered' · the device-key record is re-created (either
--          the device re-registered itself, or an ops repair) ·
--          cleanup worker will handle the group normally next cycle.
--        · 'purged'     · operator confirms the device is truly gone ·
--          manually marks each row's recipient_device_id as if revoked
--          (requires a separate authorised SQL · documented but not
--          wired here).
--        · 'waiting'    · operator doesn't have enough info · leaves
--          the group quarantined · the TTL will eventually expire the
--          group via the normal cleanup predicate.
--
-- Zero deletion authority. The quarantine worker is a safety net, not
-- a destructive path.

BEGIN;

INSERT INTO nex_message_group_quarantine (
  message_group_id,
  first_flagged_at,
  reason,
  rows_count,
  missing_device_ids
)
SELECT
  m.message_group_id,
  now(),
  'missing_device_key',
  COUNT(*) FILTER (WHERE k.id IS NULL),
  array_agg(DISTINCT m.recipient_device_id) FILTER (WHERE k.id IS NULL)
FROM nex_peer_message m
LEFT JOIN nex_peer_conversation c
  ON c.id = m.conversation_id
LEFT JOIN LATERAL (
  SELECT CASE
    WHEN c.participant_a_id = m.sender_account_id THEN c.participant_b_id
    WHEN c.participant_b_id = m.sender_account_id THEN c.participant_a_id
    ELSE NULL
  END AS recipient_account_id
) r ON TRUE
LEFT JOIN nex_account_device_key k
  ON  k.account_id = r.recipient_account_id
  AND k.device_id  = m.recipient_device_id
WHERE k.id IS NULL
GROUP BY m.message_group_id
ON CONFLICT (message_group_id) DO UPDATE SET
  rows_count         = EXCLUDED.rows_count,
  missing_device_ids = EXCLUDED.missing_device_ids
WHERE nex_message_group_quarantine.reviewed_at IS NULL;
-- The WHERE clause on the UPSERT means we never overwrite an operator
-- resolution · reviewed groups are left alone even if the condition
-- re-triggers.

COMMIT;

-- -----------------------------------------------------------------------------
-- Operational notes
-- -----------------------------------------------------------------------------
--   · Run cadence: every 5 minutes via cron (adjust based on load).
--   · Parallelism safe: SKIP LOCKED ensures multiple worker instances
--     don't fight. Each run processes up to 10 000 rows · tune the LIMIT.
--   · Observability: the final SELECT returns three counts the worker
--     logs to its runtime metrics table. If `groups_swept` plateaus near
--     the LIMIT for several runs, raise the LIMIT; if it stays at 0 for
--     days, investigate stuck device-keys OR missing-key policy drift.
--   · Error handling: a worker crash between COMMIT and the next cron
--     cycle leaves zero inconsistency because the whole thing is one
--     transaction. If the transaction itself fails mid-flight, nothing
--     changes · the cron re-runs and locks the same candidate rows.
--   · Missing-key policy (Correction 3 · owner-authorised 2026-11-03):
--     missing-key rows are routed to the SEPARATE quarantine worker
--     above. The main cleanup worker never deletes a group that
--     contains a missing-key row. The quarantine worker only inserts
--     into nex_message_group_quarantine · it never deletes a message
--     row. Operator action is required to resolve quarantined groups.
--
--   · Revoked-before vs revoked-after distinction:
--       REVOKED_BEFORE_SEND (k.revoked_at <= m.sent_at)
--         The device was already dead when the sender encrypted.
--         The row is a sender-side artefact · cleanup is safe · the
--         row cannot have been delivered because the device no longer
--         exists in the registry.
--       REVOKED_AFTER_SEND (k.revoked_at > m.sent_at)
--         The device existed when the sender encrypted · the recipient
--         may or may not have fetched the ciphertext in the window
--         between send and revocation. We RETAIN until TTL expiry so
--         we don't lose a message that was legitimately in-flight.
--         This is the conservative choice.
--
--   · Transaction ordering · the attachment_enqueue CTE lists BEFORE
--     the row_delete CTE in the WITH chain. In PostgreSQL, data-
--     modifying CTEs in the same statement use a SINGLE snapshot of
--     sweepable_groups · the INSERT and DELETE both reference it ·
--     the commit lands both atomically. No window where a row is
--     deleted but its attachment reference is not enqueued.
