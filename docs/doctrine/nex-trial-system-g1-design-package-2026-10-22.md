# NEX Trial System · G1 Design Package

**Status:** 📝 DESIGN ONLY · owner-recorded 2026-10-22 · revised 2026-10-22 (same day) · **NOT APPROVED FOR IMPLEMENTATION**
**Author:** Claude (producing reviewable design package per owner authorisation · revised per owner directive 2026-10-22)
**Scope:** Reviewable design for the G1 schema + endpoints gate of the Trial System doctrine.
**Depends on:** `docs/doctrine/nex-trial-system-draft-2026-10-22.md` (Section N consolidated authorisation 2026-10-22)
**Working tree:** All 124 existing changes preserved (123 pre-existing + this file as 1 untracked design artifact). Revisions change this file's contents only; the untracked status is unchanged.

---

## 0 · What this document is and is not

**IS:**
- A reviewable design package containing: proposed migration SQL (text only · NOT a migration file) · endpoint contracts · state-transition table · regression-test plan · S1-S4 safeguard designs · idempotency and rate-limit evidence from the actual repository.

**IS NOT:**
- A migration file. The SQL below is text for review; it has not been written into `nex-supabase/migrations/`.
- Application code. No file under `src/` has been created or modified by this document.
- Authorisation to implement. G1 implementation drafting requires a separate explicit owner authorisation after this package is reviewed.
- Authorisation for G2-G8.
- Permission to apply migration 207 (`vault_trial_used_at` remains unapplied per X3).

---

## 0.0 · Revisions log · 2026-10-22

**Revised 2026-10-22 (same day · design review response to owner directive).** Addresses 5 corrections and 3 scope boundaries raised in owner's design review:

1. **Scope reduced** · deferred `nex_billing_attempt` and `nex_data_sunset_schedule` tables to G3 and G5 respectively · deferred 3 payment-related columns on `nex_account` (`tier_activated_at`, `payment_provider`, `payment_provider_customer_id`) to G3. G1 schema now ships: **4 trial columns + 2 CHECK constraints + 1 partial index + 1 trigger + function + 1 new table (`nex_pilot_operator_audit`)**.
2. **Payment lifecycle corrected** · separate payment initiation from webhook verification · pending payment does **NOT** extend Shop editing · explicit handling of duplicate webhooks · late payment · opt-out between initiation and webhook.
3. **Concurrency strengthened** · service-layer `SELECT ... FOR UPDATE` row lock added as PRIMARY defence · trigger retained as fail-safe · documented honest limits of trigger-only approach · require **real PostgreSQL parallel-transaction tests** (not vitest-promise simulation).
4. **Audit durability corrected** · three-transaction pattern (attempt row OUTSIDE op · operation in its own tx · outcome UPDATE OUTSIDE op) · failed operations leave `attempt_status='failed'` rows · a rolled-back operation does NOT roll back the audit record.
5. **Idempotency verification required** · G1 drafting MUST verify specific properties of the existing primitive · do NOT assume concurrent-same-key behaviour · DB preconditions remain authoritative for state changes.
6. **Rollback plan split** · pre-activation (destructive drop · safe) vs post-activation (data preserved · retention plan required · G1 does NOT provide post-activation recovery).
7. **PROPOSED decision table** added for A1-A5 and B1-B3 with owner-recommended answers · each marked PROPOSED awaiting approval.
8. **Test plan expanded** · 33 → 41+ tests · each labelled G1/G3/G4/G5 scope · payment-contract tests marked G3 · concurrency tests require real `pg` · audit-durability tests added for the corrected three-transaction pattern.

**Nothing is authorised by this revision.** G1 implementation drafting still requires separate explicit authorisation. G2-G8 remain unauthorised. All 124 working-tree changes preserved; this file remains untracked.

---

## 1 · Controlling approved decisions (sealed per owner authorisation 2026-10-22)

Per the owner's governance note, this section explicitly lists the approved decisions that control this design. Future engineers reading this doc find the controlling truth here even if other sections of the trial doctrine (K / L body-level entries) still carry "UNDECIDED" labels.

| ID | Approved term | Impact on G1 design |
|---|---|---|
| K1 | One Business trial per `nex_account` lifetime | `business_trial_status IS NULL` precondition on `/trial/start` |
| K9 | Exactly 168 hours after `business_trial_start_at` · UTC | `business_trial_end_at = business_trial_start_at + interval '168 hours'` |
| K14 | Option β · separate explicit Shop-only entitlements | New helper `effectiveTrialEntitlements(account)` · `effectiveTier()` unchanged |
| X3 | Migration 207 remains unapplied | G1 migration MUST NOT include `vault_trial_used_at` or any Vault column |
| X8-D1 | D1 body revised | Section C already updated · intro-related state covered |
| X8-11 | Launch-gate 11 body revised | Section I already updated · intro verification scoped to customization + buckets |
| Q1 | Migration 206 deferred | No admin reset endpoint in G1 · S4 pilot audit required instead |
| Q2 | Mutually exclusive · concurrency-safe | Service-layer row lock + DB trigger · see §6 (strengthened) |
| Q3 | Feature flag · activation disabled until G2 | `NEX_BUSINESS_TRIAL_ENABLED` env flag · default `false` |
| Q4 | Historical `tier_activated_at` NULL | Column deferred to G3 (reduced scope) · N/A at G1 |
| Q5 | Reuse `src/lib/nex/idempotency/*` | Endpoints accept `Idempotency-Key` header · properties verified at implementation |
| Q6 | Structured logs · hashed account IDs · request IDs | Every state transition emits a structured log line |
| Q7 | Reuse existing rate-limit infrastructure | `nex_community_rate_limit` pattern · Option α or Option β (owner selects) |
| D1 | Mutually-exclusive-activation | Service row lock + trigger · real pg concurrency tests |
| D2 | Action 1 only in pilot | `/trial/opt-out-conversion` + `/trial/resume-conversion-interest` only |
| D2-a | Reversible until 24h before expiry | Reversal endpoint checks `(business_trial_end_at - now()) > interval '24 hours'` |
| D2-b | N/A | Action 2 deferred |
| D2-c | Deferred | No Action 2 endpoint in G1 |
| Schema | `business_trial_conversion_opt_out boolean NOT NULL DEFAULT false` | Added by G1 migration (PROPOSED only · not applied) |
| S1 | Atomic trial transitions | Service row lock PRIMARY · trigger FAIL-SAFE · real pg tests MANDATORY |
| S2 | No premature read-only | G1 does NOT trigger shop read-only · G5 owns that |
| S3 | Payment-at-expiry safety | `opt_out=true` must block any G3 charge · initiation separate from verification |
| S4 | Pilot audit mechanism | Three-transaction durable audit pattern · schema has `attempt_status` enum |

---

## 2 · Unresolved decisions · PROPOSED answers register · Blockers (visible per governance)

### 2.1 · PROPOSED decisions · A1-A5 and B1-B3 (owner-recommended · AWAITING APPROVAL)

Each entry below records the owner's recommended direction verbatim from the 2026-10-22 design-review directive. **All remain PROPOSED until explicit approval is recorded in Section N of the trial doctrine.** No doctrine section has been modified by this revision.

| ID | Decision | Recommended direction (PROPOSED) | Gate dependency |
|---|---|---|---|
| **A1** | Migration number 214 | Verify the repository's actual migration history immediately before drafting. Keep 214 **PROVISIONAL**. | G1 implementation drafting (first step) |
| **A2** | Feature flag | Reuse an established server-side flag if one exists; otherwise propose `NEX_BUSINESS_TRIAL_ENABLED=false` by default. Enforcement **MUST** be server-side. | G1 endpoint handlers |
| **A3** | Rate-limit config | Allow only the three trial-specific action keys needed for G1. Preserve unrelated community limits and behaviours. | G1 endpoint handlers |
| **A4** | Operator identity | Approve SHA-256 with a server-only pepper as the proposed design, subject to existing audit conventions and secret-handling verification. | G1 pilot audit |
| **A5** | Rate-limit defaults | Accept 5 `/trial/start`/hour and 10/hour for each opt-out action as initial proposals, subject to repository verification and tests. | G1 endpoint handlers |
| **B1** | Converted-state tier | Defer implementation to G3. **No paid entitlement until the required payment verification succeeds.** | G3 scope · contract documented at G1 (§8) |
| **B2** | Post-expiry status | Keep `converted` as historical state after successful conversion; use `expired` for an unconverted trial. Downgrade paid access according to the actual paid entitlement expiry (`bisnis_expires_at` lazy downgrade). | G1 state table |
| **B3** | Themes trial after conversion | Allow it if the account has not used its separate Themes trial and meets the existing eligibility rules. It **MUST NOT** grant a second Business trial. | G1 trigger logic verifies |

### 2.2 · UNDECIDED decisions (not blocking G1 but blocking later gates)

- **K2** · Operator role definition (G5 scope)
- **K3** · Export format (G5)
- **K4** · Notification channels (G5)
- **K5** · Late reactivation handling (G6)
- **K6** · Pricing · `/packages` Rp 99k vs `/settings/tier` Rp 39k reconciliation (G7)
- **K7** · Payment-method coverage matrix verification (G3)
- **K8** · Legal scope · Indonesia-only vs broader (G6 · G8)
- **K10** · Provider sequencing · Stripe-first vs Midtrans-first (G3)
- **K11** · Export-retention proof semantics (G5)
- **K12** · Deletion schedule · day sequence and undo window (G4 · G5)
- **K13** · Billing-record retention · per-market vs universal (G7)

