// src/lib/nex-native/admin-grant/__tests__/admin-grant-service.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_HQ = "22222222-2222-4222-8222-222222222222";

const STATE = vi.hoisted(() => ({
  probeError: null as null | { message: string },
  insertResult: {
    data: { id: "grant-uuid-1" } as { id: string } | null,
    error: null as null | { message: string },
  },
  insertedRows: [] as Array<{ table: string; row: Record<string, unknown> }>,
  selectRows: [] as Array<Record<string, unknown>>,
  selectSingleRow: null as null | Record<string, unknown>,
  hqSendResult: {
    ok: true,
    messageId: "msg-uuid-1",
    shouldThrow: null as null | { code: string; message: string },
  },
}));

vi.mock("../../supabase-admin", () => {
  // Supabase JS v2 chain pattern · every method returns the chain,
  // which is ALSO thenable so `await chain` resolves to a list-shape
  // response. maybeSingle() resolves to a single-shape response.
  function makeChain() {
    const chain: Record<string, unknown> = {};
    const list = () =>
      Promise.resolve({ data: STATE.selectRows, error: STATE.probeError });
    const single = () =>
      Promise.resolve({ data: STATE.selectSingleRow, error: STATE.probeError });
    chain.eq = () => chain;
    chain.is = () => chain;
    chain.gt = () => chain;
    chain.order = () => chain;
    chain.limit = () => chain;
    chain.maybeSingle = single;
    (chain as Record<string, unknown>).then = (
      resolve?: ((v: unknown) => unknown) | null,
      reject?: ((r: unknown) => unknown) | null,
    ) => list().then(resolve ?? undefined, reject ?? undefined);
    return chain;
  }
  return {
    nexSupabaseAdmin: {
      from(table: string) {
        return {
          select: () => makeChain(),
          insert(row: Record<string, unknown> | Record<string, unknown>[]) {
            const rows = Array.isArray(row) ? row : [row];
            for (const r of rows) STATE.insertedRows.push({ table, row: r });
            return {
              select: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: STATE.insertResult.data,
                    error: STATE.insertResult.error,
                  }),
              }),
            };
          },
        };
      },
    },
  };
});

vi.mock("../../hq-direct-channel/hq-direct-service", () => ({
  HqDirectError: class HqDirectError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "HqDirectError";
    }
  },
  sendHqMessage: vi.fn(async () => {
    if (STATE.hqSendResult.shouldThrow) {
      const { HqDirectError } = await import(
        "../../hq-direct-channel/hq-direct-service"
      );
      throw new HqDirectError(
        STATE.hqSendResult.shouldThrow.code as never,
        STATE.hqSendResult.shouldThrow.message,
      );
    }
    return {
      ok: true as const,
      messageId: STATE.hqSendResult.messageId,
    };
  }),
}));

vi.mock("../../security-audit-service", () => ({
  recordAuditEvent: vi.fn(() => Promise.resolve({ ok: true })),
}));

import {
  _resetAdminGrantProbeForTests,
  AdminGrantError,
  grantFreeTheme,
  grantShopMonths,
  hasActiveShopGrant,
  listActiveThemeGrants,
} from "../admin-grant-service";

