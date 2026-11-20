// src/lib/nex-native/delivery/__tests__/cart-delivery-shape.test.ts
//
// Lane F · Decision F-A · pure classifier + union helper regression
// anchors. Offline-only; no DB, no network, no Supabase, no auth.

import { describe, test, expect } from "vitest";

import {
  classifyCartItemDelivery,
  classifyCartDeliveryShape,
  extractCartItemRadii,
  unionPerRingRadii,
} from "@/lib/nex-native/delivery/cart-delivery-shape";
import { DELIVERY_SPEC_KEY } from "@/lib/nex-native/catalogue/delivery-spec";

// ─── Fixtures ────────────────────────────────────────────────────────

const perRingSpec = {
  [DELIVERY_SPEC_KEY]: {
    local: {
      radii: [
        { km: 5, price_pence: 1_000_000, currency: "IDR" },
        { km: 10, price_pence: 1_500_000, currency: "IDR" },
      ],
    },
  },
};

const emptyRadiiSpec = {
  [DELIVERY_SPEC_KEY]: { local: { radii: [] } },
};

const noDeliverySpec = { some_other_key: 1 };

const malformedSpec = {
  [DELIVERY_SPEC_KEY]: {
    local: {
      radii: [
        { km: -1, price_pence: 1_000, currency: "idr" }, // malformed · dropped by Zod
      ],
    },
  },
};

const secondPerRingSpec = {
  [DELIVERY_SPEC_KEY]: {
    local: {
      radii: [
        { km: 5, price_pence: 900_000, currency: "IDR" }, // cheaper at 5 km
        { km: 20, price_pence: 3_000_000, currency: "IDR" },
      ],
    },
  },
};

// ─── classifyCartItemDelivery ────────────────────────────────────────

describe("classifyCartItemDelivery", () => {
  test("F-A-ITEM-1 · product with non-empty radii → per_ring", () => {
    expect(classifyCartItemDelivery("product", perRingSpec)).toBe("per_ring");
  });

  test("F-A-ITEM-2 · product with empty radii → rate_card (not per_ring)", () => {
    expect(classifyCartItemDelivery("product", emptyRadiiSpec)).toBe(
      "rate_card",
    );
  });

  test("F-A-ITEM-3 · product with no __delivery block → rate_card", () => {
    expect(classifyCartItemDelivery("product", noDeliverySpec)).toBe(
      "rate_card",
    );
  });

  test("F-A-ITEM-4 · menu_item always → rate_card (ignores any spec payload)", () => {
    expect(classifyCartItemDelivery("menu_item", perRingSpec)).toBe(
      "rate_card",
    );
  });

  test("F-A-ITEM-5 · unknown kind defensively → rate_card (action rejects upstream)", () => {
    expect(classifyCartItemDelivery("service", perRingSpec)).toBe("rate_card");
  });

  test("F-A-ITEM-6 · malformed radii row safeParse-fails to empty radii → rate_card (does not invent per-ring)", () => {
    expect(classifyCartItemDelivery("product", malformedSpec)).toBe(
      "rate_card",
    );
  });

  test("F-A-ITEM-7 · null/undefined spec → rate_card (never throws)", () => {
    expect(classifyCartItemDelivery("product", null)).toBe("rate_card");
    expect(classifyCartItemDelivery("product", undefined)).toBe("rate_card");
  });
});

// ─── classifyCartDeliveryShape ───────────────────────────────────────

describe("classifyCartDeliveryShape", () => {
  test("F-A-CART-1 · empty cart → 'empty' (callers reject upstream)", () => {
    expect(classifyCartDeliveryShape([])).toBe("empty");
  });

  test("F-A-CART-2 · all per_ring → 'per_ring'", () => {
    expect(classifyCartDeliveryShape(["per_ring", "per_ring"])).toBe(
      "per_ring",
    );
  });

  test("F-A-CART-3 · all rate_card → 'rate_card'", () => {
    expect(classifyCartDeliveryShape(["rate_card", "rate_card"])).toBe(
      "rate_card",
    );
  });

  test("F-A-CART-4 · per_ring + rate_card → 'mixed' (REJECT at boundary)", () => {
    expect(classifyCartDeliveryShape(["per_ring", "rate_card"])).toBe("mixed");
    expect(classifyCartDeliveryShape(["rate_card", "per_ring"])).toBe("mixed");
  });

  test("F-A-CART-5 · single item preserves its own kind", () => {
    expect(classifyCartDeliveryShape(["per_ring"])).toBe("per_ring");
    expect(classifyCartDeliveryShape(["rate_card"])).toBe("rate_card");
  });
});

