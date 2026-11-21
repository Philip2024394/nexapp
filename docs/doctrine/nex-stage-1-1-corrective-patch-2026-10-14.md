# NEX · Stage 1.1 corrective patch

Date: 2026-10-14
Companion to: `docs/doctrine/nex-stage-1-1-safety-review-2026-10-14.md`

---

## 1 · Files changed

| Path | Change | Delta |
|---|---|---|
| `nex-supabase/migrations/197_nex_community_rate_limit_peer_message_guest.sql` | **Rollback-ordering fix** inside the comment-block that documents the undo plan. Forward migration NOT changed. | lines 42-57 (16 lines) replaced with lines 42-67 (26 lines, +10) |
| `src/app/nex-native/chat/guest/[ownerAccountId]/__tests__/send-guest-message-rate-limit.test.ts` | **Behavioural tests added** via `vi.mock` injection of the sealed primitive and all adjacent module boundaries. Four original describe blocks preserved as refactor guards. | 220 → 384 lines (+164) · 16 → 21 tests (+5) |
| `docs/doctrine/nex-stage-1-1-corrective-patch-2026-10-14.md` | this report (new file) | 174 lines |

Nothing else touched. No change to the forward SQL of migration 197, no change to `_actions.ts`, no change to `_guest-chat-client.tsx`, no change to `rate-limit.ts`, no change to `community/types.ts`, no new migration, no doctrine shift, no entitlement change, no fingerprint work.

Unrelated pre-existing working-tree modifications were preserved untouched.

---

## 2 · Rollback ordering · before and after

### Original defect (safety review §Q2)

The rollback as originally written added the narrower CHECK **before** deleting the rows the narrower CHECK would reject. Any live `peer_message_guest` row would cause `ADD CONSTRAINT` to abort with:

```
ERROR: check constraint "ck_rl_action" of relation "nex_community_rate_limit"
       is violated by some row
```

Full before-text (migration 197 lines 42-57):

```sql
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '197';
--     ALTER TABLE nex_community_rate_limit
--       DROP CONSTRAINT IF EXISTS ck_rl_action;
--     ALTER TABLE nex_community_rate_limit
--       ADD CONSTRAINT ck_rl_action CHECK (action IN (
--         'notice_create','notice_update','notice_confirm','notice_resolve','notice_report',
--         'card_create','card_update','card_confirm','card_resolve','card_report',
--         'card_photo_upload',
--         'business_welcome_publish','business_welcome_retract'
--       ));
--     -- Clean any peer_message_guest rows that may have been inserted
--     -- while the extended constraint was active:
--     DELETE FROM nex_community_rate_limit WHERE action = 'peer_message_guest';
--   COMMIT;
```

### After the fix (migration 197 lines 42-67 now)

The DELETE now runs before the ADD CONSTRAINT. The restored 13-key CHECK list is **byte-identical** to the list migration 152 left in force (verified against `nex-supabase/migrations/152_nex_community_phase2b_business_welcome.sql:103-108`). A rationale block was added so a future contributor cannot re-swap the order without reading the warning.

```sql
-- Rollback:
--   Statement ordering matters · the narrower post-rollback CHECK does
--   NOT list `peer_message_guest`, so any surviving `peer_message_guest`
--   row would make `ADD CONSTRAINT` validate-against-existing-data and
--   abort the whole rollback transaction with:
--     ERROR: check constraint "ck_rl_action" of relation
--            "nex_community_rate_limit" is violated by some row
--   Therefore: DELETE the `peer_message_guest` rows FIRST, then swap
--   the constraint. The restored CHECK below matches the exact list
--   that was in force after migration 152 and before 197 (verified
--   against 152 lines 100-108).
--
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '197';
--     -- Must run BEFORE the narrower ADD CONSTRAINT otherwise ADD aborts.
--     DELETE FROM nex_community_rate_limit WHERE action = 'peer_message_guest';
--     ALTER TABLE nex_community_rate_limit
--       DROP CONSTRAINT IF EXISTS ck_rl_action;
--     ALTER TABLE nex_community_rate_limit
--       ADD CONSTRAINT ck_rl_action CHECK (action IN (
--         'notice_create','notice_update','notice_confirm','notice_resolve','notice_report',
--         'card_create','card_update','card_confirm','card_resolve','card_report',
--         'card_photo_upload',
--         'business_welcome_publish','business_welcome_retract'
--       ));
--   COMMIT;
```

