// src/lib/nex-native/enrichment/__tests__/enrichment-queue.test.ts

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  drainQueue,
  iterateEnrichmentQueue,
  normaliseQueueOptions,
  type CanonicalRowRef,
  type RowProvider,
} from "../enrichment-queue";

function row(id: string): CanonicalRowRef {
  return {
    canonical_business_id: id,
    created_at: "2026-10-27T00:00:00.000Z",
  };
}

/** Deterministic provider over a sorted fixture. Honours `after > `
 *  semantics and the `limit`. */
function makeProvider(all: readonly CanonicalRowRef[]): RowProvider {
  const sorted = [...all].sort((a, b) =>
    a.canonical_business_id.localeCompare(b.canonical_business_id),
  );
  return async ({ afterCanonicalBusinessId, limit }) => {
    const filtered = afterCanonicalBusinessId
      ? sorted.filter(
          (r) => r.canonical_business_id > afterCanonicalBusinessId,
        )
      : sorted;
    return filtered.slice(0, limit);
  };
}

describe("normaliseQueueOptions", () => {
  it("throws on batchSize < 1", () => {
    expect(() =>
      normaliseQueueOptions({
        resumeAfter: null,
        batchSize: 0,
        maxRecords: 0,
      }),
    ).toThrow();
  });

  it("throws on fractional batchSize", () => {
    expect(() =>
      normaliseQueueOptions({
        resumeAfter: null,
        batchSize: 1.5,
        maxRecords: 0,
      }),
    ).toThrow();
  });

  it("throws on negative maxRecords", () => {
    expect(() =>
      normaliseQueueOptions({
        resumeAfter: null,
        batchSize: 10,
        maxRecords: -1,
      }),
    ).toThrow();
  });
});

describe("iterateEnrichmentQueue", () => {
  it("drains in strict ascending order with no duplicates", async () => {
    const fixture = ["a", "b", "c", "d", "e"].map(row);
    const result = await drainQueue(makeProvider(fixture), {
      resumeAfter: null,
      batchSize: 2,
      maxRecords: 0,
    });
    expect(result.rows.map((r) => r.canonical_business_id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
    expect(result.finalCheckpoint).toBe("e");
  });

  it("resumes correctly from a mid-stream checkpoint · no re-processing", async () => {
    const fixture = ["a", "b", "c", "d", "e"].map(row);
    const result = await drainQueue(makeProvider(fixture), {
      resumeAfter: "b",
      batchSize: 2,
      maxRecords: 0,
    });
    expect(result.rows.map((r) => r.canonical_business_id)).toEqual([
      "c",
      "d",
      "e",
    ]);
    expect(result.finalCheckpoint).toBe("e");
  });

  it("honours maxRecords · stops at the cap even with more rows available", async () => {
    const fixture = ["a", "b", "c", "d", "e"].map(row);
    const result = await drainQueue(makeProvider(fixture), {
      resumeAfter: null,
      batchSize: 2,
      maxRecords: 3,
    });
    expect(result.rows.map((r) => r.canonical_business_id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(result.finalCheckpoint).toBe("c");
  });

  it("is idempotent · the same resumeAfter + fixture produces the same stream", async () => {
    const fixture = ["a", "b", "c", "d"].map(row);
    const run1 = await drainQueue(makeProvider(fixture), {
      resumeAfter: "a",
      batchSize: 10,
      maxRecords: 0,
    });
    const run2 = await drainQueue(makeProvider(fixture), {
      resumeAfter: "a",
      batchSize: 10,
      maxRecords: 0,
    });
    expect(run1).toEqual(run2);
  });

  it("returns exhausted batch when provider is empty", async () => {
    const batches = [];
    for await (const b of iterateEnrichmentQueue(makeProvider([]), {
      resumeAfter: null,
      batchSize: 10,
      maxRecords: 0,
    })) {
      batches.push(b);
    }
    expect(batches).toHaveLength(1);
    expect(batches[0]!.exhausted).toBe(true);
    expect(batches[0]!.rows).toHaveLength(0);
  });

  it("throws when provider breaks the > cursor contract · defence against silent re-processing", async () => {
    const badProvider: RowProvider = async () => [row("a"), row("c")];
    const gen = iterateEnrichmentQueue(badProvider, {
      resumeAfter: "b",
      batchSize: 10,
      maxRecords: 0,
    });
    await expect(gen.next()).rejects.toThrow(
      /provider must enforce strict > ordering/,
    );
  });

  it("throws when provider yields out-of-order rows · defence against stream corruption", async () => {
    const badProvider: RowProvider = async () => [row("b"), row("a")];
    const gen = iterateEnrichmentQueue(badProvider, {
      resumeAfter: null,
      batchSize: 10,
      maxRecords: 0,
    });
    await expect(gen.next()).rejects.toThrow(/unordered pair/);
  });
});
