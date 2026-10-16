// src/lib/nex-native/routing/__tests__/route-registry.test.ts
//
// Integrity tests for the route registry. These catch:
//   · Duplicate route ids
//   · Duplicate canonical URLs (routing collision)
//   · Duplicate file paths (two routes claiming the same file)
//   · Broken redirects (redirectsFrom includes the canonicalUrl · loop)
//   · Parent-id references that don't resolve
//   · Access-level invariants (admin routes must declare an auth gate)
//
// These tests run in the regular test suite · failing fast when a new
// RouteEntry is added incorrectly.

import { describe, test, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ROUTE_REGISTRY,
  getRouteById,
  getRegisteredFilePaths,
} from "../route-registry";

describe("route-registry · integrity", () => {
  test("every route id is unique", () => {
    const ids = ROUTE_REGISTRY.map((r) => r.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dup).toEqual([]);
  });

  test("every file path is unique", () => {
    const paths = ROUTE_REGISTRY.map((r) => r.filePath);
    const dup = paths.filter((p, i) => paths.indexOf(p) !== i);
    expect(dup).toEqual([]);
  });

  test("every canonical URL is unique (routing collision check)", () => {
    const urls = ROUTE_REGISTRY.map((r) => r.canonicalUrl);
    const dup = urls.filter((u, i) => urls.indexOf(u) !== i);
    expect(dup).toEqual([]);
  });

  test("no redirectsFrom entry equals its own canonicalUrl (redirect loop)", () => {
    for (const r of ROUTE_REGISTRY) {
      expect(r.redirectsFrom).not.toContain(r.canonicalUrl);
    }
  });

  test("every parentId resolves to an existing route id", () => {
    for (const r of ROUTE_REGISTRY) {
      if (r.parentId !== null) {
        expect(getRouteById(r.parentId), `${r.id} parentId=${r.parentId}`).not.toBe(null);
      }
    }
  });

  test("every admin route declares an authGate", () => {
    for (const r of ROUTE_REGISTRY) {
      if (r.accessLevel === "admin") {
        expect(r.authGate, `${r.id} missing authGate`).toBeDefined();
      }
    }
  });

  test("public routes have no authGate (public = anyone)", () => {
    for (const r of ROUTE_REGISTRY) {
      if (r.accessLevel === "public" && r.authGate !== undefined) {
        // Allowed exception: a public route with an authGate for upgrade-only paths.
        // We still want to be loud about any mismatch.
        throw new Error(`${r.id} is public but declares authGate=${r.authGate}; this is a logic error unless intentional.`);
      }
    }
  });

  test("every planned route has lifecycle='planned' and no activeDate", () => {
    for (const r of ROUTE_REGISTRY) {
      if (r.lifecycle === "planned") {
        expect(r.activeDate, `${r.id} planned but has activeDate`).toBeUndefined();
      }
      if (r.lifecycle === "active") {
        // Note: we don't REQUIRE activeDate on active (some pre-dating entries
        // may lack it) · but if present it must look like YYYY-MM-DD.
        if (r.activeDate !== undefined) {
          expect(r.activeDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    }
  });

  test("every redirectsFrom entry starts with / (shape)", () => {
    for (const r of ROUTE_REGISTRY) {
      for (const from of r.redirectsFrom) {
        expect(from.startsWith("/"), `${r.id} redirectsFrom=${from}`).toBe(true);
      }
    }
  });

  test("every canonicalUrl starts with / (shape)", () => {
    for (const r of ROUTE_REGISTRY) {
      expect(r.canonicalUrl.startsWith("/"), `${r.id} canonicalUrl=${r.canonicalUrl}`).toBe(true);
    }
  });

  test("every currentUrl starts with / (shape)", () => {
    for (const r of ROUTE_REGISTRY) {
      expect(r.currentUrl.startsWith("/"), `${r.id} currentUrl=${r.currentUrl}`).toBe(true);
    }
  });

  test("getRegisteredFilePaths returns a Set with the correct size", () => {
    const paths = getRegisteredFilePaths();
    expect(paths.size).toBe(ROUTE_REGISTRY.length);
  });

  test("directory_home route is marked public and lives in the directory feature", () => {
    const r = getRouteById("directory_home");
    expect(r).not.toBe(null);
    expect(r?.accessLevel).toBe("public");
    expect(r?.feature).toBe("directory");
    expect(r?.redirectsFrom).toContain("/nex-native/directory");
  });

  test("admin_image_review is admin-gated AND marked read_only_phase_1", () => {
    const r = getRouteById("admin_image_review");
    expect(r).not.toBe(null);
    expect(r?.accessLevel).toBe("admin");
    expect(r?.authGate).toBeDefined();
    expect(r?.flags).toContain("read_only_phase_1");
  });
});
