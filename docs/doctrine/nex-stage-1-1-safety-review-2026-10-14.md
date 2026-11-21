# NEX · Stage 1.1 safety review before further implementation

Date: 2026-10-14
Scope: review-only. No app-code, migration, DB, deploy, dependency, secret, or git operation performed.
Artefacts inspected (file:line evidence throughout):

- `nex-supabase/migrations/197_nex_community_rate_limit_peer_message_guest.sql` (113 lines, unapplied draft)
- `nex-supabase/migrations/146_nex_community_watch_core.sql` (table shape · lines 346-363)
- `nex-supabase/migrations/150_nex_community_phase2a_lost_found.sql` + `152_nex_community_phase2b_business_welcome.sql` (pattern precedent · line 93, line 101)
- `src/lib/nex-native/community/rate-limit.ts` (primitive · 79 lines, all)
- `src/lib/nex-native/community/types.ts` (config · lines 304-395)
- `src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts` (server action · lines 1-141)
- `src/app/nex-native/chat/guest/[ownerAccountId]/__tests__/send-guest-message-rate-limit.test.ts` (16 tests, 220 lines)
- `src/app/nex-native/chat/guest/[ownerAccountId]/_guest-chat-client.tsx` (consumer · lines 153-186)
- `src/lib/nex-native/community/__tests__/` directory listing (only `types.test.ts`)


---

## Q1 · Fail-open posture after migration 197 applies

**Does the catch allow guest messages through when the rate-limit service fails?** Yes, by design today, and the design does not change after migration 197 applies. That is a real residual bypass surface.

Source evidence (`_actions.ts:88-107`):

```ts
try {
  await recordIfAllowed(guestAccount.id, "peer_message_guest");
} catch (err) {
  if (err instanceof NexCommunityRateLimitError) {
    return { ok: false, reason: "rate_limited", ... };
  }
  // Fail-open on any other error · ...
  console.warn("[guest-chat] rate-limit primitive failed · falling through ...", ...);
}
```

Primitive's three distinct throw paths (`rate-limit.ts`):

- Line 50 · `throw new Error('community-rate-limit.read · ${readErr.message}')` → generic Error · falls through fail-open.
- Line 54 · `throw new NexCommunityRateLimitError(action, windowMinutes, maxPerWindow)` → sealed class · correctly returns `rate_limited`.
- Line 76 · `throw new Error('community-rate-limit.write · ${writeErr.message}')` → generic Error · falls through fail-open.

Failure modes that bypass the safeguard after migration 197 applies:

1. **Transient Supabase pooler outage** — read or write fails · falls through · attacker's N+1 messages all go in while the pooler is degraded.
2. **Service-role credential issue** — admin client write rejected · falls through.
3. **Row-level `ck_rl_count` violation** (count<0 somehow) — generic Error · falls through.
4. **Any future refactor** inside `recordIfAllowed` that throws a non-sealed error (e.g. a TypeError on malformed input) — falls through.
5. **Deliberately induced DB load** — if an attacker can degrade read latency enough to exceed the Supabase client's default timeout, every call throws a timeout Error · falls through.

The in-code comment at `_actions.ts:99-102` only justifies the fail-open "during the deploy window where code has shipped but migration has not." Once migration applies, the comment's premise no longer holds, but the fail-open still fires on every non-rate-limit error. That is a quiet policy weakening — the migration converts the limit from "soft" to "hard only when the DB is healthy."

The `console.warn` is the only observability. There is no metric, no alert, no error log tag that an operator would notice. Silent degradation.

---

## Q2 · Is migration 197 safe to apply, and is rollback genuinely safe?

### Forward migration · safe

Forward SQL (`197_nex_community_rate_limit_peer_message_guest.sql:60-97`):

