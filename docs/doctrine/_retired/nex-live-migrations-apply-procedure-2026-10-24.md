# NEX Live Migrations · Sandbox Apply Procedure

**Status: PROCEDURE AUTHORED · NOT APPLIED · NOT PRODUCTION-APPROVED.**
**Date: 2026-10-24. Author: continuation of the G1+G2 build.**

Scope: migrations 216 / 217 / 218 / 219, authored under the NEX Live & Commerce
plan. All four are present in `nex-supabase/migrations/` and all four carry an
explicit "NOT YET APPLIED" header + rollback block.

This document captures the **exact procedure a human operator must run** on an
isolated sandbox database. It does not grant authorisation to connect to the
sealed production project `ijvqdvsvwtwxzcqmoqit`. It is reference material for a
future authorised apply window.

---

## 0 · Prerequisites

Before any `supabase migration up` or `psql -f` command runs:

1. **A sandbox database exists** that is physically distinct from
   `ijvqdvsvwtwxzcqmoqit`. Two acceptable options:
   - A local Docker-backed Supabase project: `supabase start` from the repo
     root (requires Docker Desktop to be running on Windows). Confirm with
     `supabase status` that the project ref printed is NOT
     `ijvqdvsvwtwxzcqmoqit`.
   - A dedicated non-production Supabase cloud project. The project URL
     and ref MUST differ from the sealed production ref.
2. **The sandbox has migrations 001–215 applied** cleanly. Verify with:
   ```sql
   SELECT version FROM nex_migration_history ORDER BY version::int;
   ```
   The max version should be `215` and no gaps. If 214 is missing but 215
   is present, STOP and reconcile — the Discovery Signal history must be
   intact before 216 adds enum values.
3. **The owner has authorised the apply window for THIS specific sandbox.**
   Blanket "please apply migrations" is not acceptable authorisation.
   Required: project ref, apply timestamp, authorised test matrix.

Snapshot capture before any apply:
```sql
-- Record the pre-apply schema fingerprint for comparison / audit.
SELECT 'session', count(*) FROM pg_policies WHERE tablename = 'nex_live_session'
UNION ALL SELECT 'post',    count(*) FROM pg_policies WHERE tablename = 'nex_live_post'
UNION ALL SELECT 'message', count(*) FROM pg_policies WHERE tablename = 'nex_peer_message'
UNION ALL SELECT 'conv',    count(*) FROM pg_policies WHERE tablename = 'nex_peer_conversation';
```

---

## 1 · Apply sequence (strict numeric order)

Each statement is run against the **sandbox** connection string only.

### 1.1 · Migration 216 — additive enum values

```bash
psql "$SANDBOX_DATABASE_URL" -f nex-supabase/migrations/216_nex_discovery_signal_add_enquiry_cart_signals.sql
```

Expected result:
- Two `ALTER TYPE ... ADD VALUE IF NOT EXISTS` statements succeed.
- `SELECT unnest(enum_range(NULL::nex.discovery_signal_type))` lists:
  `cart_sent, chat_open, dismiss, enquiry_initiated, save, tap, view`.

Rollback: manual DROP TYPE + recreate (not scripted — enums are
additive-only in Postgres). This step rarely needs rollback since the
new values are harmless if emitters never populate them.

### 1.2 · Migration 217 — RLS helper hardening

```bash
psql "$SANDBOX_DATABASE_URL" -f nex-supabase/migrations/217_nex_rls_helper_search_path_harden.sql
```

Expected result:
- `pg_proc.proconfig` for the four Migration 010 helpers now shows
  `{search_path=pg_catalog, public}`.
- `nex_migration_history` has a row with version `217`.