### 2.3 · Tracked conflicts (per original gate assignments)

- **X1** · Themes-trial vs D4 clash → resolved in principle by D1 approval · G2 implementation verifies
- **X2** · Price mismatch → G7 scope · blocks public pricing copy
- **X4** · Welcome page config boolean leak risk → G6 scope
- **X5** · Privacy Policy §19 vs reality → G5 scope · independent of trial
- **X6** · Live Stripe keys in `.env.local` → independent security gate · not in G1 scope · rotation recommended
- **X7** · `vault_tier` dormant reference → G2 scope · independent fix
- **X8** · Intro ownership schema → resolved in principle by D1/launch-gate-11 revisions
- **X9** · `NexWorkspaceWallet.tsx` dead wiring → pre-existing · not trial-blocking
- **X10** · Family-safety payment adapter vs Business trial → G3 scope

### 2.4 · Design-time assumptions requiring confirmation

Each is captured in the §2.1 PROPOSED decision table above.

### 2.5 · Open sub-questions

Each is captured in the §2.1 PROPOSED decision table above (B1-B3).

---

## 3 · Proposed migration SQL · reduced scope · DESIGN REVIEW TEXT ONLY

### 3.1 · Scope justification · every G1 schema element justified

Owner directive 2026-10-22: *"Justify every G1 schema element. Defer future-gate billing and sunset tables unless a concrete G1 dependency is demonstrated."*

**Elements RETAINED in G1 (concrete G1 dependency each):**

| Element | Justification · why G1 needs this |
|---|---|
| `nex_account.business_trial_status` | Four G1 endpoints read/write this column directly. Required to enforce K1 one-shot rule, K14 Option β entitlement helper, D1 coexistence trigger. |
| `nex_account.business_trial_start_at` | Written by `/trial/start`. Required for K9 (168h duration) + state table + status response. |
| `nex_account.business_trial_end_at` | Written by `/trial/start`. Required for `/trial/status` time-remaining calculation + `/trial/resume-conversion-interest` 24h cutoff + G4 cron sweep (future). |
| `nex_account.business_trial_conversion_opt_out` | Written by `/trial/opt-out-conversion` + `/trial/resume-conversion-interest`. Required to signal G3 (future) that no charge should be attempted (S3). |
| `nex_account_business_trial_end_matches_start` CHECK | Enforces K9 exact-168h invariant at DB level. Guards against future code paths setting inconsistent start/end. |
| `nex_account_opt_out_requires_active` CHECK | Prevents setting opt_out on terminal states. Defensive sanity. |
| `idx_nex_account_business_trial_active_end` partial index | Required for G4 cron efficient sweep. **PROPOSED: KEEP in G1 as cheap future-staging.** Owner may AMEND to DEFER to G4 for strictest scope discipline (no behaviour change at G1 time since G1 does not query it). |
| `nex_enforce_trial_coexistence` function + trigger | S1 safeguard + D1 enforcement. Required at G1 because G1 ships `/trial/start` endpoint; must prevent concurrent themes-trial activation. Trigger is **fail-safe** · primary enforcement is service-layer row lock (§6). |
| `nex_pilot_operator_audit` table | S4 safeguard. **PROPOSED: KEEP in G1** subject to owner confirmation that pilot operations require manual intervention. Table design uses the three-transaction durable audit pattern (§9). |

**Elements REMOVED from G1 scope (deferred to their owning gates):**

| Element | Owning gate · why deferred |
|---|---|
| `nex_account.tier_activated_at` | G3. Written only by payment webhook on successful conversion. G1 does not touch. |
| `nex_account.payment_provider` | G3. Written only by payment setup/webhook. G1 does not touch. |
| `nex_account.payment_provider_customer_id` | G3. Opaque token from provider. G1 does not store. |
| `nex_billing_attempt` table | G3. All read/write is G3. G1 does not interact. |
| `nex_data_sunset_schedule` table | G5. All read/write is G5. G1 does not interact. |

**Net effect:** G1 migration shrinks from 7 columns + 3 new tables (original) to **4 columns + 1 new table + 1 trigger + 1 partial index** (revised).

### 3.2 · Revised migration SQL

**NOT written to `nex-supabase/migrations/`. Not applied. Not committed.**

```sql
-- ============================================================================
-- Migration: 2XX_nex_business_trial_system.sql
-- STATUS: DESIGN REVIEW ONLY · NOT WRITTEN · NOT APPLIED · NOT AUTHORISED
--
-- Migration number PROVISIONAL per A1 · verify next unclaimed ID immediately
-- before drafting · do not overwrite existing migrations.
--
-- Owner authorisation 2026-10-22 approves the schema shape below (REDUCED
-- scope per 2026-10-22 revision). This migration must NOT be written into
-- nex-supabase/migrations/ until G1 implementation is separately authorised.
--
-- Depends on:
--   046_nex_account_tier.sql (tier + bisnis_expires_at)                   [APPLIED]
--   089_themes_trial.sql     (themes_trial_used_at + themes_trial_...)    [APPLIED]
--
-- MUST NOT be bundled with:
--   207_nex_onboarding_and_vault_trial.sql (vault_trial_used_at)          [UNAPPLIED · PER X3]
--
-- Deferred to later gates (NOT included in this migration):
--   tier_activated_at, payment_provider, payment_provider_customer_id    → G3
--   nex_billing_attempt table                                             → G3
--   nex_data_sunset_schedule table                                        → G5
--
-- Rollback: see §3.3 (pre-activation vs post-activation distinction).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Part 1 · Columns on nex_account (4 columns only · reduced scope)
-- ---------------------------------------------------------------------------

ALTER TABLE nex_account
  ADD COLUMN business_trial_status text
    CHECK (business_trial_status IN ('active', 'converted', 'expired')
           OR business_trial_status IS NULL)
    DEFAULT NULL,
  ADD COLUMN business_trial_start_at timestamptz DEFAULT NULL,
  ADD COLUMN business_trial_end_at   timestamptz DEFAULT NULL,
  ADD COLUMN business_trial_conversion_opt_out boolean NOT NULL DEFAULT false;

-- Enforce K9: trial_end_at is exactly 168 hours after trial_start_at
-- when both are set. Null-safe: both NULL is also accepted (never started).
ALTER TABLE nex_account ADD CONSTRAINT nex_account_business_trial_end_matches_start CHECK (
  (business_trial_start_at IS NULL AND business_trial_end_at IS NULL)
  OR
  (business_trial_end_at = business_trial_start_at + interval '168 hours')
);

-- Enforce: opt_out can only be true while trial is 'active'
-- (prevents setting opt_out on terminal states for sanity)
ALTER TABLE nex_account ADD CONSTRAINT nex_account_opt_out_requires_active CHECK (
  business_trial_conversion_opt_out = false
  OR business_trial_status = 'active'
);

-- Partial index on active-trial end timestamp for G4 cron sweep efficiency.
-- PROPOSED: KEEP in G1 as cheap future-staging. AMEND if owner prefers to
-- defer to G4 (no behaviour change at G1 time since G1 does not query it).
CREATE INDEX idx_nex_account_business_trial_active_end
  ON nex_account (business_trial_end_at)
  WHERE business_trial_status = 'active';

-- ---------------------------------------------------------------------------
-- Part 2 · S1 safeguard · function + trigger (fail-safe layer)
--
-- Primary enforcement is the service-layer SELECT ... FOR UPDATE pattern
-- (see §6). This trigger is a defence-in-depth layer that protects direct
-- SQL (admin operations) and any future code that forgets to acquire the
-- row lock.
--
-- Honest limits of trigger-only approach (documented in §6):
-- BEFORE UPDATE triggers under default READ COMMITTED see the committed
-- state when the row lock is acquired. Same-row concurrent UPDATEs
-- serialise correctly. Cross-row scenarios (not applicable to nex_account
-- which is one-row-per-account) would require stronger primitives.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nex_enforce_trial_coexistence()
RETURNS trigger AS $$
BEGIN
  -- Case A: Business trial activation (NULL -> 'active')
  IF NEW.business_trial_status = 'active'
     AND (OLD.business_trial_status IS NULL OR OLD.business_trial_status IS DISTINCT FROM 'active')
  THEN
    IF NEW.themes_trial_used_at IS NOT NULL
       AND NEW.themes_trial_used_at >= (now() - interval '168 hours')
    THEN
      RAISE EXCEPTION 'business_trial_blocked_by_active_themes_trial'
        USING ERRCODE = 'exclusion_violation',
              HINT = 'Wait until the themes-trial expires before starting a Business trial.';
    END IF;
  END IF;

  -- Case B: Themes trial activation (NULL -> set timestamp)
  IF NEW.themes_trial_used_at IS NOT NULL
     AND OLD.themes_trial_used_at IS NULL
  THEN
    IF NEW.business_trial_status = 'active' THEN
      RAISE EXCEPTION 'themes_trial_blocked_by_active_business_trial'
        USING ERRCODE = 'exclusion_violation',
              HINT = 'Wait until the Business trial ends before starting a themes-trial.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_nex_account_trial_coexistence
BEFORE UPDATE ON nex_account
FOR EACH ROW
EXECUTE FUNCTION nex_enforce_trial_coexistence();

-- ---------------------------------------------------------------------------
-- Part 3 · nex_pilot_operator_audit (S4 pilot audit mechanism)
--
-- PROPOSED subject to owner confirmation that pilot operations require
-- manual intervention. If pilot does not require operator interventions,
-- this table may be DEFERRED to a later gate.
--
-- Design pattern (§9): three-transaction audit flow:
--   T1 (OUTSIDE operation) · INSERT attempt row with status='pending'
--   T2 (operation's own tx) · the UPDATE / destructive statement
--   T3 (OUTSIDE operation) · UPDATE attempt row with outcome
-- Failed operations leave attempt_status='failed' durably on the row.
-- Rolled-back operations do NOT roll back the attempt record because it
-- was committed in its own transaction (T1) before the operation (T2).
-- ---------------------------------------------------------------------------

CREATE TABLE nex_pilot_operator_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  operator_identity text NOT NULL,   -- SHA-256(account_id + env pepper) per A4
  action text NOT NULL,              -- e.g. 'trial_reset', 'manual_tier_change'
  target_account_id uuid REFERENCES nex_account(id),
  justification text NOT NULL,
  sql_executed text,                 -- for direct-SQL ops: the exact statement to run
  before_state jsonb,                -- snapshot captured before T2
  attempt_status text NOT NULL DEFAULT 'pending'
    CHECK (attempt_status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  outcome_at timestamptz,            -- set when attempt_status transitions from 'pending'
  after_state jsonb,                 -- set on success
  error_message text,                -- set on failure
  request_id text                    -- correlation ID with structured server log
);

CREATE INDEX idx_nex_pilot_operator_audit_attempted
  ON nex_pilot_operator_audit (attempted_at DESC);

CREATE INDEX idx_nex_pilot_operator_audit_target
  ON nex_pilot_operator_audit (target_account_id, attempted_at DESC)
  WHERE target_account_id IS NOT NULL;

-- Index for reconciliation query that finds stale pending attempts
-- (ops where T3 did not run · operator session crashed between T2 and T3).
CREATE INDEX idx_nex_pilot_operator_audit_pending
  ON nex_pilot_operator_audit (attempted_at)
  WHERE attempt_status = 'pending';

COMMIT;
```

