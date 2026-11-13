// src/lib/nex-native/seo/__tests__/sitemap-service.test.ts
//
// NEX SEO B1 audit · sitemap-service edge cases (empty DB + DB failure).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();
vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: (...a: unknown[]) => mockFrom(...a) },
}));

beforeEach(() => {
  mockFrom.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Builder helper: chainable postgrest-ish stub.
function chain(result: { data: unknown; error: unknown }) {
  const self: Record<string, unknown> = {};
  self.select = () => self;
  self.not = () => self;
  self.order = () => self;
  self.limit = () => Promise.resolve(result);
  return self;
}

describe("loadPublicShopsForSitemap · edge cases", () => {
  it("returns [] when DB returns an empty array", async () => {
    mockFrom.mockReturnValue(chain({ data: [], error: null }));
    const mod = await import("../sitemap-service");
    const out = await mod.loadPublicShopsForSitemap();
    expect(out).toEqual([]);
  });

  it("returns [] when DB returns error (fails soft, does not throw)", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "boom" } }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const mod = await import("../sitemap-service");
    const out = await mod.loadPublicShopsForSitemap();
    expect(out).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("returns [] when the from() helper throws synchronously", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("supabase offline");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const mod = await import("../sitemap-service");
    const out = await mod.loadPublicShopsForSitemap();
    expect(out).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("drops rows with empty slug", async () => {
    mockFrom.mockReturnValue(
      chain({
        data: [
          { slug: "molly", updated_at: "2026-01-01T00:00:00Z" },
          { slug: "", updated_at: "2026-01-02T00:00:00Z" },
          { slug: "   ", updated_at: "2026-01-02T00:00:00Z" },
          { slug: null, updated_at: "2026-01-03T00:00:00Z" },
        ],
        error: null,
      }),
    );
    const mod = await import("../sitemap-service");
    const out = await mod.loadPublicShopsForSitemap();
    expect(out.length).toBe(1);
    expect(out[0].slug).toBe("molly");
  });

  it("falls back to now() when updated_at is unparseable", async () => {
    mockFrom.mockReturnValue(
      chain({
        data: [
          { slug: "molly", updated_at: "not-a-date" },
          { slug: "oak", updated_at: null },
        ],
        error: null,
      }),
    );
    const mod = await import("../sitemap-service");
    const out = await mod.loadPublicShopsForSitemap();
    for (const entry of out) {
      expect(entry.lastModified.valueOf()).not.toBeNaN();
    }
  });
});
