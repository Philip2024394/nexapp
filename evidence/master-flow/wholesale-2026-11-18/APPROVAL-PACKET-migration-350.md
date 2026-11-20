# Approval packet · apply migration 350 · sandbox only

**Authored:** 2026-11-18 · Phase W (W17)
**Status:** AWAITING OWNER APPROVAL · **DO NOT APPLY**
**Target environment:** sandbox `kdstoyyeygcopkogqsyv` · **not** production
**Production `ijvqdvsvwtwxzcqmoqit`:** SEALED · remains unchanged

---

## 1 · What this packet is

Explicit authorisation request to apply migration
`nex-supabase/migrations/350_nex_wholesale_buyer_approval_PROPOSAL.sql`
to the SANDBOX Supabase project `kdstoyyeygcopkogqsyv`.

The packet exists because:

- Master-prompt §5 states migration 350 is **not authorised for apply**
  without a named owner word-trigger. A read of the migration file alone
  is not sufficient context for that decision — this packet is the
  review surface.
- The sealed Stripe-first / entitlement-first rule (feedback
  `stripe_entitlement_contract` 2026-11-05) requires a clear table
  definition before downstream flows depend on the row shape.
- The sealed DB-wired rule (feedback 2026-11-12) prohibits shipping UI
  that pretends to save. The buyer wholesale page currently short-circuits
  every non-owner viewer to "unapproved" because the table does not exist.
  This packet, once approved and applied, will make the approval check
  backend-wired end-to-end.

## 2 · What the migration actually does (plain English)

Creates ONE new table `public.nex_wholesale_buyer_approval` plus three
partial indexes, an `updated_at` trigger, four RLS policies, and
explicit GRANT/REVOKE wiring. The table records seller-scoped buyer
access to the wholesale catalogue. No existing tables or columns are
modified. No data is backfilled.

- **Columns:** `id uuid`, `business_id uuid`, `buyer_account_id uuid`,
  `status text ∈ {pending, approved, revoked}`, `requested_at`,
  `decided_at`, `revoked_at`, `buyer_note text`, `created_at`,
  `updated_at`.
- **Constraints:** `UNIQUE(business_id, buyer_account_id)` (idempotent
  request), plus CHECK constraints requiring `decided_at` when
  `status='approved'` and `revoked_at` when `status='revoked'`.
- **RLS:** owner-of-business can SELECT/UPDATE; buyer can SELECT own row
  and INSERT only `status='pending'` rows for themselves. No DELETE for
  anyone (revoked rows retained for audit). `anon` has no access.
- **Grants:** `SELECT, INSERT, UPDATE` to `authenticated`;
  `REVOKE ALL FROM PUBLIC/anon`. `service_role` retains implicit
  full access for server-action use.

## 3 · What the migration does NOT do

- **Does not touch production** — apply command is sandbox-only.
- **Does not change `nex_product`** — wholesale pricing lives in the
  existing `spec.__wholesale` jsonb key; no new product columns are
  added.
- **Does not enable Stripe / payment flow** — payment and freight
  acceptance are separate (see §5 freight-on-request below).
- **Does not retroactively grant access** — table starts empty.
- **Does not use `SECURITY DEFINER` RPCs** — all access is via plain
  RLS plus server actions resolving the viewer's account ID through
  the existing session path.

## 4 · Dependencies & pre-conditions

Required before apply:

1. Sandbox project `kdstoyyeygcopkogqsyv` reachable from the apply
   script.
2. Function `public.nex_resolve_account_id_from_jwt()` exists in the
   sandbox. (Per the convention in migrations 005, 032, 349.) If the
   function's exact name differs in the current sandbox snapshot,
   **adjust the migration before applying** — do not guess.
3. Tables `public.nex_business` and `public.nex_account` exist
   (referenced by foreign keys with `ON DELETE CASCADE`).

Verification before apply (owner may run these first):

```sql
-- Project ref sanity check (must be sandbox).
SELECT current_setting('app.settings.project_ref', true);

-- Required FK targets.
SELECT to_regclass('public.nex_business'), to_regclass('public.nex_account');

-- JWT→account resolver.
SELECT to_regprocedure('public.nex_resolve_account_id_from_jwt()');

-- Confirm table does not already exist.
SELECT to_regclass('public.nex_wholesale_buyer_approval');
```

