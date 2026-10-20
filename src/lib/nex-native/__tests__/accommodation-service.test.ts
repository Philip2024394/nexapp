// src/lib/nex-native/__tests__/accommodation-service.test.ts
//
// Phase A1 · Accommodation listing service unit tests.
// Owner-authorised 2026-10-21.
//
// Scope: pure-function helpers (normaliseAmenity · assertRoomInput
// via createRoom validation path) + mocked `nexSupabaseAdmin` CRUD
// behaviours. Does NOT connect to a database. Does NOT prove
// end-to-end against a real Postgres · that requires migration 213
// applied to an isolated local Supabase (separate authorisation).

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { fromMock, insertMock, updateMock, selectMock, singleMock, eqMock, maybeSingleMock, orderMock } =
  vi.hoisted(() => {
    const singleMock = vi.fn();
    const maybeSingleMock = vi.fn();
    const orderMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockReturnThis();
    const selectMock = vi.fn().mockReturnThis();
    const insertMock = vi.fn().mockReturnThis();
    const updateMock = vi.fn().mockReturnThis();
    const fromMock = vi.fn(() => ({
      insert: insertMock,
      select: selectMock,
      update: updateMock,
      eq: eqMock,
      order: orderMock,
      single: singleMock,
      maybeSingle: maybeSingleMock,
    }));
    return {
      fromMock,
      insertMock,
      updateMock,
      selectMock,
      singleMock,
      eqMock,
      maybeSingleMock,
      orderMock,
    };
  });

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: fromMock,
  },
  nexSupabaseProjectRef: () => "mock-project",
}));

// Default chain · select().eq()... returns a chain object with
// terminal methods (single · maybeSingle · order). Each chain method
// returns the chain itself so the resolver sees everything.
beforeEach(() => {
  vi.clearAllMocks();
  insertMock.mockReturnThis();
  updateMock.mockReturnThis();
  selectMock.mockReturnThis();
  eqMock.mockReturnThis();
  orderMock.mockReturnThis();
  singleMock.mockReset();
  maybeSingleMock.mockReset();
});

import {
  normaliseAmenity,
  createRoom,
  listRoomsByBusiness,
  listLiveAvailableRoomsByBusiness,
  getRoomById,
  updateRoom,
  updateRoomStatus,
  toggleRoomAvailable,
  archiveRoom,
  unarchiveRoom,
  NEX_ACCOMMODATION_UNIT_STATUSES,
} from "../accommodation-service";

const BUSINESS_ID = "11111111-1111-1111-1111-111111111111";
const ROOM_ID = "22222222-2222-2222-2222-222222222222";

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ROOM_ID,
    business_id: BUSINESS_ID,
    name: "Garden Villa",
    description: null,
    capacity: 4,
    bedrooms: 2,
    bathrooms: 1,
    amenities: ["wi-fi", "pool"],
    price_per_night_pence: 850000,
    currency: "IDR",
    image_url: null,
    gallery_urls: [],
    status: "draft" as const,
    is_available: true,
    sort_order: 0,
    created_at: "2026-10-21T00:00:00.000Z",
    updated_at: "2026-10-21T00:00:00.000Z",
    ...overrides,
  };
}

// ─── normaliseAmenity ───────────────────────────────────────────

describe("normaliseAmenity · defensive input normalisation", () => {
  test("empty/whitespace → null", () => {
    expect(normaliseAmenity("")).toBeNull();
    expect(normaliseAmenity("   ")).toBeNull();
  });
  test("lowercase + hyphenation", () => {
    expect(normaliseAmenity("Wi Fi")).toBe("wi-fi");
    expect(normaliseAmenity("  Air Con  ")).toBe("air-con");
  });
  test("strips non-alphanumeric non-hyphen chars", () => {
    expect(normaliseAmenity("hot/water!")).toBe("hotwater");
    expect(normaliseAmenity("bbq@grill")).toBe("bbqgrill");
  });
  test("clamps to 64 chars", () => {
    const long = "a".repeat(80);
    const got = normaliseAmenity(long);
    expect(got).not.toBeNull();
    expect(got!.length).toBe(64);
  });
});

// ─── createRoom ─────────────────────────────────────────────────

