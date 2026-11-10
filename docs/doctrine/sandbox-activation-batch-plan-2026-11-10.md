# NEX Sandbox Activation Batch Plan · 2026-11-10 (revised for A1/A2 split)

**Owner-authorisation state:** the mig 291 pre-activation comparison
resolved the duplicate-file question (`_claim_rpc.sql` is canonical ·
`_claim.sql` superseded). Batch A is split into A1 and A2 per owner
directive 2026-11-10. Each sub-batch has its own GO/NO-GO.

**Target:** sandbox `kdstoyyeygcopkogqsyv` only. Production
`ijvqdvsvwtwxzcqmoqit` remains sealed under its own separate gates.

## Summary count

- **Sandbox-applied (previous cycles):** 1 · mig 318 (order_enabled)
- **PROPOSAL · unapplied:** 36+ migrations total
  - Rate-limit stack (A1): 290, 313, 291
  - Audit + ciphertext stack (A2): 292, 293, 294, 295 + bucket
  - Chat architecture (B): 323, 324, 325, 326, 327
  - Chat CHECK rollout (F, G): 328 (NOT VALID), 329 (VALIDATE)
  - Payment merchant (D): 319, 320, 321, 322
  - RLS baseline (C): 26 P-RLS proposals + support_admin_grant
  - HQ admin overlay (E): 1 (depends on C)

## Dependency graph (high level)

```
                         318 (applied · order category)
                           │
Batch A1 ──► 290 ──► 313 ──► canonical 291 (_claim_rpc.sql)
                           │
Batch A2 ──► 292 ──► 294 ──► 293 ──► 295 ──► bucket (nex-peer-chat-ciphertext)
                           │
Batch B  ──► 323 ──► 324 ──► 325 ──► 326 ──► 327 ──► daily cron wiring
                           │
Batch C  ──► 26 P-RLS proposals + support_admin_grant
                           │
Batch D  ──► 319 ──► 320 ──► 321 ──► 322 ──► bucket (nex-merchant-qr)
                           │
Batch E  ──► HQ admin overlay (requires Batch C baseline)
                           │
Batch F  ──► 328 (NOT VALID) ── 14d burn-in ─► Batch G ──► 329 (VALIDATE)
```

## Batch A1 · Rate-limit stack (foundational)

**Purpose:** install the distributed rate-limit counter + the atomic
claim RPC that eliminates the sealed cold-bucket race in
`src/lib/nex-native/security-rate-limit.ts`.

**Migrations (STRICT ORDER):**
1. `290_nex_security_rate_limit.sql`
2. `313_nex_security_rate_limit_hq_admin_grant.sql`
3. `291_nex_security_rate_limit_claim_rpc.sql` (CANONICAL · 2026-11-09)

**Why this order:** mig 290 creates the table + 8-value CHECK. Mig 313
drops and re-creates the CHECK with 9 values (adds `hq_admin_grant`).
Mig 291 inserts `(key, action, window_started_at, count)` rows and
would violate the 8-value CHECK on any `hq_admin_grant` call unless
313 ran first.

**Why `_claim_rpc.sql` is canonical and not `_claim.sql`:** see the
full comparison. Short version:
- `_claim.sql` hardcodes an 8-value action enum inside the function
  body · it REJECTS `hq_admin_grant` calls (returns `(false, 1)`) · 
  the live caller then throws `SecurityRateLimitError` for every
  legitimate HQ admin grant.
- `_claim_rpc.sql` has no hardcoded enum · defers to the base-table
  CHECK · works correctly once 313 is applied.
- The old `_claim.sql` + its rollback have been renamed to
  `.SUPERSEDED.sql` for audit clarity.

**Caller-compatibility (verified against
`src/lib/nex-native/security-rate-limit.ts` line 600-688):**
| Attribute | Required by caller | `_claim_rpc.sql` provides |
|---|---|---|
| Name | `nex_security_rate_limit_claim` | ✓ |
| Params | `_key text, _action text, _window_minutes int, _max_per_window int` | ✓ |
| Returns | `TABLE (allowed boolean, retry_after_seconds integer)` | ✓ |
| SECURITY DEFINER | required (bypasses RLS on counter table) | ✓ |
| service_role-only EXECUTE | required | ✓ |

**Known gap introduced by canonical choice:** the old `_claim.sql`
also installed `nex_security_rate_limit_prune()` for nightly cron.
`_claim_rpc.sql` does not. **Follow-up:** either add a prune function
in a separate micro-migration, or operate the cron against the
counter table directly. Not a Batch A1 blocker · logged here so it
doesn't fall through.

**Rollback cost:** low. Each migration has an inline rollback script.
Reverse order: drop 291 function → drop 313 CHECK → drop 290 table.

**Verification tests per migration:**
- 290: history row present · table `nex_security_rate_limit` exists
  with 5 columns · RLS enabled · service_role has DML · public/anon/
  authenticated revoked · CHECK rejects an invalid action.
- 313: history row present · `ck_sec_rl_action` accepts `hq_admin_grant`
  · INSERT with `hq_admin_grant` succeeds · rollback restores 8-value.
- 291: history row present · function signature exact · SECURITY
  DEFINER + search_path pinned to `public, pg_temp` · EXECUTE granted
  only to service_role · a seeded call to the RPC with 5 identical
  arguments in the same window produces monotonically rising counts
  and returns `allowed=false, retry_after≥1` after `max_per_window`.

**Preflight checks (apply refuses to run if any fails):**
- target ref MUST equal `kdstoyyeygcopkogqsyv` (hard string match in
  every apply script · production ref hard-rejected)
