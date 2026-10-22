# G1 PostgreSQL Concurrency Test Plan · T5a / T6a / T6b

**Status:** 📝 PLAN ONLY · owner-recorded 2026-10-22 · NOT EXECUTED
**Scope:** Reviewable plan for running the real-pg concurrency tests against an isolated disposable database.
**Blocker:** no owner-authorised disposable test DB currently available.

---

## 1 · Why structural tests do not suffice

The existing `migration-shape.test.ts` reads the migration SQL file as text and asserts the presence of columns, constraints, trigger function, and the SQL keywords `exclusion_violation` and `FOR UPDATE`. These checks catch **drift from the sealed design**. They do **NOT** prove any runtime behaviour:

| Structural check proves | Does NOT prove |
|---|---|
| SQL file contains `CHECK (business_trial_end_at = business_trial_start_at + interval '168 hours')` | PostgreSQL rejects inconsistent writes |
| SQL file contains `RAISE EXCEPTION ... exclusion_violation` | Trigger actually fires on competing UPDATEs |
| SQL file contains `BEFORE UPDATE ... FOR EACH ROW` | Trigger acquires locks correctly under concurrency |
| TypeScript service does `SELECT ... FOR UPDATE` | Row lock actually serialises concurrent transactions |
| Service UPDATE has conditional `WHERE business_trial_status IS NULL` | 0 rows affected is correctly interpreted as a race |

Only running T5a/T6a/T6b against a live Postgres instance with migration 214 applied proves the runtime invariants.

---

## 2 · Schema prerequisites for a working test DB

The test DB must have **minimum** schema sufficient to exercise:

### 2.1 · Minimum required columns on `nex_account`

Migration 214 adds columns to `nex_account` and references two pre-existing columns (`id` as FK target, `themes_trial_used_at` in trigger). The schema prerequisites are:

