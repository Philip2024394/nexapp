// scripts/nex-themes/__tests__/gates.test.ts
//
// NEX Theme Production · Phase A3 · pure-math gate tests.
// --------------------------------------------------------------------------
// Covers the deterministic/pure parts of gates.mjs. The I/O-bound gates
// (asset check, wallpaper legibility, package typecheck) are exercised
// end-to-end by the CLI smoke runs and the Playwright preview.

import { describe, it, expect } from "vitest";
import {
  contrastRatio,
  relativeLuminance,
  hexToRgb,
  wcagLabel,
  gatePaletteCheck,
  gateContrastCheck,
  gateBubbleWallpaperSeparation,
} from "../gates.mjs";
import { deriveTokensFromColours } from "../extract-palette.mjs";

describe("contrast math", () => {
  it("hexToRgb parses canonical hex", () => {
    expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#00AFFF")).toEqual({ r: 0, g: 175, b: 255 });
  });

  it("hexToRgb rejects malformed input", () => {
    expect(() => hexToRgb("not-a-hex")).toThrow(/invalid hex/);
    expect(() => hexToRgb("#FFF")).toThrow(/invalid hex/); // 3-digit not supported
  });

  it("relativeLuminance follows W3C known values", () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1.0, 2);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0.0, 3);
  });

  it("contrastRatio returns the canonical 21:1 for black vs white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 0);
  });

  it("contrastRatio is symmetric", () => {
    const a = "#123456";
    const b = "#ABCDEF";
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 5);
  });

  it("wcagLabel matches the AA body threshold (4.5)", () => {
    expect(wcagLabel(4.6, false)).toBe("pass");
    expect(wcagLabel(4.5, false)).toBe("pass");
    expect(wcagLabel(4.2, false)).toBe("warn");
    expect(wcagLabel(3.0, false)).toBe("fail");
  });

  it("wcagLabel matches the AA large-text threshold (3.0)", () => {
    expect(wcagLabel(3.1, true)).toBe("pass");
    expect(wcagLabel(2.9, true)).toBe("warn");
    expect(wcagLabel(2.5, true)).toBe("fail");
  });
});

describe("gatePaletteCheck", () => {
  it("passes a fully populated 18-field token set", () => {
    const tokens = fullValidTokenSet();
    const r = gatePaletteCheck({ tokens });
    expect(r.status).toBe("pass");
    expect(r.measurements.presentTokenCount).toBe(17);
    expect(r.measurements.provenance).toBe("extracted");
  });

  it("fails when a token is missing", () => {
    const tokens = fullValidTokenSet();
    // @ts-expect-error · deliberately remove to test the gate
    delete tokens.accent;
    const r = gatePaletteCheck({ tokens });
    expect(r.status).toBe("fail");
    expect(r.reason).toMatch(/missing accent/);
  });

  it("fails on malformed hex", () => {
    const tokens = fullValidTokenSet();
    tokens.accent = "ff00ff"; // missing hash
    const r = gatePaletteCheck({ tokens });
    expect(r.status).toBe("fail");
    expect(r.reason).toMatch(/invalid accent/);
  });

  it("accepts rgba() for alpha-carrying tokens", () => {
    const tokens = fullValidTokenSet();
    tokens.bubbleBorder = "rgba(0, 175, 255, 0.28)";
    expect(gatePaletteCheck({ tokens }).status).toBe("pass");
  });

  it("fails on invalid provenance", () => {
    const tokens = fullValidTokenSet();
    // @ts-expect-error · deliberately corrupt provenance to test the gate
    tokens.source = "guessed";
    const r = gatePaletteCheck({ tokens });
    expect(r.status).toBe("fail");
    expect(r.reason).toMatch(/invalid source/);
  });
});