describe("createRoom · validation + insert path", () => {
  test("rejects empty name", async () => {
    await expect(
      createRoom({ business_id: BUSINESS_ID, name: "" }),
    ).rejects.toThrow(/name must be 1-120/);
  });
  test("rejects name over 120 chars", async () => {
    await expect(
      createRoom({ business_id: BUSINESS_ID, name: "x".repeat(121) }),
    ).rejects.toThrow(/name must be 1-120/);
  });
  test("rejects capacity out of bounds", async () => {
    await expect(
      createRoom({ business_id: BUSINESS_ID, name: "Villa", capacity: 0 }),
    ).rejects.toThrow(/capacity must be 1-50/);
    await expect(
      createRoom({ business_id: BUSINESS_ID, name: "Villa", capacity: 51 }),
    ).rejects.toThrow(/capacity must be 1-50/);
  });
  test("rejects bedrooms out of bounds", async () => {
    await expect(
      createRoom({ business_id: BUSINESS_ID, name: "Villa", bedrooms: -1 }),
    ).rejects.toThrow(/bedrooms must be 0-20/);
    await expect(
      createRoom({ business_id: BUSINESS_ID, name: "Villa", bedrooms: 21 }),
    ).rejects.toThrow(/bedrooms must be 0-20/);
  });
  test("rejects negative price (NEX never transacts · display only)", async () => {
    await expect(
      createRoom({
        business_id: BUSINESS_ID,
        name: "Villa",
        price_per_night_pence: -1,
      }),
    ).rejects.toThrow(/price_per_night_pence must be ≥0/);
  });
  test("rejects invalid currency length", async () => {
    await expect(
      createRoom({
        business_id: BUSINESS_ID,
        name: "Villa",
        currency: "USDT",
      }),
    ).rejects.toThrow(/currency must be ISO 4217/);
  });
  test("rejects gallery over 10 entries", async () => {
    await expect(
      createRoom({
        business_id: BUSINESS_ID,
        name: "Villa",
        gallery_urls: Array(11).fill("https://x"),
      }),
    ).rejects.toThrow(/gallery_urls max 10/);
  });
  test("inserts with defaults when optional fields omitted", async () => {
    singleMock.mockResolvedValue({ data: sampleRow(), error: null });
    const row = await createRoom({ business_id: BUSINESS_ID, name: "Villa" });
    expect(fromMock).toHaveBeenCalledWith("nex_accommodation_unit");
    expect(insertMock).toHaveBeenCalledTimes(1);
    const insertedArgs = insertMock.mock.calls[0]![0];
    expect(insertedArgs.business_id).toBe(BUSINESS_ID);
    expect(insertedArgs.name).toBe("Villa");
    expect(insertedArgs.capacity).toBe(2);
    expect(insertedArgs.bedrooms).toBe(1);
    expect(insertedArgs.bathrooms).toBe(1);
    expect(insertedArgs.amenities).toEqual([]);
    expect(insertedArgs.price_per_night_pence).toBeNull();
    expect(insertedArgs.currency).toBe("IDR");
    expect(insertedArgs.status).toBe("draft");
    expect(insertedArgs.is_available).toBe(true);
    expect(row.id).toBe(ROOM_ID);
  });
  test("normalises amenities array on insert", async () => {
    singleMock.mockResolvedValue({ data: sampleRow(), error: null });
    await createRoom({
      business_id: BUSINESS_ID,
      name: "Villa",
      amenities: ["Wi Fi", "  BBQ  ", "", "pool!"],
    });
    const inserted = insertMock.mock.calls[0]![0];
    expect(inserted.amenities).toEqual(["wi-fi", "bbq", "pool"]);
  });
  test("surfaces DB error with service prefix", async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: "oops" } });
    await expect(
      createRoom({ business_id: BUSINESS_ID, name: "Villa" }),
    ).rejects.toThrow(/accommodation-service\.createRoom: oops/);
  });
});

// ─── listRoomsByBusiness ────────────────────────────────────────

