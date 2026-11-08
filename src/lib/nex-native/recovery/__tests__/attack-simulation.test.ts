// src/lib/nex-native/recovery/__tests__/attack-simulation.test.ts
//
// Simulate adversarial traffic shapes against the security monitor +
// rate-limit boundary · assert that (a) dedupe prevents incident
// storms, (b) escalation incidents have the right severity/scope and
// (c) distinct attack kinds produce distinct incidents.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

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
  _resetMonitorDedupForTests,
  reportAuthAnomaly,
  reportRateLimitEscalation,
} from "../../security-monitor/security-monitor";
import { simulateAuthAttack, AuthAttackError } from "./fault-injection";

function resetAll() {
  _resetMonitorDedupForTests();
  SHARED.createCalls = [];
  SHARED.createResult = { ok: true, incidentId: "incident-stub", skipped: undefined };
}

describe("attack simulation · brute-force auth from same IP", () => {
  beforeEach(resetAll);

  it("50 failed logins from one source · rate-limiter emits incident exactly once (dedupe)", async () => {
    const op = simulateAuthAttack(50);
    let failures = 0;
    for (let i = 0; i < 50; i++) {
      await expect(op()).rejects.toBeInstanceOf(AuthAttackError);
      failures += 1;
      // Each failure fires the escalation signal · but the monitor's
      // 60s dedupe window suppresses all but the first.
      await reportRateLimitEscalation({
        action: "webauthn_assert",
        scope: "auth",
        affectedCount: 1,
        thresholdCrossed: 10,
        windowSeconds: 60,
      });
    }
    expect(failures).toBe(50);
    expect(op.calls).toBe(50);
    // Exactly one incident across the burst · dedupe held.
    expect(SHARED.createCalls).toHaveLength(1);
    expect(SHARED.createCalls[0]!.category).toBe("attack");
    expect(SHARED.createCalls[0]!.severity).toBe("critical");
  });
});

describe("attack simulation · account enumeration (webauthn_assert flood)", () => {
  beforeEach(resetAll);

  it("flood of webauthn_assert · incident scope=auth category=attack severity=critical", async () => {
    for (let i = 0; i < 20; i++) {
      await reportRateLimitEscalation({
        action: "webauthn_assert",
        scope: "auth",
        affectedCount: i + 1,
        thresholdCrossed: 10,
        windowSeconds: 60,
      });
    }
    expect(SHARED.createCalls).toHaveLength(1);
    const first = SHARED.createCalls[0]!;
    expect(first.scope).toBe("auth");
    expect(first.category).toBe("attack");
    expect(first.severity).toBe("critical");
    expect(first.adminActionRequired).toBe(true);
  });
});

describe("attack simulation · rate-limit escalation on account_create", () => {
  beforeEach(resetAll);

  it("15 failed account_create inside 60s window · monitor emits escalation incident", async () => {
    // The monitor doesn't re-check the limiter · it just emits the
    // signal. Here we simulate the rate-limiter having tripped and
    // fired the signal. The assertion is: critical + attack + auth
    // scope + exactly one incident thanks to dedupe.
    for (let i = 0; i < 15; i++) {
      await reportRateLimitEscalation({
        action: "account_create",
        scope: "auth",
        affectedCount: i + 1,
        thresholdCrossed: 10,
        windowSeconds: 60,
      });
    }
    expect(SHARED.createCalls).toHaveLength(1);
    expect(SHARED.createCalls[0]!.summary).toContain("account_create");
    expect(SHARED.createCalls[0]!.severity).toBe("critical");
  });

  it("different actions do NOT dedupe into the same incident", async () => {
    await reportRateLimitEscalation({
      action: "account_create",
      scope: "auth",
      affectedCount: 1,
      thresholdCrossed: 10,
      windowSeconds: 60,
    });
    await reportRateLimitEscalation({
      action: "webauthn_assert",
      scope: "auth",
      affectedCount: 1,
      thresholdCrossed: 10,
      windowSeconds: 60,
    });
    expect(SHARED.createCalls).toHaveLength(2);
    expect(SHARED.createCalls[0]!.summary).toContain("account_create");
    expect(SHARED.createCalls[1]!.summary).toContain("webauthn_assert");
  });
});

describe("attack simulation · mixed signals", () => {
  beforeEach(resetAll);

  it("multiple anomaly kinds in parallel · each generates a distinct incident", async () => {
    await reportAuthAnomaly({ kind: "repeated_wrong_password" });
    await reportAuthAnomaly({ kind: "unknown_credential" });
    await reportAuthAnomaly({ kind: "counter_rollback_detected" });
    await reportAuthAnomaly({ kind: "session_reuse_after_revoke" });

    expect(SHARED.createCalls).toHaveLength(4);
    const summaries = SHARED.createCalls.map((c) => c.summary);
    expect(summaries.some((s) => s.includes("repeated_wrong_password"))).toBe(true);
    expect(summaries.some((s) => s.includes("unknown_credential"))).toBe(true);
    expect(summaries.some((s) => s.includes("counter_rollback_detected"))).toBe(true);
    expect(summaries.some((s) => s.includes("session_reuse_after_revoke"))).toBe(true);

    // counter_rollback_detected must be critical · everything else warn.
    const rollback = SHARED.createCalls.find((c) =>
      c.summary.includes("counter_rollback_detected"),
    )!;
    expect(rollback.severity).toBe("critical");
    const other = SHARED.createCalls.find((c) =>
      c.summary.includes("repeated_wrong_password"),
    )!;
    expect(other.severity).toBe("warn");
  });

  it("repeated same-kind anomalies still dedupe (60s window)", async () => {
    for (let i = 0; i < 10; i++) {
      await reportAuthAnomaly({ kind: "repeated_wrong_password" });
    }
    expect(SHARED.createCalls).toHaveLength(1);
  });
});
