// src/lib/nex-native/seo/__tests__/product-availability.test.ts

import { describe, expect, it } from "vitest";
import { mapNexStockToSchema } from "../product-availability";

describe("mapNexStockToSchema", () => {
  it("in_stock + low_stock → InStock", () => {
    expect(mapNexStockToSchema("in_stock")).toBe(
      "https://schema.org/InStock",
    );
    expect(mapNexStockToSchema("low_stock")).toBe(
      "https://schema.org/InStock",
    );
  });

  it("made_to_order → PreOrder", () => {
    expect(mapNexStockToSchema("made_to_order")).toBe(
      "https://schema.org/PreOrder",
    );
  });

  it("sold_out → OutOfStock", () => {
    expect(mapNexStockToSchema("sold_out")).toBe(
      "https://schema.org/OutOfStock",
    );
  });

  it("null / undefined / unknown → null (never inferred)", () => {
    expect(mapNexStockToSchema(null)).toBeNull();
    expect(mapNexStockToSchema(undefined)).toBeNull();
    // @ts-expect-error · we want to prove the fallback holds for garbage.
    expect(mapNexStockToSchema("backordered_elsewhere")).toBeNull();
  });
});
