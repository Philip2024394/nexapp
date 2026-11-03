# B0 · final static concurrency + recovery review

Owner-authorised 2026-11-03 (static review only · no SQL changes, no DB touched, no infrastructure modified, no migrations drafted). Addresses the three open points raised against the cleanup worker design in `b0-cleanup-worker-design.sql`.

Scope · design review of three concerns:

1. Group-locking proof · can two workers process the same `message_group_id` concurrently?
2. Attachment deletion recovery · what happens when the external Supabase Storage DELETE fails?
3. Quarantine SLA · how do we prevent the quarantine table becoming an indefinite silent backlog?

Each concern is reviewed, honest findings are stated, and a concrete design proposal is attached. **No proposal is authorised for implementation.**

---

## Concern 1 · Group-level concurrency

### Finding

`FOR UPDATE SKIP LOCKED` on `candidate_rows` serialises **row** access, not **group** access. The current design is vulnerable to the following race:

> Two cleanup workers run in overlapping windows. Group `G` contains four candidate rows `{r1, r2, r3, r4}` all cleanly cleanup-eligible (e.g., all ACKED). Worker A's `SKIP LOCKED` grabs `{r1, r2}`. Worker B's `SKIP LOCKED` grabs `{r3, r4}`. Each worker's `sweepable_groups` NOT EXISTS predicate scans **all** rows of `G` via a plain `SELECT` on the committed snapshot that existed when the worker started; each sees four cleanup-eligible rows and no blockers. Each worker sweeps "its" subset and commits.

**Correctness:** both workers agreed the group was fully sweepable, so the group ends up fully deleted. This is not a data-loss race. **However**:

