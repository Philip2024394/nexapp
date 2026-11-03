# NEX Billing · F-series design · Vault atomic quota wire-in

Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · DECISION PENDING).

## Problem

Owner-recommended **D4** says:
> "Use a per-account database lock row with transaction-level row locking.
> The quota check AND the reservation must be atomic. Avoid relying on
> an unchecked application-level count."

The current `vault/_upload-action.ts` flow:
1. Validates per-file 50 MB cap (sealed B2 · wired)
2. Calls `vaultFileService.insertVaultFileMetadata` via the Supabase JS
   admin client · a different connection pool than the pg adapter

Our pg adapter has `withAccountLock` which does `SELECT ... FOR UPDATE`
on the account row inside a transaction. It CANNOT serialise against
the Supabase JS client because they use different connections. Two
concurrent uploads can therefore each pass a pre-check and each insert
past the per-tier cap.

Shipping a non-atomic pre-check would violate D4. So the quota wire-in
is **deferred** until one of the options below ships.

---

## Option A · Port the vault INSERT through the pg adapter

### Shape

Add a method on `SupabaseBillingStore` (or a sibling service) that performs
the `nex_vault_file` INSERT using the same `pg.Pool`. Inside
`withAccountLock`, the SUM query AND the INSERT share one BEGIN/COMMIT.

```ts
async insertVaultFile(
  input: VaultFileInsert,
  txStore: SupabaseBillingStore,
): Promise<VaultFileRow> { ... }
```

Call site:
```ts
await store.withAccountLock(accountId, async (tx) => {
  const sum = await _sumVaultUsageBytes(tx, accountId);
  if (sum + addingBytes > cap) throw new QuotaExceeded();
  return insertVaultFile(input, tx); // same transaction
});
```

### Pros

- Uses existing D4 primitive (`withAccountLock`) · no new infra
- Easy to test with the FakePool pattern we already have
- Rollback semantics are already proven at the adapter layer

### Cons

- **Duplicates logic** that currently lives in `vaultFileService.insertVaultFileMetadata`:
  - category validation (`VAULT_FILE_CATEGORIES`)
  - migration_state=legacy sealed ingest path
  - legacy_bytes_path CHECK invariant
  - deterministic bucket path derivation
- Risk of drift · two code paths to maintain
- Does not touch the Supabase storage bucket upload (that still happens
  AFTER the transaction commits · fine for atomicity but means a storage
  failure requires compensating DELETE which already exists)
- Requires an audit of `vaultFileService` to catalogue every side effect
  the "canonical path" performs

### Scope of work

- Design `VaultFileInsert` shape matching the existing service
- Add adapter method that inserts into `nex_vault_file` with pg · parameterised SQL
- Port category validation + migration_state + legacy_bytes_path semantics
- Replace `vaultFileService.insertVaultFileMetadata` call in `_upload-action.ts` with the new path when a paid tier is active
- Add tests for every invariant the Supabase JS path currently enforces
- **Expected size**: 400–600 lines of new/modified code · 3–5 days of focused work
- Requires owner sign-off because it duplicates sealed Vault ingest logic

---

## Option B · Postgres RPC function (DEFINER-secured)

### Shape

Create a Postgres function invoked via the Supabase JS client that
performs quota-check + INSERT inside the function's own transaction:

```sql
CREATE OR REPLACE FUNCTION nex_vault_file_reserve_insert(
  p_account_id   uuid,
  p_byte_size    bigint,
  p_tier_cap     bigint,
  p_display_name text,
  p_mime_type    text,
  p_folder_path  text,
  p_category     text,
  p_migration_state text
) RETURNS TABLE(id uuid, ...)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_used bigint;
BEGIN
  -- Acquire row-level lock on the account
  PERFORM 1 FROM nex_account WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'account_not_found'; END IF;

  SELECT COALESCE(SUM(byte_size), 0)::bigint INTO v_used
    FROM nex_vault_file WHERE account_id = p_account_id;

  IF v_used + p_byte_size > p_tier_cap THEN
    RAISE EXCEPTION 'quota_exceeded' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
    INSERT INTO nex_vault_file (
      account_id, byte_size, display_name, mime_type,
      folder_path, category, migration_state, legacy_bytes_path
    ) VALUES (
      p_account_id, p_byte_size, p_display_name, p_mime_type,
      p_folder_path, p_category, p_migration_state, ... -- deterministic
    ) RETURNING id, ...;
END;
$$;
```

