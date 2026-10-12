# Stage B integration test plan · DRAFT

**Status · not landed in `src/` yet.** When Stage B is authorised, each
numbered test below moves into the paired file path and runs under
vitest. Keeping them in `logs/` keeps CI green while awaiting approval.

Reconciler state (both default-OFF):
- `isReconcilerEnabled()` → `false`
- `isReconcilerSimulateOnly()` → `true`

The tests inject a mock `ReconcilerSupabaseClient` so they NEVER touch
the live `nex_business` table. The reconciler module already exposes
`opts.clientFactory` for exactly this.

---

## Test 1 · verifyClaim happy-path progresses PENDING → VERIFYING_IDENTITY_LINK → VERIFIED

**File path when landed:** `src/lib/nex-native/claims/__tests__/verify-with-reconciler.test.ts`

**Setup**
- `isReconcilerEnabled=true`, `isReconcilerSimulateOnly=false` (test-local env)
- Mock reconciler Supabase client returns `updateExistingLink → { rowCount: 1 }`
- Seeded `nex.business_canonical` row (lifecycle_state=`VERIFIED`)
- Seeded `nex.business_claim` row with correct code, state=`PENDING`

**Act**
Call `claim-service.verifyClaim({ claim_id, code })` with the correct code.

**Assert**
1. Mid-flow sweep: `business_claim.state` is observed as `VERIFYING_IDENTITY_LINK` after code verification but before reconcile returns (requires the mock to pause via a promise).
2. End-of-flow: `business_claim.state = 'VERIFIED'`.
3. `business_canonical.lifecycle_state = 'OWNER_CLAIMED'`.
4. One row inserted into `business_canonical_lifecycle_log` with `transition_reason = 'owner_claim'`.
5. Reconciler returned outcome `linked_existing` (verified via spy on `reconcileVerifiedClaim`).
6. Audit log has one `link_updated_existing` row with the same idempotency key.

---

## Test 2 · reconciler returns ambiguous_multiple_profiles → claim stays VERIFYING_IDENTITY_LINK

**File path when landed:** `src/lib/nex-native/claims/__tests__/verify-with-reconciler-ambiguous.test.ts`

**Setup**
- Same as Test 1 but mock returns `updateExistingLink → { rowCount: 2 }`.

**Act**
Call `verifyClaim` with correct code.

**Assert**
1. `business_claim.state` ends at `VERIFYING_IDENTITY_LINK` (NOT `VERIFIED`).
2. `business_canonical.lifecycle_state` is NOT yet `OWNER_CLAIMED` (the lifecycle promotion is gated on the identity link).
3. Audit log has one `link_ambiguous` row.
4. UI contract: the business page / detail page must NOT render a "verified" badge yet. Represented in test by checking the derived flag on the returned claim object (not a DOM test).
5. A retry endpoint invocation (`retryClaimReconciliation(claim_id)`) is now the only path forward. Call it with the mock returning `{ rowCount: 1 }` after operator triage. Claim progresses to `VERIFIED`.

---

## Test 3 · supabase_error · exponential backoff · caller re-invokes until linked

**File path when landed:** `src/lib/nex-native/claims/__tests__/verify-with-reconciler-retry.test.ts`

**Setup**
- Mock returns `supabase_error` for attempt 1 and 2; `linked_existing` on attempt 3.

**Act**
Call `verifyClaim` once. The claim-service invokes the reconciler.

