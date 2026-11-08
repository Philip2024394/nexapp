// src/lib/nex-native/security-monitor/__tests__/security-monitor.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

interface CreateCall {
  category: string;
  severity: string;
  scope: string;
  country: string;
  summary: string;
  adminActionRequired?: boolean;
  usersAffectedCount?: number;
  detectionSource?: string;
  service?: string | null;
  dedupKey?: string | null;
}

const SHARED = vi.hoisted(() => ({
  createCalls: [] as Array<CreateCall>,
  createResult: { ok: true as boolean, incidentId: "incident-1" as string | undefined, skipped: undefined as string | undefined },
}));

vi.mock("../../incident/incident-service", () => ({
  createIncident: (input: CreateCall) => {
    SHARED.createCalls.push(input);
    return Promise.resolve({ ok: SHARED.createResult.ok, incidentId: SHARED.createResult.incidentId, skipped: SHARED.createResult.skipped });
  },
}));

import {
  _resetMonitorDedupForTests,
  reportAuditPersistenceFailure,
  reportAuthAnomaly,
  reportDependencyDegradation,
  reportRateLimitEscalation,
  reportRecoveryAttempt,
} from "../security-monitor";

describe("reportRateLimitEscalation", () => {
  beforeEach(() => {
    _resetMonitorDedupForTests();
    SHARED.createCalls = [];
    SHARED.createResult = { ok: true, incidentId: "incident-1", skipped: undefined };
  });

  it("creates a critical attack incident with admin_action_required", async () => {
    const r = await reportRateLimitEscalation({
      action: "account_create",
      scope: "auth",
      affectedCount: 15,
      thresholdCrossed: 10,
      windowSeconds: 60,
    });
    expect(r.created).toBe(true);
    expect(r.incidentId).toBe("incident-1");
    expect(SHARED.createCalls).toHaveLength(1);
    expect(SHARED.createCalls[0]!.category).toBe("attack");
    expect(SHARED.createCalls[0]!.severity).toBe("critical");
    expect(SHARED.createCalls[0]!.adminActionRequired).toBe(true);
  });

  it("dedupes identical signals within the cooldown window", async () => {
    await reportRateLimitEscalation({
      action: "account_create",
      scope: "auth",
      affectedCount: 15,
      thresholdCrossed: 10,
      windowSeconds: 60,
    });
    const second = await reportRateLimitEscalation({
      action: "account_create",
      scope: "auth",
      affectedCount: 20,
      thresholdCrossed: 10,
      windowSeconds: 60,
    });
    expect(second.created).toBe(false);
    expect(second.skipped).toBe("dedup_suppressed");
    expect(SHARED.createCalls).toHaveLength(1);
  });

  it("different actions do not dedupe each other", async () => {
    await reportRateLimitEscalation({ action: "account_create", scope: "auth", affectedCount: 1, thresholdCrossed: 10, windowSeconds: 60 });
    await reportRateLimitEscalation({ action: "webauthn_assert", scope: "auth", affectedCount: 1, thresholdCrossed: 10, windowSeconds: 60 });
    expect(SHARED.createCalls).toHaveLength(2);
  });
});

describe("reportAuthAnomaly", () => {
  beforeEach(() => {
    _resetMonitorDedupForTests();
    SHARED.createCalls = [];
    SHARED.createResult = { ok: true, incidentId: "incident-1", skipped: undefined };
  });

  it("critical severity on counter_rollback_detected", async () => {
    await reportAuthAnomaly({ kind: "counter_rollback_detected" });
    expect(SHARED.createCalls[0]!.severity).toBe("critical");
    expect(SHARED.createCalls[0]!.adminActionRequired).toBe(true);
  });
  it("warn severity on other kinds · admin not required", async () => {
    await reportAuthAnomaly({ kind: "repeated_wrong_password" });
    expect(SHARED.createCalls[0]!.severity).toBe("warn");
    expect(SHARED.createCalls[0]!.adminActionRequired).toBe(false);
  });
});

describe("reportDependencyDegradation", () => {
  beforeEach(() => {
    _resetMonitorDedupForTests();
    SHARED.createCalls = [];
    SHARED.createResult = { ok: true, incidentId: "incident-1", skipped: undefined };
  });
  it("down → critical", async () => {
    await reportDependencyDegradation({ dependency: "database", reason: "down", scope: "db" });
    expect(SHARED.createCalls[0]!.severity).toBe("critical");
  });
  it("degraded → warn", async () => {
    await reportDependencyDegradation({ dependency: "storage", reason: "degraded", scope: "storage", latency_ms: 950 });
    expect(SHARED.createCalls[0]!.severity).toBe("warn");
    expect(SHARED.createCalls[0]!.summary).toContain("latency=950ms");
  });
});

