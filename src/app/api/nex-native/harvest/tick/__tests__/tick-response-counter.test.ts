// src/app/api/nex-native/harvest/tick/__tests__/tick-response-counter.test.ts
//
// D · End-to-end verification harness for the owner directive 2026-10-27:
// prove that the emails_dropped_schema_missing counter emitted by the
// canonical writer reaches the TickResponse body returned by the
// harvest-tick route handler. Does NOT trigger a live tick · never
// touches a real Supabase pooler or Overpass endpoint. Fully in-memory.
//
// What this test exercises end-to-end:
//
//   POST(request) → isAuthorised() → resolveOptedInIsos() →
//   readRotationCursor() → pickNextCity() → fetchOsmBusinessesInBbox() →
//   writeCanonicalRowsFromOverpass() → recordCycle() → NextResponse JSON.
//
// The ONLY mocked seams are the two outbound I/O boundaries:
//   · "@/lib/nex/db"                 — pg pool stand-in
//   · ".../overpass-fetcher"         — HTTP stand-in
//
// The real route handler, the real writer, the real city-rotation
// picker, and the real auth-check all run · which is the point.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

type Query = { text: string; params: unknown[] };

type FakeClient = {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
};

let capturedQueries: Query[] = [];
let fakeClient: FakeClient;

function makeFakeClient(
  responder: (q: Query) => { rows?: Record<string, unknown>[]; rowCount: number } | Error,
): FakeClient {
  const query = vi.fn(async (text: string, params?: unknown[]) => {
    const q: Query = { text, params: params ?? [] };
    capturedQueries.push(q);
    const r = responder(q);
    if (r instanceof Error) throw r;
    return { rows: r.rows ?? [], rowCount: r.rowCount };
  });
  return { query, release: vi.fn() };
}

vi.mock("@/lib/nex/db", () => ({
  withClient: (<T>(fn: (c: FakeClient) => Promise<T>) => fn(fakeClient)) as <T>(
    fn: (c: FakeClient) => Promise<T>,
  ) => Promise<T | null>,
}));

vi.mock("@/lib/nex-native/harvest/overpass-fetcher", () => ({
  fetchOsmBusinessesInBbox: vi.fn(async () => ({
    ok: true as const,
    host: "overpass.test",
    fetchMs: 42,
    elements: [
      {
        type: "node" as const,
        id: 777,
        lat: -7.8,
        lon: 110.37,
        tags: {
          name: "Warung Email Dropper",
          amenity: "restaurant",
          email: "test-drop@example.com",
        },
      },
    ],
  })),
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: vi.fn(async () => null),
}));

// Import the route AFTER all mocks are registered.
import { POST } from "../route";

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  capturedQueries = [];
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  // Route accepts a `Bearer <CRON_SECRET>` auth header, so set a
  // known secret for the duration of the test.
  process.env.CRON_SECRET = "test-cron-secret";
});

afterEach(() => {
  warnSpy.mockRestore();
  delete process.env.CRON_SECRET;
  vi.clearAllMocks();
});

function isSelectOptedIn(q: Query): boolean {
  return q.text.includes("discovery_programme_country");
}

function isSelectCursor(q: Query): boolean {
  return q.text.includes("aof_cycle") && q.text.includes("triggered_by LIKE");
}

function isExtendedInsert(q: Query): boolean {
  return q.text.includes("business_canonical") && q.text.includes("email_status");
}

function isIdentityInsert(q: Query): boolean {
  return (
    q.text.includes("business_canonical") && !q.text.includes("email_status")
  );
}

function isAofInsert(q: Query): boolean {
  return q.text.includes("INSERT INTO nex.aof_cycle");
}

describe("D · tick response surfaces emails_dropped_schema_missing end to end", () => {
  it("counter == 1 reaches the response body when the writer drops one OSM email", async () => {
    fakeClient = makeFakeClient((q) => {
      // 1. opted-in-country probe → return 'ID' so pickNextCity has
      //    at least one eligible pool.
      if (isSelectOptedIn(q)) {
        return { rows: [{ iso_alpha_2: "ID" }], rowCount: 1 };
      }
      // 2. rotation cursor probe → no prior row (first-ever tick).
      if (isSelectCursor(q)) {
        return { rows: [], rowCount: 0 };
      }
      // 3. canonical extended INSERT → 42703 (migration 202 absent).
      if (isExtendedInsert(q)) {
        return new Error(
          'column "email_status" of relation "business_canonical" does not exist',
        );
      }
      // 4. canonical identity-only fallback → succeed.
      if (isIdentityInsert(q)) {
        return { rows: [], rowCount: 1 };
      }
      // 5. aof_cycle recordCycle INSERT → succeed.
      if (isAofInsert(q)) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = new Request("https://localhost/api/nex-native/harvest/tick", {
      method: "POST",
      headers: { authorization: "Bearer test-cron-secret" },
    });
    const res = await POST(req);
    const body = (await res.json()) as Record<string, unknown>;

    // Core assertion · the counter flows writer → response.
    expect(body.ok).toBe(true);
    expect(body.reason).toBe("completed");
    expect(body.emails_dropped_schema_missing).toBe(1);
    expect(body.inserted).toBe(1);
    expect(body.errors).toBe(0);
    expect(body.fetched).toBe(1);

    // Writer emitted the structured warn once · event + context intact.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(warnSpy.mock.calls[0]![0] as string) as Record<
      string,
      unknown
    >;
    expect(parsed.event).toBe("email_dropped_schema_missing_migration_202");
    expect(parsed.osm_ref).toBe("osm_node_777");
    expect(parsed.country).toBe("ID");
    // Email VALUE must NOT appear in the warn payload (PII guard).
    expect(JSON.stringify(parsed)).not.toContain("test-drop@example.com");
  });

  it("counter == 0 when nothing was dropped · overpass_failed early return still carries the field", async () => {
    // Make Overpass fail · writer never runs · the early-return
    // branch of the route must still emit the counter in its response.
    const fetcher = await import(
      "@/lib/nex-native/harvest/overpass-fetcher"
    );
    (fetcher.fetchOsmBusinessesInBbox as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false as const,
      host: "overpass.test",
      fetchMs: 5,
    });

    fakeClient = makeFakeClient((q) => {
      if (isSelectOptedIn(q))
        return { rows: [{ iso_alpha_2: "ID" }], rowCount: 1 };
      if (isSelectCursor(q)) return { rows: [], rowCount: 0 };
      if (isAofInsert(q)) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });

    const req = new Request("https://localhost/api/nex-native/harvest/tick", {
      method: "POST",
      headers: { authorization: "Bearer test-cron-secret" },
    });
    const res = await POST(req);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.ok).toBe(false);
    expect(body.reason).toBe("overpass_failed");
    // The field is present and honest · zero drops when the writer
    // was never reached.
    expect(body.emails_dropped_schema_missing).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("unauthorised request · field is still present in the empty response · never undefined", async () => {
    fakeClient = makeFakeClient(() => ({ rows: [], rowCount: 0 }));

    const req = new Request("https://localhost/api/nex-native/harvest/tick", {
      method: "POST",
      // Deliberately NO auth header.
    });
    const res = await POST(req);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("unauthorised");
    // Owner directive · the honest-shape response ALWAYS exposes the
    // field · callers must not probe `=== undefined` to detect it.
    expect(body).toHaveProperty("emails_dropped_schema_missing");
    expect(body.emails_dropped_schema_missing).toBe(0);
  });
});