### 3.3 · Rollback plan · pre-activation vs post-activation

Owner directive 2026-10-22: *"Specify separate pre-launch rollback and post-activation recovery procedures. Once real trial or audit data exists, preserve it unless a separately approved data-retention plan explicitly authorizes removal."*

#### 3.3.1 · Pre-activation rollback (safe)

**Preconditions:** migration applied BUT `NEX_BUSINESS_TRIAL_ENABLED=false` continuously since application, no trial has been started, no audit rows written. Verified by:
- `SELECT count(*) FROM nex_account WHERE business_trial_status IS NOT NULL` returns 0
- `SELECT count(*) FROM nex_pilot_operator_audit` returns 0

**If both counts are zero**, the migration is fully reversible via DROPs. All new columns had DEFAULT NULL or DEFAULT false · no data loss on rollback.

```sql
BEGIN;
DROP TABLE nex_pilot_operator_audit;
DROP TRIGGER tr_nex_account_trial_coexistence ON nex_account;
DROP FUNCTION nex_enforce_trial_coexistence;
DROP INDEX idx_nex_account_business_trial_active_end;
ALTER TABLE nex_account
  DROP CONSTRAINT nex_account_opt_out_requires_active,
  DROP CONSTRAINT nex_account_business_trial_end_matches_start,
  DROP COLUMN business_trial_conversion_opt_out,
  DROP COLUMN business_trial_end_at,
  DROP COLUMN business_trial_start_at,
  DROP COLUMN business_trial_status;
COMMIT;
```

#### 3.3.2 · Post-activation recovery (NOT provided by G1)

**Preconditions:** migration applied AND trials have been started · audit rows may exist · real user data present.

**Destructive rollback is NOT SAFE.** Any removal of populated audit or trial records destroys evidence of pilot activity and may breach retention obligations (K13 billing retention · operator-audit retention · GDPR/PDP data-subject rights).

**Any post-activation unwind requires:**

1. A separately-approved data-retention plan explicitly authorising removal (owner + legal review)
2. Export of affected trial state (which accounts have `active`/`converted`/`expired` trials · which have `opt_out=true`)
3. Export of all `nex_pilot_operator_audit` rows (independent audit requirement · operator operations are permanent evidence)
4. A migration-up / migration-down pair that **preserves data by migrating it to a successor schema**, not destroying it

**G1 does NOT provide a post-activation recovery procedure.** If post-activation unwind becomes necessary, it is a separate design + authorisation task. A G1 regression test (T33a · §11.9) verifies that the pre-activation rollback script errors with a clear message if attempted against a database with real trial data.

### 3.4 · Design review notes on the SQL

- **Partial index** · supports G4 cron efficient sweep. PROPOSED to KEEP in G1 (cheap future-staging); owner may AMEND to DEFER.
- **CHECK on 168h equality** · enforces K9 at DB layer · guards future code paths from inconsistent writes.
- **CHECK opt_out requires active** · defensive sanity · prevents opt_out being set on terminal states.
- **Trigger is defence-in-depth** · service-layer row lock (§6) is primary.
- **`nex_pilot_operator_audit`** uses three-transaction pattern (§9) · `attempt_status` enum enables durable failure recording.
- **No RLS** on the new audit table · G1 ships service-role-only access via application code; owner may elect to add RLS policies later.
- **Rollback is split** · §3.3.1 for pre-activation · §3.3.2 for post-activation (not provided).

---

## 4 · Endpoint contracts (G1 scope · 4 endpoints)

All endpoints are new routes under `src/app/api/nex-native/trial/`. **No file in that path exists yet** (verified during audit). Service layer wraps each state-changing endpoint with `SELECT ... FOR UPDATE` on `nex_account` per §6.

### 4.1 · `POST /api/nex-native/trial/start`

**Purpose:** User explicitly starts their one-shot Business trial.

| Aspect | Contract |
|---|---|
| **Authentication** | `resolveNexAppSessionFromContext()` required · 401 if absent |
| **Preconditions** | (1) `NEX_BUSINESS_TRIAL_ENABLED === 'true'` env flag (Q3) · 403 if false · (2) `session.account.business_trial_status IS NULL` (K1) · 409 `already_used` if not · (3) themes-trial not active (D1) · service row-lock check + DB trigger · 409 `themes_trial_still_active` on `exclusion_violation` |
| **Row lock (S1)** | `SELECT id FROM nex_account WHERE id = $1 FOR UPDATE` within transaction · then precondition checks · then UPDATE · see §6 |
| **Rate limit** | `recordIfAllowed(accountId, 'trial_start')` · PROPOSED 5/hour (A5) |
| **Idempotency** | Optional `Idempotency-Key` header via existing middleware (Q5 · properties verified per §10.1) · natural idempotency via `IS NULL` precondition |
| **Action** | Single UPDATE: `SET business_trial_status='active', business_trial_start_at=now(), business_trial_end_at=now()+interval '168 hours' WHERE id=$1 AND business_trial_status IS NULL` |
| **Logging (Q6)** | Structured log: `{event:'trial.business.start', hashedAccount, requestId, startAt, endAt}` |
| **Response 200** | `{ status: 'active', start_at, end_at, hours_remaining: 168, conversion_opt_out: false, entitlements: effectiveTrialEntitlements(account) }` |
| **Response 409** | `{ error: 'already_used' \| 'themes_trial_still_active' }` |
| **Response 403** | `{ error: 'business_trial_not_available' }` (flag disabled) |
| **Response 429** | `{ error: 'rate_limited', window_minutes, max_per_window }` |

### 4.2 · `GET /api/nex-native/trial/status`

**Purpose:** Return current trial state for the authenticated account.

| Aspect | Contract |
|---|---|
| **Authentication** | `resolveNexAppSessionFromContext()` required · 401 if absent |
| **Preconditions** | None |
| **Row lock** | N/A (read-only · no state change) |
| **Rate limit** | Standard read-path (no new counter) |
| **Idempotency** | N/A (read-only) |
| **Action** | None · reads `session.account` fields directly |
| **Logging** | Standard request log (no transition log) |
| **Response 200** | `{ status: 'active'\|'converted'\|'expired'\|null, start_at, end_at, hours_remaining, conversion_opt_out, entitlements }` |
| **Cache** | `Cache-Control: no-store` |

### 4.3 · `POST /api/nex-native/trial/opt-out-conversion` (D2 Action 1)

**Purpose:** User opts out of paid conversion. Trial continues to full 168h. **No charge will be attempted at expiry.**