Rollback (if needed, see the file's inline rollback block):
```sql
BEGIN;
  ALTER FUNCTION nex_current_account_ids() RESET search_path;
  ALTER FUNCTION nex_current_owned_business_ids() RESET search_path;
  ALTER FUNCTION nex_current_participant_conversation_ids() RESET search_path;
  ALTER FUNCTION nex_conversations_of_my_businesses() RESET search_path;
  DELETE FROM nex_migration_history WHERE version = '217';
COMMIT;
```

### 1.3 · Migration 218 — peer_message + live_post RLS harden

```bash
psql "$SANDBOX_DATABASE_URL" -f nex-supabase/migrations/218_nex_rls_harden_peer_message_and_live_post.sql
```

Expected result:
- 6 Migration 047 policies on `nex_peer_message` / `nex_peer_conversation`
  are replaced with helper-anchored policies (`nex_current_account_ids()`
  / `nex_current_participant_conversation_ids()`) that include
  `TO authenticated`.
- 3 new policies appear on `nex_live_post`:
  `nex_live_post_public_select`, `nex_live_post_owner_insert`,
  `nex_live_post_owner_update` (NO delete policy — hard-delete remains
  service-role only per doctrine D3).
- `nex_peer_message_immutability_guard` trigger exists and executes
  `nex_peer_message_enforce_immutability()` (SECURITY DEFINER with
  pinned search_path).
- Trigger name sorts before Migration 125's
  `nex_peer_message_link_preview_delete_trigger` (`'i' < 'l'`) — assert
  via `SELECT tgname FROM pg_trigger WHERE tgrelid =
  'nex_peer_message'::regclass ORDER BY tgname`.

**T1–T36 real-DB test matrix** is defined in
`nex-supabase/migrations/__tests__/g1-rls-harden-217-218.test.ts` as
`it.skip` tests. On an applied sandbox, convert selected `it.skip`
blocks to `it` and run against the sandbox connection string. The test
file uses `renderToStaticMarkup`-style SQL assertions · it does NOT
require a live Supabase client · each test issues its own SET SESSION
AUTHORIZATION or auth cookie.

Rollback: see the inline rollback block at the bottom of the SQL file.
Restores Migration 047 policies verbatim. Zero data touched.

### 1.4 · Migration 219 — live session + featured product tables

```bash
psql "$SANDBOX_DATABASE_URL" -f nex-supabase/migrations/219_nex_live_session_and_featured_product.sql
```

Expected result:
- Two new tables: `nex_live_session`, `nex_live_featured_product`.
- Partial unique indexes:
  - `uq_nex_live_session_one_open_per_broadcaster` (WHERE status='open')
  - `uq_nex_live_featured_product_one_active_per_session`
    (WHERE ended_featuring_at IS NULL)
- 7 RLS policies total (3 on `nex_live_session`, 4 on
  `nex_live_featured_product`). No DELETE policies.
- `nex_migration_history` has a row with version `219`.

Rollback: `DROP TABLE IF EXISTS nex_live_featured_product; DROP TABLE
IF EXISTS nex_live_session;` + delete migration history row. Pure DDL;
no data retention risk because no production data has been written yet.

---

## 2 · Post-apply verification matrix

On the sandbox, after all four migrations have landed:

### 2.1 · Enum sanity
```sql
SELECT unnest(enum_range(NULL::nex.discovery_signal_type));
-- Expect 7 rows including enquiry_initiated and cart_sent.
```

### 2.2 · Helper search_path pin
```sql
SELECT proname, proconfig FROM pg_proc
 WHERE proname IN (
   'nex_current_account_ids',
   'nex_current_owned_business_ids',
   'nex_current_participant_conversation_ids',
   'nex_conversations_of_my_businesses'
 );
-- Each proconfig should include search_path=pg_catalog, public.
```

### 2.3 · Policy fingerprint
```sql
SELECT tablename, policyname, cmd
  FROM pg_policies
 WHERE tablename IN ('nex_peer_message', 'nex_peer_conversation',
                     'nex_live_post', 'nex_live_session',
                     'nex_live_featured_product')
 ORDER BY tablename, policyname;
```
Each row should match the expected set documented inline in migration 218
(Parts A/B/C) and migration 219 (Part B).

### 2.4 · Immutability trigger
```sql
SELECT tgname FROM pg_trigger WHERE tgrelid = 'nex_peer_message'::regclass
 ORDER BY tgname;
-- Expected order: nex_peer_message_immutability_guard,
--                 nex_peer_message_link_preview_delete_trigger
```
Alphabetical ordering is load-bearing — if `_link_preview_delete_trigger`
sorts before the immutability trigger, R12 is violated and 218 must be
rolled back.

### 2.5 · Partial index semantics
```sql
INSERT INTO nex_live_session (broadcaster_account_id, status)
VALUES ('<test-account>', 'open');
-- A second INSERT with the same account + status='open' MUST fail with
-- 23505 unique_violation referencing uq_nex_live_session_one_open_per_broadcaster.
```

### 2.6 · RLS behaviour (auth-shaped)
Run the T1–T36 test harness in `g1-rls-harden-217-218.test.ts` with
real Supabase auth cookies in place of the mocked ones. All 36 tests
should pass. Any failure must block promotion to production.

---

## 3 · Promotion to production (requires separate explicit authorisation)

Not covered by this document. The production project
`ijvqdvsvwtwxzcqmoqit` is the sealed single source of truth per
`CLAUDE.md § 8`. The authorised production apply window must be a
separate decision anchored to:

- A clean apply + full test matrix in the sandbox.
- Owner-approved offline window if the migration locks tables.
- A documented rollback drill rehearsed on the sandbox FIRST.
- The out-of-repo Realtime subscription inventory for
  `nex_peer_message` / `nex_peer_conversation` / `nex_live_post`
  (F6 note in Migration 218).

Nothing in this document is production authorisation.

---

## 4 · Non-claims

- This document does NOT prove the migrations apply cleanly against any
  database.
- This document does NOT prove the policies enforce the intended
  identity scope under real auth.
- This document does NOT prove the partial indexes catch concurrent
  inserts under load.
- All three claims require sandbox application of the authored
  migrations by an authorised operator.
