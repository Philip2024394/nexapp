// src/lib/nex-native/device/__tests__/device-registry.test.ts
//
// Phase 2 Sprint 1 · unit tests for the device-registry service. Covers:
//   · public-key format validation (I-1 compliance · public keys only)
//   · nickname validation
//   · algorithm whitelist
//   · registerDevice happy path + idempotent re-register
//   · registerDevice duplicate-active-key race
//   · registerDevice DB error surfacing
//   · listActiveDevices · listAllDevices
//   · revokeDevice · not-found · cross-account (treated as not-found · no
//     existence leak · I-3 posture) · already-revoked · happy path
//   · touchDeviceLastSeen · fire-and-forget

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";
const DEVICE_1 = "33333333-3333-4333-8333-333333333333";
const PUBKEY_1 =
  "BASE64_ENCODED_PUBLIC_KEY_ROUGHLY_FORTY_FIVE_CHARS_LONG";
const PUBKEY_2 =
  "SECONDBASE64PUBKEYROUGHLYTHESAMELENGTHASPUBKEY1AAAAAAAA";

type FakeRow = Record<string, unknown> | null;

const STATE = vi.hoisted(() => ({
  // Stage data for SELECT reads · each `from(...).select(...).eq(...).is(...).maybeSingle()`
  // chain pulls from `selectSingleRow`; list-returning paths pull from `selectRows`.
  selectSingleRow: null as FakeRow,
  selectRows: [] as Array<Record<string, unknown>>,
  selectError: null as null | { message: string; code?: string },

  insertResult: {
    data: null as FakeRow,
    error: null as null | { message: string; code?: string },
  },
  insertedRows: [] as Array<{ table: string; row: Record<string, unknown> }>,

  updateResult: {
    data: null as FakeRow,
    error: null as null | { message: string; code?: string },
  },
  updatedCalls: [] as Array<{ table: string; row: Record<string, unknown> }>,
}));

vi.mock("../../supabase-admin", () => {
  // Supabase JS v2 chain pattern. Query builders are both thenable (list)
  // and have .maybeSingle() / .single() terminators. We mirror only the
  // methods this service exercises.
  function makeSelectChain() {
    const chain: Record<string, unknown> = {};
    const list = () =>
      Promise.resolve({ data: STATE.selectRows, error: STATE.selectError });
    const single = () =>
      Promise.resolve({ data: STATE.selectSingleRow, error: STATE.selectError });
    chain.eq = () => chain;
    chain.is = () => chain;
    chain.order = () => chain;
    chain.limit = () => chain;
    chain.maybeSingle = single;
    chain.single = single;
    (chain as Record<string, unknown>).then = (
      resolve?: ((v: unknown) => unknown) | null,
      reject?: ((r: unknown) => unknown) | null,
    ) => list().then(resolve ?? undefined, reject ?? undefined);
    return chain;
  }

  function makeInsertChain(table: string, row: Record<string, unknown> | Record<string, unknown>[]) {
    const rows = Array.isArray(row) ? row : [row];
    for (const r of rows) STATE.insertedRows.push({ table, row: r });
    return {
      select: () => ({
        single: () =>
          Promise.resolve({
            data: STATE.insertResult.data,
            error: STATE.insertResult.error,
          }),
        maybeSingle: () =>
          Promise.resolve({
            data: STATE.insertResult.data,
            error: STATE.insertResult.error,
          }),
      }),
    };
  }

  function makeUpdateChain(table: string, row: Record<string, unknown>) {
    STATE.updatedCalls.push({ table, row });
    const chain: Record<string, unknown> = {};
    const terminalSingle = () =>
      Promise.resolve({
        data: STATE.updateResult.data,
        error: STATE.updateResult.error,
      });
    chain.eq = () => chain;
    chain.is = () => chain;
    chain.select = () => ({
      single: terminalSingle,
      maybeSingle: terminalSingle,
    });
    (chain as Record<string, unknown>).then = (
      resolve?: ((v: unknown) => unknown) | null,
      reject?: ((r: unknown) => unknown) | null,
    ) =>
      terminalSingle().then(resolve ?? undefined, reject ?? undefined);
    return chain;
  }

  return {
    nexSupabaseAdmin: {
      from(table: string) {
        return {
          select: () => makeSelectChain(),
          insert: (row: Record<string, unknown> | Record<string, unknown>[]) =>
            makeInsertChain(table, row),
          update: (row: Record<string, unknown>) => makeUpdateChain(table, row),
        };
      },
    },
  };
});