- `nex_account` table with:
  - `id uuid PRIMARY KEY` (needed by the FK on `nex_pilot_operator_audit.target_account_id` and for row-level locking)
  - `themes_trial_used_at timestamptz NULL` (migration 089 · needed by the trigger's Case A/B logic)
  - `display_name text NOT NULL` (migration 001 · the integration test's seed INSERT provides it)
  - `tier text NOT NULL DEFAULT 'gratis'` with CHECK (migration 046 · the integration test's seed INSERT provides it)
  - `themes_trial_package_id text NULL` (migration 089 · the integration test's `tryStartThemesTrial` sets it)
  - **No other columns are read or written by T5a/T6a/T6b.**

Everything else on `nex_account` from the 213 preceding migrations is **irrelevant** to this test. The required subset is small.

### 2.2 · Function dependencies

- `gen_random_uuid()` (needed by `nex_pilot_operator_audit.id DEFAULT`)
  - Standard Postgres extension `pgcrypto` OR built into Postgres 13+
- `now()` (standard Postgres)
- `interval '168 hours'`, `interval '24 hours'` (standard Postgres)

### 2.3 · Dependency graph for migration 214

Migration 214 depends on these columns being present:
- `nex_account.id` (001)
- `nex_account.themes_trial_used_at` (089)
- `nex_account.themes_trial_package_id` (089 · tested but not required for 214 ALTER)

Migration 214 does **NOT** depend on any columns added by migrations 2-88, 90-213 for its own ALTER TABLE / CREATE TABLE / CREATE FUNCTION operations. It only reads `themes_trial_used_at` inside the trigger function body.

---

## 3 · Three test-environment options (ranked)

### Option A · Minimal-fixture DB (RECOMMENDED · smallest scope)

Fresh Postgres instance · apply a MINIMAL fixture that creates only the schema needed · then apply migration 214.

**Minimal fixture SQL (would be checked in as `tests/fixtures/trial-concurrency-min-schema.sql`):**

```sql
-- Minimum schema to exercise migration 214 under concurrency.
-- Not an authoritative schema · ONLY the columns T5a/T6a/T6b read or write.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE nex_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  tier text NOT NULL DEFAULT 'gratis'
    CHECK (tier IN ('gratis','bisnis','pro')),
  bisnis_expires_at timestamptz,
  themes_trial_used_at timestamptz,
  themes_trial_package_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;

-- Then apply migration 214:
\i nex-supabase/migrations/214_nex_business_trial_system.sql
```

**Does this test the REAL migration?**

**YES.** Migration 214's SQL file is applied verbatim · same ALTER TABLE statements · same CHECK constraints · same trigger function · same table creation. The schema-prerequisite differences are inert for the test:
- No RLS policies in the fixture (fine · integration test uses service-role equivalent)
- No pre-existing data (fine · test seeds its own accounts)
- No other migrations' columns (fine · trigger only reads `themes_trial_used_at`)

**What this does NOT test:**
- Interaction of migration 214 with migrations 001-213 collectively (e.g. if some unrelated migration adds a constraint that conflicts with the trigger). Low risk: trigger operates only on specific columns.
- Behaviour against production data distribution.

**Pros:** fast setup · completely disposable · zero risk to any existing DB · tests the real migration SQL unchanged.

**Cons:** needs owner authorisation to create the fixture file + authorise running Postgres locally for the test.

### Option B · Dedicated full-schema sandbox DB

Spin up a fresh Postgres · apply all migrations 001-213 · apply 214.

**Pros:** tests migration 214 against the exact Supabase schema shape.

**Cons:** 
- 213 migrations to apply · many have external dependencies (RLS policies, seed data, Supabase extensions)
- Several migrations declared "AUTHORED · NOT YET APPLIED" status · they may not apply cleanly
- Hours of setup work · fragile · requires replicating Supabase extension state (pgcrypto, pg_cron, etc.)
- Owner authorisation + explicit disposability covenant required

### Option C · Supabase sandbox project

Create a new Supabase project (NOT `ijvqdvsvwtwxzcqmoqit`) · apply migrations 001-214.

**Pros:** closest to production.

**Cons:**
- Creates a new cloud resource with credentials
- Supabase pooler + REST + auth setup required
- Non-trivial billing/credential considerations
- Still requires explicit disposability covenant

---

## 4 · Recommended approach · Option A

Rationale:
- Minimal fixture tests the REAL migration SQL unchanged
- Trigger function depends only on `themes_trial_used_at` and `business_trial_status` · both present in fixture
- Row-level locking is a Postgres primitive · behaves identically regardless of other columns on the row
- Cleanup = `DROP DATABASE` · fully disposable

**Owner must authorise:**
1. Create `tests/fixtures/trial-concurrency-min-schema.sql` with the SQL above
2. Permit running a local Postgres container OR fresh database for the test
3. Confirm NOT to touch `nex_dev` or any shared DB

---

## 5 · Reproducible disposable setup plan

### 5.1 · Launch disposable Postgres

Using Docker (one-shot container · auto-deleted on exit):

```bash
docker run --rm --name nex-trial-test-pg \
  -e POSTGRES_PASSWORD=testonly \
  -e POSTGRES_DB=trial_concurrency_test \
  -p 55432:5432 \
  -d postgres:16-alpine
```

Alternative without Docker: `initdb` into a tempdir, `pg_ctl start` on a non-standard port, teardown with `pg_ctl stop` + `rm -rf`.

### 5.2 · Apply fixture + migration 214

```bash
PGPASSWORD=testonly psql -h localhost -p 55432 -U postgres -d trial_concurrency_test \
  -f tests/fixtures/trial-concurrency-min-schema.sql

PGPASSWORD=testonly psql -h localhost -p 55432 -U postgres -d trial_concurrency_test \
  -f nex-supabase/migrations/214_nex_business_trial_system.sql
```

Expected output: both files COMMIT without error. Migration 214's CHECK constraints evaluate TRUE on the empty table.

### 5.3 · Verify schema

```bash
PGPASSWORD=testonly psql -h localhost -p 55432 -U postgres -d trial_concurrency_test <<'SQL'
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'nex_account' AND column_name LIKE 'business_trial_%';
SELECT tgname FROM pg_trigger WHERE tgname = 'tr_nex_account_trial_coexistence';
SELECT COUNT(*) FROM nex_pilot_operator_audit;
SQL
```

Expected: 4 columns listed · trigger name present · audit table 0 rows.

### 5.4 · Run T5a / T6a / T6b

```bash
TRIAL_PG_TEST_URL="postgresql://postgres:testonly@localhost:55432/trial_concurrency_test" \
NEX_AUDIT_HASH_PEPPER="test-pepper-for-concurrency-tests-16plus" \
  npx vitest run src/lib/nex-native/business-trial/__tests__/concurrency.integration.test.ts
```

### 5.5 · Cleanup

```bash
docker stop nex-trial-test-pg  # auto-removes container (--rm)
# OR
pg_ctl stop -D $PGDATA && rm -rf $PGDATA
```

The test harness itself cleans up seeded accounts via `cleanupAccount(id)` in `afterAll`.

---

## 6 · Exact test commands and expected results

### T5a · 10 parallel `/trial/start` on same account

```
10 real pg clients fire concurrent business-trial activation attempts
```

**Expected (passing invariant):**
- exactly 1 result === "ok"
- exactly 9 results === "race" (0 rows affected under WHERE preconditions)
- Final `business_trial_status === 'active'` in exactly 1 account row

**Interpretation if failing:**
- 2+ "ok" results → S1 row lock not enforced · critical defect · migration or service bug
- 0 "ok" results → UPDATE WHERE clause rejecting all · precondition mismatch · service bug
- Unexpected `exclusion_violation` → trigger misfires on same-trial activation · trigger logic bug

### T6a · parallel `/trial/start` + `startThemesTrial` on same account

```
1 business-trial activation + 1 themes-trial activation fire concurrently
```

**Expected:**
- Exactly 1 result === "ok" · the other either "race" OR "trigger" (SQLSTATE 23P01)
- Final state has EITHER `business_trial_status === 'active'` XOR `themes_trial_used_at IS NOT NULL`

**Interpretation if failing:**
- Both "ok" → trigger failed to fire · S1 fail-safe broken · design-page §6 Case B logic bug
- Both failed → unlikely race where both see each other mid-commit · test bug or extremely tight race (should not happen under row lock)

### T6b · 50 iterations of T6a

```
Repeat T6a 50 times with fresh accounts
```

**Expected:** all 50 iterations produce exactly 1 success. Any iteration with 0 or 2+ successes = failing.

**Interpretation:** catches non-deterministic races that T6a's single run might miss by coincidence.

---

## 7 · What this plan does NOT cover

- Behaviour against the full 213-migration schema (needs Option B)
- Behaviour under Postgres replication / failover (needs multi-node)
- Behaviour under RLS policies (not applied by G1)
- Billing / Vault / tier-cascade concurrency (not G1 scope)

---

## 8 · Current state

- Test harness: ✅ written (`concurrency.integration.test.ts`) · 3 tests · gated on `TRIAL_PG_TEST_URL`
- Minimal fixture file: ❌ NOT written (requires owner authorisation to create)
- Disposable DB: ❌ NOT created (requires owner authorisation to run)
- Migration 214 execution: ❌ NOT applied anywhere

**No DB changed. No migration applied. Awaiting owner decision on Option A/B/C.**
