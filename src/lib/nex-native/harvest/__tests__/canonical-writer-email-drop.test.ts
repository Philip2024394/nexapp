// src/lib/nex-native/harvest/__tests__/canonical-writer-email-drop.test.ts
//
// Owner directive 2026-10-27 · "A failed contact-data write must be
// counted and surfaced; it must not be reported as a successful
// enrichment." Pre-migration-202 the extended INSERT with the four
// email columns fails with PG 42703 ("column does not exist") and
// the writer silently fell back to the identity-only INSERT · the
// discarded OSM email was invisible per-tick. This test locks the
// new auditable behaviour:
//
//   1. Column missing + OSM email present
//        · extended INSERT throws 42703
//        · fallback identity INSERT runs
//        · `emails_dropped_schema_missing` counter == 1
//        · one `email_dropped_schema_missing_migration_202` warn emitted
//        · the identity row IS still inserted (discovery not stalled)
//
//   2. Non-schema error + OSM email present
//        · extended INSERT throws a non-42703 error
//        · counter stays 0 · errors counter advances
//
//   3. Column missing + NO OSM email
//        · never attempts the extended INSERT path
//        · counter stays 0 · identity row inserted via the else-branch
//
// The test uses a hand-rolled pg-client fake · we never touch a real
// Postgres · we never apply migration 202.

import "server-only";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

type Query = {
  text: string;
  params: unknown[];
};

type FakeClient = {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
};

type WithClientFn = <T>(fn: (c: FakeClient) => Promise<T>) => Promise<T | null>;

let fakeClient: FakeClient;
let capturedQueries: Query[];

function makeFakeClient(
  responder: (q: Query) => { rowCount: number } | Error,
): FakeClient {
  const query = vi.fn(async (text: string, params?: unknown[]) => {
    const q: Query = { text, params: params ?? [] };
    capturedQueries.push(q);
    const r = responder(q);
    if (r instanceof Error) throw r;
    return { rows: [], rowCount: r.rowCount };
  });
  return { query, release: vi.fn() };
}

vi.mock("@/lib/nex/db", () => ({
  withClient: ((fn) => fn(fakeClient)) as WithClientFn,
}));

import { writeCanonicalRowsFromOverpass } from "../canonical-writer";
import type { CityBbox } from "../city-rotation";
import type { OverpassElement } from "../overpass-fetcher";

const bbox: CityBbox = {
  id: "test-city",
  isoAlpha2: "ID",
  cityName: "Yogyakarta",
  bbox: { south: -8.0, west: 110.0, north: -7.5, east: 110.5 },
} as unknown as CityBbox;

function elementWithEmail(): OverpassElement {
  return {
    type: "node",
    id: 101,
    lat: -7.8,
    lon: 110.3,
    tags: {
      name: "Warung Pak Budi",
      amenity: "restaurant",
      email: "pakbudi@example.com",
    },
  } as unknown as OverpassElement;
}

function elementWithoutEmail(): OverpassElement {
  return {
    type: "node",
    id: 202,
    lat: -7.81,
    lon: 110.31,
    tags: { name: "Warung Bu Siti", amenity: "cafe" },
  } as unknown as OverpassElement;
}

let warnSpy: ReturnType<typeof vi.spyOn>;

function isExtendedInsert(q: Query): boolean {
  // The extended INSERT carries the 4 email-era column names in its
  // SQL text · the identity-only INSERT does not.
  return q.text.includes("email_status");
}

beforeEach(() => {
  capturedQueries = [];
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("canonical-writer · schema-missing email drop · owner directive 2026-10-27", () => {
  it("counts + warns + still inserts the identity row when 42703 fires on the extended path", async () => {
    fakeClient = makeFakeClient((q) => {
      if (isExtendedInsert(q)) {
        const e = new Error(
          'column "email_status" of relation "business_canonical" does not exist',
        );
        return e;
      }
      return { rowCount: 1 };
    });

    const summary = await writeCanonicalRowsFromOverpass(
      bbox,
      [elementWithEmail()],
      "cycle-1",
    );

    expect(summary.emails_dropped_schema_missing).toBe(1);
    expect(summary.inserted).toBe(1);
    expect(summary.errors).toBe(0);

    // Two queries: the extended attempt (threw) + the identity
    // fallback (succeeded).
    expect(capturedQueries).toHaveLength(2);
    expect(isExtendedInsert(capturedQueries[0]!)).toBe(true);
    expect(isExtendedInsert(capturedQueries[1]!)).toBe(false);

    // Exactly one structured warn · carries the sentinel reason + the
    // identifying context an auditor needs · NO email VALUE in the
    // warn payload (PII legal basis is not yet settled).
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const raw = warnSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.event).toBe("email_dropped_schema_missing_migration_202");
    expect(parsed.cycle_id).toBe("cycle-1");
    expect(parsed.osm_ref).toBe("osm_node_101");
    expect(parsed.country).toBe("ID");
    expect(parsed.city).toBe("Yogyakarta");
    expect(parsed.email_source_url).toBeDefined();
    expect(JSON.stringify(parsed)).not.toContain("pakbudi@example.com");
  });

  it("does NOT count a non-schema error as a schema-missing drop", async () => {
    fakeClient = makeFakeClient((q) => {
      if (isExtendedInsert(q)) {
        return new Error("deadlock detected");
      }
      return { rowCount: 1 };
    });

    const summary = await writeCanonicalRowsFromOverpass(
      bbox,
      [elementWithEmail()],
      "cycle-2",
    );

    expect(summary.emails_dropped_schema_missing).toBe(0);
    expect(summary.errors).toBe(1);
    expect(summary.inserted).toBe(0);

    // Only the one failed query was attempted · no fallback for
    // non-schema errors (identity row NOT silently written).
    expect(capturedQueries).toHaveLength(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does NOT count a drop when the element never carried an OSM email", async () => {
    fakeClient = makeFakeClient((q) => {
      // The non-email path takes the identity-only INSERT directly ·
      // no 42703 is possible on this shape. Simulate a successful
      // insert.
      expect(isExtendedInsert(q)).toBe(false);
      return { rowCount: 1 };
    });

    const summary = await writeCanonicalRowsFromOverpass(
      bbox,
      [elementWithoutEmail()],
      "cycle-3",
    );

    expect(summary.emails_dropped_schema_missing).toBe(0);
    expect(summary.inserted).toBe(1);
    expect(summary.errors).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
