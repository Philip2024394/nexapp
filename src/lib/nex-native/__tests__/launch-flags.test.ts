// src/lib/nex-native/__tests__/launch-flags.test.ts
//
// B9/B10 · 2026-10-14 · production route and feature-flag containment.
//
// Tests the `commerceEnabledForRequest` and `searchEnabledForRequest`
// helpers at `src/lib/nex-native/launch-flags.ts` after the fix that
// refuses the ?commerce=1 / ?search=1 query-string bypasses in
// production.
//
// Scope:
//   · Development behaviour is preserved exactly (admins can still
//     ?commerce=1 in dev).
//   · Production refuses the query-string bypass regardless of input
//     shape (URLSearchParams · plain object · array · adversarial
//     payloads).
//   · The sealed NEX_COMMERCE_ENABLED env flag path is not exercised
//     here because it is a module-level constant · changing it would
//     require re-importing the module. The function's early-return
//     for NEX_COMMERCE_ENABLED is covered by existing production
//     deploys. These tests focus on the new NODE_ENV gate.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  commerceEnabledForRequest,
  searchEnabledForRequest,
} from "../launch-flags";

afterEach(() => {
  // Restore any env stubs. Vitest's stubEnv auto-restores at suite
  // teardown but we also explicitly release after each test so stubs
  // never bleed across describe blocks.
  vi.unstubAllEnvs();
});

// ─── commerceEnabledForRequest · development behaviour (preserved) ─

describe("commerceEnabledForRequest · development", () => {
  it("accepts ?commerce=1 in URLSearchParams", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      commerceEnabledForRequest(new URLSearchParams("commerce=1")),
    ).toBe(true);
  });

  it("accepts ?commerce=true in URLSearchParams", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      commerceEnabledForRequest(new URLSearchParams("commerce=true")),
    ).toBe(true);
  });

  it("accepts commerce in a plain searchParams object", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(commerceEnabledForRequest({ commerce: "1" })).toBe(true);
    expect(commerceEnabledForRequest({ commerce: "true" })).toBe(true);
  });

  it("accepts commerce in a searchParams array", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      commerceEnabledForRequest({ commerce: ["0", "1"] }),
    ).toBe(true);
    expect(
      commerceEnabledForRequest({ commerce: ["true"] }),
    ).toBe(true);
  });

  it("rejects commerce=0 / false / nothing / arbitrary values", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      commerceEnabledForRequest(new URLSearchParams("commerce=0")),
    ).toBe(false);
    expect(
      commerceEnabledForRequest(new URLSearchParams("commerce=false")),
    ).toBe(false);
    expect(
      commerceEnabledForRequest(new URLSearchParams("")),
    ).toBe(false);
    expect(
      commerceEnabledForRequest(new URLSearchParams("commerce=maybe")),
    ).toBe(false);
    expect(commerceEnabledForRequest({})).toBe(false);
    expect(commerceEnabledForRequest(null)).toBe(false);
    expect(commerceEnabledForRequest(undefined)).toBe(false);
  });
});

// ─── commerceEnabledForRequest · PRODUCTION (new containment) ──────

describe("commerceEnabledForRequest · production (B9/B10 containment)", () => {
  it("REFUSES ?commerce=1 in production via URLSearchParams", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(
      commerceEnabledForRequest(new URLSearchParams("commerce=1")),
    ).toBe(false);
  });

  it("REFUSES ?commerce=true in production via URLSearchParams", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(
      commerceEnabledForRequest(new URLSearchParams("commerce=true")),
    ).toBe(false);
  });

  it("REFUSES commerce=1 via plain object in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(commerceEnabledForRequest({ commerce: "1" })).toBe(false);
    expect(commerceEnabledForRequest({ commerce: "true" })).toBe(false);
  });

  it("REFUSES commerce via array in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(
      commerceEnabledForRequest({ commerce: ["0", "1"] }),
    ).toBe(false);
    expect(
      commerceEnabledForRequest({ commerce: ["true"] }),
    ).toBe(false);
  });

  it("REFUSES all adversarial / malformed inputs in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    // URL-encoded, mixed case, extra whitespace, nested parens, newlines
    expect(
      commerceEnabledForRequest(new URLSearchParams("commerce=%31")),
    ).toBe(false);
    expect(
      commerceEnabledForRequest(new URLSearchParams("commerce=TRUE")),
    ).toBe(false);
    expect(
      commerceEnabledForRequest(new URLSearchParams(" commerce=1 ")),
    ).toBe(false);
    expect(
      commerceEnabledForRequest({ commerce: "1\n" }),
    ).toBe(false);
    expect(
      commerceEnabledForRequest({ commerce: "yes" }),
    ).toBe(false);
    expect(
      commerceEnabledForRequest({ commerce: "ok" }),
    ).toBe(false);
    expect(commerceEnabledForRequest({})).toBe(false);
    expect(commerceEnabledForRequest(null)).toBe(false);
    expect(commerceEnabledForRequest(undefined)).toBe(false);
  });

  it("REFUSES unknown query parameter names in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    // Attacker tries variants
    expect(
      commerceEnabledForRequest(new URLSearchParams("admin=1&commerce=1")),
    ).toBe(false);
    expect(
      commerceEnabledForRequest(new URLSearchParams("COMMERCE=1")),
    ).toBe(false);
    expect(
      commerceEnabledForRequest(new URLSearchParams("commerce%20=1")),
    ).toBe(false);
  });

  it("still REFUSES when there are NO query params in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(
      commerceEnabledForRequest(new URLSearchParams("")),
    ).toBe(false);
    expect(commerceEnabledForRequest(null)).toBe(false);
    expect(commerceEnabledForRequest(undefined)).toBe(false);
    expect(commerceEnabledForRequest({})).toBe(false);
  });
});