| Aspect | Contract |
|---|---|
| **Authentication** | `resolveNexAppSessionFromContext()` required · 401 if absent |
| **Preconditions** | (1) `business_trial_status = 'active'` · 409 `trial_not_active` · (2) `business_trial_conversion_opt_out = false` · 409 `already_opted_out` |
| **Row lock (S1)** | `SELECT ... FOR UPDATE` within transaction · see §6 |
| **Rate limit** | `recordIfAllowed(accountId, 'trial_opt_out_conversion')` · PROPOSED 10/hour (A5) |
| **Idempotency** | Optional `Idempotency-Key` header · natural idempotency via precondition |
| **Action** | `UPDATE nex_account SET business_trial_conversion_opt_out=true WHERE id=$1 AND business_trial_status='active' AND business_trial_conversion_opt_out=false` |
| **Logging** | Structured log: `{event:'trial.business.opt_out', hashedAccount, requestId}` |
| **Response 200** | `{ status: 'active', start_at, end_at, hours_remaining, conversion_opt_out: true, entitlements }` |
| **S2 note** | **Does NOT trigger shop read-only.** Shop stays editable until expiry at `business_trial_end_at`. |
| **S3 note** | G3 payment code (future) MUST honour `business_trial_conversion_opt_out=true` BEFORE any charge · see §8. |

### 4.4 · `POST /api/nex-native/trial/resume-conversion-interest` (D2-a reversal)

**Purpose:** User changes mind and wants to re-enable the day-6 paid-conversion flow. Allowed only before the 24h-to-expiry cutoff.

| Aspect | Contract |
|---|---|
| **Authentication** | `resolveNexAppSessionFromContext()` required · 401 if absent |
| **Preconditions** | (1) `business_trial_status = 'active'` · 409 `trial_not_active` · (2) `business_trial_conversion_opt_out = true` · 409 `not_opted_out` · (3) `(business_trial_end_at - now()) > interval '24 hours'` · 409 `within_24h_of_expiry` |
| **Row lock (S1)** | `SELECT ... FOR UPDATE` within transaction |
| **Rate limit** | `recordIfAllowed(accountId, 'trial_resume_conversion_interest')` · PROPOSED 10/hour (A5) |
| **Idempotency** | Optional `Idempotency-Key` header · natural idempotency via precondition |
| **Action** | `UPDATE nex_account SET business_trial_conversion_opt_out=false WHERE id=$1 AND business_trial_status='active' AND business_trial_conversion_opt_out=true AND business_trial_end_at - now() > interval '24 hours'` |
| **Logging** | Structured log: `{event:'trial.business.resume_conversion', hashedAccount, requestId}` |
| **Response 200** | `{ status: 'active', start_at, end_at, hours_remaining, conversion_opt_out: false, entitlements }` |

### 4.5 · Endpoints explicitly NOT in G1 scope

- `POST /api/nex-native/trial/convert` — G3 (requires payment integration)
- `POST /api/nex-native/trial/cancel` or `/end-now` — DEFERRED (D2-c)
- `POST /api/nex-native/trial/admin-reset` — DEFERRED (Q1 · migration 206 unapplied)
- `POST /api/webhooks/midtrans`, `POST /api/webhooks/stripe` — G3
- `POST /api/nex-native/account/export` — G5

---

## 5 · Complete trial state-transition table · corrected per payment lifecycle boundary

Owner directive 2026-10-22: *"A pending payment must not silently extend Shop editing access."* The revised state table removes the row that previously allowed `business_trial_status='active'` to persist past `business_trial_end_at` due to pending payment.

### 5.1 · Five lifecycle moments (vocabulary)

Per owner directive 2026-10-22 (Issue 3), payment and cancellation states must be unambiguous:

1. **TRIAL ACTIVE · USER CONSIDERING** · `business_trial_status='active'`, `opt_out=false`. User may initiate paid conversion or opt out before `end_at`.
2. **TRIAL ACTIVE · USER OPTED OUT** · `business_trial_status='active'`, `opt_out=true`. No charge will be attempted at expiry. Shop continues to be editable until `end_at`.
3. **PAYMENT IN FLIGHT** · G3-concept · not reflected in `business_trial_status`. Tracked by `nex_billing_attempt.status='pending'` (G3-owned table, deferred to G3). **Shop editing is NOT extended by pending payment.** `business_trial_status` remains `'active'` and transitions to `'expired'` at `end_at` on schedule unless a verified-success webhook has already converted it.
4. **PAYMENT VERIFIED SUCCESS** · G3 webhook verifies signature, confirms succeeded, and atomically transitions `business_trial_status` from `'active'` (or `'expired'` if late) to `'converted'` (per B1 contract in §8). Only this verified-success path grants `tier='bisnis'`.
5. **PAYMENT FAILED OR TRIAL EXPIRED** · at `end_at`, G4 cron unconditionally transitions `business_trial_status` from `'active'` to `'expired'` (unless already `'converted'`). Late payment within G3-defined window may still transition `expired → converted` later (see §8).

### 5.2 · State-transition table (G1 and future-gate rows · labelled)

Columns: `business_trial_status` (BTS) · `business_trial_conversion_opt_out` (OPT) · `tier` · `bisnis_expires_at` (BEX).

| From state | Event | To state | Side effects | Gate |
|---|---|---|---|---|
| BTS=NULL, OPT=false | `/trial/start` · all preconditions met · service holds row lock | BTS=active, OPT=false | start_at=now, end_at=now+168h · structured log | **G1** |
| BTS=NULL · themes-trial active (within 168h) | `/trial/start` | unchanged | Row-lock check OR DB trigger raises · 409 `themes_trial_still_active` | **G1** |
| BTS=NULL · flag disabled | `/trial/start` | unchanged | 403 `business_trial_not_available` | **G1** |
| BTS=active | `/trial/start` | unchanged | 409 `already_used` | **G1** |
| BTS=converted or expired | `/trial/start` | unchanged | 409 `already_used` · one-trial-per-lifetime (K1) | **G1** |
| BTS=active, OPT=false | `/trial/opt-out-conversion` | BTS=active, OPT=true | log · **shop stays editable until end_at** | **G1** |
| BTS=active, OPT=true | `/trial/opt-out-conversion` | unchanged | 409 `already_opted_out` | **G1** |
| BTS=active, OPT=true · >24h to expiry | `/trial/resume-conversion-interest` | BTS=active, OPT=false | log · back in conversion flow | **G1** |
| BTS=active, OPT=true · ≤24h to expiry | `/trial/resume-conversion-interest` | unchanged | 409 `within_24h_of_expiry` | **G1** |
| **BTS=active · any OPT · any payment-attempt state** | **G4 cron: now ≥ end_at AND not already converted** | **BTS=expired · UNCONDITIONAL** | **log · G5 may queue sunset (S2: G1 does NOT fire read-only). Pending payment-attempt does NOT prevent this transition.** | **G4** |
| BTS=converted (already set by webhook before end_at) | G4 cron evaluates at end_at | unchanged | No action · trial converted before expiry | **G4** |
| BTS=active, OPT=false | G3 payment INITIATION (user clicks "Pay") · G3 service checks `BTS='active' AND OPT=false AND now() < end_at` under row lock | BTS=active (unchanged) | G3 creates `nex_billing_attempt` row with `status='pending'` and calls provider API. **Shop editing is NOT extended by this attempt.** `business_trial_status` stays `'active'` and expires on schedule unless the webhook arrives before `end_at` with verified success. | **G3** |
| BTS=active, OPT=false | G3 WEBHOOK · signature verified · attempt matches · succeeded · idempotency: new | BTS=converted · tier=bisnis, tier_activated_at=now, BEX=now+30d | Atomic UPDATE on nex_account under row lock. Attempt row's status updated to 'succeeded'. | **G3** |
| BTS=active, OPT=true | G3 WEBHOOK arrives | NO conversion | G3 MUST reject per §8 S3 contract. Attempt row's status marked 'cancelled' with reason='customer_opted_out'. G3 may initiate provider refund. | **G3** |
| BTS=expired, within G3-defined late-payment window | G3 WEBHOOK · verified · succeeded | BTS=converted · tier=bisnis, BEX=now+30d | Atomic UPDATE under row lock. Shop re-opens on next request (G2 middleware re-evaluates). | **G3** |
| BTS=expired, beyond G3-defined late-payment window | G3 WEBHOOK | NO conversion | G3 rejects as 'retry_window_exceeded'. G3 may initiate refund. | **G3** |
| any BTS | G3 DUPLICATE webhook (same provider_charge_id, already-processed event) | unchanged | Idempotent · G3 returns 200 to provider without re-executing. | **G3** |
| BTS=converted | any `/trial/*` endpoint | unchanged | 409 `trial_already_converted` | **G1** |
| BTS=expired (not yet converted via late payment) | any `/trial/*` endpoint | unchanged | 409 `trial_already_expired` | **G1** |
| BTS=converted · bisnis_expires_at elapses | lazy downgrade in `effectiveTier()` | unchanged BTS | `tier` stays 'bisnis' on the row but `effectiveTier()` returns `'gratis'` · historical record preserved per B2. | **G1** (effective tier helper) |

**Explicit payment-lifecycle corrections (vs original design):**

1. ❌ **REMOVED** · "BTS=active, OPT=false · G4 cron: now > end_at + payment pending → BTS=active · wait for G3 webhook · retry 48h". Pending payment does NOT extend the trial.
2. ✅ **ADDED** · explicit idempotent-duplicate-webhook row.
3. ✅ **ADDED** · explicit "opt-out between initiation and webhook → reject conversion · possible refund" row.
4. ✅ **ADDED** · explicit late-payment window boundary (G3-defined · G1 documents the shape).
5. ✅ **ADDED** · explicit payment-initiation row showing that initiation does NOT change `business_trial_status`.

