# NEX · Stage 1.1 · verification of corrective patch + fail-open decision note

Date: 2026-10-14
Companions:
- `docs/doctrine/nex-stage-1-1-safety-review-2026-10-14.md`
- `docs/doctrine/nex-stage-1-1-corrective-patch-2026-10-14.md`

Scope: **read-only.** No code, test, migration, DB, deploy, secret, dependency, or git-state change performed during this review. Working-tree state preserved verbatim. Migration 197 remains unapplied. UI consumer untouched.

---

## Part A · Verification of the corrective diff

### Working-tree status (evidence)

```
git status --porcelain=1  (filtered to Stage 1.1 paths)
 M src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts
?? nex-supabase/migrations/197_nex_community_rate_limit_peer_message_guest.sql
?? src/app/nex-native/chat/guest/[ownerAccountId]/__tests__/send-guest-message-rate-limit.test.ts
```

- `_actions.ts` is **tracked and modified** · `git diff --stat` reports `62 insertions(+), 1 deletion(-)` — matches the corrective-patch report.
- Migration 197 is a **new untracked file** · no prior git version exists, so verification is by file content + sibling-migration byte-compare against migration 152 (the "original definition" the rollback must restore).
- Test file is a **new untracked file** · same posture · verified by content inspection.

Unrelated files in the working tree (29 modified + untracked data/docs) were **not touched** during this verification.

### Check 1 · Rollback deletes only intended rows before restoring the narrower constraint

Current rollback (`migration 197 lines 42-67`):

```sql
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

Scoping evidence:

- `DELETE FROM nex_migration_history WHERE version = '197'` · one row by primary key.
- `DELETE FROM nex_community_rate_limit WHERE action = 'peer_message_guest'` · action-column scoped. No other action key's rows are reachable from this DELETE. No cascading side effect: `nex_community_rate_limit` is a leaf table (per migration 146 lines 346-363, it has no FK children, only an FK to `nex_account(id) ON DELETE CASCADE` inbound, which the DELETE does not traverse).
- The DELETE statement precedes `ADD CONSTRAINT` by two statements. Any `peer_message_guest` row that would otherwise violate the narrower CHECK is removed first.

**Verdict: PASS.** Rollback is action-scoped and correctly ordered.

### Check 2 · Restored constraint matches the original definition exactly

Byte-level comparison, rollback (migration 197 lines 61-65) vs the last-authoritative CHECK before 197 (migration 152 lines 103-108):

```
rollback (197:61-65, SQL-comment prefix stripped)
    'notice_create','notice_update','notice_confirm','notice_resolve','notice_report',
    'card_create','card_update','card_confirm','card_resolve','card_report',
    'card_photo_upload',
    'business_welcome_publish','business_welcome_retract'

migration 152:104-107 (the authoritative "original" immediately pre-197)
    'notice_create','notice_update','notice_confirm','notice_resolve','notice_report',
    'card_create','card_update','card_confirm','card_resolve','card_report',
    'card_photo_upload',
    'business_welcome_publish','business_welcome_retract'
