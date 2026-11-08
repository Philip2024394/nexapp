// src/app/api/nex-native/hq/direct-message/__tests__/route.test.ts
//
// Regression coverage for POST /api/nex-native/hq/direct-message.
// Owner-authorised 2026-11-08.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const HQ = "99999999-dddd-4000-8000-00000000000a";
const TARGET = "99999999-dddd-4000-8000-00000000000b";

const mocks = vi.hoisted(() => ({
  sessionResult: null as null | { account: { id: string } },
  hqAdminShouldReject: false,
  rateLimited: false,
  sendResult: { messageId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" } as unknown,
  sendCalls: [] as Array<{
    hqAccountId: string;
    targetAccountId: string;
    body: string;
  }>,
  sendError: null as null | Error,
  auditCalls: [] as Array<{ event: string; outcome: string }>,
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: () => Promise.resolve(mocks.sessionResult),
}));

vi.mock("@/lib/nex-native/hq-authorization", async () => {
  class HqAuthErrorForTest extends Error {
    readonly kind = "HqAuthorizationError" as const;
    readonly requiredRole: "admin";
    constructor() {
      super("mock");
      this.name = "HqAuthorizationError";
      this.requiredRole = "admin";
    }
  }
  return {
    requireHqAdmin: () => {
      if (mocks.hqAdminShouldReject) {
        return Promise.reject(new HqAuthErrorForTest());
      }
      return Promise.resolve();
    },
    isHqAuthorizationError: (e: unknown) =>
      typeof e === "object" &&
      e !== null &&
      (e as { kind?: string }).kind === "HqAuthorizationError",
  };
});

vi.mock("@/lib/nex-native/security-rate-limit", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/nex-native/security-rate-limit")
  >("@/lib/nex-native/security-rate-limit");
  return {
    ...actual,
    recordIfAllowed: () =>
      mocks.rateLimited
        ? Promise.reject(
            new actual.SecurityRateLimitError("account_create", 180),
          )
        : Promise.resolve(),
  };
});

vi.mock("@/lib/nex-native/security-audit-service", () => ({
  recordAuditEvent: (input: { event: string; outcome: string }) => {
    mocks.auditCalls.push({ event: input.event, outcome: input.outcome });
    return Promise.resolve({ ok: true, logId: mocks.auditCalls.length });
  },
  isAuditWriteError: (e: unknown) =>
    e instanceof Error && e.name === "AuditWriteError",
}));

vi.mock("@/lib/nex-native/hq-direct-channel/hq-direct-service", async () => {
  class HqDirectErrorForTest extends Error {
    readonly code: string;
    readonly detail?: string;
    constructor(code: string, detail?: string) {
      super(`hq-direct: ${code}`);
      this.name = "HqDirectError";
      this.code = code;
      this.detail = detail;
    }
  }
  return {
    HqDirectError: HqDirectErrorForTest,
    isHqDirectError: (e: unknown) =>
      e instanceof Error && e.name === "HqDirectError",
    sendHqMessage: (input: {
      hqAccountId: string;
      targetAccountId: string;
      body: string;
    }) => {
      mocks.sendCalls.push(input);
      if (mocks.sendError) return Promise.reject(mocks.sendError);
      return Promise.resolve(mocks.sendResult);
    },
    NEX_HQ_SENTINEL_ACCOUNT_ID: "11111111-aaaa-aaaa-aaaa-111111111111",
  };
});

const { POST } = await import("../route");

function makeReq(body: unknown) {
  return new Request("http://localhost/api/nex-native/hq/direct-message", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/nex-native/hq/direct-message", () => {
  beforeEach(() => {
    mocks.sessionResult = { account: { id: HQ } };
    mocks.hqAdminShouldReject = false;
    mocks.rateLimited = false;
    mocks.sendResult = { messageId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };
    mocks.sendCalls = [];
    mocks.sendError = null;
    mocks.auditCalls = [];
  });

  it("no session → 401 · service NOT invoked", async () => {
    mocks.sessionResult = null;
    const res = await POST(
      makeReq({ target_account_id: TARGET, body: "hi" }) as never,
    );
    expect(res.status).toBe(401);
    expect(mocks.sendCalls).toEqual([]);
  });

  it("non-HQ admin → 403 · service NOT invoked", async () => {
    mocks.hqAdminShouldReject = true;
    const res = await POST(
      makeReq({ target_account_id: TARGET, body: "hi" }) as never,
    );
    expect(res.status).toBe(403);
    expect(mocks.sendCalls).toEqual([]);
  });

  it("invalid JSON body → 400", async () => {
    const res = await POST(makeReq("not-json") as never);
    expect(res.status).toBe(400);
    expect(mocks.sendCalls).toEqual([]);
  });

  it("invalid target UUID → 400 invalid_target · no send", async () => {
    const res = await POST(
      makeReq({ target_account_id: "nope", body: "hi" }) as never,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_target");
    expect(mocks.sendCalls).toEqual([]);
  });

  it("empty body → 400 invalid_body · no send", async () => {
    const res = await POST(
      makeReq({ target_account_id: TARGET, body: "   " }) as never,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_body");
    expect(mocks.sendCalls).toEqual([]);
  });

  it("overlong body → 400 invalid_body", async () => {
    const res = await POST(
      makeReq({ target_account_id: TARGET, body: "x".repeat(4001) }) as never,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_body");
  });

  it("rate-limited → 429 + Retry-After · emits failed audit · no send", async () => {
    mocks.rateLimited = true;
    const res = await POST(
      makeReq({ target_account_id: TARGET, body: "hi" }) as never,
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("180");
    expect(
      mocks.auditCalls.some(
        (c) =>
          c.event === "security.hq.direct_message.failed" &&
          c.outcome === "failed",
      ),
    ).toBe(true);
    expect(mocks.sendCalls).toEqual([]);
  });

  it("service returns target_not_found → 404", async () => {
    const { HqDirectError } = await import(
      "@/lib/nex-native/hq-direct-channel/hq-direct-service"
    );
    mocks.sendError = new HqDirectError("target_not_found", "no such account");
    const res = await POST(
      makeReq({ target_account_id: TARGET, body: "hi" }) as never,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("target_not_found");
  });

  it("service returns send_failed → 500", async () => {
    const { HqDirectError } = await import(
      "@/lib/nex-native/hq-direct-channel/hq-direct-service"
    );
    mocks.sendError = new HqDirectError("send_failed", "db down");
    const res = await POST(
      makeReq({ target_account_id: TARGET, body: "hi" }) as never,
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("send_failed");
  });

  it("happy path → 200 { ok: true, messageId } · body not echoed in response", async () => {
    const res = await POST(
      makeReq({ target_account_id: TARGET, body: "hello there" }) as never,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; messageId: string };
    expect(body.ok).toBe(true);
    expect(body.messageId).toBe("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(mocks.sendCalls).toHaveLength(1);
    expect(mocks.sendCalls[0]!.hqAccountId).toBe(HQ);
    expect(mocks.sendCalls[0]!.targetAccountId).toBe(TARGET);
    expect(mocks.sendCalls[0]!.body).toBe("hello there");
    // Response does not echo the chat body.
    expect(JSON.stringify(body).includes("hello")).toBe(false);
  });

  it("unexpected non-HqDirectError bubble → 500 with generic send_failed", async () => {
    mocks.sendError = new Error("some unexpected explosion");
    const res = await POST(
      makeReq({ target_account_id: TARGET, body: "hi" }) as never,
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("send_failed");
  });
});
