// src/app/nex-native/onboarding/first-product/__tests__/track-b.test.ts
//
// Track B · NEX Bisnis end-to-end · 2026-10-14.
// -----------------------------------------------------------------------------
// Focused source-shape + pure-function coverage of the Track B scope:
//   · Category-aware first-entry (first-product/page.tsx branches on
//     business.business_category)
//   · CategoryFirstEntryClient per-category copy (pure spec)
//   · First-product description field (ui input in _first-product-client)
//   · Setup-complete banner (owner-only, derivation pure function)
//   · Shop page banner injection on both cover-A and legacy paths
//
// Doctrine respected:
//   · No sealed server-action modification
//   · Phase 2 two-step setup preserved (universal across categories)
//   · No new DB column, migration, cookie, or completion flag
//   · "Honest note" copy on accommodation + property per owner directive
//
// All assertions are source-shape (readFileSync + grep-style) or pure-
// function (direct import + call). No Supabase, no process.env, no DOM.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  categoryEntrySpec,
} from "../_category-first-entry-client";
import { deriveVisibility } from "../../../[businessSlug]/_setup-complete-banner";
import type { NexBusinessRow } from "@/lib/nex-native/types";

const SERVER_PAGE_SRC = readFileSync(
  resolve(__dirname, "..", "page.tsx"),
  "utf8",
);
const PRODUCT_CLIENT_SRC = readFileSync(
  resolve(__dirname, "..", "_first-product-client.tsx"),
  "utf8",
);
const CATEGORY_CLIENT_SRC = readFileSync(
  resolve(__dirname, "..", "_category-first-entry-client.tsx"),
  "utf8",
);
const SHOP_PAGE_SRC = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "[businessSlug]",
    "page.tsx",
  ),
  "utf8",
);
const BANNER_SRC = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "[businessSlug]",
    "_setup-complete-banner.tsx",
  ),
  "utf8",
);
// Sealed server-action module · must stay byte-identical for Track B.
const SEALED_ACTIONS_SRC = readFileSync(
  resolve(__dirname, "..", "..", "..", "_actions.ts"),
  "utf8",
);

/* ─── A · server page branches on category ──────────────────── */

