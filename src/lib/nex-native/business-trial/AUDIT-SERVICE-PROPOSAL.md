# G1 Operator Audit Service · Implementation Proposal

**Status:** 📝 PROPOSAL ONLY · owner-recorded 2026-10-22 · NOT IMPLEMENTED
**Scope:** Smallest reliable implementation of the three-transaction audit flow sealed in migration 214 + G1 Design Package §9.
**Blocker:** awaiting separate owner authorisation to implement (per directive section 4).

---

## 1 · What exists today

### 1.1 · Schema (shipped)

Migration 214 defines `nex_pilot_operator_audit` with:
- `attempt_status text DEFAULT 'pending'` enum (`pending` · `succeeded` · `failed` · `cancelled`)
- `attempted_at`, `outcome_at` timestamps
- `before_state`, `after_state` JSONB snapshots
- `error_message` on failure
- `operator_identity` (hashed per A4)
- `request_id` for log correlation
- Partial index `idx_nex_pilot_operator_audit_pending` for reconciliation

### 1.2 · Protocol (documented in migration comment + design §9)

- **T1** (OUTSIDE operation) · INSERT attempt row with `attempt_status='pending'` · commit
- **T2** (operation's own tx) · the UPDATE / destructive statement · commit or rollback
- **T3** (OUTSIDE operation) · UPDATE attempt row with outcome (`succeeded` + after_state, OR `failed` + error_message)

### 1.3 · Service wrapper (NOT shipped)

**Zero TypeScript code** currently enforces or orchestrates the T1→T2→T3 sequence. An operator would need to execute the three transactions manually via `psql` or Supabase SQL editor, following the documented protocol.

---

## 2 · Why the gap matters

An operator intervening during pilot (e.g. abuse-review trial reset) relies on:
- Remembering the protocol
- Running three transactions in correct order
- Capturing `before_state` and `after_state` correctly
- Hashing operator identity with the production pepper
- Setting a correlation `request_id`

Any of these can fail silently. If the operator forgets T3, the attempt row stays `pending` indefinitely and the reconciliation query flags it — but reconciliation is also manual (per design §9.3).

**For a flag-disabled pilot where operator intervention is rare, this gap is tolerable.** For an activated pilot where interventions are expected to be non-zero, a service wrapper reduces human error.

---

## 3 · Proposed implementation · `operator-audit-service.ts`

### 3.1 · Public API

```typescript
export interface OperatorAuditAttemptInput {
  readonly operatorRawId: string;        // raw operator account UUID · hashed by the service
  readonly action: string;                // e.g. 'trial_reset', 'manual_tier_change'
  readonly targetAccountId: string | null;
  readonly justification: string;         // required · free text · stored verbatim
  readonly sqlExecuted: string | null;    // for direct-SQL ops · what T2 will run
  readonly beforeState: Record<string, unknown>;  // snapshot captured before T2
}

export interface OperatorAuditAttemptHandle {
  readonly auditId: string;               // UUID of the audit row
  readonly requestId: string;             // correlation ID for structured logs
  readonly operation: <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;
}

/**
 * T1 · Begin an operator audit attempt. Opens a short-lived transaction
 * that commits the attempt row with status='pending' BEFORE the actual
 * destructive operation runs. The returned handle wraps T2 and T3.
 *
 * Caller usage:
 *   const handle = await beginOperatorAttempt({ operatorRawId, action, targetAccountId, justification, sqlExecuted, beforeState });
 *   try {
 *     const result = await handle.operation(async (client) => {
 *       // T2 · the actual UPDATE / destructive statement
 *       return await client.query(sql, params);
 *     });
 *     await completeOperatorAttempt(handle, { afterState: capturedAfterState });
 *     return result;
 *   } catch (err) {
 *     await failOperatorAttempt(handle, { errorMessage: String(err) });
 *     throw err;
 *   }
 */
export async function beginOperatorAttempt(input: OperatorAuditAttemptInput): Promise<OperatorAuditAttemptHandle>;

/** T3 · Mark the attempt as succeeded with the captured after_state. */
export async function completeOperatorAttempt(
  handle: OperatorAuditAttemptHandle,
  outcome: { afterState: Record<string, unknown> },
): Promise<void>;

/** T3 · Mark the attempt as failed with the captured error message. */
export async function failOperatorAttempt(
  handle: OperatorAuditAttemptHandle,
  outcome: { errorMessage: string },
): Promise<void>;

/** T3 · Mark the attempt as cancelled (operator chose to abort before T2). */
export async function cancelOperatorAttempt(
  handle: OperatorAuditAttemptHandle,
  outcome: { reason: string },
): Promise<void>;

/** Reconciliation query · finds stale pending attempts. */
export interface StaleAttemptRow {
  readonly auditId: string;
  readonly attemptedAt: Date;
  readonly action: string;
  readonly targetAccountId: string | null;
  readonly beforeState: Record<string, unknown> | null;
}

export async function listStalePendingAttempts(
  olderThanMinutes: number,
): Promise<StaleAttemptRow[]>;
```

### 3.2 · Transaction boundaries

- **T1** · dedicated `pg` client · `BEGIN` → `INSERT` → `COMMIT` → release client. ~5 ms typical.
- **T2** · dedicated `pg` client passed to the operator's callback. Operator runs their SQL inside the callback. `BEGIN` and `COMMIT`/`ROLLBACK` are the operator's responsibility (so they can run multi-statement transactions). Service does not auto-commit around T2.
- **T3** · dedicated `pg` client · `BEGIN` → `UPDATE WHERE id = $auditId AND attempt_status = 'pending'` → `COMMIT` → release.

Each T is its own transaction. T2's rollback does NOT rollback T1 or T3 (they are separately committed).

### 3.3 · Failure handling

| T2 fails | What service does |
|---|---|
| Operator's SQL throws | Rethrow after capturing error · operator calls `failOperatorAttempt(handle, { errorMessage })` · T3 writes `attempt_status='failed'` with error |
| Operator's connection dies before T3 | Attempt row stays `pending` · reconciliation query at a later time surfaces it · operator manually updates OR runs `listStalePendingAttempts` to clean up |
| T3 itself fails (DB unreachable at outcome time) | Service logs structured error · attempt row stays `pending` · reconciliation handles |

### 3.4 · Retry behaviour

**No automatic retry at any T.** Each T has at-most-once semantics via the dedicated-connection pattern. Operator decides whether to re-attempt the entire T1→T2→T3 cycle after a failure (which produces a NEW audit attempt row · the previous attempt remains durable as evidence).

### 3.5 · Required migration changes

**None.** Migration 214 already provides the full schema needed. The service is pure TypeScript built on top of the existing table.

### 3.6 · Required test coverage

- T31a · T2 fails · attempt row has `attempt_status='failed'` + `error_message` set · attempt row persists after rollback
- T31b · operator session dies between T2 and T3 · attempt row stays `pending` · `listStalePendingAttempts` surfaces it
- T31c · successful operation · T1 and T3 commit · attempt row has `succeeded` + `after_state` + `outcome_at`
- T31d · reconciliation query returns stale rows ordered by `attempted_at`
- T31e · idempotency · calling `completeOperatorAttempt` twice for the same handle · WHERE clause `attempt_status = 'pending'` makes second call a no-op
- T31f · T3 after `cancelOperatorAttempt` · attempt row shows `cancelled` with reason

### 3.7 · Dependencies on existing primitives

- `pg.Pool` singleton (same as `service.ts`)
- `resolveAuditPepper()` (same as `logging.ts` and `idempotency.ts`)
- `randomUUID()` for `request_id` generation

### 3.8 · Logging integration

Each T writes a structured log line via `logTrialEvent`:
- T1 commit → `event: 'operator.attempt.begin'` + hashed operator + requestId + action + targetAccountIdHash
- T3 commit → `event: 'operator.attempt.outcome'` + requestId + outcome status

This correlates with the audit row via `request_id`.

---

## 4 · Scope estimate

**Code additions (if authorised):**
- `src/lib/nex-native/business-trial/operator-audit-service.ts` · ~150 lines
- `src/lib/nex-native/business-trial/__tests__/operator-audit-service.test.ts` · ~250 lines (6 tests · all require live Postgres, so gated on `TRIAL_PG_TEST_URL` like `concurrency.integration.test.ts`)

**No new tables. No migration edit. No change to existing G1 code.**

---

## 5 · When this should ship

**Not before:** owner has decided to activate the pilot flag AND operator intervention is expected to be non-zero during the pilot window.

**Could ship:** as a focused G1-adjacent follow-up after the real-pg concurrency tests pass, since the audit service tests also need a real Postgres (same `TRIAL_PG_TEST_URL` gate).

**Must NOT ship:** silently inside this verification pass without owner authorisation (per directive section 4: *"Do not implement the wrapper in this pass unless separately authorised"*).

---

## 6 · Interim operational posture

Until this proposal is approved and implemented:

**Pilot-time operator usage requires MANUAL execution of the three-transaction protocol.** Documented in:
- Migration 214 header comments
- G1 Design Package §9
- This proposal (§3.2)

**Honest statement for the readiness report:** "Audit schema is ready. Audit SERVICE is not implemented. Operator-time usage would be manual SQL. For flag-disabled pilot, this gap is tolerable."

---

## 7 · This document contains no code changes

- No new source files written
- No existing files modified
- No tests added
- No migration edited

This is a proposal for review only.