describe("admin-grant-service · validation", () => {
  beforeEach(() => {
    _resetAdminGrantProbeForTests();
    STATE.probeError = null;
    STATE.insertResult = { data: { id: "grant-uuid-1" }, error: null };
    STATE.insertedRows = [];
    STATE.selectRows = [];
    STATE.selectSingleRow = null;
    STATE.hqSendResult = {
      ok: true,
      messageId: "msg-uuid-1",
      shouldThrow: null,
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("rejects invalid accountId shape", async () => {
    await expect(
      grantShopMonths({
        accountId: "not-a-uuid",
        months: 1,
        grantedBy: ACCOUNT_HQ,
      }),
    ).rejects.toThrow(AdminGrantError);
  });

  it("rejects invalid grantedBy shape", async () => {
    await expect(
      grantShopMonths({
        accountId: ACCOUNT_A,
        months: 1,
        grantedBy: "not-uuid",
      }),
    ).rejects.toThrow(AdminGrantError);
  });

  it("rejects months < 1", async () => {
    await expect(
      grantShopMonths({ accountId: ACCOUNT_A, months: 0, grantedBy: ACCOUNT_HQ }),
    ).rejects.toThrow(AdminGrantError);
  });

  it("rejects months > 12", async () => {
    await expect(
      grantShopMonths({ accountId: ACCOUNT_A, months: 13, grantedBy: ACCOUNT_HQ }),
    ).rejects.toThrow(AdminGrantError);
  });

  it("rejects non-integer months", async () => {
    await expect(
      grantShopMonths({ accountId: ACCOUNT_A, months: 1.5, grantedBy: ACCOUNT_HQ }),
    ).rejects.toThrow(AdminGrantError);
  });

  it("rejects malformed themeId", async () => {
    await expect(
      grantFreeTheme({
        accountId: ACCOUNT_A,
        themeId: "has spaces",
        grantedBy: ACCOUNT_HQ,
      }),
    ).rejects.toThrow(AdminGrantError);
  });

  it("rejects over-long note", async () => {
    await expect(
      grantShopMonths({
        accountId: ACCOUNT_A,
        months: 1,
        grantedBy: ACCOUNT_HQ,
        note: "x".repeat(401),
      }),
    ).rejects.toThrow(AdminGrantError);
  });
});

describe("grantShopMonths", () => {
  beforeEach(() => {
    _resetAdminGrantProbeForTests();
    STATE.probeError = null;
    STATE.insertResult = { data: { id: "grant-uuid-1" }, error: null };
    STATE.insertedRows = [];
    STATE.selectRows = [];
    STATE.hqSendResult = {
      ok: true,
      messageId: "msg-uuid-1",
      shouldThrow: null,
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("writes a shop grant with expires_at set", async () => {
    const r = await grantShopMonths({
      accountId: ACCOUNT_A,
      months: 3,
      grantedBy: ACCOUNT_HQ,
      note: "Paid direct 2026-11-08",
    });
    expect(r.ok).toBe(true);
    expect(r.grantId).toBe("grant-uuid-1");
    expect(STATE.insertedRows).toHaveLength(1);
    const row = STATE.insertedRows[0]!.row;
    expect(row.kind).toBe("shop");
    expect(row.shop_months).toBe(3);
    expect(typeof row.expires_at).toBe("string");
    expect(new Date(row.expires_at as string).getTime()).toBeGreaterThan(
      new Date(row.granted_at as string).getTime(),
    );
    // theme_id is not included in shop-grant writes (the DB default is
    // NULL; absence in the row is equivalent for our purposes).
    expect(row.theme_id).toBeUndefined();
    expect(row.note).toBe("Paid direct 2026-11-08");
  });

  it("returns table_not_available when migration 302 absent", async () => {
    _resetAdminGrantProbeForTests();
    STATE.probeError = { message: 'relation "nex_admin_grant" does not exist' };
    const r = await grantShopMonths({
      accountId: ACCOUNT_A,
      months: 1,
      grantedBy: ACCOUNT_HQ,
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("table_not_available");
    expect(STATE.insertedRows).toEqual([]);
  });

  it("surfaces member_not_found when chat bubble target is deleted", async () => {
    STATE.hqSendResult.shouldThrow = {
      code: "target_not_found",
      message: "target account not found or deleted",
    };
    const r = await grantShopMonths({
      accountId: ACCOUNT_A,
      months: 1,
      grantedBy: ACCOUNT_HQ,
    });
    expect(r.ok).toBe(true);
    expect(r.grantId).toBe("grant-uuid-1");
    expect(r.error).toBe("member_not_found");
  });
});

describe("grantFreeTheme", () => {
  beforeEach(() => {
    _resetAdminGrantProbeForTests();
    STATE.probeError = null;
    STATE.insertResult = { data: { id: "grant-uuid-2" }, error: null };
    STATE.insertedRows = [];
    STATE.selectRows = [];
    STATE.hqSendResult = {
      ok: true,
      messageId: "msg-uuid-2",
      shouldThrow: null,
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("writes a theme grant with no expiry", async () => {
    const r = await grantFreeTheme({
      accountId: ACCOUNT_A,
      themeId: "emerald-cinematic",
      grantedBy: ACCOUNT_HQ,
    });
    expect(r.ok).toBe(true);
    expect(r.grantId).toBe("grant-uuid-2");
    expect(STATE.insertedRows).toHaveLength(1);
    const row = STATE.insertedRows[0]!.row;
    expect(row.kind).toBe("theme");
    expect(row.theme_id).toBe("emerald-cinematic");
    // shop_months + expires_at are not included in theme-grant writes
    // (DB defaults to NULL; absence equivalent for our purposes).
    expect(row.shop_months).toBeUndefined();
    expect(row.expires_at).toBeUndefined();
  });
});

describe("readers", () => {
  beforeEach(() => {
    _resetAdminGrantProbeForTests();
    STATE.probeError = null;
    STATE.insertResult = { data: null, error: null };
    STATE.insertedRows = [];
    STATE.selectRows = [];
    STATE.selectSingleRow = null;
  });

  it("hasActiveShopGrant · false for invalid accountId", async () => {
    await expect(hasActiveShopGrant("not-uuid")).resolves.toBe(false);
  });

  it("hasActiveShopGrant · true when selectSingleRow has data", async () => {
    STATE.selectSingleRow = { id: "x" };
    await expect(hasActiveShopGrant(ACCOUNT_A)).resolves.toBe(true);
  });

  it("hasActiveShopGrant · false when table unavailable", async () => {
    _resetAdminGrantProbeForTests();
    STATE.probeError = { message: "schema cache missing" };
    await expect(hasActiveShopGrant(ACCOUNT_A)).resolves.toBe(false);
  });

  it("listActiveThemeGrants · returns theme_ids from result rows", async () => {
    STATE.selectRows = [{ theme_id: "emerald" }, { theme_id: "midnight" }];
    const out = await listActiveThemeGrants(ACCOUNT_A);
    expect([...out].sort()).toEqual(["emerald", "midnight"]);
  });
});
