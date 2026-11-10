# Batch A · Pre-Activation Security Review · 2026-11-10

**Owner-authorised cycle 8 review.** Covers mig 290 + 293 + 295 + the
`nex-peer-chat-ciphertext` bucket. Non-destructive · read-only ·
NO migration applied · NO bucket created · NO push.

## Verdict · **NO-GO**

Do NOT send the `AUTHORISE SANDBOX BATCH A · APPLY 290 293 295 ·
CREATE CIPHERTEXT BUCKET` phrase yet. Three concrete defects block
safe activation. All three are fixable locally and listed below.

## Summary

| Item | Verdict | Blocker? |
|---|---|---|
| Mig 290 schema + rollback + grants | ✅ Clean | — |
| Mig 290 service caller shape | ✅ Clean | — |
| **Mig 291 (required for atomic claim RPC)** | 🚨 **Duplicate files** | **BLOCKER 1** |
| **Mig 292 (audit log table) not in Batch A** | 🚨 **293 depends on 292** | **BLOCKER 2** |
| Mig 293 RPC body + grants | ✅ Clean | — |
| Mig 293 missing rollback block in file | ⚠️ Cosmetic | not blocking |
| **Mig 294 (audit erase_actor) — Batch A scope** | ⚠️ **Scope question** | **BLOCKER 3** |
| Mig 295 RLS policies | ✅ Clean · defence-in-depth | — |
| Mig 295 bucket creation step | ✅ Documented in file header | — |
| Mig 295 rollback not in file | ⚠️ Cosmetic | not blocking |
| Ciphertext path · no public fallback | ✅ Proven in cycle 7 agent output | — |
| Ciphertext upload route | ✅ Session + participant-gated | — |
| Plaintext exposure in any Batch A mig | ✅ None | — |
| Legacy data destroyed by any Batch A mig | ✅ None | — |

---

## BLOCKER 1 · Duplicate migration 291 files

Two migrations share the number `291`:

```
nex-supabase/migrations/291_nex_security_rate_limit_claim.sql           (186 lines · "owner-sealed 2026-11-08")
nex-supabase/migrations/291_nex_security_rate_limit_claim_rpc.sql       (178 lines · "DRAFT · 2026-11-09")
```

Both define the SAME function (`nex_security_rate_limit_claim`) with
different authoring dates. If the apply pipeline runs every `291_*.sql`
file in lexical order, the second CREATE OR REPLACE would silently
overwrite the first · OR fail if signatures differ.

**Risk**: inconsistent / unpredictable function body in production
depending on apply order.

**Comparable precedent**: migrations 243, 244, 245 are handled with
`.SUPERSEDED.sql` / `.SUPERSEDED-REISSUED.sql` suffixes — the
pipeline skips them.

**Owner decision needed**: which file is canonical?

Recommended fix (owner must confirm BEFORE I apply it):
- If `_claim_rpc.sql` (2026-11-09) is canonical: rename
  `291_nex_security_rate_limit_claim.sql` →
  `291_nex_security_rate_limit_claim.SUPERSEDED.sql` + same for the
  rollback file.
- If `_claim.sql` (2026-11-08) is canonical: inverse.

**I will NOT rename either file without owner authorisation** (cycle 7
safeguard: no destructive legacy action).

### Dependency implication

Batch A as owner-named (`290 293 295`) is **missing mig 291**
entirely. The rate-limit service in `security-rate-limit.ts` prefers
the atomic RPC path:

```
src/lib/nex-native/security-rate-limit.ts:608 → nex_security_rate_limit_claim RPC
```

The service documents a graceful fallback to "2-phase read-then-upsert"
when the RPC is absent · but the fallback has a sealed "cold-bucket
race present" warning on line 627. Applying mig 290 alone leaves that
race live. For a complete Batch A, mig 291 (canonical version) must
be included.

---

## BLOCKER 2 · Mig 293 depends on mig 292 (not in Batch A)

`nex-supabase/migrations/293_nex_security_audit_reconcile.sql` line 7:
> `STATUS: AUTHORED · NOT YET APPLIED. Depends on migration 292.`

Mig 293's SQL reads from `nex_security_audit_log` + writes to
`nex_security_audit_reconciliation`. Both tables are created by
mig 292.