- `nex_migration_history` row for the migration being applied MUST
  NOT exist (idempotency guard in SQL)
- 313 refuses apply unless 290 is applied; 291 refuses apply unless
  290 is applied (313 dependency documented but not enforced by the
  function body · the function body is safe without 313 as long as
  no caller uses `hq_admin_grant` · 313 must still be applied for
  correctness in the live service).

**Batch A1 go-ahead:** owner phrase
`AUTHORISE SANDBOX BATCH A1 · APPLY 290 313 291`.

## Batch A2 · Audit + ciphertext stack

**Purpose:** install the security audit log · the pseudonymisation
function for account deletion · the reconciliation RPC · the private
ciphertext bucket for peer-chat attachments.

**Migrations (STRICT ORDER):**
1. `292_nex_security_audit_log.sql`
2. `294_nex_security_audit_erase_actor.sql`
3. `293_nex_security_audit_reconcile.sql`
4. `295_nex_peer_chat_ciphertext_bucket.sql` + bucket create via
   Supabase Storage admin API

**Why mig 294 stays in A2 (not deferred):** account-deletion path
`src/app/api/nex-native/security/account/delete/route.ts` IS
reachable in sandbox · the deletion service calls
`eraseActorIdentityInAudit` which invokes `nex_security_audit_erase_actor`
· absent that function, the audit trail retains the `acct:<uuid>`
snapshot of a deleted user · identifiability regression per owner
directive. Including 294 keeps the audit trail honest from day one.

**Why order 292 → 294 → 293:**
- 292 creates the audit tables and retention table used by all three.
- 294 is a pure function, no data dependency, but depends on 292's
  `nex_security_audit_log.actor_identity` column.
- 293 is a reconciliation RPC that depends on 292's reconciliation
  staging table.
- 295 is independent of the above but is grouped here because the
  ciphertext-attachment pipeline + audit trail are the privacy
  foundation on which private chat launches.

**Rollback cost:**
- 292 drop deletes audit staging tables (no data in sandbox today).
- 294 drop removes the pseudonymisation function (deletion service
  logs a warn and continues · falls back to not pseudonymising).
- 293 drop removes reconciler RPC · cron starts returning
  `function_not_available` (observable in cron logs).
- 295 drop removes RLS policies AND the private bucket → any
  ciphertext objects in the bucket are lost. Zero objects today.

**Verification tests per migration:**
- 292: 3 tables exist · DELETE/UPDATE/TRUNCATE revoked at role level
  on `nex_security_audit_log` · only SECURITY DEFINER pseudonymiser
  can write to the actor column after creation.
- 294: function exists · UPDATE on real row changes actor_identity ·
  cannot be invoked by anon/authenticated.
- 293: function exists · SECURITY DEFINER · `search_path = pg_catalog, public`
  · service_role-only EXECUTE · window seconds validated 60-3600 ·
  seeded mismatch reconciles.
- 295: bucket privacy = `false`/private · the 4 named policies exist
  on `storage.objects` (service_role permissive · anon_deny ·
  authenticated_deny · MIME whitelist) · upload via service-role
  succeeds · read via anon returns 403 · read via authenticated
  returns 403.

**Preflight checks:**
- target ref = `kdstoyyeygcopkogqsyv`
- 292 must apply before 294 (294 references column from 292)
- 292 must apply before 293 (293 references reconciliation table)
- 295 requires the bucket row to NOT already exist · creation script
  raises explicit error if it does

**Batch A2 go-ahead:** owner phrase
`AUTHORISE SANDBOX BATCH A2 · APPLY 292 294 293 295 · CREATE CIPHERTEXT BUCKET`.

## Batches B through G

Batches B through G are unchanged from the 2026-11-10 original plan.
See git history for `docs/doctrine/sandbox-activation-batch-plan-2026-11-10.md`
pre-A1/A2-split version if cross-reference is needed.

- **Batch B** · Chat architecture foundation (323-327) · depends on A2.
- **Batch C** · RLS baseline (26 P-RLS + support_admin_grant).
- **Batch D** · Payment merchant (319-322 + merchant bucket).
- **Batch E** · HQ admin overlay · depends on C.
- **Batch F** · Chat plaintext freeze NOT VALID (328) · 14d burn-in.
- **Batch G** · Chat plaintext freeze VALIDATE (329).

## Production stages (SEPARATE · PER-BATCH · never one-shot)

After each sandbox batch passes verification, the corresponding
PRODUCTION batch requires its OWN owner authorisation phrase of the
form `AUTHORISE PRODUCTION BATCH X · PROJECT ijvqdvsvwtwxzcqmoqit ·
APPLY <list>`. Production gates stay sealed under CLAUDE.md §8 until
every one of those phrases is issued individually.

## What this plan deliberately DOES NOT propose

- Applying any migration to production.
- Creating any production bucket.
- Flipping any production feature flag.
- Deploying to Vercel.
- Pushing commits to GitHub.
- Executing Phases 1-3 of the legacy plaintext transition.

## Honest state (as of 2026-11-10 · 10 local commits ahead of remote)

- mig 318 applied to sandbox · all other PROPOSAL migrations unapplied.
- Mig 291 duplicate-file question resolved · `_claim_rpc.sql` canonical
  · `_claim.sql` + its rollback renamed to `.SUPERSEDED.sql`.
- Account-deletion route confirmed reachable · mig 294 stays in A2.
- 5 missing apply scripts (290, 292, 293, 294, 295) + bucket script
  authored this cycle · hard-refuse production ref · mirror the 313
  template.
- Local build + test state: Ireland + Worldwide + HQ builds all
  compile · 370+ cycle tests passing.
