# Phase 1 · Migration 312 · Production Preflight Evidence
### 2026-11-09

**Author:** Claude Opus 4.7 · operating under owner-authorised Phase 1 G2 preflight scope (read-only inspection + evidence only).
**Scope:** Evidence the owner needs to decide whether to authorise applying mig 312 to production. **Zero production changes made during this preflight.** Zero data modifications. Zero schema modifications.
**Gate ahead:** If this evidence is sound, the owner's next message `apply mig 312 production` authorises the actual apply. Nothing in this document authorises that step.

---

## 0 · The exposure mig 312 closes

Production `ijvqdvsvwtwxzcqmoqit` has migration 258 applied as of **2026-11-05 08:04:44 UTC** (from `nex_migration_history`). That migration created three billing tables but **did not enable Row-Level Security and did not revoke default Supabase grants**. The current state:

| Table | RLS enabled? | Anon privileges | Authenticated privileges |
|---|---|---|---|
| `nex_billing_adverse_event` | **FALSE** | SELECT · INSERT · UPDATE · DELETE · TRUNCATE · REFERENCES · TRIGGER | SELECT · INSERT · UPDATE · DELETE · TRUNCATE · REFERENCES · TRIGGER |
| `nex_billing_checkout_session` | **FALSE** | Same (confirmed in grant scan) | Same |
| `nex_billing_event_log` | **FALSE** | Same | Same |

**Current row counts (aggregate):** 0 rows in all three tables.

**What this means:** As of right now, **any holder of the public Supabase anon key** could:
- `SELECT *` on the three billing tables → read Stripe customer IDs, subscription IDs, invoice IDs, dispute IDs, payment intent IDs, charge IDs, refund IDs, dispute status, access-block state, period dates, and every webhook event ever processed.
- `INSERT` fraudulent adverse-event rows → inject false disputes / fake fraud flags to block an account.
- `UPDATE` existing rows → tamper with dispute closure timestamps, access-block cleared state.
- `DELETE` rows → destroy webhook idempotency audit trail → cause duplicate billing processing on next webhook replay.
- `TRUNCATE` → wipe the entire billing audit history.

**Mitigating factor:** Row count is currently 0 in all three tables, so no data is exfiltratable TODAY. But any production Stripe traffic (webhook received by `/api/.../billing/webhook/stripe`) will immediately create rows in `nex_billing_event_log`, and those rows will be readable by anyone with the anon key for as long as the lockdown is deferred.

**Severity:** P0-CURRENT. Urgency is high because the exposure becomes materially harmful the moment any Stripe webhook fires in production.

---

## 1 · Exactly what mig 312 would execute on production

### 1.1 Migration SQL · verbatim

```sql
BEGIN;
SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(312000001);

DO $mig$
DECLARE
  v_mig_258_applied boolean;
BEGIN
  -- Idempotency guard
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '312') THEN
    RAISE EXCEPTION 'Migration 312 already recorded in nex_migration_history.';
  END IF;

  -- Conditional detection
  v_mig_258_applied := EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '258');

  IF NOT v_mig_258_applied THEN
    RAISE NOTICE 'Migration 258 not applied in this env · 312 is a no-op lockdown here (recording ledger only).';
  ELSE
    -- nex_billing_event_log
    EXECUTE 'ALTER TABLE nex_billing_event_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON nex_billing_event_log FROM public';
    EXECUTE 'REVOKE ALL ON nex_billing_event_log FROM authenticated';
    EXECUTE 'REVOKE ALL ON nex_billing_event_log FROM anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON nex_billing_event_log TO service_role';

    -- nex_billing_adverse_event
    EXECUTE 'ALTER TABLE nex_billing_adverse_event ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON nex_billing_adverse_event FROM public';
    EXECUTE 'REVOKE ALL ON nex_billing_adverse_event FROM authenticated';
    EXECUTE 'REVOKE ALL ON nex_billing_adverse_event FROM anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON nex_billing_adverse_event TO service_role';

    -- nex_billing_checkout_session
    EXECUTE 'ALTER TABLE nex_billing_checkout_session ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON nex_billing_checkout_session FROM public';
    EXECUTE 'REVOKE ALL ON nex_billing_checkout_session FROM authenticated';
    EXECUTE 'REVOKE ALL ON nex_billing_checkout_session FROM anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON nex_billing_checkout_session TO service_role';
  END IF;
END
$mig$;

INSERT INTO nex_migration_history (version, applied_at, description, notes) VALUES (
  '312', NOW(),
  'nex_billing tables RLS lockdown · explicit REVOKE + RLS enable + service-role-only grants',
  'Phase 1 F-1 · owner-authorised 2026-11-09 · ...'
);

COMMIT;
```

