# NEX Sandbox Activation Batch Plan · 2026-11-10

**Owner-authorisation state:** NONE of the migrations below are applied.
This plan ORGANISES them into small reviewable batches. Each batch
requires separate explicit owner authorisation.

**Target:** sandbox `kdstoyyeygcopkogqsyv` only. Production
`ijvqdvsvwtwxzcqmoqit` remains sealed under its own separate gates.

## Summary count

- **Sandbox-applied (previous cycles):** 1 · mig 318 (order_enabled)
- **PROPOSAL · unapplied:** 36+ migrations total
  - Chat security: 5 (290, 293, 295, 323, 324)
  - Chat delivery: 3 (325, 326, 327)
  - Chat CHECK rollout: 2 (328 NOT VALID · 329 VALIDATE)
  - Payment merchant: 3 (319, 320, 321)
  - Payment seller config: 1 (322)
  - Existing P-RLS proposals: 26
  - HQ admin overlay: 1 (P-RLS-HQ-admin-overlay)
  - support_admin_grant defence-in-depth: 1 (P-RLS-nex_support_admin_grant)

## Dependency graph (high level)

```
                    318 (applied · order category)
                     |
Batch A ──► 290 ─┐  Batch D ──► 319 ──► 320 ──► 321 ──► 322
             293 ┤                                 │
                 └──► 295                          ▼
                       │                       bucket create
                       ▼                       (nex-merchant-qr)
                 bucket create
                 (nex-peer-chat-ciphertext)
                                                   │
Batch B ──► 323 ──► 324 ──► 325 ──► 326 ──► 327   │
                                     │              │
                                     ▼              │
                              daily cron wiring    │
                                                   │
Batch C ──► 26 P-RLS proposals + support_admin_grant
                                     │
                                     ▼
Batch E ──► HQ admin overlay (depends on Batch C baseline)
                                     │
                                     ▼
Batch F ──► 328 (NOT VALID) ─── 14d burn-in ───► Batch G ──► 329 (VALIDATE)
```

## Batch A · Security foundations

**Purpose:** rate-limit DB + audit reconciliation RPC + ciphertext bucket.
**Migrations:** 290, 293, 295 + bucket create `nex-peer-chat-ciphertext`.

**Dependencies:** none. Can apply first.
**Rollback cost:** low. 290+293 are additive · 295 bucket deletion
loses any sandbox-uploaded ciphertext objects (zero rows today).
**Verification tests per migration:**
- 290: existing `security-rate-limit-db-path.test.ts` already covers
  the detection path. Live test = seed 2 identity keys and prove the
  cap triggers across ≥3 request simulations.
- 293: cron endpoint stops returning `function_not_available`. Seed
  one mismatch in the audit log and confirm the RPC reconciles it.
- 295: bucket privacy = `false`. Four deny-policies on
  `storage.objects` return as expected via `pg_policies`. Upload a
  byte blob via service-role · attempt read via anon / authenticated
  → denied.

**Batch A go-ahead:** owner phrase `AUTHORISE SANDBOX BATCH A · APPLY 290 293 295 · CREATE CIPHERTEXT BUCKET`.

## Batch B · Chat architecture foundation

**Purpose:** D1-D6 chat system support (retired_at · delivery_status ·
adoption metric view · expiry sweep · orphan scan).
**Migrations:** 323, 324, 325, 326, 327.

**Dependencies:** Batch A (the ciphertext bucket must exist before
the orphan scan references it). Mig 324's `delivery_status` is an
additive column · safe even if 323 isn't yet applied, but review
order is simpler if 323 goes first.
**Rollback cost:** low. All additive. 325 is a view · 326 is a
function · 327 is a table.
**Verification tests per migration:**
- 323: `nex_device_key.retired_at` column exists · partial index
  `nex_device_key_active` present. Insert a key · retire it · prove
  the active-key query excludes it.
- 324: `delivery_status` column exists · CHECK accepts the three
  values. Default 'pending'.
- 325: view returns a row per conversation last 14d · percentage
  field computed correctly on a seed dataset.
- 326: function expires rows > 30d old · leaves rows < 30d untouched
  · idempotent on re-run.
- 327: table exists · RLS enabled · service-role-only writes.

**Batch B go-ahead:** owner phrase `AUTHORISE SANDBOX BATCH B · APPLY 323-327`.

## Batch C · RLS foundation (26 P-RLS proposals)

**Purpose:** defence-in-depth RLS on every GAP-P0 / GAP-P1 table.
Caller-trace (cycle 5) already validated zero live callers break.

**Migrations:** 26 × `P-RLS-*_PROPOSAL.sql` + `P-RLS-nex_support_admin_grant_PROPOSAL`.

**Dependencies:** none against other batches. Each P-RLS file is
independent · can apply in any order.
**Rollback cost:** per-table ALTER DISABLE RLS. No data impact.
**Verification tests:**
- `rls-policy-validation.test.ts` (already passing 81/81 offline)
  pins the structural shape. After apply, run the live-DB version
  of the same tests.
- Manual: as an anon or authenticated test user, try SELECT on each
  P-RLS table · expect zero rows · owner (hq_role null) same ·
  owner (hq_role set) sees rows ONLY after Batch E.

