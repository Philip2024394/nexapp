// src/app/nex-native/hq/security-recovery/__tests__/incident-actions.test.ts
//
// Unit tests for the HQ incident drill-down server actions.
// Pattern mirrors retention-actions.test.ts · sealed redirect-throws-
// NEXT_REDIRECT via a module-level vi.mock of next/navigation.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

type IncidentServiceMock = {
  acknowledgeResult: { ok: boolean; error?: string };
  transitionResult:
    | { ok: true; fromStatus?: string }
    | { ok: false; error?: string; fromStatus?: string };
  acknowledgeCalls: Array<{ incidentId: string; byAccountId: string }>;
  transitionCalls: Array<{
    incidentId: string;
    toStatus: string;
    actorAccountId: string | null | undefined;
    note: string | null | undefined;
  }>;
};

type SupabaseUpdateCall = {
  table: string;
  patch: Record<string, unknown>;
  idFilter: string | null;
};

const SHARED = vi.hoisted(() => ({
  session: null as null | { account: { id: string } },
  hqResult: "ok" as "ok" | "throw",
  redirectCalls: [] as string[],
  updateCalls: [] as SupabaseUpdateCall[],
  updateError: null as null | { message: string; code?: string },
  auditCalls: [] as Array<{
    event: string;
    outcome: string;
    metadata?: Record<string, unknown>;
    targetId?: string | null;
  }>,
  auditShouldThrow: false,
  incidentSvc: {
    acknowledgeResult: { ok: true } as { ok: boolean; error?: string },
    transitionResult: { ok: true, fromStatus: "DETECTED" } as
      | { ok: true; fromStatus?: string }
      | { ok: false; error?: string; fromStatus?: string },
    acknowledgeCalls: [] as IncidentServiceMock["acknowledgeCalls"],
    transitionCalls: [] as IncidentServiceMock["transitionCalls"],
  },
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    SHARED.redirectCalls.push(url);
    const err = new Error("NEXT_REDIRECT");
    (err as { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw err;
  },
}));

vi.mock("@/lib/nex-native/app/dev-impersonation", () => ({
  resolveSessionWithDevOverride: () => Promise.resolve(SHARED.session),
}));

vi.mock("@/lib/nex-native/hq-authorization", () => ({
  requireHqAdmin: () => {
    if (SHARED.hqResult === "throw") throw new Error("not hq admin");
    return Promise.resolve();
  },
}));

vi.mock("@/lib/nex-native/security-audit-service", () => ({
  recordAuditEvent: (input: {
    event: string;
    outcome: string;
    metadata?: Record<string, unknown>;
    targetId?: string | null;
  }) => {
    SHARED.auditCalls.push({
      event: input.event,
      outcome: input.outcome,
      metadata: input.metadata,
      targetId: input.targetId,
    });
    if (SHARED.auditShouldThrow) {
      return Promise.reject(new Error("audit storage down"));
    }
    return Promise.resolve({ ok: true });
  },
}));

vi.mock("@/lib/nex-native/incident/incident-service", async () => {
  // The real module exports isLegalTransition + redactSummary · we need
  // the real transition table for validation branches. Pull the real
  // module and override only the two service functions that would hit
  // supabase.
  const actual = await vi.importActual<
    typeof import("@/lib/nex-native/incident/incident-service")
  >("@/lib/nex-native/incident/incident-service");
  return {
    ...actual,
    acknowledgeIncident: (incidentId: string, byAccountId: string) => {
      SHARED.incidentSvc.acknowledgeCalls.push({ incidentId, byAccountId });
      return Promise.resolve(SHARED.incidentSvc.acknowledgeResult);
    },
    transitionIncident: (input: {
      incidentId: string;
      toStatus: string;
      actorAccountId?: string | null;
      note?: string | null;
    }) => {
      SHARED.incidentSvc.transitionCalls.push({
        incidentId: input.incidentId,
        toStatus: input.toStatus,
        actorAccountId: input.actorAccountId,
        note: input.note,
      });
      return Promise.resolve(SHARED.incidentSvc.transitionResult);
    },
  };
});

vi.mock("@/lib/nex-native/supabase-admin", () => {
  const builder = (table: string) => {
    const call: SupabaseUpdateCall = { table, patch: {}, idFilter: null };
    const api = {
      update(patch: Record<string, unknown>) {
        call.patch = patch;
        return api;
      },
      eq(_col: string, value: string) {
        call.idFilter = value;
        SHARED.updateCalls.push(call);
        return Promise.resolve({ error: SHARED.updateError });
      },
    };
    return api;
  };
  return {
    nexSupabaseAdmin: {
      from: (table: string) => builder(table),
    },
  };
});

async function runAction(
  action: (f: FormData) => Promise<void>,
  entries: Record<string, string>,
): Promise<string | null> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  try {
    await action(fd);
  } catch (err) {
    const digest = (err as { digest?: string }).digest ?? "";
    const m = digest.match(/NEXT_REDIRECT;[a-z]+;([^;]+);/);
    if (m) return m[1]!;
    throw err;
  }
  return null;
}

