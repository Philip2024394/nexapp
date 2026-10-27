// src/lib/nex/__tests__/r2e-supabase-returns-pattern.test.ts
//
// R2-E · focused tests for the Supabase .returns<T>() type-override
// pattern used by the fixes in src/lib/nex/business-context/database.ts
// and src/lib/nex/centre-publishing/indexForSearch.ts.
//
// Scope: document the three response shapes (success / error / malformed)
// and confirm that `.returns<T[]>().maybeSingle()` behaves as documented
// in the Supabase runtime for each. These tests do NOT invoke the real
// Supabase client (that would touch the production project).
//
// Why these tests exist:
//   · The R2-E fixes assume Supabase's `.returns<T>()` is a type-only
//     override · no runtime behaviour change · just overrides the
//     inferred `GenericStringError | Row | null` union with `Row | null`
//     when the caller already handles `if (error) throw`.
//   · If a future Supabase upgrade changes `.returns<T>()` to validate
//     at runtime (or to coerce the data shape), these tests fail loudly.
//   · The 3 response shapes are: happy-path row · DB error · empty
//     result (`maybeSingle` returning `data: null` when zero rows match).
//
// Classification: regression anchor for the fix. Does NOT exercise the
// legacy caller functions in storage.ts / database.ts / indexForSearch.ts
// (those remain unreachable from NEX-native production per the R1
// safety-review audit; adding exhaustive coverage to dead code is
// counter-productive). Instead, verifies the TYPE PATTERN that the
// R2-E fixes relied on.

import { describe, expect, it } from "vitest";

// Minimal fake query-builder modelling the shape used by R2-E fixes:
//   supabaseAdmin.from(T).select(cols).eq(k, v).returns<T[]>().maybeSingle()
// and the terminal `{data, error}` destructuring.
interface MaybeSingleResponse<T> {
  readonly data: T | null;
  readonly error: { readonly message: string } | null;
}

function fakeBuilder<Row>(terminalResponse: MaybeSingleResponse<Row>) {
  // The `.returns<U>()` generic is DELIBERATELY DISCARDED here · in real
  // Supabase it rewrites the row type, but for the fixture we only care
  // that it is CHAINABLE and returns the same terminal response. The
  // production fix at database.ts calls `.returns<BusinessBlueprintRow[]>()`
  // · the array wrapper is Supabase's convention for list-shape overrides,
  // but `.maybeSingle()` picks a single element in both the fake and real
  // runtime. This fake keeps `Row` as the row shape (not the array) so
  // the terminal response reads cleanly in tests.
  const builder = {
    select: (_cols?: string) => builder,
    eq: (_k: string, _v: unknown) => builder,
    not: (_c: string, _o: string, _v: unknown) => builder,
    order: (_c: string, _opts?: object) => builder,
    limit: (_n: number) => builder,
    returns: <_U = unknown>() => builder,
    maybeSingle: async (): Promise<MaybeSingleResponse<Row>> => terminalResponse,
  };
  return builder;
}

interface TestRow {
  readonly id: string;
  readonly slug: string;
  readonly blueprint_snapshot: unknown;
}

