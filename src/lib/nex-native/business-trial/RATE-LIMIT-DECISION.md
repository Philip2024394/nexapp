# G1 Rate-Limit Design · Recommendation for Owner

**Status:** 📝 ENGINEERING RECOMMENDATION · AWAITING OWNER DECISION (A3/A5)
**Date:** 2026-10-22 · G1 Final Readiness pass
**Scope:** Minimum safe rate-limit design for the controlled Business Trial pilot

---

## Current state (shipped in G1)

**File:** `src/lib/nex-native/business-trial/rate-limit.ts`
**Mechanism:** In-process `Map<BucketKey, Bucket>` with floor-window counter
**Verified by:** 7 unit tests in `rate-limit.test.ts`

**Honest limitations (documented in the file):**

- **In-process only** · multiple Next.js server instances do NOT share state. A user hitting instance A and then instance B gets independent counters.
- **Non-atomic** · two concurrent calls on a cold bucket can both pass the gate before either increments the counter.
- **Resets on server restart** · bucket state is lost.

**Authoritative defence (unchanged):** DB preconditions in the service layer. `business_trial_status IS NULL` under `SELECT ... FOR UPDATE` enforces K1 one-trial-per-lifetime regardless of what the rate limiter does.

## Three options assessed

### Option α · Extend `nex_community_rate_limit.action` CHECK constraint

Add trial action keys to the existing community table.

**Requires:**
- `ALTER TABLE nex_community_rate_limit DROP CONSTRAINT ck_rl_action` + re-add with 3 new values
- Migration edit in G1 scope (expand migration 214)
- Reusing the existing `recordIfAllowed()` service function

**Pros:**
- DB-backed · persists across restarts · shared across instances
- Reuses the already-vetted service · minimal new code
- Correct per-account + per-action counter

**Cons:**
- Touches shared community infrastructure · owner A3 directive: *"Preserve unrelated community limits and behaviours"*
- A CHECK constraint change on a community-owned table is a cross-concern migration edit · breaks the clean separation the trial system has otherwise maintained
- Community engineers reviewing their table would see unexplained trial values appear in the CHECK list
- The existing service's own comment acknowledges non-atomicity: *"two concurrent calls to recordIfAllowed at a cold bucket could both pass"* · so Option α is still non-atomic at the SQL layer

### Option β · New dedicated `nex_business_trial_rate_limit` table

Add a parallel table in migration 214 (or a follow-up migration) mirroring the community shape but scoped to trial actions.

**Requires:**
- `CREATE TABLE nex_business_trial_rate_limit` with the same `(account_id, action, window_started_at)` PK pattern
- A new `recordIfAllowedForTrial()` service function (fork of the community one)
- Migration scope expansion

**Pros:**
- Zero touch on community infrastructure · honours A3
- DB-backed · persists across restarts
- Clean separation of concerns

**Cons:**
- Adds a new table to the migration · expands G1 schema scope beyond what the sealed design package §3.1 justified
- Non-atomic in the same way as the community limiter (per the community file's own comment)
- Owner's A3 verbatim says *"Allow only the three trial-specific action keys needed for G1. Preserve unrelated community limits and behaviours"* · a parallel table is permitted but still requires explicit scope authorisation

### Option γ · Keep in-memory, defer DB-backed to a follow-up gate

Keep the current in-memory limiter as the G1 pilot default. Document the limitation explicitly. Add a DB-backed limiter only when pilot scale makes it necessary.

**Requires:** nothing · the shipped code already matches this option.

**Pros:**
- Zero migration scope change
- Honours A3 strictly · no touch on community infrastructure
- Feature flag disabled by default means a bot hammering `/trial/start` without pilot access gets 403 immediately (never reaches the rate limiter)
- DB preconditions remain authoritative · no state corruption possible from rate-limit race
- Owner can authorise DB-backed limiter as a focused follow-up migration when pilot activation is approved

**Cons:**
- Multi-instance deployments (Vercel scaled > 1 instance) do not share counters · a determined abuser hitting multiple instances in parallel could achieve 5N calls/hour where N is the number of instances
- Advisory only · not a reliable abuse control at scale
- Honest documentation required (and present in the file header)

## Recommendation

**Option γ (keep in-memory) is the smallest safe choice for G1 pilot.**

Rationale:

1. **A3 preservation** · zero touch on community schema or shared services
2. **Scope discipline** · G1 migration schema stays at the sealed shape (4 columns + 1 pilot audit table + trigger + partial index)
3. **Flag-gated** · `NEX_BUSINESS_TRIAL_ENABLED=false` default means the rate limiter is never the sole defence · bots cannot activate the trial regardless
4. **DB authoritative** · K1 one-shot cannot be bypassed by a rate-limit race; a bot that spams `/trial/start` gets 1 success (first wins the row lock) + N-1 × 409 `already_used` + eventually 429 `rate_limited`
5. **Follow-up path is clear** · when owner authorises pilot activation + scale, Option β is a focused one-migration addition (new table + new service function) with its own review

If owner prefers a DB-backed limiter at G1 time (not required · but owner may choose), **Option β is cleaner than Option α** because it preserves community-infrastructure boundaries. Option α is rejected because it violates A3's "preserve unrelated community limits and behaviours" directive by mutating a community-owned CHECK constraint.

## Owner decisions required

- **A3 formal approval** · which option to apply (γ for G1, β for pilot activation)
- **A5 numeric values approval** · currently 5/10/10 per hour per account · PROPOSED only

Neither decision blocks G1 engineering readiness (the current γ ships safely with the flag disabled). Both decisions block pilot activation.

## No action taken by this document

- No migration edited
- No new table created
- No community infrastructure touched
- No service layer modified beyond what G1 already shipped

This is a recommendation document. The in-memory limiter from G1 Build 4 is the current implementation.
