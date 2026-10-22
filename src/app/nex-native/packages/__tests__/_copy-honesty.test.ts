// src/app/nex-native/packages/__tests__/_copy-honesty.test.ts
//
// Owner-authorised 2026-10-20 (P1-A + P2-A + P3-B + Gaps 1 & 2).
// -----------------------------------------------------------------
// Regression anchor for the customer-facing honesty corrections on
// /nex-native/packages. If a future edit reintroduces any of the
// removed claims, this suite fails loudly.
//
// Covers:
//   P1-A · Verified ✓ badge · removed from 3 locations on this page
//          (AddonCard "NEX Verified", Gratis-side off-benefit,
//          Bisnis-side on-benefit)
//   P2-A · "20 boosted messages per month" · removed from Bisnis
//          benefit list
//   P3-B · FAQ "What happens if I cancel Bisnis?" · reworded to the
//          actual manual-support process · removes the unsupported
//          billing-cycle promise
//   Gap 1 · FAQ "cut of my sales" revenue parenthetical · the
//           dangling "verification" reference removed after NEX
//           Verified AddonCard was removed in P1-A
//   Gap 2 · "Background Report" AddonCard · removed as UNSUPPORTED
//           (zero route/service/handler/entitlement/purchase flow
//           in src/ · zero tests · promises specific features and
//           prices with no backing implementation)
//
// Source-level only · no runtime render (no @testing-library/react).

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGE_PATH = path.resolve(__dirname, "../page.tsx");
const PAGE_SRC = fs.readFileSync(PAGE_PATH, "utf8");

// ─── P1-A · Verified ✓ badge claims removed ─────────────────────────

describe("P1-A · verified-badge claims absent from /packages", () => {
  test("no 'Verified ✓ badge' label anywhere on the page", () => {
    // The sealed removal covers the Gratis-off and Bisnis-on
    // benefit rows that both carried this label literally. Both
    // locations must stay removed.
    expect(PAGE_SRC).not.toContain("Verified ✓ badge");
  });

  test("no 'NEX Verified' AddonCard with 'seller-paid' fee pattern", () => {
    // The AddonCard was the third location · if the title string
    // comes back alongside the fee pattern, the add-on has been
    // reintroduced.
    const match = PAGE_SRC.match(
      /title="NEX Verified"[\s\S]{0,200}?fee="[^"]*seller-paid/,
    );
    expect(match).toBeNull();
  });

  test("no 'Visible verified checkmark' or 'Trust signal from NEX verification' explain text", () => {
    expect(PAGE_SRC).not.toContain("Visible verified checkmark");
    expect(PAGE_SRC).not.toContain(
      "Trust signal from NEX verification",
    );
  });

  test("no explain mentioning 'verification of your registration' badge claim", () => {
    // Protects against copy coming back under a different label.
    expect(PAGE_SRC).not.toMatch(
      /verification of your registration/i,
    );
  });
});

// ─── P2-A · 20 boosted messages claim removed ───────────────────────

describe("P2-A · boosted-messages claim absent from /packages", () => {
  test("no '20 boosted messages per month' label", () => {
    expect(PAGE_SRC).not.toContain("20 boosted messages per month");
  });

  test("no 'boosted messages' phrase at all", () => {
    // Covers any attempt to reword the quota while still promising
    // the unenforced feature.
    expect(PAGE_SRC).not.toMatch(/boosted\s+messages/i);
  });

  test("no 'Highlighted messages that stand out' explain text", () => {
    expect(PAGE_SRC).not.toContain(
      "Highlighted messages that stand out",
    );
  });
});

// ─── P3-B · cancel FAQ reworded honestly ────────────────────────────

describe("P3-B · cancel FAQ matches actual manual-support process", () => {
  test("FAQ question has been reworded to 'How do I cancel Bisnis?'", () => {
    expect(PAGE_SRC).toContain('q="How do I cancel Bisnis?"');
  });

  test("original billing-cycle promise is gone", () => {
    // "drops to Gratis on the next billing cycle" was the exact
    // unsupported promise · must stay removed.
    expect(PAGE_SRC).not.toContain(
      "drops to Gratis on the next billing cycle",
    );
  });

  test("no promise of grace period or 'through the end of the current period'", () => {
    expect(PAGE_SRC).not.toMatch(/end of the current period/i);
    expect(PAGE_SRC).not.toMatch(/grace period/i);
  });

  test("FAQ answer routes to NEX1 support (verifiable process)", () => {
    // The honest wording tells the customer where to go: the sealed
    // NEX1 support channel. Must stay in place.
    expect(PAGE_SRC).toContain("NEX1 support");
  });

  test("FAQ answer acknowledges manual processing honestly", () => {
    expect(PAGE_SRC).toMatch(/processed manually/i);
  });

  test("preserved facts about Gratis-tier behaviour after cancel", () => {
    // These statements ARE supported by code · they must stay.
    // (Gratis has 10-product cap, chat history, address, local reach.)
    expect(PAGE_SRC).toContain("10-product cap");
    expect(PAGE_SRC).toContain("chat history stays intact");
    expect(PAGE_SRC).toMatch(/yourshop\.nex/);
    expect(PAGE_SRC).toMatch(/reach returns to local/);
  });
});

