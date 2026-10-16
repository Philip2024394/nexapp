// src/app/nex-native/directory/landing/__tests__/landing-featured-deals.test.ts
//
// Phase A regression · the landing page's Featured Deals row is now
// backed by the sealed `landing-feed-service` with 2-card mobile
// behaviour and honest reduced/empty states. These anchors fail if a
// future edit silently re-introduces fabricated cards or drops the
// shared ListingCard primitive.
//
// Source-level anchors only (no runtime render) · the landing page
// is a server component with async data fetching, which is heavy to
// mount in jsdom. The intent is to catch regressions in the shape of
// the page definition itself.

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const LANDING_PAGE_PATH = path.resolve(
  __dirname,
  "..",
  "page.tsx",
);

function readLandingPage(): string {
  return fs.readFileSync(LANDING_PAGE_PATH, "utf8");
}

function stripComments(src: string): string {
  // Strip JS block + line comments so the doctrine prose at the top
  // of the file doesn't produce false hits on the fabrication guard.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

// ─── Hardcoded DEALS array must be gone ────────────────────────────

describe("landing page · hardcoded fabricated DEALS array is removed", () => {
  it("no `const DEALS` declaration remains in the landing page source", () => {
    const src = stripComments(readLandingPage());
    expect(src).not.toMatch(/\bconst\s+DEALS\s*(:|=)/);
  });

  it("no hardcoded Premium Wireless Earbuds / Luxury Beach Resort / Gourmet Burger Meal strings remain", () => {
    const src = stripComments(readLandingPage());
    expect(src).not.toContain("Premium Wireless Earbuds");
    expect(src).not.toContain("Luxury Beach Resort");
    expect(src).not.toContain("Gourmet Burger Meal");
  });

  it("no fabricated price/discount literals remain in the page source", () => {
    const src = stripComments(readLandingPage());
    // Hard dollar-amount guard · the real pricing (if ever surfaced)
    // will come from a view model, not literal strings.
    expect(src).not.toMatch(/\$\d{1,3}(\.\d{2})?/);
    // Hard discount-percent guard · same reasoning.
    expect(src).not.toMatch(/-\d{1,2}%/);
  });

  it("no `DealCard` local component remains", () => {
    const src = stripComments(readLandingPage());
    expect(src).not.toMatch(/\bfunction\s+DealCard\b/);
  });
});

// ─── Shared ListingCard primitive is used ──────────────────────────

describe("landing page · uses the shared ListingCard primitive", () => {
  it("imports ListingCard from the shared component path", () => {
    const src = readLandingPage();
    expect(src).toContain(
      'from "@/components/nex-native/directory/listing-card"',
    );
    expect(src).toContain("ListingCard");
  });

  it("renders ListingCard inside the Featured Deals section", () => {
    const src = stripComments(readLandingPage());
    // The FeaturedDealsSection body must map cards to ListingCard.
    const section = src.slice(
      src.indexOf("function FeaturedDealsSection"),
    );
    expect(section).toContain("ListingCard");
  });
});

// ─── Feed-service wiring ───────────────────────────────────────────

describe("landing page · wires the sealed landing-feed-service", () => {
  it("imports getLandingFeed + pickOrMintSeed from the sealed service", () => {
    const src = readLandingPage();
    expect(src).toContain("getLandingFeed");
    expect(src).toContain("pickOrMintSeed");
    expect(src).toContain(
      'from "@/lib/nex-native/directory/landing-feed-service"',
    );
  });

  it("the default export is an async component that calls getLandingFeed with limit 2", () => {
    const src = stripComments(readLandingPage());
    expect(src).toMatch(/export default async function/);
    // Expect a call-site requesting exactly 2 cards for mobile ·
    // owner-approved count.
    expect(src).toMatch(/getLandingFeed\(\s*\{[\s\S]*?limit:\s*2/);
  });
});

// ─── Honest-empty branch present ───────────────────────────────────

describe("landing page · honest empty state is wired", () => {
  it("the FeaturedDealsSection has a cards.length === 0 branch", () => {
    const src = stripComments(readLandingPage());
    expect(src).toMatch(/cards\.length\s*===\s*0/);
    // The empty-state component must be present.
    expect(src).toMatch(/FeaturedDealsEmpty/);
  });

  it("the empty state does NOT fabricate placeholder listings", () => {
    const src = stripComments(readLandingPage());
    const emptyStart = src.indexOf("function FeaturedDealsEmpty");
    expect(emptyStart).toBeGreaterThan(-1);
    const emptyBody = src.slice(emptyStart, emptyStart + 1200);
    // No made-up listing titles or $ prices in the empty branch.
    expect(emptyBody).not.toMatch(/\$\d/);
    expect(emptyBody).not.toMatch(/premium|resort|burger/i);
  });
});

// ─── Seed threading ────────────────────────────────────────────────

describe("landing page · path-based URLs (owner directive 2026-10-16 'url is small and mapped tree')", () => {
  it("directoryHref helper exists and returns path-based URLs", () => {
    const src = stripComments(readLandingPage());
    expect(src).toMatch(/function\s+directoryHref/);
    // Path-based form: `${RESULTS_HREF}/${category}` · NO `?category=`
    expect(src).toMatch(/\$\{RESULTS_HREF\}\/\$\{category\}/);
  });

  it("the landing page NEVER emits the old `?category=` query-param form", () => {
    const src = stripComments(readLandingPage());
    expect(src).not.toMatch(/`\$\{RESULTS_HREF\}\?category=/);
    expect(src).not.toMatch(/\?category=/);
  });

  it("every category tile Link uses directoryHref", () => {
    const src = stripComments(readLandingPage());
    const tileStart = src.indexOf("function CategoryTile");
    expect(tileStart).toBeGreaterThan(-1);
    const tileBody = src.slice(tileStart, tileStart + 2000);
    expect(tileBody).toContain("directoryHref(");
  });
});

// ─── Mobile-first viewport remains locked ──────────────────────────

describe("landing page · mobile-first viewport remains locked", () => {
  it("exports a viewport object with width device-width + initial-scale 1", () => {
    const src = readLandingPage();
    expect(src).toContain("export const viewport");
    expect(src).toContain('width: "device-width"');
    expect(src).toMatch(/initialScale:\s*1/);
  });
});