import {
  acknowledgeIncidentAction,
  assignIncidentAction,
  escalateIncidentAction,
  saveResolutionNotesAction,
  transitionIncidentAction,
} from "../[incidentId]/_actions";

const HQ_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const INCIDENT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ASSIGNEE_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function resetShared(): void {
  SHARED.session = { account: { id: HQ_ID } };
  SHARED.hqResult = "ok";
  SHARED.redirectCalls = [];
  SHARED.updateCalls = [];
  SHARED.updateError = null;
  SHARED.auditCalls = [];
  SHARED.auditShouldThrow = false;
  SHARED.incidentSvc.acknowledgeResult = { ok: true };
  SHARED.incidentSvc.transitionResult = { ok: true, fromStatus: "DETECTED" };
  SHARED.incidentSvc.acknowledgeCalls = [];
  SHARED.incidentSvc.transitionCalls = [];
}

// ─── acknowledgeIncidentAction ───────────────────────────────────────

describe("acknowledgeIncidentAction", () => {
  beforeEach(resetShared);

  it("unauthenticated → redirects to error=unauthenticated", async () => {
    SHARED.session = null;
    const r = await runAction(acknowledgeIncidentAction, {
      incident_id: INCIDENT_ID,
    });
    expect(r).toContain("error=unauthenticated");
    expect(SHARED.incidentSvc.acknowledgeCalls).toEqual([]);
  });

  it("not HQ admin → redirects to error=forbidden", async () => {
    SHARED.hqResult = "throw";
    const r = await runAction(acknowledgeIncidentAction, {
      incident_id: INCIDENT_ID,
    });
    expect(r).toContain("error=forbidden");
    expect(SHARED.incidentSvc.acknowledgeCalls).toEqual([]);
  });

  it("invalid incident id → redirects to error=invalid_incident_id", async () => {
    const r = await runAction(acknowledgeIncidentAction, {
      incident_id: "not-a-uuid",
    });
    expect(r).toContain("error=invalid_incident_id");
    expect(SHARED.incidentSvc.acknowledgeCalls).toEqual([]);
  });

  it("happy path → ok=acknowledged and audit emitted", async () => {
    const r = await runAction(acknowledgeIncidentAction, {
      incident_id: INCIDENT_ID,
    });
    expect(r).toContain("ok=acknowledged");
    expect(SHARED.incidentSvc.acknowledgeCalls).toEqual([
      { incidentId: INCIDENT_ID, byAccountId: HQ_ID },
    ]);
    expect(SHARED.auditCalls).toHaveLength(1);
    expect(SHARED.auditCalls[0]!.event).toBe("security.hq.incident.acknowledged");
    expect(SHARED.auditCalls[0]!.metadata).toEqual({ incident_id: INCIDENT_ID });
  });

  it("acknowledge svc failure → error=ack_failed", async () => {
    SHARED.incidentSvc.acknowledgeResult = { ok: false, error: "db_broken" };
    const r = await runAction(acknowledgeIncidentAction, {
      incident_id: INCIDENT_ID,
    });
    expect(r).toContain("error=ack_failed");
    expect(SHARED.auditCalls).toEqual([]);
  });

  it("audit failure is swallowed · still redirects to ok", async () => {
    SHARED.auditShouldThrow = true;
    const r = await runAction(acknowledgeIncidentAction, {
      incident_id: INCIDENT_ID,
    });
    expect(r).toContain("ok=acknowledged");
  });
});

