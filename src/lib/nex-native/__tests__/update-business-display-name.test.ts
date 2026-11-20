// src/lib/nex-native/__tests__/update-business-display-name.test.ts
//
// Lane C · prompt-7 round 18 · 2026-11-19.
//
// Service-layer ownership scope for `updateBusinessDisplayName`. Round
// 17 inlined the display_name write at the ACTION layer with an owner
// clause. Round 18 moved that write behind this service helper so the
// legacy identity action AND the new business-details action share
// ONE enforcement surface. This file isolates the writer and asserts
// four contracts:
//
//   D1  Missing / empty `ownerAccountId` → throws before any DB call.
//   D2  Invalid displayName (non-string OR length < 2 OR > 40 after
//       trim) → throws before any DB call.
//   D3  Happy path → the issued UPDATE carries BOTH `.eq("id", id)`
//       AND `.eq("owner_account_id", ownerAccountId)` with the
//       trimmed display_name payload.
//   D4  Zero-row result (business owned by somebody else, OR business
//       missing) → throws `owner-mismatch`, never returns a row.
//
// Mocked Postgres filters do NOT prove deployed RLS · they prove the
// writer issued the correctly-scoped query at the client layer. RLS
// verification is a separate live-DB evidence tier gated on the
// sandbox-approval request documented in ledger §16.38.

import { describe, test, expect, vi, beforeEach } from "vitest";

// ─── Supabase client mock ────────────────────────────────────────────

interface ChainState {
  updatePatch?: Record<string, unknown>;
  eqs: Array<[string, unknown]>;
  selectCol?: string;
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

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(_table: string) {
      return chain;
    },
  },
}));

vi.mock("@/lib/nex-native/tier-gate", () => ({
  assertCanCreateBusiness: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../tier-gate", () => ({
  assertCanCreateBusiness: vi.fn().mockResolvedValue(undefined),
}));

const BUSINESS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";

async function loadSvc() {
  return await import("../business-service");
}

describe("business-service.updateBusinessDisplayName · owner scope (Lane C round 18)", () => {
  beforeEach(() => {
    resetChain();
  });

  test("D1 · missing ownerAccountId throws before any DB call", async () => {
    const { updateBusinessDisplayName } = await loadSvc();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updateBusinessDisplayName as any)(BUSINESS_ID, "", "My Shop"),
    ).rejects.toThrow(/ownerAccountId is required/i);
    expect(state.eqs).toEqual([]);
    expect(state.updatePatch).toBeUndefined();
  });

  test("D2a · displayName shorter than 2 chars throws before any DB call", async () => {
    const { updateBusinessDisplayName } = await loadSvc();
    await expect(
      updateBusinessDisplayName(BUSINESS_ID, OWNER_A, "A"),
    ).rejects.toThrow(/2-40 chars/i);
    expect(state.eqs).toEqual([]);
    expect(state.updatePatch).toBeUndefined();
  });

  test("D2b · displayName longer than 40 chars throws before any DB call", async () => {
    const { updateBusinessDisplayName } = await loadSvc();
    const tooLong = "x".repeat(41);
    await expect(
      updateBusinessDisplayName(BUSINESS_ID, OWNER_A, tooLong),
    ).rejects.toThrow(/2-40 chars/i);
    expect(state.eqs).toEqual([]);
  });

  test("D2c · non-string displayName throws before any DB call", async () => {
    const { updateBusinessDisplayName } = await loadSvc();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updateBusinessDisplayName as any)(BUSINESS_ID, OWNER_A, 123),
    ).rejects.toThrow(/must be a string/i);
    expect(state.eqs).toEqual([]);
  });

  test("D2d · whitespace-only displayName fails the length check", async () => {
    const { updateBusinessDisplayName } = await loadSvc();
    await expect(
      updateBusinessDisplayName(BUSINESS_ID, OWNER_A, "   "),
    ).rejects.toThrow(/2-40 chars/i);
    expect(state.eqs).toEqual([]);
  });

  test("D3 · happy path carries BOTH id and owner_account_id filters and the trimmed name", async () => {
    state.nextResponse = {
      data: {
        id: BUSINESS_ID,
        owner_account_id: OWNER_A,
        display_name: "Irish Pride",
      },
      error: null,
    };
    const { updateBusinessDisplayName } = await loadSvc();
    const row = await updateBusinessDisplayName(
      BUSINESS_ID,
      OWNER_A,
      "  Irish Pride  ",
    );
    expect(row.id).toBe(BUSINESS_ID);
    expect(row.owner_account_id).toBe(OWNER_A);
    const asMap = new Map(state.eqs);
    expect(asMap.get("id")).toBe(BUSINESS_ID);
    expect(asMap.get("owner_account_id")).toBe(OWNER_A);
    expect(state.updatePatch).toEqual({ display_name: "Irish Pride" });
  });

  test("D4 · zero-row result throws owner-mismatch (never silent-ok)", async () => {
    state.nextResponse = { data: null, error: null };
    const { updateBusinessDisplayName } = await loadSvc();
    await expect(
      updateBusinessDisplayName(BUSINESS_ID, OWNER_B, "Other Shop"),
    ).rejects.toThrow(/owner-mismatch/i);
    const asMap = new Map(state.eqs);
    expect(asMap.get("id")).toBe(BUSINESS_ID);
    expect(asMap.get("owner_account_id")).toBe(OWNER_B);
  });

  test("D5 · supabase error bubbles up with the service-layer prefix", async () => {
    state.nextResponse = {
      data: null,
      error: { message: "network timeout" },
    };
    const { updateBusinessDisplayName } = await loadSvc();
    await expect(
      updateBusinessDisplayName(BUSINESS_ID, OWNER_A, "Irish Pride"),
    ).rejects.toThrow(/updateBusinessDisplayName.*network timeout/);
  });
});
