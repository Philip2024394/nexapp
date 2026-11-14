// src/lib/nex-native/billing/__tests__/stripe-connect-detect-columns.test.ts
//
// Payment audit 2026-11-14 · regression for the sealed detectConnectColumns
// bug fix. The prior implementation queried `information_schema.columns`
// via the Supabase REST client, which PostgREST does not expose by
// default. The call always errored and the function returned false ·
// `/billing/connect/stripe/create` then responded `columns_not_applied`
// 422 even when migration 311 was fully applied.
//
// The new implementation attempts to `SELECT stripe_connect_account_id
// FROM nex_business LIMIT 0`. We assert:
//
//   1. Clean 200 (no error) → columns ARE applied · returns true
//   2. Error code `42703` (column missing) → columns NOT applied · returns false
//   3. Error message "does not exist" → columns NOT applied · returns false
//   4. Unknown transient error → fails OPEN (true) so a Supabase blip
//      doesn't mis-report applied migrations as unapplied
//   5. Query throws → false (safety fallback)
//   6. Column queried IS one of the sealed migration-311 columns
//      and uses the `nex_business` public table (NOT information_schema).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { fromMock, selectMock, limitMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  limitMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: fromMock,
  },
}));

function setProbeResult(result: { error: unknown } | (() => never)) {
  if (typeof result === "function") {
    limitMock.mockImplementation(result as () => never);
  } else {
    limitMock.mockResolvedValue(result);
  }
  selectMock.mockReturnValue({ limit: limitMock });
  fromMock.mockReturnValue({ select: selectMock });
}

async function loadDetector() {
  vi.resetModules();
  return (await import("@/lib/nex-native/billing/stripe-connect-service"))
    .detectConnectColumns;
}

beforeEach(() => {
  fromMock.mockReset();
  selectMock.mockReset();
  limitMock.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("detectConnectColumns · payment audit 2026-11-14 bug fix", () => {
  it("returns TRUE when Supabase returns no error (columns applied)", async () => {
    setProbeResult({ error: null });
    const detect = await loadDetector();
    expect(await detect()).toBe(true);
  });

  it("returns FALSE on Postgres column-missing code 42703", async () => {
    setProbeResult({
      error: { code: "42703", message: "column stripe_connect_account_id does not exist" },
    });
    const detect = await loadDetector();
    expect(await detect()).toBe(false);
  });

  it("returns FALSE when message says 'does not exist' (no code)", async () => {
    setProbeResult({
      error: { message: "column stripe_connect_account_id does not exist" },
    });
    const detect = await loadDetector();
    expect(await detect()).toBe(false);
  });

  it("fails OPEN (returns TRUE) on unknown transient error · does not mis-report applied migration", async () => {
    setProbeResult({
      error: { code: "PGRST000", message: "transient blip" },
    });
    const detect = await loadDetector();
    expect(await detect()).toBe(true);
  });

  it("returns FALSE when the probe query throws", async () => {
    setProbeResult(() => {
      throw new Error("network down");
    });
    const detect = await loadDetector();
    expect(await detect()).toBe(false);
  });

  it("queries nex_business (NOT information_schema.columns)", async () => {
    setProbeResult({ error: null });
    const detect = await loadDetector();
    await detect();
    const tables = fromMock.mock.calls.map((c) => c[0]);
    expect(tables).toContain("nex_business");
    expect(tables).not.toContain("information_schema.columns");
  });

  it("probes a sealed migration-311 column (stripe_connect_account_id)", async () => {
    setProbeResult({ error: null });
    const detect = await loadDetector();
    await detect();
    expect(selectMock).toHaveBeenCalledWith("stripe_connect_account_id");
  });

  it("probes with LIMIT 0 to avoid pulling row data into the probe", async () => {
    setProbeResult({ error: null });
    const detect = await loadDetector();
    await detect();
    expect(limitMock).toHaveBeenCalledWith(0);
  });
});