### 1.2 Decomposed statement count on production (where mig 258 IS applied)

Production will execute the ELSE branch. Statement-by-statement:

| # | Statement | Effect |
|---|---|---|
| 1 | `ALTER TABLE nex_billing_event_log ENABLE ROW LEVEL SECURITY` | Sets `relrowsecurity=true` · policies now enforce (there are none → default-deny) |
| 2 | `REVOKE ALL ON nex_billing_event_log FROM public` | Removes default `public` grants |
| 3 | `REVOKE ALL ON nex_billing_event_log FROM authenticated` | Removes authenticated grants · closes authenticated-REST access |
| 4 | `REVOKE ALL ON nex_billing_event_log FROM anon` | Removes anon grants · closes anon-REST access |
| 5 | `GRANT SELECT, INSERT, UPDATE, DELETE ON nex_billing_event_log TO service_role` | Ensures service-role can continue to operate |
| 6-10 | Same 5 statements on `nex_billing_adverse_event` | Same |
| 11-15 | Same 5 statements on `nex_billing_checkout_session` | Same |
| 16 | `INSERT INTO nex_migration_history ...` | Ledger write |

**Total · 16 statements in one transaction.** All or nothing (BEGIN...COMMIT · advisory lock held throughout).

### 1.3 What mig 312 does NOT touch

- Zero rows read or written from the billing tables themselves
- Zero schema changes (columns · types · constraints · indexes · all preserved)
- Zero policies added (RLS enabled with zero policies = default-deny · simpler to reason about than permissive policies)
- Zero triggers added
- Zero changes to non-billing tables
- Zero changes to code · code continues to run through service-role pooler

### 1.4 Statement execution time estimate

Each `ALTER TABLE ENABLE ROW LEVEL SECURITY` acquires a brief `ACCESS EXCLUSIVE` lock on the target table. With zero rows in each table, this lock is held for milliseconds. Total transaction runtime: **< 1 second** on an idle database.

---

## 2 · Rollback characteristics

### 2.1 Rollback SQL · verbatim summary

File: `nex-supabase/migrations/312_nex_billing_rls_lockdown.rollback.sql`

Execution path on production (where 258 is applied):
1. `ALTER TABLE nex_billing_event_log DISABLE ROW LEVEL SECURITY` · unwinds RLS
2. `ALTER TABLE nex_billing_adverse_event DISABLE ROW LEVEL SECURITY` · unwinds RLS
3. `ALTER TABLE nex_billing_checkout_session DISABLE ROW LEVEL SECURITY` · unwinds RLS
4. `DELETE FROM nex_migration_history WHERE version = '312'` · removes ledger row

### 2.2 Critical defence-in-depth property

The rollback **deliberately does NOT re-grant anon/authenticated privileges**. This is explicit per sealed invariant **I-5** (no rollback restores private content). Rolling back leaves the tables in an unusual state:
- RLS is off (back to pre-312)
- But anon/authenticated grants are REVOKED (not restored to Supabase defaults)

**Consequence:** a forced rollback leaves the tables **less accessible than the original pre-312 state** rather than more accessible. This is intentional. If the owner needs to restore legacy wide-open anon/authenticated access after rolling back (highly unusual), that requires a separate explicit grant migration.