// ─── transitionIncidentAction ────────────────────────────────────────

describe("transitionIncidentAction", () => {
  beforeEach(resetShared);

  it("unauthenticated → error=unauthenticated", async () => {
    SHARED.session = null;
    const r = await runAction(transitionIncidentAction, {
      incident_id: INCIDENT_ID,
      to_status: "INVESTIGATING",
      from_status: "DETECTED",
    });
    expect(r).toContain("error=unauthenticated");
    expect(SHARED.incidentSvc.transitionCalls).toEqual([]);
  });

  it("not HQ admin → error=forbidden", async () => {
    SHARED.hqResult = "throw";
    const r = await runAction(transitionIncidentAction, {
      incident_id: INCIDENT_ID,
      to_status: "INVESTIGATING",
      from_status: "DETECTED",
    });
    expect(r).toContain("error=forbidden");
  });

  it("invalid to_status → error=invalid_status", async () => {
    const r = await runAction(transitionIncidentAction, {
      incident_id: INCIDENT_ID,
      to_status: "BOGUS",
      from_status: "DETECTED",
    });
    expect(r).toContain("error=invalid_status");
    expect(SHARED.incidentSvc.transitionCalls).toEqual([]);
  });

  it("illegal transition (CLOSED → anything) → error=illegal_transition · svc not called", async () => {
    const r = await runAction(transitionIncidentAction, {
      incident_id: INCIDENT_ID,
      to_status: "INVESTIGATING",
      from_status: "CLOSED",
    });
    expect(r).toContain("error=illegal_transition");
    expect(SHARED.incidentSvc.transitionCalls).toEqual([]);
  });

  it("legal transition DETECTED→INVESTIGATING → ok=transitioned + audit", async () => {
    SHARED.incidentSvc.transitionResult = { ok: true, fromStatus: "DETECTED" };
    const r = await runAction(transitionIncidentAction, {
      incident_id: INCIDENT_ID,
      to_status: "INVESTIGATING",
      from_status: "DETECTED",
      note: "starting investigation",
    });
    expect(r).toContain("ok=transitioned");
    expect(r).toContain("to=INVESTIGATING");
    expect(SHARED.incidentSvc.transitionCalls).toHaveLength(1);
    expect(SHARED.incidentSvc.transitionCalls[0]).toMatchObject({
      incidentId: INCIDENT_ID,
      toStatus: "INVESTIGATING",
      actorAccountId: HQ_ID,
      note: "starting investigation",
    });
    expect(SHARED.auditCalls).toHaveLength(1);
    expect(SHARED.auditCalls[0]!.event).toBe("security.hq.incident.transitioned");
    expect(SHARED.auditCalls[0]!.metadata).toEqual({
      incident_id: INCIDENT_ID,
      from_status: "DETECTED",
      to_status: "INVESTIGATING",
    });
  });

  it("service returns illegal_transition (stale tab) → error=illegal_transition", async () => {
    SHARED.incidentSvc.transitionResult = {
      ok: false,
      error: "illegal_transition",
      fromStatus: "CLOSED",
    };
    const r = await runAction(transitionIncidentAction, {
      incident_id: INCIDENT_ID,
      to_status: "INVESTIGATING",
      // Deliberately send an incorrect hint that passes the client-side guard
      from_status: "DETECTED",
    });
    expect(r).toContain("error=illegal_transition");
    expect(SHARED.auditCalls).toEqual([]);
  });

  it("service returns not_found → error=not_found + redirects to list", async () => {
    SHARED.incidentSvc.transitionResult = { ok: false, error: "not_found" };
    const r = await runAction(transitionIncidentAction, {
      incident_id: INCIDENT_ID,
      to_status: "INVESTIGATING",
      from_status: "DETECTED",
    });
    expect(r).toContain("error=not_found");
    expect(r).not.toContain(INCIDENT_ID);
  });
});

