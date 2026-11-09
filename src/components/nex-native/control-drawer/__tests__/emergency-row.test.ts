// src/components/nex-native/control-drawer/__tests__/emergency-row.test.ts
//
// Owner directive 2026-11-09 · Emergency Help row REMOVED from the
// drawer. This test was originally sealed 2026-10-20 to guard the
// row's presence + shape. It is now sealed in the OPPOSITE direction
// to guard the row's ABSENCE from the drawer.
//
// Rationale:
// Deleting the test file would weaken the regression story · future
// contributors wouldn't see a record of why the drawer no longer
// has an Emergency Help row. Keeping the file + flipping the
// assertions preserves the audit trail and prevents a silent
// re-introduction of the row.
//
// Where did the Emergency Help UX move? See:
//   · src/app/nex-native/page.tsx (splash page · hosts the UX)
//   · src/app/nex-native/_splash-client.tsx (splash timer + activation
//     routing)
//   · src/app/nex-native/_splash-emergency-ui-client.tsx (round HELP
//     button · countdown overlay · Enter-NEX button for activated
//     users)
//   · src/app/nex-native/emergency-help/page.tsx (tel: + SMS flow)
//
// What this file now guards:
//
//  1. The drawer source does NOT define an EmergencyHelpRow component.
//  2. The drawer source does NOT mount <EmergencyHelpRow /> in
//     DrawerBody.
//  3. The drawer source does NOT import hasActivatedEmergency.
//  4. The drawer source does NOT retain the old EMERGENCY_DARK_RED
//     constant (would indicate a partial-removal regression).
//  5. The drawer source does NOT retain the sealed
//     data-nex-control-drawer-emergency attribute.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const DRAWER_PATH = path.resolve(
  __dirname,
  "../control-drawer-client.tsx",
);
const DRAWER_SRC = fs.readFileSync(DRAWER_PATH, "utf8");

describe("A · EmergencyHelpRow is removed from the drawer", () => {
  test("no EmergencyHelpRow function declaration", () => {
    expect(DRAWER_SRC).not.toMatch(/function\s+EmergencyHelpRow\s*\(/);
  });

  test("no <EmergencyHelpRow /> JSX usage", () => {
    expect(DRAWER_SRC).not.toContain("<EmergencyHelpRow />");
    expect(DRAWER_SRC).not.toContain("<EmergencyHelpRow/>");
  });

  test("no hasActivatedEmergency import in the drawer bundle", () => {
    expect(DRAWER_SRC).not.toMatch(
      /from\s+["']@\/lib\/nex-native\/emergency\/emergency-activation["']/,
    );
  });
});

describe("B · dark-red tokens retired from the drawer", () => {
  test("EMERGENCY_DARK_RED constant removed", () => {
    expect(DRAWER_SRC).not.toMatch(/const\s+EMERGENCY_DARK_RED\s*=/);
    expect(DRAWER_SRC).not.toMatch(/const\s+EMERGENCY_DARK_RED_RING\s*=/);
  });

  test("emergencyRowStyle / emergencyIconStyle etc removed", () => {
    expect(DRAWER_SRC).not.toMatch(/const\s+emergencyRowStyle\s*:/);
    expect(DRAWER_SRC).not.toMatch(/const\s+emergencyIconStyle\s*:/);
    expect(DRAWER_SRC).not.toMatch(/const\s+emergencyLabelStyle\s*:/);
    expect(DRAWER_SRC).not.toMatch(/const\s+emergencySubtitleStyle\s*:/);
  });
});

describe("C · sealed data attribute no longer sits on the drawer", () => {
  test("data-nex-control-drawer-emergency not present in drawer source", () => {
    expect(DRAWER_SRC).not.toContain("data-nex-control-drawer-emergency");
  });
});

describe("D · forwarding comment is present (helps future readers)", () => {
  test("drawer source references the splash page as the new emergency UX home", () => {
    // The removal comment should mention 2026-11-09 and point readers
    // to the splash file so investigators don't think the drawer was
    // partially broken.
    expect(DRAWER_SRC).toMatch(/2026-11-09/);
    expect(DRAWER_SRC).toMatch(/splash/i);
  });
});