```

Thirteen keys, identical spelling, identical ordering, identical grouping on four lines. Byte-identical.

Note: migration 146's **initial** CHECK was only 5 keys (`notice_*`). The post-rollback state must be the **last** state before 197, which is migration 152's 13-key list, not migration 146's 5-key list. The rollback restores the correct 13-key state.

**Verdict: PASS.** Restored CHECK is byte-identical to the state in force immediately before migration 197.

### Check 3 · Forward migration is unchanged

Forward SQL body (`migration 197 lines 70-107`):

- `BEGIN;` (line 70)
- Prerequisite guard raising on missing table (lines 74-79)
- `ALTER TABLE … DROP CONSTRAINT IF EXISTS ck_rl_action;` (lines 84-85)
- `ALTER TABLE … ADD CONSTRAINT ck_rl_action CHECK (action IN ('notice_create', …, 'peer_message_guest'));` (lines 87-94) · 14 keys
- `COMMENT ON CONSTRAINT ck_rl_action ON nex_community_rate_limit IS '…';` (lines 96-97)
- `INSERT INTO nex_migration_history … ON CONFLICT (version) DO NOTHING;` (lines 99-105)
- `COMMIT;` (line 107)
- Post-apply verification comments (lines 109-123)

Compared to the forward body as captured in the corrective-patch report (lines 60-97 before the rollback comment grew):

- Same number of statements.
- Same statement ordering.
- Same action-key list (14 keys).
- Same prerequisite guard.
- Same COMMENT ON CONSTRAINT text.
- Same `INSERT INTO nex_migration_history` row.
- Only line numbers shifted by +10 across the body, which is explained exactly by the rollback-section comment growing from 16 lines to 26 lines (lines 42-57 → lines 42-67).

**Verdict: PASS.** The forward migration body is content-identical to its state before this patch. Only the rollback comment-block changed.

### Check 4 · Behavioural tests exercise the real action; no mock of the action-under-test

Direct import of the subject (`send-guest-message-rate-limit.test.ts:92`):

```ts
import { sendGuestMessageAction } from "../_actions";
```

The resolved path is the actual action file at `src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts`. No alias indirection.

`vi.mock` targets in the test file (lines 58-80):

- `@/lib/nex-native/community/rate-limit` → **adjacent primitive** mock
- `@/lib/nex-native/first-conversation/provisional-session` → **adjacent** session resolver mock
- `@/lib/nex-native/peer-conversation-service` → **adjacent** conversation service mock
- `@/lib/nex-native/supabase-admin` → **adjacent** DB admin client mock
- `next/cache` → **framework** cache invalidation mock
- `server-only` → **module-shim** so the sibling `community/types.ts` loads under vitest

Grep for any attempt to mock `_actions` itself: **none present.** The test file contains no `vi.mock("../_actions", …)` or any equivalent. The behavioural tests invoke `await sendGuestMessageAction(…)` which executes the real function body with mocks only on its external edges.

Behavioural tests present (lines 281-end):

1. Allowed request → asserts return `{ ok: true, message_id: string }` + `recordIfAllowed` called with `(GUEST_ID, "peer_message_guest")` + insert called once + rate-limit `invocationCallOrder` strictly less than insert's.
2. Rate-limit rejection → asserts `{ ok: false, reason: "rate_limited", rate_limited_window_minutes: 60, rate_limited_max_per_window: 10 }` + `getOrCreateConversation`/`insert`/`revalidatePath` **never called**.
3. Non-rate-limit infrastructure error → asserts current fail-open (`ok: true`, insert called, warn fired) · see Check 5.
4. Non-provisional session short-circuit → asserts `{ ok: false, reason: "unauthenticated" }` + `recordIfAllowed` never called.
5. Empty message short-circuit → asserts `{ ok: false, reason: "empty" }` + `recordIfAllowed` never called.

**Verdict: PASS.** The behavioural suite exercises the real action; mocks are confined to module boundaries the action imports.

### Check 5 · Fail-open test asserts current behaviour accurately

Test 3 (`send-guest-message-rate-limit.test.ts:377-406+`):

- Injects `new Error("community-rate-limit.read · simulated pooler timeout")` — a generic Error whose message matches the primitive's internal throw prefix (`rate-limit.ts:50` and `:76`).
- Asserts `result.ok === true` and `result.reason === undefined`.
- Asserts `H.insert` called exactly once.
- Asserts `console.warn` called with a message containing `"rate-limit primitive failed"`.

Comparing to the action's actual catch block (`_actions.ts:88-107`):

```ts
try {
  await recordIfAllowed(guestAccount.id, "peer_message_guest");
} catch (err) {
  if (err instanceof NexCommunityRateLimitError) { return { ok: false, reason: "rate_limited", … }; }
  console.warn(
    "[guest-chat] rate-limit primitive failed · falling through (soft limit until migration 197 applies)",
    err instanceof Error ? err.message : err,
  );
}
```

The injected error is a plain `Error`, not `NexCommunityRateLimitError`, so the `instanceof` branch is skipped and execution falls through to the `console.warn` and continues to the message-insert block. Test 3's assertions are a faithful mirror of this behaviour.

The test's own name explicitly reads `"non-rate-limit infrastructure error · documented fail-open · message IS inserted (BYPASS of the limit)"`, and the inline comment at test-file lines 377-383 declares the bypass is documented, not endorsed. A future policy change to fail-closed will make this test fail, which forces a conscious policy update rather than a silent drift.

**Verdict: PASS.** The infrastructure-failure test asserts the current fail-open posture accurately and honestly.

### Part A summary

All five checks **PASS**. The corrective patch is internally consistent:

| Check | Result | Evidence anchor |
|---|---|---|
| 1 · DELETE scoping + ordering before CHECK restoration | PASS | `197:55-57, 60-67` |
| 2 · Restored CHECK byte-equal to pre-197 state | PASS | `197:61-65` vs `152:104-107` |
| 3 · Forward migration unchanged | PASS | `197:70-107` body-identical, +10 line shift explained |
| 4 · Behavioural tests exercise real action | PASS | `test:92` real import, no `vi.mock("../_actions")` |
| 5 · Infrastructure-failure test asserts current fail-open | PASS | `test:377-406+` mirrors `_actions.ts:88-107` |

Migration 197 is still an **unapplied draft.** A green verification does **not** constitute authorisation to apply it.

---

## Part B · Fail-open decision note

### The decision at hand

Once migration 197 is applied, every call to `sendGuestMessageAction` executes a rate-limit check against the primitive at `src/lib/nex-native/community/rate-limit.ts`. The primitive can resolve, throw a sealed `NexCommunityRateLimitError`, or throw a generic `Error` prefixed `"community-rate-limit.read · …"` or `"community-rate-limit.write · …"` on infrastructure failures. The current catch block treats the first two cases correctly and **silently allows the message through** on the third. The question is whether that fall-through policy should remain.

### What the architecture lets us know for free

Three facts that constrain the design space (read from the current source · they are not design proposals):

- **F1.** The primitive distinguishes the two error families cleanly: `instanceof NexCommunityRateLimitError` is a reliable discriminator today (verified by behavioural Test 2 vs Test 3). An additional cross-check against the error-message prefix (`^community-rate-limit\.(read|write) · `) is available if we ever stop relying on `instanceof` across module-boundary refactors.
- **F2.** `nexSupabaseAdmin` is the **same client** used by both the primitive (`rate-limit.ts:42-48, 63-74`) and the downstream message-insert path (`_actions.ts:124-134`). If the Supabase pooler is unreachable, the primitive **and** the insert both fail. The scenario "limit is down but legitimate messaging works" is a narrower window than it first appears: it requires a failure confined to the primitive's SELECT/UPSERT path (e.g., a transient read error on a specific row, a buggy UPSERT trigger, or a future refactor-introduced TypeError inside the primitive) **without** affecting the insert path. Pooler-wide outages break both.
- **F3.** The client consumer at `_guest-chat-client.tsx:161-171` already renders a four-way `switch` on `result.reason` with a terminal fall-through for anything unknown. Adding one more branch is a small edit (one additional ternary, one additional copy string). This is the kind of change that normally lands in a separate consumer-UI PR, but the policy decision below is **sequencing-sensitive** on that PR landing first.

### Options

#### Option A · Current fail-open (status quo)

> On non-sealed error from `recordIfAllowed`, log a `console.warn` and allow the message through to `nex_peer_message.insert`.

- **Abuse resistance.** Weak. An attacker who can induce primitive failure (e.g., deliberately shaping a request so the primitive's SELECT trips a specific error path, or saturating pooler connections) silently removes the rate limit for the duration of the failure. Attack path requires low skill and no privileged access. The `console.warn` is the only forensic trail and it is not aggregated into any metric today.
- **Impact on legitimate messaging during outages.** None — users send normally. But by F2, most outages that affect the primitive also affect the insert path, so the "availability win" is partly illusory. The real availability win is when the primitive fails in isolation (buggy UPSERT, trigger regression, concurrent-row anomaly) and the insert still works — a narrower window than it looks.
- **Distinguishes rate-limit rejection from infra failure?** Yes at the type level (`instanceof NexCommunityRateLimitError`). The outcome collapses the infra-failure case into the happy path, so from the user's perspective the two cases are indistinguishable: one case shows `rate_limited`, the other shows success.
- **Server changes required to adopt this option.** None (already in place).
- **Client changes required.** None (already ignores the `rate_limited` reason — a separate consumer-UI PR already pending for that).
- **Tests + observability required.** Behavioural Test 3 already pins this policy. Observability is just the `console.warn` and is operator-invisible without log aggregation. Item 8 of the safety review §Q7 (metric + alert on the warn) is a necessary adjunct for A to be safely production-live.
- **Unresolved assumptions.**
  - That short primitive outages are rare enough that the bypass surface is acceptable.
  - That no attacker can reliably force the primitive into a failure state while leaving the insert path intact.
  - That operators will notice sustained fail-open via logs even without a metric.
  - That the eventual "metric + alert" item in §Q7 lands before the next adversarial event.

#### Option B · Fail-closed with retryable error

> On non-sealed error from `recordIfAllowed`, return `{ ok: false, reason: "rate_limit_unavailable" }`. Do not insert the message.

- **Abuse resistance.** Strong. A primitive failure cannot be used as a vector to bypass the limit — the only outcomes are "allowed," "rate-limited," or "temporarily unavailable, retry." Attacker gains no amplification.
- **Impact on legitimate messaging during outages.** The widest-blast option. If the primitive is truly down for a sustained period, **all** new guest-chat follow-ups are blocked. Mitigated by F2: a Supabase-wide outage already breaks the insert path, so B's additional loss is only in the narrow window of primitive-only failures. The retryable error UX converts the degraded state into an honest "please try again shortly" rather than a silent success.
- **Distinguishes rate-limit rejection from infra failure?** Yes — two distinct reasons: `rate_limited` (the cap was hit) and `rate_limit_unavailable` (the service couldn't check). Each gets its own copy. User can tell "you hit a limit" from "we couldn't check right now."
- **Server changes required.**
  - `SendGuestMessageResult.reason` union gains `"rate_limit_unavailable"` (one-line type edit).
  - `_actions.ts:99-107` catch block changes: swap the `console.warn → fall-through` for `return { ok: false, reason: "rate_limit_unavailable", retry_after_seconds?: <short> }`. The `console.warn` can stay for operator visibility.
  - The comment at `_actions.ts:99-102` must be rewritten so it no longer claims the fail-through is "preserving current behaviour." Policy changed; the comment must track.
- **Client changes required.**
  - `_guest-chat-client.tsx:161-171` grows a sixth branch for `rate_limit_unavailable` with user-safe copy ("Message service is temporarily unavailable. Please try again in a moment.").
  - Must land **before** or **with** the server change — otherwise users see the generic "Could not send. Please try again." when the service is actually unavailable (not worse than today, but misses the honesty gain).
- **Tests + observability required.**
  - Behavioural Test 3 flips: assert `{ ok: false, reason: "rate_limit_unavailable" }` and `insert` **not called** (compared to today's `ok: true` + insert called).
  - A new behavioural test may be worth adding for the sealed-rejection path explicitly separated from the unavailable path, to catch a future `instanceof` regression.
  - UI consumer test (if the behavioural tests for `_guest-chat-client.tsx` land) asserts the retryable copy renders.
  - Operational metric on `rate_limit_unavailable` return count — a spike reliably signals a primitive outage. This is a stronger alerting signal than today's `console.warn` because it rides on an existing per-action return-code metric channel if one exists (if not, this is a new channel to wire up).
- **Unresolved assumptions.**
  - That a short-term block during a primitive outage is more acceptable than a short-term silent bypass. Judgement call. Favours B when attackers are the dominant risk; favours A when infrastructure flakiness is the dominant risk.
  - That the retryable UX copy is honest in context (e.g., we don't accidentally imply the user did something wrong). Needs product/UI review when the UI PR lands.
  - That the primitive's error-prefix contract (`community-rate-limit.read ·` / `.write ·`) stays stable, since we may want to log/alert on it separately from arbitrary runtime errors. Currently stable at `rate-limit.ts:50` and `:76`.

#### Option C · Narrower alternative · fail-closed with one bounded retry

> On non-sealed error from `recordIfAllowed`, retry the primitive **exactly once** with 50–100ms jitter. If the retry also throws non-sealed, return `{ ok: false, reason: "rate_limit_unavailable" }`.

- **Abuse resistance.** Nearly as strong as B. An attacker who can induce a sustained primitive failure still cannot bypass the limit; the one retry doesn't change the sustained-failure case. The only amplification an attacker gets is **doubling** the load they can put on the failing primitive during an attack — which may be a feature (gets them paged faster) or a mild aggravant depending on operator preference.
- **Impact on legitimate messaging during outages.** Best of the three on this axis. Transient (sub-second) primitive blips recover without user-visible errors. Only sustained outages produce the retryable error. This matches the behaviour of most well-designed external-service clients.
- **Distinguishes rate-limit rejection from infra failure?** Yes — same two-reason split as B. Additionally: operators get a *stronger signal* because the metric is now "primitive failed twice in <100ms" rather than "primitive failed once," which is a more reliable sustained-failure indicator.
- **Server changes required.**
  - Same `SendGuestMessageResult.reason` union extension as B.
  - `_actions.ts:88-107` catch block grows to a small retry loop (bounded to 1 retry, jittered sleep).
  - Comment at `_actions.ts:99-107` rewritten to document the retry.
  - A tiny helper function (or inline block) is reasonable here. Nothing architectural.
- **Client changes required.** Identical to B — the client sees `rate_limit_unavailable` either way; the retry is transparent server-side.
- **Tests + observability required.**
  - A behavioural test that injects a two-sequence rejection (`mockRejectedValueOnce` × 2) → asserts `rate_limit_unavailable`.
  - A behavioural test that injects reject-then-resolve → asserts allowed path proceeds normally (the retry recovers).
  - The sealed-rejection test unchanged (sealed error on first attempt returns `rate_limited` immediately; retry does **not** apply to sealed errors because a cap breach is a definitive outcome, not a transient condition — this must be explicit in the implementation).
  - Metric: `rate_limit_unavailable` counter (same channel as B). Optionally a second counter on "primitive retried but recovered" so transient-blip frequency is observable without false alarms.
- **Unresolved assumptions.**
  - That a 1-retry bounded loop is sufficient. Pokerstars-grade clients sometimes do 2 retries with exponential backoff; for a server-action that must respond within a few hundred milliseconds, 1 retry with ≤100ms sleep is a reasonable upper bound. Second retry is a configuration knob, not an architectural change.
  - That sleeping 50-100ms inside a Next.js server action is acceptable (it is — server actions run server-side with no timeout pressure beyond the request-level timeout).
  - That retry is **not** applied to sealed `NexCommunityRateLimitError` throws. This must be explicit in the implementation: a cap breach is not a transient failure. The retry policy applies to the fail-open-today surface only.

### Comparison matrix

| Dimension | A · Fail-open (status quo) | B · Fail-closed retryable | C · Fail-closed with 1 bounded retry |
|---|---|---|---|
| Abuse resistance | Weak · bypass by inducing primitive failure | Strong · no bypass surface | Strong · same surface as B |
| Legitimate messaging during Supabase-wide outage | Breaks (insert fails anyway, per F2) | Breaks (same, visible) | Breaks (same, visible) |
| Legitimate messaging during primitive-only transient blip | Unaffected | Blocks with retryable error | Recovers transparently in most cases |
| Legitimate messaging during sustained primitive-only outage | Unaffected (but limit disabled) | Blocks with retryable error | Blocks with retryable error |
| Rate-limited vs infra-failure distinction (user-visible) | No (infra collapses into success) | Yes (two reasons, two copies) | Yes (two reasons, two copies) |
| Server edits | None | Union + catch rewrite + comment | Union + catch rewrite + 1-retry loop + comment |
| Client edits | None (today's gap) | One branch + copy | One branch + copy |
| Tests to update | Test 3 unchanged | Test 3 flips + reinforce sealed path | Test 3 flips + sealed-no-retry test + recovery test |
| Observability needed | metric on `console.warn` fail-open | metric on `rate_limit_unavailable` returns | metric on `rate_limit_unavailable` + optional "retry recovered" |
| Risk of policy drift | High (comment at `_actions.ts:99-102` already stale once migration applies) | Low (reason enum reads as policy) | Low (same) |
| Implementation complexity | None | Small | Small-plus (one bounded loop) |
| Unresolved assumptions | 4 | 3 | 3 |

### Recommendation

**C · fail-closed with one bounded retry**, sequenced carefully.

Reasoning:

- **F1** gives us a reliable way to distinguish the sealed error (keep returning `rate_limited`) from everything else (retry once, then `rate_limit_unavailable`). The policy's behaviour under each injected input is testable deterministically.
- **F2** means A's "preserves availability" argument is weaker than it reads, because the dominant failure modes already break the insert path. The marginal availability A buys is in the narrow primitive-only-failure window, which C recovers from transparently via its one retry.
- **F3** means the UI consumer edit is small and must land first (or alongside) so users get an honest message instead of the generic "Could not send."
- Compared to B, C is strictly more lenient to legitimate traffic without weakening abuse resistance. The only cost is a tiny retry loop and one additional test.
- C's observability also degrades more gracefully: a retry-recovered counter lets operators see transient-blip frequency without the noise of false alarms, which is useful during the first few weeks after migration applies.

If owner judgement runs the other way — i.e., prefers the simplest change that eliminates the bypass — **B is a defensible fallback.** It is a strict subset of C in behaviour and in code. Pick A only if there is positive evidence that legitimate traffic during primitive-only outages is both frequent AND materially harmed by B/C, which there is no basis for today.

### Sequencing (recommendation on *when* to change, not just *what* to change)

Order of operations the owner may consider when the decision is authorised:

1. **Client UI PR** — `_guest-chat-client.tsx:161-171` grows two new reason branches:
   - `rate_limited` → "You can send up to 10 messages per hour. Please wait before trying again." (closes safety-review Q6 gap today).
   - `rate_limit_unavailable` → "Message service is temporarily unavailable. Please try again in a moment." (needed by the server policy change to land honestly).
   - Behavioural test for the client's reason-branch rendering if the test harness supports it.
2. **Observability PR** — wire up a counter on both `rate_limited` and `rate_limit_unavailable` returns (and keep the `console.warn` for cold forensic trail). Add an alert threshold on `rate_limit_unavailable` spike. Can land independently of (3).
3. **Server policy PR** — flip the catch block from fail-open to C (with 1 bounded retry). Flip behavioural Test 3 to assert the new policy. Add a sealed-no-retry test and a recovery test. Rewrite the stale comment at `_actions.ts:99-102`.
4. **Only after (1), (2), (3) are reviewed and merged**, apply migration 197 to Supabase `ijvqdvsvwtwxzcqmoqit` under separate operator authorisation. This is the first step at which the limit is production-live.

Deferred to their own authorised passes (not blocked by this decision):

- Concurrency overshoot test (needs Docker schema harness).
- G2 fingerprint re-check (requires action-signature extension beyond the current contract).
- Consistency audit of the four other `recordIfAllowed` call-sites.

### Unresolved assumptions this note *does not* resolve

- Whether C's one retry is the right bound (vs 0, 2, or an exponential-backoff loop). Pick a value when C is implemented; this note does not pick for you.
- Whether `rate_limit_unavailable` is the right reason string (vs `rate_limit_service_unavailable`, `temporarily_unavailable`, etc.). Naming is a product-copy decision.
- Whether the client should surface a `retry_after_seconds` for `rate_limit_unavailable` the same way the primitive surfaces `rate_limited_window_minutes` for `rate_limited`. Optional; not required for the policy to land honestly.
- Whether to also apply this policy to the four other `recordIfAllowed` call-sites (`notice-service.ts`, `lost-found-service.ts`, `business-discovery-service.ts`, plus the primitive's own callers). Review-only follow-up.
- The question "is a brief rate-limit outage ever acceptable" is answered implicitly by picking B or C over A. If the owner picks A, the question must be answered explicitly in a sealed note so the policy drift is not silent.

### Explicit non-decisions

This note does **not**:

- Change `_actions.ts`.
- Change `_guest-chat-client.tsx`.
- Change the sealed `recordIfAllowed` primitive or the `NexCommunityRateLimitError` class.
- Change migration 197's forward body.
- Apply migration 197 anywhere.
- Add fingerprint signals or address G2.
- Alter rate thresholds (`{ windowMinutes: 60, maxPerWindow: 10 }` unchanged).
- Touch Vault, Hammerex, theme commerce 191-196, account claiming, or any other messaging stage.

---

## Part C · Boundary compliance

- Read-only review. Three artefacts produced in this session: this file (new), the earlier safety review (prior session), the earlier corrective-patch report (prior session). No code, test, migration, DB, deploy, secret, dependency, or git-state change in this session.
- Migration 197 not applied. `.env.local` not read. No DB connection. No deploy. No dependency install.
- `_actions.ts`, `_guest-chat-client.tsx`, `rate-limit.ts`, `types.ts`, and migration 197 all unchanged in this session.
- All 29 unrelated working-tree modifications preserved verbatim; verified via `git status --porcelain=1` at start of review.
- No git stage, commit, push, or any other git-state change.

Stopping. Awaiting owner decision between A, B, and C — and authorisation on the sequencing in Part B §Sequencing — before any implementation pass resumes.