Applying mig 293 without mig 292 first → immediate `relation does not
exist` error in both functions.

Batch A **must include mig 292** to be coherent. Current scope of
`290 293 295` is incomplete.

### What's in mig 292 (relevant to the batch)

Three new tables:
- `nex_security_audit_log` · append-only audit trail · INSERT + SELECT
  granted to service_role · UPDATE/DELETE/TRUNCATE revoked at the DB
  permission layer (NOT only RLS) · pruning path is a SECURITY DEFINER
  function (mig 294).
- `nex_security_audit_retention` · retention policy table.
- `nex_security_audit_reconciliation` · referenced by mig 293.

Also has its own `.rollback.sql` file (`292_nex_security_audit_log.rollback.sql`).

### Caller trace for mig 292

```
src/lib/nex-native/security-audit-service.ts  → appends to nex_security_audit_log
src/app/api/nex-native/cron/security-audit-reconcile/route.ts → invokes mig 293 RPC
~220+ files in src/lib/nex-native/ + src/app/nex-native/ → emit audit events
```

Live callers use `recordAuditEvent()` which currently fails soft when
the table is absent. Applying mig 292 activates real audit writes.

---

## BLOCKER 3 · Mig 294 scope question (audit actor erase)

Mig 292 doctrine references mig 294 as the ONLY path to DELETE audit
rows (pseudonymisation of actor identity on account deletion). Mig 292
revokes DELETE on nex_security_audit_log from everyone except the
SECURITY DEFINER function shipped in mig 294.

If an account-deletion flow is live in the app AND mig 292 is applied
without mig 294, account-deletion → cannot pseudonymise audit rows →
either fails or silently leaks PII in audit history.

**Owner decision**: Is account-deletion in scope for Batch A? If YES,
mig 294 must be included. If NO (deletion paused until later batch),
batch A can ship 292 without 294 provided no production account-deletion
code path is active in sandbox.

I **did NOT verify** whether `src/app/nex-native/settings/security/delete-account/*`
is production-reachable today. That verification is a separate
targeted question for owner.

---

## Mig 290 · PASSED review

