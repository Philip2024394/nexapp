// src/lib/nex-native/__tests__/update-business-profile-owner-scope.test.ts
//
// Lane C · prompt-7 round 11 · 2026-11-19.
//
// Service-layer ownership scope for `updateBusinessProfile`. This file
// isolates the business-service writer from any action-layer caller
// and asserts three contracts:
//
//   O1  Missing / empty `ownerAccountId` → throws before any DB call.
//   O2  Happy path → the issued UPDATE carries BOTH `.eq("id", id)`
//       AND `.eq("owner_account_id", ownerAccountId)`.
//   O3  Zero-row result (business owned by somebody else, OR business
//       missing) → throws `owner-mismatch`, never returns a row.
//
// NOTE: Mocked Postgres filters do NOT prove deployed RLS. They prove
// the writer issued the correctly-scoped query at the client layer.
// RLS verification is a separate live-DB evidence tier.

import { describe, test, expect, vi, beforeEach } from "vitest";

// ─── Supabase client mock ────────────────────────────────────────────
// Captures the full `.update(...).eq(...).eq(...).select(...).maybeSingle()`
// chain so the test can inspect the filter arguments the service passed.

interface ChainState {
  updatePatch?: Record<string, unknown>;
  eqs: Array<[string, unknown]>;
  selectCol?: string;
  // `nextResponse` is what `.maybeSingle()` returns · tests set this
  // before invoking the service.
  nextResponse: { data: unknown; error: { message: string } | null };
}

const state: ChainState = {
  eqs: [],
  nextResponse: { data: null, error: null },
};

function resetChain(): void {
  state.updatePatch = undefined;
  state.eqs = [];
  state.selectCol = undefined;
  state.nextResponse = { data: null, error: null };
}

const chain = {
  update(patch: Record<string, unknown>) {
    state.updatePatch = patch;
    return chain;
  },
  eq(col: string, val: unknown) {
    state.eqs.push([col, val]);
    return chain;
  },
  select(col: string) {
    state.selectCol = col;
    return chain;
  },
  maybeSingle() {
    return Promise.resolve(state.nextResponse);
  },
  // Column-probe path used by ensureOperatingCountryColumnReady · not
  // exercised in these tests but harmless to stub for safety.
  limit() {
    return Promise.resolve({ data: [], error: null });
  },
};

vi.mock("server-only", () => ({}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(_table: string) {
      return chain;
    },
  },
}));

// Shadow path used by relative imports inside business-service.ts.
vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(_table: string) {
      return chain;
    },
  },
}));

// tier-gate is dynamically imported inside createBusiness · not reached
// in these tests but mock it so a stray import can't hit the real DB.
vi.mock("@/lib/nex-native/tier-gate", () => ({
  assertCanCreateBusiness: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../tier-gate", () => ({
  assertCanCreateBusiness: vi.fn().mockResolvedValue(undefined),
}));

// ─── Fixtures ────────────────────────────────────────────────────────

const BUSINESS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";

async function loadSvc() {
  // Dynamic import so the module reads the mocked supabase-admin.
  return await import("../business-service");
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("business-service.updateBusinessProfile · owner scope (Lane C round 11)", () => {
  beforeEach(() => {
    resetChain();
  });

  test("O1 · missing ownerAccountId throws before any DB call", async () => {
    const { updateBusinessProfile } = await loadSvc();

    // Cast past the TS guard to simulate a future caller that forgets
    // to thread the owner id · the runtime guard is the last line of
    // defence.
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updateBusinessProfile as any)(BUSINESS_ID, "", { address: "1 High St" }),
    ).rejects.toThrow(/ownerAccountId is required/i);

    // Chain was never touched · no eq filters pushed.
    expect(state.eqs).toEqual([]);
    expect(state.updatePatch).toBeUndefined();
  });

  test("O2 · happy path carries BOTH id and owner_account_id filters", async () => {
    // Service returns a well-formed row so the function resolves.
    state.nextResponse = {
      data: {
        id: BUSINESS_ID,
        owner_account_id: OWNER_A,
        address: "1 High St",
      },
      error: null,
    };

    const { updateBusinessProfile } = await loadSvc();

    const row = await updateBusinessProfile(BUSINESS_ID, OWNER_A, {
      address: "1 High St",
    });

    expect(row.id).toBe(BUSINESS_ID);
    expect(row.owner_account_id).toBe(OWNER_A);

    // The writer must have scoped by BOTH id AND owner_account_id.
    const asMap = new Map(state.eqs);
    expect(asMap.get("id")).toBe(BUSINESS_ID);
    expect(asMap.get("owner_account_id")).toBe(OWNER_A);
    // Patch payload got through the normaliser (trim + store).
    expect(state.updatePatch).toMatchObject({ address: "1 High St" });
  });

  test("O3 · zero-row result throws owner-mismatch (never silent-ok)", async () => {
    // Simulate a mismatched-owner update · no error, but no row either.
    state.nextResponse = { data: null, error: null };

    const { updateBusinessProfile } = await loadSvc();

    await expect(
      updateBusinessProfile(BUSINESS_ID, OWNER_B, { address: "99 Other Rd" }),
    ).rejects.toThrow(/owner-mismatch/i);

    // Writer DID still issue the filtered update · defence-in-depth
    // applies at both the query layer AND the result inspection.
    const asMap = new Map(state.eqs);
    expect(asMap.get("id")).toBe(BUSINESS_ID);
    expect(asMap.get("owner_account_id")).toBe(OWNER_B);
  });
});