- Wrapped in `BEGIN; ... COMMIT;` — atomic.
- Prerequisite guard · `DO $$ ... RAISE EXCEPTION 'migration 197 requires nex_community_rate_limit (migration 146)' ...` (lines 64-69). Fails loud if 146 absent.
- `DROP CONSTRAINT IF EXISTS ck_rl_action` + `ADD CONSTRAINT ck_rl_action CHECK (action IN (...))` with the full 14-key list — matches the pattern established in `150_nex_community_phase2a_lost_found.sql:93-104` and `152_nex_community_phase2b_business_welcome.sql:101-109`.
- The new CHECK is a strict **superset** of the previous CHECK (adds `peer_message_guest`). Every existing row remains valid. No row deletion. No column change. No index change. No RLS change. No `nex_account`, Vault, Bridge-99 fingerprint, launch-flags, or theme-commerce (191-196) surface touched.
- `INSERT INTO nex_migration_history ... ON CONFLICT (version) DO NOTHING` — idempotent.
- Inside the single transaction, the brief window between DROP and ADD cannot be observed by other sessions (schema change takes an `ACCESS EXCLUSIVE` lock on the table).

**Forward application risk: low.** No destructive change · no row deletion · no breakage of existing data.

### Rollback · one real defect

Rollback (inline SQL comment, lines 42-57) runs these statements in this order:

```sql
BEGIN;
  DELETE FROM nex_migration_history WHERE version = '197';     -- 1 row
  ALTER TABLE nex_community_rate_limit DROP CONSTRAINT IF EXISTS ck_rl_action;
  ALTER TABLE nex_community_rate_limit ADD CONSTRAINT ck_rl_action CHECK (action IN (
    'notice_create', ..., 'business_welcome_retract'            -- 13 keys · no peer_message_guest
  ));
  DELETE FROM nex_community_rate_limit WHERE action = 'peer_message_guest';
COMMIT;
```

**Defect:** `ADD CONSTRAINT` with the narrower 13-key list runs **before** the `DELETE` of any `peer_message_guest` rows. If the forward migration has been live long enough for at least one guest-chat follow-up to have recorded, the `ADD CONSTRAINT` validation scans the table and fails with:

```
ERROR: check constraint "ck_rl_action" of relation "nex_community_rate_limit" is violated by some row
```

The transaction aborts and nothing changes · which is safe in the sense of "no partial state," but the rollback plan as written **cannot complete** when it is actually needed (any live window of real traffic). An operator reaching for this script in an incident would see the failure, have to re-order the statements by hand, and lose time.

**Fix (not applied in this review):** swap statement order to DELETE the rows **before** the ADD CONSTRAINT:

```sql
BEGIN;
  DELETE FROM nex_migration_history WHERE version = '197';
  DELETE FROM nex_community_rate_limit WHERE action = 'peer_message_guest';  -- MOVED UP
  ALTER TABLE nex_community_rate_limit DROP CONSTRAINT IF EXISTS ck_rl_action;
  ALTER TABLE nex_community_rate_limit ADD CONSTRAINT ck_rl_action CHECK (action IN (
    'notice_create', ..., 'business_welcome_retract'
  ));
COMMIT;
```

Rows the rollback **could** touch (bounded):

- `nex_migration_history` · exactly one row where `version = '197'`.
- `nex_community_rate_limit` · only rows where `action = 'peer_message_guest'`. The DELETE is action-scoped; no other action's rows are at risk.

Constraints the rollback **could** change:

- `ck_rl_action` on `nex_community_rate_limit` · narrowed back to the 13-key set.
- The `COMMENT ON CONSTRAINT ck_rl_action ...` added by migration 197 line 86-87 is **not restored** by the rollback (the constraint is dropped and re-added without a comment). This is cosmetic — not a safety concern — but worth noting.

Nothing outside `nex_community_rate_limit` and `nex_migration_history` is reachable from the rollback.

**Verdict:** forward migration is safe; rollback has a one-line ordering bug that needs fixing before the migration is applied, so that if we ever have to undo it, the undo actually runs.

---

## Q3 · Does the implementation distinguish rate-limit rejection from infrastructure errors?

**Yes at the type level · no at the user-facing level.**

Type-level distinction (`_actions.ts:91`, `community/types.ts:373-385`):

- `NexCommunityRateLimitError extends Error` with `readonly code = "rate_limited" as const` and `readonly action`, `readonly windowMinutes`, `readonly maxPerWindow`.
- The action's `instanceof NexCommunityRateLimitError` branch is the only path that returns `reason: "rate_limited"`.
- Generic `Error` from `recordIfAllowed`'s read/write failures (`rate-limit.ts:50`, `rate-limit.ts:76`) hits the fall-through branch.

Test coverage for the distinction:

