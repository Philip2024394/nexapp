# GB-4CAP · Investigation (Lane-G Agent C)

Date: 2026-11-19  
Scope: OFFLINE investigation only. No DB access, no commits, no pushes,
no migration apply. GB-4CAP stays OPEN. This document proposes the
smallest secure correction and justifies it; it does not close GB-4CAP.

---

## 1 · Actual invariant extraction

The cap trigger lives at `nex-supabase/migrations/133_nex_group_call.sql`
lines 80–102. Verbatim:

```sql
-- Hard 4-participant cap enforced via trigger. The service layer
-- also pre-checks but this is defence in depth · a race between
-- two near-simultaneous invites can never produce a 5-row session.
CREATE OR REPLACE FUNCTION nex_group_call_participant_cap()
RETURNS TRIGGER AS $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt
    FROM nex_group_call_participant
    WHERE session_id = NEW.session_id;
  IF cnt >= 4 THEN
    RAISE EXCEPTION
      'nex_group_call_participant: session % already has 4 participants', NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nex_group_call_participant_cap_tr
  BEFORE INSERT ON nex_group_call_participant
  FOR EACH ROW
  EXECUTE FUNCTION nex_group_call_participant_cap();
```

The trigger counts ALL rows for the session irrespective of
`left_at`. Therefore the sealed invariant is **"at most 4 rows ever
exist in `nex_group_call_participant` for a given `session_id`"** —
i.e. 4 EVER-INVITED, not 4 ACTIVE. A guest leaving (setting
`left_at`) does NOT free a slot. The code header comment uses the
phrase "4 participants per session (mesh architecture limit)". The
comment inline says "a race between two near-simultaneous invites can
never produce a 5-row session" — this is the specific assertion
GB-4CAP contradicts. Under the current implementation the race DOES
produce >4 rows.

Table shape (`133_nex_group_call.sql:61-72`):

```sql
CREATE TABLE IF NOT EXISTS nex_group_call_participant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES nex_group_call_session(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('host', 'guest')) DEFAULT 'guest',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at TIMESTAMPTZ NULL,
  left_at TIMESTAMPTZ NULL,
  removed_by UUID NULL,
  CONSTRAINT nex_group_call_participant_unique_in_session
    UNIQUE (session_id, account_id)
);
```

There is no `position_in_cap` column, no partial unique index, no
check constraint over `(session_id)` cardinality. Only the trigger.

Other write paths to `nex_group_call_participant`:

- `nex-supabase/migrations/356_nex_group_call_invite_v2.sql:244`
  (current transactional invite function).
- `nex-supabase/migrations/353_nex_group_call_invite_transactional.sql:149`
  (prior version, superseded by 356).
- `nex-supabase/candidate-migrations/C001_nex_group_call_invite_transactional.sql:204`
  (unapplied candidate copy).
