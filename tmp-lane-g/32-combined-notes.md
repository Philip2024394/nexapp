# Lane-G Package C · Combined offline regression notes

**Harness**: `tmp-lane-g/32-combined-offline-regression.mjs`
**Results**: `tmp-lane-g/32-combined-offline-results.json`
**Date**: 2026-11-19
**Status**: PASS · 27/27 cases · 0 FAIL · 0 PENDING (combined SQL file was present at run time)

---

## What this harness proves

1. **Destination-grammar near-miss coverage** that Agent A's harness
   (`30-whitespace-guard-offline-tests.mjs`) did not already cover —
   dot/underscore in session segment, Unicode outside `[0-9a-f-]`,
   duplicated `accept=1`, extra trailing params, absolute URL with host,
   protocol-relative prefix, trailing fragment, uppercase hex accept,
   mixed-case hex accept. All 12 P1 cases match the JS mirror of
   `_LANE_G_ACCEPT_HREF_PATTERN`.
2. **Source assertions** against the coordinator's combined candidate
   file. The merge preserves:
   - the contract regex literal byte-identical with Agent A,
   - `!~*` case-insensitive not-match operator,
   - the `PERFORM 1 FROM nex_group_call_session WHERE id = v_session_id
     FOR UPDATE;` statement,
   - **ordering**: FOR UPDATE sits strictly between the session
     ownership block's `END IF;` and the participant `INSERT`,
   - attachment_url guard runs before the invitee check and session
     block (first 22023-raising check after identity),
   - dedup `EXCEPTION WHEN unique_violation` remains inside the
     participant BEGIN block right below the participant INSERT,
   - SECURITY DEFINER + pinned search_path,
   - full REVOKE/GRANT envelope,
   - no `INSERT INTO nex_migration_history` row (preview rule).
3. **Concurrency model (P3)** for scenarios not in Agent C prior model
   (which covered A/B/C/D):
   - **Case E**: 5 concurrent invites + 1 retry → count=4, 1 cap raise,
     ≥1 dedup return.
   - **Case F**: 4 concurrent, 2 share invitee → count=3, 1 dedup,
     0 cap raise.
   - **Case G**: two unrelated sessions interleaved → both reach
     count=3 with no cross-contamination; demonstrates the
     `WHERE id = v_session_id` scope does not serialise strangers.
   - **Case H**: contract observation that mig-133's trigger counts
     *rows*, not *active* rows — re-invite after a leave still raises.

## What this harness explicitly does NOT prove

- **PostgreSQL POSIX ERE semantics**. The JS mirror is `/…/i`; Postgres
  uses POSIX ERE under `~*`. Backslash-escaped `?`, `[0-9a-f-]`
  character-class behaviour, and case folding over `A-F` are all
  recorded as UNVERIFIED in Agent A's harness and remain so here.
- **Real PostgreSQL row-lock behaviour**. The JS mutex in Part 3
  models what `FOR UPDATE` would do under ideal interleaving; it does
  not prove that sandbox Postgres behaves identically under load. Real
  proof requires a sandbox battery.
- **Trigger ordering**. mig-133's BEFORE INSERT trigger still runs;
  this harness does not prove the trigger + lock interaction under
  concurrent transactions — only models the expected shape.
- **Caller identity NULL case (prior "Case B")**. Deliberately not
  simulated · `auth.uid()` NULL remains UNVERIFIED.

## Case-selection rationale (non-duplication)

- Every P1 case was cross-checked against Agent A's case list; cases
  already covered by Agent A (NULL, empty, ASCII/\t/\n/\r/\f/\v spaces,
  mixed whitespace, 35/37-char sessions, non-hex `g`, `accept=2`,
  missing `?session=`, trailing slash, absolute URL, uppercase hex,
  SQL-injection suffix, percent-encoded space, null byte interior,
  whitespace-wrapped valid, RTL override mid-string) were SKIPPED. Only
  genuinely-new near-miss cases were added.
- P3 deliberately omits a repeat of Case A/B/C/D from
  `31-4cap-model.test.mjs`.

## Concerns for the coordinator (none blocking)

The combined candidate landed before the harness ran and all source
assertions passed on the second run (the first run's single FAIL was a
harness over-strictness bug: searching for `length(btrim(…))` without
stripping `--` line comments, same technique Agent A's harness already
uses). No ordering, grant, dedup, or lock-placement issues were found
in the coordinator's combined body.

## Case H as a design-time signal (not a defect)

Case H merely restates that mig-133's `SELECT COUNT(*)` counts all rows
for a session. If/when the product adds a soft-leave/re-join flow, the
cap trigger will need either a `WHERE left_at IS NULL` clause or a
different invariant. Out of scope for this batch · noted so the
coordinator and future reviewers don't rediscover it under pressure.
