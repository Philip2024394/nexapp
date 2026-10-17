// src/lib/nex-native/__tests__/hq-authorization.test.ts
//
// NEX HQ authorization helper · Phase 2.1 · regression anchor.
// Owner-sealed 2026-10-17.
// -------------------------------------------------------------------
// Tests the sealed server-only `hq-authorization` helper's fail-closed
// behaviour across every path a real caller can hit:
//
//   · ordinary accounts (hq_role=null)             → DENIED (both roles)
//   · reviewer accounts                            → reviewer PASSES
//                                                   admin DENIED
//   · admin accounts                               → both PASS
//   · DB lookup errors (fail-closed)               → DENIED (both roles)
//   · column missing (pre-apply migration 206)     → DENIED
//   · unexpected hq_role value from DB             → DENIED
//   · null / empty / malformed accountId           → DENIED
//
// Regression anchor: these tests encode the SEALED policy ("fail-closed
// on any uncertainty"). Any future refactor that silently relaxes a
// denial path must UPDATE THIS TEST, forcing the change through
// explicit review.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted Supabase admin mock ────────────────────────────────────

const { maybeSingleMock } = vi.hoisted(() => ({
  maybeSingleMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: maybeSingleMock,
        }),
      }),
    }),
  },
  nexSupabaseProjectRef: () => "mock",
}));

import {
  getHqRole,
  requireHqReviewer,
  requireHqAdmin,
  HqAuthorizationError,
  isHqAuthorizationError,
} from "../hq-authorization";

const ANY_UUID = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  maybeSingleMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── A · getHqRole · happy paths ────────────────────────────────────

describe("getHqRole · happy paths", () => {
  test("ordinary account (hq_role=null) → null", async () => {
    maybeSingleMock.mockResolvedValue({ data: { hq_role: null }, error: null });
    expect(await getHqRole(ANY_UUID)).toBe(null);
  });
  test("reviewer account → 'reviewer'", async () => {
    maybeSingleMock.mockResolvedValue({ data: { hq_role: "reviewer" }, error: null });
    expect(await getHqRole(ANY_UUID)).toBe("reviewer");
  });
  test("admin account → 'admin'", async () => {
    maybeSingleMock.mockResolvedValue({ data: { hq_role: "admin" }, error: null });
    expect(await getHqRole(ANY_UUID)).toBe("admin");
  });
});

// ─── B · getHqRole · fail-closed paths ───────────────────────────────

describe("getHqRole · fail-closed on uncertainty", () => {
  test("missing row → null (not throw)", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    expect(await getHqRole(ANY_UUID)).toBe(null);
  });
  test("DB error → null (never throws · fail-closed)", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: new Error("transient") });
    expect(await getHqRole(ANY_UUID)).toBe(null);
  });
  test("pre-migration-206 column-missing error (PostgREST 42703) → null", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: new Error(`column "hq_role" does not exist`),
    });
    expect(await getHqRole(ANY_UUID)).toBe(null);
  });
  test("unexpected hq_role value from DB → null (never grants)", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { hq_role: "SUPERUSER" },
      error: null,
    });
    expect(await getHqRole(ANY_UUID)).toBe(null);
  });
  test("hq_role of unexpected type → null", async () => {
    maybeSingleMock.mockResolvedValue({ data: { hq_role: 42 }, error: null });
    expect(await getHqRole(ANY_UUID)).toBe(null);
  });
  test("thrown error inside query path → null (caught · never propagates)", async () => {
    maybeSingleMock.mockRejectedValue(new Error("network dropped"));
    expect(await getHqRole(ANY_UUID)).toBe(null);
  });
  test("null accountId → null (no DB lookup)", async () => {
    expect(await getHqRole(null)).toBe(null);
    expect(maybeSingleMock).not.toHaveBeenCalled();
  });
  test("undefined accountId → null (no DB lookup)", async () => {
    expect(await getHqRole(undefined)).toBe(null);
    expect(maybeSingleMock).not.toHaveBeenCalled();
  });
  test("empty-string accountId → null (no DB lookup)", async () => {
    expect(await getHqRole("")).toBe(null);
    expect(maybeSingleMock).not.toHaveBeenCalled();
  });
});

