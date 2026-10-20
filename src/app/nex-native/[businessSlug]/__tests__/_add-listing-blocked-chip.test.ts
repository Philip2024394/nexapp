// src/app/nex-native/[businessSlug]/__tests__/_add-listing-blocked-chip.test.ts
//
// Phase A1 · narrow code-only hardening pass · owner-authorised 2026-10-21.
// -----------------------------------------------------------------------
// The authorisation's hard rule: "the blocked route cannot accidentally
// lead users to a non-working page."
//
// listingAddRouteFor(accommodation-subtype) returns `state: "blocked"`
// because migration 213 is not applied. The owner-only Add Listing CTA
// on /[businessSlug]/page.tsx MUST render the blocked state as a plain
// non-clickable chip (NOT a <Link>) · otherwise clicking lands the
// owner on /nex-native/manage/accommodation which would then write to
// a non-existent nex_accommodation_unit table (DB error).
//
// These are source-anchor assertions. They do not render the component
// (the full page is a heavy server component with many data deps).

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGE_PATH = path.resolve(__dirname, "../page.tsx");
const PAGE_SRC = fs.readFileSync(PAGE_PATH, "utf8");

describe("A · the blocked route is rendered as a chip, never a Link", () => {
  test("the blocked branch's root element is a <div> with role='status', not a <Link>", () => {
    // The condition that opens the blocked branch · a `) : (` ternary
    // whose first match MUST start with a <div data-nex-owner-add-listing-blocked>.
    expect(PAGE_SRC).toMatch(
      /addRoute\.state\s*===\s*["']ready["'][\s\S]{0,2000}?\)\s*:\s*\(\s*<div\s[\s\S]{0,200}?data-nex-owner-add-listing-blocked/,
    );
  });

  test("the blocked chip carries cursor:default so it isn't visually a clickable link", () => {
    expect(PAGE_SRC).toMatch(
      /data-nex-owner-add-listing-blocked[\s\S]{0,1500}?cursor:\s*["']default["']/,
    );
  });

  test("the blocked chip has role='status' and title/aria-label for a11y", () => {
    expect(PAGE_SRC).toMatch(
      /data-nex-owner-add-listing-blocked[\s\S]{0,500}?role=["']status["']/,
    );
    expect(PAGE_SRC).toMatch(
      /data-nex-owner-add-listing-blocked[\s\S]{0,500}?aria-label=\{addRoute\.reason\}/,
    );
  });

  test("the blocked branch does NOT wrap a <Link> or an <a> that points at /manage/accommodation", () => {
    // Anchor the search to the blocked branch opening by capturing
    // everything from `data-nex-owner-add-listing-blocked` to the next
    // `</div>` tag. Must not contain a <Link> or anchor to the manage route.
    const blockedBlock = PAGE_SRC.match(
      /data-nex-owner-add-listing-blocked[\s\S]{0,3000}?<\/div>/,
    );
    expect(blockedBlock, "blocked branch must be present").not.toBeNull();
    const block = blockedBlock![0];
    expect(block).not.toMatch(/<Link\b/);
    expect(block).not.toMatch(/<a\b[\s\S]{0,200}?href=/i);
    expect(block).not.toMatch(/\/manage\/accommodation/);
  });
});

describe("B · the ready branch IS a Link (sanity · we didn't accidentally break the happy path)", () => {
  test("ready branch uses <Link href={addRoute.href}>", () => {
    expect(PAGE_SRC).toMatch(
      /addRoute\.state\s*===\s*["']ready["'][\s\S]{0,500}?<Link[\s\S]{0,200}?href=\{addRoute\.href\}/,
    );
  });
});

describe("C · the entire Add Listing block is gated on isOwnerViewing", () => {
  test("guests never see Add Listing · ready or blocked", () => {
    // The outer wrapper is `{isOwnerViewing && (() => {...})()}`
    // so the whole thing is skipped for guests.
    expect(PAGE_SRC).toMatch(
      /\{isOwnerViewing\s*&&[\s\S]{0,400}?listingAddRouteFor/,
    );
  });
});
