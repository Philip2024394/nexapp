# NEX Live · Sandbox Pre-Apply Report · 2026-10-24

**Status: PRE-APPLY REPORT · NO MIGRATIONS APPLIED · NO DB CONNECTION ATTEMPTED.**
**Owner authorisation to apply remains REQUIRED after this report is reviewed.**

---

## 1 · Target environment

**Current state on this host:**
- `docker` CLI: NOT reachable from the dev shell (`command not found`).
- Docker Desktop: NOT running (confirmed by `supabase status` error:
  "the docker client must be run with elevated privileges to connect").
- Supabase CLI: installed, version `2.75.0` at `/c/Users/Victus/bin/supabase`.
- Local Supabase project directory: `nex-supabase/` exists in the repo.

**Owner must choose ONE of two targets:**

### Option A · Local Docker-backed Supabase
Owner starts Docker Desktop manually (requires Windows admin privileges).
Then from the repo root: `supabase start`. The CLI prints a local
project URL and anon key. Target is confirmed non-production because
the project ref printed by `supabase status` will be a local-only
identifier, NOT `ijvqdvsvwtwxzcqmoqit`.

### Option B · Dedicated non-production Supabase cloud project
Owner provisions a brand-new Supabase project at supabase.com with a
distinct project ref. Owner supplies the project URL + service-role
key to this environment via `.env.local` entries. Target is confirmed
non-production via the project ref NOT equalling `ijvqdvsvwtwxzcqmoqit`.

**NEITHER option proceeds without owner-provided confirmation that
the resulting target is isolated from production.**

---

## 2 · Migration apply order · 216 → 217 → 218 → 219 → 220 → 221 → 222

| # | File | Depends on | Purpose |
|---|---|---|---|
| 216 | `216_nex_discovery_signal_add_enquiry_cart_signals.sql` | 208 | Add `enquiry_initiated` + `cart_sent` enum values |
| 217 | `217_nex_rls_helper_search_path_harden.sql` | 010 | Pin `search_path = pg_catalog, public` on 4 helpers |
| 218 | `218_nex_rls_harden_peer_message_and_live_post.sql` | 010, 047, 125, 217 | R1+R2+R11+R12 RLS repair + immutability trigger |
| 219 | `219_nex_live_session_and_featured_product.sql` | 001, 002, 010 | Live session + featured product tables |
| 220 | `220_nex_friend_request_intro_note.sql` | 215 | Add `intro_note text CHECK(len ≤ 280)` column |
| 221 | `221_nex_live_participation.sql` | 010, 217, 219 | Shop Contacts participation ledger |
| 222 | `222_nex_live_engagement.sql` | 010, 217, 219, 221 | Transient engagement log (session end aggregates to 221) |

**Order rationale:**
- 216 is independent (additive enum).
- 217 must land before 218 (218 uses the hardened helpers).
- 218 depends on 047 + 125 which are production-applied.
- 219 is independent of 218 but both must land before 221 + 222.
- 220 is independent of 219 (touches `nex_friend_request` from 215).
- 221 must land before 222 (222 CASCADEs from 221 via FK to
  `nex_live_session`, aggregator writes into 221).

**Strict numeric order is safe:** no two migrations depend in
reverse order, and the ordering matches the migration file prefix
numbers.

---

## 3 · Pre-apply verification checklist (operator runs against the SANDBOX)

Each of these must be captured BEFORE apply, in a run log the owner
reviews.

### 3.1 · Confirm target is not production
```sql
SELECT current_database(), inet_server_addr();
-- Expected: non-prod DB name · a localhost or sandbox IP.
```
```sql
SELECT value FROM pg_settings WHERE name = 'server_version';
-- Record version for compatibility (217 pins search_path on 15+).
```

### 3.2 · Migration history baseline
```sql
SELECT max(version::int) AS last_applied
  FROM nex_migration_history;
-- Expected: >= 215 (sandbox must have the prior migrations applied).
-- If < 215, STOP and apply the gap first (not this pass's scope).
```
```sql
SELECT version
  FROM nex_migration_history
 WHERE version::int IN (216, 217, 218, 219, 220, 221, 222);
-- Expected: zero rows (none of our migrations are yet applied).
-- If any row returns, STOP · partial state must be reconciled first.
```