### 2.3 When a rollback is NOT acceptable

Per the sealed Phase 1 plan § 20 (via Revision 2 doctrine § 20.1): a rollback may NOT be used as a service-recovery tool once mig 312 is in production. If a service-role code path breaks post-apply (not expected because service-role bypasses RLS and the grants are preserved), the fix is a forward migration adding explicit policies or grants — not a rollback that re-exposes PII.

---

## 3 · Code-path audit · will mig 312 break anything?

### 3.1 Files that reference the billing tables (13 files)

Enumerated via `rg "nex_billing_event_log|nex_billing_adverse_event|nex_billing_checkout_session"` across `src/`:

| File | Access path | Role | RLS-bypassing? |
|---|---|---|---|
| `src/lib/nex-native/billing/supabase-store.ts` | Direct `pg` connection to Supabase pooler · explicit note in file header lines 26-28: *"Supabase pooler endpoint uses the service-role identity"* | **service_role** | **YES** · bypasses RLS |
| `src/lib/nex-native/billing/webhook-handler.ts` | Dependency-injected `BillingStore` from `supabase-store.ts` | **service_role** | **YES** |
| `src/lib/nex-native/billing/stripe-buyer-payment-service.ts` | `nexSupabaseAdmin` from `../supabase-admin` | **service_role** | **YES** |
| `src/lib/nex-native/billing/reconciliation.ts` | Injected BillingStore | **service_role** | **YES** |
| `src/lib/nex-native/billing/checkout-session.ts` | Injected BillingStore | **service_role** | **YES** |
| `src/app/api/nex-native/billing/cron/reconcile/route.ts` | `createProductionBillingStore` from `supabase-store.ts` | **service_role** | **YES** |
| `src/lib/nex-native/billing/store.ts` | Interface only · no direct DB | n/a | n/a |
| `src/lib/nex-native/billing/types.ts` | Type definitions only | n/a | n/a |
| `src/lib/nex-native/billing/__tests__/entitlement.test.ts` | Mock store | n/a | n/a |
| `src/lib/nex-native/billing/__tests__/supabase-store-sql.test.ts` | Test harness | n/a | n/a |
| `src/lib/nex-native/billing/__tests__/pre-integration-review.test.ts` | Test harness | n/a | n/a |
| `src/lib/nex-native/billing/MASTER_BUILD_CHECKLIST.md` | Doc | n/a | n/a |
| `src/lib/nex-native/billing/BILLING_README.md` | Doc | n/a | n/a |

### 3.2 Conclusion of audit

**Zero** non-service-role code paths touch the billing tables. Every production read/write goes through the Supabase pooler with service-role credentials, which bypasses RLS. Mig 312:
- Will NOT break the webhook processor (uses service-role)
- Will NOT break the reconciliation cron (uses service-role)
- Will NOT break the checkout-session store (uses service-role)
- Will NOT break the buyer-payment handlers (uses service-role)

### 3.3 One edge case to monitor

If any FUTURE code path shifts to the authenticated-role client (e.g. a user-facing "see my billing history" page using cookie-based Supabase client), that code would be denied by mig 312's RLS. That is the correct behaviour — a user-facing view of billing data should go through a server-side route using service-role, not through direct RLS-trusted client access to sensitive tables.

**This is not a current risk** · no such code path exists today.

---

## 4 · Sandbox verification history

Sandbox (`kdstoyyeygcopkogqsyv`) does not have mig 258 applied, so the billing tables don't exist there. Mig 312 has been applied to sandbox (2026-11-08 23:49 UTC) and executed the **conditional no-op path** successfully. Ledger row recorded. No tables touched (because none to touch).

**What this proves:**
- Mig 312's conditional `DO $mig$ ... END` block correctly detects the presence/absence of mig 258
- Mig 312 is idempotent (re-apply attempt raises `Migration 312 already recorded` cleanly)
- Mig 312's ledger write + commit cycle works end-to-end