**Constraint-semantics preservation:** the thirteen allowed action keys and their exact spelling match migration 152's post-apply CHECK. Nothing else in the rollback changed. The forward migration is identical to before this patch.

Blast radius of the fixed rollback (bounded):

- `nex_migration_history` · DELETE one row (`version = '197'`).
- `nex_community_rate_limit` · DELETE only rows where `action = 'peer_message_guest'`. Scoped. No other action key touched.
- `ck_rl_action` · narrowed back to the 13-key list in force before migration 197. No other constraint touched. No row of any other action affected.
- The `COMMENT ON CONSTRAINT` added by migration 197's forward step is not restored; a trivial cosmetic loss, not a safety concern.

Nothing outside `nex_community_rate_limit` and `nex_migration_history` is reachable from this rollback.

---

## 3 · Behavioural tests · what each one actually exercises

Five new tests in a new `describe` block inside the existing test file. They mock the five module boundaries `sendGuestMessageAction` touches via `vi.hoisted` + `vi.mock` (the same pattern established by `src/lib/nex-native/__tests__/vault-entry-service.test.ts`):

- `@/lib/nex-native/community/rate-limit` → `recordIfAllowed` injected
- `@/lib/nex-native/first-conversation/provisional-session` → `resolveNexAppOrProvisionalSession` injected
- `@/lib/nex-native/peer-conversation-service` → `getOrCreatePeerConversation` injected
- `@/lib/nex-native/supabase-admin` → `nexSupabaseAdmin.from(...).insert` injected
- `next/cache` → `revalidatePath` injected

The sealed primitive at `src/lib/nex-native/community/rate-limit.ts` is **not modified**. The sealed error class at `src/lib/nex-native/community/types.ts:373-385` is **not modified**. The action at `_actions.ts` is **not modified**. Tests observe branch dispatch only, by asserting on the function's return value and on whether downstream mocks were called.

### Test · 1 · Allowed request

| Setup | `recordIfAllowed` resolves · session is provisional · conversation returned · insert resolves `{ error: null }` |
|---|---|
| Assertion | Return value is `{ ok: true, message_id: <string> }` |
| Assertion | `recordIfAllowed` called exactly once with `(GUEST_ID, "peer_message_guest")` |
| Assertion | `nex_peer_message` insert called exactly once with `conversation_id`, `sender_account_id`, `body: "hello"`, `encrypted: false` |
| Assertion | `invocationCallOrder` proves rate-limit ran strictly before insert |
| What this proves | The allowed branch dispatches to the message-send path and the primitive is interposed on the exact axis documented |
| What this does **not** prove | That the primitive itself works · that the DB really accepts the row · that the write survives concurrency |

### Test · 2 · Rate-limit rejection

| Setup | `recordIfAllowed` rejects with `new NexCommunityRateLimitError("peer_message_guest", 60, 10)` |
|---|---|
| Assertion | Return value `.toEqual({ ok: false, reason: "rate_limited", rate_limited_window_minutes: 60, rate_limited_max_per_window: 10 })` |
| Assertion | `getOrCreatePeerConversation` **never** called |
| Assertion | `nex_peer_message` insert **never** called |
| Assertion | `revalidatePath` **never** called |
| What this proves | A sealed-class rejection is correctly translated into the `rate_limited` result enum branch, and the message-send + cache-nudge paths are both skipped |
| What this does **not** prove | That the primitive actually throws the sealed class under real DB load · that the UI consumer renders the `rate_limited` reason (it does not today — see §5) |

### Test · 3 · Non-rate-limit infrastructure error (documented fail-open)

| Setup | `recordIfAllowed` rejects with `new Error("community-rate-limit.read · simulated pooler timeout")` · all downstream mocks healthy |
|---|---|
| Assertion | Return value `.ok === true` and `.reason === undefined` |
| Assertion | `nex_peer_message` insert **called exactly once** (the fail-open path) |
| Assertion | `console.warn` called with a message containing `"rate-limit primitive failed"` |
| What this proves | The current fail-open policy is faithfully implemented · a non-sealed error from the primitive does NOT block the write |
| What this does **not** prove | That the fail-open policy is **correct**. This test name explicitly reads `"documented fail-open · message IS inserted (BYPASS of the limit)"` so a passing count can never be mistaken for proof that the limit is enforced under infrastructure failure |

