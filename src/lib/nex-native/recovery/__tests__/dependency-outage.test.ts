// src/lib/nex-native/recovery/__tests__/dependency-outage.test.ts
//
// Simulate outages of each core dependency (database, storage,
// incident table, audit table) and prove:
//   · The probe reports the correct status (down / degraded / unknown).
//   · The monitor emits a scoped degradation incident when appropriate.
//   · Probes NEVER report HEALTHY on insufficient evidence · missing
//     tables yield UNKNOWN, not false-OK.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const STATE = vi.hoisted(() => ({
  dbError: null as null | { message: string },
  dbLatencyMs: 10,
  storageError: null as null | { message: string },
  storageLatencyMs: 10,
  buckets: [] as unknown[],
  incidentError: null as null | { message: string },
  auditError: null as null | { message: string },
}));

vi.mock("../../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(table: string) {
      return {
        select: () => ({
          limit: () => {
            if (table === "nex_migration_history") {
              const p = new Promise((resolve) => {
                setTimeout(
                  () => resolve({ data: [], error: STATE.dbError }),
                  STATE.dbLatencyMs,
                );
              });
              return p;
            }
            if (table === "nex_incident")
              return Promise.resolve({ data: [], error: STATE.incidentError });
            if (table === "nex_security_audit_log")
              return Promise.resolve({ data: [], error: STATE.auditError });
            return Promise.resolve({ data: [], error: null });
          },
        }),
      };
    },
    storage: {
      listBuckets: () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                data: STATE.storageError ? null : STATE.buckets,
                error: STATE.storageError,
              }),
            STATE.storageLatencyMs,
          );
        }),
    },
  },
}));

const SHARED = vi.hoisted(() => ({
  createCalls: [] as Array<{
    category: string;
    severity: string;
    scope: string;
    country: string;
    summary: string;
    adminActionRequired?: boolean;
    usersAffectedCount?: number;
  }>,
  createResult: {
    ok: true as boolean,
    incidentId: "incident-stub" as string | undefined,
    skipped: undefined as string | undefined,
  },
}));

vi.mock("../../incident/incident-service", () => ({
  createIncident: (input: (typeof SHARED)["createCalls"][number]) => {
    SHARED.createCalls.push(input);
    return Promise.resolve({
      ok: SHARED.createResult.ok,
      incidentId: SHARED.createResult.incidentId,
      skipped: SHARED.createResult.skipped,
    });
  },
}));

import {
  probeAuditTable,
  probeDatabase,
  probeIncidentTable,
  probeStorage,
} from "../../health/health-probes";
import {
  _resetMonitorDedupForTests,
  reportDependencyDegradation,
} from "../../security-monitor/security-monitor";

function resetAll() {
  _resetMonitorDedupForTests();
  STATE.dbError = null;
  STATE.dbLatencyMs = 10;
  STATE.storageError = null;
  STATE.storageLatencyMs = 10;
  STATE.buckets = [{ id: "a" }];
  STATE.incidentError = null;
  STATE.auditError = null;
  SHARED.createCalls = [];
  SHARED.createResult = { ok: true, incidentId: "incident-stub", skipped: undefined };
}

describe("dependency outage · database down", () => {
  beforeEach(resetAll);

  it("probe returns DOWN · monitor emits dependency degradation incident (critical)", async () => {
    STATE.dbError = { message: "connection refused" };
    const probe = await probeDatabase();
    expect(probe.status).toBe("down");
    expect(probe.ok).toBe(false);

    await reportDependencyDegradation({
      dependency: "database",
      reason: "down",
      scope: "db",
    });

    expect(SHARED.createCalls).toHaveLength(1);
    expect(SHARED.createCalls[0]!.category).toBe("degraded");
    expect(SHARED.createCalls[0]!.severity).toBe("critical");
    expect(SHARED.createCalls[0]!.scope).toBe("db");
  });
});

describe("dependency outage · storage degraded (latency over threshold)", () => {
  beforeEach(resetAll);

  it("probe returns degraded when latency > 800ms · monitor emits warn", async () => {
    STATE.storageLatencyMs = 850;
    const probe = await probeStorage();
    expect(probe.status).toBe("degraded");
    expect(probe.ok).toBe(true);

    await reportDependencyDegradation({
      dependency: "storage",
      reason: "degraded",
      scope: "storage",
      latency_ms: probe.latency_ms,
    });

    expect(SHARED.createCalls).toHaveLength(1);
    expect(SHARED.createCalls[0]!.severity).toBe("warn");
    expect(SHARED.createCalls[0]!.summary).toContain("storage");
    expect(SHARED.createCalls[0]!.summary).toContain("degraded");
  });
});

describe("dependency outage · incident table missing (migration gap)", () => {
  beforeEach(resetAll);

  it("probe returns UNKNOWN · never reports HEALTHY on insufficient evidence", async () => {
    STATE.incidentError = { message: 'relation "nex_incident" does not exist' };
    const probe = await probeIncidentTable();
    expect(probe.status).toBe("unknown");
    expect(probe.ok).toBe(false);
    // Doctrine · UNKNOWN is a distinct category from OK and DOWN.
    // The probe must never pretend health when it cannot verify.
    expect(probe.status).not.toBe("ok");
    expect(probe.status).not.toBe("down");
  });
});

describe("dependency outage · audit table missing (migration gap)", () => {
  beforeEach(resetAll);

  it("probe returns UNKNOWN · detail mentions migration 292", async () => {
    STATE.auditError = { message: 'relation "nex_security_audit_log" does not exist' };
    const probe = await probeAuditTable();
    expect(probe.status).toBe("unknown");
    expect(probe.ok).toBe(false);
    expect(probe.detail ?? "").toContain("292");
  });
});

describe("dependency outage · auto-reset of status when evidence improves", () => {
  beforeEach(resetAll);

  it("database recovers · subsequent probe returns OK (no sticky failure state)", async () => {
    STATE.dbError = { message: "boom" };
    let probe = await probeDatabase();
    expect(probe.status).toBe("down");

    // Dependency recovers.
    STATE.dbError = null;
    probe = await probeDatabase();
    expect(probe.status).toBe("ok");
    expect(probe.ok).toBe(true);
  });
});