**Batch C go-ahead:** owner phrase `AUTHORISE SANDBOX BATCH C · APPLY 27 P-RLS PROPOSALS`.

## Batch D · P5 merchant payments

**Purpose:** QR merchant commerce + payment settings persistence.

**Migrations:** 319, 320, 321, 322 + bucket create `nex-merchant-qr`.

**Dependencies:** none against other batches.
**Rollback cost:** 319 (asset audit table · additive). 320 (nullable
column · additive). 321 (bucket · losing bytes on delete). 322 (new
table · additive).
**Verification tests:** P5 sandbox verification procedure already
documented at `nex-supabase/migrations/318_sandbox_verification_procedure.md`
· V1-V12 with failed-path evidence.

**Batch D go-ahead:** owner phrase `AUTHORISE SANDBOX P5 ACTIVATION — APPLY MIGRATIONS 319, 320, 321 AND CREATE PRIVATE BUCKET` (the exact phrase previously sealed).

## Batch E · HQ admin overlay

**Purpose:** database-level defence-in-depth for HQ admin reads of
sensitive user data.

**Migrations:** `P-RLS-HQ-admin-overlay_PROPOSAL`.

**Dependencies:** Batch C MUST be applied first (admin policies
overlay on top of baseline RLS from the 26 P-RLS files).
**Rollback cost:** drop the `nex_is_hq_admin()` function + each
admin SELECT policy. No data impact.
**Verification tests:**
- Baseline RLS still blocks non-admin sessions.
- Admin session (hq_role = 'admin' or 'reviewer') can SELECT every
  table in the overlay list.
- `nex_pilot_operator_audit` + `nex_security_audit_log` remain
  invisible to admin sessions (safety invariant).

**Batch E go-ahead:** owner phrase `AUTHORISE SANDBOX BATCH E · APPLY HQ ADMIN OVERLAY`.

## Batch F · Chat plaintext freeze test (NON-ENFORCING)

**Purpose:** D6 phase 1 · 14-day sandbox burn-in with CHECK in
non-enforcing (NOT VALID) mode.

**Migrations:** 328.

**Dependencies:** Batches A + B applied. `NEX_CHAT_PLAINTEXT_FREEZE=1`
env flag must be set on sandbox deployment (not a DB change · a
Vercel env-var change · separately gated).
**Rollback cost:** ALTER DROP CONSTRAINT.
**Verification tests:**
- Query plans reference the CHECK.
- EXISTING encrypted=false rows unaffected.
- NEW inserts with encrypted=false DO NOT fail (NOT VALID semantics).
- But the `peer-message-service` application-layer refusal (due to
  env flag) DOES return `plaintext_sends_frozen` to callers.

**Batch F go-ahead:** owner phrase `AUTHORISE SANDBOX BATCH F · APPLY 328 (NOT VALID)`. **Requires owner also flips NEX_CHAT_PLAINTEXT_FREEZE=1 on sandbox.**

## Batch G · Chat plaintext freeze ENFORCE

**Purpose:** D6 phase 3 · flip CHECK from NOT VALID to enforced.

**Migrations:** 329.

**Dependencies:** Batch F applied for ≥14 days AND the adoption
metric from mig 325 shows ≥95% encrypted sends AND the observed
plaintext-write rate on sandbox is zero.
**Rollback cost:** ALTER DROP CONSTRAINT · NEW plaintext inserts
immediately become possible again. Legacy rows unaffected.
**Verification tests:**
- `ALTER TABLE ... VALIDATE CONSTRAINT` succeeds (no violating rows).
- Attempted insert with encrypted=false → DB error (NOT the
  application-layer refusal).

**Batch G go-ahead:** owner phrase `AUTHORISE SANDBOX BATCH G · APPLY 329 (VALIDATE)` **AND confirmation that Batch F burn-in metrics were clean.**

## Production stages (SEPARATE · PER-BATCH · never one-shot)

After each sandbox batch's verification passes, the corresponding
PRODUCTION batch requires its OWN owner authorisation phrase of the
form `AUTHORISE PRODUCTION BATCH X · PROJECT ijvqdvsvwtwxzcqmoqit ·
APPLY <list>`. Production gates stay sealed under CLAUDE.md §8 until
every one of those phrases is issued individually.

## What this plan deliberately DOES NOT propose

- Applying any migration.
- Creating any Supabase bucket.
- Flipping any production feature flag.
- Deploying to Vercel.
- Pushing commits to GitHub.
- Executing Phases 1-3 of the legacy plaintext transition (user-
  driven · separate authorisation per phase per user).

## Honest state (as of 2026-11-10 · 7 local commits ahead of remote)

- mig 318 applied to sandbox · all other PROPOSAL migrations unapplied.
- Local build + test state: Ireland + Worldwide + HQ builds all
  compile successfully · 370+ cycle tests passing.
- RLS 81/81 structural tests passing offline.
- Chat crypto primitives + decision lock-in doctrine in place ·
  integration is cycle 7 work in progress.
- 7 owner decisions already approved · implementation state tracked
  in `chat-decisions-locked-2026-11-10.md`.
