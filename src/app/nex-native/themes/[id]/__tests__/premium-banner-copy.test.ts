// Unit tests · pickPremiumBannerCopy
//
// The honest premium-banner rendered on /nex-native/themes/[id] must
// NEVER claim that direct theme purchase works. This test suite
// locks that invariant down: specific decision rules + a forbidden-
// phrases guard that fails the build if a future refactor silently
// introduces payment language.

import { describe, expect, it } from "vitest";
import {
  pickPremiumBannerCopy,
  FORBIDDEN_PURCHASE_PHRASES,
} from "../_premium-banner-copy";

describe("pickPremiumBannerCopy · decision rule", () => {
  it("returns null for standard themes regardless of viewer or premium access", () => {
    expect(
      pickPremiumBannerCopy({
        viewerKind: "guest",
        category: "standard",
        canUsePremium: false,
      }),
    ).toBe(null);
    expect(
      pickPremiumBannerCopy({
        viewerKind: "session",
        category: "standard",
        canUsePremium: true,
      }),
    ).toBe(null);
  });

  it("returns null for premium themes when the signed-in viewer can already use premium (Bisnis / Pro / trial)", () => {
    expect(
      pickPremiumBannerCopy({
        viewerKind: "session",
        category: "premium",
        canUsePremium: true,
      }),
    ).toBe(null);
  });

  it("returns null for premium themes when a guest somehow has canUsePremium=true · pathological but harmless", () => {
    // viewerKind=guest + canUsePremium=true should never happen in
    // practice (guests cannot have a tier) but the function must
    // still refuse to show the upgrade nudge if canUsePremium is true.
    expect(
      pickPremiumBannerCopy({
        viewerKind: "guest",
        category: "premium",
        canUsePremium: true,
      }),
    ).toBe(null);
  });

  it("returns session-variant copy for signed-in viewers who cannot use premium", () => {
    const copy = pickPremiumBannerCopy({
      viewerKind: "session",
      category: "premium",
      canUsePremium: false,
    });
    expect(copy).not.toBeNull();
    expect(copy?.eyebrow).toBe("PREMIUM THEME");
    expect(copy?.ctaHref).toBe("/nex-native/settings/tier");
    expect(copy?.ctaLabel).toBe("See plans");
    // Must explicitly flag that direct purchase is not yet available.
    expect(copy?.subheading.toLowerCase()).toContain("not yet available");
  });

  it("returns guest-variant copy for guests on premium themes", () => {
    const copy = pickPremiumBannerCopy({
      viewerKind: "guest",
      category: "premium",
      canUsePremium: false,
    });
    expect(copy).not.toBeNull();
    expect(copy?.eyebrow).toBe("PREMIUM THEME");
    expect(copy?.ctaHref).toBe("/nex-native/sign-in");
    expect(copy?.ctaLabel).toBe("Create free account");
    expect(copy?.subheading.toLowerCase()).toContain("not yet available");
  });
});

describe("pickPremiumBannerCopy · honesty invariants", () => {
  // These invariants exist so a future refactor cannot silently
  // introduce a payment claim or a "Buy now" button without a test
  // flipping red. Payment is NOT wired (migrations 191–196 are
  // drafts · Stage 3 is unauthorised).

  it("no banner copy contains any forbidden purchase phrase", () => {
    for (const viewerKind of ["guest", "session"] as const) {
      const copy = pickPremiumBannerCopy({
        viewerKind,
        category: "premium",
        canUsePremium: false,
      });
      expect(copy).not.toBeNull();
      const haystack = [
        copy?.eyebrow,
        copy?.headline,
        copy?.subheading,
        copy?.ctaLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      for (const phrase of FORBIDDEN_PURCHASE_PHRASES) {
        expect(
          haystack.includes(phrase.toLowerCase()),
          `banner (${viewerKind}) must not contain forbidden phrase: "${phrase}" · found in: "${haystack}"`,
        ).toBe(false);
      }
    }
  });

  it("CTA href targets an existing NEX surface, never an external payment page", () => {
    const sessionCopy = pickPremiumBannerCopy({
      viewerKind: "session",
      category: "premium",
      canUsePremium: false,
    });
    const guestCopy = pickPremiumBannerCopy({
      viewerKind: "guest",
      category: "premium",
      canUsePremium: false,
    });
    for (const copy of [sessionCopy, guestCopy]) {
      expect(copy?.ctaHref).toMatch(/^\/nex-native\//);
      expect(copy?.ctaHref).not.toMatch(/^https?:\/\//);
      expect(copy?.ctaHref).not.toContain("stripe");
      expect(copy?.ctaHref).not.toContain("checkout");
      expect(copy?.ctaHref).not.toContain("purchase");
    }
  });

  it("session CTA points at the real tier settings surface", () => {
    const copy = pickPremiumBannerCopy({
      viewerKind: "session",
      category: "premium",
      canUsePremium: false,
    });
    expect(copy?.ctaHref).toBe("/nex-native/settings/tier");
  });

  it("guest CTA points at the real sign-in surface (not a fake /purchase or /buy route)", () => {
    const copy = pickPremiumBannerCopy({
      viewerKind: "guest",
      category: "premium",
      canUsePremium: false,
    });
    expect(copy?.ctaHref).toBe("/nex-native/sign-in");
  });

  it("exhaustive decision-matrix guard · only the two documented inputs produce copy", () => {
    const kinds: Array<"guest" | "session"> = ["guest", "session"];
    const categories: Array<"standard" | "premium"> = ["standard", "premium"];
    const canUse = [false, true];
    const outcomes = new Set<string>();
    for (const viewerKind of kinds) {
      for (const category of categories) {
        for (const canUsePremium of canUse) {
          const result = pickPremiumBannerCopy({
            viewerKind,
            category,
            canUsePremium,
          });
          outcomes.add(
            result === null
              ? "null"
              : `${viewerKind}:${result.ctaHref}`,
          );
        }
      }
    }
    expect(outcomes).toEqual(
      new Set([
        "null",
        "guest:/nex-native/sign-in",
        "session:/nex-native/settings/tier",
      ]),
    );
  });
});