### Test · 4 · Non-provisional session

| Setup | `resolveNexAppOrProvisionalSession` resolves `{ kind: "none" }` |
|---|---|
| Assertion | Return `{ ok: false, reason: "unauthenticated" }` |
| Assertion | `recordIfAllowed` **never** called (unauthenticated callers must not consume limiter budget) |
| What this proves | A future refactor that moves the primitive call ahead of the session check will fail this test |

### Test · 5 · Empty message short-circuit

| Setup | Provisional session · action called with `"   "` |
|---|---|
| Assertion | Return `{ ok: false, reason: "empty" }` |
| Assertion | `recordIfAllowed` **never** called (whitespace-only submits must not consume limiter budget) |
| What this proves | A future refactor that moves the empty check below the primitive call will fail this test, closing a trivial amplification vector |

### Why the structural source-grep tests are kept

The original four describe blocks (16 tests) are retained because the behavioural tests above do **not** replace them · they prove different things. The source-grep tests catch a refactor that removes the primitive import, drops the rate_limited reason from the result enum, or silently reverts the fail-open posture to a `return reason: "db_error"` without a corresponding behavioural failure. The two layers are complementary, not redundant.

---

## 4 · Test results

Exact commands and counts actually run during this patch:

```
> npx vitest run src/app/nex-native/chat/guest/[ownerAccountId]/__tests__/send-guest-message-rate-limit.test.ts

 Test Files  1 passed (1)
 Tests       21 passed (21)
 Duration    347ms
```

```
> npx vitest run src/lib/nex-native/community/__tests__/types.test.ts src/app/nex-native/chat/guest/

 Test Files  2 passed (2)
 Tests       32 passed (32)
 Duration    362ms
```

Breakdown of the 21:

- 5 · `peer_message_guest · rate-limit config` — unchanged (config shape)
- 3 · `NexCommunityRateLimitError · translation` — unchanged (error class)
- 7 · `guest-chat action · source-shape invariants` — unchanged (static-source refactor guards)
- 1 · `result enum completeness` — unchanged (discoverability placeholder)
- **5 · `guest-chat action · behavioural tests · mocked primitive` — new in this patch**

No test suite was weakened. No test was deleted. No `.skip` or `.only`.

**Important — what a green count does and does not prove here:**

- ✅ Proves · with the primitive injected to resolve/throw/throw-sealed, `sendGuestMessageAction` dispatches to the branch the policy documents.
- ✅ Proves · the DB insert, cache-nudge, and conversation-resolve paths are skipped on sealed-class rejection.
- ✅ Proves · unauthenticated and empty-message short-circuits occur before the primitive is called.
- ❌ Does **not** prove · the primitive behaves correctly against a real `nex_community_rate_limit` row under `(account_id, action, window_started_at)` SELECT→UPSERT races.
- ❌ Does **not** prove · the 10-per-60-min limit is enforced correctly against burst traffic.
- ❌ Does **not** prove · migration 197 applies cleanly or that the rollback runs on real data (both still unapplied drafts).

Treat the 21/21 as "the branches we wired up behave as asserted when the primitive returns/throws what we injected," nothing more.

---

## 5 · Remaining risks · unchanged by this patch

The safety review's §Q7 checklist carried nine items. This patch closes item 1 (rollback ordering) and item 3 (behavioural tests). The following remain open:

| # | Risk | Status | Owner / blocker |
|---|---|---|---|
| 2 | **Migration 197 unapplied** · the limit is a wired code path, not live protection | Open | Operator · separate explicit authorisation required (per CLAUDE.md §5, DB migrations are a separate gate) |
| 4 | **Concurrency overshoot** · primitive is SELECT→UPSERT, not atomic · N concurrent calls at a cold bucket can all pass | Open | Needs Docker schema harness (not installed on this host) to measure, then a policy call between advisory-lock, atomic-upsert-with-WHERE, or accept-the-overshoot |
| 5 | **Fail-open posture after migration applies** · any `rate-limit.read`/`rate-limit.write` failure silently allows the message · tested as such but not resolved | **Policy question** (see below) |
| 6 | **UI consumer does not render `rate_limited`** · falls through to generic "Could not send" at `_guest-chat-client.tsx:161-171` · users do not learn why their send failed | Open · pending separate PR as scoped by this patch's boundaries |
| 7 | **G2 fingerprint re-check** · session-hijack remains undetected across every guest-chat conversation | Open · requires client-contract extension · deferred to separate design pass |
| 8 | **No observability** on either `rate_limited` returns or `console.warn` fail-open logs · operators cannot see when the limit is firing or when it is being bypassed | Open · metrics/alerting is operator work |
| 9 | **Four other `recordIfAllowed` call-sites** (`notice-service.ts`, `lost-found-service.ts`, `business-discovery-service.ts`, plus the primitive itself) · consistency audit not performed in this patch | Open · review-only follow-up, not touched here |

### Policy question that requires an owner decision (item 5)

**Current behaviour after migration 197 applies:**

- `NexCommunityRateLimitError` thrown by primitive → user sees `rate_limited` result (verified by Test 2).
- Any other error thrown by primitive (pooler timeout, service-role issue, `community-rate-limit.read`/`.write` failure, future refactor exception) → `console.warn` + fall-through → message IS inserted (verified by Test 3).

**The policy decision needed, verbatim:**

> After migration 197 has been applied and the limit is operational, when the rate-limit primitive itself throws a non-sealed error (indicating infrastructure failure rather than a cap breach), should `sendGuestMessageAction`:
>
> - (a) **Fail-open** · log the error, allow the message, accept that infrastructure failures disable the limit for the duration. _Current behaviour._ Risk: an attacker who can degrade primitive latency / cause errors (e.g. a pooler-exhausting burst) also removes the rate limit for the duration.
> - (b) **Fail-closed** · return `reason: "db_error"` on primitive failure, blocking the send. Risk: a pooler outage breaks all guest chat, visible to users, until the pooler recovers.
> - (c) **Fail-closed with a short retry/jitter** · retry the primitive once on infrastructure error, then fail-closed. More code, needs a bound on retry latency.
> - (d) **Keep fail-open, but add a metric + alert** on the `console.warn` so operators are paged when the fail-open path fires. Policy unchanged, visibility added.

This patch does not pick between (a)–(d). It implements (a) faithfully, tests it honestly, and surfaces the question for owner resolution. The in-code comment at `_actions.ts:99-102` says the fail-open preserves current behaviour "pre-migration-197" · once the migration applies, the comment's own premise no longer justifies the policy and this question has to be answered.

If the owner decides on (b), (c), or (d), the change touches `_actions.ts` and the behavioural Test 3 must be updated to assert the new policy. If the owner decides on (a) explicitly, document the decision in a short follow-up seal.

---

## 6 · Boundary compliance

- ✅ Only migration 197 and the focused test file were edited (plus this new report).
- ✅ `_guest-chat-client.tsx` not edited.
- ✅ No fingerprint signals added · no G2 work · five-signal fingerprint doctrine unchanged.
- ✅ No change to rate thresholds, entitlement policy, message schema, account claiming, Vault, theme commerce, Hammerex, or any other messaging stage.
- ✅ No `.env.local` read · no DB connection · no migration run · no deploy · no dependency install.
- ✅ No git stage/commit/push performed.
- ✅ No unrelated or pre-existing working-tree change touched.
- ✅ Sealed `recordIfAllowed` not modified · sealed `NexCommunityRateLimitError` not modified · sealed action not modified.
- ✅ No static-source assertion was substituted for a behavioural test · behavioural tests use `vi.mock` injection against observable outcomes (return values, call counts, call order, downstream-mock invocation).

---

## 7 · Next step

Stop. Awaiting owner review of:

1. The rollback diff on migration 197.
2. The five behavioural tests and the honesty of their names/assertions.
3. The policy question in §5 for the post-migration fail-open posture.

Do **not** apply migration 197. Do **not** begin the next messaging stage. Do **not** touch the UI consumer or G2 fingerprint work until the policy question is resolved and the remaining risks have an authorised plan.
