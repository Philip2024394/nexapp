// src/app/nex-native/chat-themes-library/_preview-visual-parity.test.ts
//
// Preview Visual Parity · regression test · sealed 2026-10-11.
// -----------------------------------------------------------
// Guards the "every theme preview must represent the live chat exactly"
// contract the founder sealed 2026-10-11. The three preview surfaces
// (category grid phone, gallery phone tile, immersive full-screen
// preview) all paint a scaled-down version of the Standard Experience
// chat shell. Before this seal each surface duplicated the pixel-level
// formulas independently and drifted:
//
//   · `_phone-tile.tsx` hardcoded cyan/navy bubble glass for every theme
//   · `_preview-shell.tsx` hardcoded the same cyan/navy glass
//   · `_category-grid.tsx` hardcoded a NEX-pink avatar border + a NEX-
//     orange send-button gradient on every theme
//
// This test guards that NONE of those chrome literals leak back into the
// three preview surfaces in theme-sensitive positions. The shared
// treatment module `preview-mini-phone.ts` is the single source of
// truth · every preview must consume it rather than inlining formulas.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const PREVIEW_SURFACES = [
  "src/app/nex-native/chat-themes-library/_phone-tile.tsx",
  "src/app/nex-native/chat-themes-library/_preview-shell.tsx",
  "src/app/nex-native/chat-themes-library/_category-grid.tsx",
];
const SHARED_TREATMENT =
  "src/app/nex-native/chat-standard/_engine/preview-mini-phone.ts";

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

// ─── A · the shared module exists and exports the sealed helpers ──

describe("A · the shared mini-phone treatment is the single source of truth", () => {
  const src = readSource(SHARED_TREATMENT);

  test("preview-mini-phone.ts exists", () => {
    expect(src.length).toBeGreaterThan(0);
  });

  test.each([
    ["MiniPhonePalette", /export (interface|type) MiniPhonePalette\b/],
    ["NEX_DEFAULT_PALETTE", /export const NEX_DEFAULT_PALETTE\b/],
    ["inferPaletteFromRow", /export function inferPaletteFromRow\b/],
    ["miniPhoneBubbleBackground", /export function miniPhoneBubbleBackground\b/],
    ["miniPhoneSendBackground", /export function miniPhoneSendBackground\b/],
    ["miniPhoneAvatarBorder", /export function miniPhoneAvatarBorder\b/],
    ["miniPhoneHeaderCluster", /export function miniPhoneHeaderCluster\b/],
    ["hexToRgba", /export function hexToRgba\b/],
  ])("exports the sealed helper `%s`", (_name, pattern) => {
    expect(src).toMatch(pattern);
  });
});

// ─── B · every preview surface consumes the shared module ─────────

describe("B · every preview surface imports from preview-mini-phone.ts", () => {
  test.each(PREVIEW_SURFACES)(
    "%s imports from the shared mini-phone treatment",
    (filePath) => {
      const src = readSource(filePath);
      // Each surface must import at least one helper from the shared
      // module. Not all surfaces need every helper · the regression
      // only guards that none of them re-invent the formulas.
      expect(
        src,
        `${filePath} must consume preview-mini-phone.ts rather than inline chrome formulas`,
      ).toMatch(/chat-standard\/_engine\/preview-mini-phone/);
    },
  );
});

// ─── C · no hardcoded NEX chrome in theme-sensitive bubble positions ─