**Assert**
1. First reconciler result has `retryAfterMs = 1000`.
2. Second attempt has `retryAfterMs = 5000`.
3. Third attempt succeeds with `linked_existing`.
4. Claim ends at `VERIFIED`.
5. Idempotency key is identical across all 3 attempts; `attempt_number` increments.
6. Audit log shows 3 rows: 2 × `link_failed`, 1 × `link_updated_existing`.
7. Caller stops after attempt 3 regardless of outcome (per the reconciler's documented contract).

---

## Test 4 · idempotency · same (claim_id, canonical_id, account_id) retried → no duplicate row

**File path when landed:** `src/lib/nex-native/cross-db-reconciler/__tests__/idempotency.test.ts`

**Setup**
- Mock returns `linked_existing` on both calls.
- Record a reconcile event with `idempotencyKey=K`, `attemptNumber=1`.
- Attempt to record a SECOND event with the SAME `idempotencyKey=K`, `attemptNumber=1`.

**Act**
Call `recordReconcileEvent` twice.

**Assert**
1. First call: `alreadyRecorded = false`, returns new `logId`.
2. Second call: `alreadyRecorded = true`, returns the SAME `logId`.
3. Only ONE row exists in `nex.cross_db_reconcile_log` for that key+attempt.
4. The UNIQUE constraint `(idempotency_key, attempt_number)` on the audit table enforces this at the DB level · the ON CONFLICT handling makes the API deterministic.

---

## Test 5 · migration rollback drill · scratch DB apply + revert

**File path when landed:** `scripts/stageB-migration-drill.mjs`

Not a vitest test — a one-off operator drill. Executes against a Supabase BRANCH (not production).

**Steps**
1. Branch the production DB (Supabase branching). Branch name: `stageB-drill-2026-10-13`.
2. Apply the migration file as renamed to `188_add_canonical_business_id_to_nex_business.sql`.
3. INSERT one `nex_business` row with `canonical_business_id = '<test uuid>'`.
4. Verify partial unique index: a second INSERT with the SAME `canonical_business_id` MUST fail with 23505.
5. Capture the row to the backup table per the rollback plan in the WIP file.
6. Execute rollback:
   ```
   DROP INDEX IF EXISTS public.nex_business_canonical_business_id_uq;
   ALTER TABLE public.nex_business DROP COLUMN IF EXISTS canonical_business_id;
   ```
7. Verify the column + index are gone; `nex_business` row count unchanged; `cover_layout_id` + every other column untouched.
8. Delete the branch.

**Pass criterion:** complete 1-7 with no production impact. Report the operator timing (ALTER + CREATE INDEX + rollback should total < 500ms on 169 rows).

---

## Test 6 · face-cover regression · no cover_layout_id or chat_theme value changes

**File path when landed:** `src/lib/nex-native/cross-db-reconciler/__tests__/face-cover-untouched.test.ts`

**Setup**
- Pre-apply: capture `(nex_business.id, nex_business.cover_layout_id)` for the 1 row where it is set + capture `(nex_account.id, nex_account.chat_theme)` for the 10 rows where it is set.
- Apply migration 188 (in the drill environment, not production).
- Fire a mock reconciler call that writes `canonical_business_id` to the row that also has `cover_layout_id` set.

**Act**
Re-query the two captured sets.

**Assert**
1. `nex_business.cover_layout_id` for the covered row is byte-identical before and after.
2. `nex_account.chat_theme` for all 10 covered rows is byte-identical before and after.
3. The reconciler's UPDATE statement sets ONLY `canonical_business_id` (confirmed by inspecting the sealed `updateExistingLink` implementation — it uses `.update({ canonical_business_id })` only).
4. No application code path reads these columns via the reconciler module (grep confirms zero `cover_layout_id` / `chat_theme` references under `src/lib/nex-native/cross-db-reconciler/`).

---

## Test 7 · unclaimed-listing regression · directory + business + chat routes still work

**File path when landed:** `src/app/nex-native/__tests__/unclaimed-listing-regression.test.ts`

**Setup**
- A canonical row with no `business_claim` row, no `nex_business` row.
- Second scenario: a `nex_business` row with `canonical_business_id = NULL`.

**Act / Assert**
1. GET `/nex-native/directory/[canonical_id]` for the unclaimed canonical → renders the OwnerClaimForm (no 404, no redirect). Verified via `renderToStaticMarkup`.
2. GET `/nex-native/[businessSlug]` for the un-linked `nex_business` → renders the shop normally. Verified via `renderToStaticMarkup`.
3. GET `/nex-native/chat/peer/[peerAccountId]?focus_product=X` for a peer business with `canonical_business_id = NULL` AND live products → focused-shop-sheet still mounts (the canonical linkage is irrelevant to the thumbnail-row path; the only prerequisites are `nex_business` existence + ≥1 live product).
4. GET `/nex-native/directory/[canonical_id]` for a VERIFIED canonical whose `business_claim.state = 'VERIFYING_IDENTITY_LINK'` → still renders the detail page WITHOUT the verified badge (badge gated on `state = 'VERIFIED'`).

---

## Operator sequencing summary

| step | artefact | state |
|---|---|---|
| 0 | Authorise Stage A | pending |
| 1 | Code commit: drop 4 "-v2" metadata entries, drop 7 colliding aliases, move slug validator into `src/`, update walker CATEGORIES array (`coat-seller → clothes`) | after Stage A authorisation |
| 2 | Run `logs/stage-ab-prep/stageA-rename-FORWARD-DRAFT.sql` after rename to `nex-supabase/migrations/188_...sql` | after step 1 lands |
| 3 | Re-run `scripts/audit-stage0-production-baseline.mjs` · confirm `orphan_ids_fingerprint` unchanged, `canonical_slugs_fingerprint` changed | after step 2 |
| 4 | Authorise Stage B migration apply | pending |
| 5 | Rename WIP migration to `189_add_canonical_business_id_to_nex_business.sql` + apply | after step 4 |
| 6 | Flip `isReconcilerSimulateOnly()` env to false in a staging-only `.env` · run the 7 tests above against a scratch Supabase branch | after step 5 |
| 7 | Authorise reconciler wire-in | pending |
| 8 | Code commit: add call site in `claim-service.verifyClaim()`, add `VERIFYING_IDENTITY_LINK` state, add retry endpoint, land the 7 tests in `src/` | after step 7 |
| 9 | Authorise reconciler enable in production | pending |
| 10 | Flip `isReconcilerEnabled()` env to true in production | after step 9 |

Each step produces evidence per Safeguard C before the next is authorised. No step is "complete" without:
- schema evidence (before/after)
- data integrity counts (fingerprint re-measurement)
- route resolution HEAD probes
- test output
- rollback drill confirmation