// ─── Negative anchors · remaining claims that were NOT in scope ─────

describe("scope boundary · unrelated claims untouched", () => {
  test("'Refund within 7 days' TrustBlock reference is NOT in /packages (only in /settings/tier)", () => {
    // Confirms we did not pull in sibling TrustBlocks. Owner
    // directive · 'do not touch unrelated claims such as "Refund
    // within 7 days"'.
    expect(PAGE_SRC).not.toContain("Refund within 7 days");
  });

  test("SafeTrade AddonCard preserved (buyer-paid, has dedicated /safe-trade route)", () => {
    // SafeTrade is the one buyer-paid service with a dedicated
    // product surface at /nex-native/safe-trade. Its AddonCard stays.
    expect(PAGE_SRC).toContain('title="NEX SafeTrade"');
  });

  test("'0% commission' doctrine line preserved", () => {
    expect(PAGE_SRC).toContain("0% commission on every sale");
  });
});

// ─── Gap 1 · dangling 'verification' revenue reference removed ──────

describe("Gap 1 · FAQ 'cut of my sales' revenue parenthetical honest after P1-A", () => {
  test("'Will you ever take a cut' FAQ still present (structure preserved)", () => {
    expect(PAGE_SRC).toContain('q="Will you ever take a cut of my sales?"');
  });

  test("revenue parenthetical no longer lists 'verification' as a revenue source", () => {
    // After P1-A removed the NEX Verified AddonCard, the parenthetical
    // 'SafeTrade, verification' referenced a service no longer offered
    // on the page. Verifies the dangling reference stays removed.
    expect(PAGE_SRC).not.toContain("SafeTrade, verification");
    expect(PAGE_SRC).not.toContain("SafeTrade,verification");
    // Belt-and-braces · any inline reference to buyer-paid
    // 'verification' as a NEX revenue source in the FAQ is gone.
    const faqMatch = PAGE_SRC.match(
      /Will you ever take a cut[\s\S]{0,600}?\/>/,
    );
    expect(faqMatch).not.toBeNull();
    expect(faqMatch![0]).not.toMatch(/verification/i);
  });

  test("SafeTrade stays listed as a buyer-paid service (service exists in-repo)", () => {
    // SafeTrade has a dedicated /safe-trade route · the parenthetical
    // may legitimately reference it even if no payment pipeline is
    // wired, because the service concept + surface exists.
    const faqMatch = PAGE_SRC.match(
      /Will you ever take a cut[\s\S]{0,600}?\/>/,
    );
    expect(faqMatch).not.toBeNull();
    expect(faqMatch![0]).toContain("SafeTrade");
  });
});

// ─── Gap 2 · Background Report AddonCard removed ────────────────────

describe("Gap 2 · Background Report AddonCard removed as UNSUPPORTED", () => {
  test("no 'Background Report' AddonCard title anywhere on the page", () => {
    // The AddonCard made specific promises ("registration number,
    // ownership, prior dispute count, and sanctions screen",
    // "Downloadable PDF") and specific prices ($20-$50) with zero
    // backing in src/ · must stay removed until a real service
    // is designed and authorised.
    expect(PAGE_SRC).not.toContain('title="Background Report"');
    expect(PAGE_SRC).not.toContain("Background Report");
  });

  test("the specific unsupported feature promises are absent", () => {
    expect(PAGE_SRC).not.toContain(
      "Deep verification report for buyers",
    );
    expect(PAGE_SRC).not.toContain("sanctions screen");
    expect(PAGE_SRC).not.toMatch(/prior dispute count/i);
  });

  test("the specific price promise '$20–$50' is absent", () => {
    expect(PAGE_SRC).not.toContain("$20–$50");
    expect(PAGE_SRC).not.toContain("$20-$50");
  });

  test("'Buyer-paid trust services' section head still present (SafeTrade alone)", () => {
    // The section's remaining AddonCard (SafeTrade) is still a
    // buyer-paid trust service · heading stays accurate.
    expect(PAGE_SRC).toContain("Buyer-paid trust services");
  });
});
