// Phase 1 unit tests · scaleConfigForTile.
//
// Pure function used by _phone-tile.tsx to adapt a theme's full
// wallpaper_config (tuned for a 390×844 chat) down to a 160–220 px
// tile. Scales particle/sparkle counts and omits mist entirely.

import { describe, expect, it } from "vitest";
import { scaleConfigForTile, pickTileChipKind } from "../_phone-tile";

describe("scaleConfigForTile", () => {
  it("returns null for null input", () => {
    expect(scaleConfigForTile(null)).toBeNull();
    expect(scaleConfigForTile(undefined)).toBeNull();
  });

  it("preserves bubbleStyle verbatim", () => {
    const out = scaleConfigForTile({
      bubbleStyle: { preset: "gradient" },
    });
    expect(out?.bubbleStyle?.preset).toBe("gradient");
  });

  it("scales sparkle count by ÷4 clamped to [3, 8]", () => {
    expect(
      scaleConfigForTile({ sparkle: { color: "#FFF", count: 24 } })?.sparkle
        ?.count,
    ).toBe(6);
    expect(
      scaleConfigForTile({ sparkle: { color: "#FFF", count: 60 } })?.sparkle
        ?.count,
    ).toBe(8);
    expect(
      scaleConfigForTile({ sparkle: { color: "#FFF", count: 4 } })?.sparkle
        ?.count,
    ).toBe(3);
    expect(
      scaleConfigForTile({ sparkle: { color: "#FFF" } })?.sparkle?.count,
    ).toBe(6); // default 24 ÷ 4
  });

  it("scales particleDrift count by ÷4 clamped to [2, 6]", () => {
    expect(
      scaleConfigForTile({
        particleDrift: { color: "#FFF", count: 16 },
      })?.particleDrift?.count,
    ).toBe(4);
    expect(
      scaleConfigForTile({
        particleDrift: { color: "#FFF", count: 48 },
      })?.particleDrift?.count,
    ).toBe(6);
    expect(
      scaleConfigForTile({
        particleDrift: { color: "#FFF", count: 2 },
      })?.particleDrift?.count,
    ).toBe(2);
    expect(
      scaleConfigForTile({ particleDrift: { color: "#FFF" } })?.particleDrift
        ?.count,
    ).toBe(4); // default 16 ÷ 4
  });

  it("preserves sparkle/particle colour, size, speed verbatim", () => {
    const out = scaleConfigForTile({
      sparkle: {
        color: "rgba(255,230,160,0.85)",
        count: 26,
        size: 2,
        twinkleSeconds: 2.5,
      },
      particleDrift: {
        color: "rgba(255,170,80,0.52)",
        count: 18,
        size: 4,
        speedSeconds: 14,
      },
    });
    expect(out?.sparkle?.color).toBe("rgba(255,230,160,0.85)");
    expect(out?.sparkle?.size).toBe(2);
    expect(out?.sparkle?.twinkleSeconds).toBe(2.5);
    expect(out?.particleDrift?.color).toBe("rgba(255,170,80,0.52)");
    expect(out?.particleDrift?.size).toBe(4);
    expect(out?.particleDrift?.speedSeconds).toBe(14);
  });

  it("drops mistDrift entirely · too heavy for tile size", () => {
    const out = scaleConfigForTile({
      mistDrift: { color: "rgba(220,235,225,0.45)", count: 8 },
      sparkle: { color: "#FFF", count: 24 },
    });
    expect(out?.mistDrift).toBeUndefined();
    expect(out?.sparkle?.count).toBe(6);
  });

  it("handles the vitamins production config end-to-end (migration 137)", () => {
    const vitamins = {
      bubbleStyle: { preset: "outlined" as const },
      particleDrift: {
        color: "rgba(255,170,80,0.52)",
        count: 18,
        size: 4,
        speedSeconds: 14,
      },
      sparkle: {
        color: "rgba(255,230,160,0.85)",
        count: 26,
        size: 2,
        twinkleSeconds: 2.5,
      },
    };
    const out = scaleConfigForTile(vitamins);
    expect(out?.bubbleStyle?.preset).toBe("outlined");
    expect(out?.particleDrift?.count).toBe(4); // 18 ÷ 4 = 4
    expect(out?.sparkle?.count).toBe(6); // 26 ÷ 4 = 6
    expect(out?.mistDrift).toBeUndefined();
  });

  it("handles the motorbike production config end-to-end (migration 136)", () => {
    const motorbike = {
      bubbleStyle: { preset: "outlined" as const },
      particleDrift: {
        color: "rgba(180,200,220,0.42)",
        count: 14,
        size: 3,
        speedSeconds: 20,
      },
      sparkle: {
        color: "rgba(220,235,255,0.75)",
        count: 20,
        size: 2,
        twinkleSeconds: 3,
      },
    };
    const out = scaleConfigForTile(motorbike);
    expect(out?.bubbleStyle?.preset).toBe("outlined");
    expect(out?.particleDrift?.count).toBe(3); // 14 ÷ 4 = 3
    expect(out?.sparkle?.count).toBe(5); // 20 ÷ 4 = 5
  });

  it("omitted fields stay omitted · doesn't invent properties", () => {
    const out = scaleConfigForTile({ bubbleStyle: { preset: "pill" } });
    expect(out?.sparkle).toBeUndefined();
    expect(out?.particleDrift).toBeUndefined();
    expect(out?.mistDrift).toBeUndefined();
  });
});