---

## 6 · S1 safeguard · Atomic trial transitions · strengthened concurrency design

Owner directive 2026-10-22: *"A trigger that merely checks a state without protecting against races is not enough. Require real concurrent integration tests and a database-level serialization design that protects both activation paths."*

### 6.1 · Honest concurrency analysis

The original design relied on two layers: (1) `UPDATE ... WHERE business_trial_status IS NULL` conditional-write and (2) `BEFORE UPDATE` trigger `tr_nex_account_trial_coexistence`.

Under PostgreSQL's default READ COMMITTED isolation, concurrent UPDATEs on the SAME row serialise via row-level locking. The second UPDATE waits for the first to commit, then re-reads the row and sees the updated state. The trigger on the second UPDATE sees the first's committed state as OLD and correctly rejects. **This is correct behaviour for same-row concurrency on `nex_account`.**

**However, the trigger alone is NOT sufficient under all operation patterns:**

- If a service pre-checks preconditions in a SEPARATE transaction BEFORE issuing UPDATE, the check and the write are not atomic. Between them, another transaction may commit a conflicting state. The subsequent UPDATE's trigger catches this · but only if the WHERE clause doesn't exclude the row first.
- Future code paths that UPDATE other columns on `nex_account` could, under rare snapshot-mismatch scenarios, bypass the trigger's intended check.
- Direct SQL from an admin session that forgets to pre-check preconditions relies solely on the trigger.

### 6.2 · Strengthened design · service-layer row lock (PRIMARY defence)

**G1 service layer MUST wrap trial activation in an explicit row lock:**

```
BEGIN;

-- Acquire exclusive row lock on the nex_account row
SELECT id FROM nex_account WHERE id = $1 FOR UPDATE;

-- Within the lock, check all preconditions:
--   business_trial_status IS NULL (K1)
--   themes_trial_used_at IS NULL OR < now() - interval '168 hours' (D1)
--   feature flag NEX_BUSINESS_TRIAL_ENABLED = 'true' (Q3)
--   rate-limit counter under cap (Q7)

-- Perform UPDATE with conditional WHERE as belt-and-braces
UPDATE nex_account
SET    business_trial_status = 'active',
       business_trial_start_at = now(),
       business_trial_end_at = now() + interval '168 hours'
WHERE  id = $1
  AND  business_trial_status IS NULL;

-- 0 rows affected signals a race (should not happen under lock) OR a bug.
-- Rollback and return 409.

COMMIT;
```

The `SELECT ... FOR UPDATE` acquires an exclusive row lock that holds until COMMIT. Any other transaction attempting to UPDATE the same row waits · and when it eventually runs, it sees the committed state and its own preconditions correctly fail.

**Same pattern applies to `startThemesTrial`** (existing service, migration 089). G1 implementation drafting must verify that `startThemesTrial` either already uses `FOR UPDATE` or is modified to do so BEFORE G1 ships. Adding the row-lock is a precondition-adjacent change that does NOT alter tier-elevation behaviour (K1 preservation of themes-trial semantics).

### 6.3 · Three-layer defence summary

Combined protection:

1. **Service-layer `SELECT ... FOR UPDATE`** · PRIMARY · acquires row lock before any precondition check · guarantees serialised access during the service operation
2. **UPDATE WHERE clause** · belt-and-braces conditional write · 0 rows affected signals a race (should not occur under lock but documents the contract)
3. **BEFORE UPDATE trigger** · FAIL-SAFE for direct SQL (admin operations, future code) that forgets to acquire the row lock · raises `exclusion_violation` to protect the invariant

### 6.4 · Real PostgreSQL concurrency test requirement (G1 acceptance bar)

Owner directive 2026-10-22: *"Parallel execution tests should verify mutual exclusion and one-trial-per-account under concurrent requests. Vitest-level concurrent promises alone would not prove the database invariant."*

**Vitest-level `Promise.all([mockedService(), mockedService()])` DOES NOT prove the invariant.** Required test infrastructure for G1 (see §11.2):

- Test harness opens multiple REAL PostgreSQL connections (via `pg` library) against a test database with the trial migration applied
- Each connection runs the actual service UPDATE flow in its own transaction with `SELECT ... FOR UPDATE`
- Multiple connections fire operations in TRUE parallel (via `Promise.all` on actual pg client calls OR node `worker_threads` OR separate `psql` processes)
- Assertions verify: exactly ONE connection succeeds · all others receive the expected 409/exclusion_violation · final DB state has exactly ONE `business_trial_status='active'` row

**Explicit test additions (G1 scope · §11.2):**

- **T5a (replaces T5)** · 10 real pg clients fire concurrent `/trial/start` service calls against one account → exactly 1 commits · 9 either return 0 rows affected OR raise `exclusion_violation` · final state has 1 active trial
- **T6a (replaces T6)** · 1 real `/trial/start` service call + 1 real `startThemesTrial` service call fire concurrently against one account → exactly 1 succeeds · final state has either `business_trial_status='active'` OR `themes_trial_used_at` set, never both
- **T6b** · repeat T6a 50 times to catch non-deterministic races · all 50 runs must have exactly 1 success

Vitest-level `Promise.all` of mocked calls remains useful for unit testing but is **NOT sufficient alone**. The real-pg tests are the acceptance bar for S1.

---

## 7 · S2 safeguard · No premature read-only state

**Rule:** G1 does NOT cause shop read-only state. Shop read-only enforcement is G2/G5 scope.

**G1 behaviour:**

- `/trial/start` activates the trial · shop remains in the state it was before (likely active-trial-shop)
- `/trial/opt-out-conversion` sets `business_trial_conversion_opt_out=true` · shop CONTINUES to be fully accessible to the user until `business_trial_end_at`
- G4 cron (NOT G1) transitions `business_trial_status` to `'expired'` at the exact moment of expiry · G1 does not implement this cron
- Shop read-only enforcement responds to the `expired` state · G2 middleware denies writes · G5 schedules sunset safeguards

**What G1 code must NOT do:**

- Call any read-only toggle during opt-out
- Trigger G5 sunset code
- Set a `read_only_at` column on `nex_business`
- Change buyer-facing shop surfaces

**Documentation deliverable:** the G1 endpoint source files include header comments explicitly stating "This endpoint does NOT trigger shop read-only. See S2 safeguard."

---

## 8 · S3 safeguard · Payment-at-expiry · initiation / verification separation

Owner directive 2026-10-22: *"A payment-provider webhook is a notification, not a safe place to initiate a new charge. G3 must distinguish payment initiation from webhook verification, handle duplicate events idempotently, and define what happens if payment succeeds after the trial deadline or after the user opts out."*

### 8.1 · Payment initiation (G3 responsibility · documented at G1)

**Trigger:** user clicks "Pay for Business" in the UI (G6) or similar explicit action.

**G3 service layer MUST:**

1. Acquire row lock on `nex_account` via `SELECT ... FOR UPDATE`
2. Verify preconditions under the lock:
   - `business_trial_status = 'active'`
   - `business_trial_conversion_opt_out = false`
   - `now() < business_trial_end_at`
3. Create a `nex_billing_attempt` row with `status='pending'` (G3-owned table)
4. Call the provider API to initiate the charge (returns `provider_charge_id`)
5. Store `provider_charge_id` on the attempt row
6. COMMIT

**G3 service layer MUST NOT at initiation time:**

- Transition `business_trial_status` to `'converted'`
- Grant `tier='bisnis'`
- Call `effectiveTrialEntitlements` with elevated privileges based on pending payment
- Extend `business_trial_end_at`

### 8.2 · Webhook verification (G3 responsibility · documented at G1)

**Trigger:** payment provider sends an event to `/api/webhooks/{midtrans,stripe}`.

**G3 webhook handler MUST:**