// ─── extractCartItemRadii ────────────────────────────────────────────

describe("extractCartItemRadii", () => {
  test("F-A-EXTRACT-1 · product with per-ring spec returns the radii array", () => {
    const radii = extractCartItemRadii("product", perRingSpec);
    expect(radii.length).toBe(2);
    expect(radii[0]!.km).toBe(5);
    expect(radii[1]!.km).toBe(10);
  });

  test("F-A-EXTRACT-2 · menu_item always returns empty array", () => {
    expect(extractCartItemRadii("menu_item", perRingSpec)).toEqual([]);
  });

  test("F-A-EXTRACT-3 · no __delivery block returns empty array", () => {
    expect(extractCartItemRadii("product", noDeliverySpec)).toEqual([]);
  });

  test("F-A-EXTRACT-4 · malformed spec returns empty array (not thrown, not invented)", () => {
    expect(extractCartItemRadii("product", null)).toEqual([]);
    expect(extractCartItemRadii("product", undefined)).toEqual([]);
  });
});

// ─── unionPerRingRadii (F-A tightest-rate + largest-ring bound) ──────

describe("unionPerRingRadii", () => {
  test("F-A-UNION-1 · single item · radii pass through sorted ascending by km", () => {
    const unioned = unionPerRingRadii([perRingSpec[DELIVERY_SPEC_KEY].local.radii]);
    expect(unioned.map((r) => r.km)).toEqual([5, 10]);
  });

  test("F-A-UNION-2 · two items share km=5 · tightest (lowest) price wins", () => {
    const unioned = unionPerRingRadii([
      perRingSpec[DELIVERY_SPEC_KEY].local.radii,
      secondPerRingSpec[DELIVERY_SPEC_KEY].local.radii,
    ]);
    const ring5 = unioned.find((r) => r.km === 5)!;
    expect(ring5.price_pence).toBe(900_000); // owner-exact · min across items
  });

  test("F-A-UNION-3 · largest km bound = max of per-item largest rings", () => {
    const unioned = unionPerRingRadii([
      perRingSpec[DELIVERY_SPEC_KEY].local.radii, // max km = 10
      secondPerRingSpec[DELIVERY_SPEC_KEY].local.radii, // max km = 20
    ]);
    const maxKm = unioned[unioned.length - 1]!.km;
    expect(maxKm).toBe(20); // owner-exact · "largest of all per-item largest rings"
  });

  test("F-A-UNION-4 · empty inputs → empty unioned list", () => {
    expect(unionPerRingRadii([])).toEqual([]);
    expect(unionPerRingRadii([[]])).toEqual([]);
    expect(unionPerRingRadii([[], []])).toEqual([]);
  });

  test("F-A-UNION-5 · deterministic sort: ascending km, then ascending price", () => {
    const unioned = unionPerRingRadii([
      [
        { km: 10, price_pence: 2_000_000, currency: "IDR" },
        { km: 5, price_pence: 1_000_000, currency: "IDR" },
      ],
    ]);
    expect(unioned.map((r) => r.km)).toEqual([5, 10]);
  });

  test("F-A-UNION-6 · currency preserved on the chosen (tightest) row", () => {
    const unioned = unionPerRingRadii([
      [{ km: 5, price_pence: 1_000_000, currency: "IDR" }],
      [{ km: 5, price_pence: 900_000, currency: "IDR" }],
    ]);
    const ring5 = unioned.find((r) => r.km === 5)!;
    expect(ring5.currency).toBe("IDR");
    expect(ring5.price_pence).toBe(900_000);
  });
});
