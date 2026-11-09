# Phase 1 · Migration 313 · Production Preflight Evidence (G3 follow-up)
### 2026-11-09

**Author:** Claude Opus 4.7 · operating under owner-authorised narrow preflight scope.
**Scope:** 7 explicit preconditions the owner required before authorising mig 313 production apply. **Zero production changes made.** Zero data writes. Zero schema modifications. Apply script unchanged since prior commit.
**Gate ahead:** If this evidence is sound, a separate explicit `apply mig 313 production` owner message authorises the actual apply. Nothing in this document authorises that step.

---

## 0 · What mig 313 does + why

Closes the schema/code drift surfaced on 2026-11-09 after G3 mig 290 production apply:

- Live code (`security-rate-limit.ts`) declares **9** `SecurityRateLimitAction` values (round-11 2026-11-08 added `hq_admin_grant`)
- Mig 290 (sealed earlier that day) locked in a CHECK constraint with **8** values
- Post-mig-290 state on production: 8 of 9 actions now use distributed DB-backed rate-limit · `hq_admin_grant` continues per-lambda in-memory fallback because the DB CHECK rejects its writes
- Mig 313 is a forward-only CHECK widening that brings the DB in line with the code's 9-action registry

---

## Precondition 1 · production project reference

**✓ CONFIRMED** · `DATABASE_URL` resolves to project ref `ijvqdvsvwtwxzcqmoqit` (production).

Preflight output:
```
DATABASE_URL ref: ijvqdvsvwtwxzcqmoqit
✓ Production ref confirmed · ijvqdvsvwtwxzcqmoqit
```

---

## Precondition 2 · mig 313 SHA256 checksum

**✓ MATCH · file unchanged since previous preflight.**

| File | SHA256 | Bytes |
|---|---|---:|
| `nex-supabase/migrations/313_nex_security_rate_limit_hq_admin_grant.sql` | `73659350a3a20b967ae1cea1cd1ad2f05a91193cff6d36cf2c7dc2b11aee74e9` | 4,106 |
| Previously reported | `73659350a3a20b967ae1cea1cd1ad2f05a91193cff6d36cf2c7dc2b11aee74e9` | 4,106 |