describe("pickTileChipKind · state-chip priority", () => {
  // Rationale: encodes the honest priority the tile JSX actually
  // renders · active > locked > trial > premium. If the priority
  // ever changes in the JSX, this test must change too. Pure
  // function · no jsdom required.

  it("returns 'active' when the viewer's current theme matches, overriding every other flag", () => {
    expect(
      pickTileChipKind({ active: true, locked: true, trialBadge: true, category: "premium" }),
    ).toBe("active");
    expect(
      pickTileChipKind({ active: true, locked: false, trialBadge: false, category: "standard" }),
    ).toBe("active");
  });

  it("returns 'locked' when the theme is Bisnis-gated and the viewer can't use premium, overriding trial + premium chips", () => {
    expect(
      pickTileChipKind({ active: false, locked: true, trialBadge: true, category: "premium" }),
    ).toBe("locked");
    expect(
      pickTileChipKind({ active: false, locked: true, trialBadge: false, category: "standard" }),
    ).toBe("locked");
  });

  it("returns 'trial' when a trial badge is active and the theme is not already locked/active, overriding the premium chip", () => {
    expect(
      pickTileChipKind({ active: false, locked: false, trialBadge: true, category: "premium" }),
    ).toBe("trial");
    expect(
      pickTileChipKind({ active: false, locked: false, trialBadge: true, category: "standard" }),
    ).toBe("trial");
  });

  it("returns 'premium' for category='premium' tiles when no higher-priority chip applies · covers free-premium showcases and premium-accessible viewers", () => {
    expect(
      pickTileChipKind({ active: false, locked: false, trialBadge: false, category: "premium" }),
    ).toBe("premium");
  });

  it("returns null for category='standard' tiles when no chip applies · keeps the standard-tile UI calm", () => {
    expect(
      pickTileChipKind({ active: false, locked: false, trialBadge: false, category: "standard" }),
    ).toBe(null);
  });

  it("never claims purchase or ownership state · chip kinds are strictly { active · locked · trial · premium · null }", () => {
    // Exhaustive-type guard: this test exists so a future refactor
    // that adds (for example) an "owned" or "purchased" chip MUST
    // also update the sealed boundary that no ownership/purchase
    // UI state is driven from this helper. Those states require
    // migrations 191-196 which are not yet applied.
    const kinds = new Set<string | null>();
    for (const active of [false, true]) {
      for (const locked of [false, true]) {
        for (const trialBadge of [false, true]) {
          for (const category of ["standard", "premium"] as const) {
            kinds.add(pickTileChipKind({ active, locked, trialBadge, category }));
          }
        }
      }
    }
    expect(kinds).toEqual(new Set(["active", "locked", "trial", "premium", null]));
  });
});
