// src/lib/nex-native/status-storage/__tests__/store.test.ts
//
// NEX Status · unit tests for the device-local IndexedDB wrapper.
//
// Uses `fake-indexeddb` as a dev-only polyfill so the IndexedDB
// surface behaves exactly like a browser in a Node vitest process.
// The polyfill is installed per-test (fresh factory each time) so
// one test's rows never leak into the next.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

// fake-indexeddb's `auto` entry installs the globals when imported ·
// we do it manually below so each test starts with a clean factory.
// IDBKeyRange + related constructors are needed as globals because
// store.ts references them without importing (same as a browser).
import {
  IDBCursor,
  IDBCursorWithValue,
  IDBDatabase,
  IDBFactory,
  IDBIndex,
  IDBKeyRange,
  IDBObjectStore,
  IDBOpenDBRequest,
  IDBRequest,
  IDBTransaction,
  IDBVersionChangeEvent,
} from "fake-indexeddb";

import type { StoredStatus } from "../types";
import {
  deleteStatus,
  getStatus,
  getTotalStorageUsedBytes,
  listMyStatuses,
  openStatusStore,
  saveStatus,
  StatusStorageError,
  sweepExpired,
} from "../store";

// Keep a reference to anything the environment already defined so the
// SSR-style test can restore cleanly.
const originalIndexedDB = (globalThis as { indexedDB?: unknown }).indexedDB;

function installFreshIndexedDB(): void {
  const g = globalThis as Record<string, unknown>;
  g.indexedDB = new IDBFactory();
  // Install the companion constructors that store.ts expects as
  // ambient browser globals (IDBKeyRange, cursor / transaction
  // classes used by instanceof-style checks, etc.).
  g.IDBKeyRange = IDBKeyRange;
  g.IDBCursor = IDBCursor;
  g.IDBCursorWithValue = IDBCursorWithValue;
  g.IDBDatabase = IDBDatabase;
  g.IDBIndex = IDBIndex;
  g.IDBObjectStore = IDBObjectStore;
  g.IDBOpenDBRequest = IDBOpenDBRequest;
  g.IDBRequest = IDBRequest;
  g.IDBTransaction = IDBTransaction;
  g.IDBVersionChangeEvent = IDBVersionChangeEvent;
}

function uninstallIndexedDB(): void {
  // Deleting the property matches browser-less SSR semantics so our
  // guard inside store.ts has the chance to throw STORAGE_UNAVAILABLE.
  delete (globalThis as { indexedDB?: unknown }).indexedDB;
}

function makeStatus(overrides: Partial<StoredStatus> = {}): StoredStatus {
  const postedAtMs = overrides.postedAtMs ?? Date.now();
  const expiresAtMs = overrides.expiresAtMs ?? postedAtMs + 24 * 60 * 60 * 1000;
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const blob = overrides.mediaBlob ?? new Blob([bytes], { type: "image/jpeg" });
  return {
    id: overrides.id ?? `status-${Math.random().toString(36).slice(2)}`,
    ownerAccountId: overrides.ownerAccountId ?? "owner-a",
    kind: overrides.kind ?? "image",
    mediaBlob: blob,
    mediaMimeType: overrides.mediaMimeType ?? "image/jpeg",
    mediaSizeBytes: overrides.mediaSizeBytes ?? bytes.byteLength,
    mediaDurationMs: overrides.mediaDurationMs ?? null,
    mediaWidth: overrides.mediaWidth ?? 1080,
    mediaHeight: overrides.mediaHeight ?? 1920,
    overlays: overrides.overlays ?? [],
    postedAtMs,
    expiresAtMs,
  };
}

beforeEach(() => {
  installFreshIndexedDB();
});

afterEach(() => {
  // Restore whatever the environment started with so other test files
  // in the suite are not perturbed.
  if (originalIndexedDB === undefined) {
    uninstallIndexedDB();
  } else {
    (globalThis as { indexedDB?: unknown }).indexedDB = originalIndexedDB;
  }
  vi.restoreAllMocks();
});

