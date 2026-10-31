# NEX · Migration 244 Rollback · Role-Security Evidence · 2026-10-31

**Purpose**: evidence pack for owner W-2 round-3 safeguard — demonstrate that the Migration 244 destructive rollback cannot be invoked by an ordinary application role (`authenticated`, `anon`) or any non-platform role, even if that role could somehow set the GUC `app.allow_244_destructive_rollback='yes-i-have-no-data'`.
**Status**: evidence doc · no apply.
**Owner directive verbatim (W-2)**: *"The custom GUC setting app.allow_244_destructive_rollback must NOT be treated as sufficient authorisation by itself. Require an explicit privileged database-role check as well as the setting and zero-data condition. Demonstrate that ordinary application and authenticated roles cannot execute the destructive path."*

---

## 1 · Updated rollback file includes a role check

**File**: `nex-supabase/migrations/244_nex_country_column.rollback.sql`
**Change**: Phase 2A and Phase 2B DO blocks now include a Guard 0 that reads `session_user` and refuses unless it is `postgres` or `supabase_admin`.

### Phase 2A guard sequence (abbreviated)

```sql
DO $$
DECLARE
  guard_setting text;
  populated_count bigint;
  session_role text;
BEGIN
  -- Guard 0 · privileged role (W-2 safeguard 2026-10-31)
  session_role := session_user;
  IF session_role NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION
      'Migration 244 destructive rollback REFUSED · session_user is % · must be one of (postgres, supabase_admin). GUC alone is NOT sufficient authorisation.',
      session_role;
  END IF;

  -- Guard 1 · explicit permission string (unchanged)
  …

  -- Guard 2 · no populated country values (unchanged)
  …

  -- All three guards passed → DROP COLUMN block runs
END $$;
```

Phase 2B has the identical Guard 0 at the top of its DO block.

---

## 2 · Why `session_user` and not `current_user`

`session_user` reflects the role of the originating connection. It cannot be changed by `SET ROLE`, `SET LOCAL`, `SECURITY DEFINER`, or any session-level manipulation. It is the authoritative identity of who connected.

`current_user` reflects the effective role, which can be flipped by `SET ROLE` or by `SECURITY DEFINER` functions. Using `current_user` would allow a role that is `authenticated` to call `SET ROLE postgres` (if it had the privilege; by default it does not) and bypass the check.

By using `session_user`, Guard 0 is immune to role switching inside the session.

---

## 3 · Supabase role topology (verification context)

Supabase projects expose a layered role model. For `ijvqdvsvwtwxzcqmoqit` the relevant roles are:

| Role | Purpose | Can hit storage.sql or run `ALTER TABLE`? |
|---|---|---|
| `postgres` | Platform superuser · owner of migrations | ✅ |
| `supabase_admin` | Supabase-managed platform role · can perform admin ops | ✅ (project-admin level) |
| `authenticator` | The role Postgrest connects as; it then `SET ROLE`s to the request's role | ❌ (cannot ALTER TABLE) |
| `service_role` | The server-side-only API role (via `NEX_SUPABASE_SERVICE_ROLE_KEY`) | ⚠️ bypasses RLS, but ALTER TABLE is denied by default |
| `authenticated` | Logged-in app user | ❌ |
| `anon` | Anonymous API caller | ❌ |

Only `postgres` and `supabase_admin` possess the privilege to `ALTER TABLE ... DROP COLUMN` on public schema tables. Even without Guard 0, `authenticated` and `anon` would receive `permission denied` from Postgres on the DROP COLUMN statement itself.

Guard 0 is defence-in-depth: it fails earlier (with a documented message) and does not depend on the schema-privilege model being correctly configured.

---

## 4 · Demonstration · what happens if each role tries the rollback

### 4a · `authenticated` role attempts Phase 2A

```sql
SET LOCAL app.allow_244_destructive_rollback = 'yes-i-have-no-data';
DO $$
BEGIN
  session_role := session_user;  -- 'authenticated'
  IF session_role NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Migration 244 destructive rollback REFUSED · session_user is authenticated · must be one of (postgres, supabase_admin). GUC alone is NOT sufficient authorisation.';
  END IF;
  …
END $$;
```

Expected outcome: Guard 0 raises. Transaction aborts. Country columns unchanged.

