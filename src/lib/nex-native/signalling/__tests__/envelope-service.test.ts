// src/lib/nex-native/signalling/__tests__/envelope-service.test.ts
//
// Phase 2 Sprint 2 (draft) · unit tests for the signalling envelope
// service. Mirrors the device-registry mock pattern.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const DEVICE_A = "11111111-1111-4111-8111-111111111111";
const DEVICE_B = "22222222-2222-4222-8222-222222222222";

const STATE = vi.hoisted(() => ({
  insertResult: {
    data: null as null | Record<string, unknown>,
    error: null as null | { message: string; code?: string },
  },
  insertedRows: [] as Array<{ table: string; row: Record<string, unknown> }>,
  selectRows: [] as Array<Record<string, unknown>>,
  selectError: null as null | { message: string },
  deleteRows: [] as Array<Record<string, unknown>>,
  rpcData: null as unknown,
  rpcError: null as null | { message: string },
  rpcCalls: [] as Array<{ fn: string; args: unknown }>,
}));

vi.mock("../../supabase-admin", () => {
  function makeSelectChain() {
    const chain: Record<string, unknown> = {};
    const list = () =>
      Promise.resolve({ data: STATE.selectRows, error: STATE.selectError });
    const single = () =>
      Promise.resolve({
        data: STATE.insertResult.data,
        error: STATE.insertResult.error,
      });
    chain.eq = () => chain;
    chain.gt = () => chain;
    chain.lt = () => chain;
    chain.order = () => chain;
    chain.limit = () => chain;
    chain.single = single;
    chain.maybeSingle = single;
    (chain as Record<string, unknown>).then = (
      resolve?: ((v: unknown) => unknown) | null,
      reject?: ((r: unknown) => unknown) | null,
    ) => list().then(resolve ?? undefined, reject ?? undefined);
    return chain;
  }

  function makeInsertChain(table: string, row: Record<string, unknown>) {
    STATE.insertedRows.push({ table, row });
    return {
      select: () => ({
        single: () =>
          Promise.resolve({
            data: STATE.insertResult.data,
            error: STATE.insertResult.error,
          }),
      }),
    };
  }

  function makeDeleteChain() {
    const chain: Record<string, unknown> = {};
    chain.eq = () => chain;
    chain.lt = () => chain;
    chain.select = () =>
      Promise.resolve({ data: STATE.deleteRows, error: null });
    return chain;
  }

  return {
    nexSupabaseAdmin: {
      from(table: string) {
        return {
          select: () => makeSelectChain(),
          insert: (row: Record<string, unknown>) => makeInsertChain(table, row),
          delete: () => makeDeleteChain(),
        };
      },
      rpc: (fn: string, args: unknown) => {
        STATE.rpcCalls.push({ fn, args });
        return Promise.resolve({ data: STATE.rpcData, error: STATE.rpcError });
      },
    },
  };
});

import {
  putEnvelope,
  peekEnvelopes,
  pruneExpiredEnvelopes,
  takeEnvelopesFor,
  MAX_ENVELOPE_TTL_SECONDS,
  MAX_PAYLOAD_BYTES,
} from "../envelope-service";

beforeEach(() => {
  STATE.insertResult.data = null;
  STATE.insertResult.error = null;
  STATE.insertedRows = [];
  STATE.selectRows = [];
  STATE.selectError = null;
  STATE.deleteRows = [];
  STATE.rpcData = null;
  STATE.rpcError = null;
  STATE.rpcCalls = [];
});

const ONE_BYTE = new Uint8Array([1]);
const KB32 = new Uint8Array(MAX_PAYLOAD_BYTES);
const OVERLARGE = new Uint8Array(MAX_PAYLOAD_BYTES + 1);