Call site (TypeScript via `nexSupabaseAdmin.rpc`):
```ts
const { data, error } = await nexSupabaseAdmin.rpc(
  "nex_vault_file_reserve_insert",
  { p_account_id: ..., p_byte_size: file.size, p_tier_cap: cap, ... }
);
if (error?.message === "quota_exceeded") return { ok: false, reason: "..." };
```

### Pros

- Entirely in Postgres · guaranteed atomic
- No duplication of insert logic in TypeScript
- Reuses existing `nexSupabaseAdmin` connection (unified connection pool)
- Trivially testable at the SQL level via the scratch rehearsal

### Cons

- Requires a new migration (259 or later) to create the function
- SECURITY DEFINER functions need careful review (search_path, grants)
- Legacy_bytes_path CHECK invariant is harder to reproduce atomically in
  SQL · may need a separate trigger OR the caller continues to construct
  the path and pass it in
- Harder to iterate on logic (edit a migration vs edit a TypeScript file)
- Error handling via SQL error codes requires discipline on the TS side

### Scope of work

- Design the function signature and error shape
- Draft migration 259 (or next available slot)
- Write TypeScript wrapper that converts SQL errors to typed outcomes
- Add tests at both the SQL level (scratch rehearsal) and the TS level
- Replace call site in `_upload-action.ts`
- **Expected size**: 150–250 lines · 2–3 days
- Needs owner sign-off on the new migration

---

## Comparison

| Dimension | Option A · pg port | Option B · RPC function |
|---|---|---|
| Atomicity | ✅ (within `withAccountLock`) | ✅ (within SQL function) |
| New migration required | ❌ | ✅ |
| Duplicates existing TS logic | ✅ (medium risk of drift) | ❌ |
| Testable with current mock-pool pattern | ✅ | ⚠️ needs scratch rehearsal |
| Legacy ingest path preservation | ⚠️ (manual port) | ✅ (DB native) |
| Scope | 400-600 LOC · 3-5 days | 150-250 LOC + migration · 2-3 days |
| Blast radius if wrong | medium (parallel code path) | low (RPC function can be dropped) |
| Owner approvals needed | 1 (code review) | 2 (migration + RPC design) |

---

## Recommendation (claude view · not sealed)

**Option B** is cleaner. Atomic quota is a database concern; expressing it
in SQL gives the strongest guarantee and avoids duplicating sealed Vault
ingest logic in TypeScript. The migration cost is small and matches our
existing scratch-rehearsal verification path.

The one caveat is the `legacy_bytes_path` CHECK invariant. If the DB
can derive it (e.g. `format('%s/%s', p_account_id, id)` inside the
function) then B is strictly simpler. If the TypeScript side must still
construct the path and pass it, both options are closer in complexity.

**Not shipping without explicit owner authorisation.** This document is
a decision record · not an implementation plan.

---

## Open sub-questions for the owner

1. Can `legacy_bytes_path` be derived server-side inside the function, or
   must the Node side continue to compute it?
2. Is a migration **259** acceptable, or should the function live in a
   later migration slot after the 214/257 collision is resolved?
3. Who owns review of SECURITY DEFINER semantics (search_path, grants,
   row-level security interactions)?
4. For the storage-bucket upload step, should it live INSIDE the atomic
   path (requires 2PC-like compensation on failure) or OUTSIDE (current
   pattern · compensating DELETE on upload failure)?

The current recommendation is: keep the storage upload OUTSIDE the atomic
path, with the existing compensating DELETE. The atomicity we care about
is **"two concurrent uploads cannot both reserve past the cap"** · the
storage layer failures are already a separate concern.