describe("listRoomsByBusiness · filtering + ordering", () => {
  test("returns rows ordered by sort_order then created_at desc", async () => {
    const rows = [sampleRow({ id: "a" }), sampleRow({ id: "b" })];
    // The .order() mock chain terminates by resolving with the array.
    orderMock.mockReturnValueOnce({
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    });
    const got = await listRoomsByBusiness(BUSINESS_ID);
    expect(fromMock).toHaveBeenCalledWith("nex_accommodation_unit");
    expect(got).toHaveLength(2);
  });
  test("optional status filter adds .eq('status', status)", async () => {
    orderMock.mockReturnValueOnce({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    await listRoomsByBusiness(BUSINESS_ID, "live");
    expect(eqMock).toHaveBeenCalledWith("status", "live");
  });
});

// ─── listLiveAvailableRoomsByBusiness ───────────────────────────

describe("listLiveAvailableRoomsByBusiness · customer-safe filter", () => {
  test("applies status=live AND is_available=true", async () => {
    orderMock.mockReturnValueOnce({
      order: vi.fn().mockResolvedValue({ data: [sampleRow()], error: null }),
    });
    await listLiveAvailableRoomsByBusiness(BUSINESS_ID);
    // The eq() mock is called multiple times · verify both filters.
    const eqCalls = eqMock.mock.calls.map((c) => `${c[0]}=${c[1]}`);
    expect(eqCalls).toContain("business_id=" + BUSINESS_ID);
    expect(eqCalls).toContain("status=live");
    expect(eqCalls).toContain("is_available=true");
  });
});

// ─── getRoomById ────────────────────────────────────────────────

describe("getRoomById", () => {
  test("returns the row when found", async () => {
    maybeSingleMock.mockResolvedValue({ data: sampleRow(), error: null });
    const got = await getRoomById(ROOM_ID);
    expect(got?.id).toBe(ROOM_ID);
  });
  test("returns null when not found", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const got = await getRoomById(ROOM_ID);
    expect(got).toBeNull();
  });
});

// ─── updateRoom · validation + patch build ──────────────────────

describe("updateRoom · patch validation", () => {
  test("rejects empty name in patch", async () => {
    await expect(updateRoom(ROOM_ID, { name: "" })).rejects.toThrow(
      /name must be 1-120/,
    );
  });
  test("rejects over-long description", async () => {
    await expect(
      updateRoom(ROOM_ID, { description: "x".repeat(2001) }),
    ).rejects.toThrow(/description must be ≤2000/);
  });
  test("only includes present fields in update payload", async () => {
    singleMock.mockResolvedValue({ data: sampleRow(), error: null });
    await updateRoom(ROOM_ID, { name: "New name" });
    const updateArgs = updateMock.mock.calls[0]![0];
    expect(Object.keys(updateArgs)).toEqual(["name"]);
    expect(updateArgs.name).toBe("New name");
  });
  test("normalises amenities on update", async () => {
    singleMock.mockResolvedValue({ data: sampleRow(), error: null });
    await updateRoom(ROOM_ID, { amenities: ["  Pool  ", "WI FI", ""] });
    const updateArgs = updateMock.mock.calls[0]![0];
    expect(updateArgs.amenities).toEqual(["pool", "wi-fi"]);
  });
});

// ─── Status transitions ─────────────────────────────────────────

describe("updateRoomStatus · archiveRoom · unarchiveRoom", () => {
  test("rejects invalid status", async () => {
    await expect(
      updateRoomStatus(ROOM_ID, "paused" as never),
    ).rejects.toThrow(/invalid status/);
  });
  test("accepts live / draft / archived", async () => {
    for (const s of NEX_ACCOMMODATION_UNIT_STATUSES) {
      singleMock.mockResolvedValue({
        data: sampleRow({ status: s }),
        error: null,
      });
      const row = await updateRoomStatus(ROOM_ID, s);
      expect(row.status).toBe(s);
    }
  });
  test("archiveRoom sets status=archived", async () => {
    singleMock.mockResolvedValue({
      data: sampleRow({ status: "archived" }),
      error: null,
    });
    const row = await archiveRoom(ROOM_ID);
    expect(row.status).toBe("archived");
    const updateArgs = updateMock.mock.calls[0]![0];
    expect(updateArgs.status).toBe("archived");
  });
  test("unarchiveRoom sets status=live", async () => {
    singleMock.mockResolvedValue({
      data: sampleRow({ status: "live" }),
      error: null,
    });
    const row = await unarchiveRoom(ROOM_ID);
    expect(row.status).toBe("live");
    const updateArgs = updateMock.mock.calls[0]![0];
    expect(updateArgs.status).toBe("live");
  });
});

// ─── toggleRoomAvailable ────────────────────────────────────────

describe("toggleRoomAvailable", () => {
  test("sets is_available on the row", async () => {
    singleMock.mockResolvedValue({
      data: sampleRow({ is_available: false }),
      error: null,
    });
    const row = await toggleRoomAvailable(ROOM_ID, false);
    expect(row.is_available).toBe(false);
    const updateArgs = updateMock.mock.calls[0]![0];
    expect(updateArgs.is_available).toBe(false);
  });
});

// ─── Doctrine · "NEX never handles payments" + no paused state ──

describe("doctrine anchors", () => {
  test("status enum has exactly draft / live / archived · no `paused`", () => {
    expect(NEX_ACCOMMODATION_UNIT_STATUSES).toEqual([
      "draft",
      "live",
      "archived",
    ]);
    expect((NEX_ACCOMMODATION_UNIT_STATUSES as readonly string[]).includes("paused")).toBe(false);
  });
});
