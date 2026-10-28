// src/lib/nex-native/watches/__tests__/watch-retention-helpers.test.ts
//
// R3 · Retention · unit tests for pure helpers.
// Full end-to-end sweep correctness requires an isolated DB · tracked
// as a separate verification step.

import { describe, it, expect } from "vitest";
import { isStorageComplete, type StorageDeleteOutcome } from "../watch-storage-paths";

const url = "https://example.supabase.co/storage/v1/object/public/nex-watches/x.jpg";

const deleted = (): StorageDeleteOutcome => ({
  url,
  bucket: "nex-watches",
  path: "x.jpg",
  outcome: "deleted",
});
const missing = (): StorageDeleteOutcome => ({
  url,
  bucket: "nex-watches",
  path: "x.jpg",
  outcome: "missing",
});
const failed = (): StorageDeleteOutcome => ({
  url,
  bucket: "nex-watches",
  path: "x.jpg",
  outcome: "failed",
  error: "transient 500",
});
const skipped_foreign = (): StorageDeleteOutcome => ({
  url: "https://attacker.example/photo.jpg",
  bucket: null,
  path: null,
  outcome: "skipped_foreign_origin",
});
const unparseable = (): StorageDeleteOutcome => ({
  url: "garbage",
  bucket: null,
  path: null,
  outcome: "unparseable",
});

describe("isStorageComplete", () => {
  it("returns true for empty outcomes (no media to delete)", () => {
    expect(isStorageComplete([])).toBe(true);
  });

  it("returns true when every outcome is deleted or missing", () => {
    expect(isStorageComplete([deleted(), deleted()])).toBe(true);
    expect(isStorageComplete([deleted(), missing()])).toBe(true);
    expect(isStorageComplete([missing(), missing()])).toBe(true);
  });

  it("returns false if ANY outcome is failed · listing is kept for retry", () => {
    expect(isStorageComplete([deleted(), failed()])).toBe(false);
    expect(isStorageComplete([failed()])).toBe(false);
  });

  it("returns false if ANY outcome is skipped_foreign_origin · surfaced in retry index", () => {
    expect(isStorageComplete([deleted(), skipped_foreign()])).toBe(false);
  });

  it("returns false if ANY outcome is unparseable · surfaced for operator review", () => {
    expect(isStorageComplete([unparseable()])).toBe(false);
  });
});