- `send-guest-message-rate-limit.test.ts:118-124` asserts `err instanceof NexCommunityRateLimitError` is true for the sealed class and false for a plain Error.
- `send-guest-message-rate-limit.test.ts:108-116` asserts the error message carries the honest action/window/cap and leaks no PII, fingerprint, or network identifier.

But the user-facing consequence is **asymmetric**:

- Hit the cap → user sees `rate_limited` reason (once the UI renders it · see Q6).
- Hit a DB outage → user's message **goes through** silently and the operator sees only a `console.warn`.

So the implementation correctly **classifies** the two cases but then **collapses** one of them into the happy path. That is a deliberate policy choice today (preserve current behaviour during deploy window) but it also means the limit is not uniformly enforced in production.

---

## Q4 · Concurrency overshoot and the test needed to measure it

### Mechanism

Primitive logic (`rate-limit.ts:34-78`) is read-then-check-then-upsert:

1. `SELECT count` for `(account_id, action, window_started_at)` (lines 42-48).
2. If `count >= config.maxPerWindow` → throw `NexCommunityRateLimitError` (lines 53-58).
3. Else `UPSERT { count: currentCount + 1 }` with `onConflict: "account_id,action,window_started_at"` (lines 63-74).

The primitive's own docstring (lines 9-13) is honest:

> "Not atomic in the strict sense — two concurrent calls to recordIfAllowed at a cold bucket could both pass."

Observable overshoot: **N concurrent requests can all pass the check** when they execute step 1 before any has executed step 3. The UPSERT uses `count: currentCount + 1` (not an atomic increment), so the last writer wins. The persistent counter settles at `K+1` even though `N` messages were allowed through. The primitive **cannot self-detect** the overshoot after the fact.

Worst-case: an attacker that can fire N concurrent HTTP requests at `sendGuestMessageAction` from a single provisional account can push N messages through in a single burst, regardless of the configured cap of 10/hour. The bound is set by network concurrency, not by the limiter.

### Test required

Not implementable in the current harness. The test needs a real Postgres with:

- Migrations 001..197 applied (so the extended CHECK exists).
- Seeded `nex_account` row for the test provisional user.
- Direct in-process access to `recordIfAllowed` with the `nexSupabaseAdmin` client pointed at the ephemeral DB.

Scenario:

```
seed: nothing in nex_community_rate_limit
act:  fire 50 concurrent recordIfAllowed(acct, 'peer_message_guest')
measure: how many resolve (succeeded) vs how many reject with NexCommunityRateLimitError
expectation (today, racy): first ~10 reliably succeed, then up to K extra succeed depending on scheduler
expectation (after atomic fix): exactly 10 succeed, 40 reject
```

This test currently cannot run because Docker Desktop is not installed on this host. The design-contract criterion #12 for Stage 1.1 was explicitly to run this test; it has not been run. No live schema harness exists in this PR. The in-code comment at `_actions.ts:85-87` claims "the adversarial burst test for this PR characterises the overshoot" — that claim is **inaccurate**: no such test exists in the repo.

### What a true atomic enforcement would look like

Options (listed, not recommended until authorised):

- Postgres advisory lock on `hashtextextended(account_id || action, 0)` at primitive entry, released at commit.
- Single-round-trip `INSERT ... ON CONFLICT (...) DO UPDATE SET count = nex_community_rate_limit.count + 1 WHERE nex_community_rate_limit.count < $maxPerWindow RETURNING count` — the `WHERE` on the UPDATE prevents increment past the cap atomically; `RETURNING` plus a zero-row check tells the caller whether the write happened.
- A stored procedure wrapping the SELECT+UPDATE under row lock.

Any of these would need its own migration and a dedicated behavioural test suite. Out of scope for Stage 1.1 as scoped today.

---

## Q5 · Do the 16 tests exercise real enforcement behaviour or mainly mock the primitive?

**Neither · they exercise static plumbing.** None mock the primitive; none execute the primitive against a database.

Breakdown of `send-guest-message-rate-limit.test.ts`:

| describe block | tests | what they assert | real enforcement? |
|---|---|---|---|
| `peer_message_guest · rate-limit config` (lines 37-92) | 5 | shape of the `NEX_COMMUNITY_RATE_LIMITS` constant: key membership, config values, union completeness | **No.** Validates constants. |
| `NexCommunityRateLimitError · translation` (lines 94-125) | 3 | error class constructor stores action/window/cap, message string, instanceof | **No.** Validates the error class in isolation. |
| `guest-chat action · source-shape invariants` (lines 127-205) | 7 | `readFileSync(_actions.ts)` + `.indexOf()` + `.toMatch()` to assert specific lines of source text exist | **No.** Static-source grep. |
| `result enum completeness` (lines 207-220) | 1 | `expect(true).toBe(true)` with a documentary name | **No.** Discoverability placeholder. |

What the tests prove:

- The config constant has `peer_message_guest` with `{60, 10}`.
- The error class exists and is distinguishable from a plain Error.
- The action's source text imports the primitive and calls it before `nex_peer_message.insert`.
- The action's source text contains a `console.warn` and does not return `db_error` from the catch.

What the tests do **not** prove:

- That `sendGuestMessageAction` actually returns `{ ok: false, reason: "rate_limited" }` when the primitive throws the sealed error (never injected).
- That `sendGuestMessageAction` actually returns `{ ok: true }` when the primitive throws a non-sealed error (never injected).
- That the DB insert path is skipped when the primitive rejects (not asserted — only line-ordering is).
- That the primitive itself behaves correctly against a real `nex_community_rate_limit` table under single or concurrent load.

Separate confirmation: `src/lib/nex-native/community/__tests__/` contains **only** `types.test.ts`. `recordIfAllowed` has **no behavioural test anywhere in the repo**. The sealed primitive has been in production since migration 146 (per the type file comments) but its concurrency and error-path behaviour have never been proven in CI.

**Characterisation:** these are *structural guards* that catch future refactors silently dropping the plumbing. They do not substantiate "the safeguard works." They are useful; they are not sufficient.

---

## Q6 · Can the UI display the actual retry window without exposing internal details?

**Yes · and today it does not even try.**

What the result enum carries (`_actions.ts:17-33`):

```ts
rate_limited_window_minutes?: number;   // = 60 (config value)
rate_limited_max_per_window?: number;   // = 10 (config value)
```

Both are **configuration constants**, not per-request state. They do not leak:

- the actual `window_started_at` timestamp (not surfaced)
- the current DB `count` (not surfaced)
- the action key `peer_message_guest` (not surfaced)
- any fingerprint, IP, or account identity (not surfaced)

What the UI consumer does **today** (`_guest-chat-client.tsx:161-171`):

```ts
if (!result.ok) {
  setSendError(
    result.reason === "unauthenticated"
      ? "Your session expired. Return to the shop to start again."
      : result.reason === "too_long"
        ? "Message is too long (max 2000 characters)."
        : result.reason === "empty"
          ? "Please type a message."
          : "Could not send. Please try again.",
  );
  return;
}
```

The `rate_limited` branch is **not handled**. It falls through to the generic "Could not send. Please try again." · a user who hits the limit is told the request failed, nothing about why or when they can retry. That is dishonest UX given the server knows the exact cause and window.

What the UI **can** honestly say with the current fields:

- "You can send up to 10 messages per hour. Please wait before trying again."
- "You've reached the hourly message limit. Try again shortly."

What the UI **cannot** say without an added server field:

- "Try again in 23 minutes" with a precise countdown · would need the server to compute `retry_after_seconds = (window_started_at + windowMinutes * 60) - now()` and return it. This is a per-request derived value and does not leak bucket timing because the server rounds `window_started_at` to the floor of `windowMinutes` anyway (`rate-limit.ts:26-29`).

**Verdict for Q6:** the honest window-level message is reachable right now with zero new server work; the precise countdown would need one additional numeric field. Neither path exposes internals.

---

## Q7 · What must change before this safeguard can honestly be called effective?

Checklist with source anchors. Until every box is ticked, the right language in docs and comments is "wired code path, not live protection":

1. **Rollback ordering fix** in `migration 197 lines 42-57` — DELETE `peer_message_guest` rows **before** the narrowed `ADD CONSTRAINT`. Current order will abort rollback when any real traffic has recorded.
2. **Migration 197 applied** to live Supabase `ijvqdvsvwtwxzcqmoqit` — unapplied draft today.
3. **Behavioural tests** that inject the primitive (via `vi.mock`) to force three paths:
   - sealed error thrown → action returns `rate_limited` with window/cap surfaced
   - generic Error thrown → action returns `{ ok: true }` (fail-open path proven, not just asserted via grep)
   - resolve → action proceeds to `nex_peer_message.insert`
