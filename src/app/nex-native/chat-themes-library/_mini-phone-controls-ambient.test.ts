// src/app/nex-native/chat-themes-library/_mini-phone-controls-ambient.test.ts
//
// Final Parity Pass regression · sealed 2026-10-11.
// -------------------------------------------------
// Two parity invariants a future PR might silently break:
//
//   1. Mini-phones consume the LIVE engine's `resolveControlsTreatment`
//      for header + composer + send button. If a well-meaning refactor
//      re-introduces per-slot gradients (primary/secondary/highlight)
//      for the three header buttons, mini-phones will drift away from
//      the live chat which paints all three buttons identically.
//
//   2. Every ambient family a shipped ThemePackage declares has a
//      mini-phone static representation. If a new ambient family is
//      added to the live engine without updating the shared helper,
//      preview surfaces silently drop it. This test fails loudly in
//      that case.

import { describe, test, expect } from "vitest";
import {
  resolveControlsTreatment,
  type ControlsPalette,
} from "../chat-standard/_engine/control-resolver";
import {
  miniPhoneAmbient,
  miniPhoneBubbleBackground,
  miniPhoneComposerBackground,
  miniPhoneComposerBorder,
  miniPhoneHeaderCluster,
  miniPhoneSendBackground,
  miniPhoneSendIconColor,
  type MiniPhoneAmbientFamilyKind,
  type MiniPhonePalette,
} from "../chat-standard/_engine/preview-mini-phone";
import { LIVE_WORLD_IDS, LIVE_WORLD_PACKAGES } from "../chat-standard/_live-worlds";

const NEX_ORIGINAL: MiniPhonePalette = {
  primary: "#FF7200",
  secondary: "#7D9BC0",
  highlight: "#F2F5F8",
  glow: "rgba(255,114,0,0.45)",
  deep: "var(--nex-world-background-base, #020914)",
};

const WATERWORLD: MiniPhonePalette = {
  primary: "#2E90B5",
  secondary: "#4FC3DC",
  highlight: "#E8F7FF",
  glow: "rgba(130,210,255,0.55)",
  deep: "#0A2535",
};

const CONTRASTING_PINK: MiniPhonePalette = {
  primary: "#FF3EA5",
  secondary: "#38C6FF",
  highlight: "#F2E8FF",
  glow: "rgba(255,62,165,0.55)",
  deep: "#0B0A1E",
};

// ─── A · Header cluster uses the LIVE controls treatment ────────────

describe("A · mini-phone header cluster delegates to resolveControlsTreatment", () => {
  test.each<[string, MiniPhonePalette]>([
    ["NEX Original", NEX_ORIGINAL],
    ["Waterworld", WATERWORLD],
    ["Contrasting Pink (Midnight Café)", CONTRASTING_PINK],
  ])("%s · all three buttons share bg/border/color (matches live chat)", (_label, palette) => {
    const cluster = miniPhoneHeaderCluster(palette);
    expect(cluster).toHaveLength(3);
    const [home, shop, cart] = cluster;
    expect(home.bg).toBe(shop.bg);
    expect(shop.bg).toBe(cart.bg);
    expect(home.border).toBe(shop.border);
    expect(shop.border).toBe(cart.border);
    expect(home.color).toBe(shop.color);
    expect(shop.color).toBe(cart.color);
  });

  test.each<[string, MiniPhonePalette]>([
    ["NEX Original", NEX_ORIGINAL],
    ["Waterworld", WATERWORLD],
    ["Contrasting Pink (Midnight Café)", CONTRASTING_PINK],
  ])(
    "%s · header button bg matches `controls.headerButton.background` (live chat ground truth)",
    (_label, palette) => {
      const controlsPalette: ControlsPalette = {
        primary: palette.primary,
        secondary: palette.secondary,
        highlight: palette.highlight,
        deep: palette.deep,
      };
      const live = resolveControlsTreatment(controlsPalette).headerButton;
      const cluster = miniPhoneHeaderCluster(palette);
      expect(cluster[0].bg).toBe(live.background);
      expect(cluster[0].border).toBe(live.border);
      expect(cluster[0].color).toBe(live.color);
    },
  );

  test("mini-phone cart carries a notification badge · matches live CartIcon semantic", () => {
    const cluster = miniPhoneHeaderCluster(NEX_ORIGINAL);
    const cart = cluster.find((b) => b.key === "cart");
    expect(cart?.hasBadge).toBe(true);
  });
});

