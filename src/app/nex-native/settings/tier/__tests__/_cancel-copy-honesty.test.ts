// src/app/nex-native/settings/tier/__tests__/_cancel-copy-honesty.test.ts
//
// Owner-authorised 2026-10-20 (P3-B + Service Refund Policy).
// -----------------------------------------------------------------
// Regression anchor for TWO honesty corrections on the /settings/tier
// TrustBlock cluster.
//
// 1. Cancel TrustBlock (P3-B · 2026-10-20):
//    "Cancel any time · Every subscription can be paused or cancelled
//    from this page" → "How to cancel · message NEX1 support · Gratis
//    is free · nothing to cancel"
//
// 2. Refund TrustBlock (Service Refund Policy · 2026-10-20):
//    "Refund within 7 days · Not happy in the first 7 days? Message
//    NEX1 support for a full refund. No questions asked, no waiting."
//    → "How refunds work · Bisnis payments cover the NEX service ·
//    NEX does not offer a voluntary money-back period · statutory
//    consumer rights still apply · message NEX1 support."
//
// Reason for removing the 7-day promise:
//   - NEX is a service · a voluntary money-back guarantee is NOT an
//     authorised commercial commitment (owner directive 2026-10-20)
//   - The 7-day promise appeared only in this TrustBlock · zero
//     accepted-terms storage carried it as a binding right
//   - Policy boundary: must NOT claim no refunds under any
//     circumstance · statutory consumer rights are preserved
//     explicitly in the replacement wording

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGE_PATH = path.resolve(__dirname, "../page.tsx");
const PAGE_SRC = fs.readFileSync(PAGE_PATH, "utf8");

describe("P3-B · settings/tier cancel TrustBlock reflects actual process", () => {
  test("TrustBlock title changed from 'Cancel any time' to 'How to cancel'", () => {
    expect(PAGE_SRC).not.toContain('title="Cancel any time"');
    expect(PAGE_SRC).toContain('title="How to cancel"');
  });

  test("misleading 'can be paused or cancelled from this page' phrase is gone", () => {
    expect(PAGE_SRC).not.toContain(
      "paused or cancelled from this page",
    );
    expect(PAGE_SRC).not.toContain("cancelled from this page");
  });

  test("unsupported 'through the end of the current period' promise is gone", () => {
    expect(PAGE_SRC).not.toContain(
      "end of the current period",
    );
  });

  test("new TrustBlock routes to NEX1 support (verifiable process)", () => {
    const match = PAGE_SRC.match(
      /title="How to cancel"[\s\S]{0,400}?NEX1 support/,
    );
    expect(match).not.toBeNull();
  });

  test("new TrustBlock clarifies Gratis-user case explicitly", () => {
    // Must explicitly tell Gratis users nothing is cancelable so
    // the copy stops applying to them by implication.
    const match = PAGE_SRC.match(
      /title="How to cancel"[\s\S]{0,400}?Gratis is free/,
    );
    expect(match).not.toBeNull();
  });

  test("new TrustBlock acknowledges manual processing honestly", () => {
    const match = PAGE_SRC.match(
      /title="How to cancel"[\s\S]{0,400}?processed manually/i,
    );
    expect(match).not.toBeNull();
  });
});

describe("scope boundary · 'No hidden fees' TrustBlock untouched", () => {
  test("'No hidden fees' TrustBlock preserved verbatim", () => {
    // Owner directive · do not touch unrelated claims.
    expect(PAGE_SRC).toContain('title="No hidden fees"');
    expect(PAGE_SRC).toContain(
      "What you see is what you pay",
    );
  });
});

// ─── Service refund policy · 7-day guarantee removed ────────────────

