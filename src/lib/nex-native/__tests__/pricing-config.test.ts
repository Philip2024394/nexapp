// src/lib/nex-native/__tests__/pricing-config.test.ts
//
// NEX Pricing Config · unit tests.
// Owner-authorised 2026-10-21 (end-to-end welcome card build).
// -----------------------------------------------------------------------------
// Scope: pure-function module. No DB, no fetch. Tests cover the three
// doctrine anchors from memory 2026-10-21 ("same story principle"):
//   · Only APPROVED prices + trials render as live offers.
//   · PROPOSAL / WITHDRAWN prices NEVER produce user-facing amounts.
//   · Trials that don't auto-fire AND have no manual-start path
//     NEVER advertise "X days free".

import { describe, test, expect } from "vitest";
import {
  NEX_PRICING_PACKAGES,
  PRICING_APPROVAL_STATUSES,
  PRICING_PACKAGE_IDS,
  type PricingAmount,
  type PricingPackage,
  type PricingTrial,
  formatPricingAmount,
  getPricingPackage,
  isPackageReadyForLive,
  isTrialReadyForLive,
  welcomeCardChipFor,
} from "../pricing-config";

// ─── A · catalogue shape ──────────────────────────────────────────

describe("A · pricing catalogue shape", () => {
  test("exposes the three sealed package ids in order", () => {
    expect(PRICING_PACKAGE_IDS).toEqual([
      "nex_chat_free",
      "chat_themes_premium",
      "nex_business",
    ]);
  });

  test("NEX_PRICING_PACKAGES has one entry per id", () => {
    expect(NEX_PRICING_PACKAGES.length).toBe(PRICING_PACKAGE_IDS.length);
    const ids = NEX_PRICING_PACKAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(PRICING_PACKAGE_IDS.length);
  });

  test("getPricingPackage returns the matching package or null", () => {
    expect(getPricingPackage("nex_chat_free")?.id).toBe("nex_chat_free");
    expect(getPricingPackage("chat_themes_premium")?.id).toBe(
      "chat_themes_premium",
    );
    expect(getPricingPackage("nex_business")?.id).toBe("nex_business");
    // @ts-expect-error · deliberately pass an unknown id to confirm null
    expect(getPricingPackage("not_a_package")).toBeNull();
  });

  test("PRICING_APPROVAL_STATUSES = ['PROPOSAL','APPROVED','WITHDRAWN']", () => {
    expect(PRICING_APPROVAL_STATUSES).toEqual([
      "PROPOSAL",
      "APPROVED",
      "WITHDRAWN",
    ]);
  });
});

// ─── B · initial status · everything paid starts as PROPOSAL ───

describe("B · initial status · the catalogue ships with unapproved pricing", () => {
  test("nex_chat_free is free · no price · no trial", () => {
    const pkg = getPricingPackage("nex_chat_free")!;
    expect(pkg.isFree).toBe(true);
    expect(pkg.price).toBeUndefined();
    expect(pkg.trial).toBeUndefined();
  });

  test("chat_themes_premium price is PROPOSAL (never silently APPROVED)", () => {
    const pkg = getPricingPackage("chat_themes_premium")!;
    expect(pkg.isFree).toBe(false);
    expect(pkg.price?.status).toBe("PROPOSAL");
  });

  test("nex_business price AND trial are BOTH PROPOSAL", () => {
    const pkg = getPricingPackage("nex_business")!;
    expect(pkg.isFree).toBe(false);
    expect(pkg.price?.status).toBe("PROPOSAL");
    expect(pkg.trial?.status).toBe("PROPOSAL");
  });

  test("nex_business trial advertises auto-fire + manual-start · activation paths are wired (Shop contract §K-3 LOCK 2026-11-06 retires sealed 2026-10-18 hold)", () => {
    // 2026-11-06 · the sealed 2026-10-18 "signup leaves trial UNTOUCHED"
    // hold is retired by Shop Entitlement Contract §K-3. The business
    // trial now auto-fires on first business signup (createBusinessAction
    // calls startBusinessTrial) AND /api/nex-native/trial/start remains
    // available as a manual-start path. convertsAutomatically stays
    // false until billing is wired (no surprise charges).
    const pkg = getPricingPackage("nex_business")!;
    expect(pkg.trial?.autoFiresOnSignup).toBe(true);
    expect(pkg.trial?.manualStartAvailable).toBe(true);
    expect(pkg.trial?.convertsAutomatically).toBe(false);
  });
});

