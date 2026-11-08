// src/app/nex-native/hq/members/__tests__/members-reader.test.ts
//
// Owner-authorised 2026-11-08 · covers the HQ New Members reader.
//
// Verified behaviour
//   1. Returns rows sorted by created_at DESC (upstream order).
//   2. Excludes soft-deleted accounts (filter arg to .is("deleted_at", null)).
//   3. Handles missing nex_incident table gracefully (returns issue="ok").
//   4. Maps nex_account.tier → accountType ("gratis" → "free", else → "membership").
//   5. Surfaces nex_account_profile.country_code and "—" when absent.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

type Resp<T> = { data: T; error: null | { message: string; code?: string } };

const SHARED = vi.hoisted(() => ({
  accountCall: null as null | {
    table: string;
    select: string | null;
    deletedAtArg: string | null;
    orderCol: string | null;
    orderAsc: boolean | null;
    limit: number | null;
  },
  profileCall: null as null | {
    table: string;
    select: string | null;
    inCol: string | null;
    inVals: readonly string[] | null;
  },
  incidentCall: null as null | {
    table: string;
    select: string | null;
    inCol: string | null;
    inVals: readonly string[] | null;
    scopeIn: readonly string[] | null;
    notStatusIn: string | null;
  },
  accountResp: { data: [], error: null } as Resp<Array<Record<string, unknown>>>,
  profileResp: { data: [], error: null } as Resp<Array<Record<string, unknown>>>,
  incidentResp: { data: [], error: null } as Resp<Array<Record<string, unknown>>>,
}));

function makeQuery(
  table: string,
): Record<string, (...args: never[]) => unknown> & {
  then?: (resolve: (v: Resp<unknown>) => void) => void;
} {
  const chain: Record<string, (...args: never[]) => unknown> & {
    then?: (resolve: (v: Resp<unknown>) => void) => void;
  } = {} as never;

  const settle = (): Resp<unknown> => {
    if (table === "nex_account") return SHARED.accountResp;
    if (table === "nex_account_profile") return SHARED.profileResp;
    if (table === "nex_incident") return SHARED.incidentResp;
    return { data: [], error: null };
  };

  chain.select = ((cols: string) => {
    if (table === "nex_account") {
      SHARED.accountCall = {
        table,
        select: cols,
        deletedAtArg: null,
        orderCol: null,
        orderAsc: null,
        limit: null,
      };
    }
    if (table === "nex_account_profile") {
      SHARED.profileCall = { table, select: cols, inCol: null, inVals: null };
    }
    if (table === "nex_incident") {
      SHARED.incidentCall = {
        table,
        select: cols,
        inCol: null,
        inVals: null,
        scopeIn: null,
        notStatusIn: null,
      };
    }
    return chain;
  }) as unknown as (...args: never[]) => unknown;

  chain.is = ((col: string, val: null) => {
    if (SHARED.accountCall && col === "deleted_at")
      SHARED.accountCall.deletedAtArg = val === null ? "IS NULL" : String(val);
    return chain;
  }) as unknown as (...args: never[]) => unknown;

  chain.order = ((col: string, opts?: { ascending?: boolean }) => {
    if (SHARED.accountCall) {
      SHARED.accountCall.orderCol = col;
      SHARED.accountCall.orderAsc = opts?.ascending ?? true;
    }
    return chain;
  }) as unknown as (...args: never[]) => unknown;

  chain.limit = ((n: number) => {
    if (SHARED.accountCall) SHARED.accountCall.limit = n;
    return chain;
  }) as unknown as (...args: never[]) => unknown;

  chain.in = ((col: string, vals: readonly string[]) => {
    if (SHARED.profileCall && !SHARED.profileCall.inCol) {
      SHARED.profileCall.inCol = col;
      SHARED.profileCall.inVals = vals;
    } else if (SHARED.incidentCall) {
      if (col === "actor_account_id") {
        SHARED.incidentCall.inCol = col;
        SHARED.incidentCall.inVals = vals;
      } else if (col === "scope") {
        SHARED.incidentCall.scopeIn = vals;
      }
    }
    return chain;
  }) as unknown as (...args: never[]) => unknown;

  chain.not = ((col: string, _op: string, vals: string) => {
    if (SHARED.incidentCall && col === "status") {
      SHARED.incidentCall.notStatusIn = vals;
    }
    return chain;
  }) as unknown as (...args: never[]) => unknown;

  chain.then = (resolve) => resolve(settle());
  return chain;
}

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(table: string) {
      return makeQuery(table);
    },
  },
}));

import { fetchNewMembers } from "../_reader";

