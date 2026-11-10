// src/lib/nex-native/merchant-qr/__tests__/qr-asset-service.test.ts
//
// P5 pre-activation review · owner-authorised 2026-11-10.
//
// Tests the asset service's status-based filtering · proves that:
//   · getActiveQrAsset returns ONLY status='active' rows
//   · retired / pending_preview / rejected rows cannot leak to buyer
//   · pathForAsset is deterministic per (business_id, sha, mime)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryChain = {
  eq: vi.fn(),
  maybeSingle: vi.fn(),
};
let selectChain: Record<string, unknown> = {};
const fromMock = vi.fn();
const updateMock = vi.fn();

// Shared in-memory snapshot of rows the mock DB "contains" per test.
let rows: Array<Record<string, unknown>> = [];

function resetDb() {
  rows = [];
  fromMock.mockReset();
  queryChain.eq.mockReset();
  queryChain.maybeSingle.mockReset();
  updateMock.mockReset();

  // Minimal fluent builder that supports .select(..).eq(..).eq(..).maybeSingle()
  // and .update(..).eq(..).select(..).maybeSingle() patterns used by the service.
  fromMock.mockImplementation(() => {
    let filters: Array<[string, unknown]> = [];
    let updatePayload: Record<string, unknown> | null = null;
    const api: Record<string, unknown> = {
      select: () => api,
      update: (payload: Record<string, unknown>) => {
        updatePayload = payload;
        return api;
      },
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return api;
      },
      gte: () => api,
      maybeSingle: () => {
        const matched = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
        if (updatePayload) {
          for (const row of matched) Object.assign(row, updatePayload);
          return Promise.resolve({ data: matched[0] ?? null, error: null });
        }
        return Promise.resolve({ data: matched[0] ?? null, error: null });
      },
      single: () => Promise.resolve({ data: rows.filter((r) => filters.every(([c, v]) => r[c] === v))[0] ?? null, error: null }),
    };
    selectChain = api;
    return api;
  });
}

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

describe("qr-asset-service · P5 security filtering", () => {
  beforeEach(() => resetDb());
  afterEach(() => vi.resetModules());

  it("getActiveQrAsset returns row when status='active'", async () => {
    rows = [{
      id: "a1", business_id: "biz-1", status: "active",
      storage_path: "qr/biz-1/hash1.png",
    }];
    const { getActiveQrAsset } = await import("../qr-asset-service");
    const found = await getActiveQrAsset("biz-1" as never);
    expect(found).not.toBeNull();
    expect(found?.status).toBe("active");
  });

  it("getActiveQrAsset returns null when only pending_preview exists · prevents preview leak to buyer", async () => {
    rows = [{
      id: "a1", business_id: "biz-1", status: "pending_preview",
      storage_path: "qr/biz-1/hash1.png",
    }];
    const { getActiveQrAsset } = await import("../qr-asset-service");
    const found = await getActiveQrAsset("biz-1" as never);
    expect(found).toBeNull();
  });

  it("getActiveQrAsset returns null when only retired exists · prevents retired-QR leak", async () => {
    rows = [{
      id: "a1", business_id: "biz-1", status: "retired",
      storage_path: "qr/biz-1/hash1.png",
    }];
    const { getActiveQrAsset } = await import("../qr-asset-service");
    const found = await getActiveQrAsset("biz-1" as never);
    expect(found).toBeNull();
  });

  it("getActiveQrAsset returns null when only rejected exists", async () => {
    rows = [{
      id: "a1", business_id: "biz-1", status: "rejected",
      storage_path: "qr/biz-1/hash1.png",
    }];
    const { getActiveQrAsset } = await import("../qr-asset-service");
    const found = await getActiveQrAsset("biz-1" as never);
    expect(found).toBeNull();
  });

  it("getActiveQrAsset of business A cannot see business B's active QR", async () => {
    rows = [
      { id: "a1", business_id: "biz-A", status: "active", storage_path: "p1" },
      { id: "a2", business_id: "biz-B", status: "active", storage_path: "p2" },
    ];
    const { getActiveQrAsset } = await import("../qr-asset-service");
    const foundA = await getActiveQrAsset("biz-A" as never);
    const foundB = await getActiveQrAsset("biz-B" as never);
    expect(foundA?.id).toBe("a1");
    expect(foundB?.id).toBe("a2");
    expect(foundA?.storage_path).not.toBe(foundB?.storage_path);
  });

  it("pathForAsset is deterministic and scoped by business_id", async () => {
    const { pathForAsset } = await import("../qr-asset-service");
    expect(pathForAsset("biz-1" as never, "abc", "image/png")).toBe("qr/biz-1/abc.png");
    expect(pathForAsset("biz-2" as never, "abc", "image/png")).toBe("qr/biz-2/abc.png");
    expect(pathForAsset("biz-1" as never, "abc", "image/jpeg")).toBe("qr/biz-1/abc.jpg");
    expect(pathForAsset("biz-1" as never, "abc", "image/webp")).toBe("qr/biz-1/abc.webp");
  });
});