describe("gateContrastCheck", () => {
  it("passes a maximum-contrast token set", () => {
    const tokens = fullValidTokenSet();
    tokens.background = "#000000";
    tokens.textPrimary = "#FFFFFF";
    tokens.surface = "#111111";
    tokens.incomingBubble = "#111111";
    tokens.outgoingBubble = "#111111";
    tokens.composerSurface = "#111111";
    tokens.accent = "#FFFFFF";
    tokens.textOnAccent = "#000000";
    tokens.iconColor = "#FFFFFF";
    const r = gateContrastCheck({ tokens });
    expect(r.status).toBe("pass");
    expect(r.measurements.pass).toBe(r.measurements.pairsChecked);
  });

  it("fails a minimum-contrast token set", () => {
    const tokens = fullValidTokenSet();
    for (const k of Object.keys(tokens)) {
      if (k === "source") continue;
      // @ts-expect-error · wholesale assignment for test
      tokens[k] = "#808080";
    }
    tokens.textOnAccent = "#808080";
    const r = gateContrastCheck({ tokens });
    expect(r.status).toBe("fail");
    expect(r.measurements.fail).toBeGreaterThan(0);
  });

  it("records the WCAG threshold alongside the ratio", () => {
    const r = gateContrastCheck({ tokens: fullValidTokenSet() });
    for (const row of r.measurements.results) {
      expect([3.0, 4.5]).toContain(row.threshold);
      expect(typeof row.ratio).toBe("number");
    }
  });
});

describe("deriveTokensFromColours · Phase A3.1 WCAG fallback", () => {
  it("falls back to canonical ink when extracted textPrimary fails WCAG", () => {
    // Pure deep-red pool · lightest extracted is still too dark for 4.5
    const introColours = [
      { hex: "#630302", rgb: { r: 99, g: 3, b: 2 }, weight: 0.5 },
      { hex: "#740202", rgb: { r: 116, g: 2, b: 2 }, weight: 0.3 },
      { hex: "#a44405", rgb: { r: 164, g: 68, b: 5 }, weight: 0.2 },
    ];
    const tokens = deriveTokensFromColours(introColours, [], {});
    // textPrimary should fall back to NEX canonical bright ink
    expect(tokens.textPrimary).toBe("#F2F5F8");
    // Provenance acknowledges the deterministic fallback
    expect(tokens.source).toBe("mixed");
    // And the fallback produces a passing contrast against the dark bg
    const r = contrastRatio(tokens.textPrimary, tokens.background);
    expect(r).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps extracted textPrimary when it clears WCAG naturally", () => {
    // Dark navy + bright cyan · the bright cyan clears 4.5
    const introColours = [
      { hex: "#030810", rgb: { r: 3, g: 8, b: 16 }, weight: 0.5 },
      { hex: "#F4F7FC", rgb: { r: 244, g: 247, b: 252 }, weight: 0.3 },
      { hex: "#00AFFF", rgb: { r: 0, g: 175, b: 255 }, weight: 0.2 },
    ];
    const tokens = deriveTokensFromColours(introColours, [], {});
    expect(tokens.textPrimary).toBe("#F4F7FC");
    expect(tokens.source).toBe("extracted");
  });

  it("textOnAccent picks white vs black for max contrast", () => {
    // Bright yellow accent → textOnAccent should be dark
    const introColours = [
      { hex: "#030810", rgb: { r: 3, g: 8, b: 16 }, weight: 0.5 },
      { hex: "#FFF200", rgb: { r: 255, g: 242, b: 0 }, weight: 0.5 },
    ];
    const tokens = deriveTokensFromColours(introColours, [], {});
    expect(tokens.textOnAccent).toBe("#0A0A0A");
  });

  it("honours an explicit textOnAccent override", () => {
    const introColours = [
      { hex: "#030810", rgb: { r: 3, g: 8, b: 16 }, weight: 0.5 },
      { hex: "#FFF200", rgb: { r: 255, g: 242, b: 0 }, weight: 0.5 },
    ];
    const tokens = deriveTokensFromColours(introColours, [], {
      textOnAccent: "#FFFFFF",
    });
    expect(tokens.textOnAccent).toBe("#FFFFFF");
    expect(tokens.source).toBe("mixed");
  });
});

