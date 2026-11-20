// src/lib/nex-native/incident/__tests__/incident-transient-db-failure.test.ts
//
// A22 · Scenario 15 · Transient DB failure after warm probe.
// ----------------------------------------------------------
// After ensureIncidentTableReady() has cached the probe as `ok`,
// a subsequent insert throw must:
//   · return { ok: false } without throwing
//   · emit exactly one warn (no retry loop)
//   · NOT latch · the next healthy insert must succeed

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const STATE = vi.hoisted(() => ({
  insertMode: "healthy" as "healthy" | "fail",
  insertedRows: [] as Array<{ table: string; row: Record<string, unknown> }>,
  insertErrorMessage: "TransientPostgresError: connection reset",
}));

vi.mock("../../supabase-admin", () => {
  function makeSelectChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    chain.limit = () => chain;
    chain.eq = () => chain;
    chain.not = () => chain;
    chain.order = () => chain;
    chain.gte = () => chain;
    chain.lt = () => chain;
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
    (chain as Record<string, unknown>).then = (
      resolve?: ((v: unknown) => unknown) | null,
      reject?: ((r: unknown) => unknown) | null,
    ) =>
      // Probe succeeds every time. The failure is on the insert path,
      // AFTER the probe has cached ready=true.
      Promise.resolve({ data: [], error: null }).then(
        resolve ?? undefined,
        reject ?? undefined,
      );
    return chain;
  }
  return {
    nexSupabaseAdmin: {
      from(table: string) {
        return {
          select: () => makeSelectChain(),
          insert(row: Record<string, unknown> | Record<string, unknown>[]) {
            const rows = Array.isArray(row) ? row : [row];
            if (STATE.insertMode === "fail") {
              return {
                select: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: null,
                      error: { message: STATE.insertErrorMessage },
                    }),
                }),
              };
            }
            for (const r of rows) STATE.insertedRows.push({ table, row: r });
            return {
              select: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { id: "incident-uuid-after-recover" },
                    error: null,
                  }),
              }),
            };
          },
        };
      },
    },
  };
});

import { _resetIncidentProbeForTests, createIncident } from "../incident-service";

describe("Scenario 15 · transient DB failure after warm probe", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetIncidentProbeForTests();
    STATE.insertMode = "healthy";
    STATE.insertedRows = [];
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it(
    "warm probe + insert fails + next insert succeeds · fails closed, logs once, no latch",
    async () => {
      // Step 1 · warm the probe with a healthy insert (cache = ready).
      const warm = await createIncident({
        category: "service",
        severity: "info",
        scope: "chat",
        country: "ireland",
        summary: "warm-up probe",
      });
      expect(warm.ok).toBe(true);
      const warmLogCount = warnSpy.mock.calls.length;

      // Step 2 · flip the mock to fail · probe stays cached as ready.
      STATE.insertMode = "fail";
      STATE.insertedRows = [];
      const failed = await createIncident({
        category: "service",
        severity: "warn",
        scope: "chat",
        country: "ireland",
        summary: "transient failure case",
      });
      expect(failed.ok).toBe(false);
      // No partial row persisted during the failure
      expect(STATE.insertedRows).toEqual([]);
      // Exactly ONE additional warn vs. after step 1 · no retry loop
      const afterFailLogCount = warnSpy.mock.calls.length;
      expect(afterFailLogCount - warmLogCount).toBe(1);

      // Step 3 · flip back to healthy · service must NOT be latched
      STATE.insertMode = "healthy";
      STATE.insertedRows = [];
      const recovered = await createIncident({
        category: "service",
        severity: "info",
        scope: "chat",
        country: "ireland",
        summary: "recovered",
      });
      expect(recovered.ok).toBe(true);
      expect(recovered.incidentId).toBe("incident-uuid-after-recover");
    },
  );
});