describe("C · no hardcoded cyan/navy bubble glass in preview surfaces", () => {
  const CYAN_GLASS = /rgba\(0\s*,\s*159\s*,\s*239\s*,\s*0\.26\)/;
  const NAVY_GLASS = /rgba\(30\s*,\s*44\s*,\s*66\s*,\s*0\.72\)/;

  test.each(PREVIEW_SURFACES)(
    "%s does NOT inline the cyan `rgba(0,159,239,0.26)` glass literal",
    (filePath) => {
      const src = readSource(filePath);
      expect(
        src,
        `${filePath} must derive mine-bubble glass via miniPhoneBubbleBackground`,
      ).not.toMatch(CYAN_GLASS);
    },
  );

  test.each(PREVIEW_SURFACES)(
    "%s does NOT inline the navy `rgba(30,44,66,0.72)` glass literal",
    (filePath) => {
      const src = readSource(filePath);
      expect(
        src,
        `${filePath} must derive peer-bubble glass via miniPhoneBubbleBackground`,
      ).not.toMatch(NAVY_GLASS);
    },
  );
});

// ─── D · no hardcoded NEX pink avatar / orange send gradient ───────

describe("D · no NEX chrome hexes leak into theme-sensitive positions", () => {
  // Literals that previously overrode a theme's own palette on
  // bubbles, composer send button, or avatar presence rim. The
  // universal NEX chrome affordances (FREE trial badge, lock badge)
  // are intentionally orange on every theme — they signal the free
  // tier, not a theme identity — so they are excluded from this list.
  const FORBIDDEN = [
    { pattern: /#FF3F9F/i, label: "NEX pink avatar presence #FF3F9F" },
    {
      pattern: /linear-gradient\([^)]*#FF9033[^)]*#FF7800/i,
      label: "NEX orange send-button gradient (#FF9033 → #FF7800)",
    },
    {
      pattern: /rgba\(255\s*,\s*63\s*,\s*159/,
      label: "NEX pink rgba (presence tint)",
    },
    {
      pattern: /rgba\(255\s*,\s*120\s*,\s*0\s*,\s*0\.4\)/,
      label: "NEX orange rgba(255,120,0,0.4) shadow (send-button halo)",
    },
  ] as const;

  for (const filePath of PREVIEW_SURFACES) {
    for (const { pattern, label } of FORBIDDEN) {
      test(`${filePath} does NOT contain ${label}`, () => {
        const src = readSource(filePath);
        expect(
          src,
          `${filePath} must consume palette-derived values · never ${label}`,
        ).not.toMatch(pattern);
      });
    }
  }
});

// ─── E · BrowserThemeRow carries the full palette ──────────────────

describe("E · BrowserThemeRow carries the full MiniPhonePalette", () => {
  const BROWSER_CLIENT = readSource(
    "src/app/nex-native/chat-themes-library/_theme-browser-client.tsx",
  );

  test("`palette` field is declared on BrowserThemeRow", () => {
    // Match the type-level declaration explicitly so a future PR can't
    // weaken it to optional without this test failing.
    expect(BROWSER_CLIENT).toMatch(/palette:\s*MiniPhonePalette/);
  });

  test("MiniPhonePalette is imported from the shared treatment module", () => {
    expect(BROWSER_CLIENT).toMatch(
      /from\s+"\.\.\/chat-standard\/_engine\/preview-mini-phone"/,
    );
  });
});

// ─── F · the two loaders populate `palette` ────────────────────────

describe("F · both loaders populate `palette` on every row", () => {
  const SESSION_LOADER = readSource(
    "src/app/nex-native/chat-themes-library/_load-library-data.ts",
  );
  const GUEST_LOADER = readSource(
    "src/app/nex-native/chat-themes-library/_load-library-data-guest.ts",
  );
  const ADAPTER = readSource(
    "src/app/nex-native/chat-themes-library/_live-worlds-adapter.ts",
  );

  test("session loader calls inferPaletteFromRow on each DB row", () => {
    expect(SESSION_LOADER).toMatch(/inferPaletteFromRow\(/);
  });

  test("guest loader calls inferPaletteFromRow on each DB row", () => {
    expect(GUEST_LOADER).toMatch(/inferPaletteFromRow\(/);
  });

  test("live-world adapter builds a palette from pkg.colours", () => {
    expect(ADAPTER).toMatch(/palette:\s*paletteFromPackageColours/);
  });
});
