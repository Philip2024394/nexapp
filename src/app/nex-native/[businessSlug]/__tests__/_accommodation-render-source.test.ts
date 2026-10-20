// src/app/nex-native/[businessSlug]/__tests__/_accommodation-render-source.test.ts
//
// Phase A1 · Source-anchor regression test for the accommodation
// customer-render path + the sealed R8 four-condition gate.
// Owner-authorised 2026-10-21.
//
// This file does NOT render the page (no runtime). It verifies the
// SOURCE anchors that must stay in place after the accommodation
// backend wiring: (a) the sealed R8 four-condition regex still
// matches (new fifth-condition suffix lives AFTER the sealed anchor),
// (b) real rooms render in a dedicated section with the correct
// data attributes, (c) owner-only "Manage listing" link appears
// per room when `isOwnerViewing` is true.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGE_PATH = path.resolve(__dirname, "../page.tsx");
const PAGE_SRC = fs.readFileSync(PAGE_PATH, "utf8");

describe("A · sealed R8 four-condition anchor stays intact", () => {
  test("regex matches the sealed four-condition chain in order", () => {
    // Same regex as `demo-room-owner-gate-behaviour.test.tsx` ·
    // adding Track B accommodation render MUST NOT break this.
    expect(PAGE_SRC).toMatch(
      /!isMenuVertical\s*&&[\s\S]{0,120}?isOwnerViewing\s*&&[\s\S]{0,120}?products\.length\s*===\s*0\s*&&[\s\S]{0,200}?hasDemoRoomDesignsForSubtype/,
    );
  });

  test("DemoRoomDesigns + hasDemoRoomDesignsForSubtype imports still present", () => {
    expect(PAGE_SRC).toContain("DemoRoomDesigns");
    expect(PAGE_SRC).toContain("hasDemoRoomDesignsForSubtype");
  });
});

describe("B · fifth-condition suffix suppresses demo when real rooms exist", () => {
  test("the gate carries `&& accommodationRooms.length === 0` AFTER hasDemoRoomDesignsForSubtype", () => {
    // The suffix lives AFTER the sealed four-condition anchor so
    // the regex above still matches. The suffix prevents demo-room
    // leakage when real rooms exist for the owner.
    expect(PAGE_SRC).toMatch(
      /hasDemoRoomDesignsForSubtype\([\s\S]{0,500}?\)\s*&&[\s\S]{0,100}?accommodationRooms\.length\s*===\s*0/,
    );
  });
});

describe("C · real accommodation rooms section", () => {
  test("imports accommodation-service", () => {
    expect(PAGE_SRC).toMatch(
      /import\s+\*\s+as\s+accommodationService\s+from\s+"@\/lib\/nex-native\/accommodation-service"/,
    );
  });

  test("fetches live+available rooms with safe-fail catch", () => {
    expect(PAGE_SRC).toMatch(
      /accommodationService\s*[\s\S]{0,50}?\.listLiveAvailableRoomsByBusiness\(business\.id\)[\s\S]{0,200}?\.catch/,
    );
  });

  test("renders a Rooms section when accommodationRooms.length > 0", () => {
    expect(PAGE_SRC).toContain(
      'data-nex-accommodation-rooms-section="true"',
    );
    expect(PAGE_SRC).toMatch(
      /\{accommodationRooms\.length\s*>\s*0\s*&&\s*\(/,
    );
  });

  test("each room card carries its id in a data attribute", () => {
    expect(PAGE_SRC).toContain("data-nex-accommodation-room-card={room.id}");
  });

  test("each room card renders the honest enquire link to the chat href", () => {
    expect(PAGE_SRC).toContain(
      "data-nex-accommodation-room-enquire={room.id}",
    );
    // The enquire link must route to chatHref (the sealed per-business
    // chat path) · never to a payment or booking confirmation URL.
    expect(PAGE_SRC).toMatch(
      /data-nex-accommodation-room-enquire=\{room\.id\}[\s\S]{0,500}?href=\{chatHref\}/,
    );
  });
});

describe("D · owner-only 'Manage listing' link per room", () => {
  test("rendered only when isOwnerViewing is true", () => {
    expect(PAGE_SRC).toMatch(
      /\{isOwnerViewing\s*&&\s*\(\s*<Link[\s\S]{0,400}?data-nex-accommodation-room-manage=\{room\.id\}/,
    );
  });

  test("link routes to /nex-native/manage/accommodation/<id>", () => {
    expect(PAGE_SRC).toContain(
      "href={`/nex-native/manage/accommodation/${room.id}`}",
    );
  });
});

describe("E · doctrine · no payment or booking-confirmation claims", () => {
  // Strip JS/TS comments so our regex doesn't match our OWN doctrine
  // comments (which legitimately say phrases like "no booking
  // confirmation claim here"). We check the executable + JSX
  // content only · never comments.
  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments
      .replace(/^[ \t]*\/\/.*$/gm, " ") // line comments
      .replace(/[ \t]+\/\/.*$/gm, " "); // trailing line comments
  }

  test("accommodation render section does NOT contain payment / booking copy in executable code", () => {
    const sectionMatch = PAGE_SRC.match(
      /data-nex-accommodation-rooms-section="true"[\s\S]{0,8000}?<\/section>/,
    );
    expect(sectionMatch).not.toBeNull();
    const section = stripComments(sectionMatch![0]);
    expect(section).not.toMatch(/book(ing|ed)/i);
    expect(section).not.toMatch(/confirm(ed|ation)/i);
    expect(section).not.toMatch(/pay now/i);
    expect(section).not.toMatch(/checkout/i);
    expect(section).not.toMatch(/credit card/i);
    expect(section).not.toMatch(/stripe/i);
  });

  test("the honest enquire label mentions 'Enquire about'", () => {
    expect(PAGE_SRC).toMatch(/Enquire about \{room\.name\}/);
  });
});
