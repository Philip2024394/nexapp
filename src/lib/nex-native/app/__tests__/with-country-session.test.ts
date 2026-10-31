// Tests for withCountrySession · implements the T-POOL-1..T-POOL-9
// matrix from Rev A plan §4.5 using a mock pg client.
//
// What is tested here:
//   T-POOL-2  · fail-closed when identity resolver errors
//   T-POOL-3  · happy path · SET LOCAL inside txn · COMMIT
//   T-POOL-4  · work throws before commit → ROLLBACK fires
//   T-POOL-5  · explicit ROLLBACK propagates and client is released
//   T-POOL-6  · reused client across two country sessions sees own country only
//   T-POOL-7  · pool returns null (no NEX_POSTGRES_URL) → CountrySessionError no-pool
//
// What is NOT tested here (integration):
//   T-POOL-1  · real parallel sessions on the same pool
//   T-POOL-8  · preview DB isolation (covered by preview-db-guard tests)
//   T-POOL-9  · service-role path (not applicable to this wrapper)

import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import {
  withCountrySession,
  readCurrentAppCountry,
  CountrySessionError,
} from "../with-country-session";
import type { PgClientLike } from "@/lib/nex/db";

// ---- Mock pg pool at the shared db module ----
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

vi.mock("@/lib/nex/db", () => ({
  withClient: async <T>(fn: (c: PgClientLike) => Promise<T>): Promise<T | null> => {
    // Will be swapped by individual tests to null (no-pool) or by
    // delegating to mockClient for happy paths.
    return mockPoolImpl(fn);
  },
}));

let mockPoolImpl: <T>(fn: (c: PgClientLike) => Promise<T>) => Promise<T | null>;

function setPool(available: boolean, client: typeof mockClient = mockClient): void {
  if (!available) {
    mockPoolImpl = async () => null;
    return;
  }
  mockPoolImpl = async <T>(fn: (c: PgClientLike) => Promise<T>): Promise<T | null> => {
    try {
      return await fn(client as unknown as PgClientLike);
    } finally {
      client.release();
    }
  };
}

// ---- Env helpers ----
const ORIG_IDENTITY = process.env.NEX_APP_IDENTITY;
const ORIG_COUNTRY = process.env.NEX_APP_COUNTRY;
const ORIG_NODE_ENV = process.env.NODE_ENV;
function setEnv(id: string | undefined, country: string | undefined): void {
  if (id === undefined) delete process.env.NEX_APP_IDENTITY;
  else process.env.NEX_APP_IDENTITY = id;
  if (country === undefined) delete process.env.NEX_APP_COUNTRY;
  else process.env.NEX_APP_COUNTRY = country;
  (process.env as Record<string, string>).NODE_ENV = "production" as string;
}

beforeEach(() => {
  mockClient.query.mockReset();
  mockClient.release.mockReset();
  setPool(true);
});