**What this does NOT prove:**
- The ELSE branch (which is what will run on production) has NOT been executed in any environment yet · production will be the first environment to run the actual RLS enable + revoke + grant statements
- The sandbox can only prove the structural safety of the conditional block, not the final-state correctness of the lockdown

**Alternative sandbox verification path (optional · not performed · requires separate owner authorisation):** apply mig 258 to sandbox first, then re-apply 312 (removing its ledger row first), then observe the RLS enable + revoke + grant pattern execute. This would prove the ELSE branch end-to-end but requires modifying sandbox state and adds mig 258 schema to sandbox unnecessarily.

**Current recommendation:** proceed to production apply after this preflight review. The ELSE branch is 15 well-understood PostgreSQL statements with no subtle semantics. The statement-by-statement decomposition in § 1.2 is auditable. The risk of unexpected behaviour on production is very low.

---

## 5 · What happens on production step-by-step (projection)

### 5.1 Pre-apply state

| Fact | Value |
|---|---|
| Mig 258 in ledger | YES (2026-11-05 08:04:44 UTC) |
| Mig 312 in ledger | NO |
| `nex_billing_event_log` exists | YES |
| `nex_billing_adverse_event` exists | YES |
| `nex_billing_checkout_session` exists | YES |
| `relrowsecurity` on event_log | FALSE |
| `relrowsecurity` on adverse_event | FALSE |
| `relrowsecurity` on checkout_session | FALSE |
| Row count in event_log | 0 |
| Row count in adverse_event | 0 |
| Row count in checkout_session | 0 |
| Policies on any | None |
| anon grants on any | ALL (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) |
| authenticated grants on any | ALL |
| service_role grants on any | ALL |
| Active DB connections (expected) | Service-role via pooler for webhook processor and cron |

### 5.2 Post-apply projected state (what mig 312 produces)

| Fact | Value |
|---|---|
| Mig 258 in ledger | YES (unchanged) |
| Mig 312 in ledger | YES (newly recorded) |
| Billing tables exist | YES (unchanged) |
| `relrowsecurity` on event_log | **TRUE** |
| `relrowsecurity` on adverse_event | **TRUE** |
| `relrowsecurity` on checkout_session | **TRUE** |
| Row count (unchanged) | 0 |
| Policies on any | None (RLS-on + zero-policies = default-deny) |
| anon grants on any | **NONE** (revoked) |
| authenticated grants on any | **NONE** (revoked) |
| service_role grants on any | SELECT/INSERT/UPDATE/DELETE (explicitly granted · restores operation) |
| Service-role code paths | Continue to function unchanged |

### 5.3 Observable user-visible change

**None.** There is no user-facing route that reads from these tables through the anon or authenticated clients. The webhook processor, cron reconciliation, and buyer-payment handlers all use service-role and are unaffected. Users of NEX will see zero behaviour change.

The change is exclusively about closing the attack surface that was there but unused today.

---

## 6 · Risk register for the apply operation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ALTER TABLE lock contention with a running webhook | Low | Brief delay for one webhook if it hits during apply window | Advisory lock held in migration · webhook retries · Stripe redelivers up to 72h |
| Future code path depends on anon/authenticated billing read | None (audited) | n/a | §3 audit confirms zero existing paths |
| Rollback forced due to unforeseen issue | Very low | Rollback safe per § 2.2 · no data loss · tables stay not-readable by anon post-rollback | Rollback script present + reviewed |
| Service-role credential misconfigured post-apply | Very low (service-role works TODAY) | Full billing processing outage | Spot-check webhook test in production immediately after apply |
| Apply fails mid-transaction | Very low | BEGIN/COMMIT isolation · no partial state possible | Advisory lock + idempotency guard · safe to retry |

### 6.1 Rollback-decision matrix (what triggers rollback?)

