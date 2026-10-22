// src/lib/nex-native/vertical-presets/__tests__/presets.test.ts
//
// NEX Vertical Presets · pure-TS catalogue invariants.
// Phase A1 · owner-authorised 2026-10-20.
// -----------------------------------------------------------------------------
// These tests pin:
//   · All Phase A1 subtypes resolve to a preset.
//   · Every suggested chat-theme id in the catalogue exists in the
//     LIVE_WORLD_PACKAGES registry (so the pick-theme sorter never
//     references a dangling theme).
//   · Every suggestedCoverLayout exists in COVER_LAYOUT_IDS.
//   · getPreset is strict · unknown (category, subtype) → null, never
//     throws.
//   · Non-Phase-A1 categories return empty from listPresetsForCategory.
//
// NO network, NO DB · everything is static imports.

import { describe, expect, test } from "vitest";

import {
  ACCOMMODATION_PRESETS,
  HOMESTAY_PRESET,
  KOST_PRESET,
  VILLA_PRESET,
} from "../accommodation";
import {
  categoryHasPresets,
  getPreset,
  isVerticalCategory,
  isVerticalSubtype,
  listPresetsForCategory,
  VERTICAL_CATEGORIES,
  VERTICAL_SUBTYPES,
} from "../index";
import { LIVE_WORLD_IDS as LIVE_WORLD_ID_LIST } from "@/app/nex-native/chat-standard/_live-worlds";
import { COVER_LAYOUT_IDS } from "@/app/nex-native/cover/layout-ids";

const LIVE_WORLD_IDS: ReadonlySet<string> = new Set(LIVE_WORLD_ID_LIST);
const COVER_LAYOUT_SET: ReadonlySet<string> = new Set(COVER_LAYOUT_IDS);

describe("vertical-presets · Phase A1 catalogue invariants", () => {
  test("ACCOMMODATION_PRESETS contains Villa + Homestay + Kost", () => {
    expect(ACCOMMODATION_PRESETS).toHaveLength(3);
    expect(ACCOMMODATION_PRESETS).toContain(VILLA_PRESET);
    expect(ACCOMMODATION_PRESETS).toContain(HOMESTAY_PRESET);
    expect(ACCOMMODATION_PRESETS).toContain(KOST_PRESET);
  });

  test("every preset's suggested chat-theme ids exist in LIVE_WORLD_PACKAGES", () => {
    for (const p of ACCOMMODATION_PRESETS) {
      for (const themeId of p.suggestedChatThemes) {
        expect(
          LIVE_WORLD_IDS.has(themeId),
          `preset "${p.subtype}" references unknown chat theme id "${themeId}"`,
        ).toBe(true);
      }
    }
  });

  test("every preset's suggestedCoverLayout exists in COVER_LAYOUT_IDS", () => {
    for (const p of ACCOMMODATION_PRESETS) {
      expect(
        COVER_LAYOUT_SET.has(p.suggestedCoverLayout),
        `preset "${p.subtype}" references unknown cover layout "${p.suggestedCoverLayout}"`,
      ).toBe(true);
    }
  });

  test("all three accommodation presets map to the accommodation cover layout", () => {
    for (const p of ACCOMMODATION_PRESETS) {
      expect(p.suggestedCoverLayout).toBe("accommodation");
    }
  });

  test("every preset has exactly 3 demo rooms with positive IDR prices", () => {
    for (const p of ACCOMMODATION_PRESETS) {
      expect(p.demoRooms).toHaveLength(3);
      for (const r of p.demoRooms) {
        expect(typeof r.nameId).toBe("string");
        expect(typeof r.nameEn).toBe("string");
        expect(r.nameId.length).toBeGreaterThan(0);
        expect(r.nameEn.length).toBeGreaterThan(0);
        expect(r.priceIdr).toBeGreaterThan(0);
      }
    }
  });

  test("every preset has at least one amenity in Bahasa Indonesia", () => {
    for (const p of ACCOMMODATION_PRESETS) {
      expect(p.amenities.length).toBeGreaterThan(0);
    }
  });
});

describe("vertical-presets · getPreset strict lookup", () => {
  test("resolves known Phase A1 pairs", () => {
    expect(getPreset("accommodation", "villa")).toBe(VILLA_PRESET);
    expect(getPreset("accommodation", "homestay")).toBe(HOMESTAY_PRESET);
    expect(getPreset("accommodation", "kost")).toBe(KOST_PRESET);
  });

  test("returns null for unknown subtype under a known category", () => {
    // "hotel" is a valid NEX BusinessSubtype but has no Phase A1 preset.
    expect(getPreset("accommodation", "hotel")).toBeNull();
  });

  test("returns null for unknown category", () => {
    expect(getPreset("bogus", "villa")).toBeNull();
  });

  test("returns null for mismatched (category, subtype) pair", () => {
    expect(getPreset("food", "villa")).toBeNull();
    expect(getPreset("services", "kost")).toBeNull();
  });

  test("returns null for null/undefined/empty inputs", () => {
    expect(getPreset(null, "villa")).toBeNull();
    expect(getPreset("accommodation", null)).toBeNull();
    expect(getPreset(undefined, undefined)).toBeNull();
    expect(getPreset("", "")).toBeNull();
  });
});

describe("vertical-presets · guards", () => {
  test("isVerticalCategory accepts the sealed category tokens only", () => {
    for (const c of VERTICAL_CATEGORIES) expect(isVerticalCategory(c)).toBe(true);
    expect(isVerticalCategory("bogus")).toBe(false);
    expect(isVerticalCategory(null)).toBe(false);
    expect(isVerticalCategory(undefined)).toBe(false);
  });

  test("isVerticalSubtype accepts the sealed subtype tokens only", () => {
    for (const s of VERTICAL_SUBTYPES) expect(isVerticalSubtype(s)).toBe(true);
    expect(isVerticalSubtype("bogus")).toBe(false);
    expect(isVerticalSubtype(null)).toBe(false);
    expect(isVerticalSubtype(undefined)).toBe(false);
  });
});

describe("vertical-presets · category completeness", () => {
  test("categoryHasPresets returns true only for accommodation in Phase A1", () => {
    expect(categoryHasPresets("accommodation")).toBe(true);
    expect(categoryHasPresets("services")).toBe(false);
    expect(categoryHasPresets("food")).toBe(false);
    expect(categoryHasPresets("products")).toBe(false);
    expect(categoryHasPresets("affiliate")).toBe(false);
    expect(categoryHasPresets("personal")).toBe(false);
  });

  test("listPresetsForCategory returns 3 for accommodation and 0 otherwise", () => {
    expect(listPresetsForCategory("accommodation")).toHaveLength(3);
    expect(listPresetsForCategory("services")).toHaveLength(0);
    expect(listPresetsForCategory("food")).toHaveLength(0);
    expect(listPresetsForCategory("products")).toHaveLength(0);
  });
});
