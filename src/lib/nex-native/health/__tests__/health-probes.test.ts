// src/lib/nex-native/health/__tests__/health-probes.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const STATE = vi.hoisted(() => ({
  dbError: null as null | { message: string },
  storageError: null as null | { message: string },
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
            if (table === "nex_migration_history")
              return Promise.resolve({ data: [], error: STATE.dbError });
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
        Promise.resolve({
          data: STATE.storageError ? null : STATE.buckets,
          error: STATE.storageError,
        }),
    },
  },
}));

import {
  aggregateStatus,
  probeAuditTable,
  probeDatabase,
  probeIncidentTable,
  probeStorage,
} from "../health-probes";

describe("probeDatabase", () => {
  beforeEach(() => {
    STATE.dbError = null;
  });
  it("returns ok when the lightweight query succeeds", async () => {
    const r = await probeDatabase();
    expect(r.ok).toBe(true);
    expect(r.status).toBe("ok");
    expect(r.name).toBe("database");
  });
  it("returns down + redacted detail when the query errors", async () => {
    STATE.dbError = { message: "connect failed to 198.51.100.42" };
    const r = await probeDatabase();
    expect(r.ok).toBe(false);
    expect(r.status).toBe("down");
    expect(r.detail).not.toContain("198.51.100.42");
    expect(r.detail).toContain("[REDACTED]");
  });
});

describe("probeStorage", () => {
  beforeEach(() => {
    STATE.storageError = null;
    STATE.buckets = [{ id: "a" }, { id: "b" }];
  });
  it("counts buckets on success", async () => {
    const r = await probeStorage();
    expect(r.ok).toBe(true);
    expect(r.detail).toContain("2 buckets");
  });
  it("returns down when listBuckets errors", async () => {
    STATE.storageError = { message: "boom" };
    const r = await probeStorage();
    expect(r.status).toBe("down");
  });
});

describe("probeIncidentTable / probeAuditTable", () => {
  it("reports unknown (not false-healthy) when the table is missing", async () => {
    STATE.incidentError = { message: 'relation "nex_incident" does not exist' };
    const r = await probeIncidentTable();
    expect(r.status).toBe("unknown");
    expect(r.ok).toBe(false);
  });
  it("audit table missing → unknown · detail mentions migration 292", async () => {
    STATE.auditError = { message: "does not exist" };
    const r = await probeAuditTable();
    expect(r.status).toBe("unknown");
    expect(r.detail).toContain("292");
  });
});

describe("aggregateStatus", () => {
  it("worst-wins · down overrides degraded + ok", () => {
    expect(
      aggregateStatus([
        { name: "a", ok: true, status: "ok", latency_ms: 1, at: "x" },
        { name: "b", ok: false, status: "degraded", latency_ms: 1, at: "x" },
        { name: "c", ok: false, status: "down", latency_ms: 1, at: "x" },
      ]),
    ).toBe("down");
  });
  it("degraded overrides ok + unknown", () => {
    expect(
      aggregateStatus([
        { name: "a", ok: true, status: "ok", latency_ms: 1, at: "x" },
        { name: "b", ok: false, status: "unknown", latency_ms: 1, at: "x" },
        { name: "c", ok: false, status: "degraded", latency_ms: 1, at: "x" },
      ]),
    ).toBe("degraded");
  });
  it("unknown shows when there is nothing worse", () => {
    expect(
      aggregateStatus([
        { name: "a", ok: true, status: "ok", latency_ms: 1, at: "x" },
        { name: "b", ok: false, status: "unknown", latency_ms: 1, at: "x" },
      ]),
    ).toBe("unknown");
  });
  it("all ok → ok", () => {
    expect(
      aggregateStatus([
        { name: "a", ok: true, status: "ok", latency_ms: 1, at: "x" },
        { name: "b", ok: true, status: "ok", latency_ms: 1, at: "x" },
      ]),
    ).toBe("ok");
  });
});
