// src/app/nex-native/directory/[id]/__tests__/area-information-placement.test.ts
//
// PERMANENT REQUIREMENT · DO NOT WEAKEN (2026-10-13).
//
// Enforces the sealed contract from docs/doctrine/area-information-doctrine.md:
//
//   Every business-detail LocationSection on /nex-native/directory/[id]
//   MUST render the DiscoverThisArea area-context panel directly below
//   the km-away distance chip. The mount site MUST be inside
//   LocationSection, NOT at page-level, and MUST follow the distance
//   chip in source order.
//
// Why this test is static (string-match on the page source) and not
// a rendered DOM test: the page is a server component that reads
// from the live DB. Standing up a full RSC render in a unit test
// requires mocking too many layers. The static check is coarser but
// catches every documented regression mode in a single assertion.
//
// If this test fails, do NOT delete it or weaken the regex. Instead,
// move the DiscoverThisArea mount back under the DetailDistanceChip
// inside LocationSection. See the companion comment at
// src/app/nex-native/directory/[id]/page.tsx (search for
// "PERMANENT REQUIREMENT").

import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PAGE_PATH = path.resolve(
  __dirname,
  "..",
  "page.tsx",
);

const SOURCE = readFileSync(PAGE_PATH, "utf8");

describe("Area-information placement doctrine", () => {
  test("LocationSection renders DiscoverThisArea in its tree", () => {
    // Find the opening of LocationSection and its closing brace.
    const openMatch = SOURCE.match(
      /function LocationSection\(props: \{[\s\S]*?\): React\.ReactElement \| null \{/,
    );
    expect(openMatch, "LocationSection declaration must exist").not.toBeNull();
    const openIdx = openMatch!.index! + openMatch![0].length;
    // Brace-walk to find the function's closing `}`.
    let depth = 1;
    let i = openIdx;
    while (i < SOURCE.length && depth > 0) {
      const c = SOURCE[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }
    const locationBody = SOURCE.slice(openIdx, i);
    expect(
      locationBody,
      "LocationSection body MUST render <DiscoverThisArea intel={...}> · see docs/doctrine/area-information-doctrine.md",
    ).toMatch(/<DiscoverThisArea\s+intel=\{[^}]+\}\s*\/?>/);
  });

  test("DiscoverThisArea renders AFTER DetailDistanceChip in LocationSection source order", () => {
    const openMatch = SOURCE.match(
      /function LocationSection\(props: \{[\s\S]*?\): React\.ReactElement \| null \{/,
    );
    const openIdx = openMatch!.index! + openMatch![0].length;
    let depth = 1;
    let i = openIdx;
    while (i < SOURCE.length && depth > 0) {
      if (SOURCE[i] === "{") depth++;
      else if (SOURCE[i] === "}") depth--;
      i++;
    }
    const locationBody = SOURCE.slice(openIdx, i);
    const distanceIdx = locationBody.indexOf("<DetailDistanceChip");
    const discoverIdx = locationBody.indexOf("<DiscoverThisArea");
    expect(distanceIdx, "LocationSection MUST render DetailDistanceChip").toBeGreaterThanOrEqual(0);
    expect(discoverIdx, "LocationSection MUST render DiscoverThisArea").toBeGreaterThanOrEqual(0);
    expect(
      discoverIdx,
      "DiscoverThisArea MUST render AFTER DetailDistanceChip (immediately below the km-away chip). " +
        "See docs/doctrine/area-information-doctrine.md.",
    ).toBeGreaterThan(distanceIdx);
  });

  test("DiscoverThisArea is NOT also mounted at page-level (no duplicate)", () => {
    // Find the DirectoryDetailPage component body.
    const openMatch = SOURCE.match(
      /function DirectoryDetailPage\([\s\S]*?\): React\.ReactElement \| Promise<React\.ReactElement> \{/,
    );
    if (openMatch === null) {
      // Alternative signature.
      const altMatch = SOURCE.match(
        /export default async function DirectoryDetailPage\([\s\S]*?\{/,
      );
      expect(altMatch, "DirectoryDetailPage declaration must exist").not.toBeNull();
    }
    // Count total DiscoverThisArea mounts in the whole file. The
    // doctrine demands EXACTLY one · inside LocationSection.
    const occurrences = SOURCE.match(/<DiscoverThisArea[\s>]/g) ?? [];
    expect(
      occurrences.length,
      "Exactly one <DiscoverThisArea /> mount is permitted and it must be inside LocationSection. " +
        "Zero means the panel is missing · more than one means a page-level duplicate was re-added. " +
        "See docs/doctrine/area-information-doctrine.md.",
    ).toBe(1);
  });

  test("LocationSection accepts areaIntel: AreaIntelligence | null prop", () => {
    const sigMatch = SOURCE.match(
      /function LocationSection\(props: \{([\s\S]*?)\}\): React\.ReactElement \| null \{/,
    );
    expect(sigMatch, "LocationSection signature must exist").not.toBeNull();
    const signature = sigMatch![1];
    expect(
      signature,
      "LocationSection MUST accept `areaIntel: AreaIntelligence | null` prop so the page can thread area intel into the location card.",
    ).toMatch(/areaIntel\s*:\s*AreaIntelligence\s*\|\s*null/);
  });
});