import {
  isValidPublicKeyFormat,
  registerDevice,
  listActiveDevices,
  listAllDevices,
  revokeDevice,
  touchDeviceLastSeen,
} from "../device-registry";

function resetState() {
  STATE.selectSingleRow = null;
  STATE.selectRows = [];
  STATE.selectError = null;
  STATE.insertResult.data = null;
  STATE.insertResult.error = null;
  STATE.insertedRows = [];
  STATE.updateResult.data = null;
  STATE.updateResult.error = null;
  STATE.updatedCalls = [];
}

beforeEach(() => {
  resetState();
});

describe("isValidPublicKeyFormat", () => {
  it("accepts a well-formed base64 public key", () => {
    expect(isValidPublicKeyFormat(PUBKEY_1)).toBe(true);
  });

  it("accepts base64url chars (+ / = _ -)", () => {
    expect(isValidPublicKeyFormat("abc_def-GHI+jkl/=".padEnd(40, "A"))).toBe(true);
  });

  it("rejects non-string", () => {
    expect(isValidPublicKeyFormat(123)).toBe(false);
    expect(isValidPublicKeyFormat(null)).toBe(false);
    expect(isValidPublicKeyFormat(undefined)).toBe(false);
    expect(isValidPublicKeyFormat({})).toBe(false);
  });

  it("rejects strings under 32 chars", () => {
    expect(isValidPublicKeyFormat("tooshort")).toBe(false);
  });

  it("rejects strings over 2048 chars", () => {
    expect(isValidPublicKeyFormat("A".repeat(2049))).toBe(false);
  });

  it("rejects strings with spaces / control chars / unicode", () => {
    expect(isValidPublicKeyFormat("has space in middle " + "A".repeat(20))).toBe(false);
    expect(isValidPublicKeyFormat("has\ttab" + "A".repeat(30))).toBe(false);
    expect(isValidPublicKeyFormat("has\nnewline" + "A".repeat(30))).toBe(false);
    expect(isValidPublicKeyFormat("has🔑emoji" + "A".repeat(30))).toBe(false);
  });
});