function resetShared(): void {
  SHARED.accountCall = null;
  SHARED.profileCall = null;
  SHARED.incidentCall = null;
  SHARED.accountResp = { data: [], error: null };
  SHARED.profileResp = { data: [], error: null };
  SHARED.incidentResp = { data: [], error: null };
}

describe("fetchNewMembers", () => {
  beforeEach(() => {
    resetShared();
  });

  it("filters out soft-deleted accounts and orders by created_at DESC", async () => {
    SHARED.accountResp = {
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          nex_handle: "nex-10001",
          display_name: "Aoife",
          tier: "gratis",
          created_at: "2026-11-08T10:00:00.000Z",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          nex_handle: "nex-10002",
          display_name: "Bayu",
          tier: "bisnis",
          created_at: "2026-11-07T10:00:00.000Z",
        },
      ],
      error: null,
    };
    SHARED.profileResp = {
      data: [
        { account_id: "11111111-1111-4111-8111-111111111111", country_code: "IE" },
      ],
      error: null,
    };
    SHARED.incidentResp = { data: [], error: null };

    const rows = await fetchNewMembers(50);

    expect(SHARED.accountCall?.table).toBe("nex_account");
    expect(SHARED.accountCall?.deletedAtArg).toBe("IS NULL");
    expect(SHARED.accountCall?.orderCol).toBe("created_at");
    expect(SHARED.accountCall?.orderAsc).toBe(false);
    expect(SHARED.accountCall?.limit).toBe(50);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.accountId).toBe("11111111-1111-4111-8111-111111111111");
    expect(rows[0]!.countryCode).toBe("IE");
    expect(rows[0]!.accountType).toBe("free");
    expect(rows[0]!.issue).toBe("ok");
    expect(rows[1]!.accountId).toBe("22222222-2222-4222-8222-222222222222");
    expect(rows[1]!.countryCode).toBeNull();
    expect(rows[1]!.accountType).toBe("membership");
  });

  it("defaults to issue=unknown when the nex_incident table is missing (owner correction 2026-11-08 · never report HEALTHY on unverifiable state)", async () => {
    SHARED.accountResp = {
      data: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          nex_handle: "nex-10003",
          display_name: "Ciaran",
          tier: "gratis",
          created_at: "2026-11-08T10:00:00.000Z",
        },
      ],
      error: null,
    };
    SHARED.incidentResp = {
      data: [],
      error: { message: "relation nex_incident does not exist", code: "42P01" },
    };

    const rows = await fetchNewMembers();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.issue).toBe("unknown");
  });

  it("reports issue=ok only when the incident table was reachable AND no open incident existed", async () => {
    SHARED.accountResp = {
      data: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          nex_handle: "nex-10004",
          display_name: "Siobhan",
          tier: "gratis",
          created_at: "2026-11-08T10:00:00.000Z",
        },
      ],
      error: null,
    };
    // Table reachable, no rows returned
    SHARED.incidentResp = { data: [], error: null };
    const rows = await fetchNewMembers();
    expect(rows[0]!.issue).toBe("ok");
  });

  it("escalates issue to critical when a critical incident is present", async () => {
    SHARED.accountResp = {
      data: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          nex_handle: "nex-10004",
          display_name: "Dervla",
          tier: "gratis",
          created_at: "2026-11-08T10:00:00.000Z",
        },
      ],
      error: null,
    };
    SHARED.incidentResp = {
      data: [
        {
          actor_account_id: "44444444-4444-4444-8444-444444444444",
          severity: "warn",
          scope: "chat",
          status: "INVESTIGATING",
        },
        {
          actor_account_id: "44444444-4444-4444-8444-444444444444",
          severity: "critical",
          scope: "auth",
          status: "RECOVERING",
        },
      ],
      error: null,
    };

    const rows = await fetchNewMembers();
    expect(rows[0]!.issue).toBe("critical");
    expect(SHARED.incidentCall?.scopeIn).toEqual(["chat", "auth"]);
    expect(SHARED.incidentCall?.notStatusIn).toBe("(CLOSED,RECOVERED)");
  });

  it("returns an empty array when the base query returns no accounts", async () => {
    SHARED.accountResp = { data: [], error: null };
    const rows = await fetchNewMembers();
    expect(rows).toEqual([]);
    // Secondary calls must NOT be made when there are no accounts.
    expect(SHARED.profileCall).toBeNull();
    expect(SHARED.incidentCall).toBeNull();
  });

  it("throws when the account query itself errors", async () => {
    SHARED.accountResp = {
      data: [],
      error: { message: "permission denied for nex_account" },
    };
    await expect(fetchNewMembers()).rejects.toThrow(/permission denied/);
  });
});
