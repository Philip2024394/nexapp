// src/lib/nex-native/business/__tests__/listing-add-route.test.ts
//
// Owner-authorised 2026-10-20 · exhaustive mapping test for the
// subtype-to-creation-surface helper. One assertion per subtype in
// `BusinessSubtype` so a future addition to types.ts forces a
// deliberate update here.

import { describe, test, expect } from "vitest";
import { listingAddRouteFor } from "../listing-add-route";
import type { BusinessSubtype } from "../types";

// ─── Ready-state subtypes · creation surface exists today ──────────

describe("A · food subtypes route to /manage/menu", () => {
  const foodSubtypes: BusinessSubtype[] = [
    "restaurant",
    "cafe",
    "bakery",
    "food_maker",
    "catering",
    "drinks",
    "food_delivery",
  ];
  for (const s of foodSubtypes) {
    test(`${s} → /nex-native/manage/menu · 'Add menu item'`, () => {
      const result = listingAddRouteFor(s);
      expect(result).not.toBeNull();
      expect(result!.state).toBe("ready");
      if (result!.state === "ready") {
        expect(result!.href).toBe("/nex-native/manage/menu");
        expect(result!.label).toBe("Add menu item");
      }
    });
  }
});

describe("B · services subtypes route to /manage/services", () => {
  const servicesSubtypes: BusinessSubtype[] = [
    "beauty",
    "health_wellness",
    "home_services",
    "professional",
    "trade_construction",
    "automotive",
    "events",
    "creative",
  ];
  for (const s of servicesSubtypes) {
    test(`${s} → /nex-native/manage/services · 'Add service'`, () => {
      const result = listingAddRouteFor(s);
      expect(result).not.toBeNull();
      expect(result!.state).toBe("ready");
      if (result!.state === "ready") {
        expect(result!.href).toBe("/nex-native/manage/services");
        expect(result!.label).toBe("Add service");
      }
    });
  }
});

describe("C · products subtypes route to /manage/products", () => {
  const productsSubtypes: BusinessSubtype[] = [
    "retail",
    "manufacturer",
    "wholesale",
    "local_artisan",
    "exporter",
    "motorbike_shop",
  ];
  for (const s of productsSubtypes) {
    test(`${s} → /nex-native/manage/products · 'Add product'`, () => {
      const result = listingAddRouteFor(s);
      expect(result).not.toBeNull();
      expect(result!.state).toBe("ready");
      if (result!.state === "ready") {
        expect(result!.href).toBe("/nex-native/manage/products");
        expect(result!.label).toBe("Add product");
      }
    });
  }
});

// ─── Blocked-state subtypes · no creation surface exists yet ───────

describe("D · accommodation subtypes · Phase A1 · backend authored · migration 213 awaiting apply · blocked", () => {
  // 2026-10-21 · the accommodation backend has been authored
  // (migration 213 + accommodation-service + /manage/accommodation
  // surface + customer render path). The authorisation forbids a
  // ready CTA pointing to an unapplied-migration route, so the state
  // stays `blocked` and the label/reason reflect the new build state.
  // When migration 213 is applied under separate authorisation, this
  // test must flip to assert `state: "ready"` and
  // `href: "/nex-native/manage/accommodation"` with label "Add room".
  const accommodationSubtypes: BusinessSubtype[] = [
    "hotel",
    "villa",
    "guesthouse",
    "homestay",
    "resort",
    "short_rental",
    "kost",
  ];
  for (const s of accommodationSubtypes) {
    test(`${s} → blocked · label signals backend authored · reason references migration 213`, () => {
      const result = listingAddRouteFor(s);
      expect(result).not.toBeNull();
      expect(result!.state).toBe("blocked");
      if (result!.state === "blocked") {
        expect(result!.label).toMatch(/backend authored/i);
        expect(result!.reason).toMatch(/migration 213/i);
      }
    });
  }
});

describe("E · property subtypes · creation surface not yet built · blocked", () => {
  const propertySubtypes: BusinessSubtype[] = [
    "for_sale",
    "for_rent",
    "developer",
    "agent",
  ];
  for (const s of propertySubtypes) {
    test(`${s} → blocked · reason references creation surface not built`, () => {
      const result = listingAddRouteFor(s);
      expect(result).not.toBeNull();
      expect(result!.state).toBe("blocked");
      if (result!.state === "blocked") {
        expect(result!.label).toBe("Property listings coming soon");
        expect(result!.reason).toMatch(/not been built yet/i);
      }
    });
  }
});

// ─── Defensive · null / undefined handling ─────────────────────────

describe("F · defensive null handling", () => {
  test("null subtype → null (no button)", () => {
    expect(listingAddRouteFor(null)).toBeNull();
  });

  test("undefined subtype → null (no button)", () => {
    expect(listingAddRouteFor(undefined)).toBeNull();
  });
});

// ─── Doctrine · ready vs blocked honesty ───────────────────────────

describe("G · doctrine · the helper never invents a route for a non-existent creation surface", () => {
  test("every ACCOMMODATION subtype stays blocked until Phase B lands", () => {
    // Hard-pin: if someone wires accommodation to a route before the
    // Phase B migration lands, this test fails loudly.
    expect(listingAddRouteFor("villa")?.state).toBe("blocked");
    expect(listingAddRouteFor("kost")?.state).toBe("blocked");
    expect(listingAddRouteFor("homestay")?.state).toBe("blocked");
  });

  test("every PROPERTY subtype stays blocked until the surface is built", () => {
    expect(listingAddRouteFor("for_sale")?.state).toBe("blocked");
    expect(listingAddRouteFor("for_rent")?.state).toBe("blocked");
    expect(listingAddRouteFor("developer")?.state).toBe("blocked");
    expect(listingAddRouteFor("agent")?.state).toBe("blocked");
  });

  test("blocked results never carry an href field (type-level honesty)", () => {
    const result = listingAddRouteFor("villa");
    expect(result).not.toBeNull();
    // TypeScript narrows away href on blocked state · at runtime it
    // literally does not exist on the object.
    expect((result as unknown as Record<string, unknown>).href).toBeUndefined();
  });
});