- `attachment_enqueue` may insert duplicate purge-queue rows for storage objects referenced by both subsets.
- Observability is confusing: metrics will double-count sweeps for the same group.
- If worker A's locked rows are later rolled back (crash before commit), worker B's half of the sweep is already committed · the group ends in a half-swept inconsistent state until A retries.
- The real risk is subtle: if `candidate_rows` ever broadens (e.g., a future author adds a case we haven't thought of), the group-level NOT EXISTS predicate is the only correctness anchor and it is **not** mutually exclusive with another worker's view.

The concern is correct: row-level `SKIP LOCKED` is not sufficient proof of group-level mutual exclusion.

### Design proposal · transaction-scoped advisory lock

Use PostgreSQL's `pg_try_advisory_xact_lock(key1 int8, key2 int8)` keyed by two bigint halves of the group UUID. The lock is held for the lifetime of the transaction and auto-released on COMMIT/ROLLBACK · no claim table, no stale-claim recovery.

Proposed shape (**design only · not authorised**):

```sql
-- Convert the 128-bit UUID to two bigints for the two-arg form.
-- Two 64-bit halves of the UUID are collision-safe for advisory locks.
WITH
  claimable_groups AS (
    SELECT g.message_group_id
    FROM candidate_group_ids g
    WHERE pg_try_advisory_xact_lock(
      ('x' || substring(g.message_group_id::text, 1, 16))::bit(64)::bigint,
      ('x' || substring(replace(g.message_group_id::text, '-', ''), 17, 16))::bit(64)::bigint
    )
  ),
  candidate_rows AS (
    SELECT …
    FROM nex_peer_message m
    JOIN claimable_groups cg ON cg.message_group_id = m.message_group_id
    LEFT JOIN …
    WHERE …
    FOR UPDATE SKIP LOCKED
  ),
  …
```

A worker that cannot acquire the advisory lock for a group skips it this tick and picks it up next tick. The already-locking worker completes its sweep and releases on COMMIT.

### Why not a dedicated claim table

A `nex_message_group_cleanup_claim` table was considered. Rejected for this concern because:

- Advisory locks need no schema change.
- Advisory locks auto-release · no stale-claim sweeper required.
- Claim-table rows persist across restarts, which is useful for audit but is not what this concern asks for.

A claim table remains the right pattern **for the quarantine SLA** (concern 3) where audit history matters.

### Residual risk

- `substring` + hex conversion must be verified against PostgreSQL version · a syntax error here would silently fail to lock. The implementation stage must include a test case asserting `pg_try_advisory_xact_lock` returns `false` on a second concurrent attempt in the same session.
- Advisory locks are process-local to the connection; they correctly serialise across sessions on the same database. Not applicable to cross-database or cross-cluster deployments · if the worker is ever sharded, this must be revisited.
- Hash collisions on 128 bits of UUID into two 64-bit integers are negligible for the UUID v4 space but non-zero in principle · acceptable for this use case.

---

## Concern 2 · Attachment deletion recovery

### Finding

The current design enqueues attachment references in the same transaction that deletes message rows. Correct in principle: no row disappears without its attachment reference being durably queued.

**But** the actual Storage DELETE happens outside PostgreSQL · against Supabase Storage over HTTP. The database transaction cannot guarantee that call succeeds. The current design does not specify:

- Retry policy for transient failures (network, 5xx).
- How to distinguish permanent failure (object does not exist · already purged · acceptable) from retriable failure (quota exceeded · 500 · timeout).
- What happens when retries are exhausted.
- Who is notified when the purge queue depth grows.
- Idempotency guarantees under worker restart mid-DELETE.

Without those, a failed Storage DELETE either silently loops forever on the queue or silently vanishes. Both are unacceptable for a privacy-sensitive system.

### Design proposal · durable queue + bounded retry + dead-letter

Queue schema (**design only · not authorised**):

```sql
nex_message_attachment_purge_queue (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_bucket       text        NOT NULL,
  storage_object_key   text        NOT NULL,
  enqueued_at          timestamptz NOT NULL DEFAULT now(),
  next_attempt_at      timestamptz NOT NULL DEFAULT now(),
  attempt_count        int         NOT NULL DEFAULT 0,
  last_attempted_at    timestamptz,
  last_error           text,
  purged_at            timestamptz,                 -- success terminal state
  dead_lettered_at     timestamptz,                 -- failure terminal state
  UNIQUE (storage_bucket, storage_object_key)       -- dedup across group races
)
```

Purge-worker loop (**design only**):

```
1. SELECT … FROM nex_message_attachment_purge_queue
   WHERE purged_at IS NULL
     AND dead_lettered_at IS NULL
     AND next_attempt_at <= now()
   ORDER BY next_attempt_at
   LIMIT 100
   FOR UPDATE SKIP LOCKED;

2. For each row, call Supabase Storage DELETE.
   · HTTP 200 or 404  → UPDATE row SET purged_at = now().
   · HTTP 429/5xx     → UPDATE row SET
                          attempt_count = attempt_count + 1,
                          last_attempted_at = now(),
                          last_error = <summary>,
                          next_attempt_at = now() + exp_backoff(attempt_count).
   · HTTP 4xx (other) → UPDATE row SET
                          attempt_count = attempt_count + 1,
                          last_attempted_at = now(),
                          last_error = <summary>,
                          dead_lettered_at = now()  -- unrecoverable.

3. After each row's HTTP call completes, COMMIT that row's UPDATE immediately.
   Do NOT batch multiple HTTP calls inside one DB transaction (keeps locks
   long + risks worker crash leaving many rows uncommitted).
```

Exponential backoff: `min(60s * 2^attempt_count, 24h)` capped at 10 attempts, then dead-letter.

Dead-letter policy: a dashboard query of `COUNT(*) WHERE dead_lettered_at IS NOT NULL` pages ops. Manual investigation required · dead-lettered rows represent orphan storage objects (ciphertext left in Supabase but unreferenced from the DB). Must be resolved by operator (either manual DELETE via Supabase console or re-queue after fixing the underlying failure cause).

Idempotency guarantees:

- `UNIQUE (storage_bucket, storage_object_key)` on the queue means duplicate enqueues from the group-level race (concern 1 residue) are coalesced. The second INSERT inside `attachment_enqueue` must use `ON CONFLICT DO NOTHING`.
- Storage DELETE 404 is treated as success (object already gone · idempotent).
- Mid-DELETE worker crash is safe: the row stays locked only for the transaction; on crash the lock is released, the row returns to the pool, and the next worker retries.

### Observability requirements (unresolved)

- Queue depth metric: `COUNT(*) WHERE purged_at IS NULL AND dead_lettered_at IS NULL`.
- Oldest unpurged attachment age: `now() - MIN(enqueued_at) WHERE purged_at IS NULL`.
- Dead-letter depth: `COUNT(*) WHERE dead_lettered_at IS NOT NULL`.
- Alert thresholds: not yet defined · ops decision.
- SLO: not yet defined · the "cannot promise permanent deletion" honesty must be reflected in whatever we promise the user.

---

## Concern 3 · Quarantine SLA

### Finding

The quarantine worker populates `nex_message_group_quarantine` but the design does not define:

- Who owns resolving quarantined groups.
- What visibility ops has into the backlog.
- Alert thresholds.
- Target resolution SLA.
- What happens if a group sits in quarantine indefinitely.

The last point is the subtlest. The current cleanup worker's `sweepable_groups` NOT EXISTS predicate treats a missing-key row as a hard blocker regardless of TTL. **This means a quarantined group whose TTL has expired is still not swept.** NEX holds the ciphertext until an operator resolves the quarantine. That is correct per the owner's "do not automatically delete the message group" directive, but it creates unbounded growth if resolution is slow.

### Design proposal · operational contract

(**Design only · not authorised · requires ops stakeholder sign-off before any implementation.**)

Required artefacts before quarantine goes live:

1. **Dashboard panel · "Quarantine backlog"**
   - Current unreviewed count · `COUNT(*) WHERE reviewed_at IS NULL`
   - Oldest unreviewed age · `now() - MIN(first_flagged_at) WHERE reviewed_at IS NULL`
   - Per-reason breakdown · `GROUP BY reason`
   - Weekly resolution histogram · for trend analysis

2. **Alert thresholds (proposed · open to ops)**
   - WARN · any group unreviewed > 24h · opens a non-paging ticket.
   - PAGE · any group unreviewed > 72h OR total backlog > 100 unreviewed · pages ops rota.
   - CRITICAL PAGE · any group unreviewed > 7d · escalates.

3. **Resolution SLA (proposed · open to ops)**
   - P50 · 24h.
   - P90 · 48h.
   - Hard max · 7d. A group past hard max requires explicit escalation.

4. **Resolution choices · documented** (already in the SQL file's QUARANTINE WORKER section)
   - `registered` · the device key was re-created; cleanup worker will pick up the group normally next tick.
   - `purged` · operator confirms the device is irrecoverable; **operator must run a separate authorised SQL to mark affected rows as if the key had been revoked at `m.sent_at`**, so the normal cleanup worker then sweeps. This SQL is explicitly NOT drafted here.
   - `waiting` · operator leaves the group in place; TTL will NOT auto-expire it under current design (see "indefinite retention" below).

5. **Operator audit trail**
   - A new column `resolution_actor_account_id uuid` and `resolution_reason text` on `nex_message_group_quarantine`.
   - All resolutions logged to `nex_action_log` (or equivalent) with `kind='quarantine_resolution'`, `group_id`, `actor`, `choice`.

6. **Indefinite retention · OWNER-DECIDED 2026-11-03 · option (b)**
   - **Decision:** owner-approval-only · no automatic time-based force-purge · every deletion of a quarantined past-TTL group requires explicit operator action.
   - **Rationale (owner-stated):** avoids silently deleting a message group because an operational problem was not resolved in time. Accepts that storage can accumulate · explicitly conditions the decision on monitoring and capacity limits being in place.
   - **Implied prerequisites before this policy can go live:**
     - Mandatory alert pipeline wired to the quarantine dashboard (concern 3 · item 2).
     - Scheduled regular-review cadence (owner-stated: "regular review") · cadence value not yet set.
     - Capacity-limit monitoring: a storage-growth metric that pages well before Supabase quota · threshold value not yet set.
     - If any prerequisite is missing at go-live time, the owner must re-decide · the policy's safety depends on them.
   - **Options (a) and (c) rejected** · recorded here only for audit trail. Future reconsideration requires explicit owner reversal.

7. **Capacity planning**
   - Average quarantine volume should be ~0 in steady state. A healthy device registry means missing-key rows are rare.
   - A persistent non-zero backlog indicates a device-registration bug. The dashboard and alerts should surface this trend before it becomes a storage problem.

---

## Summary of residual gaps before any implementation can be authorised

| # | Gap | Blocks |
|---|-----|--------|
| 1 | Advisory-lock syntax has not been smoke-tested against the target PostgreSQL version | Group-locking implementation |
| 2 | `attachment_enqueue` CTE's `ON CONFLICT DO NOTHING` is not yet in the SQL file; it is only in this review | Attachment-queue migration drafting |
| 3 | Supabase Storage DELETE error-class mapping has not been empirically validated (which codes are retriable vs permanent) | Purge-worker implementation |
| 4 | Ops ownership + alert thresholds + resolution SLA are proposals; no ops stakeholder has signed off | Quarantine go-live |
| 5 | Indefinite-retention policy for past-TTL + still-missing-key groups is unresolved (a/b/c options above) | Owner decision |
| 6 | Audit-log integration for operator quarantine resolutions is specified but no `nex_action_log` kind exists for it today | Operator-tooling implementation |
| 7 | Dashboard queries are drafted here but no Grafana/Metabase/other dashboard is wired | Observability implementation |

## Confirmation

No database executed. No infrastructure touched. No production access. No migrations drafted. No modifications to `b0-cleanup-worker-design.sql` in this authorisation · only this new review document was created.

Stopping. Awaiting owner decisions on gap #5 (retention policy) and ops stakeholder sign-off on concern 3's SLA proposals before any implementation can be authorised.
