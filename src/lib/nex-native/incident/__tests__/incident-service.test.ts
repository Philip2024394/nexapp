// src/lib/nex-native/incident/__tests__/incident-service.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const STATE = vi.hoisted(() => ({
  probeError: null as null | { message: string },
  insertResult: { data: { id: "incident-uuid-1" } as { id: string } | null, error: null as null | { message: string } },
  insertedRows: [] as Array<{ table: string; row: Record<string, unknown> }>,
  currentIncident: null as null | { id: string; status: string },
  updateError: null as null | { message: string },
}));

vi.mock("../../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(table: string) {
      return {
        select: () => ({
          limit: () => Promise.resolve({ data: [], error: STATE.probeError }),
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: STATE.currentIncident, error: null }),
          }),
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
          not: () => ({
            count: 0,
          }),
        }),
        insert(row: Record<string, unknown> | Record<string, unknown>[]) {
          const rows = Array.isArray(row) ? row : [row];
          for (const r of rows) STATE.insertedRows.push({ table, row: r });
          return {
            select: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: STATE.insertResult.data, error: STATE.insertResult.error }),
            }),
          };
        },
        update: (_patch: Record<string, unknown>) => ({
          eq: (_c: string, _v: unknown) => ({
            eq: (_c2: string, _v2: unknown) =>
              Promise.resolve({ error: STATE.updateError }),
          }),
        }),
      };
    },
  },
}));

import {
  _resetIncidentProbeForTests,
  createIncident,
  isLegalTransition,
  recordRecoveryAttempt,
  redactSummary,
  transitionIncident,
} from "../incident-service";

describe("redactSummary", () => {
  it("masks bearer tokens", () => {
    expect(redactSummary("Authorization: Bearer abc123xyz"))
      .toContain("[REDACTED]");
  });
  it("masks JWT-shaped tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abc";
    expect(redactSummary(jwt)).toBe("[REDACTED]");
  });
  it("masks raw IPv4 addresses", () => {
    expect(redactSummary("connect to 198.51.100.42 timed out"))
      .toContain("[REDACTED]");
  });
  it("masks password=... patterns (case-insensitive)", () => {
    expect(redactSummary("payload: Password=hunter2 after"))
      .toContain("[REDACTED]");
  });
  it("truncates to 400 chars", () => {
    const long = "x".repeat(600);
    expect(redactSummary(long).length).toBeLessThanOrEqual(400);
  });
});

describe("isLegalTransition", () => {
  it("allows DETECTED → INVESTIGATING", () => {
    expect(isLegalTransition("DETECTED", "INVESTIGATING")).toBe(true);
  });
  it("allows DETECTED → CLOSED (soft dismiss)", () => {
    expect(isLegalTransition("DETECTED", "CLOSED")).toBe(true);
  });
  it("forbids DETECTED → RECOVERED (skipping recovery)", () => {
    expect(isLegalTransition("DETECTED", "RECOVERED")).toBe(false);
  });
  it("forbids CLOSED → anything (terminal)", () => {
    expect(isLegalTransition("CLOSED", "INVESTIGATING")).toBe(false);
    expect(isLegalTransition("CLOSED", "DETECTED")).toBe(false);
  });
  it("allows RECOVERING → MONITORING", () => {
    expect(isLegalTransition("RECOVERING", "MONITORING")).toBe(true);
  });
  it("allows MONITORING → NEEDS_ADMIN (regression)", () => {
    expect(isLegalTransition("MONITORING", "NEEDS_ADMIN")).toBe(true);
  });
  it("allows NEEDS_ADMIN → INVESTIGATING (reopen)", () => {
    expect(isLegalTransition("NEEDS_ADMIN", "INVESTIGATING")).toBe(true);
  });
});

