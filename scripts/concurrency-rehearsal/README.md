# NEX Shop concurrency · migration 281 · rehearsal harness

Owner-authorised 2026-11-07. **DISPOSABLE POSTGRES ONLY** · never
production. The harness creates a new database, applies migration 281,
runs the full test suite, then drops the database.

## Primary execution path · GitHub Actions CI (recommended)

Owner-authorised 2026-11-07 (Option 1). The rehearsal runs in CI against
an isolated, disposable `postgres:15` service container. No local
Postgres needed, no credentials required.

Trigger from the Actions tab → **Shop Concurrency Rehearsal (migration
281)** → **Run workflow**, OR push any change to `nex-supabase/
migrations/281_*`, `scripts/concurrency-rehearsal/**`, or the workflow
file itself.

The workflow is at `.github/workflows/concurrency-rehearsal.yml`.
See the orchestrator section below for what the 6 tests prove.

## Secondary execution path · local (if CI isn't available)

## Prerequisites

Any **local**, **disposable** Postgres instance you are willing to
create/drop databases on:

- Docker: `docker run --rm -d --name nex-rehearsal -e POSTGRES_PASSWORD=rehearsal -p 55432:5432 postgres:15`
- Native install: Postgres service on localhost with superuser creds you own.
- Postgres.app, Postgres on WSL, or similar.

Do NOT point this at Supabase, Neon, RDS, or any shared instance.
The harness issues `CREATE DATABASE` / `DROP DATABASE` and inserts
dummy rows.

## Running the full rehearsal

```bash
# 1. Export the superuser connection to a DISPOSABLE Postgres.
export NEX_REHEARSAL_PG_URL="postgresql://postgres:rehearsal@127.0.0.1:55432/postgres"

# 2. Run the orchestrator · creates nex_rehearsal_YYYYMMDD_HHMMSS, applies
#    migration 281, runs the concurrency + security + rollback tests,
#    then drops the database.
node scripts/concurrency-rehearsal/run-rehearsal.mjs
```

Expected successful run, abbreviated:

```
[probe] connected · Postgres 15.x on localhost
[setup] created disposable DB nex_rehearsal_20261107_091523
[setup] created minimal schema (nex_business, nex_account, nex_product)
[setup] seeded two businesses (biz-a, biz-b)
[apply] migration 281 applied in 12ms
[test:01] boundary · 20 concurrent at cap=50 count=49 → 1 OK + 19 check_violation
[test:02] cross-business parallel → both complete without serialisation
[test:03] missing business → foreign_key_violation (fail-closed)
[test:04] rollback · function dropped · rows unchanged
[test:05] re-apply · idempotent · OK
[test:06] security · authenticated role has no EXECUTE privilege
[cleanup] dropped disposable DB
PASSED
```

## Script inventory

| Script | Role |
|---|---|
| `00-probe-local-postgres.mjs` | Scan common local ports for an accessible Postgres · never touches data |
| `01-create-disposable-db.mjs` | Create a uniquely-named database for this rehearsal |
| `02-apply-minimal-schema.mjs` | Create `nex_business` + `nex_account` + `nex_product` with just the columns migration 281 touches |
| `03-apply-migration-281.mjs` | Apply the migration file verbatim |
| `04-boundary-concurrency-test.mjs` | 20 concurrent RPC calls at cap · exactly 1 succeeds |
| `05-cross-business-parallel-test.mjs` | Parallel calls to two businesses · neither serialises against the other |
| `06-security-tests.mjs` | Missing business · wrong role · parameter boundaries |
| `07-rollback-test.mjs` | Run the companion rollback file · verify function gone + rows intact |
| `08-reapply-idempotent.mjs` | Apply the migration a second time · verify `CREATE OR REPLACE` behaves |
| `99-drop-disposable-db.mjs` | Drop the rehearsal DB |
| `run-rehearsal.mjs` | Orchestrator · sequences the scripts above |

## Strict boundaries · what this harness will NOT do

- Will NOT read or write production Supabase (`ijvqdvsvwtwxzcqmoqit`).
- Will NOT use `NEX_POSTGRES_URL` or `DATABASE_URL` env vars (those
  point at production per `.env.local`). It uses `NEX_REHEARSAL_PG_URL`
  only. The orchestrator refuses to run if `NEX_REHEARSAL_PG_URL`
  looks like a Supabase hostname.
- Will NOT copy production data · the minimal schema is seeded with
  two generated business UUIDs and nothing else.
- Will NOT wire the RPC into the Node server actions · the app layer
  continues using the existing `shop-tier-guard.ts` path until a
  separate authorisation lands.
