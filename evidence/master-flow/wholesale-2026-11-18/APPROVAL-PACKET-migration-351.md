# Approval packet · apply migration 351 · sandbox only

**Authored:** 2026-11-18 · Phase W follow-up (W23)
**Status:** AWAITING OWNER APPROVAL · **DO NOT APPLY**
**Target environment:** sandbox `kdstoyyeygcopkogqsyv` · **not** production
**Production `ijvqdvsvwtwxzcqmoqit`:** SEALED · remains unchanged
**Depends on:** migration 350 (separate packet · separate decision)

This packet is DELIBERATELY SEPARATE from the migration 350 packet so
each migration can be accepted, deferred, or amended independently.
Owner saying "Okay" to 350 does not approve 351. Owner saying "Okay" to
351 does not approve 350. Both require their own explicit word-trigger.

---

## 1 · What this packet is

Explicit authorisation request to apply migration
`nex-supabase/migrations/351_nex_wholesale_quote_PROPOSAL.sql` to the
SANDBOX Supabase project `kdstoyyeygcopkogqsyv`.

Why separate from 350:

- 350 and 351 are independently reviewable schema changes. 351 is
  larger (one table + status enum + three partial indexes + four RLS
  policies + two trigger functions) and has its own open questions.
- 350 can be applied alone and unblocks the access-request path
  without enabling quotes.
- Applying 351 without 350 is possible but leaves the quote
  authorisation gate without a backing approval row to re-check against
  — the server action refuses to create a quote in that configuration.

## 2 · What migration 351 actually does (plain English)

Creates ONE new table `public.nex_wholesale_quote` plus:

- 3 partial indexes — `owner_live_ix`, `buyer_inbox_ix`, `expires_ix`
- 1 `updated_at` trigger + its function
- 4 RLS policies (owner SELECT/INSERT/UPDATE, buyer SELECT/UPDATE)
- Explicit REVOKE / GRANT wiring

The table records per-order freight-on-request quotes:

- **Identity columns:** `business_id`, `buyer_account_id`, `product_id`
- **Goods columns (bound server-side from seller's tier table):**
  `quantity`, `currency`, `goods_unit_price_pence`, `goods_subtotal_pence`
- **Freight columns (quoted · may be null = "not yet quoted"):**
  `freight_pence`, `freight_method`, `transit_days_min`, `transit_days_max`
- **Duties / terms columns:** `duties_disposition ∈ {seller_pays,
  buyer_pays, unspecified, null}`, `terms_note`
- **Lifecycle:** `status ∈ {draft, quoted, accepted, rejected, expired,
  cancelled}` + matching timestamp columns
- **Expiry:** `expires_at timestamptz` · enforced by application check,
  not a cron

No existing tables or columns are modified. No data is backfilled.

## 3 · Dependency on migration 350

- 351 does NOT add a foreign key into `nex_wholesale_buyer_approval`.
  It references the approval contract indirectly via
  `(business_id, buyer_account_id)` — the server action re-checks
  approval before writing a quote row.
- Without 350 applied, the `createWholesaleQuoteAction` server action
  returns `reason: "migration_not_applied"` and never writes. Buyer
  acceptance actions similarly short-circuit.
- With 350 applied but 351 unapplied, the buyer page renders the
  freight-excluded notice but the quote-creation flow fails closed with
  the same `migration_not_applied` reason. No stub falls through.

Short summary of what each application unlocks:

| Applied | Unblocks |
|---|---|
| 350 only | Request-access · approve · revoke · persisted evidence for journeys E / F / I |
| 351 only (not recommended) | Quote CREATE fails closed · no new buyer approval possible · no end-to-end flow works |
| 350 + 351 | Full access + quote flow · persisted evidence for journeys E / F / G / H / I |

## 4 · Sandbox project identity verification

Before any apply attempt, the apply-script MUST verify the connection
string points at `kdstoyyeygcopkogqsyv` (the sandbox project ref) and
NOT at `ijvqdvsvwtwxzcqmoqit` (the sealed production project ref).

The agreed verification is reading `NEX_SUPABASE_URL` and asserting the
host contains `kdstoyyeygcopkogqsyv.supabase.co` before issuing any
DDL. No secrets are quoted here · only the project ref.

If anything differs — STOP; do not apply.

## 5 · Intended DDL operations

```sql
CREATE TABLE IF NOT EXISTS public.nex_wholesale_quote (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id               uuid NOT NULL REFERENCES public.nex_business(id) ON DELETE CASCADE,
  buyer_account_id          uuid NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  product_id                uuid NOT NULL REFERENCES public.nex_product(id) ON DELETE RESTRICT,
  quantity                  integer NOT NULL CHECK (quantity > 0),
  currency                  text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  goods_unit_price_pence    bigint NOT NULL CHECK (goods_unit_price_pence >= 0),
  goods_subtotal_pence      bigint NOT NULL CHECK (goods_subtotal_pence >= 0),
  freight_pence             bigint CHECK (freight_pence IS NULL OR freight_pence >= 0),
  freight_method            text,
  transit_days_min          integer,
  transit_days_max          integer,
  duties_disposition        text CHECK (duties_disposition IS NULL OR duties_disposition IN ('seller_pays','buyer_pays','unspecified')),
  terms_note                text,
  status                    text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','quoted','accepted','rejected','expired','cancelled')),
  quoted_at                 timestamptz,
  buyer_accepted_at         timestamptz,
  buyer_rejected_at         timestamptz,
  cancelled_at              timestamptz,
  expires_at                timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  -- state-coherence + range CHECKs omitted here for brevity · see .sql
);
```

Plus three partial indexes, one updated_at trigger function + trigger,
four RLS policies, and explicit `REVOKE ALL FROM anon` with `GRANT
SELECT, INSERT, UPDATE TO authenticated`.

Exact source: `nex-supabase/migrations/351_nex_wholesale_quote_PROPOSAL.sql`.

## 6 · Affected tables / records / constraints / policies / grants

| Kind | Name | Operation |
|---|---|---|
| Table | `public.nex_wholesale_quote` | CREATE |
| FK | → `nex_business(id)` ON DELETE CASCADE | CREATE |
| FK | → `nex_account(id)` ON DELETE CASCADE | CREATE |
| FK | → `nex_product(id)` ON DELETE RESTRICT | CREATE |
| Index | `nex_wholesale_quote_owner_live_ix` (partial) | CREATE |
| Index | `nex_wholesale_quote_buyer_inbox_ix` | CREATE |
| Index | `nex_wholesale_quote_expires_ix` (partial) | CREATE |
| Function | `nex_wholesale_quote_touch_updated_at()` | CREATE OR REPLACE |
| Trigger | `nex_wholesale_quote_touch` | CREATE |
| Function | `nex_wholesale_quote_buyer_column_guard()` | CREATE OR REPLACE (added 2026-11-18 post-review · see §7) |
| Trigger | `nex_wholesale_quote_buyer_column_guard_t` | CREATE (added 2026-11-18 post-review · see §7) |
| Policy | `nex_wholesale_quote_owner_select` | CREATE |
| Policy | `nex_wholesale_quote_owner_insert` | CREATE |
| Policy | `nex_wholesale_quote_owner_update` | CREATE |
| Policy | `nex_wholesale_quote_buyer_select` | CREATE |
| Policy | `nex_wholesale_quote_buyer_update` | CREATE |
| Grant | `GRANT SELECT, INSERT, UPDATE ... TO authenticated` | GRANT |
| Grant | `REVOKE ALL ... FROM anon` | REVOKE |

No existing rows are updated. No existing columns are altered. No
existing policies or grants are modified. The migration is additive.

## 7 · Known RLS caveats to explicitly acknowledge

- **Buyer-column discipline is now enforced at the DB layer** by a
  BEFORE UPDATE trigger (`nex_wholesale_quote_buyer_column_guard_t`)
  added 2026-11-18 after a W21 review flagged the earlier
  column-permissive buyer UPDATE as a potential direct-DB authorisation
  gap. The trigger:
  - Short-circuits when the actor JWT resolves to NULL (service-role /
    maintenance callers — RLS is already bypassed and application code
    is trusted for those paths).
  - Short-circuits when the actor JWT resolves to the business owner
    (seller may freely edit their own quote under the owner UPDATE
    policy).
  - Otherwise, treats the actor as the buyer and RAISES if any of 17
    seller-controlled / identity-anchoring / lifecycle-timestamp columns
    differ between `OLD` and `NEW`:
    `business_id, buyer_account_id, product_id, quantity, currency,
    goods_unit_price_pence, goods_subtotal_pence, freight_pence,
    freight_method, transit_days_min, transit_days_max,
    duties_disposition, terms_note, quoted_at, cancelled_at,
    expires_at, created_at`.
  - Enforces the buyer status transition as `quoted → accepted` or
    `quoted → rejected` only. Any other `OLD→NEW` status move RAISES.
  - Permitted buyer-mutable columns: `status` (transitioning as above),
    `buyer_accepted_at`, `buyer_rejected_at`, `updated_at` (populated by
    the touch trigger regardless).
- **Application and DB enforcement are now distinct.** Server action
  `buyerAcceptQuoteAction` still restricts the writable column set in
  application code. The trigger exists as defence-in-depth for
  authenticated buyers who bypass the server action and UPDATE directly
  via `supabase-js` with their own anon-key JWT. Neither enforcement
  layer relies on the other.
- The buyer UPDATE **row** policy
  (`nex_wholesale_quote_buyer_update`) still limits WHICH rows a buyer
  can touch (their own row only). The trigger limits WHICH COLUMNS can
  change.
- The buyer INSERT path is NOT granted · buyers cannot write new quote
  rows at all. Only the seller can.
- No DELETE policy exists for anyone. Quote history is immutable audit.

## 8 · Open questions (reproduced from the SQL header)

> **Q1** · Quote expiry default. Proposal: 14 days. Overridable per quote.
>
> **Q2** · Duties/VAT disposition enum values. Proposal:
> `('seller_pays', 'buyer_pays', 'unspecified')`. "DDP" / "DAP"
> shorthand kept out to avoid Incoterms misuse; seller writes exact
> terms in `terms_note` if the deal is DDP/DAP.
>
> **Q3** · Whether a single wholesale order can span multiple products.
> Proposal: NO for Phase W · `product_id` is required. A multi-line
> order would require a different migration and would change the
> legacy snapshot-doctrine commitment (sealed 2026-11-10).
>
> **Q4** · Should buyer-accept be allowed only once per quote (no
> flip-flop)? Proposal: YES — once accepted or rejected, the row is
> terminal from the buyer side. Seller issues a new quote by creating
> a new row.

Owner decisions are required before apply · the proposal defaults are
baked in but can be changed with a short edit to the migration SQL
without altering the overall shape.

## 9 · Rollback

`DROP TABLE IF EXISTS public.nex_wholesale_quote CASCADE;` plus the
matching `DROP FUNCTION` + `DROP TRIGGER` statements are the rollback.
Rollback is NON-destructive to any OTHER table or data: no existing
schema object is modified by this migration, and the quote table is
entirely new.

Caveats:

- Any row inserted into the table between apply and rollback is
  destroyed by the CASCADE drop. Document any sandbox test rows before
  running the rollback.
- The matching rollback script (`351_PROPOSAL_rollback.sql`) will be
  authored as a sibling file in the **same follow-up pass that applies
  351**, so that the apply script and rollback script share identity
  checks. It is NOT authored yet; authoring it is part of the apply
  gate.

## 10 · Verification plan (post-apply, sandbox only)

After `apply migration 351 sandbox` is authorised AND migration 350
has already applied:

1. `SELECT regclass('public.nex_wholesale_quote');` → table exists.
2. `SELECT polname FROM pg_policies WHERE tablename =
   'nex_wholesale_quote';` → five policies present.
3. `SELECT has_table_privilege('anon',
   'public.nex_wholesale_quote', 'SELECT');` → false.
4. `SELECT has_table_privilege('authenticated',
   'public.nex_wholesale_quote', 'SELECT');` → true.
5. Vitest `wholesale/__tests__/` continues to pass.
6. Sandbox smoke: as an authorised test-seller + approved test-buyer,
   create → quote → accept flow proceeds end-to-end. Retain record IDs
   for the handback.
7. Negative (application layer): unauthorised buyer attempt to UPDATE
   `goods_unit_price_pence` via the server action is rejected by the
   action (the action does not call UPDATE with that column).
8. Negative (DB layer, new 2026-11-18): authenticated buyer UPDATE
   issued directly through `supabase-js` (bypassing the server action)
   that attempts to modify `goods_unit_price_pence` / `freight_pence` /
   any other protected column RAISES from the buyer-column-guard
   trigger. Confirm the raised message includes the exact column name.
9. Negative (DB layer, new 2026-11-18): authenticated buyer UPDATE that
   attempts a disallowed status transition (e.g. `accepted → cancelled`,
   `rejected → accepted`, `quoted → cancelled`) RAISES from the
   trigger.
10. Negative (RLS layer): buyer attempt to UPDATE another buyer's row
    is rejected by RLS before the trigger can run.

## 11 · Explicit non-authorisations

- This packet does NOT authorise applying migration 350.
- This packet does NOT authorise applying migration 351.
- This packet does NOT authorise any production change.
- This packet does NOT authorise commit / push / deploy.
- This packet does NOT authorise Stripe wiring or any live charge.

## 12 · Required word-trigger to apply

Verbatim, in a future authorised reply:

> `apply migration 351 sandbox`

Anything less specific (including this follow-up prompt, the earlier
"Okay", or a general affirmation) does NOT count.