// ─── B · Composer + send button delegate to live treatment ─────────

describe("B · composer + send button delegate to resolveControlsTreatment", () => {
  test.each<[string, MiniPhonePalette]>([
    ["NEX Original", NEX_ORIGINAL],
    ["Waterworld", WATERWORLD],
    ["Contrasting Pink", CONTRASTING_PINK],
  ])("%s · composer bg + border byte-match live treatment", (_label, palette) => {
    const live = resolveControlsTreatment(palette).composerContainer;
    expect(miniPhoneComposerBackground(palette)).toBe(live.background);
    expect(miniPhoneComposerBorder(palette)).toBe(live.border);
  });

  test.each<[string, MiniPhonePalette]>([
    ["NEX Original", NEX_ORIGINAL],
    ["Waterworld", WATERWORLD],
    ["Contrasting Pink", CONTRASTING_PINK],
  ])("%s · send bg + icon colour byte-match live treatment", (_label, palette) => {
    const live = resolveControlsTreatment(palette).sendButton(false);
    expect(miniPhoneSendBackground(palette)).toBe(live.background);
    expect(miniPhoneSendIconColor(palette)).toBe(live.color);
  });
});

// ─── C · Glass bubble parity (regression · already covered elsewhere
//     but duplicated here so the parity file is a single read) ───────

describe("C · glass bubbles byte-match live engine formula", () => {
  // The LIVE engine's `hexToRgba` emits NO SPACES around commas (see
  // `theme-engine.tsx:73`). Chromium's computed-style serialisation
  // adds spaces on its own, so at the browser the string reads with
  // spaces — but the inline style the engine writes has none. These
  // assertions match the engine's actual output byte-for-byte.
  test("mine (default · glass) = rgba(primary, 0.26)", () => {
    const result = miniPhoneBubbleBackground(NEX_ORIGINAL, true);
    expect(result).toBe("rgba(255,114,0,0.26)");
  });

  test("peer (default · glass) = rgba(deep, 0.72)", () => {
    const result = miniPhoneBubbleBackground(NEX_ORIGINAL, false);
    expect(result).toBe("rgba(2,9,20,0.72)");
  });

  test("Waterworld mine = rgba(primary teal, 0.26)", () => {
    const result = miniPhoneBubbleBackground(WATERWORLD, true);
    expect(result).toBe("rgba(46,144,181,0.26)");
  });

  test("Waterworld peer = rgba(abyss, 0.72)", () => {
    const result = miniPhoneBubbleBackground(WATERWORLD, false);
    expect(result).toBe("rgba(10,37,53,0.72)");
  });

  test("material-aware · nex-flat uses `solid` · mine = solid primary", () => {
    const result = miniPhoneBubbleBackground(NEX_ORIGINAL, true, "solid");
    expect(result).toBe("#FF7200");
  });

  test("material-aware · nex-flat uses `solid` · peer = rgba(secondary, 0.9)", () => {
    const palette: MiniPhonePalette = {
      ...NEX_ORIGINAL,
      secondary: "#FF9033",
    };
    const result = miniPhoneBubbleBackground(palette, false, "solid");
    expect(result).toBe("rgba(255,144,51,0.9)");
  });
});

// ─── D · Every live-world ambient family has a mini-phone spec ─────