4. **Concurrency overshoot test** against a real Postgres — currently blocked by Docker Desktop missing. Measurement is a prerequisite for choosing between "accept the overshoot," "move to atomic UPSERT WHERE count < cap," or "advisory lock."
5. **Fail-open posture re-evaluation** post-migration — the current fail-open is justified only during the deploy window. After the migration is live, infrastructure failures silently disable the limit. Decision needed: keep fail-open with a metric + alert, or convert to fail-closed with a monitored breaker.
6. **UI consumer branch** in `_guest-chat-client.tsx:161-171` — render the `rate_limited` reason honestly. Without this, the limit is invisible to the user; they just see a generic failure.
7. **G2 fingerprint re-check** — still open. Session-hijack remains undetected across every guest-chat conversation. Requires the design pass + action-signature extension flagged in the roadmap.
8. **Observability** — a counter metric on both the `rate_limited` return and the fail-open `console.warn` so operators can tell when the limit is firing and when it is being bypassed by infrastructure failures. Right now, both are silent.
9. **Audit the four other `recordIfAllowed` call-sites** (`notice-service.ts`, `lost-found-service.ts`, `business-discovery-service.ts`, plus the primitive itself) to confirm whether they share the same fail-open posture or already fail-closed. Consistency check only — do not modify sealed services in this review.

Only items (1), (3), and (6) are doable without DB access, Docker, or new architecture. Items (2), (4), (5), (7), (8) each need an operator action, environment change, or separate design pass.

---

## Smallest safe next change (proposal, not an action)

**Fix the rollback ordering defect in migration 197 and add three behavioural tests that inject the primitive.**

Why this and not something else:

- **One real correctness defect in the review.** The rollback as written fails under real traffic. Fixing it is a four-line SQL re-ordering. It needs doing before the migration ever gets applied, because the migration is only safe if the rollback is safe. No DB touch.
- **Behavioural tests close the biggest honesty gap** — today the 16 tests prove plumbing exists but not behaviour. Three injected-mock tests (sealed error / generic error / happy path) raise confidence to "the primary branches behave as asserted" without needing Docker, DB, or network. Pattern already established in sibling tests via `vi.mock`.
- **Does not weaken the policy.** The policy today is "frequency limit at 10/hour, soft until migration applies, hard once applied, fail-open on infrastructure error." Nothing about that changes.
- **Does not alter sealed doctrine.** No change to Bridge 99 fingerprint whitelist, Chat Master Layout, Vault, launch flags, account identity, `recordIfAllowed`, or any sealed error class. The migration SQL change is in an unapplied draft the operator still owns.
- **Keeps the three remaining Stage 1.1 follow-ups independent** so each can be reviewed on its own merits:
  - G2 fingerprint re-check design pass
  - UI consumer honest rendering in `_guest-chat-client.tsx`
  - Docker schema harness + concurrency overshoot test

Explicit non-goals of this proposed next change:

- Do **not** apply migration 197 to any database.
- Do **not** modify `recordIfAllowed`, `NexCommunityRateLimitError`, or any sealed primitive.
- Do **not** change the fail-open policy (that is a separate call).
- Do **not** render anything new in the client (separate PR).
- Do **not** touch the four other callers of `recordIfAllowed`.

Expected delta: migration 197 SQL body (comment-block statements reordered, 4 lines moved), test file `send-guest-message-rate-limit.test.ts` (+3 tests using `vi.mock("./_actions.ts' primitive")` injection pattern · ~60 lines).

---

## Boundary compliance for this review

- Read-only. Only one new file was written: this report.
- No app code modified. No migration SQL modified.
- No database connection, no deployment, no secret access, no dependency install, no git op.
- No public chat entry point added.
- Sealed NEX doctrine not softened: Bridge 99, Chat Master Layout, ONE NEX IDENTITY, Phase 1 category closed set, provisional-session anchor, launch gates all unchanged.

End of review. Stop for owner decision on whether to proceed with the proposed smallest next change, or redirect.
