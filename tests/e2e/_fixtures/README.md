# Sandbox E2E fixture harness

Authored 2026-11-25 under owner approval for T5-T10 journey coverage.

## Boundaries

- **Sandbox only.** `assertSandboxRef()` throws before any write if
  `NEXT_PUBLIC_NEX_SUPABASE_URL` points at prod or an unknown project.
- **No RLS weakening.** Writes use the service-role admin client which
  bypasses RLS by Supabase design. The harness never alters RLS policies
  or grants.
- **Uniquely identifiable test records.** Every row carries the
  `e2e-fixture-` prefix (slug / name / email) so leaked rows are
  trivially identified in `SELECT`.
- **Teardown reverses creation order.** Products → businesses → accounts
  (matches FK `ON DELETE RESTRICT`).
- **No real payment credentials, no real charges.**

## Usage (Playwright spec)

```ts
import { test } from "@playwright/test";
import {
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  createTestProduct,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

test("some journey", async ({ page }) => {
  assertSandboxRef();
  const handles: FixtureHandle[] = [];
  try {
    const owner = await createTestAccount("merchant");
    handles.push(owner);
    const biz = await createTestBusiness(owner, { label: "shop" });
    handles.push(biz);
    const prod = await createTestProduct(biz, {
      name: "e2e-fixture-widget",
      pricePence: 999,
      currency: "GBP",
      status: "live",
    });
    handles.push(prod);

    // ... exercise the journey against page / API ...
  } finally {
    await teardownAll(handles);
  }
});
```

## Cleanup discipline

- **Always** push handles into the array as you create them.
- **Always** call `teardownAll` in `finally`. Even if the test fails
  halfway through, teardown still runs.
- **Never** rely on cascade for teardown — the FK direction on
  `nex_business.owner_account_id` is `RESTRICT`, so you must delete
  products → businesses → accounts in that order.
- If a prior run leaked rows (hung Node process, process kill), call
  `reclaimAbandonedTestRecords()` at suite setup — it hunts for rows
  older than 1 hour that match the fixture-prefix markers.

## What the harness does NOT provide (today)

- **Fresh browser-side authentication.** The harness creates the auth
  user server-side but does not mint a browser session. Specs that
  need the fixture account signed in must either (a) use the UI sign-in
  flow, or (b) await a future `mintSessionCookie` helper under
  separate authorisation.
- **Vault entitlement writes.** The sandbox is missing `vault_tier` /
  `shop_status` / `shop_period_end` / `vault_status` / `vault_period_end`
  columns pending migrations 207/257. The harness refuses to write
  columns that `information_schema.columns` says are absent.
- **Order / message / ledger fixtures.** T8 and T10 specs author their
  own seed inline via the harness primitives above.

## File shape

- `sandbox-test-harness.ts` — the module.
- `README.md` — this file.

No barrel export, no hidden imports, no cross-spec state.
