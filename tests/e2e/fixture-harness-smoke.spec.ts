// tests/e2e/fixture-harness-smoke.spec.ts
//
// Smoke test for tests/e2e/_fixtures/sandbox-test-harness.ts.
// Creates one account + business + product, asserts rows land in
// sandbox, tears down, asserts rows are gone. No browser work.
//
// Sandbox-only · sealed ref guard at entry · uniquely-marked records.

import { expect, test } from "@playwright/test";
import {
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  createTestProduct,
  supabaseAdmin,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

test.use({ storageState: { cookies: [], origins: [] } });

test("fixture harness · create+teardown round-trip", async () => {
  test.setTimeout(45_000);
  assertSandboxRef();

  const handles: FixtureHandle[] = [];
  let accountIdSnapshot: string | null = null;
  let businessIdSnapshot: string | null = null;
  let productIdSnapshot: string | null = null;

  try {
    const owner = await createTestAccount("smoke");
    handles.push(owner);
    accountIdSnapshot = owner.nexAccountId;

    const biz = await createTestBusiness(owner, { label: "smoke" });
    handles.push(biz);
    businessIdSnapshot = biz.businessId;

    const prod = await createTestProduct(biz, { name: "e2e-fixture-smoke-widget" });
    handles.push(prod);
    productIdSnapshot = prod.productId;

    // Assert rows exist in sandbox via admin SELECT.
    const sb = supabaseAdmin();
    const { data: accRow } = await sb
      .from("nex_account")
      .select("id, display_name")
      .eq("id", owner.nexAccountId)
      .maybeSingle();
    expect(accRow?.id, "account row must exist").toBe(owner.nexAccountId);

    const { data: bizRow } = await sb
      .from("nex_business")
      .select("id, slug, owner_account_id")
      .eq("id", biz.businessId)
      .maybeSingle();
    expect(bizRow?.id, "business row must exist").toBe(biz.businessId);
    expect(bizRow?.owner_account_id).toBe(owner.nexAccountId);

    const { data: prodRow } = await sb
      .from("nex_product")
      .select("id, business_id, status")
      .eq("id", prod.productId)
      .maybeSingle();
    expect(prodRow?.id, "product row must exist").toBe(prod.productId);
    expect(prodRow?.business_id).toBe(biz.businessId);
  } finally {
    await teardownAll(handles);
  }

  // After teardown, all three should be gone.
  const sb = supabaseAdmin();
  if (productIdSnapshot) {
    const { data } = await sb
      .from("nex_product")
      .select("id")
      .eq("id", productIdSnapshot)
      .maybeSingle();
    expect(data, "product row must be gone after teardown").toBeNull();
  }
  if (businessIdSnapshot) {
    const { data } = await sb
      .from("nex_business")
      .select("id")
      .eq("id", businessIdSnapshot)
      .maybeSingle();
    expect(data, "business row must be gone after teardown").toBeNull();
  }
  if (accountIdSnapshot) {
    const { data } = await sb
      .from("nex_account")
      .select("id")
      .eq("id", accountIdSnapshot)
      .maybeSingle();
    expect(data, "account row must be gone after teardown").toBeNull();
  }
});
