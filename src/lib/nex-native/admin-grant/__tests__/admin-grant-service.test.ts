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

// Owner directive 2026-11-08 (round 11) Priority 4 · dedicated
// hq_admin_grant rate ring. Tests stub the limiter so individual
// cases can assert enforcement behaviour without running the real
// DB-backed limiter.
const RATE_STATE = vi.hoisted(() => ({
  calls: [] as Array<{ key: string; action: string }>,
  throwOnNth: null as null | number, // which call throws rate-limit
}));

class MockSecurityRateLimitError extends Error {
  readonly action: string;
  readonly retryAfterSeconds: number;
  constructor(action: string, retryAfterSeconds: number) {
    super(`throttled`);
    this.name = "SecurityRateLimitError";
    this.action = action;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

vi.mock("../../security-rate-limit", () => ({
  accountRateLimitKey: (id: string) => `acct:${id}`,
  isSecurityRateLimitError: (e: unknown) =>
    e instanceof MockSecurityRateLimitError,
  recordIfAllowed: (key: string, action: string) => {
    RATE_STATE.calls.push({ key, action });
    if (RATE_STATE.throwOnNth != null && RATE_STATE.calls.length === RATE_STATE.throwOnNth) {
      return Promise.reject(new MockSecurityRateLimitError(action, 42));
    }
    return Promise.resolve();
  },
}));

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

// ─── Priority 4 · hq_admin_grant rate ring (round 11) ──────────────

describe("hq_admin_grant rate ring", () => {
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
    RATE_STATE.calls = [];
    RATE_STATE.throwOnNth = null;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("calls recordIfAllowed with the dedicated hq_admin_grant action on shop grant", async () => {
    await grantShopMonths({
      accountId: ACCOUNT_A,
      months: 1,
      grantedBy: ACCOUNT_HQ,
    });
    expect(RATE_STATE.calls).toHaveLength(1);
    expect(RATE_STATE.calls[0]!.action).toBe("hq_admin_grant");
    expect(RATE_STATE.calls[0]!.key).toBe(`acct:${ACCOUNT_HQ}`);
  });

  it("calls recordIfAllowed with the dedicated hq_admin_grant action on theme grant", async () => {
    await grantFreeTheme({
      accountId: ACCOUNT_A,
      themeId: "emerald",
      grantedBy: ACCOUNT_HQ,
    });
    expect(RATE_STATE.calls).toHaveLength(1);
    expect(RATE_STATE.calls[0]!.action).toBe("hq_admin_grant");
  });

  it("throws AdminGrantError(rate_limited) with retryAfterSeconds when the ring trips", async () => {
    RATE_STATE.throwOnNth = 1;
    await expect(
      grantShopMonths({
        accountId: ACCOUNT_A,
        months: 1,
        grantedBy: ACCOUNT_HQ,
      }),
    ).rejects.toMatchObject({
      name: "AdminGrantError",
      code: "rate_limited",
      retryAfterSeconds: 42,
    });
    // No DB write when the ring trips.
    expect(STATE.insertedRows).toEqual([]);
  });

  it("does NOT share quota with account_create · only hq_admin_grant is consulted", async () => {
    await grantShopMonths({
      accountId: ACCOUNT_A,
      months: 1,
      grantedBy: ACCOUNT_HQ,
    });
    // The ring consulted was hq_admin_grant. If anyone wires
    // account_create here by accident this assertion catches it.
    const actions = RATE_STATE.calls.map((c) => c.action);
    expect(actions).toContain("hq_admin_grant");
    expect(actions).not.toContain("account_create");
  });

  it("per-operator quota · two different grantors each get their own slot in the ring", async () => {
    const GRANTOR_B = "33333333-3333-4333-8333-333333333333";
    await grantShopMonths({
      accountId: ACCOUNT_A,
      months: 1,
      grantedBy: ACCOUNT_HQ,
    });
    await grantShopMonths({
      accountId: ACCOUNT_A,
      months: 1,
      grantedBy: GRANTOR_B,
    });
    expect(RATE_STATE.calls).toHaveLength(2);
    expect(RATE_STATE.calls[0]!.key).toBe(`acct:${ACCOUNT_HQ}`);
    expect(RATE_STATE.calls[1]!.key).toBe(`acct:${GRANTOR_B}`);
  });

  it("rate check fires BEFORE the DB write · trip in the 3rd call blocks the 3rd write", async () => {
    RATE_STATE.throwOnNth = 3;
    await grantShopMonths({
      accountId: ACCOUNT_A,
      months: 1,
      grantedBy: ACCOUNT_HQ,
    });
    await grantShopMonths({
      accountId: ACCOUNT_A,
      months: 1,
      grantedBy: ACCOUNT_HQ,
    });
    await expect(
      grantShopMonths({
        accountId: ACCOUNT_A,
        months: 1,
        grantedBy: ACCOUNT_HQ,
      }),
    ).rejects.toMatchObject({ code: "rate_limited" });
    // Exactly 2 writes · the 3rd was blocked.
    expect(STATE.insertedRows).toHaveLength(2);
  });
});