// ─── C · isPackageReadyForLive · the gate ─────────────────────────

describe("C · isPackageReadyForLive · guards against showing unapproved pricing", () => {
  test("free package is always ready", () => {
    const pkg = getPricingPackage("nex_chat_free")!;
    expect(isPackageReadyForLive(pkg)).toBe(true);
  });

  test("paid package with PROPOSAL price is NOT ready", () => {
    const pkg = getPricingPackage("chat_themes_premium")!;
    expect(isPackageReadyForLive(pkg)).toBe(false);
  });

  test("business package today (PROPOSAL price · trial wiring active) is NOT ready · price gate still blocks", () => {
    // 2026-11-06 · Shop Entitlement Contract §K-3 retired the trial-
    // wiring hold, so `autoFiresOnSignup` + `manualStartAvailable` are
    // now true. The package STILL returns false because §B-1 (price
    // validation with real customers) remains OPEN · the price stays
    // PROPOSAL until the owner records validation. The same-story
    // principle (three unlocks together) is enforced by the readiness
    // guard: trial wired alone is insufficient.
    const pkg = getPricingPackage("nex_business")!;
    expect(isPackageReadyForLive(pkg)).toBe(false);
  });

  test("APPROVED price alone is enough for a non-trial package", () => {
    const premiumApproved: PricingPackage = {
      id: "chat_themes_premium",
      displayName: "Chat Themes Shop",
      tagline: "Premium backgrounds and styles",
      isFree: false,
      price: {
        amountMinorUnits: 399,
        currency: "USD",
        interval: "once",
        taxInclusive: false,
        status: "APPROVED",
        approvedAt: "2026-10-21T00:00:00Z",
        approvedBy: "owner",
      },
      entitlements: [],
    };
    expect(isPackageReadyForLive(premiumApproved)).toBe(true);
  });

  test("APPROVED price BUT PROPOSAL trial · still NOT ready", () => {
    const bizPriceOnly: PricingPackage = {
      ...getPricingPackage("nex_business")!,
      price: {
        amountMinorUnits: 999,
        currency: "USD",
        interval: "monthly",
        taxInclusive: false,
        status: "APPROVED",
      },
      trial: {
        durationDays: 7,
        autoFiresOnSignup: false,
        manualStartAvailable: false,
        convertsAutomatically: false,
        status: "PROPOSAL",
      },
    };
    expect(isPackageReadyForLive(bizPriceOnly)).toBe(false);
  });

  test("APPROVED trial WITHOUT activation path · NOT ready", () => {
    const bizTrialApprovedButUnwired: PricingPackage = {
      ...getPricingPackage("nex_business")!,
      price: {
        amountMinorUnits: 999,
        currency: "USD",
        interval: "monthly",
        taxInclusive: false,
        status: "APPROVED",
      },
      trial: {
        durationDays: 7,
        autoFiresOnSignup: false,
        manualStartAvailable: false,
        convertsAutomatically: false,
        status: "APPROVED",
      },
    };
    expect(isPackageReadyForLive(bizTrialApprovedButUnwired)).toBe(false);
  });

  test("APPROVED price AND APPROVED trial WITH auto-fire · ready", () => {
    const bizReady: PricingPackage = {
      ...getPricingPackage("nex_business")!,
      price: {
        amountMinorUnits: 999,
        currency: "USD",
        interval: "monthly",
        taxInclusive: false,
        status: "APPROVED",
      },
      trial: {
        durationDays: 7,
        autoFiresOnSignup: true,
        manualStartAvailable: false,
        convertsAutomatically: false,
        status: "APPROVED",
      },
    };
    expect(isPackageReadyForLive(bizReady)).toBe(true);
  });

  test("APPROVED price AND APPROVED trial WITH manual-start only · ready", () => {
    const bizReadyManual: PricingPackage = {
      ...getPricingPackage("nex_business")!,
      price: {
        amountMinorUnits: 999,
        currency: "USD",
        interval: "monthly",
        taxInclusive: false,
        status: "APPROVED",
      },
      trial: {
        durationDays: 7,
        autoFiresOnSignup: false,
        manualStartAvailable: true,
        convertsAutomatically: false,
        status: "APPROVED",
      },
    };
    expect(isPackageReadyForLive(bizReadyManual)).toBe(true);
  });

  test("convertsAutomatically=true · NEVER ready today (no billing wire)", () => {
    const bizAutoConvert: PricingPackage = {
      ...getPricingPackage("nex_business")!,
      price: {
        amountMinorUnits: 999,
        currency: "USD",
        interval: "monthly",
        taxInclusive: false,
        status: "APPROVED",
      },
      trial: {
        durationDays: 7,
        autoFiresOnSignup: true,
        manualStartAvailable: false,
        convertsAutomatically: true,
        status: "APPROVED",
      },
    };
    expect(isPackageReadyForLive(bizAutoConvert)).toBe(false);
  });

  test("WITHDRAWN price · NEVER ready", () => {
    const bizWithdrawn: PricingPackage = {
      ...getPricingPackage("nex_business")!,
      price: {
        amountMinorUnits: 999,
        currency: "USD",
        interval: "monthly",
        taxInclusive: false,
        status: "WITHDRAWN",
      },
    };
    expect(isPackageReadyForLive(bizWithdrawn)).toBe(false);
  });
});

