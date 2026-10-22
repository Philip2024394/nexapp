// src/app/nex-native/support/__tests__/_support-copy-honesty.test.ts
//
// Owner-authorised 2026-10-20 (P1-A).
// -----------------------------------------------------------------
// Regression anchor for the 4th customer-facing location of the
// verified-badge claim · the "How do I upgrade to Bisnis?" HelpCard
// on /nex-native/support. If a future edit reintroduces "verified
// badge" in that card, this fails loudly.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGE_PATH = path.resolve(__dirname, "../page.tsx");
const PAGE_SRC = fs.readFileSync(PAGE_PATH, "utf8");

describe("P1-A · support page · verified-badge claim removed", () => {
  test("'How do I upgrade to Bisnis?' HelpCard does NOT mention 'verified badge'", () => {
    const match = PAGE_SRC.match(
      /title="How do I upgrade to Bisnis\?"[\s\S]{0,600}?\/>/,
    );
    expect(match).not.toBeNull();
    expect(match![0]).not.toContain("verified badge");
    expect(match![0]).not.toContain("Verified ✓");
  });

  test("HelpCard preserves the OTHER actual Bisnis benefit mentions", () => {
    const match = PAGE_SRC.match(
      /title="How do I upgrade to Bisnis\?"[\s\S]{0,600}?\/>/,
    );
    expect(match).not.toBeNull();
    // These benefits are referenced on /packages too and remain
    // in-scope · we must not accidentally remove them.
    expect(match![0]).toContain("international export");
    expect(match![0]).toContain("featured chip");
    expect(match![0]).toContain("unlimited caps");
  });

  test("HelpCard preserves the sealed payment-rails doctrine wording", () => {
    const match = PAGE_SRC.match(
      /title="How do I upgrade to Bisnis\?"[\s\S]{0,600}?\/>/,
    );
    expect(match).not.toBeNull();
    // "not through a NEX rail" is the sealed "NEX never handles
    // payments" doctrine surfacing on this page · stays.
    expect(match![0]).toContain("not through a NEX rail");
  });
});

describe("scope boundary · unrelated support HelpCards untouched", () => {
  test("'I forgot my password' HelpCard preserved", () => {
    expect(PAGE_SRC).toContain('title="I forgot my password"');
  });

  test("'I want to delete my account' HelpCard preserved", () => {
    expect(PAGE_SRC).toContain('title="I want to delete my account"');
  });

  test("'I want a data export' HelpCard preserved", () => {
    expect(PAGE_SRC).toContain('title="I want a data export"');
  });
});