- `nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_invite_v3_whitespace_strict_PREVIEW.sql:156`
  (Agent A's whitespace-strict candidate).
- `nex-supabase/candidate-migrations/353_nex_group_call_invite_transactional_PREVIEW.sql:149`.

No application-code direct INSERT bypasses these function paths in
nexapp, so the fix point is the function body.

## 2 · Concrete race interleaving

Pre-condition: one session row with 3 participants.

```
Time   T1 (invite P4 to S1)                 T2 (invite P5 to S1)
-----  ----------------------------------   ----------------------------------
t0     BEGIN
t1                                          BEGIN
t2     SELECT COUNT(*) FROM nex_group_
         call_participant WHERE session_
         id = S1  → cnt = 3
t3                                          SELECT COUNT(*) FROM nex_group_
                                              call_participant WHERE session_
                                              id = S1  → cnt = 3
t4     cnt < 4 → pass trigger check
t5                                          cnt < 4 → pass trigger check
t6     INSERT row(P4, S1)
         (held in T1's buffer)
t7                                          INSERT row(P5, S1)
                                              (held in T2's buffer)
t8     COMMIT  → 4 rows visible
t9                                          COMMIT  → 5 rows visible
FINAL: nex_group_call_participant has 5 rows for S1 · invariant violated
```

Why this is a real race under Postgres:

- Default isolation is READ COMMITTED. Within one transaction each
  `SELECT` sees a snapshot that excludes other uncommitted writes.
- The BEFORE INSERT trigger body's `SELECT COUNT(*)` executes in the
  transaction's snapshot, so T2's count never observes T1's
  pending INSERT.
- Neither transaction acquires any lock that would force the other
  to wait. INSERTs on separate rows do not conflict; no UNIQUE
  constraint fires because each row has a distinct `account_id`.
- The RLS INSERT policy is a `WITH CHECK`, not a lock.
- SECURITY DEFINER (mig-356) elevates privilege but does not create a
  lock; both T1 and T2 can enter the same function body concurrently.
- REPEATABLE READ would not help either: each transaction gets its
  OWN consistent snapshot, both observing cnt=3.
- Only SERIALIZABLE would detect the write-skew pattern, and only at
  commit-time with a retry contract.

## 3 · Smallest secure correction

### Ranked options

| # | Option | Verdict | Reason |
|---|---|---|---|
| i | `LOCK TABLE nex_group_call_participant IN EXCLUSIVE MODE` | REJECT | Serialises every invite across unrelated sessions. Destroys cross-session concurrency. |
| **ii** | **`PERFORM 1 FROM nex_group_call_session WHERE id = v_session_id FOR UPDATE`** | **RECOMMEND** | One line, no schema change, serialises only same-session invites. Preserves cross-session concurrency, preserves mig-356 dedup catch, preserves trigger as defence-in-depth. |
| iii | Add `position_in_cap SMALLINT` + partial UNIQUE INDEX `(session_id) WHERE position_in_cap <= 4` | REJECT | Requires new column, backfill, trigger to assign position, breaks "no schema change". Larger surface than (ii) with no safety benefit. |
| iv | `pg_advisory_xact_lock(hashtextextended(session_id::text, 0))` | REJECT | Works but non-standard in this codebase, needs UUID→bigint hashing (collision risk), diverges from existing FOR UPDATE idioms in NEX SQL. |
| v | `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` inside function | REJECT | Requires caller-side retry on 40001, changes behaviour for every write in the function body (participant INSERT, conversation INSERT, message INSERT), biggest behavioural surface. |

### Why (ii) is the smallest secure correction

- **Lock scope**: `WHERE id = v_session_id` is a single-row predicate.
  Postgres acquires a row-level write lock on that exact session row.
  Concurrent transactions targeting ANY OTHER session_id acquire
  independent row locks. No fan-out.
- **Placement**: in the function body (not inside the trigger). The
  trigger runs per-row AFTER the lock would be released
  naturally inside a single transaction, and placing the lock in the
  trigger would break the symmetry — some writers might bypass the
  trigger (there are none today, but the function is the sealed entry
  point). Put the PERFORM immediately after the session-ownership
  check (mig-356 lines 218–226) and before the participant INSERT at
  line 244.
- **Defence-in-depth**: the mig-133 trigger stays. Even if a future
  caller bypasses the function, the trigger still raises — albeit
  racily — so the belt stays even after we fit the braces.
- **Idempotency preserved**: mig-356 catches `unique_violation` on
  `(session_id, account_id)` for retry/dedup. FOR UPDATE on the
  session row does not change that path.
- **Ownership preserved**: ownership check already runs BEFORE the
  participant INSERT; the PERFORM slots in AFTER ownership check,
  BEFORE INSERT, so ownership semantics are unchanged.

### One-line diff shape

```sql
-- after lines 218–226 (session ownership / creation branch):
PERFORM 1
FROM nex_group_call_session
WHERE id = v_session_id
FOR UPDATE;
-- before line 244 (participant INSERT)
```

Preview SQL file:
`nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_4cap_lock_DESIGN_PREVIEW.sql`.

## 4 · Deadlock analysis

- **Same session, two invites**: both transactions queue on the SAME
  session row lock. Serial by lock arrival. First wins and inserts;
  second observes the new cnt and either passes (if room) or RAISEs.
  No cycle.
- **Different sessions, two invites**: DIFFERENT session row locks,
  no overlap. No cycle.
- **External writers of `nex_group_call_session`**: repo grep for
  `UPDATE nex_group_call_session`, `FOR UPDATE`, `FOR SHARE` against
  that table returns ONLY the RLS policy declaration at mig-133
  line 129 (`ON nex_group_call_session FOR UPDATE`, which is the RLS
  verb binding — NOT a row lock). No live transaction code locks
  session rows today. Therefore no existing transaction can create a
  cross-lock cycle.
- **Future-risk convention**: if a future transaction locks
  `nex_group_call_participant` rows BEFORE locking the parent session
  row, two such transactions touching the same (session, participant)
  pair in opposite order could deadlock. Document the convention:
  **lock session first, participant second**. This matches the
  proposed PERFORM placement (session lock BEFORE participant INSERT).

Conclusion: no deadlock risk introduced by option (ii) under current
code. Document convention to keep it that way.

## 5 · Interaction with existing dedup / ownership / retry

- **Participant idempotency** (mig-356 line ~244 `unique_violation`
  catch): intact. FOR UPDATE on the session row does not change the
  behaviour of the participant INSERT's unique index.
- **Session ownership** (mig-356 lines 218–226): runs BEFORE the lock
  acquisition in the proposed placement. No change.
- **Retry contract**: a transaction that began before the cap-violating
  row committed will still queue on the FOR UPDATE lock when it
  arrives. Once released, it re-reads the (now-updated) count inside
  its own trigger and either accepts or RAISEs. Correct under READ
  COMMITTED because FOR UPDATE forces the waiter to use the latest
  committed row version post-wait.

## 6 · Why this does not silently serialise unrelated sessions

The lock predicate is `WHERE id = v_session_id`. Postgres row-level
locks are strictly keyed to the PK row returned by the predicate.
Concurrent transactions touching other `v_session_id` values acquire
other row locks. There is no table-level escalation. Measured
blast-radius: concurrent invites to ONE specific session serialise;
the entire group-call surface does not.

## 7 · Smallest preview SQL

Written to:

- `nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_4cap_lock_DESIGN_PREVIEW.sql`
- `nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_4cap_lock_DESIGN_PREVIEW_rollback.sql`

Marked clearly as DESIGN PREVIEW. No `nex_migration_history` INSERT.
No sequential migration number. No apply script.

### Coordination requirement (CRITICAL, FLAG, do NOT act)

Agent A's `CANDIDATE_nex_group_call_invite_v3_whitespace_strict_PREVIEW.sql`
rewrites the SAME `nex_invite_to_call_tx(...)` function body to tighten
the GB-WHITESPACE-GUARD at the SQL boundary (regex match of
`_LANE_G_ACCEPT_HREF_PATTERN`). Two separate applied migrations that
both `DROP FUNCTION ... / CREATE FUNCTION ...` the same signature would
be the biggest approved-write surface for the smallest real change.

**Flagging for the coordinator** (not deciding here): combine the
whitespace-strict guard AND the FOR UPDATE session-row lock into ONE
applied migration body when authorisation to apply is given. They are
byte-additive to each other, do not conflict, and together close
GB-WHITESPACE-GUARD and GB-4CAP in one write. This agent does not
choose the merge; it flags the opportunity.

## 8 · Offline concurrency model/test results

Test: `tmp-lane-g/31-4cap-model.test.mjs`  
Results: `tmp-lane-g/31-4cap-model-results.json`

```
[PASS] caseA_no_lock_race · finalCount=5, both fulfilled → race demonstrated
[PASS] caseB_with_lock_blocks_second · finalCount=4, exactly one rejection
[PASS] caseC_different_sessions_independent · SA=4, SB=4, no rejection
[PASS] caseD_dedup_retry_no_increment · count=3, second returns dedup=true
```

4/4 cases behave as expected. Case A proves the race PATTERN;
Case B proves the proposed mutex PATTERN produces exactly-4 + one
raise; Case C proves cross-session independence of the mutex PATTERN;
Case D proves idempotent retry is preserved.

**BANNER (printed at top AND bottom of the test output):**

```
===========================================================
OFFLINE CONCURRENCY MODEL ONLY
NOT POSTGRESQL CONCURRENCY PROOF
GB-4CAP STAYS OPEN
===========================================================
```

The JS mutex approximates `SELECT ... FOR UPDATE` semantics on the
session row. It is NOT a proof that the corresponding PostgreSQL
migration applied against sandbox `kdstoyyeygcopkogqsyv` is race-safe
in every scheduling order under real Postgres MVCC. Only a real DB
battery with bounded concurrent invite workers can prove that.

## 9 · Open questions / what the model does NOT establish

- Whether `SELECT ... FOR UPDATE` on `nex_group_call_session` could
  collide with any future trigger that writes `nex_group_call_session`
  rows (none today).
- Whether Supabase's PgBouncer in transaction mode preserves the
  session-row lock across the function-call RPC boundary (should, but
  must be re-verified against sandbox with a 2-worker bounded
  battery).
- Whether `INSERT INTO nex_group_call_session` (new-session path at
  mig-356 lines 227–240) acquires an implicit PK lock that allows the
  subsequent `PERFORM ... FOR UPDATE` to no-op. Expected yes, but
  must be verified.
- Whether any Realtime subscriber reacts to `nex_group_call_session`
  UPDATEs in a way that conflicts with FOR UPDATE on the SELECT path
  (FOR UPDATE on a SELECT does not write; should not trigger replication).

## 10 · Minimum authorisation needed to apply (for coordinator)

GB-4CAP cannot be closed by this agent. To move it from OPEN to
CLOSED, the coordinator needs:

1. Fresh owner authorisation naming sandbox ref
   `kdstoyyeygcopkogqsyv`.
2. A coordinated decision on whether to merge Agent A's
   `CANDIDATE_nex_group_call_invite_v3_whitespace_strict_PREVIEW.sql`
   with this candidate's FOR UPDATE change into ONE applied
   migration (recommended · flag only · not decided here).
3. Assignment of a real sequential migration number (CANDIDATE prefix
   is intentional until promotion).
4. Fresh fixture provisioning in sandbox (hosts + guests +
   nex_peer_conversation seed).
5. A bounded concurrent-invite battery (e.g. 10 workers, 100 cycles,
   seeded cap-3 states) that asserts final count ∈ {3, 4}.
6. Written receipt covering: workers used, iteration count,
   `nex_migration_history` row, before/after row counts, and any
   PgBouncer behaviour notes.
7. Separate production-apply authorisation naming prod ref
   `ijvqdvsvwtwxzcqmoqit` — explicitly OUT OF SCOPE here.

Production remains sealed. GB-4CAP STAYS OPEN.
