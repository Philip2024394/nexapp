// src/components/nex-native/control-drawer/__tests__/emergency-row.test.ts
//
// Owner-authorised 2026-10-20 · verifies the dark-red Emergency Help
// row rendered at the top of the control drawer body.
//
// Source-level regression anchor (no runtime render · no @testing-
// library/react in this repo at the time of writing). Reads the
// drawer source and asserts the sealed shape.
//
// What this file guards:
//
//  1. The drawer defines an EmergencyHelpRow component.
//  2. The row routes to the sealed /nex-native/emergency-help page.
//  3. The row uses the dark-red colour token (NOT the bright DANGER).
//  4. The row is rendered inside DrawerBody BEFORE the first
//     SectionGroup · so it reads as a top-level CTA, not a buried
//     menu row.
//  5. The row is visible to BOTH signed-in and guest viewers · no
//     account-gate / lock icon wraps it (safety access).
//  6. The row carries the sealed data-attribute used by any future
//     Playwright/visual test to select it reliably.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const DRAWER_PATH = path.resolve(
  __dirname,
  "../control-drawer-client.tsx",
);
const DRAWER_SRC = fs.readFileSync(DRAWER_PATH, "utf8");

describe("A · EmergencyHelpRow exists and routes to the sealed destination", () => {
  test("component definition is present", () => {
    expect(DRAWER_SRC).toMatch(/function\s+EmergencyHelpRow\s*\(/);
  });
  test("row routes to /nex-native/emergency-help", () => {
    expect(DRAWER_SRC).toMatch(
      /<Link[\s\S]{0,200}?href="\/nex-native\/emergency-help"/,
    );
  });
  test("row carries the sealed data-nex-control-drawer-emergency attribute", () => {
    expect(DRAWER_SRC).toContain("data-nex-control-drawer-emergency");
  });
});

describe("B · the row uses dark red (not the bright DANGER token)", () => {
  test("EMERGENCY_DARK_RED constant is declared with #8B0000", () => {
    expect(DRAWER_SRC).toMatch(
      /const\s+EMERGENCY_DARK_RED\s*=\s*"#8B0000"/,
    );
  });
  test("emergencyRowStyle uses the EMERGENCY_DARK_RED token for background", () => {
    const match = DRAWER_SRC.match(
      /emergencyRowStyle[\s\S]{0,500}?background:\s*EMERGENCY_DARK_RED/,
    );
    expect(match).not.toBeNull();
  });
  test("emergencyRowStyle does NOT accidentally use the bright DANGER token", () => {
    const match = DRAWER_SRC.match(
      /emergencyRowStyle[\s\S]{0,500}?\}/,
    );
    expect(match).not.toBeNull();
    expect(match![0]).not.toMatch(/background:\s*DANGER\b/);
  });
});

describe("C · placement · row is above the first SectionGroup in DrawerBody", () => {
  test("DrawerBody mounts <EmergencyHelpRow /> before the YOUR NEX SectionGroup", () => {
    // Both the row and the first SectionGroup must appear inside the
    // DrawerBody function body. The emergency row index must be
    // less than the YOUR NEX SectionGroup index.
    const emergencyIdx = DRAWER_SRC.indexOf("<EmergencyHelpRow />");
    const yourNexIdx = DRAWER_SRC.indexOf('title="YOUR NEX"');
    expect(emergencyIdx).toBeGreaterThan(0);
    expect(yourNexIdx).toBeGreaterThan(0);
    expect(emergencyIdx).toBeLessThan(yourNexIdx);
  });
});

describe("D · the row is NOT behind an account gate (safety access)", () => {
  test("the EmergencyHelpRow definition does not wrap the href in signInWithReturn()", () => {
    // Slice from the EmergencyHelpRow function declaration up to the
    // start of the next top-level function (EmergencyBellIcon).
    const start = DRAWER_SRC.indexOf("function EmergencyHelpRow");
    const end = DRAWER_SRC.indexOf("function EmergencyBellIcon");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const bodyRegion = DRAWER_SRC.slice(start, end);
    expect(bodyRegion).not.toContain("signInWithReturn");
    expect(bodyRegion).not.toContain("LockedSettingsIcon");
  });
});

describe("E · subtitle is honest about simulated / pilot status", () => {
  test("subtitle text reads 'Simulated · pilot'", () => {
    // The destination page's own banner is the authoritative pilot
    // disclosure; this subtitle just previews it on the row so a
    // user does not tap a bright-red CTA expecting a live alert.
    expect(DRAWER_SRC).toMatch(/Simulated\s+·\s+pilot/);
  });
});