// ─── commerceEnabledForRequest · test env (default) ────────────────

describe("commerceEnabledForRequest · test env (vitest default NODE_ENV)", () => {
  it("behaves like development · test env is not 'production'", () => {
    // Do NOT stub NODE_ENV · let vitest's own value stand.
    // vitest sets NODE_ENV=test by default, which satisfies
    // `!== "production"`, so the query bypass should still work.
    const r = commerceEnabledForRequest(new URLSearchParams("commerce=1"));
    expect(r).toBe(true);
    expect(process.env.NODE_ENV === "production").toBe(false);
  });
});

// ─── searchEnabledForRequest · development behaviour (preserved) ───

describe("searchEnabledForRequest · development", () => {
  it("accepts ?search=1 in URLSearchParams", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      searchEnabledForRequest(new URLSearchParams("search=1")),
    ).toBe(true);
  });

  it("accepts search=true in plain object", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(searchEnabledForRequest({ search: "true" })).toBe(true);
  });

  it("accepts search in array form", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(searchEnabledForRequest({ search: ["0", "1"] })).toBe(true);
  });
});

// ─── searchEnabledForRequest · PRODUCTION (new containment) ────────
//
// `NEX_SEARCH_ENABLED` is a module-level constant evaluated at import
// (see launch-flags.ts:91). The dev `.env.local` sets it to "1", which
// would short-circuit `searchEnabledForRequest` before the NODE_ENV
// refusal check. To exercise the production-refusal branch honestly
// we reset the module graph with NEX_SEARCH_ENABLED cleared, then
// re-import the function so the constant evaluates to false for the
// duration of each test.

async function importSearchFnWithProductionEnvs(): Promise<typeof searchEnabledForRequest> {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEX_SEARCH_ENABLED", "");
  const mod = await import("../launch-flags");
  return mod.searchEnabledForRequest;
}

describe("searchEnabledForRequest · production (B9/B10 containment)", () => {
  it("REFUSES ?search=1 in production via URLSearchParams", async () => {
    const fn = await importSearchFnWithProductionEnvs();
    expect(fn(new URLSearchParams("search=1"))).toBe(false);
  });

  it("REFUSES all search-param shapes in production", async () => {
    const fn = await importSearchFnWithProductionEnvs();
    expect(fn(new URLSearchParams("search=true"))).toBe(false);
    expect(fn({ search: "1" })).toBe(false);
    expect(fn({ search: "true" })).toBe(false);
    expect(fn({ search: ["1"] })).toBe(false);
    expect(fn({ search: ["0", "true"] })).toBe(false);
  });

  it("REFUSES adversarial / unknown inputs in production", async () => {
    const fn = await importSearchFnWithProductionEnvs();
    expect(fn(new URLSearchParams("search=%31"))).toBe(false);
    expect(fn(new URLSearchParams("search=TRUE"))).toBe(false);
    expect(fn(new URLSearchParams("SEARCH=1"))).toBe(false);
    expect(fn({ search: "yes" })).toBe(false);
    expect(fn({ search: "ok" })).toBe(false);
    expect(fn({})).toBe(false);
    expect(fn(null)).toBe(false);
    expect(fn(undefined)).toBe(false);
  });

  it("search bypass does not conflate with commerce bypass", async () => {
    // Separate-flags doctrine (launch-flags.ts:92-93 original comment):
    // ?commerce=1 must not unlock search, and vice versa. Reset the
    // module with both NEX_*_ENABLED cleared so neither early-return
    // short-circuits before the per-param check.
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEX_SEARCH_ENABLED", "");
    vi.stubEnv("NEX_COMMERCE_ENABLED", "");
    const mod = await import("../launch-flags");
    expect(
      mod.searchEnabledForRequest(new URLSearchParams("commerce=1")),
    ).toBe(false);
    expect(
      mod.commerceEnabledForRequest(new URLSearchParams("search=1")),
    ).toBe(false);
  });
});

// ─── Observability / policy guards ────────────────────────────────

describe("B9/B10 containment · structural guards", () => {
  it("the exported function names are not renamed", () => {
    expect(typeof commerceEnabledForRequest).toBe("function");
    expect(typeof searchEnabledForRequest).toBe("function");
  });

  it("inputs are never mutated by the functions", () => {
    vi.stubEnv("NODE_ENV", "development");
    const sp = new URLSearchParams("commerce=1&other=stay");
    const spSnapshot = sp.toString();
    commerceEnabledForRequest(sp);
    expect(sp.toString()).toBe(spSnapshot);

    const obj = { commerce: "1", preserved: "yes" };
    const objSnapshot = JSON.stringify(obj);
    commerceEnabledForRequest(obj);
    expect(JSON.stringify(obj)).toBe(objSnapshot);
  });
});
