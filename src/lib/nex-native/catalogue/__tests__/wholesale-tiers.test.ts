// src/lib/nex-native/catalogue/__tests__/wholesale-tiers.test.ts
//
// Pure-function tests for the multi-tier wholesale pricing helpers.
// Boundary-oriented · integer money handling · no DB · no React.
//
// Companion module: ../wholesale-tiers.ts
// Authored 2026-11-18 (Phase W).

import { describe, expect, it } from "vitest";
import {
  WholesaleTier,
  validateTiers,
  sortTiersByMinQty,
  minimumOrderQuantity,
  selectApplicableTier,
  calcLineTotalPence,
  readTiersFromSpec,
  isWholesalePublishable,
  type WholesaleTierT,
} from "../wholesale-tiers";

// ─── validateTiers ─────────────────────────────────────────────────────────

describe("validateTiers · hard errors", () => {
  it("rejects an empty array with error.code='empty'", () => {
    const r = validateTiers([]);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual([{ code: "empty" }]);
  });

  it("rejects duplicate min_qty", () => {
    const r = validateTiers([
      { min_qty: 10, price_per_piece_pence: 1200 },
      { min_qty: 10, price_per_piece_pence: 1000 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors).toContainEqual({ code: "duplicate_min_qty", min_qty: 10 });
  });

  it("rejects non-positive min_qty (0, negative, non-integer)", () => {
    // Zod gates most of these at schema level, but validateTiers is the
    // last-mile check for already-shaped tier objects.
    expect(
      validateTiers([{ min_qty: 0, price_per_piece_pence: 100 }]).ok,
    ).toBe(false);
    expect(
      validateTiers([{ min_qty: -3, price_per_piece_pence: 100 } as WholesaleTierT]).ok,
    ).toBe(false);
    expect(
      validateTiers([{ min_qty: 3.5, price_per_piece_pence: 100 } as WholesaleTierT]).ok,
    ).toBe(false);
  });

  it("rejects negative price", () => {
    const r = validateTiers([{ min_qty: 10, price_per_piece_pence: -1 }]);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatchObject({ code: "negative_price" });
  });

  it("rejects non-finite price (Infinity, NaN)", () => {
    const r1 = validateTiers([
      { min_qty: 10, price_per_piece_pence: Infinity },
    ]);
    expect(r1.ok).toBe(false);
    const r2 = validateTiers([{ min_qty: 10, price_per_piece_pence: NaN }]);
    expect(r2.ok).toBe(false);
  });
});

describe("validateTiers · soft warnings (inverted tiers)", () => {
  it("flags a higher qty with HIGHER per-piece price as inverted", () => {
    const r = validateTiers([
      { min_qty: 10, price_per_piece_pence: 1000 },
      { min_qty: 50, price_per_piece_pence: 1200 }, // more expensive bulk
    ]);
    expect(r.ok).toBe(true);
    expect(r.warnings).toContainEqual({
      code: "inverted_tier",
      min_qty: 50,
      price_per_piece_pence: 1200,
    });
  });

  it("flags a higher qty with EQUAL per-piece price as inverted (no discount is still a warning)", () => {
    const r = validateTiers([
      { min_qty: 10, price_per_piece_pence: 1000 },
      { min_qty: 50, price_per_piece_pence: 1000 },
    ]);
    expect(r.ok).toBe(true);
    expect(r.warnings).toHaveLength(1);
  });

  it("does NOT warn when a higher qty is strictly cheaper", () => {
    const r = validateTiers([
      { min_qty: 10, price_per_piece_pence: 1200 },
      { min_qty: 50, price_per_piece_pence: 1000 },
    ]);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
  });
});

// ─── sortTiersByMinQty ─────────────────────────────────────────────────────

describe("sortTiersByMinQty", () => {
  it("returns a new ascending-by-min_qty array · input not mutated", () => {
    const input: readonly WholesaleTierT[] = [
      { min_qty: 50, price_per_piece_pence: 1000 },
      { min_qty: 10, price_per_piece_pence: 1200 },
      { min_qty: 100, price_per_piece_pence: 900 },
    ];
    const snapshot = JSON.stringify(input);
    const out = sortTiersByMinQty(input);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(out.map((t) => t.min_qty)).toEqual([10, 50, 100]);
  });

  it("is stable for an empty array", () => {
    expect(sortTiersByMinQty([])).toEqual([]);
  });
});

// ─── minimumOrderQuantity ──────────────────────────────────────────────────

describe("minimumOrderQuantity", () => {
  it("is the LOWEST min_qty across tiers", () => {
    expect(
      minimumOrderQuantity([
        { min_qty: 50, price_per_piece_pence: 1000 },
        { min_qty: 10, price_per_piece_pence: 1200 },
      ]),
    ).toBe(10);
  });

  it("returns null for an empty tier list", () => {
    expect(minimumOrderQuantity([])).toBeNull();
  });
});

// ─── selectApplicableTier ──────────────────────────────────────────────────

describe("selectApplicableTier", () => {
  const TIERS: readonly WholesaleTierT[] = [
    { min_qty: 10, price_per_piece_pence: 1200 },
    { min_qty: 50, price_per_piece_pence: 1000 },
    { min_qty: 100, price_per_piece_pence: 900 },
  ];

  it("exactly at the lowest min · picks the lowest tier", () => {
    expect(selectApplicableTier(TIERS, 10)).toEqual({
      min_qty: 10,
      price_per_piece_pence: 1200,
    });
  });

  it("at min_qty − 1 → null (below MOQ)", () => {
    expect(selectApplicableTier(TIERS, 9)).toBeNull();
  });

  it("just below the next-up tier · picks the lower tier", () => {
    expect(selectApplicableTier(TIERS, 49)).toEqual({
      min_qty: 10,
      price_per_piece_pence: 1200,
    });
  });

  it("exactly at a tier boundary · picks the new tier", () => {
    expect(selectApplicableTier(TIERS, 50)).toEqual({
      min_qty: 50,
      price_per_piece_pence: 1000,
    });
    expect(selectApplicableTier(TIERS, 100)).toEqual({
      min_qty: 100,
      price_per_piece_pence: 900,
    });
  });

  it("well above the highest tier · still picks the highest", () => {
    expect(selectApplicableTier(TIERS, 10_000)).toEqual({
      min_qty: 100,
      price_per_piece_pence: 900,
    });
  });

  it("rejects quantity 0 and negative quantities", () => {
    expect(selectApplicableTier(TIERS, 0)).toBeNull();
    expect(selectApplicableTier(TIERS, -5)).toBeNull();
  });

  it("rejects non-integer quantities", () => {
    expect(selectApplicableTier(TIERS, 12.5)).toBeNull();
  });

  it("handles an unsorted tier input the same way as a sorted one", () => {
    const shuffled: readonly WholesaleTierT[] = [
      { min_qty: 100, price_per_piece_pence: 900 },
      { min_qty: 10, price_per_piece_pence: 1200 },
      { min_qty: 50, price_per_piece_pence: 1000 },
    ];
    expect(selectApplicableTier(shuffled, 75)).toEqual({
      min_qty: 50,
      price_per_piece_pence: 1000,
    });
  });

  it("returns null for an empty tier list regardless of quantity", () => {
    expect(selectApplicableTier([], 100)).toBeNull();
  });
});

// ─── calcLineTotalPence ────────────────────────────────────────────────────

describe("calcLineTotalPence", () => {
  const TIERS: readonly WholesaleTierT[] = [
    { min_qty: 10, price_per_piece_pence: 1200 }, // £12.00 each
    { min_qty: 50, price_per_piece_pence: 1000 }, // £10.00 each
  ];

  it("computes qty × applicable per-piece price in pence (integer)", () => {
    expect(calcLineTotalPence(TIERS, 10)).toBe(12_000); // 10 × 1200
    expect(calcLineTotalPence(TIERS, 50)).toBe(50_000); // 50 × 1000
    expect(calcLineTotalPence(TIERS, 100)).toBe(100_000); // 100 × 1000
  });

  it("returns null below MOQ", () => {
    expect(calcLineTotalPence(TIERS, 9)).toBeNull();
  });

  it("returns null for empty tiers", () => {
    expect(calcLineTotalPence([], 10)).toBeNull();
  });

  it("avoids float drift · integer-only multiply", () => {
    // £0.10 × 7 = £0.70, done in pence: 10 × 7 = 70. (0.10 + 0.10 ... 7
    // times in floating-point would be 0.7000000000000001.)
    const t = [{ min_qty: 1, price_per_piece_pence: 10 }];
    expect(calcLineTotalPence(t, 7)).toBe(70);
    expect(Number.isInteger(calcLineTotalPence(t, 7)!)).toBe(true);
  });
});

// ─── readTiersFromSpec · legacy single-tier vs new array ───────────────────

describe("readTiersFromSpec · precedence", () => {
  it("tiers-array wins when both legacy and tiers are set", () => {
    const spec = {
      offered: true,
      min_qty: 5,
      price_per_piece_pence: 2000,
      tiers: [
        { min_qty: 10, price_per_piece_pence: 1200 },
        { min_qty: 50, price_per_piece_pence: 1000 },
      ],
    };
    const out = readTiersFromSpec(spec);
    expect(out).toEqual([
      { min_qty: 10, price_per_piece_pence: 1200 },
      { min_qty: 50, price_per_piece_pence: 1000 },
    ]);
  });

  it("falls back to legacy single-tier shape when tiers is absent", () => {
    const spec = {
      offered: true,
      min_qty: 20,
      price_per_piece_pence: 1500,
    };
    expect(readTiersFromSpec(spec)).toEqual([
      { min_qty: 20, price_per_piece_pence: 1500 },
    ]);
  });

  it("falls back to legacy single-tier shape when tiers is empty", () => {
    const spec = {
      offered: true,
      min_qty: 20,
      price_per_piece_pence: 1500,
      tiers: [],
    };
    expect(readTiersFromSpec(spec)).toEqual([
      { min_qty: 20, price_per_piece_pence: 1500 },
    ]);
  });

  it("returns [] when offered but no legacy and no tiers", () => {
    expect(readTiersFromSpec({ offered: true })).toEqual([]);
  });

  it("returns [] when the input is not an object / garbage", () => {
    expect(readTiersFromSpec(null)).toEqual([]);
    expect(readTiersFromSpec(undefined)).toEqual([]);
    expect(readTiersFromSpec("no")).toEqual([]);
    expect(readTiersFromSpec(42)).toEqual([]);
  });

  it("silently drops individually-malformed tiers but keeps good ones", () => {
    const spec = {
      offered: true,
      tiers: [
        { min_qty: 10, price_per_piece_pence: 1200 }, // keep
        { min_qty: 0, price_per_piece_pence: 1000 }, // drop (bad min_qty)
        { min_qty: 50, price_per_piece_pence: -1 }, // drop (bad price)
        { min_qty: 100, price_per_piece_pence: 900 }, // keep
      ],
    };
    expect(readTiersFromSpec(spec).map((t) => t.min_qty)).toEqual([10, 100]);
  });
});

// ─── isWholesalePublishable ────────────────────────────────────────────────

describe("isWholesalePublishable", () => {
  it("true when offered=true and at least one valid tier resolves", () => {
    expect(
      isWholesalePublishable({
        offered: true,
        tiers: [{ min_qty: 10, price_per_piece_pence: 1200 }],
      }),
    ).toBe(true);
    expect(
      isWholesalePublishable({
        offered: true,
        min_qty: 10,
        price_per_piece_pence: 1200,
      }),
    ).toBe(true);
  });

  it("false when offered=false even with valid tiers", () => {
    expect(
      isWholesalePublishable({
        offered: false,
        tiers: [{ min_qty: 10, price_per_piece_pence: 1200 }],
      }),
    ).toBe(false);
  });

  it("false when offered=true but no tier shape resolves", () => {
    expect(isWholesalePublishable({ offered: true })).toBe(false);
    expect(isWholesalePublishable({ offered: true, tiers: [] })).toBe(false);
  });

  it("false for garbage input", () => {
    expect(isWholesalePublishable(null)).toBe(false);
    expect(isWholesalePublishable("yes")).toBe(false);
  });
});

// ─── Zod schema spot-check ─────────────────────────────────────────────────

describe("WholesaleTier Zod schema", () => {
  it("accepts a well-formed tier", () => {
    const r = WholesaleTier.safeParse({
      min_qty: 10,
      price_per_piece_pence: 1200,
    });
    expect(r.success).toBe(true);
  });

  it("rejects zero / negative / non-integer min_qty", () => {
    expect(
      WholesaleTier.safeParse({ min_qty: 0, price_per_piece_pence: 100 })
        .success,
    ).toBe(false);
    expect(
      WholesaleTier.safeParse({ min_qty: -1, price_per_piece_pence: 100 })
        .success,
    ).toBe(false);
    expect(
      WholesaleTier.safeParse({ min_qty: 1.5, price_per_piece_pence: 100 })
        .success,
    ).toBe(false);
  });

  it("rejects negative or non-finite price", () => {
    expect(
      WholesaleTier.safeParse({ min_qty: 10, price_per_piece_pence: -1 })
        .success,
    ).toBe(false);
    expect(
      WholesaleTier.safeParse({
        min_qty: 10,
        price_per_piece_pence: Number.POSITIVE_INFINITY,
      }).success,
    ).toBe(false);
  });
});