Supporting checksums (for completeness · not required by owner's list):

| File | SHA256 |
|---|---|
| `nex-supabase/migrations/313_nex_security_rate_limit_hq_admin_grant.rollback.sql` | `c2e6db4664012cf85c3fe23f7381ddfb7fb6f5358ba3683b018f79e971a568fa` |
| `scripts/apply-migration-313-sandbox.mjs` | `4dd50733548c568aa94cdd0413143f2be1e397a09632bf038a25e86744960f02` |
| `scripts/apply-migration-313-production.mjs` | `6f35f9a4281b39f4de256dfcf622646a12bec8115f11d21387cfc4e1570b133b` |

---

## Precondition 3 · dependency guard on mig 290

**✓ CONFIRMED.**

- Header documentation explicitly states `Prerequisite · mig 290 must be applied`
- `DO $mig$` block contains guard that raises:
  ```
  v_mig_290_applied := EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '290');
  IF NOT v_mig_290_applied THEN
    RAISE EXCEPTION 'Prerequisite migration 290 not applied · apply 290 first.';
  END IF;
  ```
- Mig 290 is confirmed applied on production (2026-11-09 01:06:35 UTC per prior G3 report)

---

## Precondition 4 · scope of change

**✓ CONFIRMED · only the `ck_sec_rl_action` CHECK constraint is modified.**

Operations in the migration file (SQL comments stripped · parsed verbatim):

| Operation | Present | Expected? |
|---|---|---|
| `DROP CONSTRAINT IF EXISTS ck_sec_rl_action` | ✓ | Yes |
| `ADD CONSTRAINT ck_sec_rl_action CHECK (...)` (9 values) | ✓ | Yes |
| `COMMENT ON CONSTRAINT ck_sec_rl_action` | ✓ | Yes |
| `INSERT INTO nex_migration_history` | ✓ | Yes |
| `ALTER TABLE public.nex_security_rate_limit` (both statements target this ONE table) | ✓ | Yes · confirmed via direct grep |

**Operations EXPLICITLY NOT PRESENT** (verified via SQL parse · comments stripped):

- `CREATE TABLE` · not present
- `DROP TABLE` · not present
- `CREATE INDEX` / `DROP INDEX` · not present
- `CREATE POLICY` / `DROP POLICY` · not present
- `ENABLE ROW LEVEL SECURITY` / `DISABLE ROW LEVEL SECURITY` · not present
- Top-level `GRANT` or `REVOKE` · not present
- `INSERT` / `UPDATE` / `DELETE` on `nex_security_rate_limit` rows · not present
- `TRUNCATE` · not present

### Honest note on preflight regex noise

My preflight script's regex check `/ALTER TABLE\s+(?!public\.)?(?!nex_security_rate_limit)/i` emitted a false-positive `✗ UNEXPECTED op present · ALTER TABLE other-than nex_security_rate_limit`. This was a bug in my regex (two chained negative lookaheads that together did not correctly exclude `public.nex_security_rate_limit`). Direct grep confirms both `ALTER TABLE` statements in mig 313 target exclusively `public.nex_security_rate_limit`. No other table is touched.

---

## Precondition 5 · production state unchanged by mig 313

**✓ CONFIRMED · mig 313 is a CHECK-only change · does not touch rows, RLS, grants, policies, indexes, or any other table.**

Current production BEFORE snapshot (captured during this preflight):

```
nex_migration_history · mig 290 applied 2026-11-09 01:06:35 UTC
                        mig 313 not present
nex_security_rate_limit:
  rows                     : 0
  relrowsecurity           : true
  grants · anon            : EMPTY
  grants · authenticated   : EMPTY
  grants · service_role    : DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
  policies                 : none (default-deny · intended)
  indexes                  : idx_nex_security_rate_limit_window + nex_security_rate_limit_pkey
  ck_sec_rl_action         : 8-value CHECK (missing hq_admin_grant · closes on apply)
  action='hq_admin_grant' rows : 0 (rollback safety ok)
public-schema table count   : 127 (unchanged · mig 313 adds no tables)
```

### What changes on apply (precise)

- `ck_sec_rl_action` CHECK gains `'hq_admin_grant'` as a 9th allowed value
- `nex_migration_history` gains a row with version `'313'`

### What does NOT change on apply

- Rows in `nex_security_rate_limit`: unchanged (currently 0 · mig does not touch data)
- RLS state: unchanged (`relrowsecurity = true` stays true)
- Grants: unchanged (anon/authenticated remain empty · service_role grants preserved)
- Policies: unchanged (none)
- Indexes: unchanged (2 indexes preserved)
- Any other table: unchanged
- Any other migration's state: unchanged

---

## Precondition 6 · rollback procedure + effect

**✓ ROLLBACK CONFIRMED CORRECT.**

File: `nex-supabase/migrations/313_nex_security_rate_limit_hq_admin_grant.rollback.sql`

Rollback behaviour (post-apply):

| Step | Effect |
|---|---|
| Idempotency guard | `IF NOT v_mig_313_applied THEN RAISE EXCEPTION 'Migration 313 not applied · rollback has nothing to undo.'` · refuses if 313 is already absent |
| Safety guard | Counts rows with `action='hq_admin_grant'` · if > 0, `RAISE EXCEPTION 'Rollback refused · N hq_admin_grant row(s) present'` · prevents the restored 8-value CHECK from violating existing data |
| DROP CHECK | `ALTER TABLE public.nex_security_rate_limit DROP CONSTRAINT IF EXISTS ck_sec_rl_action` |
| ADD CHECK | Restores the pre-313 8-value list (`password_change`, `session_revoke`, `session_revoke_all`, `chat_message`, `account_create`, `webauthn_assert`, `webauthn_enroll`, `visitor_bootstrap`) · omits `hq_admin_grant` |
| DELETE ledger row | `DELETE FROM nex_migration_history WHERE version = '313'` |
| Data touched | None (no INSERT/UPDATE/DELETE on `nex_security_rate_limit` rows · no TRUNCATE) |

### Honest note on preflight regex noise

My preflight script emitted a line "Rollback OMITS hq_admin_grant from CHECK · false" · this was a false positive. The string `'hq_admin_grant'` DOES appear in the rollback file, but only in:
1. A SQL `--` comment explaining the safety guard
2. A `WHERE action = 'hq_admin_grant'` clause inside the safety guard (counts rows to decide whether rollback is safe)

**Neither occurrence is inside the restored CHECK constraint.** Direct grep confirms the restored CHECK has exactly 8 values · no `hq_admin_grant`. The rollback is correctly restoring the pre-313 state.

### Rollback compatibility with sealed invariant I-5

Mig 313 affects a CHECK on a rate-limit counter table · no private content involved · I-5 trivially satisfied.

### Rollback "no-touch" guarantee

If rollback runs when zero `hq_admin_grant` rows exist (the current and expected state · the pre-313 CHECK was rejecting these writes), rollback restores the pre-313 state cleanly. If `hq_admin_grant` rows somehow exist at rollback time (should not happen · but defensively covered), the rollback refuses and the operator gets a clear error.

---

## Precondition 7 · post-apply verification plan (V-F3-*)

When `apply mig 313 production` is authorised, the apply script will run inline + a supplementary read-only verify script will run the full matrix:

### V-F3 matrix (10 checks)

| # | Check | Method |
|---|---|---|
| **V-F3-T1** | `nex_migration_history` row for `'313'` present with `applied_at` populated | SQL via service-role pg client |
| **V-F3-T2** | `ck_sec_rl_action` CHECK contains ALL 9 expected actions (`password_change`, `session_revoke`, `session_revoke_all`, `chat_message`, `account_create`, `webauthn_assert`, `webauthn_enroll`, `visitor_bootstrap`, **`hq_admin_grant`**) | `pg_get_constraintdef` inspection |
| **V-F3-T3** | Service-role INSERT with `action='hq_admin_grant'` **SUCCEEDS** (transaction rolled back · zero production residue) | BEGIN · INSERT · SELECT · ROLLBACK |
| **V-F3-T4** | Service-role INSERT with each of the OTHER 8 actions still succeeds (regression protection · one representative INSERT each · all rolled back) | 8 × BEGIN · INSERT · ROLLBACK |
| **V-F3-T5** | `relrowsecurity = true` preserved (unchanged by mig 313) | `pg_class.relrowsecurity` |
| **V-F3-T6** | Grants unchanged: anon = EMPTY · authenticated = EMPTY · service_role still has SELECT/INSERT/UPDATE/DELETE | `information_schema.role_table_grants` |
| **V-F3-T7** | Indexes unchanged (still 2: `nex_security_rate_limit_pkey` + `idx_nex_security_rate_limit_window`) | `pg_indexes` |
| **V-F3-T8** | Policies unchanged (still zero · default-deny posture stays) | `pg_policies` |
| **V-F3-T9** | Public-schema table count unchanged (127 pre · 127 post · mig 313 adds no tables) | `information_schema.tables` |
| **V-F3-T10** | Anon-REST probe to `/rest/v1/nex_security_rate_limit?select=*&limit=5` still returns **HTTP 401 · PostgreSQL error 42501** (RLS + revokes unaffected by mig 313) | `fetch` with `NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY` |

### Will the apply script run all 10 inline?

Current `scripts/apply-migration-313-production.mjs` runs **V-F3-T1** + **V-F3-T2** inline. When authorisation lands, I will run a supplementary read-only verify script (pattern consistent with G2 mig 312) that covers **V-F3-T3 through V-F3-T10**.

Alternative · if the owner wants the apply script to run ALL 10 inline, I can enhance it before authorising apply (acknowledging this changes its SHA256). **I have not enhanced it** this turn to keep this preflight truly read-only.

---

## Summary · 7 preconditions

| # | Precondition | Status |
|---|---|---|
| 1 | Production project reference confirmed | ✓ `ijvqdvsvwtwxzcqmoqit` |
| 2 | Mig 313 SHA256 matches previously reported | ✓ `73659350…aee74e9` · file unchanged |
| 3 | Dependency guard requires mig 290 | ✓ header + `DO $mig$` guard confirmed |
| 4 | Changes ONLY the `ck_sec_rl_action` CHECK | ✓ confirmed · two false-positive regex hits explained in §4 |
| 5 | Does NOT alter rows, RLS, grants, policies, indexes, or unrelated tables | ✓ confirmed · BEFORE snapshot documented |
| 6 | Rollback procedure confirmed | ✓ restores pre-313 state · safety guard refuses if `hq_admin_grant` rows exist · one false-positive regex hit explained |
| 7 | Precise post-apply verification checks prepared | ✓ V-F3-T1 through V-F3-T10 defined |

**All 7 green.**

---

## Current Phase 1 production state summary

| Workstream | Prod state |
|---|---|
| G2 · mig 312 billing-RLS | **APPLIED · VERIFIED** 2026-11-09 00:43:35 UTC |
| G3 · mig 290 rate-limit infrastructure | **APPLIED · VERIFIED** 2026-11-09 01:06:35 UTC |
| G3 follow-up · mig 313 CHECK widening | **READY FOR APPLY · preflight green · awaiting explicit authorisation** |
| G4 · F-3 buyer checkout deploy | Code on branch · not deployed |
| Stripe webhook secret / platform approval | Owner-side workstream · outside Claude scope |

---

## What this document does + does NOT do

### Does
- Confirm 7 preconditions with evidence
- Document the exact post-apply V-F3-T1..T10 verification plan
- Honestly explain two preflight regex false positives
- Capture the production BEFORE snapshot

### Does NOT
- Apply mig 313 to production
- Modify any migration file or apply script
- Deploy any code
- Change Stripe configuration
- Perform any other production action
- Authorise the apply · owner must send explicit `apply mig 313 production`

---

**End of Phase 1 G3-follow-up mig 313 preflight evidence.**

No production changes made during preflight. Awaiting owner review + explicit `apply mig 313 production` message.