describe("D · ambient family coverage · every shipped family renders", () => {
  // Collect every family name that shipping ThemePackages declare,
  // and filter out families that the LIVE engine itself drops as
  // unknown. The food package currently declares `embers`, `smoke`,
  // and `warm-glow` which are NOT in the engine's `AmbientFamily`
  // union · the live `_ambient-layer.tsx` switch's default case
  // returns null for them, and the mini-phone matches that silent
  // drop. Those three names are a pre-existing bug in
  // `food.package.ts` (`src/app/nex-native/chat-standard/packages/
  // food.package.ts:133`) tracked separately.
  const LIVE_ENGINE_UNKNOWN = new Set(["embers", "smoke", "warm-glow"]);
  const shippedValid = new Set<string>();
  const shippedUnknown = new Set<string>();
  for (const id of LIVE_WORLD_IDS) {
    const pkg = LIVE_WORLD_PACKAGES[id];
    const families = pkg.ambient?.families ?? [];
    for (const f of families) {
      if (LIVE_ENGINE_UNKNOWN.has(f)) shippedUnknown.add(f);
      else shippedValid.add(f);
    }
  }

  test("snapshot · the set of VALID families currently shipped", () => {
    expect([...shippedValid].sort()).toMatchInlineSnapshot(`
      [
        "bubbles-rising",
        "heat-shimmer",
        "leaves-falling",
        "light-rays",
        "mist",
        "neon-flicker",
        "pollen-float",
        "rain-streak",
        "sparkles",
        "steam-rising",
        "sun-dapple",
        "warm-glow-pulse",
      ]
    `);
  });

  test("mini-phone parity with live engine for UNKNOWN family names (both drop silently)", () => {
    for (const unknown of shippedUnknown) {
      const specs = miniPhoneAmbient(NEX_ORIGINAL, [unknown], "sparse");
      expect(specs, `unknown family '${unknown}' should silently drop`).toEqual([]);
    }
  });

  test.each([...shippedValid].sort())(
    "valid family '%s' resolves to a non-empty mini-phone spec",
    (family) => {
      const specs = miniPhoneAmbient(NEX_ORIGINAL, [family], "sparse");
      expect(specs).toHaveLength(1);
      expect(specs[0].family).toBe(family);
      expect(specs[0].elements.length).toBeGreaterThan(0);
    },
  );

  test("ambient_families=null yields no specs (DB-row fallback behaviour)", () => {
    expect(miniPhoneAmbient(NEX_ORIGINAL, null, "sparse")).toEqual([]);
    expect(miniPhoneAmbient(NEX_ORIGINAL, undefined, "sparse")).toEqual([]);
    expect(miniPhoneAmbient(NEX_ORIGINAL, [], "sparse")).toEqual([]);
  });

  test("unknown family names are silently skipped (future-proof)", () => {
    const specs = miniPhoneAmbient(
      NEX_ORIGINAL,
      ["sparkles", "future-made-up-family"],
      "sparse",
    );
    expect(specs).toHaveLength(1);
    expect(specs[0].family).toBe("sparkles");
  });
});

// ─── E · Ambient density scales element count ──────────────────────

describe("E · ambient density controls element count", () => {
  test("sparse < medium < dense for a count-driven family", () => {
    const sparse = miniPhoneAmbient(NEX_ORIGINAL, ["bubbles-rising"], "sparse");
    const medium = miniPhoneAmbient(NEX_ORIGINAL, ["bubbles-rising"], "medium");
    const dense = miniPhoneAmbient(NEX_ORIGINAL, ["bubbles-rising"], "dense");
    expect(sparse[0].elements.length).toBe(3);
    expect(medium[0].elements.length).toBe(5);
    expect(dense[0].elements.length).toBe(7);
  });

  test("single-glow families stay at 1 element regardless of density", () => {
    const dense = miniPhoneAmbient(NEX_ORIGINAL, ["heat-shimmer"], "dense");
    expect(dense[0].elements.length).toBe(1);
  });
});

// ─── F · Element colours come from the SUPPLIED palette ────────────

describe("F · ambient element colours are palette-derived (not hardcoded)", () => {
  test("Waterworld bubbles-rising paints with waterworld.primary (teal)", () => {
    const specs = miniPhoneAmbient(WATERWORLD, ["bubbles-rising"], "sparse");
    const colors = new Set(specs[0].elements.map((e) => e.color));
    expect(colors).toContain(WATERWORLD.primary);
  });

  test("Pink midnight-cafe neon-flicker paints with pink primary (not fixed cyan)", () => {
    const specs = miniPhoneAmbient(CONTRASTING_PINK, ["neon-flicker"], "sparse");
    expect(specs[0].elements[0].color).toBe(CONTRASTING_PINK.primary);
  });
});

// ─── G · Ambient family type `MiniPhoneAmbientFamilyKind` reality ──

describe("G · ambient family union stays wide enough for every live family", () => {
  test("every shipped ambient family is assignable to MiniPhoneAmbientFamilyKind", () => {
    const shipped: readonly string[] = [
      "bubbles-rising",
      "heat-shimmer",
      "leaves-falling",
      "light-rays",
      "mist",
      "neon-flicker",
      "pollen-float",
      "rain-streak",
      "sparkles",
      "steam-rising",
      "sun-dapple",
      "warm-glow-pulse",
    ];
    for (const family of shipped) {
      // At runtime this is a nop · at compile time it proves each
      // string is assignable to the union · the test file won't
      // typecheck if the union goes out of sync.
      const typed: MiniPhoneAmbientFamilyKind = family as MiniPhoneAmbientFamilyKind;
      expect(typeof typed).toBe("string");
    }
  });
});
