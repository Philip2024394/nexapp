// src/lib/nex-native/outreach/__tests__/outreach-suppression.test.ts
//
// Phase 1.4 · suppression layer tests. Covers:
//   · canonicalisation (case + whitespace)
//   · fail-safe when migration 203 is absent (reads do NOT claim
//     suppressed=false silently · they flag migration_203_absent)
//   · each of the four reasons records with its own tag
//   · idempotent re-record (ON CONFLICT DO NOTHING)
//   · reads use the lower() SQL comparison for case-insensitive match

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("@/lib/nex/db", () => ({
  withClient: async <T,>(
    fn: (c: { query: typeof queryMock }) => Promise<T>,
  ) => fn({ query: queryMock }),
}));

import {
  isSuppressed,
  recordOptOut,
  recordHardBounce,
  recordComplaint,
  recordAdminBlock,
  __canonicaliseEmailForTests,
} from "../outreach-suppression";

beforeEach(() => queryMock.mockReset());
afterEach(() => vi.clearAllMocks());

// ─── Canonicalisation ────────────────────────────────────────────────

describe("canonicaliseEmail · same rule as DB trigger", () => {
  it("lowercases + trims", () => {
    expect(__canonicaliseEmailForTests("  Hello@Acme.CO  ")).toBe(
      "hello@acme.co",
    );
  });
});

// ─── Fail-safe when migration 203 is absent ─────────────────────────

describe("isSuppressed · migration 203 absent", () => {
  it("returns suppressed=false but flags migration_203_absent", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ present: false }] });
    const r = await isSuppressed("x@y.co");
    expect(r.suppressed).toBe(false);
    expect(r.migration_203_absent).toBe(true);
    // Only the migration-check SQL ran · no suppression SELECT.
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe("recordOptOut · migration 203 absent", () => {
  it("returns ok=false · migration_203_absent · no INSERT ran", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ present: false }] });
    const r = await recordOptOut("x@y.co");
    expect(r.ok).toBe(false);
    expect(r.migration_203_absent).toBe(true);
    expect(r.inserted).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

// ─── Read path · lower() SQL comparison ─────────────────────────────

describe("isSuppressed · case-insensitive lookup", () => {
  it("suppressed with reason returned", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [{ reason: "hard_bounce" }] });
    const r = await isSuppressed("Mixed@Acme.CO");
    expect(r.suppressed).toBe(true);
    expect(r.reason).toBe("hard_bounce");
    // Bind param was canonicalised to mixed@acme.co.
    const call = queryMock.mock.calls[1]!;
    expect(call[1]).toEqual(["mixed@acme.co"]);
    // SQL uses lower(email) on both sides (via the trigger-normalised
    // column and the already-lowered bind value).
    expect(String(call[0])).toContain("lower(email)");
  });

  it("not suppressed · returns suppressed=false", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [] });
    const r = await isSuppressed("ok@acme.co");
    expect(r.suppressed).toBe(false);
    expect(r.reason).toBeUndefined();
  });
});

// ─── Write paths · each reason tagged correctly ─────────────────────

describe.each([
  ["recordOptOut", recordOptOut, "opt_out"],
  ["recordHardBounce", recordHardBounce, "hard_bounce"],
  ["recordComplaint", recordComplaint, "complaint"],
  ["recordAdminBlock", recordAdminBlock, "admin_block"],
] as const)(
  "%s · tags reason correctly + canonicalises email",
  (_name, fn, expectedReason) => {
    it(`records reason=${expectedReason}`, async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ present: true }] })
        .mockResolvedValueOnce({ rows: [{ suppression_id: "x" }] });
      const r = await fn("  Mixed@Acme.CO  ");
      expect(r.ok).toBe(true);
      expect(r.inserted).toBe(true);
      const insertCall = queryMock.mock.calls[1]!;
      expect(insertCall[1]![0]).toBe("mixed@acme.co");
      expect(insertCall[1]![1]).toBe(expectedReason);
    });

    it(`idempotent re-record returns inserted=false`, async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ present: true }] })
        // ON CONFLICT DO NOTHING · zero rows returned.
        .mockResolvedValueOnce({ rows: [] });
      const r = await fn("x@y.co");
      expect(r.ok).toBe(true);
      expect(r.inserted).toBe(false);
    });
  },
);