// ─── D · isTrialReadyForLive · independent trial guard ──────────

describe("D · isTrialReadyForLive · independent trial-readiness guard", () => {
  const base: PricingTrial = {
    durationDays: 7,
    autoFiresOnSignup: false,
    manualStartAvailable: false,
    convertsAutomatically: false,
    status: "APPROVED",
  };

  test("APPROVED + manual-start · ready", () => {
    expect(isTrialReadyForLive({ ...base, manualStartAvailable: true })).toBe(true);
  });

  test("APPROVED + auto-fire · ready", () => {
    expect(isTrialReadyForLive({ ...base, autoFiresOnSignup: true })).toBe(true);
  });

  test("PROPOSAL + any wiring · not ready", () => {
    expect(
      isTrialReadyForLive({
        ...base,
        autoFiresOnSignup: true,
        status: "PROPOSAL",
      }),
    ).toBe(false);
  });

  test("APPROVED but zero activation paths · not ready", () => {
    expect(isTrialReadyForLive(base)).toBe(false);
  });

  test("APPROVED + auto-fire + auto-convert · not ready (no billing wire)", () => {
    expect(
      isTrialReadyForLive({
        ...base,
        autoFiresOnSignup: true,
        convertsAutomatically: true,
      }),
    ).toBe(false);
  });
});

// ─── E · formatPricingAmount ────────────────────────────────────

describe("E · formatPricingAmount", () => {
  test("APPROVED USD monthly → '$9.99/month'", () => {
    const amount: PricingAmount = {
      amountMinorUnits: 999,
      currency: "USD",
      interval: "monthly",
      taxInclusive: false,
      status: "APPROVED",
    };
    expect(formatPricingAmount(amount, "en-US")).toBe("$9.99/month");
  });

  test("APPROVED GBP once → '£1.99'", () => {
    const amount: PricingAmount = {
      amountMinorUnits: 199,
      currency: "GBP",
      interval: "once",
      taxInclusive: false,
      status: "APPROVED",
    };
    expect(formatPricingAmount(amount, "en-GB")).toBe("£1.99");
  });

  test("APPROVED USD yearly → '$99/year' (integer amount drops cents)", () => {
    const amount: PricingAmount = {
      amountMinorUnits: 9900,
      currency: "USD",
      interval: "yearly",
      taxInclusive: false,
      status: "APPROVED",
    };
    expect(formatPricingAmount(amount, "en-US")).toBe("$99/year");
  });

  test("PROPOSAL amount → '' (never leaks to UI)", () => {
    const amount: PricingAmount = {
      amountMinorUnits: 999,
      currency: "USD",
      interval: "monthly",
      taxInclusive: false,
      status: "PROPOSAL",
    };
    expect(formatPricingAmount(amount, "en-US")).toBe("");
  });

  test("WITHDRAWN amount → '' (never leaks to UI)", () => {
    const amount: PricingAmount = {
      amountMinorUnits: 999,
      currency: "USD",
      interval: "monthly",
      taxInclusive: false,
      status: "WITHDRAWN",
    };
    expect(formatPricingAmount(amount, "en-US")).toBe("");
  });
});