// ─── C · requireHqReviewer · gate behaviour ──────────────────────────

describe("requireHqReviewer", () => {
  test("ordinary account (hq_role=null) → throws HqAuthorizationError", async () => {
    maybeSingleMock.mockResolvedValue({ data: { hq_role: null }, error: null });
    await expect(requireHqReviewer(ANY_UUID)).rejects.toBeInstanceOf(
      HqAuthorizationError,
    );
  });
  test("reviewer → passes · returns 'reviewer'", async () => {
    maybeSingleMock.mockResolvedValue({ data: { hq_role: "reviewer" }, error: null });
    await expect(requireHqReviewer(ANY_UUID)).resolves.toBe("reviewer");
  });
  test("admin → passes · returns 'admin' (admin ⊇ reviewer)", async () => {
    maybeSingleMock.mockResolvedValue({ data: { hq_role: "admin" }, error: null });
    await expect(requireHqReviewer(ANY_UUID)).resolves.toBe("admin");
  });
  test("DB error → throws (fail-closed)", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: new Error("x") });
    await expect(requireHqReviewer(ANY_UUID)).rejects.toBeInstanceOf(
      HqAuthorizationError,
    );
  });
  test("null session → throws", async () => {
    await expect(requireHqReviewer(null)).rejects.toBeInstanceOf(
      HqAuthorizationError,
    );
  });
});

// ─── D · requireHqAdmin · strict (reviewer insufficient) ─────────────

describe("requireHqAdmin · strict", () => {
  test("ordinary account → throws", async () => {
    maybeSingleMock.mockResolvedValue({ data: { hq_role: null }, error: null });
    await expect(requireHqAdmin(ANY_UUID)).rejects.toBeInstanceOf(
      HqAuthorizationError,
    );
  });
  test("reviewer → THROWS (reviewer is NOT admin · critical boundary)", async () => {
    maybeSingleMock.mockResolvedValue({ data: { hq_role: "reviewer" }, error: null });
    await expect(requireHqAdmin(ANY_UUID)).rejects.toBeInstanceOf(
      HqAuthorizationError,
    );
  });
  test("admin → passes (returns void)", async () => {
    maybeSingleMock.mockResolvedValue({ data: { hq_role: "admin" }, error: null });
    await expect(requireHqAdmin(ANY_UUID)).resolves.toBeUndefined();
  });
  test("DB error → throws (fail-closed)", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: new Error("x") });
    await expect(requireHqAdmin(ANY_UUID)).rejects.toBeInstanceOf(
      HqAuthorizationError,
    );
  });
});

// ─── E · HqAuthorizationError shape ──────────────────────────────────

describe("HqAuthorizationError", () => {
  test("isHqAuthorizationError type guard matches thrown error", async () => {
    maybeSingleMock.mockResolvedValue({ data: { hq_role: null }, error: null });
    try {
      await requireHqReviewer(ANY_UUID);
      throw new Error("should have thrown");
    } catch (e) {
      expect(isHqAuthorizationError(e)).toBe(true);
      if (isHqAuthorizationError(e)) {
        expect(e.requiredRole).toBe("reviewer");
      }
    }
  });
  test("isHqAuthorizationError type guard rejects unrelated errors", () => {
    expect(isHqAuthorizationError(new Error("not me"))).toBe(false);
    expect(isHqAuthorizationError(null)).toBe(false);
    expect(isHqAuthorizationError(undefined)).toBe(false);
    expect(isHqAuthorizationError("string")).toBe(false);
  });
  test("admin requirement is tagged on the error for consumer branching", async () => {
    maybeSingleMock.mockResolvedValue({ data: { hq_role: "reviewer" }, error: null });
    try {
      await requireHqAdmin(ANY_UUID);
    } catch (e) {
      if (isHqAuthorizationError(e)) expect(e.requiredRole).toBe("admin");
    }
  });
});
