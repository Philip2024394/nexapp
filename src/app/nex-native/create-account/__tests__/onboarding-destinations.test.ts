// src/app/nex-native/create-account/__tests__/onboarding-destinations.test.ts
//
// NEX · S3 · post-signup destination map tests.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Pin every destination the redirect chain depends on, and verify
// the intent-aware helper routes the three sealed intent values +
// null + tampered values correctly:
//
//   T3.1 · shop intent → PICK_COVER
//   T3.2 · themes intent → WELCOME_LANDING (unchanged)
//   T3.3 · personalised intent → WELCOME_LANDING (unchanged)
//   T3.4 · null intent → WELCOME_LANDING (consumer default)
//   T3.5 · post-cover pick ALWAYS routes to BUILDING
//   T3.6 · the three destination constants are exactly the sealed URLs
//          (regression guard against drift)

import { describe, test, expect } from "vitest";
import {
  WELCOME_LANDING,
  PICK_COVER,
  BUILDING,
  postThemePickDestination,
  postCoverPickDestination,
} from "../_onboarding-destinations";
import { WELCOME_INTENT_TOKENS } from "../../welcome/_welcome-intent";

describe("post-theme-pick destination", () => {
  test("T3.1 · shop intent routes to the Face Cover picker", () => {
    expect(postThemePickDestination("shop")).toBe(PICK_COVER);
  });

  test("T3.2 · themes intent preserves the sealed Add-to-Home-Screen landing", () => {
    expect(postThemePickDestination("themes")).toBe(WELCOME_LANDING);
  });

  test("T3.3 · personalised intent preserves the sealed Add-to-Home-Screen landing", () => {
    expect(postThemePickDestination("personalised")).toBe(WELCOME_LANDING);
  });

  test("T3.4 · null intent (consumer / no welcome card tapped) defaults to welcome", () => {
    expect(postThemePickDestination(null)).toBe(WELCOME_LANDING);
  });

  test("T3 regression · every sealed intent token except 'shop' lands on welcome", () => {
    for (const token of WELCOME_INTENT_TOKENS) {
      if (token === "shop") continue;
      expect(postThemePickDestination(token)).toBe(WELCOME_LANDING);
    }
  });
});

describe("post-cover-pick destination", () => {
  test("T3.5 · always routes to the Building step", () => {
    expect(postCoverPickDestination()).toBe(BUILDING);
  });
});

describe("destination constants", () => {
  test("T3.6 · sealed URLs · regression guard against drift", () => {
    expect(WELCOME_LANDING).toBe("/nex-native/create-account/welcome");
    expect(PICK_COVER).toBe("/nex-native/create-account/pick-cover");
    expect(BUILDING).toBe("/nex-native/create-account/building");
  });

  test("T3.6b · constants are same-origin absolute paths · open-redirect guard", () => {
    for (const dest of [WELCOME_LANDING, PICK_COVER, BUILDING]) {
      expect(dest.startsWith("/nex-native/")).toBe(true);
      expect(dest.includes("//")).toBe(false);
      expect(dest.includes(":")).toBe(false);
    }
  });
});