describe("reportAuditPersistenceFailure", () => {
  beforeEach(() => {
    _resetMonitorDedupForTests();
    SHARED.createCalls = [];
    SHARED.createResult = { ok: true, incidentId: "incident-1", skipped: undefined };
  });
  it("always critical + admin_action_required", async () => {
    await reportAuditPersistenceFailure({ event: "security.password_change.completed", stage: "completion" });
    expect(SHARED.createCalls[0]!.severity).toBe("critical");
    expect(SHARED.createCalls[0]!.adminActionRequired).toBe(true);
  });
});

describe("reportRecoveryAttempt", () => {
  beforeEach(() => {
    _resetMonitorDedupForTests();
    SHARED.createCalls = [];
    SHARED.createResult = { ok: true, incidentId: "incident-1", skipped: undefined };
  });
  it("success · category=recovery · severity=info · no admin", async () => {
    await reportRecoveryAttempt({
      scope: "chat",
      category: "service",
      success: true,
      action: "ws_reconnect",
      summary: "chat websocket reconnected after transient drop",
    });
    expect(SHARED.createCalls[0]!.category).toBe("recovery");
    expect(SHARED.createCalls[0]!.severity).toBe("info");
    expect(SHARED.createCalls[0]!.adminActionRequired).toBe(false);
  });
  it("failure · keeps original category · severity=warn · admin required", async () => {
    await reportRecoveryAttempt({
      scope: "feed",
      category: "service",
      success: false,
      action: "feed_fallback",
      summary: "feed service unreachable; cached fallback failed",
    });
    expect(SHARED.createCalls[0]!.category).toBe("service");
    expect(SHARED.createCalls[0]!.severity).toBe("warn");
    expect(SHARED.createCalls[0]!.adminActionRequired).toBe(true);
  });
});

describe("country resolution from env", () => {
  beforeEach(() => {
    _resetMonitorDedupForTests();
    SHARED.createCalls = [];
  });
  it("respects NEX_APP_COUNTRY=ireland", async () => {
    vi.stubEnv("NEX_APP_COUNTRY", "ireland");
    await reportAuthAnomaly({ kind: "repeated_wrong_password" });
    expect(SHARED.createCalls[0]!.country).toBe("ireland");
  });
  it("falls back to global for unknown values", async () => {
    vi.stubEnv("NEX_APP_COUNTRY", "mars");
    await reportAuthAnomaly({ kind: "repeated_wrong_password" });
    expect(SHARED.createCalls[0]!.country).toBe("global");
  });
});

// ─── Priority 2 · country-aware dedup + mig 304 fields ─────────────

describe("country-aware dedup (owner directive 2026-11-08 round 8)", () => {
  beforeEach(() => {
    _resetMonitorDedupForTests();
    SHARED.createCalls = [];
    SHARED.createResult = { ok: true, incidentId: "incident-1", skipped: undefined };
  });

  it("identical signal in a different country is NOT deduped", async () => {
    // First signal in Ireland.
    vi.stubEnv("NEX_APP_COUNTRY", "ireland");
    const first = await reportAuthAnomaly({ kind: "repeated_wrong_password" });
    expect(first.created).toBe(true);
    // Same signal in Indonesia · must NOT be suppressed · different
    // country boundary.
    vi.stubEnv("NEX_APP_COUNTRY", "indonesia");
    const second = await reportAuthAnomaly({ kind: "repeated_wrong_password" });
    expect(second.created).toBe(true);
    expect(SHARED.createCalls).toHaveLength(2);
    expect(SHARED.createCalls[0]!.country).toBe("ireland");
    expect(SHARED.createCalls[1]!.country).toBe("indonesia");
  });

  it("identical signal in the same country IS deduped (burst suppression)", async () => {
    vi.stubEnv("NEX_APP_COUNTRY", "ireland");
    const first = await reportAuthAnomaly({ kind: "repeated_wrong_password" });
    const second = await reportAuthAnomaly({ kind: "repeated_wrong_password" });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.skipped).toBe("dedup_suppressed");
    expect(SHARED.createCalls).toHaveLength(1);
  });

  it("populates migration-304 detectionSource + service + dedupKey", async () => {
    vi.stubEnv("NEX_APP_COUNTRY", "ireland");
    await reportRateLimitEscalation({
      action: "account_create",
      scope: "auth",
      affectedCount: 15,
      thresholdCrossed: 10,
      windowSeconds: 60,
    });
    const call = SHARED.createCalls[0]!;
    expect(call.detectionSource).toBe("security_signal");
    expect(call.service).toBe("rate_limit");
    expect(typeof call.dedupKey).toBe("string");
    expect(call.dedupKey).toMatch(/^auth\.attack/);
  });
});
