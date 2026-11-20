# A22 · Failure-injection matrix · current vitest cross-reference + proposed plan for scenarios 4, 8, 9, 13, 15

Date · 2026-11-18
Scope · Response to A22 ("Cross-reference 15-scenario matrix with
vitest coverage"). Outcome · proposal only — no tests written here.

Source of record for the matrix ·
`docs/doctrine/world-class-safety-matrix-2026-11-08.md` section 6
(lines 137-159).

---

## 1 · Current classification (from source)

| # | Scenario | 2026-11-08 state |
|---|---|---|
| 1 | Chat API unavailable | TESTED |
| 2 | Feed query fails | TESTED |
| 3 | Storage unavailable | TESTED |
| 4 | Realtime disconnects | PARTIAL — reconnect yes; missed-event replay no |
| 5 | Auth service times out | TESTED (WebAuthn breaker) |
| 6 | One country environment fails | TESTED (country-isolation suite) |
| 7 | One section crashes | TESTED (SectionBoundary unit) |
| 8 | Multiple sections fail | PARTIAL |
| 9 | Upload fails midway | UNTESTED |
| 10 | Double-submit | TESTED (idempotency-key suite) |
| 11 | Recovery attempt fails | TESTED (circuit-breaker OPEN) |
| 12 | Admin resolves incident | TESTED (13/13 E2E smoke 2026-11-08) |
| 13 | Incident returns after resolution | PARTIAL — reopen requires NEW incident |
| 14 | HQ loses realtime | N/A — HQ Alerts does not use realtime today |
| 15 | Incident DB temporarily unavailable | UNTESTED |

Score · 10 TESTED · 3 PARTIAL · 2 UNTESTED · 1 N/A.

## 2 · Repository cross-reference (vitest only)

A read-only `grep` of the `src/lib/nex-native/**/*.test.ts` tree
confirms the 2026-11-08 classification is still accurate for current
HEAD. Specifically:

| Scenario | Test files observed | Gap |
|---|---|---|
| 4 Realtime | `chat/__tests__/realtime-*.test.ts` covers connect/reconnect path. **No test exercises the "events emitted during the disconnection window were replayed on reconnect" invariant.** | Missed-event replay |
| 8 Multi-section | `components/nex-native/section-boundary/__tests__/*.test.tsx` tests a single section's error path in isolation. **No test mounts two sibling SectionBoundary trees and crashes both in the same render pass.** | Multi-section simultaneous failure |
| 9 Upload midway | `chat/__tests__/attempt-encrypted-attachment.test.ts` + `crypto/__tests__/encrypted-attachment-uploader.test.ts` cover happy path + some specific failure modes. **No test cuts the upload at a specific byte offset mid-stream (network error after N chunks) and verifies that (a) no partial row is left in `nex_chat_attachment`, (b) the user sees a retryable error state, (c) the orphaned storage object is cleaned up.** | Partial-upload cleanup |
| 13 Incident recurrence | `incident/__tests__/incident-service.test.ts` exercises the `claimEvent` dedupe. **No test asserts that if the same signature fires >60s after resolution, a NEW incident row is created with a fresh dedupKey and HQ Alerts shows both the original (RESOLVED) and the new (DETECTED) in the history view.** | Recurrence-vs-reopen boundary |
| 15 Incident DB down | `incident/__tests__/incident-service.test.ts:ensureIncidentTableReady` covers the pre-migration-300 probe. **No test simulates the DB going away AFTER the probe cached `true`** — a transient failure during an active request. The current code returns `{ ok: false, reason: ... }` but no test confirms the caller (e.g. SectionBoundary → createIncident) still responds with the correct user-facing fallback and does not loop. | Transient DB failure after warm probe |

## 3 · Proposed vitest additions (AUTHORISATION NOT GRANTED — PROPOSAL ONLY)

Per the ongoing scope rule *"do not implement a proposal-only item"*,
the following are drafts the owner may authorise in a separate round.
No file is written for these yet.

### 3.1 Scenario 4 · Realtime missed-event replay

File · `src/lib/nex-native/chat/__tests__/realtime-missed-event-replay.test.ts`

Shape ·
1. Mount a `useChatSubscription` test harness against a mock Supabase
   Realtime channel. Subscribe to `nex_peer_message`.
2. Push three messages → assert all three arrive.
3. Force disconnect. Push four more messages into the channel while
   disconnected.
4. Reconnect. Assert the client fetches the four missed messages via
   the fallback REST query AND de-duplicates them against anything
   that may have arrived via the reopened subscription.

Assertion contract · zero gaps, zero duplicates after reconnect.

### 3.2 Scenario 8 · Multi-section simultaneous failure

File · `src/components/nex-native/section-boundary/__tests__/multi-section-crash.test.tsx`

Shape ·
1. Render a page with two sibling `SectionBoundary` wraps (chat +
   feed) on the same page.
2. Make both child subtrees throw in the same render pass.
3. Assert both sections show their own fallback UI independently.
4. Assert exactly TWO `POST /api/nex-native/incident/section-error`
   calls are made, each carrying its own `IncidentScope`.
5. Assert the parent layout chrome is still interactive (no cascade
   to the root `/nex-native/error.tsx`).

### 3.3 Scenario 9 · Upload fails midway

File · `src/lib/nex-native/crypto/__tests__/encrypted-attachment-partial-upload.test.ts`

Shape ·
1. Mock the Supabase storage client to accept the first chunk and
   throw `AbortError` on the second.
2. Call `uploadEncryptedAttachment` with a 2-chunk payload.
3. Assert the function returns `{ ok: false, reason: "network" }` and
   does NOT throw.
4. Assert NO row was written to `nex_chat_attachment`.
5. Assert the mock storage client received exactly ONE `remove()`
   call for the partially-written path (cleanup).

The cleanup path may or may not exist — if it does not, this test
becomes the proof the cleanup is needed, not an immediate pass.

### 3.4 Scenario 13 · Incident recurrence after resolution

File · `src/lib/nex-native/incident/__tests__/incident-recurrence.test.ts`

Shape ·
1. Create an incident with signature `S`. Resolve it.
2. Fast-forward past the 60s dedupe window (fake timers).
3. Call `createIncident` again with signature `S`.
4. Assert a NEW row is inserted (new UUID, status DETECTED).
5. Assert `getIncidentHistory({ signature: S })` returns both rows
   in descending `created_at` order.

### 3.5 Scenario 15 · Transient DB failure after warm probe

File · `src/lib/nex-native/incident/__tests__/incident-transient-db-failure.test.ts`

Shape ·
1. Call `ensureIncidentTableReady` once → probe returns ok, cache warms.
2. Reconfigure the mock to throw `PostgresError` on the next insert.
3. Call `createIncident`. Assert it returns
   `{ ok: false, reason: "db_insert_failed" }` without throwing.
4. Assert exactly ONE warn log is emitted — no retry loop.
5. Reconfigure the mock back to healthy. Assert the NEXT call to
   `createIncident` succeeds (no latched failure state).

## 4 · Explicit exclusions (not in A22 scope)

- **Any live run** of the proposed tests. A22 is a plan; execution
  of a new test suite is a separate authorisation.
- **Scenario 14** (HQ loses realtime). Classified N/A in source
  because HQ Alerts does not use realtime today. A22 does not propose
  adding realtime to HQ.
- **New scenarios** beyond the sealed 15. The sealed doctrine fixes
  the matrix at 15; adding a 16th is an owner decision.
- **Production or sandbox DB writes.** The proposals above run
  entirely against mocked clients. No new migration, no new table,
  no new RLS policy is implied by this plan.

## 5 · Honest limits

- Script-level counts of `it(` / `test(` do not prove *semantic*
  coverage of a scenario. The cross-reference above is a source-read
  finding, not a run of the test suite. If any of the five new tests,
  once authorised and written, surfaces an actual code gap (missing
  cleanup, missing replay, missing reopen path), that would convert
  from "plan" into a confirmed engineering finding and require its
  own fix authorisation.
- The 2026-11-08 "10 TESTED" classifications were accepted at face
  value and not re-verified line-by-line here. A22's remit is the
  5 non-TESTED cells only.