1. **VERIFY webhook signature** using the provider's documented signing scheme. Unverified webhooks are REJECTED with 403. This is not optional.
2. Parse the event to extract `provider_charge_id` and the event status.
3. **Idempotency check:**
   - Look up `nex_billing_attempt` by `provider_charge_id`
   - If attempt is already in a terminal state (`succeeded`, `failed`, `cancelled`) and the new event matches: return 200 to provider (idempotent · do NOT re-execute UPDATE)
   - If attempt is `pending` and new event is `succeeded`: proceed to step 4
   - If attempt is `pending` and new event is `failed`: update attempt status to `failed`, do NOT change `business_trial_status`
   - If no attempt row matches: log + return 200 (provider's event does not correspond to a NEX-initiated charge · possibly out-of-band)
4. **Pre-conversion precondition check** (under `SELECT ... FOR UPDATE` lock on `nex_account`):
   - `business_trial_conversion_opt_out = false` (opt-out between initiation and webhook REJECTS the conversion · G3 may initiate provider refund)
   - `business_trial_status = 'active'` (success before end_at) OR `business_trial_status = 'expired'` AND within G3-defined late-payment window (success after end_at)
5. **If preconditions pass**, atomic UPDATE under the lock:
   ```
   UPDATE nex_account
   SET business_trial_status = 'converted',
       tier = 'bisnis',
       tier_activated_at = now(),            -- column added by G3 migration
       bisnis_expires_at = now() + interval '30 days'
   WHERE id = $1
     AND business_trial_conversion_opt_out = false
     AND business_trial_status IN ('active', 'expired')
   ```
   AND update attempt row to `status='succeeded'`
6. **If preconditions fail** (e.g. opt-out set between initiation and webhook): update attempt row to `status='cancelled'` with `error_code='customer_opted_out'`. G3 may initiate provider refund per G3 policy.
7. COMMIT · return 200 to provider

**G3 webhook handler MUST NOT:**

- Initiate a new charge from the webhook (webhook is notification only)
- Grant `tier='bisnis'` if signature verification fails
- Grant `tier='bisnis'` if opt-out is set (even if payment succeeded at provider)
- Extend `business_trial_status='active'` past `business_trial_end_at` based on pending payment

### 8.3 · Late payment handling

If a verified-`succeeded` webhook arrives AFTER `business_trial_end_at` (meaning G4 cron has already transitioned `business_trial_status` to `'expired'`), G3's policy applies:

- **Within G3-defined window** (e.g. 48 hours after `end_at`): permit `expired → converted` transition. Shop re-opens on the user's next request (G2 middleware re-evaluates on each request · G5 sunset queue respects the new state).
- **Beyond window**: reject the conversion. Mark attempt row as `cancelled` with `error_code='retry_window_exceeded'`. G3 may initiate provider refund.

**The late-payment window is a G3 design decision.** G1 documents the shape but does not fix the window length.

### 8.4 · G1 testing responsibility

- G1 regression tests verify `business_trial_conversion_opt_out` is set exactly when intended and cleared exactly when the reversal endpoint succeeds (§11.3)
- G1 regression tests verify that `business_trial_status` transitions to `'expired'` at `end_at` regardless of any pending payment state (G4 cron contract · tested at G1 by simulated clock advance OR fake-attempt-row + G4 sweep script)
- G1 does NOT test the full G3 payment flow · G3 regression tests cover webhook signature verification, idempotency, late payment, opt-out between delivery (§11.10)

### 8.5 · Explicit S3 contract summary

- Opt-out NEVER produces a charge · G3 payment code checks `opt_out=true` at both initiation AND webhook
- Pending payment NEVER converts the trial on its own · only verified-success webhook with signature does
- Duplicate webhook delivery is idempotent · same event applied twice has the same effect as applied once
- Late payment is window-limited by G3 policy · G1 does not fix the window
- A webhook arriving after opt-out is REJECTED · G3 may initiate refund
- Pending payment does NOT extend `business_trial_status='active'` past `end_at` · G4 cron transitions to `'expired'` unconditionally

---

## 9 · S4 safeguard · Pilot audit mechanism · corrected durability

Owner directive 2026-10-22: *"If the operation fails and the transaction rolls back, the audit row rolls back too. Distinguish successful operations from failed attempts. Preserve durable evidence of failures through an appropriate separate audit/logging mechanism, without falsely claiming that a rolled-back transaction leaves a durable audit row."*

### 9.1 · Original design flaw

The original design proposed a single-transaction audit:
```
BEGIN;
INSERT nex_pilot_operator_audit (operator, action, before_state) VALUES (...);
UPDATE nex_account SET ... WHERE id = $1;
UPDATE nex_pilot_operator_audit SET after_state = ... WHERE id = $audit_id;
COMMIT;
```

**Problem:** if the UPDATE fails (e.g. constraint violation · trigger exception · deadlock), the entire transaction rolls back. The audit row INSERT rolls back too. **No durable evidence that the attempt was made.**

### 9.2 · Corrected design · three-transaction pattern

**T1 · Record attempt (OUTSIDE the operation):**

```
BEGIN;
INSERT INTO nex_pilot_operator_audit (
  operator_identity, action, target_account_id, justification,
  sql_executed, before_state, attempt_status, request_id
) VALUES (
  <hashed-operator>, 'trial_reset', $1, <justification>,
  <sql-to-run>, <before-snapshot>, 'pending', <uuid>
) RETURNING id;
COMMIT;
```

This row is **DURABLY committed**. If anything goes wrong after this point, the attempt is on record with `attempt_status='pending'`.

**T2 · Perform the operation (its own transaction):**

```
BEGIN;
<the actual UPDATE or operation>
COMMIT;  -- or ROLLBACK on failure
```

This transaction may succeed or fail. Its outcome does NOT affect T1's durable attempt row.

**T3 · Record outcome (OUTSIDE the operation):**

On success:
```
BEGIN;
UPDATE nex_pilot_operator_audit
SET attempt_status = 'succeeded',
    outcome_at = now(),
    after_state = <post-snapshot>
WHERE id = <attempt-id> AND attempt_status = 'pending';
COMMIT;
```

On failure:
```
BEGIN;
UPDATE nex_pilot_operator_audit
SET attempt_status = 'failed',
    outcome_at = now(),
    error_message = <error-text>
WHERE id = <attempt-id> AND attempt_status = 'pending';
COMMIT;
```

### 9.3 · Edge case · operator session crash between T2 and T3

If the operator's shell session crashes between T2 and T3 (ultra-rare but possible):
- The attempt row remains in `pending` state durably
- The operation may have succeeded or failed · the actual DB state reflects the outcome
- A **manual reconciliation query** (operator-run · NOT automatic in G1) can identify stale pending attempts and reconcile against actual state:

```
SELECT id, attempted_at, action, target_account_id, before_state
FROM nex_pilot_operator_audit
WHERE attempt_status = 'pending'
  AND attempted_at < now() - interval '1 hour';
```

For each stale row, the reconciling operator compares `before_state` to current `nex_account` state and manually updates `attempt_status` to the correct value with explanation.

**G1 does not implement automatic reconciliation.** The index `idx_nex_pilot_operator_audit_pending` supports the manual query efficiently.

### 9.4 · Honest statement

- **Successful operations** are durably recorded via T1 (attempt) + T3 (success).
- **Failed operations** are durably recorded via T1 (attempt) + T3 (failure).
- **Crashed operations** (operator session died between T2 and T3) leave the attempt in `pending` state · requires manual reconciliation.
- **A rolled-back T2 does NOT roll back the T1 attempt row** because T1 committed in its own transaction before T2 began.
- Each transaction is small and committed independently · failure of any one does not corrupt the others.

### 9.5 · Alternative or complementary · structured log emission

Per Q6 (structured logs with hashed account IDs and request IDs), every state transition emits a server-log line regardless of DB state. This provides a secondary durable record:

- Pre-operation log line: `{event:'operator.attempt', requestId, operatorHash, action, targetAccountHash, justification}`
- Post-operation log line: `{event:'operator.outcome', requestId, status: 'succeeded'|'failed', errorMessage?}`

If the DB three-transaction pattern fails (e.g. T1 cannot even commit because DB is down), the server log still captures the attempt. The structured log and the audit table are correlated via `requestId`.

### 9.6 · What this mechanism is NOT

- NOT a replacement for a proper admin UI · it is a pilot-only auditable shortcut
- NOT suitable for high-volume operations · operator-level audit only
- NOT accessible to end users
- NOT a substitute for retention review before any post-activation unwind

---

## 10 · Idempotency and rate-limiting · verification requirements

### 10.1 · Idempotency (Q5) · properties to verify

Owner directive 2026-10-22: *"Verify the existing primitive's concurrency, persistence, account/endpoint isolation and same-key retry behaviour. Keep database state constraints authoritative."*

**Verified existence (from G0 audit):**

- `src/lib/nex/idempotency/types.ts` · defines `IdempotencyRecord`, `IdempotencyStore` adapter interface
- `src/lib/nex/idempotency/store.ts` · JSONL default store · 24h TTL
- `src/lib/nex/idempotency/middleware.ts` · Stripe-style `Idempotency-Key` header semantics
- `src/lib/nex/idempotency/idempotency.test.ts` · WAVE-P-1.2 contract tests

**Properties the G1 implementation drafting MUST verify** by reading the actual source + running the existing tests (and adding new tests where coverage is thin):

| Property | Must be true for G1 use | Verification path |
|---|---|---|
| **Concurrency** · two parallel same-key requests: one proceeds, other sees the response (not both execute the action) | **YES** | Review `middleware.ts` · run `idempotency.test.ts` · add a concurrent-request integration test (T28a §11.7) |
| **Persistence** · stored response survives server restart within TTL | **YES** | Review `store.ts` · JSONL implies disk persistence · verify TTL semantics |
| **Scope isolation** · key for `/trial/start` does NOT collide with key for `/trial/opt-out-conversion` | **YES** | Review `middleware.ts` for scope-key composition · verify (likely `method+path+key` but confirm) |
| **Account isolation** · same key from different accounts is treated as separate | **YES** | Review middleware · if request-level only, G1 drafting adds account-scoping wrapper |
| **Same-key different-payload rejection** · attempt to reuse a key with different body is explicitly rejected per Stripe convention | **YES** | Verify behaviour · implementation may differ from spec |
| **TTL cleanup** · stale keys are cleaned so storage doesn't grow unbounded | **YES** | Review store · 24h TTL implies cleanup · verify no leak |

**Honest position for G1:**

- Idempotency middleware is a **belt-and-braces** layer, NOT the primary defence
- **Database state constraints are authoritative** · one-trial-per-lifetime (K1) is enforced by `business_trial_status IS NULL` precondition under `SELECT ... FOR UPDATE` · opt-out state transition is enforced by WHERE clause preconditions · the DB cannot be fooled by a replayed key
- If the idempotency primitive fails any verification above, G1 either (a) uses it only as advisory with DB preconditions as truth, (b) adds a scope-wrapper to compensate, or (c) defers idempotency header support to a later gate

### 10.2 · Rate-limiting (Q7) · repository-verified primitive

**Verified files (from G0 audit):**

- `src/lib/nex-native/community/rate-limit.ts` · `recordIfAllowed(accountId, action)` function · rolling-window counter · reads/writes `nex_community_rate_limit` table
- `src/lib/nex-native/community/types.ts` · `NEX_COMMUNITY_RATE_LIMITS` config catalogue · `NexCommunityRateLimitError` class
- Prior art consumer: `src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts` (guest-message rate limit)

**Honest limitation (from the file's own comment):**

> *"Not atomic in the strict sense — two concurrent calls to recordIfAllowed at a cold bucket could both pass. For Phase 1 this is acceptable. If stricter serialisation becomes needed we can move to a Postgres advisory lock or a stored procedure."*

For trial endpoints, **the one-trial-per-lifetime rule is enforced at the DB layer** (K1 via `SELECT ... FOR UPDATE` + conditional UPDATE), so a brief rate-limit race cannot result in multiple trials being started · it can only waste a few quota entries. **Acceptable for G1.**

### 10.3 · Rate-limit config edit scope (A3 PROPOSED)

Per A3 PROPOSED answer: allow only the three trial-specific action keys needed for G1. Options for implementation:

- **Option α** · extend existing `NEX_COMMUNITY_RATE_LIMITS` catalogue with 3 new keys (minimal · safe · reuses `recordIfAllowed()`)
- **Option β** · create parallel `NEX_TRIAL_RATE_LIMITS` catalogue in a new file (zero impact on community behaviour)

**G1 drafting MUST present both options with code evidence and let owner choose.** PROPOSED default recommendation: **Option β** · zero impact on community rate-limit behaviour · aligns with A3 "preserve unrelated community limits and behaviours."

---

## 11 · Regression-test plan · expanded + G1/G3/G4/G5 scope labels

Owner directive 2026-10-22: *"Retain the existing regression coverage and add tests for the corrected payment-state contract, durable audit behaviour, and actual database concurrency. Distinguish G1 tests from future G3/G4 tests."*

### 11.1 · Overlapping trial tests (D1 verification · critical · G1 scope)

| ID | Scope | Test |
|---|---|---|
| T1 | **G1** | Account with `themes_trial_used_at` set in last 168h attempts `/trial/start` → 409 `themes_trial_still_active` |
| T2 | **G1** | Account with `business_trial_status='active'` attempts `startThemesTrial` → DB trigger raises · translated to 409 `business_trial_still_active` |
| T3 | **G1** | Account with `themes_trial_used_at` set > 168h ago attempts `/trial/start` → 200 success |
| T4 | **G1** | Account with `business_trial_status='converted'` (ended cleanly) attempts `startThemesTrial` → 200 success (per B3) |
| T4b | **G1** | Account with `business_trial_status='converted'` attempts `/trial/start` → 409 `already_used` (B3 does NOT re-enable a second business-trial) |

### 11.2 · Real PostgreSQL concurrency tests (S1 verification · critical · G1 scope)

**All tests in this subsection use REAL `pg` library against a test database with the migration applied. Vitest `Promise.all` of mocked services does NOT count.**

| ID | Scope | Test |
|---|---|---|
| T5a | **G1** | 10 real pg clients fire concurrent `/trial/start` service calls (each with `SELECT ... FOR UPDATE` + UPDATE) against one account → exactly 1 commits · 9 either return 0 rows affected OR raise `exclusion_violation` · final DB state has 1 active trial |
| T6a | **G1** | 1 real `/trial/start` + 1 real `startThemesTrial` fire concurrently against one account → exactly 1 succeeds · final state has either `business_trial_status='active'` OR `themes_trial_used_at` set, never both |
| T6b | **G1** | Repeat T6a 50 times with randomised ordering · all 50 runs produce exactly 1 success · catches non-deterministic races |
| T7 | **G1** | 10 parallel real pg clients firing `/trial/opt-out-conversion` from same active-trial account → exactly 1 success · 9 return 409 `already_opted_out` |
| T8 | **G1** | 10 parallel real pg clients firing `/trial/resume-conversion-interest` from same account → exactly 1 success · 9 failures (409 `not_opted_out` after the first clears it) |

### 11.3 · State-transition tests (completeness · G1 scope)

| ID | Scope | Test |
|---|---|---|
| T10 | **G1** | `/trial/status` returns correct shape for each of: NULL · active · converted · expired · active+opt_out |
| T11 | **G1** | `/trial/opt-out-conversion` on `expired` account → 409 `trial_not_active` |
| T12 | **G1** | `/trial/resume-conversion-interest` within 24h of expiry → 409 `within_24h_of_expiry` |
| T13 | **G1** | `/trial/resume-conversion-interest` for account with opt_out=false → 409 `not_opted_out` |

### 11.4 · Pre-existing functionality preservation (regression floor · G1 scope)

| ID | Scope | Test |
|---|---|---|
| T14 | **G1** | `welcome-trial-copy.test.ts` continues to pass 5/5 |
| T15 | **G1** | `startThemesTrial` still grants `effectiveTier()==='bisnis'` for 7 days when business-trial is not active · tier-elevation unchanged |
| T16 | **G1** | Free account passes all 7 `tier-gate.ts` `assertCan*` + `clampAnalyticsWindow` tests |
| T17 | **G1** | Account with `nex_theme_ownership` row retains that row through every `business_trial_status` transition · no `ON DELETE CASCADE` fires |
| T18 | **G1** | Account with intro customization state (209/211 columns + storage objects) retains all state through every transition |
| T19 | **G1** | Vault state is untouched by any trial transition · `nex_vault_*` tables unchanged |

### 11.5 · Negative-access tests (K14 · Option β verification · G1 scope)

| ID | Scope | Test |
|---|---|---|
| T20 | **G1** | Trial-active account: `effectiveTier()` returns `'gratis'` |
| T21 | **G1** | Trial-active account: `effectiveTrialEntitlements()` returns `{shop:true, vault:false, themes_premium:false, intros_premium:false, p1_verified:false, p2_boosted:false, p3_cancel:false}` |
| T22 | **G1** | Trial-active account attempts Vault access via Vault service endpoint → 403 |
| T23 | **G1** | Trial-active account tries to apply a premium theme → denied |
| T24 | **G1** | Trial-active account hits every tier-gated cap at `gratis` levels (products · businesses · live posts · AI reply · analytics window) · trial does NOT raise these caps |
| T25 | **G1** | Trial-active account uses Shop features → ALLOWED (upload products · edit menu · set delivery · set promo/discount) |

### 11.6 · Feature-flag tests (Q3 verification · G1 scope)

| ID | Scope | Test |
|---|---|---|
| T26 | **G1** | With `NEX_BUSINESS_TRIAL_ENABLED=false`, `/trial/start` returns 403 `business_trial_not_available` even when all preconditions pass |
| T27 | **G1** | With flag disabled, `/trial/status` still returns correct current state (read-only endpoint always works) |

### 11.7 · Idempotency and rate-limit tests (Q5 · Q7 verification · G1 scope)

| ID | Scope | Test |
|---|---|---|
| T28 | **G1** | Same `Idempotency-Key` sent twice to `/trial/start` within 24h returns same response · DB write once · **verifies CONCURRENCY property per §10.1** |
| T28a | **G1** | Two parallel real requests with same `Idempotency-Key`: one processes, other sees stored response · DB write happens exactly once |
| T29 | **G1** | 6th `/trial/start` attempt in an hour returns 429 `rate_limited` with correct error-body fields |
| T30 | **G1** | Rate-limit counter resets at window boundary (rolling-window test) |

### 11.8 · Pilot audit durability tests (S4 corrected design · G1 scope)

| ID | Scope | Test |
|---|---|---|
| T31 | **G1** | Successful operator operation: `nex_pilot_operator_audit` row has `attempt_status='succeeded'` + `after_state` set + `outcome_at` set · attempt row persists after operation commit |
| **T31a** | **G1 · NEW** | **Failed operator operation: attempt row has `attempt_status='failed'` + `error_message` set · attempt row persists DESPITE operation rollback (verified via three-transaction pattern). Test deliberately makes T2 fail · asserts attempt row from T1 is still present and T3 marked it failed.** |
| **T31b** | **G1 · NEW** | **Operator session crash between T2 and T3 simulation: attempt row remains in `pending` state · reconciliation query via `idx_nex_pilot_operator_audit_pending` finds the stale row** |
| T32 | **G1** | Query by `target_account_id` returns ordered-by-attempted-at result (index verified) |

### 11.9 · Rollback tests (migration integrity · G1 scope)

| ID | Scope | Test |
|---|---|---|
| T33 | **G1 · PRE-ACTIVATION** | Apply migration to empty database → run smoke tests → execute §3.3.1 rollback → smoke tests still pass against pre-migration state |
| **T33a** | **G1 · POST-ACTIVATION · NEW** | **Attempt pre-activation rollback against a database with 1 active trial AND 1 audit row → rollback script MUST error with clear message. G1 does NOT provide a post-activation recovery procedure · attempted post-activation rollback must FAIL safely.** |

### 11.10 · Payment-state contract tests (G3 scope · documented at G1 for G3 to implement)

The following are NOT G1 tests but are documented here so the G3 implementation knows the required test coverage:

| ID | Scope | Test |
|---|---|---|
| T34 | **G3** | Webhook with invalid signature → 403 · no state change |
| T35 | **G3** | Duplicate webhook (same event delivered twice) → idempotent · UPDATE executes once · 2nd delivery returns 200 without re-execution |
| T36 | **G3** | Webhook arrives after `/trial/opt-out-conversion` was called → attempt marked `cancelled` with `error_code='customer_opted_out'` · no conversion · G3 may initiate refund |
| T37 | **G3** | Late-payment webhook within G3-defined window → `expired → converted` transition succeeds |
| T38 | **G3** | Late-payment webhook beyond G3-defined window → rejected · attempt marked `cancelled` with `error_code='retry_window_exceeded'` |
| T39 | **G3** | Pending payment attempt row does NOT keep `business_trial_status='active'` past `end_at` · verified by inserting fake pending attempt and running G4 cron equivalent |
| T39a | **G3** | Webhook arriving between opt-out and reversal (user opted out, then changed mind, then webhook arrives) · G3's precondition check at step 4 reads current `opt_out` value under row lock · behaviour depends on exact timing · documented contract |

**G1 cannot test T34-T39 because G3 is not implemented at G1 time.** These tests become required at G3 implementation drafting.

### 11.11 · Future-gate test coverage (G4 · G5 scope)

| ID | Scope | Test |
|---|---|---|
| T40 | **G4** | G4 cron sweep: active trial with `now > end_at` and no verified-success payment → transitions to `'expired'` regardless of pending payment attempts (per corrected state table) |
| T41 | **G4** | G4 cron idempotency: running sweep twice on same already-expired trial does NOT re-transition or emit duplicate logs |
| T42 | **G5** | G5 sunset queue: `expired` business-trial that has not been converted may be queued for sunset per D2 preconditions (90-day grace, verified export, etc.) |

### 11.12 · Test infrastructure requirements

- **Real-pg concurrency harness** (T5a · T6a · T6b · T7 · T8 · T28a) requires `pg` library + test database + ability to open multiple connections. Likely new test file `tests/integration/trial-concurrency.integration.ts` with its own vitest config to run against a provisioned test Postgres instance.
- **Simulated-clock tests** for T40 (G4) can be deferred to G4 implementation drafting. G1 does not need the fake-clock harness.
- **Idempotency tests** (T28 · T28a) reuse existing primitive tests + new concurrent-request test.

---

## 12 · Unresolved decisions · assumptions · implementation blockers · updated

### 12.1 · Blockers requiring owner answer before G1 implementation drafting

- **A1 Migration number** · verify highest-applied-and-authored migration ID at implementation time · keep provisional
- **A2 Feature flag mechanism** · reuse existing server-side flag OR add `NEX_BUSINESS_TRIAL_ENABLED` env var · server-side enforcement required
- **A3 Rate-limit config edit scope** · Option α (extend community catalogue) vs Option β (parallel catalogue) · owner selects · PROPOSED Option β
- **A4 Operator identity hashing** · verify existing audit conventions first · SHA-256 + env pepper if no existing convention
- **A5 Rate-limit defaults** · 5/10/10 proposed · owner approves specific numbers
- **Pilot audit table retention** · PROPOSED to keep in G1 subject to confirmation that pilot requires manual operator interventions
- **Partial index on business_trial_end_at** · PROPOSED to keep in G1 as cheap future-staging · owner may DEFER to G4

### 12.2 · Open design sub-questions

- **B1 Converted-state tier assignment** · G3 scope · G3 verifies payment before any paid entitlement (contract documented §8)
- **B2 Post-expiry status** · `converted` is historical · `expired` is unconverted · lazy downgrade by `effectiveTier()`
- **B3 Themes-trial after converted business-trial** · ALLOWED · verified by T4 · T4b verifies no second business-trial

### 12.3 · Not in G1 scope · deferred to later gates

- Payment initiation + webhook verification (G3)
- `nex_billing_attempt` table (G3)
- `nex_data_sunset_schedule` table (G5)
- 3 payment columns on `nex_account` (`tier_activated_at` · `payment_provider` · `payment_provider_customer_id`) (G3)
- Admin reset endpoint (later gate · Q1)
- Shop read-only enforcement (G2 · G5)
- Cron jobs for trial expiry (G4)
- Export + sunset safeguards (G5)
- UI integration (G6)
- Launch gate verification (G7)
- Public pricing copy (G8)

### 12.4 · Non-trial blockers acknowledged

- **X2** · Price mismatch Rp 99k vs Rp 39k · blocks G7 (public copy) · owner reconciliation required separately
- **X5** · Privacy Policy §19 vs reality · blocks G5 · owner must either build export (G5 scope) or revise policy copy · independent of G1
- **X6** · Live Stripe keys in `.env.local` · independent security gate · rotation recommended regardless of trial scope
- **X7** · `vault_tier` dormant reference · G2 scope · independent fix

### 12.5 · Testing-related open items

- Real-pg concurrency harness · must be built as part of G1 implementation drafting (new test infrastructure)
- Playwright e2e coverage for trial flows · currently zero · owner may want to add in G1 or defer to G6
- Fake-clock test harness · needed for G4 cron tests (not G1) · can be scaffolded in G1 or deferred
- Load / concurrency test infrastructure · pure vitest-level simulation is NOT sufficient for S1 (per owner directive)

---

## 13 · Nothing is authorised

This document is **DESIGN ONLY**. To move forward:

1. **Owner reviews this package** · flags corrections · approves or amends
2. **Owner approves A1-A5 and B1-B3** · each item in the §2.1 PROPOSED table
3. **Owner issues a separate explicit authorisation** to begin G1 implementation drafting (writing the migration file to `nex-supabase/migrations/{number}_nex_business_trial_system.sql` · creating the 4 endpoint route files · adding the `effectiveTrialEntitlements` helper · adding the regression test files including the real-pg concurrency harness)
4. **G1 implementation drafting output is itself a reviewable deliverable** before any file write to application code or migration directories
5. **G1 implementation does NOT cascade into G2-G8** · each requires its own authorisation

**No file in `src/` or `nex-supabase/migrations/` has been created, modified, or deleted by this document.**
**No commit has been made.**
**No cleanup of the 124 existing working-tree changes.**
**No credential rotation.**
**No application of migration 207 or any other migration.**
**No G2-G8 work.**

This document is a single untracked file at `docs/doctrine/nex-trial-system-g1-design-package-2026-10-22.md`. Its contents have been revised 2026-10-22 (same day) per owner directive but the file remains untracked. The working tree has 124 pending changes (55 M · 2 D · 67 untracked including this file). The pre-existing 123 are untouched.

---

## N · Change log

- **2026-10-22 · Original design package authored by Claude.** 731 lines · 13 sections · 7 columns + 3 new tables + 1 trigger · 33 regression tests. Submitted for owner review.
- **2026-10-22 (same day · revision) · Revised per owner directive.** Addresses 5 corrections + 3 scope boundaries:
  - **Scope reduced** · from 7 columns + 3 new tables to 4 columns + 1 new table + 1 trigger + 1 partial index. Deferred `nex_billing_attempt` (G3), `nex_data_sunset_schedule` (G5), and 3 payment columns (G3).
  - **Payment lifecycle corrected** · initiation separated from webhook verification · pending payment does NOT extend shop editing · duplicate/late/opt-out-between handling explicit.
  - **Concurrency strengthened** · service-layer `SELECT ... FOR UPDATE` row lock added as PRIMARY defence · trigger retained as fail-safe · real PostgreSQL parallel-transaction tests required.
  - **Audit durability corrected** · three-transaction pattern · `attempt_status` enum column added · failed operations durably recorded · rolled-back operations do NOT roll back the audit record.
  - **Idempotency verification** · 6 properties listed to verify at implementation time · DB preconditions remain authoritative.
  - **Rollback split** · pre-activation (destructive · safe · §3.3.1) vs post-activation (data preserved · retention plan required · §3.3.2 · G1 does NOT provide).
  - **PROPOSED decision table** added for A1-A5 and B1-B3 (§2.1).
  - **Test plan expanded** · 33 → 41+ tests · each labelled G1/G3/G4/G5 scope · new tests: T4b (B3 verification), T6b (50-run concurrency), T28a (parallel idempotency), T31a (durable failed audit), T31b (crash reconciliation), T33a (post-activation rollback error), T39a (opt-out between delivery), T41-T42 (G4/G5 scope).
  - All 124 working-tree changes preserved · design artifact file remains untracked · no application code modified · no migration file created · no commits.

Returning to owner for review.