// ─── F · welcomeCardChipFor · the display helper ────────────────

describe("F · welcomeCardChipFor · owns the welcome-card chip string", () => {
  test("free package → 'FREE'", () => {
    const pkg = getPricingPackage("nex_chat_free")!;
    expect(welcomeCardChipFor(pkg)).toBe("FREE");
  });

  test("paid package with PROPOSAL price → 'See all plans' (safe fallback)", () => {
    const pkg = getPricingPackage("chat_themes_premium")!;
    expect(welcomeCardChipFor(pkg)).toBe("See all plans");
  });

  test("business package today → 'See all plans' (not ready)", () => {
    const pkg = getPricingPackage("nex_business")!;
    expect(welcomeCardChipFor(pkg)).toBe("See all plans");
  });

  test("business APPROVED price + wired trial → '7 days free, then $9.99/month'", () => {
    const bizReady: PricingPackage = {
      ...getPricingPackage("nex_business")!,
      price: {
        amountMinorUnits: 999,
        currency: "USD",
        interval: "monthly",
        taxInclusive: false,
        status: "APPROVED",
      },
      trial: {
        durationDays: 7,
        autoFiresOnSignup: true,
        manualStartAvailable: false,
        convertsAutomatically: false,
        status: "APPROVED",
      },
    };
    expect(welcomeCardChipFor(bizReady, "en-US")).toBe(
      "7 days free, then $9.99/month",
    );
  });

  test("premium theme APPROVED, no trial → '$3.99'", () => {
    const themesReady: PricingPackage = {
      ...getPricingPackage("chat_themes_premium")!,
      price: {
        amountMinorUnits: 399,
        currency: "USD",
        interval: "once",
        taxInclusive: false,
        status: "APPROVED",
      },
    };
    expect(welcomeCardChipFor(themesReady, "en-US")).toBe("$3.99");
  });
});

// ─── G · doctrine anchors · "same story" invariants ─────────────

describe("G · doctrine · the catalogue cannot silently misrepresent", () => {
  test("No package is simultaneously isFree=true AND carries a price", () => {
    for (const pkg of NEX_PRICING_PACKAGES) {
      if (pkg.isFree) {
        expect(pkg.price, `${pkg.id}: isFree=true must have no price`).toBeUndefined();
      }
    }
  });

  test("Every paid package has a price (never implicit)", () => {
    for (const pkg of NEX_PRICING_PACKAGES) {
      if (!pkg.isFree) {
        expect(pkg.price, `${pkg.id}: paid package must declare a price`).toBeDefined();
      }
    }
  });

  test("Every APPROVED amount has an approvedAt + approvedBy audit trail (when any ships APPROVED)", () => {
    for (const pkg of NEX_PRICING_PACKAGES) {
      if (pkg.price?.status === "APPROVED") {
        expect(pkg.price.approvedAt, `${pkg.id}: APPROVED price missing approvedAt`).toBeDefined();
        expect(pkg.price.approvedBy, `${pkg.id}: APPROVED price missing approvedBy`).toBeDefined();
      }
    }
  });

  test("No package currently claims convertsAutomatically=true (no billing wire)", () => {
    for (const pkg of NEX_PRICING_PACKAGES) {
      if (pkg.trial) {
        expect(
          pkg.trial.convertsAutomatically,
          `${pkg.id}: trial.convertsAutomatically must stay false until billing is wired`,
        ).toBe(false);
      }
    }
  });
});