afterEach(() => {
  if (ORIG_IDENTITY === undefined) delete process.env.NEX_APP_IDENTITY;
  else process.env.NEX_APP_IDENTITY = ORIG_IDENTITY;
  if (ORIG_COUNTRY === undefined) delete process.env.NEX_APP_COUNTRY;
  else process.env.NEX_APP_COUNTRY = ORIG_COUNTRY;
  if (ORIG_NODE_ENV === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV;
  else (process.env as Record<string, string>).NODE_ENV = ORIG_NODE_ENV;
});

describe("withCountrySession · T-POOL-3 happy path", () => {
  it("opens tx, sets GUC, runs work, commits", async () => {
    setEnv("ireland", "IE");
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const out = await withCountrySession(async (ctx) => {
      expect(ctx.country).toBe("IE");
      return "work-result";
    });
    expect(out).toBe("work-result");
    const callOrder = mockClient.query.mock.calls.map((c) => c[0] as string);
    expect(callOrder[0]).toBe("BEGIN");
    expect(callOrder[1]).toMatch(/set_config\('nex\.app_country'/);
    expect(callOrder[2]).toBe("COMMIT");
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("GUC value is parameterised with the resolved country", async () => {
    setEnv("indonesia", "ID");
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await withCountrySession(async () => "ok");
    const setConfigCall = mockClient.query.mock.calls.find(
      (c) => (c[0] as string).includes("set_config"),
    );
    expect(setConfigCall?.[1]).toEqual(["ID"]);
  });
});

describe("withCountrySession · T-POOL-4 work throws before commit", () => {
  it("rolls back and surfaces the original error", async () => {
    setEnv("ireland", "IE");
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(
      withCountrySession(async () => {
        throw new Error("work-exploded");
      }),
    ).rejects.toThrow("work-exploded");

    const callOrder = mockClient.query.mock.calls.map((c) => c[0] as string);
    expect(callOrder).toContain("BEGIN");
    expect(callOrder).toContain("ROLLBACK");
    expect(callOrder).not.toContain("COMMIT");
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});

describe("withCountrySession · T-POOL-5 explicit rollback by work", () => {
  it("propagates when work emits a controlled error after a partial write", async () => {
    setEnv("ireland", "IE");
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(
      withCountrySession(async (ctx) => {
        await ctx.client.query("UPDATE nex_business SET name = $1 WHERE id = $2", ["x", "y"]);
        throw new Error("validation-failed");
      }),
    ).rejects.toThrow("validation-failed");

    const callOrder = mockClient.query.mock.calls.map((c) => c[0] as string);
    expect(callOrder.filter((s) => s === "ROLLBACK").length).toBe(1);
    expect(callOrder).not.toContain("COMMIT");
  });

  it("secondary rollback error does not swallow the original", async () => {
    setEnv("ireland", "IE");
    // Fail on ROLLBACK too.
    mockClient.query.mockImplementation(async (text: string) => {
      if (text === "ROLLBACK") throw new Error("rollback-failed");
      return { rows: [], rowCount: 0 };
    });

    await expect(
      withCountrySession(async () => {
        throw new Error("original");
      }),
    ).rejects.toThrow("original");
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});

describe("withCountrySession · T-POOL-6 reused client between countries", () => {
  it("second session's GUC overrides first (set_config transactional)", async () => {
    // Simulate the pool handing the same client twice.
    const shared = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    setPool(true, shared);

    setEnv("ireland", "IE");
    await withCountrySession(async () => "ok");

    setEnv("indonesia", "ID");
    await withCountrySession(async () => "ok");

    const setConfigCalls = shared.query.mock.calls
      .filter((c) => (c[0] as string).includes("set_config"))
      .map((c) => c[1]);
    expect(setConfigCalls[0]).toEqual(["IE"]);
    expect(setConfigCalls[1]).toEqual(["ID"]);
    expect(shared.release).toHaveBeenCalledTimes(2);
  });
});

describe("withCountrySession · T-POOL-2 fail-closed", () => {
  it("HQ identity (no country) throws CountrySessionError no-country", async () => {
    setEnv("hq", undefined);
    await expect(
      withCountrySession(async () => "ok"),
    ).rejects.toMatchObject({ code: "no-country" });
  });

  it("missing identity throws (resolver fail-closed)", async () => {
    setEnv(undefined, undefined);
    await expect(
      withCountrySession(async () => "ok"),
    ).rejects.toThrow();
  });
});

describe("withCountrySession · T-POOL-7 no pool", () => {
  it("throws CountrySessionError no-pool when pg pool is unavailable", async () => {
    setEnv("ireland", "IE");
    setPool(false);
    await expect(
      withCountrySession(async () => "ok"),
    ).rejects.toMatchObject({ code: "no-pool" });
  });
});

describe("readCurrentAppCountry", () => {
  it("returns value when set", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ v: "IE" }], rowCount: 1 }),
      release: vi.fn(),
    };
    const v = await readCurrentAppCountry(client as unknown as PgClientLike);
    expect(v).toBe("IE");
  });

  it("returns null when empty string (fail-closed)", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ v: "" }], rowCount: 1 }),
      release: vi.fn(),
    };
    const v = await readCurrentAppCountry(client as unknown as PgClientLike);
    expect(v).toBeNull();
  });
});