describe("registerDevice", () => {
  it("rejects invalid public key format", async () => {
    const result = await registerDevice({
      accountId: ACCOUNT_A,
      publicKey: "too_short",
    });
    expect(result).toEqual({ ok: false, error: "invalid_public_key" });
    expect(STATE.insertedRows).toHaveLength(0);
  });

  it("rejects invalid algorithm", async () => {
    const result = await registerDevice({
      accountId: ACCOUNT_A,
      publicKey: PUBKEY_1,
      keyAlgorithm: "RSA-4096" as unknown as "ECDSA-P256",
    });
    expect(result).toEqual({ ok: false, error: "invalid_algorithm" });
    expect(STATE.insertedRows).toHaveLength(0);
  });

  it("rejects nickname over 64 chars", async () => {
    const result = await registerDevice({
      accountId: ACCOUNT_A,
      publicKey: PUBKEY_1,
      deviceNickname: "x".repeat(65),
    });
    expect(result).toEqual({ ok: false, error: "invalid_nickname" });
  });

  it("rejects empty-string nickname (after trim)", async () => {
    const result = await registerDevice({
      accountId: ACCOUNT_A,
      publicKey: PUBKEY_1,
      deviceNickname: "   ",
    });
    expect(result).toEqual({ ok: false, error: "invalid_nickname" });
  });

  it("inserts a new row when no existing active row", async () => {
    STATE.selectSingleRow = null;
    STATE.insertResult.data = {
      id: DEVICE_1,
      account_id: ACCOUNT_A,
      public_key: PUBKEY_1,
      key_algorithm: "ECDSA-P256",
      device_nickname: null,
      last_seen_at: "2026-11-09T00:00:00Z",
      created_at: "2026-11-09T00:00:00Z",
      revoked_at: null,
    };
    const result = await registerDevice({
      accountId: ACCOUNT_A,
      publicKey: PUBKEY_1,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.device.id).toBe(DEVICE_1);
    expect(result.device.key_algorithm).toBe("ECDSA-P256");
    expect(STATE.insertedRows).toHaveLength(1);
    expect(STATE.insertedRows[0].row.account_id).toBe(ACCOUNT_A);
    expect(STATE.insertedRows[0].row.public_key).toBe(PUBKEY_1);
    expect(STATE.insertedRows[0].row.device_nickname).toBeNull();
  });

  it("is idempotent · returns existing row without inserting", async () => {
    STATE.selectSingleRow = {
      id: DEVICE_1,
      account_id: ACCOUNT_A,
      public_key: PUBKEY_1,
      key_algorithm: "ECDSA-P256",
      device_nickname: "Phone",
      last_seen_at: "2026-11-09T00:00:00Z",
      created_at: "2026-11-09T00:00:00Z",
      revoked_at: null,
    };
    const result = await registerDevice({
      accountId: ACCOUNT_A,
      publicKey: PUBKEY_1,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.device.id).toBe(DEVICE_1);
    expect(STATE.insertedRows).toHaveLength(0);
  });

  it("surfaces unique-violation (23505) as duplicate_active_key", async () => {
    STATE.selectSingleRow = null;
    STATE.insertResult.data = null;
    STATE.insertResult.error = { code: "23505", message: "duplicate key" };
    const result = await registerDevice({
      accountId: ACCOUNT_A,
      publicKey: PUBKEY_1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not ok");
    expect(result.error).toBe("duplicate_active_key");
  });

  it("surfaces generic DB error as db_error", async () => {
    STATE.selectSingleRow = null;
    STATE.insertResult.data = null;
    STATE.insertResult.error = { code: "XX000", message: "oops" };
    const result = await registerDevice({
      accountId: ACCOUNT_A,
      publicKey: PUBKEY_1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not ok");
    expect(result.error).toBe("db_error");
  });

  it("trims nickname whitespace before persisting", async () => {
    STATE.selectSingleRow = null;
    STATE.insertResult.data = {
      id: DEVICE_1,
      account_id: ACCOUNT_A,
      public_key: PUBKEY_1,
      key_algorithm: "ECDSA-P256",
      device_nickname: "Phone",
      last_seen_at: "2026-11-09T00:00:00Z",
      created_at: "2026-11-09T00:00:00Z",
      revoked_at: null,
    };
    await registerDevice({
      accountId: ACCOUNT_A,
      publicKey: PUBKEY_1,
      deviceNickname: "   Phone   ",
    });
    expect(STATE.insertedRows[0].row.device_nickname).toBe("Phone");
  });

  it("I-1 compliance · never persists a body/ciphertext field in the insert payload", async () => {
    STATE.selectSingleRow = null;
    STATE.insertResult.data = {
      id: DEVICE_1,
      account_id: ACCOUNT_A,
      public_key: PUBKEY_1,
      key_algorithm: "ECDSA-P256",
      device_nickname: null,
      last_seen_at: "2026-11-09T00:00:00Z",
      created_at: "2026-11-09T00:00:00Z",
      revoked_at: null,
    };
    await registerDevice({ accountId: ACCOUNT_A, publicKey: PUBKEY_1 });
    const row = STATE.insertedRows[0].row;
    const forbidden = ["body", "ciphertext", "attachment", "plaintext", "content", "message_body"];
    for (const k of forbidden) {
      expect(row).not.toHaveProperty(k);
    }
  });
});

describe("listActiveDevices", () => {
  it("returns rows from the active-only query", async () => {
    STATE.selectRows = [
      {
        id: DEVICE_1,
        account_id: ACCOUNT_A,
        public_key: PUBKEY_1,
        key_algorithm: "ECDSA-P256",
        device_nickname: null,
        last_seen_at: "2026-11-09T00:00:00Z",
        created_at: "2026-11-09T00:00:00Z",
        revoked_at: null,
      },
    ];
    const devices = await listActiveDevices(ACCOUNT_A);
    expect(devices).toHaveLength(1);
    expect(devices[0].id).toBe(DEVICE_1);
  });

  it("throws on DB error", async () => {
    STATE.selectError = { message: "db down" };
    await expect(listActiveDevices(ACCOUNT_A)).rejects.toThrow(/db down/);
  });
});

describe("listAllDevices", () => {
  it("returns rows (including revoked) from unfiltered query", async () => {
    STATE.selectRows = [
      {
        id: DEVICE_1,
        account_id: ACCOUNT_A,
        public_key: PUBKEY_1,
        key_algorithm: "ECDSA-P256",
        device_nickname: null,
        last_seen_at: "2026-11-09T00:00:00Z",
        created_at: "2026-11-09T00:00:00Z",
        revoked_at: "2026-11-09T01:00:00Z",
      },
    ];
    const devices = await listAllDevices(ACCOUNT_A);
    expect(devices).toHaveLength(1);
    expect(devices[0].revoked_at).toBe("2026-11-09T01:00:00Z");
  });
});

describe("revokeDevice", () => {
  it("returns not_found for missing device", async () => {
    STATE.selectSingleRow = null;
    const result = await revokeDevice(DEVICE_1, ACCOUNT_A);
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("returns not_found for cross-account (no existence leak)", async () => {
    STATE.selectSingleRow = {
      id: DEVICE_1,
      account_id: ACCOUNT_B,
      revoked_at: null,
    };
    const result = await revokeDevice(DEVICE_1, ACCOUNT_A);
    expect(result).toEqual({ ok: false, error: "not_found" });
    // critically · no update attempted
    expect(STATE.updatedCalls).toHaveLength(0);
  });

  it("returns already_revoked for revoked device", async () => {
    STATE.selectSingleRow = {
      id: DEVICE_1,
      account_id: ACCOUNT_A,
      revoked_at: "2026-11-09T00:30:00Z",
    };
    const result = await revokeDevice(DEVICE_1, ACCOUNT_A);
    expect(result).toEqual({ ok: false, error: "already_revoked" });
    expect(STATE.updatedCalls).toHaveLength(0);
  });

  it("revokes · soft-tombstone · update payload contains only revoked_at", async () => {
    STATE.selectSingleRow = {
      id: DEVICE_1,
      account_id: ACCOUNT_A,
      revoked_at: null,
    };
    STATE.updateResult.data = { id: DEVICE_1 };
    const result = await revokeDevice(DEVICE_1, ACCOUNT_A);
    expect(result).toEqual({ ok: true });
    expect(STATE.updatedCalls).toHaveLength(1);
    const payload = STATE.updatedCalls[0].row;
    expect(payload).toHaveProperty("revoked_at");
    expect(Object.keys(payload)).toEqual(["revoked_at"]);
  });

  it("idempotent race · update returns null data, still returns ok", async () => {
    STATE.selectSingleRow = {
      id: DEVICE_1,
      account_id: ACCOUNT_A,
      revoked_at: null,
    };
    STATE.updateResult.data = null;
    const result = await revokeDevice(DEVICE_1, ACCOUNT_A);
    expect(result).toEqual({ ok: true });
  });
});

describe("touchDeviceLastSeen", () => {
  it("fires an update targeting last_seen_at only", async () => {
    STATE.updateResult.data = null;
    await touchDeviceLastSeen(DEVICE_1, ACCOUNT_A);
    expect(STATE.updatedCalls).toHaveLength(1);
    const payload = STATE.updatedCalls[0].row;
    expect(payload).toHaveProperty("last_seen_at");
    expect(Object.keys(payload)).toEqual(["last_seen_at"]);
  });
});