| Symptom | Rollback? |
|---|---|
| Webhook processor loses access | **No** · service-role grants preserved · check Supabase service-role key config first |
| Cron reconciliation fails | **No** · same reason · check config |
| Unexpected error in a specific route | **Investigate first** · likely unrelated to RLS |
| Auditor flags the lockdown as incorrect | **No** · fix forward with a corrective migration |
| Catastrophic DB-wide degradation | **Yes** · rollback restores RLS off · but leaves grants revoked (safer than original) |

---

## 7 · Verification plan POST-apply (V-F1-T6 from Phase 1 plan)

Immediately after the apply script succeeds, the production preflight re-run script will produce an AFTER snapshot and compare:

| Verification | Expected Value |
|---|---|
| V-F1-T6a · `nex_migration_history` has mig 312 | YES |
| V-F1-T6b · `relrowsecurity=true` on all 3 tables | YES |
| V-F1-T6c · `anon` grants on all 3 tables | EMPTY |
| V-F1-T6d · `authenticated` grants on all 3 tables | EMPTY |
| V-F1-T6e · `service_role` grants on all 3 tables | SELECT/INSERT/UPDATE/DELETE |
| V-F1-T6f · Row counts (should be unchanged) | 0 (or whatever has accumulated since preflight · service-role writes continue) |
| V-F1-T6g · Anon REST query via Supabase anon key | Returns zero rows / 401 / 403 (not actual data) |
| V-F1-T6h · Service-role write via webhook processor | Succeeds (test with a replayed Stripe event via Stripe CLI) |

**Verification scripts to be authored at G2 trigger · not before.**

---

## 8 · Owner decision summary

### 8.1 The question before you

Apply migration 312 to production `ijvqdvsvwtwxzcqmoqit`?

### 8.2 Case FOR apply

- Closes P0-CURRENT billing-table exposure (anon has full CRUD on billing PII tables today)
- 0 rows in tables · no data at risk from the apply itself · but exposure becomes real the moment Stripe webhooks begin writing
- Zero user-visible change
- Zero code change required
- Rollback available and safe per §2.2
- All code paths audited · use service-role · unaffected by RLS
- Idempotent + transactional · safe to retry
- Statement-by-statement decomposition is auditable (§1.2 · 15 statements + 1 ledger insert)

### 8.3 Case AGAINST apply (or for delay)

- Current exposure has zero data at risk because row count is 0 · not catastrophic today
- ELSE branch of the migration has not been executed in sandbox (conditional no-op only) · production would be first-run
- If the owner wants belt-and-braces verification, apply mig 258 to sandbox first, then re-run mig 312 there to execute the ELSE branch, then apply to production (adds ~1 day calendar time)

### 8.4 Claude's recommendation

**Apply mig 312 to production.** The exposure is real, the apply is reversible, and the statements are simple enough to audit from the decomposition. The belt-and-braces path (apply 258 to sandbox first) adds state divergence to sandbox for no risk-reduction benefit · the ELSE branch is just `ALTER TABLE` + `REVOKE` + `GRANT` statements that PostgreSQL executes atomically within the BEGIN/COMMIT transaction.

The next message to proceed is: `apply mig 312 production`.

---

## 9 · What this document does + does NOT do

### Does
- Document the current production state of the three billing tables (RLS off · anon+authenticated full grants · zero rows · no policies)
- Decompose mig 312 statement-by-statement so the owner can audit
- Confirm zero existing code paths depend on anon/authenticated billing access
- Document rollback characteristics including the defence-in-depth no-regrant posture
- Produce the post-apply verification plan (V-F1-T6a..h)
- Make Claude's recommendation (apply) with reasoning

### Does NOT
- Apply mig 312 to any environment
- Modify any file in the repository other than creating this doctrine
- Delete the temp preflight script (already deleted at end of inspection)
- Authorise G2 · the owner must send `apply mig 312 production` as a separate message

---

**End of Phase 1 G2 preflight evidence.**

No production changes made during preflight. Awaiting owner review + explicit `apply mig 312 production` message.