- **Schema**: `nex_security_rate_limit (key text, action text, window_started_at timestamptz, count integer, updated_at timestamptz)`. PK on `(key, action, window_started_at)`.
- **CHECK constraints**: action enum (8 values · matches service), count ≥ 0, key regex `^(acct|ip):[a-z0-9-]{16,}$` (service output verified to match).
- **Rollback**: present inside file header comments · `DROP INDEX + DROP TABLE + DELETE FROM nex_migration_history`. Non-destructive: table has no app data by design.
- **Grants**: RLS enabled, zero policies, explicit REVOKE of public/anon/authenticated, explicit GRANT to service_role only. Correct.
- **Idempotency**: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` + `ON CONFLICT DO NOTHING` on migration_history. Safe to re-apply.
- **No plaintext exposure**: table holds opaque identity keys + counters only.
- **Live caller**: `src/lib/nex-native/security-rate-limit.ts` already detects table presence via `detectRateLimitTable()`.

---

## Mig 293 · PASSED review (contingent on 292 applied first)

- **Function body**: SELECT + INSERT ON CONFLICT DO NOTHING. Idempotent.
- **SECURITY DEFINER with `set search_path = pg_catalog, public`**: prevents search_path hijack.
- **Window validation**: 60-3600 seconds · fail-loud outside range.
- **Grants**: service_role only. Explicit REVOKEs on public/anon/authenticated.
- **Second function** (`nex_security_audit_reconcile_match_late`): HQ-authorised late-match transition. Same security pattern.
- **No plaintext exposure**: operates on audit log metadata only.
- **Rollback file**: ❌ **NOT PRESENT** inside `293_nex_security_audit_reconcile.sql`. Standard rollback would be `DROP FUNCTION IF EXISTS <both signatures> + DELETE FROM nex_migration_history WHERE version = '293'`. Cosmetic gap · recommended to add inline before activation.

---

## Mig 295 · PASSED review

- **Bucket privacy**: Migration file header documents `public: false` in the bucket creation step (bucket itself must be created via Supabase Storage API before the migration runs · documented with the exact curl command).
- **MIME whitelist**: `application/octet-stream` only · prevents browser content-sniff.
- **File size cap**: 27 262 976 bytes (26 MiB · 25 MiB chat cap + 1 KiB Poly1305 overhead + 1 MiB padding).
- **RLS policies**: 3 policy blocks (`service_role_all` permissive + `anon_deny` restrictive + `authenticated_deny` restrictive · all `FOR ALL`). Idempotent via `IF NOT EXISTS` pg_policies probe.
- **Defence-in-depth**: restrictive deny policies supplement Supabase's default "no permissive policy = denied" · an accidental later permissive policy still cannot override a restrictive.
- **Legacy bucket preserved**: `nex-peer-chat-attachments` sealed public per mig 055 · untouched.
- **No public-bucket fallback**: `src/lib/nex-native/crypto/encrypted-attachment-uploader.ts` returns 503 `ciphertext_bucket_not_applied` when the private bucket is unreachable · never falls back to the public bucket (proven in cycle 7 agent output).
- **Rollback file**: ❌ **NOT PRESENT**. Standard rollback would be `DROP POLICY IF EXISTS <three policy names> ON storage.objects + DELETE FROM nex_migration_history WHERE version = '295'`. Cosmetic gap.

---

## Cross-migration conflict check

- Mig 290/291/292/293/294/295 do NOT introduce any column, table, or policy that conflicts with any P-RLS proposal file.
- The HQ admin overlay PROPOSAL (cycle 6 commit `cd9bfb99`) explicitly excludes `nex_security_audit_log` and `nex_pilot_operator_audit` · no overlap with Batch A.
- `nex_security_rate_limit` is not referenced by any P-RLS proposal (service-role-only table · no RLS policy proposed).

## Build + test state after review

- Scoped regression (unchanged from cycle 7): 149/149 passing across cycle-7 new suites.
- Ireland build: `Compiled successfully`.
- No additional local changes required by this review itself (fixes are owner-decision-gated).

## Cycle 7 background tasks

All three agents completed. All outputs committed in `607b5914`:
- Chat integration agent → `peer-message-dispatcher.ts` + batch route + `encrypted-attachment-uploader.ts` + 18 tests
- Chat migration agent → migs 323-329 + dependency doctrine doc
- Payments journey agent → `journey-e2e.test.ts` · 27 tests

Git working tree clean · 9 commits ahead of remote `47458e0f` · zero residual in-flight work from cycle 7.

---

## Required actions before Batch A can be GO

1. **Owner picks canonical mig 291 file**. Rename the other to
   `.SUPERSEDED.sql` + same for its rollback. (I can perform the
   renames with explicit authorisation per cycle-7 safeguard.)

2. **Owner confirms Batch A scope**: include mig 292 (and
   recommended canonical 291 + optionally 294) · expand the batch
   definition to:

   > `AUTHORISE SANDBOX BATCH A · APPLY 290 · APPLY <canonical 291> · APPLY 292 · APPLY 293 [· APPLY 294] · APPLY 295 · CREATE CIPHERTEXT BUCKET`

   Or split Batch A into A1 (rate-limit: 290 + 291-canonical) and A2
   (audit: 292 + 293 [+294] + 295 + bucket) for independent review.

3. **Owner confirms** whether account-deletion is in scope → decides
   if mig 294 is required in Batch A.

4. **Optional cosmetic improvements** (I can draft these as additive
   edits before activation):
   - Add inline rollback block to mig 293.
   - Add inline rollback block to mig 295.
   - Add inline rollback to all P-RLS proposals that don't have one.

## Suggested owner response

- "Canonical 291 is `_claim_rpc.sql` (the newer draft)." — or the other.
- "Include migs 290 + 291 + 292 + 293 + 295 in Batch A. Defer 294." — or include 294.
- "Add cosmetic rollback blocks." — or skip.

Once those three are answered, I will:
- Rename the non-canonical 291 file to `.SUPERSEDED.sql`.
- Update `docs/doctrine/sandbox-activation-batch-plan-2026-11-10.md`
  Batch A definition to the exact migration list.
- Add the cosmetic rollback blocks if authorised.
- Then STOP.

**No sandbox apply · no bucket creation · no production touch · no
GitHub push happens as part of this review.**