describe("first-product/page.tsx · category-aware branching", () => {
  it("imports CategoryFirstEntryClient and isBusinessCategory", () => {
    expect(SERVER_PAGE_SRC).toMatch(
      /import\s*\{\s*CategoryFirstEntryClient\s*\}\s*from\s*["']\.\/_category-first-entry-client["']/,
    );
    expect(SERVER_PAGE_SRC).toMatch(
      /import\s*\{\s*isBusinessCategory\s*\}\s*from\s*["']@\/lib\/nex-native\/business\/categories["']/,
    );
  });

  it("branches on business.business_category · non-products takes the new path", () => {
    expect(SERVER_PAGE_SRC).toContain("business.business_category");
    expect(SERVER_PAGE_SRC).toMatch(/isBusinessCategory\(rawCategory\)/);
    expect(SERVER_PAGE_SRC).toMatch(/rawCategory\s*!==\s*["']products["']/);
    expect(SERVER_PAGE_SRC).toMatch(/if\s*\(\s*isNonProductCategory\s*\)/);
  });

  it("CategoryFirstEntryClient is rendered with businessId + category + banner", () => {
    expect(SERVER_PAGE_SRC).toMatch(/<CategoryFirstEntryClient[\s\S]{0,400}?category=\{rawCategory\}/);
    expect(SERVER_PAGE_SRC).toMatch(/businessId=\{business\.id\}/);
    expect(SERVER_PAGE_SRC).toMatch(/banner=\{banner\}/);
  });

  it("Product path (FirstProductClient) preserved for products / null category", () => {
    // The function should still contain the FirstProductClient render
    // branch at the END (fallback for products + null category).
    expect(SERVER_PAGE_SRC).toContain("<FirstProductClient");
    expect(SERVER_PAGE_SRC).toContain("businessId={business.id}");
  });

  it("No sealed server-action modification · session + ownership guards preserved", () => {
    expect(SERVER_PAGE_SRC).toContain("resolveNexAppSessionFromContext");
    expect(SERVER_PAGE_SRC).toMatch(
      /business\.owner_account_id\s*!==\s*session\.account\.id/,
    );
  });

  it("No new DB mutation or cookie introduced on the server page", () => {
    expect(SERVER_PAGE_SRC).not.toMatch(/\.insert\(/);
    expect(SERVER_PAGE_SRC).not.toMatch(/\.update\(/);
    expect(SERVER_PAGE_SRC).not.toMatch(/\.upsert\(/);
    expect(SERVER_PAGE_SRC).not.toMatch(/\.rpc\(/);
    expect(SERVER_PAGE_SRC).not.toMatch(/cookies\(\)\.set\(/);
  });
});

/* ─── B · category-first-entry copy (pure spec) ─────────────── */

describe("categoryEntrySpec · honest per-category copy", () => {
  it("food · routes to /manage/menu · no honestNote (editor is live)", () => {
    const spec = categoryEntrySpec("food");
    expect(spec.primaryCta.href).toBe("/nex-native/manage/menu");
    expect(spec.heading).toMatch(/menu/i);
    expect(spec.honestNote).toBeNull();
  });

  it("services · routes to /manage/services · honestNote mentions booking in design", () => {
    const spec = categoryEntrySpec("services");
    expect(spec.primaryCta.href).toBe("/nex-native/manage/services");
    expect(spec.honestNote).toBeTruthy();
    expect(spec.honestNote!.toLowerCase()).toMatch(/booking|design|chat/);
  });

  it("accommodation · routes to /manage/venue · honestNote explicitly names missing features", () => {
    const spec = categoryEntrySpec("accommodation");
    expect(spec.primaryCta.href).toBe("/nex-native/manage/venue");
    expect(spec.honestNote).toBeTruthy();
    // Must honestly name what's missing per the owner's rule.
    const note = spec.honestNote!.toLowerCase();
    expect(note).toMatch(/room|rate|calendar|reservation/);
    expect(note).toMatch(/design|not yet/);
  });

  it("property · routes to /manage · honestNote names chat as current channel", () => {
    const spec = categoryEntrySpec("property");
    expect(spec.primaryCta.href).toBe("/nex-native/manage");
    expect(spec.honestNote).toBeTruthy();
  });

  it("every category spec has eyebrow, heading, intro, primaryCta", () => {
    for (const c of ["food", "services", "accommodation", "property"] as const) {
      const s = categoryEntrySpec(c);
      expect(s.eyebrow).toBeTruthy();
      expect(s.heading).toBeTruthy();
      expect(s.intro).toBeTruthy();
      expect(s.primaryCta.label).toBeTruthy();
      expect(s.primaryCta.href).toMatch(/^\/nex-native\//);
    }
  });
});

/* ─── C · CategoryFirstEntryClient structure ─────────────────── */

describe("_category-first-entry-client.tsx · structure", () => {
  it("is a client component ('use client')", () => {
    expect(CATEGORY_CLIENT_SRC.trimStart().startsWith('"use client"')).toBe(
      true,
    );
  });

  it("exports both the component and the pure spec", () => {
    expect(CATEGORY_CLIENT_SRC).toContain("export function CategoryFirstEntryClient");
    expect(CATEGORY_CLIENT_SRC).toContain("export function categoryEntrySpec");
  });

  it("renders the Phase 2 Make-it-yours link for every category", () => {
    expect(CATEGORY_CLIENT_SRC).toMatch(
      /\/nex-native\/business-setup\/make-it-yours\/theme\?businessId=/,
    );
    expect(CATEGORY_CLIENT_SRC).toContain(
      "data-nex-category-first-entry-make-it-yours",
    );
  });

  it("renders a primary CTA with data attribute for tests", () => {
    expect(CATEGORY_CLIENT_SRC).toContain(
      "data-nex-category-first-entry-primary-cta",
    );
  });

  it("writes nothing · no form, no insert, no cookie, no sealed-service bypass", () => {
    // Strip comments before scanning so documentary references
    // (e.g. "sealed createFirstProductAction") don't trip the regex.
    const strip = (s: string) =>
      s
        .split("\n")
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const code = strip(CATEGORY_CLIENT_SRC);
    expect(code).not.toMatch(/<form\b/);
    expect(code).not.toMatch(/\.insert\(/);
    expect(code).not.toMatch(/\.update\(/);
    expect(code).not.toMatch(/\.rpc\(/);
    expect(code).not.toMatch(/cookies\(\)/);
    expect(code).not.toMatch(/createFirstProductAction/);
    expect(code).not.toMatch(/createBusinessAction/);
  });

  it("does NOT fabricate accommodation booking engine capabilities in rendered copy", () => {
    // Strip comments before scanning so documentary disclaimers don't trip.
    const strip = (src: string) =>
      src
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const rendered = strip(CATEGORY_CLIENT_SRC).toLowerCase();
    // Must NOT make the accommodation copy sound like a booking system.
    expect(rendered).not.toMatch(/book now · reserve now · availability calendar/i);
    expect(rendered).not.toMatch(/room inventory manager/i);
    expect(rendered).not.toMatch(/nightly rate editor/i);
  });
});

/* ─── D · description field in first-product form ────────────── */

describe("_first-product-client.tsx · description field (Track B)", () => {
  it("renders a textarea named 'product_description'", () => {
    expect(PRODUCT_CLIENT_SRC).toMatch(
      /<textarea[\s\S]{0,400}?name="product_description"/,
    );
  });

  it("the textarea has a reasonable maxLength", () => {
    expect(PRODUCT_CLIENT_SRC).toMatch(
      /name="product_description"[\s\S]{0,200}?maxLength=\{1000\}/,
    );
  });

  it("sealed createFirstProductAction reads product_description from FormData", () => {
    // The sealed action must still be the one reading the field · we
    // did NOT invent a new persistence path.
    expect(SEALED_ACTIONS_SRC).toContain('formData.get("product_description")');
  });

  it("sealed createFirstProductAction redirect preserved · still redirects to /{slug}", () => {
    // Line reference: _actions.ts:3524 or thereabouts in the sealed
    // function. The exact redirect target must not have shifted to
    // the two-step flow.
    expect(SEALED_ACTIONS_SRC).toMatch(
      /createFirstProductAction[\s\S]{0,5000}?redirect\(\s*`\/nex-native\/\$\{business\.slug\}`?/,
    );
  });
});

/* ─── E · deriveVisibility pure predicate ────────────────────── */

/** Minimal fixture · only the columns deriveVisibility reads. */
function makeBusiness(
  overrides: Partial<NexBusinessRow>,
): NexBusinessRow {
  return {
    id: "biz-id" as never,
    owner_account_id: "owner-id" as never,
    slug: "test-shop",
    display_name: "Test Shop",
    logo_url: null,
    description: null,
    business_category: null,
    profile: null,
    archived_at: null,
    is_away: false,
    away_until: null,
    away_message: null,
    last_seller_activity_at: "2026-10-14T00:00:00Z" as never,
    created_at: "2026-10-14T00:00:00Z" as never,
    ...overrides,
  } as unknown as NexBusinessRow;
}

describe("deriveVisibility · honest three-state derivation", () => {
  it("fresh business (profile null, not archived) · saved + visible, NOT owner-ready", () => {
    const d = deriveVisibility(
      makeBusiness({ profile: null, archived_at: null }),
    );
    expect(d.saved).toBe(true);
    expect(d.ownerReady).toBe(false);
    expect(d.visibleToCustomers).toBe(true);
    expect(d.visibleReason.toLowerCase()).toMatch(
      /anyone with the link|view it right now/,
    );
  });

  it("activated business (profile non-null, not archived) · all three true", () => {
    const d = deriveVisibility(
      makeBusiness({
        profile: { primary: { category: "products", subtype: null } } as never,
        archived_at: null,
      }),
    );
    expect(d.ownerReady).toBe(true);
    expect(d.visibleToCustomers).toBe(true);
  });

  it("archived business · visible is false, honest reason", () => {
    const d = deriveVisibility(
      makeBusiness({
        profile: { primary: { category: "products", subtype: null } } as never,
        archived_at: "2026-10-14T00:00:00Z" as never,
      }),
    );
    expect(d.visibleToCustomers).toBe(false);
    expect(d.visibleReason.toLowerCase()).toMatch(/archived/);
  });

  it("category-aware next-action href · products default", () => {
    const d = deriveVisibility(
      makeBusiness({ business_category: "products" as never }),
    );
    expect(d.nextActionHref).toBe("/nex-native/manage/products");
  });

  it("category-aware next-action href · food", () => {
    const d = deriveVisibility(
      makeBusiness({ business_category: "food" as never }),
    );
    expect(d.nextActionHref).toBe("/nex-native/manage/menu");
  });

  it("category-aware next-action href · services", () => {
    const d = deriveVisibility(
      makeBusiness({ business_category: "services" as never }),
    );
    expect(d.nextActionHref).toBe("/nex-native/manage/services");
  });

  it("category-aware next-action href · accommodation", () => {
    const d = deriveVisibility(
      makeBusiness({ business_category: "accommodation" as never }),
    );
    expect(d.nextActionHref).toBe("/nex-native/manage/venue");
  });

  it("null category defaults to /manage/products action", () => {
    const d = deriveVisibility(makeBusiness({ business_category: null }));
    expect(d.nextActionHref).toBe("/nex-native/manage/products");
  });
});

/* ─── F · setup-complete banner structure ────────────────────── */

describe("_setup-complete-banner.tsx · structure", () => {
  it("is server-render-safe (no 'use client')", () => {
    expect(BANNER_SRC.trimStart().startsWith('"use client"')).toBe(false);
  });

  it("renders all three state rows", () => {
    // The StateRow helper wires `dataKey` into `data-nex-setup-state={dataKey}`
    // · lock both the attribute binding AND the three dataKey literals.
    expect(BANNER_SRC).toContain("data-nex-setup-state={dataKey}");
    expect(BANNER_SRC).toContain('dataKey="saved"');
    expect(BANNER_SRC).toContain('dataKey="owner-ready"');
    expect(BANNER_SRC).toContain('dataKey="visible-to-customers"');
  });

  it("surfaces the honest explanation about publish-less visibility", () => {
    expect(BANNER_SRC).toContain("data-nex-setup-honest-note");
    const strip = (s: string) =>
      s
        .split("\n")
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const rendered = strip(BANNER_SRC);
    expect(rendered).toMatch(/publish/i);
  });

  it("writes nothing · no form, no persistence, no cookie", () => {
    expect(BANNER_SRC).not.toMatch(/<form\b/);
    expect(BANNER_SRC).not.toMatch(/\.insert\(/);
    expect(BANNER_SRC).not.toMatch(/\.update\(/);
    expect(BANNER_SRC).not.toMatch(/cookies\(\)/);
  });

  it("exposes the pure deriveVisibility helper for tests", () => {
    expect(BANNER_SRC).toContain("export function deriveVisibility");
  });
});

/* ─── G · shop page injects banner on both render paths ──────── */

describe("[businessSlug]/page.tsx · banner injection", () => {
  it("declares searchParams.setup as a string type", () => {
    expect(SHOP_PAGE_SRC).toMatch(
      /searchParams\?:\s*Promise<\{\s*commerce\?:\s*string\s*;\s*setup\?:\s*string\s*\}>/,
    );
  });

  it("reads sp.setup === 'complete' before resolving the banner", () => {
    expect(SHOP_PAGE_SRC).toMatch(/sp\.setup\s*===\s*["']complete["']/);
  });

  it("ownership-gates the banner · never shows to non-owners", () => {
    expect(SHOP_PAGE_SRC).toMatch(
      /bannerSession\.account\.id\s*===\s*business\.owner_account_id/,
    );
  });

  it("injects {setupBanner} above the cover-A render path", () => {
    // Cover-A path wraps CoverThemeSkin inside a fragment with the banner.
    expect(SHOP_PAGE_SRC).toMatch(
      /\{setupBanner\}[\s\S]{0,200}?<CoverThemeSkin/,
    );
  });

  it("injects {setupBanner} above the legacy landing render path", () => {
    expect(SHOP_PAGE_SRC).toMatch(/\{setupBanner\}[\s\S]{0,100}?TOP HEADER/);
  });

  it("preserves the sealed commerce gate", () => {
    expect(SHOP_PAGE_SRC).toContain("commerceEnabledForRequest(sp)");
    expect(SHOP_PAGE_SRC).toMatch(/redirect\(["']\/nex-native\/home["']\)/);
  });
});

/* ─── H · sealed server actions untouched ────────────────────── */

describe("sealed _actions.ts · untouched by Track B", () => {
  it("createBusinessAction terminal redirect to /onboarding/first-product preserved", () => {
    // Lenient on whitespace around the template literal · multi-line
    // formatting (newline + comma + closing paren) is normal in the
    // sealed source.
    expect(SEALED_ACTIONS_SRC).toMatch(
      /redirect\([\s\S]{0,40}?`\/nex-native\/onboarding\/first-product\?slug=\$\{encodeURIComponent\(business\.slug\)\}`[\s\S]{0,20}?\)/,
    );
  });

  it("createFirstProductAction still reads product_description from FormData", () => {
    expect(SEALED_ACTIONS_SRC).toContain('formData.get("product_description")');
  });

  it("updateChatThemeAction remains the sealed theme-save path", () => {
    expect(SEALED_ACTIONS_SRC).toContain("updateChatThemeAction");
  });
});