Expected: both regclass rows NOT NULL, the regprocedure NOT NULL, the
last row NULL.

## 5 · Open questions (owner decision needed in this packet)

Reproduced from the migration header for direct decision:

| ID | Question | Proposed answer | Owner decision |
|---|---|---|---|
| Q1 | On re-request after revoke, reuse the existing row (status → pending, clear `revoked_at`) or require a brand-new row? | Reuse (status transitions in-place). UNIQUE constraint enforces this. | ___ |
| Q2 | Allow buyer to see their OWN pending/revoked status? | Yes — RLS allows self-read. | ___ |
| Q3 | Keep a `buyer_note` field (seller-visible when deciding)? | Yes. A separate `seller_note` is NOT in this migration. | ___ |

Please decide these before applying. The migration as written implements
all three proposed answers (Q1 via UNIQUE, Q2 via `buyer_select` policy,
Q3 via `buyer_note` column).

## 6 · Apply procedure (only after approval)

1. **Pre-flight (as owner):**
   - Read the SQL file once more end-to-end.
   - Note the sandbox project ref.
   - Confirm no other apply is in-flight.
2. **Dry-run (optional, by Claude on owner direction):**
   - Capture a SAVEPOINT / ROLLBACK block that executes the migration
     without COMMIT to inspect the plan.
3. **Apply (by Claude once the owner issues the word-trigger
   `apply migration 350 sandbox`):**
   - `node scripts/apply-migration-350-sandbox.mjs` — script does not
     yet exist; it will be modelled on `scripts/apply-migration-349-sandbox.mjs`
     and will refuse any DATABASE_URL whose project ref ≠
     `kdstoyyeygcopkogqsyv`.
4. **Verify (immediately after):**
   - `SELECT to_regclass('public.nex_wholesale_buyer_approval');` → not null.
   - `SELECT polname FROM pg_policy WHERE polrelid = 'public.nex_wholesale_buyer_approval'::regclass;` → 4 rows.
   - `SELECT has_table_privilege('authenticated', 'public.nex_wholesale_buyer_approval', 'INSERT');` → true.
   - `SELECT has_table_privilege('anon', 'public.nex_wholesale_buyer_approval', 'SELECT');` → false.
5. **Report (to owner):** sandbox ref, migration SHA (file hash),
   verification results, no code shipped yet.

## 7 · Rollback posture

A rollback script will be authored BEFORE the apply, as sibling
`350_nex_wholesale_buyer_approval_PROPOSAL_rollback.sql`. The rollback
is non-destructive by design: `DROP TABLE IF EXISTS` removes the table
plus its indexes/triggers/policies in one statement. Because no
existing row elsewhere depends on this table yet, there is no data to
preserve. The rollback does NOT touch any other object.

Rollback is still gated by a separate owner word-trigger.

## 8 · What this migration does **not** unlock

Applying 350 by itself does not:

- Ship a request-access button to buyers. The RequestAccessShell on the
  buyer wholesale page explicitly says "coming soon" and will remain
  that way until a separate server action + button are authorised.
- Enable freight / payment flow. See W16 freight-on-request proposal
  for the quote table required for that.
- Modify the retail product rendering or the drawer entry.

It only makes it **possible** to wire the buyer-approval UI without
breaking the DB-wired rule. Each follow-on step is its own
authorisation.

## 9 · Risk summary

| Risk | Severity | Mitigation |
|---|---|---|
| Wrong environment (prod touched) | Critical | Apply script refuses non-sandbox project refs; this packet is sandbox-only. |
| Bad RLS exposes buyer notes to unrelated accounts | Critical | RLS policies verified in §4 of migration file; two policy tests MUST be added before Phase W+1 (see "REMAINING" in handback). |
| Existing table name collides | Low | `CREATE TABLE IF NOT EXISTS` — pre-flight regclass check confirms absence. |
| Function `nex_resolve_account_id_from_jwt` name drift | Medium | Pre-flight regprocedure check is mandatory before apply. |
| FK cascade from `nex_account` delete nukes approval history | Medium | Intentional — if an account is deleted, their approval records should not survive (PII cleanup). Owner should confirm. |

---

**Authorisation required:** owner must respond with a verbatim
word-trigger such as `apply migration 350 sandbox` before any apply
command runs.

**No other action in this packet** — no code is shipped, no deploy, no
production touch.