describe("status-storage/store", () => {
  test("saveStatus + getStatus round-trip preserves fields and Blob bytes", async () => {
    const posted = Date.now();
    const bytes = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const status = makeStatus({
      id: "s-1",
      ownerAccountId: "owner-roundtrip",
      kind: "video",
      mediaBlob: new Blob([bytes], { type: "video/webm" }),
      mediaMimeType: "video/webm",
      mediaSizeBytes: bytes.byteLength,
      mediaDurationMs: 7500,
      mediaWidth: 720,
      mediaHeight: 1280,
      postedAtMs: posted,
      expiresAtMs: posted + 1_000_000,
      overlays: [
        {
          layerIndex: 0,
          text: "Hello",
          fontId: "sans",
          colorHex: "#FFFFFF",
          weight: "bold",
          sizeId: "m",
          position: "middle",
          align: "center",
          backgroundTreatment: "scrim",
          shadow: true,
        },
      ],
    });

    await saveStatus(status);

    const got = await getStatus("s-1");
    expect(got).not.toBeNull();
    if (!got) throw new Error("unreachable");

    expect(got.id).toBe("s-1");
    expect(got.ownerAccountId).toBe("owner-roundtrip");
    expect(got.kind).toBe("video");
    expect(got.mediaMimeType).toBe("video/webm");
    expect(got.mediaSizeBytes).toBe(bytes.byteLength);
    expect(got.mediaDurationMs).toBe(7500);
    expect(got.mediaWidth).toBe(720);
    expect(got.mediaHeight).toBe(1280);
    expect(got.postedAtMs).toBe(posted);
    expect(got.expiresAtMs).toBe(posted + 1_000_000);
    expect(got.overlays).toHaveLength(1);
    expect(got.overlays[0]?.text).toBe("Hello");

    expect(got.mediaBlob).toBeInstanceOf(Blob);
    const arr = new Uint8Array(await got.mediaBlob.arrayBuffer());
    expect(arr.byteLength).toBe(bytes.byteLength);
    expect(Array.from(arr)).toEqual(Array.from(bytes));
  });

  test("getStatus returns null when id is missing", async () => {
    const result = await getStatus("nonexistent-id");
    expect(result).toBeNull();
  });

  test("listMyStatuses filters by ownerAccountId and excludes expired", async () => {
    const now = Date.now();
    const fresh1 = makeStatus({
      id: "a-fresh-1",
      ownerAccountId: "owner-a",
      postedAtMs: now - 1000,
      expiresAtMs: now + 60_000,
    });
    const fresh2 = makeStatus({
      id: "a-fresh-2",
      ownerAccountId: "owner-a",
      postedAtMs: now - 5000,
      expiresAtMs: now + 60_000,
    });
    const expiredSameOwner = makeStatus({
      id: "a-expired",
      ownerAccountId: "owner-a",
      postedAtMs: now - 100_000,
      expiresAtMs: now - 1_000,
    });
    const otherOwner = makeStatus({
      id: "b-fresh",
      ownerAccountId: "owner-b",
      postedAtMs: now - 500,
      expiresAtMs: now + 60_000,
    });

    await saveStatus(fresh1);
    await saveStatus(fresh2);
    await saveStatus(expiredSameOwner);
    await saveStatus(otherOwner);

    const results = await listMyStatuses("owner-a");

    expect(results.map((r) => r.id)).toEqual(["a-fresh-1", "a-fresh-2"]);
    expect(results.every((r) => r.ownerAccountId === "owner-a")).toBe(true);
    // Newest first.
    expect(results[0]!.postedAtMs).toBeGreaterThan(results[1]!.postedAtMs);
  });

  test("listMyStatuses returns empty for empty / unknown owner", async () => {
    const empty = await listMyStatuses("");
    expect(empty).toEqual([]);

    const unknown = await listMyStatuses("nobody");
    expect(unknown).toEqual([]);
  });

  test("sweepExpired removes exactly the expired rows and returns count", async () => {
    const now = Date.now();
    const rows = [
      makeStatus({
        id: "keep-1",
        ownerAccountId: "owner-x",
        postedAtMs: now,
        expiresAtMs: now + 60_000,
      }),
      makeStatus({
        id: "keep-2",
        ownerAccountId: "owner-y",
        postedAtMs: now,
        expiresAtMs: now + 60_000,
      }),
      makeStatus({
        id: "gone-1",
        ownerAccountId: "owner-x",
        postedAtMs: now - 10_000,
        expiresAtMs: now - 5_000,
      }),
      makeStatus({
        id: "gone-2",
        ownerAccountId: "owner-y",
        postedAtMs: now - 20_000,
        expiresAtMs: now - 15_000,
      }),
      makeStatus({
        id: "gone-3",
        ownerAccountId: "owner-z",
        postedAtMs: now - 50_000,
        expiresAtMs: now - 25_000,
      }),
    ];
    for (const r of rows) await saveStatus(r);

    const deleted = await sweepExpired();
    expect(deleted).toBe(3);

    expect(await getStatus("keep-1")).not.toBeNull();
    expect(await getStatus("keep-2")).not.toBeNull();
    expect(await getStatus("gone-1")).toBeNull();
    expect(await getStatus("gone-2")).toBeNull();
    expect(await getStatus("gone-3")).toBeNull();

    // Idempotent · subsequent sweep removes nothing.
    const secondSweep = await sweepExpired();
    expect(secondSweep).toBe(0);
  });

  test("getTotalStorageUsedBytes sums mediaSizeBytes across active rows", async () => {
    const now = Date.now();
    await saveStatus(
      makeStatus({
        id: "big",
        ownerAccountId: "owner-a",
        mediaSizeBytes: 1_000_000,
        postedAtMs: now,
        expiresAtMs: now + 60_000,
      }),
    );
    await saveStatus(
      makeStatus({
        id: "small",
        ownerAccountId: "owner-b",
        mediaSizeBytes: 250_000,
        postedAtMs: now,
        expiresAtMs: now + 60_000,
      }),
    );
    await saveStatus(
      // Expired row · must NOT contribute to the total.
      makeStatus({
        id: "stale",
        ownerAccountId: "owner-c",
        mediaSizeBytes: 999_999_999,
        postedAtMs: now - 100_000,
        expiresAtMs: now - 5_000,
      }),
    );

    const total = await getTotalStorageUsedBytes();
    expect(total).toBe(1_000_000 + 250_000);
  });

  test("deleteStatus removes the row", async () => {
    const status = makeStatus({ id: "to-delete", ownerAccountId: "owner-del" });
    await saveStatus(status);
    expect(await getStatus("to-delete")).not.toBeNull();

    await deleteStatus("to-delete");
    expect(await getStatus("to-delete")).toBeNull();

    // Idempotent · deleting a missing id is a no-op.
    await expect(deleteStatus("to-delete")).resolves.toBeUndefined();
    await expect(deleteStatus("")).resolves.toBeUndefined();
  });

  test("STORAGE_UNAVAILABLE is thrown when indexedDB is undefined (SSR)", async () => {
    uninstallIndexedDB();

    await expect(openStatusStore()).rejects.toBeInstanceOf(StatusStorageError);
    await expect(openStatusStore()).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });

    await expect(
      saveStatus(makeStatus({ id: "doesnt-matter" })),
    ).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });

    await expect(getStatus("x")).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });

    await expect(sweepExpired()).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });

    await expect(getTotalStorageUsedBytes()).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });

    await expect(deleteStatus("x")).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });
  });

  test("saveStatus validates record shape", async () => {
    await expect(
      saveStatus({
        // Missing id · validator should throw RECORD_INVALID.
        ...makeStatus(),
        id: "",
      }),
    ).rejects.toMatchObject({ code: "RECORD_INVALID" });

    await expect(
      saveStatus({
        ...makeStatus(),
        // @ts-expect-error · intentionally bad shape for validation test.
        mediaBlob: "not-a-blob",
      }),
    ).rejects.toMatchObject({ code: "RECORD_INVALID" });
  });

  test("openStatusStore is idempotent (safe to call repeatedly)", async () => {
    const db1 = await openStatusStore();
    db1.close();
    const db2 = await openStatusStore();
    db2.close();
    expect(db1).not.toBe(db2);
  });
});