describe("putEnvelope", () => {
  it("rejects invalid envelope_type", async () => {
    const r = await putEnvelope({
      fromDeviceId: DEVICE_A,
      toDeviceId: DEVICE_B,
      envelopeType: "evil_type" as unknown as "sdp_offer",
      payload: ONE_BYTE,
    });
    expect(r).toEqual({ ok: false, error: "invalid_type" });
  });

  it("rejects self-targeted envelope", async () => {
    const r = await putEnvelope({
      fromDeviceId: DEVICE_A,
      toDeviceId: DEVICE_A,
      envelopeType: "handshake",
      payload: ONE_BYTE,
    });
    expect(r).toEqual({ ok: false, error: "self_targeted" });
  });

  it("rejects TTL above MAX_ENVELOPE_TTL_SECONDS", async () => {
    const r = await putEnvelope({
      fromDeviceId: DEVICE_A,
      toDeviceId: DEVICE_B,
      envelopeType: "handshake",
      payload: ONE_BYTE,
      ttlSeconds: MAX_ENVELOPE_TTL_SECONDS + 1,
    });
    expect(r).toEqual({ ok: false, error: "invalid_ttl" });
  });

  it("rejects TTL ≤0", async () => {
    const r = await putEnvelope({
      fromDeviceId: DEVICE_A,
      toDeviceId: DEVICE_B,
      envelopeType: "handshake",
      payload: ONE_BYTE,
      ttlSeconds: 0,
    });
    expect(r).toEqual({ ok: false, error: "invalid_ttl" });
  });

  it("rejects non-Uint8Array payload", async () => {
    const r = await putEnvelope({
      fromDeviceId: DEVICE_A,
      toDeviceId: DEVICE_B,
      envelopeType: "handshake",
      payload: "not-bytes" as unknown as Uint8Array,
    });
    expect(r).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("rejects empty payload", async () => {
    const r = await putEnvelope({
      fromDeviceId: DEVICE_A,
      toDeviceId: DEVICE_B,
      envelopeType: "handshake",
      payload: new Uint8Array(0),
    });
    expect(r).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("rejects payload > 32KB", async () => {
    const r = await putEnvelope({
      fromDeviceId: DEVICE_A,
      toDeviceId: DEVICE_B,
      envelopeType: "handshake",
      payload: OVERLARGE,
    });
    expect(r).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("accepts payload at exactly MAX_PAYLOAD_BYTES", async () => {
    STATE.insertResult.data = { id: "abc", expires_at: "2026-11-09T00:01:30Z" };
    const r = await putEnvelope({
      fromDeviceId: DEVICE_A,
      toDeviceId: DEVICE_B,
      envelopeType: "sdp_offer",
      payload: KB32,
    });
    expect(r.ok).toBe(true);
  });

  it("I-1 compliance · insert payload has NO body/ciphertext/content keys", async () => {
    STATE.insertResult.data = { id: "abc", expires_at: "2026-11-09T00:01:30Z" };
    await putEnvelope({
      fromDeviceId: DEVICE_A,
      toDeviceId: DEVICE_B,
      envelopeType: "sdp_offer",
      payload: ONE_BYTE,
    });
    const row = STATE.insertedRows[0].row;
    const forbidden = ["body", "ciphertext", "plaintext", "content", "message_body", "attachment"];
    for (const k of forbidden) {
      expect(row).not.toHaveProperty(k);
    }
  });

  it("writes expires_at within the cap", async () => {
    STATE.insertResult.data = { id: "abc", expires_at: "2026-11-09T00:01:30Z" };
    await putEnvelope({
      fromDeviceId: DEVICE_A,
      toDeviceId: DEVICE_B,
      envelopeType: "sdp_offer",
      payload: ONE_BYTE,
      ttlSeconds: 90,
    });
    const row = STATE.insertedRows[0].row as { expires_at: string; envelope_type: string };
    const expiresAt = new Date(row.expires_at).getTime();
    const now = Date.now();
    expect(expiresAt).toBeGreaterThan(now);
    expect(expiresAt).toBeLessThanOrEqual(now + MAX_ENVELOPE_TTL_SECONDS * 1000 + 1000);
    expect(row.envelope_type).toBe("sdp_offer");
  });

  it("surfaces generic DB error", async () => {
    STATE.insertResult.data = null;
    STATE.insertResult.error = { message: "oops" };
    const r = await putEnvelope({
      fromDeviceId: DEVICE_A,
      toDeviceId: DEVICE_B,
      envelopeType: "sdp_offer",
      payload: ONE_BYTE,
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected not ok");
    expect(r.error).toBe("db_error");
  });
});

describe("takeEnvelopesFor", () => {
  it("invokes atomic read-and-delete RPC", async () => {
    STATE.rpcData = [
      {
        id: "env-1",
        from_device_id: DEVICE_B,
        to_device_id: DEVICE_A,
        envelope_type: "sdp_answer",
        payload: new Uint8Array([1, 2]),
        created_at: "2026-11-09T00:00:00Z",
        expires_at: "2026-11-09T00:01:30Z",
      },
    ];
    const r = await takeEnvelopesFor(DEVICE_A);
    expect(Array.isArray(r)).toBe(true);
    expect(STATE.rpcCalls).toHaveLength(1);
    expect(STATE.rpcCalls[0].fn).toBe("nex_take_signalling_envelopes");
    expect(STATE.rpcCalls[0].args).toEqual({ p_to_device_id: DEVICE_A });
  });

  it("surfaces RPC error", async () => {
    STATE.rpcError = { message: "rpc failed" };
    const r = await takeEnvelopesFor(DEVICE_A);
    expect(Array.isArray(r)).toBe(false);
    expect(r).toMatchObject({ ok: false, error: "db_error" });
  });
});

describe("peekEnvelopes", () => {
  it("returns rows for device", async () => {
    STATE.selectRows = [{ id: "env-1" }];
    const r = await peekEnvelopes(DEVICE_A);
    expect(r).toHaveLength(1);
  });

  it("throws on DB error", async () => {
    STATE.selectError = { message: "fail" };
    await expect(peekEnvelopes(DEVICE_A)).rejects.toThrow(/fail/);
  });
});

describe("pruneExpiredEnvelopes", () => {
  it("returns number of deleted rows", async () => {
    STATE.deleteRows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const n = await pruneExpiredEnvelopes();
    expect(n).toBe(3);
  });
});