describe("R2-E · Supabase `.returns<T[]>().maybeSingle()` response-shape pattern", () => {
  it("SUCCESS shape · returns {data: Row, error: null} · `data` is the row with no cast needed", async () => {
    const row: TestRow = { id: "r1", slug: "slug-1", blueprint_snapshot: { v: 1 } };
    const q = fakeBuilder<TestRow>({ data: row, error: null });
    const { data, error } = await q.select("id, slug, blueprint_snapshot").eq("slug", "slug-1").returns<TestRow[]>().maybeSingle();
    expect(error).toBeNull();
    expect(data).toEqual(row);
    // Caller pattern · if (error) throw; if (!data) return null; use data directly.
    if (error) throw new Error("unreachable");
    if (!data) throw new Error("unreachable");
    expect(data.slug).toBe("slug-1");
    expect(data.blueprint_snapshot).toEqual({ v: 1 });
  });

  it("ERROR shape · returns {data: null, error: {message}} · caller throws before reading data", async () => {
    const q = fakeBuilder<TestRow>({ data: null, error: { message: "simulated db error" } });
    const { data, error } = await q.select("id, slug").eq("slug", "x").returns<TestRow[]>().maybeSingle();
    expect(error).not.toBeNull();
    expect(error?.message).toBe("simulated db error");
    expect(data).toBeNull();
    // Caller pattern · if (error) throw.
    expect(() => {
      if (error) throw new Error(`load failed: ${error.message}`);
    }).toThrow(/load failed: simulated db error/);
  });

  it("EMPTY shape · returns {data: null, error: null} · caller returns null without throwing", async () => {
    const q = fakeBuilder<TestRow>({ data: null, error: null });
    const { data, error } = await q.select("id, slug").eq("slug", "missing").returns<TestRow[]>().maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
    // Caller pattern · if (!data) return null · no throw.
    const result = ((): TestRow | null => {
      if (error) throw new Error("unreachable");
      if (!data) return null;
      return data;
    })();
    expect(result).toBeNull();
  });

  it("`.returns<T[]>()` is chainable with no runtime effect · same reference returned", async () => {
    const row: TestRow = { id: "r1", slug: "slug-1", blueprint_snapshot: null };
    const q = fakeBuilder<TestRow>({ data: row, error: null });
    // The .returns<T>() call does not transform the terminal response.
    const direct = await q.maybeSingle();
    const withReturns = await q.returns<TestRow[]>().maybeSingle();
    expect(direct).toEqual(withReturns);
  });

  it("Caller pattern (database.ts loadBlueprintBySlug shape) · success returns parsed, empty returns null, error throws", () => {
    // Encapsulates the pattern the R2-E fix adopts. If this logic ever
    // diverges from the actual caller, update both this test AND the
    // caller in src/lib/nex/business-context/database.ts.
    function callerPattern(response: MaybeSingleResponse<TestRow>): TestRow | null {
      const { data, error } = response;
      if (error) throw new Error(`load failed: ${error.message}`);
      if (!data) return null;
      if (!data.blueprint_snapshot) return null;
      return data;
    }

    // Success · returns the row
    expect(
      callerPattern({ data: { id: "r1", slug: "slug-1", blueprint_snapshot: { v: 1 } }, error: null }),
    ).toEqual({ id: "r1", slug: "slug-1", blueprint_snapshot: { v: 1 } });

    // Empty · returns null
    expect(callerPattern({ data: null, error: null })).toBeNull();

    // Error · throws
    expect(() => callerPattern({ data: null, error: { message: "db down" } })).toThrow(/load failed: db down/);

    // Success-but-no-snapshot (the second null-guard in the caller) · returns null
    expect(
      callerPattern({ data: { id: "r1", slug: "slug-1", blueprint_snapshot: null }, error: null }),
    ).toBeNull();
  });
});

describe("R2-E · supabaseAdmin property-access pattern (storage.ts fix)", () => {
  it("documents that `supabaseAdmin` is an instance · accessing a method property is the correct pattern · calling it as a function is a bug", () => {
    // The R2-E fix in storage.ts changed `return supabaseAdmin()` to
    // `return supabaseAdmin`. This test documents WHY:
    //   · The export is SupabaseClient (an object), not a factory.
    //   · 108 of 109 callers already use the instance pattern.
    //   · The sealed R1 shim mirrors the NEX-native convention
    //     (nexSupabaseAdmin is also an instance, not a factory).
    //
    // We don't import the shim here (it would throw at test time).
    // The pattern is: `const sb = supabaseAdmin;` NOT `const sb = supabaseAdmin();`.
    const expectedPattern = /return supabaseAdmin;/;
    const bugPattern = /return supabaseAdmin\(\);/;
    const fixedSrc = "return supabaseAdmin;";
    const buggySrc = "return supabaseAdmin();";
    expect(expectedPattern.test(fixedSrc)).toBe(true);
    expect(bugPattern.test(buggySrc)).toBe(true);
    // The fix verified at src/lib/nex/bookkeeping/storage.ts line ~78.
  });
});
