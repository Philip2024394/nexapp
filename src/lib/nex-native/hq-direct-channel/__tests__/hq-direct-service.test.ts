// src/lib/nex-native/hq-direct-channel/__tests__/hq-direct-service.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const SHARED = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcData: null as unknown,
  rpcError: null as null | { message: string },
  auditCalls: [] as Array<{
    event: string;
    outcome: string;
    metadata: Record<string, unknown>;
  }>,
}));

vi.mock("../../supabase-admin", () => ({
  nexSupabaseAdmin: {
    rpc(fn: string, args: Record<string, unknown>) {
      SHARED.rpcCalls.push({ fn, args });
      return Promise.resolve({ data: SHARED.rpcData, error: SHARED.rpcError });
    },
    from() {
      // Not exercised in the service-level tests below · fetch read
      // path has its own slice below that overrides this.
      return {
        select: () => ({
          eq: () => ({
            order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
          }),
          or: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
      };
    },
  },
}));

vi.mock("../../security-audit-service", () => ({
  recordAuditEvent: (input: {
    event: string;
    outcome: string;
    metadata?: Record<string, unknown>;
  }) => {
    SHARED.auditCalls.push({
      event: input.event,
      outcome: input.outcome,
      metadata: input.metadata ?? {},
    });
    return Promise.resolve({ ok: true, logId: SHARED.auditCalls.length });
  },
}));

const HQ = "99999999-dddd-4000-8000-00000000000a";
const TARGET = "99999999-dddd-4000-8000-00000000000b";
const SENTINEL = "11111111-aaaa-aaaa-aaaa-111111111111";

describe("hq-direct-service", () => {
  beforeEach(async () => {
    SHARED.rpcCalls = [];
    SHARED.rpcData = null;
    SHARED.rpcError = null;
    SHARED.auditCalls = [];
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("openChannelForMember", () => {
    it("returns the channel id on success", async () => {
      SHARED.rpcData = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const { openChannelForMember } = await import("../hq-direct-service");
      const r = await openChannelForMember(HQ, TARGET);
      expect(r.channelId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
      expect(SHARED.rpcCalls).toHaveLength(1);
      expect(SHARED.rpcCalls[0]!.fn).toBe("nex_hq_direct_channel_upsert");
      expect(SHARED.rpcCalls[0]!.args._target_account_id).toBe(TARGET);
      expect(SHARED.rpcCalls[0]!.args._hq_account_id).toBe(HQ);
    });

    it("throws invalid_target when target is a malformed UUID", async () => {
      const { openChannelForMember, isHqDirectError } = await import("../hq-direct-service");
      try {
        await openChannelForMember(HQ, "not-a-uuid");
        throw new Error("did not throw");
      } catch (e) {
        expect(isHqDirectError(e)).toBe(true);
        if (isHqDirectError(e)) expect(e.code).toBe("invalid_target");
      }
      expect(SHARED.rpcCalls).toEqual([]);
    });

    it("rejects the sentinel UUID as a target", async () => {
      const { openChannelForMember, isHqDirectError } = await import("../hq-direct-service");
      try {
        await openChannelForMember(HQ, SENTINEL);
        throw new Error("did not throw");
      } catch (e) {
        expect(isHqDirectError(e)).toBe(true);
        if (isHqDirectError(e)) expect(e.code).toBe("invalid_target");
      }
    });

    it("surfaces RPC errors as upsert_failed", async () => {
      SHARED.rpcError = { message: "db offline" };
      const { openChannelForMember, isHqDirectError } = await import("../hq-direct-service");
      try {
        await openChannelForMember(HQ, TARGET);
        throw new Error("did not throw");
      } catch (e) {
        expect(isHqDirectError(e)).toBe(true);
        if (isHqDirectError(e)) expect(e.code).toBe("upsert_failed");
      }
    });
  });

  describe("sendHqMessage", () => {
    it("happy path · calls RPC + emits completed audit with body_length only", async () => {
      SHARED.rpcData = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      const { sendHqMessage } = await import("../hq-direct-service");
      const r = await sendHqMessage({
        hqAccountId: HQ,
        targetAccountId: TARGET,
        body: "hello there",
      });
      expect(r.messageId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
      expect(SHARED.rpcCalls).toHaveLength(1);
      expect(SHARED.rpcCalls[0]!.fn).toBe("nex_hq_direct_send");
      expect(SHARED.rpcCalls[0]!.args._body).toBe("hello there");
      // Audit event emitted · body_length only · no body content.
      const completed = SHARED.auditCalls.find(
        (c) => c.event === "security.hq.direct_message.completed",
      );
      expect(completed).toBeTruthy();
      expect(completed!.metadata.body_length).toBe(11);
      expect(completed!.metadata.target_account_id).toBe(TARGET);
      // Prohibition sanity · we did not accidentally leak the body
      // under any metadata key.
      expect(
        Object.values(completed!.metadata).every(
          (v) => typeof v !== "string" || !v.includes("hello"),
        ),
      ).toBe(true);
    });

    it("rejects empty body before RPC call", async () => {
      const { sendHqMessage, isHqDirectError } = await import("../hq-direct-service");
      try {
        await sendHqMessage({
          hqAccountId: HQ,
          targetAccountId: TARGET,
          body: "   ",
        });
        throw new Error("did not throw");
      } catch (e) {
        expect(isHqDirectError(e)).toBe(true);
        if (isHqDirectError(e)) expect(e.code).toBe("invalid_body");
      }
      expect(SHARED.rpcCalls).toEqual([]);
    });

    it("rejects overlong body before RPC call", async () => {
      const { sendHqMessage, isHqDirectError } = await import("../hq-direct-service");
      try {
        await sendHqMessage({
          hqAccountId: HQ,
          targetAccountId: TARGET,
          body: "x".repeat(4001),
        });
        throw new Error("did not throw");
      } catch (e) {
        expect(isHqDirectError(e)).toBe(true);
        if (isHqDirectError(e)) expect(e.code).toBe("invalid_body");
      }
      expect(SHARED.rpcCalls).toEqual([]);
    });

    it("rejects non-UUID target before RPC call", async () => {
      const { sendHqMessage, isHqDirectError } = await import("../hq-direct-service");
      try {
        await sendHqMessage({
          hqAccountId: HQ,
          targetAccountId: "not-a-uuid",
          body: "hi",
        });
        throw new Error("did not throw");
      } catch (e) {
        expect(isHqDirectError(e)).toBe(true);
        if (isHqDirectError(e)) expect(e.code).toBe("invalid_target");
      }
    });

    it("classifies target-not-found from the PG RAISE", async () => {
      SHARED.rpcError = { message: "target account not found or deleted" };
      const { sendHqMessage, isHqDirectError } = await import("../hq-direct-service");
      try {
        await sendHqMessage({
          hqAccountId: HQ,
          targetAccountId: TARGET,
          body: "hi",
        });
        throw new Error("did not throw");
      } catch (e) {
        expect(isHqDirectError(e)).toBe(true);
        if (isHqDirectError(e)) expect(e.code).toBe("target_not_found");
      }
      const failed = SHARED.auditCalls.find(
        (c) => c.event === "security.hq.direct_message.failed",
      );
      expect(failed).toBeTruthy();
      expect(failed!.metadata.error_code).toBe("target_not_found");
    });

    it("maps other RPC errors to send_failed + emits failed audit", async () => {
      SHARED.rpcError = { message: "boom" };
      const { sendHqMessage, isHqDirectError } = await import("../hq-direct-service");
      try {
        await sendHqMessage({
          hqAccountId: HQ,
          targetAccountId: TARGET,
          body: "hi",
        });
        throw new Error("did not throw");
      } catch (e) {
        expect(isHqDirectError(e)).toBe(true);
        if (isHqDirectError(e)) expect(e.code).toBe("send_failed");
      }
      const failed = SHARED.auditCalls.find(
        (c) => c.event === "security.hq.direct_message.failed",
      );
      expect(failed).toBeTruthy();
    });

    it("exports the sealed sentinel UUID constant", async () => {
      const mod = await import("../hq-direct-service");
      expect(mod.NEX_HQ_SENTINEL_ACCOUNT_ID).toBe(SENTINEL);
    });
  });
});
