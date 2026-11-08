// src/lib/nex-native/recovery/__tests__/section-isolation.test.ts
//
// Fault-injection scenarios that prove ONE section failing does NOT
// cascade to the others · the independence contract. Each test
// injects a failure in a named section, then asserts (a) the other
// sections remain OK and (b) the incident monitor records the failure
// with the correct scope + country.
//
// NOTE · the health probes in production are backed by Supabase; here
// we use the same ProbeResult shape via the fault-injection harness so
// we can simulate each section independently without any network.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

// Mock supabase-admin so health-probes can import without hitting the
// real env-var guard · section-isolation only needs aggregateStatus
// (pure function) but the module load path pulls supabase-admin in.
vi.mock("../../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: () => ({ select: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
    storage: { listBuckets: () => Promise.resolve({ data: [], error: null }) },
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
  _resetMonitorDedupForTests,
  reportDependencyDegradation,
} from "../../security-monitor/security-monitor";
import { aggregateStatus } from "../../health/health-probes";
import {
  buildCountryProbes,
  buildSectionProbes,
  type SectionName,
} from "./fault-injection";

function resetAll() {
  _resetMonitorDedupForTests();
  SHARED.createCalls = [];
  SHARED.createResult = { ok: true, incidentId: "incident-stub", skipped: undefined };
}

describe("section isolation · single section failure does not cascade", () => {
  beforeEach(resetAll);

  it("CHAT down · Shops/Feed/Live/Directory probes return OK", () => {
    const probes = buildSectionProbes(["chat"]);
    const down = probes.filter((p) => p.status === "down").map((p) => p.name);
    const ok = probes.filter((p) => p.status === "ok").map((p) => p.name);
    expect(down).toEqual(["chat"]);
    expect(ok).toEqual(["shops", "feed", "live", "directory"]);
  });

  it("SHOPS down · Chat/Feed/Live/Directory continue · incident scoped to shops only", async () => {
    const probes = buildSectionProbes(["shops"]);
    expect(probes.find((p) => p.name === "chat")!.ok).toBe(true);
    expect(probes.find((p) => p.name === "shops")!.ok).toBe(false);

    await reportDependencyDegradation({
      dependency: "database",
      reason: "down",
      scope: "shops",
    });

    expect(SHARED.createCalls).toHaveLength(1);
    expect(SHARED.createCalls[0]!.scope).toBe("shops");
    expect(SHARED.createCalls[0]!.severity).toBe("critical");
  });

  it("FEED down · incident category + scope correct", async () => {
    const probes = buildSectionProbes(["feed"]);
    expect(probes.find((p) => p.name === "feed")!.status).toBe("down");

    await reportDependencyDegradation({
      dependency: "database",
      reason: "down",
      scope: "feed",
    });
    expect(SHARED.createCalls[0]!.scope).toBe("feed");
    expect(SHARED.createCalls[0]!.category).toBe("degraded");
  });

  it("LIVE down · the other sections keep an ok aggregate when live is excluded", () => {
    const probes = buildSectionProbes(["live"]);
    const nonLive = probes.filter((p) => p.name !== "live");
    const liveStatus = probes.find((p) => p.name === "live")!.status;
    expect(liveStatus).toBe("down");
    // Aggregate of non-live probes is still OK.
    expect(
      aggregateStatus(
        nonLive.map((p) => ({ ...p, at: "x" })),
      ),
    ).toBe("ok");
  });
});

describe("section isolation · two sections simultaneously", () => {
  beforeEach(resetAll);

  it("CHAT + SHOPS fail · distinct incidents · neither affects the others", async () => {
    const probes = buildSectionProbes(["chat", "shops"]);
    const stillOk: SectionName[] = ["feed", "live", "directory"];
    for (const name of stillOk) {
      expect(probes.find((p) => p.name === name)!.ok).toBe(true);
    }

    await reportDependencyDegradation({
      dependency: "database",
      reason: "down",
      scope: "chat",
    });
    await reportDependencyDegradation({
      dependency: "database",
      reason: "down",
      scope: "shops",
    });

    expect(SHARED.createCalls).toHaveLength(2);
    const scopes = SHARED.createCalls.map((c) => c.scope).sort();
    expect(scopes).toEqual(["chat", "shops"]);
  });

  it("FEED + LIVE fail together · each produces its own scoped incident", async () => {
    await reportDependencyDegradation({
      dependency: "database",
      reason: "down",
      scope: "feed",
    });
    await reportDependencyDegradation({
      dependency: "database",
      reason: "down",
      scope: "live",
    });

    expect(SHARED.createCalls).toHaveLength(2);
    const scopes = SHARED.createCalls.map((c) => c.scope).sort();
    expect(scopes).toEqual(["feed", "live"]);
  });
});

describe("section isolation · country isolation", () => {
  beforeEach(resetAll);

  it("IRELAND failure does NOT mark Indonesia or Worldwide as down", () => {
    const probes = buildCountryProbes(["ireland"]);
    expect(probes.ireland.ok).toBe(false);
    expect(probes.indonesia.ok).toBe(true);
    expect(probes.worldwide.ok).toBe(true);
  });

  it("IRELAND incident tags country=ireland · leaves other countries untouched", async () => {
    vi.stubEnv("NEX_APP_COUNTRY", "ireland");
    await reportDependencyDegradation({
      dependency: "database",
      reason: "down",
      scope: "chat",
    });
    expect(SHARED.createCalls).toHaveLength(1);
    expect(SHARED.createCalls[0]!.country).toBe("ireland");

    // Reset the env + dedup · now INDONESIA incident must not inherit
    // Ireland scope.
    vi.stubEnv("NEX_APP_COUNTRY", "indonesia");
    _resetMonitorDedupForTests();
    await reportDependencyDegradation({
      dependency: "database",
      reason: "down",
      scope: "shops",
    });
    expect(SHARED.createCalls).toHaveLength(2);
    expect(SHARED.createCalls[1]!.country).toBe("indonesia");
    expect(SHARED.createCalls[1]!.scope).toBe("shops");
  });
});

describe("section isolation · catastrophic (all sections down)", () => {
  beforeEach(resetAll);

  it("ALL sections down · aggregate reports DOWN (not UNKNOWN)", () => {
    const probes = buildSectionProbes(["chat", "shops", "feed", "live", "directory"]);
    expect(
      aggregateStatus(
        probes.map((p) => ({ ...p, at: "x" })),
      ),
    ).toBe("down");
  });

  it("no sections down · aggregate reports OK", () => {
    const probes = buildSectionProbes([]);
    expect(
      aggregateStatus(
        probes.map((p) => ({ ...p, at: "x" })),
      ),
    ).toBe("ok");
  });
});
