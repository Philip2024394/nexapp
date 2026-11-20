// src/lib/nex-native/catalogue/__tests__/strip-wholesale.test.ts
//
// W9 regression · the server-boundary scrub for `__wholesale` must
// never leak trade pricing into the public retail product-detail
// client payload. Authored 2026-11-18.

import { describe, it, expect } from "vitest";
import { stripWholesaleFromSpec } from "../strip-wholesale";
import { WHOLESALE_SPEC_KEY } from "../identity-wholesale-spec";

describe("stripWholesaleFromSpec · W9 regression", () => {
  it("returns null for null/undefined input", () => {
    expect(stripWholesaleFromSpec(null)).toBeNull();
    expect(stripWholesaleFromSpec(undefined)).toBeNull();
  });

  it("returns null for primitive input", () => {
    expect(stripWholesaleFromSpec(1)).toBeNull();
    expect(stripWholesaleFromSpec("string")).toBeNull();
    expect(stripWholesaleFromSpec(true)).toBeNull();
  });

  it("returns null for array input (shape mismatch)", () => {
    expect(stripWholesaleFromSpec([])).toBeNull();
    expect(stripWholesaleFromSpec([{ __wholesale: {} }])).toBeNull();
  });

  it("preserves public retail keys intact", () => {
    const spec = {
      __identity: { condition: "new", country_of_manufacture: "ID" },
      __delivery: { package: { weight_kg: 0.5 } },
      __returns: { accepted: true },
      __colors: { primary: "red" },
      condition: "new",
      origin: "Yogyakarta, Indonesia",
    };
    const out = stripWholesaleFromSpec(spec);
    expect(out).not.toBeNull();
    expect(out).toEqual(spec);
  });

  it("removes the __wholesale key when present", () => {
    const spec = {
      __identity: { condition: "new" },
      __wholesale: {
        offered: true,
        min_qty: 50,
        price_per_piece_pence: 1200,
        tiers: [{ min_qty: 50, price_per_piece_pence: 1200 }],
      },
    };
    const out = stripWholesaleFromSpec(spec);
    expect(out).not.toBeNull();
    expect(out).toEqual({ __identity: { condition: "new" } });
    expect(out).not.toHaveProperty(WHOLESALE_SPEC_KEY);
    expect(out).not.toHaveProperty("__wholesale");
  });

  it("does not mutate the source object", () => {
    const spec: Record<string, unknown> = {
      __identity: { condition: "new" },
      __wholesale: { offered: true, min_qty: 10, price_per_piece_pence: 500 },
    };
    const snapshot = JSON.stringify(spec);
    const out = stripWholesaleFromSpec(spec);
    expect(JSON.stringify(spec)).toBe(snapshot);
    expect(out).not.toHaveProperty("__wholesale");
  });

  it("stringifying the output never contains '__wholesale'", () => {
    const spec = {
      name_duplicate: "camera case",
      __wholesale: { offered: true, min_qty: 100, price_per_piece_pence: 850 },
      __identity: { condition: "new" },
    };
    const out = stripWholesaleFromSpec(spec);
    const serialised = JSON.stringify(out);
    expect(serialised).not.toContain("__wholesale");
    expect(serialised).not.toContain("price_per_piece_pence");
    expect(serialised).toContain("__identity");
  });

  it("handles spec without __wholesale (no-op copy)", () => {
    const spec = { foo: "bar", __identity: { condition: "new" } };
    const out = stripWholesaleFromSpec(spec);
    expect(out).toEqual(spec);
    expect(out).not.toBe(spec); // shallow-copied, not aliased
  });

  it("handles deeply nested wholesale-ish strings without stripping them", () => {
    // If a seller's retail description legitimately contains the string
    // "__wholesale" (e.g. in a how-to-contact-for-trade paragraph), we
    // only remove the reserved top-level key. Nested descriptive text is
    // preserved.
    const spec = {
      description_notes: "Contact us for __wholesale pricing options.",
      __wholesale: { offered: true },
    };
    const out = stripWholesaleFromSpec(spec);
    expect(out).toEqual({
      description_notes: "Contact us for __wholesale pricing options.",
    });
    // The DESCRIPTIVE string survives · only the top-level key is removed.
    expect(JSON.stringify(out)).toContain("Contact us for __wholesale");
    // But the pricing structural key is gone.
    expect(out).not.toHaveProperty("__wholesale");
  });

  it("empty object spec round-trips to empty object", () => {
    expect(stripWholesaleFromSpec({})).toEqual({});
  });
});