// ─── saveResolutionNotesAction ───────────────────────────────────────

describe("saveResolutionNotesAction", () => {
  beforeEach(resetShared);

  it("unauthenticated → error=unauthenticated", async () => {
    SHARED.session = null;
    const r = await runAction(saveResolutionNotesAction, {
      incident_id: INCIDENT_ID,
      resolution_notes: "fine",
    });
    expect(r).toContain("error=unauthenticated");
    expect(SHARED.updateCalls).toEqual([]);
  });

  it("not HQ admin → error=forbidden", async () => {
    SHARED.hqResult = "throw";
    const r = await runAction(saveResolutionNotesAction, {
      incident_id: INCIDENT_ID,
      resolution_notes: "fine",
    });
    expect(r).toContain("error=forbidden");
    expect(SHARED.updateCalls).toEqual([]);
  });

  it("empty notes → error=empty_notes", async () => {
    const r = await runAction(saveResolutionNotesAction, {
      incident_id: INCIDENT_ID,
      resolution_notes: "   ",
    });
    expect(r).toContain("error=empty_notes");
    expect(SHARED.updateCalls).toEqual([]);
  });

  it("valid notes → ok=saved · redacted · audit emitted", async () => {
    const r = await runAction(saveResolutionNotesAction, {
      incident_id: INCIDENT_ID,
      resolution_notes: "token=abc123secret password=p@ssw0rd clean fix",
    });
    expect(r).toContain("ok=saved");
    expect(SHARED.updateCalls).toHaveLength(1);
    const call = SHARED.updateCalls[0]!;
    expect(call.table).toBe("nex_incident");
    expect(call.idFilter).toBe(INCIDENT_ID);
    // Redaction must have fired on both secret-shaped tokens.
    const persisted = String(call.patch.resolution_notes);
    expect(persisted).toContain("[REDACTED]");
    expect(persisted).not.toContain("p@ssw0rd");
    expect(SHARED.auditCalls).toHaveLength(1);
    expect(SHARED.auditCalls[0]!.event).toBe(
      "security.hq.incident.resolution_notes_saved",
    );
  });

  it("supabase error → error=save_failed", async () => {
    SHARED.updateError = { message: "write denied" };
    const r = await runAction(saveResolutionNotesAction, {
      incident_id: INCIDENT_ID,
      resolution_notes: "ok text",
    });
    expect(r).toContain("error=save_failed");
    expect(SHARED.auditCalls).toEqual([]);
  });
});

// ─── assignIncidentAction ────────────────────────────────────────────