describe("createIncident", () => {
  beforeEach(() => {
    _resetIncidentProbeForTests();
    STATE.probeError = null;
    STATE.insertResult = { data: { id: "incident-uuid-1" }, error: null };
    STATE.insertedRows = [];
    STATE.currentIncident = null;
    STATE.updateError = null;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("inserts a well-formed row + emits creation event", async () => {
    const r = await createIncident({
      category: "service",
      severity: "warn",
      scope: "chat",
      country: "ireland",
      summary: "test incident",
      correlationId: "corr-abc",
    });
    expect(r.ok).toBe(true);
    expect(r.incidentId).toBe("incident-uuid-1");
    // Inserts: one into nex_incident, one into nex_incident_event
    expect(STATE.insertedRows).toHaveLength(2);
    expect(STATE.insertedRows[0]!.table).toBe("nex_incident");
    expect(STATE.insertedRows[0]!.row.category).toBe("service");
    expect(STATE.insertedRows[0]!.row.summary).toBe("test incident");
    expect(STATE.insertedRows[1]!.table).toBe("nex_incident_event");
    expect(STATE.insertedRows[1]!.row.kind).toBe("created");
  });

  it("redacts the summary field at write time", async () => {
    await createIncident({
      category: "security",
      severity: "critical",
      scope: "auth",
      country: "worldwide",
      summary: "failed login from 10.0.0.1 with password=secret123",
    });
    const written = String(STATE.insertedRows[0]!.row.summary);
    expect(written).toContain("[REDACTED]");
    expect(written).not.toContain("10.0.0.1");
    expect(written).not.toContain("secret123");
  });

  it("pre-apply (table missing) → returns skipped=table_not_available · no throw", async () => {
    _resetIncidentProbeForTests();
    STATE.probeError = { message: 'relation "nex_incident" does not exist' };
    const r = await createIncident({
      category: "service",
      severity: "info",
      scope: "chat",
      country: "ireland",
      summary: "x",
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("table_not_available");
    expect(STATE.insertedRows).toEqual([]);
  });

  it("clamps negative users_affected_count to zero", async () => {
    await createIncident({
      category: "service",
      severity: "info",
      scope: "chat",
      country: "ireland",
      summary: "x",
      usersAffectedCount: -5,
    });
    expect(STATE.insertedRows[0]!.row.users_affected_count).toBe(0);
  });
});

describe("transitionIncident", () => {
  beforeEach(() => {
    _resetIncidentProbeForTests();
    STATE.probeError = null;
    STATE.insertedRows = [];
    STATE.updateError = null;
  });

  it("returns not_found when the incident doesn't exist", async () => {
    STATE.currentIncident = null;
    const r = await transitionIncident({ incidentId: "nope", toStatus: "INVESTIGATING" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_found");
  });

  it("refuses illegal transitions (DETECTED → RECOVERED)", async () => {
    STATE.currentIncident = { id: "x", status: "DETECTED" };
    const r = await transitionIncident({ incidentId: "x", toStatus: "RECOVERED" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("illegal_transition");
    expect(STATE.insertedRows).toEqual([]);
  });

  it("legal transition emits an event + updates", async () => {
    STATE.currentIncident = { id: "x", status: "DETECTED" };
    const r = await transitionIncident({
      incidentId: "x",
      toStatus: "INVESTIGATING",
      note: "operator picked it up",
    });
    expect(r.ok).toBe(true);
    expect(STATE.insertedRows.some((e) => e.row.kind === "status_transition")).toBe(true);
  });
});

describe("recordRecoveryAttempt", () => {
  beforeEach(() => {
    _resetIncidentProbeForTests();
    STATE.probeError = null;
    STATE.insertedRows = [];
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("appends a recovery_success event when success=true", async () => {
    const r = await recordRecoveryAttempt({ incidentId: "x", success: true });
    expect(r.ok).toBe(true);
    expect(STATE.insertedRows[0]!.row.kind).toBe("recovery_success");
  });

  it("appends recovery_failure when success=false with a note redacted", async () => {
    await recordRecoveryAttempt({
      incidentId: "x",
      success: false,
      note: "fallback at 192.168.1.1 failed",
    });
    expect(STATE.insertedRows[0]!.row.kind).toBe("recovery_failure");
    expect(String(STATE.insertedRows[0]!.row.note)).toContain("[REDACTED]");
  });
});