describe("Service Refund Policy · 7-day voluntary guarantee removed", () => {
  test("the 'Refund within 7 days' TrustBlock title is gone", () => {
    expect(PAGE_SRC).not.toContain('title="Refund within 7 days"');
    expect(PAGE_SRC).not.toContain("Refund within 7 days");
  });

  test("the 'first 7 days' / 'full refund' / 'no questions asked' body is gone", () => {
    // All three phrases from the removed body must stay removed.
    expect(PAGE_SRC).not.toContain("first 7 days");
    expect(PAGE_SRC).not.toContain(
      "Message NEX1 support for a full refund",
    );
    expect(PAGE_SRC).not.toContain("No questions asked, no waiting");
    expect(PAGE_SRC).not.toContain("no questions asked");
  });

  test("replacement TrustBlock title 'How refunds work' is present", () => {
    expect(PAGE_SRC).toContain('title="How refunds work"');
  });

  test("replacement wording states Bisnis payments are for the NEX service", () => {
    const match = PAGE_SRC.match(
      /title="How refunds work"[\s\S]{0,600}?\/>/,
    );
    expect(match).not.toBeNull();
    expect(match![0]).toMatch(/Bisnis payments cover/i);
    expect(match![0]).toMatch(/NEX service/);
  });

  test("replacement explicitly removes the voluntary money-back period", () => {
    const match = PAGE_SRC.match(
      /title="How refunds work"[\s\S]{0,600}?\/>/,
    );
    expect(match).not.toBeNull();
    expect(match![0]).toMatch(
      /does not offer a voluntary money-back period/i,
    );
  });

  test("replacement preserves applicable consumer rights (does NOT claim no refunds under any circumstances)", () => {
    const match = PAGE_SRC.match(
      /title="How refunds work"[\s\S]{0,600}?\/>/,
    );
    expect(match).not.toBeNull();
    // Must explicitly preserve statutory rights.
    expect(match![0]).toMatch(/consumer rights/i);
    expect(match![0]).toMatch(/applicable law/i);
    // Negative anchor · must NOT make the forbidden absolute claim.
    expect(match![0]).not.toMatch(/no refunds under any/i);
    expect(match![0]).not.toMatch(/no refunds whatsoever/i);
    expect(match![0]).not.toMatch(/all sales are final/i);
    expect(match![0]).not.toMatch(/no refunds, ever/i);
  });

  test("replacement routes customers to NEX1 support", () => {
    const match = PAGE_SRC.match(
      /title="How refunds work"[\s\S]{0,600}?\/>/,
    );
    expect(match).not.toBeNull();
    expect(match![0]).toContain("NEX1 support");
  });

  test("replacement does NOT invent legal review or legal conclusions", () => {
    const match = PAGE_SRC.match(
      /title="How refunds work"[\s\S]{0,600}?\/>/,
    );
    expect(match).not.toBeNull();
    // Owner directive · do not claim the policy has been legally
    // reviewed. Belt-and-braces against any accidental claim.
    expect(match![0]).not.toMatch(/legally reviewed/i);
    expect(match![0]).not.toMatch(/reviewed by counsel/i);
    expect(match![0]).not.toMatch(/approved by lawyers/i);
  });
});

// ─── Cancellation remains SEPARATE from refund wording ──────────────

describe("cancellation and refund TrustBlocks remain separate concerns", () => {
  test("the 'How to cancel' TrustBlock does NOT mention refund terms", () => {
    const match = PAGE_SRC.match(
      /title="How to cancel"[\s\S]{0,500}?\/>/,
    );
    expect(match).not.toBeNull();
    expect(match![0]).not.toMatch(/refund/i);
    expect(match![0]).not.toMatch(/money.?back/i);
  });

  test("the 'How refunds work' TrustBlock does NOT mix in cancellation instructions", () => {
    // Owner directive · "Keep cancellation instructions separate
    // from refund wording."
    const match = PAGE_SRC.match(
      /title="How refunds work"[\s\S]{0,600}?\/>/,
    );
    expect(match).not.toBeNull();
    expect(match![0]).not.toMatch(/to cancel/i);
    expect(match![0]).not.toMatch(/cancellation/i);
  });
});