describe("assignIncidentAction", () => {
  beforeEach(resetShared);

  it("unauthenticated → error=unauthenticated", async () => {
    SHARED.session = null;
    const r = await runAction(assignIncidentAction, {
      incident_id: INCIDENT_ID,
      assigned_to_id: ASSIGNEE_ID,
    });
    expect(r).toContain("error=unauthenticated");
    expect(SHARED.updateCalls).toEqual([]);
  });

  it("not HQ admin → error=forbidden", async () => {
    SHARED.hqResult = "throw";
    const r = await runAction(assignIncidentAction, {
      incident_id: INCIDENT_ID,
      assigned_to_id: ASSIGNEE_ID,
    });
    expect(r).toContain("error=forbidden");
    expect(SHARED.updateCalls).toEqual([]);
  });

  it("invalid assignee → error=invalid_assignee", async () => {
    const r = await runAction(assignIncidentAction, {
      incident_id: INCIDENT_ID,
      assigned_to_id: "not-a-uuid",
    });
    expect(r).toContain("error=invalid_assignee");
    expect(SHARED.updateCalls).toEqual([]);
  });

  it("valid assignee → ok=assigned · patch includes assignee · audit emitted", async () => {
    const r = await runAction(assignIncidentAction, {
      incident_id: INCIDENT_ID,
      assigned_to_id: ASSIGNEE_ID,
    });
    expect(r).toContain("ok=assigned");
    expect(SHARED.updateCalls).toHaveLength(1);
    expect(SHARED.updateCalls[0]!.patch.assigned_to).toBe(ASSIGNEE_ID);
    expect(SHARED.auditCalls).toHaveLength(1);
    expect(SHARED.auditCalls[0]!.event).toBe("security.hq.incident.assigned");
  });

  it("empty assignee → ok=assigned with assignee=null (unassign)", async () => {
    const r = await runAction(assignIncidentAction, {
      incident_id: INCIDENT_ID,
      assigned_to_id: "",
    });
    expect(r).toContain("ok=assigned");
    expect(SHARED.updateCalls[0]!.patch.assigned_to).toBeNull();
  });
});

// ─── escalateIncidentAction ─────────────────────────────────────────

describe("escalateIncidentAction", () => {
  beforeEach(resetShared);

  it("unauthenticated → error=unauthenticated", async () => {
    SHARED.session = null;
    const r = await runAction(escalateIncidentAction, {
      incident_id: INCIDENT_ID,
      reason: "stuck",
    });
    expect(r).toContain("error=unauthenticated");
    expect(SHARED.incidentSvc.transitionCalls).toEqual([]);
  });

  it("not HQ admin → error=forbidden", async () => {
    SHARED.hqResult = "throw";
    const r = await runAction(escalateIncidentAction, {
      incident_id: INCIDENT_ID,
      reason: "stuck",
    });
    expect(r).toContain("error=forbidden");
    expect(SHARED.incidentSvc.transitionCalls).toEqual([]);
  });

  it("happy path → transitions to NEEDS_ADMIN · sets admin_action_required=true · audit emitted", async () => {
    SHARED.incidentSvc.transitionResult = { ok: true, fromStatus: "INVESTIGATING" };
    const r = await runAction(escalateIncidentAction, {
      incident_id: INCIDENT_ID,
      reason: "recovery keeps failing",
    });
    expect(r).toContain("ok=escalated");
    // 1) transition call targeted NEEDS_ADMIN
    expect(SHARED.incidentSvc.transitionCalls).toHaveLength(1);
    expect(SHARED.incidentSvc.transitionCalls[0]!.toStatus).toBe("NEEDS_ADMIN");
    // 2) supabase flag flip ran
    expect(SHARED.updateCalls).toHaveLength(1);
    expect(SHARED.updateCalls[0]!.patch.admin_action_required).toBe(true);
    // 3) audit emitted
    expect(SHARED.auditCalls).toHaveLength(1);
    expect(SHARED.auditCalls[0]!.event).toBe("security.hq.incident.escalated");
    expect(SHARED.auditCalls[0]!.metadata).toMatchObject({
      incident_id: INCIDENT_ID,
      reason: "recovery keeps failing",
    });
  });

  it("illegal escalation (already CLOSED) → error=illegal_escalation", async () => {
    SHARED.incidentSvc.transitionResult = {
      ok: false,
      error: "illegal_transition",
      fromStatus: "CLOSED",
    };
    const r = await runAction(escalateIncidentAction, {
      incident_id: INCIDENT_ID,
      reason: "x",
    });
    expect(r).toContain("error=illegal_escalation");
    expect(SHARED.updateCalls).toEqual([]);
    expect(SHARED.auditCalls).toEqual([]);
  });
});
