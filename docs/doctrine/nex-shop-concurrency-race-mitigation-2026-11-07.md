# NEX Shop · concurrent product-creation race · mitigation design

**Owner-authorised investigation** · 2026-11-07
**Status**: MIGRATION PREPARED LOCALLY · NOT APPLIED TO PRODUCTION
**Blocks "concurrency fixed" claim**: live concurrency tests against the
applied migration (gated behind separate owner approval for an authorised
Postgres rehearsal).

## The race

Current flow in `src/lib/nex-native/billing/shop-tier-guard.ts`:

```
1. SELECT count(*) FROM nex_product WHERE business_id = $1 AND status IN ('live','draft');
2. If count < cap: pass
3. INSERT INTO nex_product (...) VALUES (...);
```

Between steps 1 and 3 another request can slip through:

```
Request A                    Request B
───────────────────────────  ───────────────────────────
count = N-1 → pass
                             count = N-1 → pass
INSERT → now N
                             INSERT → now N+1 (OVER CAP)
```

Both requests see N-1 under the cap. Both insert. Final count exceeds cap.
Severity: low at zero-user scale, climbs sharply at launch if any seller
scripts the create-product action.

## Why existing mechanisms are not enough

- **PostgREST/Supabase REST** · issues a single statement per request.
  No multi-statement transaction across the count + insert.
- **Row-level locking** · `SELECT ... FOR UPDATE` requires rows to exist.
  New product has no row yet.
- **Unique constraint** · `(business_id, position)` style doesn't fit
  because position is cosmetic, not a cap tracker.
- **CHECK constraint** · can't reference `count()` of sibling rows.
- **Trigger that counts siblings** · works but runs on every INSERT, needs
  the cap passed in via a per-session GUC or a lookup on
  `nex_account.shop_tier` · reasonable but more moving pieces than the
  RPC option.

## Chosen design · stored function + per-business advisory lock

Migration file: `nex-supabase/migrations/281_nex_product_create_with_cap_gate.sql`

```sql
CREATE OR REPLACE FUNCTION public.nex_product_create_with_cap_gate(...)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('nex-product-create-cap-gate:' || p_business_id::text, 0)
  );
  SELECT count(*) INTO v_active_count
    FROM nex_product
    WHERE business_id = p_business_id AND status IN ('live','draft');
  IF v_active_count >= p_cap THEN
    RAISE EXCEPTION '...' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO nex_product (...) VALUES (...) RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;
```

Properties:

- **Per-business granularity** — advisory lock keyed on `business_id`.
  Two requests for different shops do not serialise.
- **Transaction-scoped lock** — `pg_advisory_xact_lock` auto-releases on
  COMMIT/ROLLBACK · no manual unlock required · can't leak.
- **Single round-trip from app** — one RPC call replaces the current
  (count-query → in-app check → insert) three-round-trip dance.
- **ERRCODE = check_violation** — distinct from `unique_violation` so
  the app-layer catch block can map to "tier limit" specifically.
- **SECURITY DEFINER** with pinned `search_path = public, pg_temp` —
  routine privilege-escalation hygiene for PostgREST-exposed RPCs.
- **Rollback is trivial** — `DROP FUNCTION`; existing rows untouched.
  Companion file `281_...rollback.sql` provided.

## What the app layer does after the migration

`shop-tier-guard.ts` and `createProduct` in `product-service.ts` will
call the RPC instead of the current `count-then-insert`:

```ts
const { data: newId, error } = await nexSupabaseAdmin.rpc(
  'nex_product_create_with_cap_gate',
  { p_business_id, p_cap: spec.products.maxActive, ...rest }
);
if (error?.code === '23514') {
  // check_violation · tier cap reached
  throw new NexTierLimitError(...);
}
```

This code is **not written yet** because the migration is not applied.
Writing the call site before the function exists would produce a
guaranteed runtime error.

## Concurrency test plan (not yet executed)

Executes against a local scratch Postgres (Docker or Supabase local
dev) · not production:

1. Create a business `B` with `shop_tier='professional'` (cap 50).
2. Backfill 49 live products on `B`.
3. Fire **20 concurrent** `nex_product_create_with_cap_gate(B, 50, ...)`
   calls via `Promise.all`.
4. Assert: exactly 1 succeeds, 19 fail with `check_violation`.
5. Final count = 50. Not 51 or more.

Cross-business concurrency test:

6. Create two businesses `B1` + `B2`, each at count=49.
7. Fire 20 concurrent RPCs against B1 + 20 against B2 (40 total).
8. Assert: exactly 1 succeeds per business (2 total successes).
9. Different businesses did not block each other (end-to-end time
   shows parallelism · not sequential 40 × single-op time).

Deadlock sanity test:

10. Trigger two interleaved RPCs that each lock two businesses in
    opposite order (B1-then-B2 vs B2-then-B1). Assert: Postgres
    reports a deadlock and terminates one; it does NOT hang.
    (Not applicable to the current RPC since it locks ONE business
    per call, but documents why that's a deliberate design choice.)

## What would break if the migration is applied without the app-layer wiring

Nothing. The function exists but no caller invokes it yet. Current
non-RPC INSERTs continue to work (unchanged path). Harmless.

## What would break if the app-layer wiring is deployed without the migration

The RPC call would return an "undefined_function" error (ERRCODE 42883).
Every product-create would 500. **Deployment order is critical**:
migration must be applied first, caller code deployed second.

## Owner decision needed

- [ ] Approve local Postgres rehearsal of migration 281 (Docker)
- [ ] Approve concurrency tests outlined above
- [ ] Approve production application of migration 281 (requires separate rehearsal receipt + rollback-tested evidence)
- [ ] Approve deployment of the app-layer wiring (after 1 + 2 land)

Until then the **concurrency fix is NOT complete**. The migration is
prepared only. The claim in a future report must remain "prepared,
unrehearsed, not applied."