### 3.3 · Schema fingerprint (compare before + after apply)
```sql
-- Policy counts on the tables migrations 218/219/221/222 touch.
SELECT tablename, count(*) AS policy_count
  FROM pg_policies
 WHERE tablename IN (
   'nex_peer_message', 'nex_peer_conversation', 'nex_live_post',
   'nex_live_session', 'nex_live_featured_product',
   'nex_live_participation', 'nex_live_engagement'
 )
 GROUP BY tablename
 ORDER BY tablename;

-- Trigger inventory on nex_peer_message (218 adds immutability guard).
SELECT tgname
  FROM pg_trigger
 WHERE tgrelid = 'nex_peer_message'::regclass
   AND NOT tgisinternal
 ORDER BY tgname;
-- Expected pre-apply: only Migration 125's link_preview_delete trigger.
-- Expected post-218 apply: immutability_guard first (alpha order),
--   then link_preview_delete_trigger second.

-- Helper function search_path pins (217 target).
SELECT proname, proconfig FROM pg_proc
 WHERE proname IN (
   'nex_current_account_ids',
   'nex_current_owned_business_ids',
   'nex_current_participant_conversation_ids',
   'nex_conversations_of_my_businesses'
 );
-- Expected pre-apply: proconfig is NULL (unpinned).
-- Expected post-217 apply: proconfig includes search_path=pg_catalog,public.

-- Enum members (216 target).
SELECT unnest(enum_range(NULL::nex.discovery_signal_type));
-- Expected post-216 apply: cart_sent, chat_open, dismiss,
--   enquiry_initiated, save, tap, view · 7 values total.

-- Column presence (220 target).
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'nex_friend_request'
   AND column_name = 'intro_note';
-- Expected pre-apply: 0 rows · post-apply: 1 row.
```

### 3.4 · Capture a snapshot of nex_migration_history
```sql
\copy (SELECT * FROM nex_migration_history ORDER BY version::int)
  TO 'nex_migration_history_pre_apply.csv' CSV HEADER;
```

---

## 4 · Rollback plan (per migration · ready in each file)

Each migration file carries its own rollback block as inline SQL
comments. The sequence to reverse is **strict reverse order**:
222 → 221 → 220 → 219 → 218 → 217 → 216.

- **222** · `DROP TABLE IF EXISTS nex_live_engagement CASCADE;` +
  delete 222 from `nex_migration_history`.
- **221** · `DROP TABLE IF EXISTS nex_live_participation CASCADE;` +
  delete 221.
- **220** · `ALTER TABLE nex_friend_request DROP COLUMN IF EXISTS
  intro_note;` + delete 220.
- **219** · `DROP TABLE IF EXISTS nex_live_featured_product;` +
  `DROP TABLE IF EXISTS nex_live_session;` + delete 219.
- **218** · Explicit rollback block in file (restores Migration 047
  policies verbatim · drops the 3 new nex_live_post policies · drops
  the immutability trigger + function) + delete 218.
- **217** · `ALTER FUNCTION … RESET search_path` on all 4 helpers +
  delete 217.
- **216** · Manual DROP TYPE + recreate (ENUM values are additive-only
  in Postgres; dropping values is a reconstruction operation).

Each rollback runs inside its own `BEGIN; … COMMIT;` block.

---

## 5 · Apply command for the authorised sandbox window

For a dev with the `supabase` CLI pointed at the SANDBOX:
```bash
# Pre-flight · from repo root
supabase status | head -5          # confirms non-prod project ref
export SANDBOX_DATABASE_URL="postgresql://…"  # owner-supplied

# Pre-apply snapshot · capture in a run log
psql "$SANDBOX_DATABASE_URL" -c "SELECT max(version::int) FROM nex_migration_history;"
psql "$SANDBOX_DATABASE_URL" -c "SELECT * FROM pg_policies WHERE tablename IN ('nex_peer_message','nex_live_session') ORDER BY tablename;" > pre-apply-policies.txt

# Apply in strict order
for m in 216 217 218 219 220 221 222; do
  psql "$SANDBOX_DATABASE_URL" -v ON_ERROR_STOP=1 \
    -f nex-supabase/migrations/${m}_*.sql
done

# Post-apply verification
psql "$SANDBOX_DATABASE_URL" -c "SELECT version FROM nex_migration_history WHERE version::int BETWEEN 216 AND 222 ORDER BY version::int;"
# Expected: 216 217 218 219 220 221 222 · exactly 7 rows.
```

**The authorised sandbox window is NOT this environment.** This
report is a procedure document only.

---

## 6 · Explicit non-claims

- This document does NOT claim any migration has been applied.
- This document does NOT claim the sandbox has been provisioned.
- This document does NOT connect to any database.
- The pre-apply snapshot queries are READ-ONLY in principle, but
  running them is also an owner-decision moment · they REQUIRE a
  non-production connection string.
- Rollback drills must be rehearsed on the sandbox BEFORE any
  production apply window is scheduled (production is a separate
  owner-decision track per CLAUDE.md § 8).
