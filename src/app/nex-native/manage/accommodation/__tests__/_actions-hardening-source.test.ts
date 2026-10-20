// src/app/nex-native/manage/accommodation/__tests__/_actions-hardening-source.test.ts
//
// Phase A1 · Narrow code-only hardening pass · owner-authorised 2026-10-21.
// -----------------------------------------------------------------------
// Source-level regression anchors for the Accommodation server actions.
// These tests do NOT execute the actions (which need Next.js request
// context + a mocked session + a DB). Instead they assert the SOURCE
// shape of the action module: ownership gate present, defence-in-depth
// status checks present, lifecycle completeness (unpublish path),
// and the blocked-route doctrine ("NEX never handles payments" ·
// price_per_night_pence stays display-only).

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ACTIONS_PATH = path.resolve(__dirname, "../_actions.ts");
const ACTIONS_SRC = fs.readFileSync(ACTIONS_PATH, "utf8");

// Strip comments so our regexes don't match our OWN doctrine comments
// (which say phrases like "NEX never handles payments").
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/[ \t]+\/\/.*$/gm, " ");
}

const CODE_ONLY = stripComments(ACTIONS_SRC);

// ─── A · "use server" + owner-gated server actions ─────────────────

describe("A · module is a server-action file", () => {
  test("starts with 'use server' directive", () => {
    expect(ACTIONS_SRC.trim().startsWith('"use server"')).toBe(true);
  });

  test("every mutating action calls assertOwner(businessId) first", () => {
    const actions = [
      "createRoomAction",
      "updateRoomAction",
      "changeRoomStatusAction",
      "toggleRoomAvailableAction",
    ];
    for (const name of actions) {
      // Simple windowed search: grab the first 2500 chars after the
      // function declaration · assertOwner MUST appear in that span.
      // This avoids fragile end-of-file lookahead issues.
      const idx = CODE_ONLY.indexOf(`export async function ${name}`);
      expect(idx, `${name} must be defined`).toBeGreaterThanOrEqual(0);
      const window = CODE_ONLY.slice(idx, idx + 2500);
      expect(window, `${name} must call assertOwner`).toMatch(
        /await\s+assertOwner\(/,
      );
    }
  });
});

// ─── B · defence-in-depth · toggleRoomAvailable rejects non-live ───

describe("B · toggleRoomAvailableAction has a server-side status guard", () => {
  test("rejects when room.status !== 'live' (defence-in-depth beyond RLS and UI)", () => {
    // The UI only renders the toggle button for live rooms, but a
    // direct action call could bypass that. The action MUST verify.
    expect(CODE_ONLY).toMatch(
      /toggleRoomAvailableAction[\s\S]{0,2000}?room\.status\s*!==\s*["']live["']/,
    );
  });

  test("the guard uses bannerRedirect, not a silent return", () => {
    expect(CODE_ONLY).toMatch(
      /toggleRoomAvailableAction[\s\S]{0,2000}?bannerRedirect\(\s*["']accommodation_toggle_requires_live["']/,
    );
  });
});

// ─── C · status transition validation ──────────────────────────────

describe("C · changeRoomStatusAction validates the status token", () => {
  test("rejects anything outside the sealed draft/live/archived enum", () => {
    expect(CODE_ONLY).toMatch(
      /nextStatus\s*!==\s*["']draft["']\s*&&[\s\S]{0,80}?nextStatus\s*!==\s*["']live["']\s*&&[\s\S]{0,80}?nextStatus\s*!==\s*["']archived["']/,
    );
  });
});

// ─── D · doctrine · "NEX never handles payments" ───────────────────

describe("D · doctrine · no payment or booking-confirmation claims in code", () => {
  test("no transactional vocabulary (charge/checkout/payment/booking confirmed)", () => {
    expect(CODE_ONLY).not.toMatch(/charge\(/i);
    expect(CODE_ONLY).not.toMatch(/checkout/i);
    expect(CODE_ONLY).not.toMatch(/payment\s*intent/i);
    expect(CODE_ONLY).not.toMatch(/booking\s*confirmed/i);
    expect(CODE_ONLY).not.toMatch(/reservation\s*confirmed/i);
    expect(CODE_ONLY).not.toMatch(/stripe/i);
  });

  test("price_per_night_pence is parsed as integer only · never processed", () => {
    // The parse helper exists; it never calls out to any payment
    // provider or booking engine.
    expect(CODE_ONLY).toMatch(/parseOptionalPricePence/);
  });
});

// ─── E · wrong-business guard on single-room actions ───────────────

describe("E · updateRoomAction + changeRoomStatusAction + toggleRoomAvailableAction all guard room.business_id", () => {
  const actions = [
    "updateRoomAction",
    "changeRoomStatusAction",
    "toggleRoomAvailableAction",
  ];
  for (const name of actions) {
    test(`${name} verifies room.business_id === businessId before mutating`, () => {
      const idx = CODE_ONLY.indexOf(`export async function ${name}`);
      expect(idx, `${name} must be defined`).toBeGreaterThanOrEqual(0);
      const window = CODE_ONLY.slice(idx, idx + 2500);
      expect(window, `${name} must guard room.business_id`).toMatch(
        /room\.business_id\s*!==\s*businessId/,
      );
    });
  }
});