If Guard 0 did not exist, the next statement would be:
```sql
ALTER TABLE public.nex_business DROP COLUMN IF EXISTS country;
```
Postgres privilege check runs. `authenticated` role lacks `ALTER TABLE` on `public.nex_business` (default Supabase setup). Second-level deny.

Both layers independently refuse.

### 4b · `anon` role attempts Phase 2A

Identical to `authenticated`: `session_user` is `anon`, Guard 0 raises. Even without Guard 0, no DDL privilege.

### 4c · `service_role` attempts Phase 2A

`session_user` is `service_role`. Guard 0 raises.

`service_role` bypasses RLS by design (bypassrls = true on that role). It does NOT have ALTER TABLE privilege by default in Supabase; the default role has permissions to read/write data in `public.*` but not DDL. Guard 0 is the primary line of defence against an operator mistakenly using the service-role key to attempt a destructive drop.

### 4d · `postgres` attempts Phase 2A, GUC not set

`session_user` is `postgres`. Guard 0 passes.
Guard 1 reads `current_setting('app.allow_244_destructive_rollback', true)` → NULL (unset).
Guard 1 raises: *"setting is <unset> · must equal literal 'yes-i-have-no-data'"*.
Transaction aborts.

### 4e · `postgres` attempts Phase 2A, GUC set, data exists

Guard 0 passes. Guard 1 passes. Guard 2 counts populated rows across 4 anchors. If > 0, Guard 2 raises: *"% populated country rows exist · use Phase 2B"*.
Transaction aborts.

### 4f · `postgres` attempts Phase 2A, GUC set, 0 populated rows

All three guards pass. DROP COLUMN executes. Rollback completes.

### 4g · `postgres` attempts Phase 2B, no GUC

Guard 0 passes. Phase 2B's Guard 1 reads `app.allow_244_preserving_rollback` → unset → raises.

### 4h · `postgres` attempts Phase 2B, correct GUC, data exists

Guard 0 + Guard 1 pass. Snapshot table `nex_country_rollback_244` is created (service_role-only · RLS FORCEd · no authenticated policies). Snapshot is populated. DROP COLUMN executes. Forward-recovery route preserved.

---

## 5 · Manual verification matrix

To be run against a sandbox AFTER 244 has been applied (and optionally after 246 to test the data-present branches):

| # | Role used | GUC set? | Data present? | Expected outcome |
|---|---|---|---|---|
| V-1 | `authenticated` | yes | 0 rows | Guard 0 raises (role) |
| V-2 | `anon`          | no  | 0 rows | Guard 0 raises (role) |
| V-3 | `service_role`  | yes | 0 rows | Guard 0 raises (role) |
| V-4 | `postgres`      | no  | 0 rows | Guard 1 raises (GUC) |
| V-5 | `postgres`      | yes | 100 rows | Guard 2 raises (data) → use 2B |
| V-6 | `postgres`      | yes | 0 rows | SUCCEEDS · columns dropped |
| V-7 | `postgres`      | yes (Phase 2B) | 100 rows | SUCCEEDS · snapshot + drop |
| V-8 | `supabase_admin` | yes | 0 rows | SUCCEEDS (equivalent to V-6) |

Rows V-1..V-4 and V-5 all preserve the column schema.

---

## 6 · Known limitation · operator discretion still required

Guard 0 is a technical check inside a DO block. It cannot prevent a privileged operator with `postgres` credentials from running the Phase 2A path. The owner-authorisation signal (naming the file in writing) is a procedural layer sitting outside Postgres; it is not a technical control.

The guards jointly ensure:
- Ordinary application/authenticated roles cannot execute the destructive path (role check + schema privileges).
- Service_role (which bypasses RLS) cannot execute it either (role check).
- `postgres`/`supabase_admin` can execute it ONLY after setting the GUC AND having 0 populated rows (Phase 2A) OR AND running Phase 2B.
- A `postgres` operator who runs 2A on a populated DB is refused by Guard 2 (data presence).
- A `postgres` operator who sets the GUC but then runs on a different connection without setting it again is refused by Guard 1 (`SET LOCAL` doesn't persist across connections).

The combination is strong defence-in-depth. Owner-level authorisation remains the first and most important gate; the technical guards are the second.

---

*Evidence pack 2026-10-31. No code · no migration applied. Returns owner W-2 round-3 verification.*