describe("gateBubbleWallpaperSeparation · Phase A3.1 reframed gate", () => {
  it("is exported with the new name AND the deprecated alias", async () => {
    const mod = await import("../gates.mjs");
    expect(typeof mod.gateBubbleWallpaperSeparation).toBe("function");
    expect(typeof mod.gateWallpaperLegibility).toBe("function");
    expect(mod.gateBubbleWallpaperSeparation).toBe(mod.gateWallpaperLegibility);
  });
});

describe("A3.4 · wallpaper quality gate", () => {
  it("exports gateWallpaperQuality from gates.mjs", async () => {
    const mod = await import("../gates.mjs");
    expect(typeof mod.gateWallpaperQuality).toBe("function");
  });

  it("fails when wallpaper file is missing (honest failure)", async () => {
    const mod = await import("../gates.mjs");
    const r = await mod.gateWallpaperQuality({ wallpaperPath: "no-such-file.png" });
    expect(r.status).toBe("fail");
    expect(r.id).toBe("wallpaperQuality");
  });
});

describe("A3.4 · region-average feedback loop in bubble derivation", () => {
  it("pushes outgoing bubble further when it fails 2+ wallpaper region averages", () => {
    // Deep-red theme with warm wallpaper regions · mirrors Crispy
    // Chicken's shape. The feedback loop should drive outgoing to a
    // darker luma than the baseline wallpaper-stats push alone.
    const introColours = [
      { hex: "#630302", rgb: { r: 99, g: 3, b: 2 }, weight: 0.5 },
      { hex: "#740202", rgb: { r: 116, g: 2, b: 2 }, weight: 0.3 },
    ];
    const wallpaperStatsWithRegions = {
      min: 20, p25: 60, median: 95, p75: 120, max: 180, average: 95,
      dominantBand: { lo: 60, hi: 120 },
      regionAverages: [120, 115, 108, 90, 128], // all warm-mid luma
    };
    const wallpaperStatsNoRegions = { ...wallpaperStatsWithRegions, regionAverages: undefined };
    const withLoop = deriveTokensFromColours(introColours, [], {}, wallpaperStatsWithRegions);
    const withoutLoop = deriveTokensFromColours(introColours, [], {}, wallpaperStatsNoRegions);
    const lumaWith = Number.parseInt(withLoop.outgoingBubble.slice(1, 3), 16) * 0.2126
                   + Number.parseInt(withLoop.outgoingBubble.slice(3, 5), 16) * 0.7152
                   + Number.parseInt(withLoop.outgoingBubble.slice(5, 7), 16) * 0.0722;
    const lumaWithout = Number.parseInt(withoutLoop.outgoingBubble.slice(1, 3), 16) * 0.2126
                      + Number.parseInt(withoutLoop.outgoingBubble.slice(3, 5), 16) * 0.7152
                      + Number.parseInt(withoutLoop.outgoingBubble.slice(5, 7), 16) * 0.0722;
    // With regions, dark theme → outgoing luma should be ≤ outgoing without regions
    expect(lumaWith).toBeLessThanOrEqual(lumaWithout);
    // And provenance should still be "mixed" (any correction fired)
    expect(withLoop.source).toBe("mixed");
  });
});

function fullValidTokenSet() {
  return {
    background: "#020914",
    surface: "#071525",
    surfaceElevated: "#0D1F33",
    accent: "#00AFFF",
    accentSecondary: "#FF7200",
    textPrimary: "#F2F5F8",
    textSecondary: "#8BA9D1",
    textOnAccent: "#001018",
    incomingBubble: "#111822",
    outgoingBubble: "#003D5C",
    bubbleBorder: "rgba(0, 175, 255, 0.28)",
    composerSurface: "#0A1420",
    composerBorder: "rgba(0, 175, 255, 0.38)",
    iconColor: "#DAE8F6",
    focusColor: "#00AFFF",
    successColor: "#2ED37A",
    dangerColor: "#E85D5D",
    source: "extracted" as const,
  };
}
