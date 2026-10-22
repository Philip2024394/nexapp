// src/app/nex-native/settings/__tests__/_family-safety-pilot-chip.test.ts
//
// Owner-authorised 2026-10-20 · verifies that the Family Safety hero
// tile at `src/app/nex-native/settings/page.tsx` renders a visible
// PILOT chip BEFORE the user taps in, so pilot status is not
// discovered only after landing on the destination page.
//
// Source-level regression anchor · no runtime render (there is no
// @testing-library/react in this repo at the time of writing).
// Reads page.tsx + the i18n registry + packs directly, asserts the
// gating + copy are honest.
//
// What this file guards:
//
//  1. The PILOT i18n keys exist in both the key registry and the two
//     translation packs (en + id).
//  2. The Family Safety tile declaration in page.tsx carries BOTH
//     pilotLabelKey + pilotAriaKey.
//  3. The HeroTileCard renderer emits the chip markup gated by both
//     keys (not just one), so a half-wired tile cannot ship.
//  4. The existing feature-flag gate is preserved: the tile is still
//     wrapped in `...(familyEnabled ? [...] : [])` so flipping the
//     flag to FALSE removes the tile entirely (chip and all).
//  5. The chip is positioned absolutely on the tile card itself (not
//     elsewhere) so it is visible before a tap.
//  6. The Emergency Help and Community tiles do NOT carry pilotLabelKey.
//     Phase A is scoped to Family Safety only.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { I18N_KEYS } from "@/lib/nex/i18n/keys";
import { EN_PACK } from "@/lib/nex/i18n/packs/en";
import { ID_PACK } from "@/lib/nex/i18n/packs/id";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const PAGE_PATH = path.join(REPO_ROOT, "src/app/nex-native/settings/page.tsx");
const PAGE_SRC = fs.readFileSync(PAGE_PATH, "utf8");

describe("A · i18n keys for Family Safety pilot chip exist", () => {
  test("key registry declares settings.hero.familySafePilot.label", () => {
    expect(I18N_KEYS).toContain("settings.hero.familySafePilot.label");
  });
  test("key registry declares settings.hero.familySafePilot.aria", () => {
    expect(I18N_KEYS).toContain("settings.hero.familySafePilot.aria");
  });
  test("EN pack has non-empty translation for the label key", () => {
    const label = EN_PACK["settings.hero.familySafePilot.label"];
    expect(typeof label).toBe("string");
    expect(label.trim().length).toBeGreaterThan(0);
    expect(label.toUpperCase()).toContain("PILOT");
  });
  test("EN pack has non-empty translation for the aria key", () => {
    const aria = EN_PACK["settings.hero.familySafePilot.aria"];
    expect(typeof aria).toBe("string");
    expect(aria.trim().length).toBeGreaterThan(0);
  });
  test("ID pack has non-empty translation for the label key", () => {
    const label = ID_PACK["settings.hero.familySafePilot.label"];
    expect(typeof label).toBe("string");
    expect(label.trim().length).toBeGreaterThan(0);
  });
  test("ID pack has non-empty translation for the aria key", () => {
    const aria = ID_PACK["settings.hero.familySafePilot.aria"];
    expect(typeof aria).toBe("string");
    expect(aria.trim().length).toBeGreaterThan(0);
  });
});

describe("B · settings/page.tsx wires the Family Safety tile with pilot keys", () => {
  test("Family Safety tile declaration carries pilotLabelKey", () => {
    // The tile is identified by its titleKey. We require that within
    // the same object literal, pilotLabelKey is also set.
    expect(PAGE_SRC).toMatch(
      /titleKey:\s*"settings\.hero\.familySafe"[\s\S]{0,400}?pilotLabelKey:\s*"settings\.hero\.familySafePilot\.label"/,
    );
  });
  test("Family Safety tile declaration carries pilotAriaKey", () => {
    expect(PAGE_SRC).toMatch(
      /titleKey:\s*"settings\.hero\.familySafe"[\s\S]{0,400}?pilotAriaKey:\s*"settings\.hero\.familySafePilot\.aria"/,
    );
  });
});

describe("C · HeroTileCard renderer emits the chip gated by both keys", () => {
  test("renderer guards on tile.pilotLabelKey AND tile.pilotAriaKey (not just one)", () => {
    // Guard expression must require BOTH keys so a half-wired tile
    // (label without aria, or vice versa) does NOT ship a chip.
    expect(PAGE_SRC).toMatch(
      /tile\.pilotLabelKey\s*&&\s*tile\.pilotAriaKey/,
    );
  });
  test("chip carries the sealed data attribute for test selection", () => {
    expect(PAGE_SRC).toContain("data-nex-settings-hero-tile-pilot=");
  });
  test("chip is positioned absolutely on the tile (visible before tap)", () => {
    // The chip's style block must set position: "absolute" within a
    // short distance of the sealed data-attribute marker · the chip
    // sits as a positioned child of the tile's <Link>.
    expect(PAGE_SRC).toMatch(
      /data-nex-settings-hero-tile-pilot=[\s\S]{0,400}?position:\s*"absolute"/,
    );
  });
});

describe("D · feature-flag gate is preserved (flipping the flag removes the tile)", () => {
  test("Family Safety tile remains inside the `familyEnabled ? [...] : []` wrapper", () => {
    expect(PAGE_SRC).toMatch(
      /familyEnabled[\s\S]{0,100}?\?\s*\[\s*\{[\s\S]{0,600}?titleKey:\s*"settings\.hero\.familySafe"/,
    );
  });
  test("isFamilySafetyEnabled is still called server-side (gate anchor)", () => {
    expect(PAGE_SRC).toContain("isFamilySafetyEnabled()");
  });
});

describe("E · scope · PILOT chip is applied to Family Safety only", () => {
  test("Emergency Help tile does NOT carry pilotLabelKey", () => {
    // Capture the Emergency Help tile object literal and assert the
    // chip property is absent inside its body.
    const match = PAGE_SRC.match(
      /\{\s*href:\s*"\/nex-native\/emergency-help",[\s\S]{0,400}?\}/,
    );
    expect(match).not.toBeNull();
    expect(match![0]).not.toContain("pilotLabelKey");
  });
  test("Community tile does NOT carry pilotLabelKey", () => {
    const match = PAGE_SRC.match(
      /\{\s*href:\s*"\/nex-native\/community",[\s\S]{0,400}?\}/,
    );
    expect(match).not.toBeNull();
    expect(match![0]).not.toContain("pilotLabelKey");
  });
});
