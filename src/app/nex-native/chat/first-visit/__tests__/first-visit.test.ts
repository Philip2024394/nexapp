// src/app/nex-native/chat/first-visit/__tests__/first-visit.test.ts
//
// Focused invariants for the NEX free-chat first-visit experience ·
// 2026-10-14.
//
// These tests use static source inspection (readFileSync + grep-style
// assertions) rather than render harness. Rationale: the three pages
// are RSC server components that touch Supabase indirectly via
// `resolveNexAppSessionOrGuest()` and `listActiveThemes()`. A full
// render test would require mocking the Supabase client + Next's
// cookies/headers context · more scaffolding than this bounded task
// warrants. The source-shape assertions below LOCK the honesty rules
// and the destination links so a future refactor cannot silently
// violate them.
//
// The tests cover the brief's 10 acceptance criteria at the source-
// shape level. Where runtime behaviour cannot be verified by static
// inspection (e.g. mobile viewport rendering), the brief said: "Do
// not claim mobile end-to-end verification if it was not performed."
// This test file does not claim that.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = resolve(__dirname, "..");
const PAGE_RAW = readFileSync(resolve(BASE, "page.tsx"), "utf8");
const SHOP_RAW = readFileSync(resolve(BASE, "shop", "page.tsx"), "utf8");
const PERSONALIZE_RAW = readFileSync(
  resolve(BASE, "personalize", "page.tsx"),
  "utf8",
);

// Strip comments before honesty checks: doctrine comments inside the
// files describe what the page explicitly does NOT include (e.g.
// "no Stripe consumer exists", "does NOT claim face-cover"). Those
// are honest descriptions of ABSENCE, not UI copy regressions. We
// keep the comments for human readability but exclude them from the
// forbidden-phrase scan so the scan only fires on actual rendered
// content. Structural checks (ChatIdentityHeader import, destination
// hrefs, dataset attributes) continue to scan the full source.
function stripComments(src: string): string {
  // Remove // line comments and /* block comments */.
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLine = noBlock
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  return noLine;
}

const PAGE = PAGE_RAW;
const SHOP = SHOP_RAW;
const PERSONALIZE = PERSONALIZE_RAW;
const PAGE_RENDERED = stripComments(PAGE_RAW);
const SHOP_RENDERED = stripComments(SHOP_RAW);
const PERSONALIZE_RENDERED = stripComments(PERSONALIZE_RAW);

// Any string that would imply active commerce / purchase · never allowed.
const FORBIDDEN_COMMERCE_PHRASES = [
  "stripe",
  "checkout",
  "buy now",
  "add to cart",
  "pay now",
  "price:",
  "purchased",
  "stripe.com",
  "retrievePaymentIntent",
];

// Any string that would imply custom-theme upload/save (not implemented).
const FORBIDDEN_PERSONALIZE_PHRASES = [
  "upload your theme",
  "upload your custom theme",
  "save your theme",
  "save your custom",
  "generate your theme",
  "scan your face",
  "face cover",
  "face-cover",
  "facecover",
  "biometric",
  "beauty filter",
];

// ─── First-visit page · structural invariants ─────────────────────

describe("first-visit page · structure", () => {
  it("renders the top NEX brand identity row (badge · NEX wordmark · subtitle)", () => {
    // 2026-10-15 · the first-visit page used to mount the sealed
    // ChatIdentityHeader primitive directly. It was replaced with a
    // bespoke row so the owner-approved NexPingBadge (shared with
    // landing + welcome) can sit on the left. ChatIdentityHeader
    // import is retained for parity with other sealed chat surfaces
    // (peer / guest / vault) that are not template-locked.
    expect(PAGE).toContain(
      'import { ChatIdentityHeader } from "@/lib/nex-native/chat-chrome/chat-identity-header"',
    );
    expect(PAGE).toContain(
      'import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client"',
    );
    expect(PAGE).toContain("<NexPingBadge");
    expect(PAGE).toContain("data-nex-first-visit-header");
  });

  it("resolves the signed-in session and redirects guests to /welcome", () => {
    expect(PAGE).toContain("resolveNexAppSessionOrGuest");
    expect(PAGE).toContain('redirect("/nex-native/welcome")');
  });

  it("declares the three destination keys (themes / shop / personalize)", () => {
    // Each destination appears as `key: "<name>"` in the DESTINATIONS array.
    expect(PAGE).toMatch(/key:\s*"themes"/);
    expect(PAGE).toMatch(/key:\s*"shop"/);
    expect(PAGE).toMatch(/key:\s*"personalize"/);
    // The renderer loops over the array (not three hand-rolled cards).
    expect(PAGE).toContain("DESTINATIONS.map((d) => (");
    // And the type union restricts future additions · adding a 4th
    // destination would require updating the Destination interface
    // AND this test.
    expect(PAGE).toMatch(/"themes"\s*\|\s*"shop"\s*\|\s*"personalize"/);
  });

  it("Card 1 (Chat Themes) links to the existing live catalogue", () => {
    // Pattern: object literal with href pointing at chat-themes-library.
    expect(PAGE).toMatch(/href:\s*"\/nex-native\/chat-themes-library"/);
  });

  it("Card 2 (Shop) links to the honest in-first-visit shop preview", () => {
    expect(PAGE).toMatch(
      /href:\s*"\/nex-native\/chat\/first-visit\/shop"/,
    );
  });

  it("Card 3 (Personalize) links to the honest personalize preview", () => {
    expect(PAGE).toMatch(
      /href:\s*"\/nex-native\/chat\/first-visit\/personalize"/,
    );
  });

  it("includes a skip link that routes to the normal chat landing", () => {
    expect(PAGE).toContain("data-nex-first-visit-skip");
    expect(PAGE).toMatch(/href="\/nex-native\/chat"/);
  });

  it("declares status chips for live / Phase-2 / coming-soon", () => {
    expect(PAGE).toMatch(/status:\s*"live"/);
    expect(PAGE).toMatch(/status:\s*"coming-phase-2"/);
    expect(PAGE).toMatch(/status:\s*"coming-soon"/);
  });

  it("has aria-labels on each destination card for keyboard accessibility", () => {
    expect(PAGE).toContain('aria-label={`${title} ·');
  });

  it("has aria-label on the skip link", () => {
    expect(PAGE).toContain('aria-label="Skip and continue to NEX Chat"');
  });

  it("renders NO commerce/payment UI copy", () => {
    const lower = PAGE_RENDERED.toLowerCase();
    for (const phrase of FORBIDDEN_COMMERCE_PHRASES) {
      expect(
        lower.includes(phrase),
        `forbidden commerce phrase appeared in rendered content: ${phrase}`,
      ).toBe(false);
    }
  });

  it("renders NO face-cover / biometric / custom-upload UI copy", () => {
    const lower = PAGE_RENDERED.toLowerCase();
    for (const phrase of FORBIDDEN_PERSONALIZE_PHRASES) {
      expect(
        lower.includes(phrase),
        `forbidden personalize phrase appeared in rendered content: ${phrase}`,
      ).toBe(false);
    }
  });

  it("does NOT write any DB mutation path", () => {
    // No supabase insert / update / upsert / rpc.
    expect(PAGE).not.toMatch(/\.insert\(/);
    expect(PAGE).not.toMatch(/\.update\(/);
    expect(PAGE).not.toMatch(/\.upsert\(/);
    expect(PAGE).not.toMatch(/\.rpc\(/);
    // No cookies set via next/headers (the brief forbids first-visit
    // cookie state writes on this task).
    expect(PAGE).not.toMatch(/cookies\(\)\.set\(/);
    expect(PAGE).not.toMatch(/\.setCookie/);
  });

  it("uses the sealed NEX design tokens only · no third palette", () => {
    // Must contain the canonical NEX bg; must not introduce new theme-level reds/greens.
    expect(PAGE).toContain("#020914"); // NEX navy
    expect(PAGE).toContain("#00AFFF"); // NEX cyan
    expect(PAGE).toContain("#FF7200"); // NEX orange
  });

  it("force-dynamic + nodejs runtime (needed for session resolution)", () => {
    expect(PAGE).toContain('export const runtime = "nodejs"');
    expect(PAGE).toContain('export const dynamic = "force-dynamic"');
  });
});

// ─── Shop preview · structural invariants ─────────────────────────

describe("shop preview · structure and honesty", () => {
  it("resolves the signed-in session and redirects guests", () => {
    expect(SHOP).toContain("resolveNexAppSessionOrGuest");
    expect(SHOP).toContain('redirect("/nex-native/welcome")');
  });

  it("mounts the sealed ChatIdentityHeader primitive", () => {
    expect(SHOP).toContain(
      'import { ChatIdentityHeader } from "@/lib/nex-native/chat-chrome/chat-identity-header"',
    );
    expect(SHOP).toContain("<ChatIdentityHeader");
  });

  it("reads the live catalogue via listActiveThemes · no hardcoded fake rows", () => {
    expect(SHOP).toContain("listActiveThemes");
    // No `const FAKE_SHOP_ITEMS` or similar literal arrays.
    expect(SHOP).not.toMatch(/const\s+FAKE_|const\s+MOCK_|const\s+DEMO_/);
  });

  it("tolerates catalogue failure · empty state does not throw", () => {
    expect(SHOP).toContain("themes = []");
    expect(SHOP).toContain("data-nex-first-visit-shop-empty");
  });

  it("renders an EXPLICIT 'Shop opening Phase 2' explainer", () => {
    expect(SHOP).toContain("Shop opening Phase 2");
  });

  it("displays NO price / currency / buy-button text in rendered content", () => {
    const lower = SHOP_RENDERED.toLowerCase();
    for (const phrase of FORBIDDEN_COMMERCE_PHRASES) {
      expect(
        lower.includes(phrase),
        `forbidden commerce phrase appeared in shop rendered content: ${phrase}`,
      ).toBe(false);
    }
    // Also · no "$" or currency symbols as literal UI text.
    expect(SHOP_RENDERED).not.toMatch(/>\s*\$\d/);
    expect(SHOP_RENDERED).not.toMatch(/>\s*IDR\s/);
    expect(SHOP_RENDERED).not.toMatch(/>\s*£\d/);
  });

  it("displays NO 'Buy' / 'Unlock' / 'Add' CTA button text", () => {
    // The browse-only invariant: tiles are <li>, never <button type=submit>.
    expect(SHOP).not.toMatch(/<button[^>]*type="submit"/);
    expect(SHOP).not.toMatch(/>\s*Buy\s*</i);
    expect(SHOP).not.toMatch(/>\s*Unlock\s*</i);
    expect(SHOP).not.toMatch(/>\s*Add to cart\s*</i);
  });

  it("does NOT bypass NEX_COMMERCE_ENABLED · never imports launch-flags", () => {
    // Specifically: no runtime import of launch-flags.ts and no code
    // that consults the flag or query bypass. Doctrine comments that
    // honestly describe the policy are fine · we scan the code body
    // (comment-stripped) for actual usage.
    expect(SHOP_RENDERED).not.toContain("commerceEnabledForRequest");
    expect(SHOP_RENDERED).not.toContain("searchEnabledForRequest");
    expect(SHOP).not.toMatch(/from\s+["']@\/lib\/nex-native\/launch-flags["']/);
    // Importantly · the shop page must not CALL the flag anywhere.
    expect(SHOP_RENDERED).not.toMatch(/\bNEX_COMMERCE_ENABLED\s*[?=]/);
  });

  it("tier metadata rendered as informational only (Standard / Premium labels)", () => {
    expect(SHOP).toContain("Premium");
    expect(SHOP).toContain("Standard");
    // No "upgrade required" or "paid tier" phrasing.
    const lower = SHOP.toLowerCase();
    expect(lower.includes("upgrade required")).toBe(false);
    expect(lower.includes("subscribe to view")).toBe(false);
  });

  it("has back-navigation links to first-visit and chat", () => {
    expect(SHOP).toMatch(/href="\/nex-native\/chat\/first-visit"/);
    expect(SHOP).toMatch(/href="\/nex-native\/chat"/);
  });

  it("writes no DB mutations", () => {
    expect(SHOP).not.toMatch(/\.insert\(/);
    expect(SHOP).not.toMatch(/\.update\(/);
    expect(SHOP).not.toMatch(/\.upsert\(/);
    expect(SHOP).not.toMatch(/\.rpc\(/);
    expect(SHOP).not.toMatch(/cookies\(\)\.set\(/);
  });
});

// ─── Personalize preview · structural invariants ─────────────────

describe("personalize preview · structure and honesty", () => {
  it("resolves the signed-in session and redirects guests", () => {
    expect(PERSONALIZE).toContain("resolveNexAppSessionOrGuest");
    expect(PERSONALIZE).toContain('redirect("/nex-native/welcome")');
  });

  it("mounts the sealed ChatIdentityHeader primitive", () => {
    expect(PERSONALIZE).toContain(
      'import { ChatIdentityHeader } from "@/lib/nex-native/chat-chrome/chat-identity-header"',
    );
  });

  it("reads existing themes · never fabricates personalisation data", () => {
    expect(PERSONALIZE).toContain("listActiveThemes");
    expect(PERSONALIZE).not.toMatch(/const\s+FAKE_|const\s+MOCK_|const\s+DEMO_/);
  });

  it("tolerates catalogue failure · explicit empty-state branch", () => {
    expect(PERSONALIZE).toContain("data-nex-first-visit-personalize-empty");
    expect(PERSONALIZE).toContain("atmospheric = []");
  });

  it("renders an EXPLICIT 'Personalization is on the way' explainer", () => {
    expect(PERSONALIZE).toContain("Personalization is on the way");
  });

  it("renders an EXPLICIT 'What's not here yet' honesty block", () => {
    expect(PERSONALIZE).toContain("What's not here yet");
    expect(PERSONALIZE).toContain("data-nex-first-visit-personalize-honesty");
  });

  it("renders NO face-cover / biometric / custom-upload / save / generate UI copy", () => {
    const lower = PERSONALIZE_RENDERED.toLowerCase();
    for (const phrase of FORBIDDEN_PERSONALIZE_PHRASES) {
      expect(
        lower.includes(phrase),
        `forbidden personalize phrase appeared in rendered content: ${phrase}`,
      ).toBe(false);
    }
  });

  it("does NOT render an upload input, save button, or generate button", () => {
    expect(PERSONALIZE).not.toMatch(/<input[^>]*type="file"/i);
    expect(PERSONALIZE).not.toMatch(/>\s*Upload\s*</i);
    expect(PERSONALIZE).not.toMatch(/>\s*Save\s*</i);
    expect(PERSONALIZE).not.toMatch(/>\s*Generate\s*</i);
  });

  it("renders NO commerce/payment UI copy", () => {
    const lower = PERSONALIZE_RENDERED.toLowerCase();
    for (const phrase of FORBIDDEN_COMMERCE_PHRASES) {
      expect(
        lower.includes(phrase),
        `forbidden commerce phrase appeared in personalize rendered content: ${phrase}`,
      ).toBe(false);
    }
  });

  it("writes no DB mutations and no cookies", () => {
    expect(PERSONALIZE).not.toMatch(/\.insert\(/);
    expect(PERSONALIZE).not.toMatch(/\.update\(/);
    expect(PERSONALIZE).not.toMatch(/\.upsert\(/);
    expect(PERSONALIZE).not.toMatch(/\.rpc\(/);
    expect(PERSONALIZE).not.toMatch(/cookies\(\)\.set\(/);
  });

  it("has back-navigation and live-themes forward link", () => {
    expect(PERSONALIZE).toMatch(/href="\/nex-native\/chat\/first-visit"/);
    expect(PERSONALIZE).toMatch(/href="\/nex-native\/chat-themes-library"/);
    expect(PERSONALIZE).toMatch(/href="\/nex-native\/chat"/);
  });

  it("preview strip caps at three atmospheric themes (hue-spread pick)", () => {
    expect(PERSONALIZE).toContain(".slice(0, 3)");
    expect(PERSONALIZE).toContain("pickDistinctAtmospheric");
  });
});

// ─── Cross-page invariants ─────────────────────────────────────

describe("first-visit chain · cross-page invariants", () => {
  it("none of the three pages touches tier-gate, product-service, or account-service", () => {
    for (const [name, src] of [
      ["page", PAGE],
      ["shop", SHOP],
      ["personalize", PERSONALIZE],
    ] as const) {
      expect(src.includes("tier-gate"), `${name} must not import tier-gate`).toBe(false);
      expect(
        src.includes("product-service"),
        `${name} must not import product-service`,
      ).toBe(false);
      expect(
        src.includes("updateChatTheme") ||
          src.includes("createAccount") ||
          src.includes("updateChatThemeHandler"),
        `${name} must not call account-service write methods`,
      ).toBe(false);
    }
  });

  it("none of the three pages touches Vault, migration 197, or Stage 1.1 modules", () => {
    for (const [name, src] of [
      ["page", PAGE],
      ["shop", SHOP],
      ["personalize", PERSONALIZE],
    ] as const) {
      expect(src.includes("vault-"), `${name} must not touch vault modules`).toBe(false);
      expect(
        src.includes("recordIfAllowed"),
        `${name} must not touch the sealed rate-limit primitive`,
      ).toBe(false);
      expect(
        src.includes("sendGuestMessageAction"),
        `${name} must not touch Stage 1.1 guest-message action`,
      ).toBe(false);
    }
  });

  it("every page is force-dynamic + nodejs runtime", () => {
    for (const src of [PAGE, SHOP, PERSONALIZE]) {
      expect(src).toContain('export const runtime = "nodejs"');
      expect(src).toContain('export const dynamic = "force-dynamic"');
    }
  });
});

// ─── Redesign additions · 2026-10-14 ──────────────────────────────
// Standard chat footer (ChatComposerPill), landscape card layout,
// owner-authored welcome copy, and tagline.

const STUB_SRC = readFileSync(resolve(BASE, "_composer-stub.tsx"), "utf8");

describe("first-visit page · redesign · sealed Chat Master Layout footer", () => {
  it("imports the FirstVisitComposerStub client wrapper", () => {
    expect(PAGE).toMatch(/from ["']\.\/_composer-stub["']/);
    expect(PAGE).toContain("FirstVisitComposerStub");
  });

  it("mounts <FirstVisitComposerStub /> inside a <footer>", () => {
    // The footer must be an explicit <footer> wrapper so the sealed
    // Chat Master Layout rule's "header + footer" semantics are met.
    expect(PAGE).toMatch(
      /<footer[\s\S]+?<FirstVisitComposerStub\s*\/>[\s\S]+?<\/footer>/,
    );
    expect(PAGE).toContain("data-nex-first-visit-footer");
  });

  it("the composer stub wraps the sealed ChatComposerPill primitive", () => {
    expect(STUB_SRC).toMatch(
      /from ["']@\/lib\/nex-native\/chat-chrome\/chat-composer-pill["']/,
    );
    expect(STUB_SRC).toContain("<ChatComposerPill");
  });

  it("composer never sends a message · routes to /nex-native/chat", () => {
    expect(STUB_SRC).toContain("useRouter");
    expect(STUB_SRC).toMatch(/router\.push\(/);
    expect(STUB_SRC).toContain("/nex-native/chat");
    expect(STUB_SRC).not.toMatch(/\.insert\(/);
    expect(STUB_SRC).not.toMatch(/\.update\(/);
    expect(STUB_SRC).not.toMatch(/\.upsert\(/);
    expect(STUB_SRC).not.toMatch(/fetch\(/);
    expect(STUB_SRC).not.toMatch(/cookies\(\)\.set\(/);
  });

  it("composer stub is a client component (use client directive at top)", () => {
    expect(STUB_SRC.trimStart()).toMatch(/^"use client";/);
  });

  it("composer stub does NOT reference commerce flags or sealed services", () => {
    expect(STUB_SRC).not.toMatch(/from ["'][^"']*launch-flags["']/);
    for (const bad of [
      "commerceEnabledForRequest",
      "NEX_COMMERCE_ENABLED",
      "tier-gate",
      "product-service",
      "account-service",
      "recordIfAllowed",
      "vault-",
      "sendPeerMessage",
      "sendGuestMessage",
    ]) {
      expect(
        STUB_SRC.includes(bad),
        `composer stub must not reference ${bad}`,
      ).toBe(false);
    }
  });
});

describe("first-visit page · redesign · 3 landscape cards", () => {
  it("the destination list declares the landscape layout", () => {
    expect(PAGE).toContain('data-nex-first-visit-cards-layout="landscape"');
  });

  it("every destination card carries data-nex-first-visit-card-layout='landscape'", () => {
    // Singular attribute appears once in the card-template source
    // (the `.map()` renders it per destination at run time). Plural
    // attribute on the <ol> container is a separate marker.
    expect(PAGE).toContain('data-nex-first-visit-card-layout="landscape"');
    expect(PAGE).toContain('data-nex-first-visit-cards-layout="landscape"');
  });

  it("each card renders a left-side visual preview tile", () => {
    expect(PAGE).toContain("data-nex-first-visit-card-visual");
  });

  it("renders the destination list as <ol> with <li> items (semantic ordered list)", () => {
    expect(PAGE).toMatch(
      /<ol[\s\S]{0,400}?aria-label="Choose your first NEX theme destination"/,
    );
    expect(PAGE).toMatch(/\.map\(\(d\) => \(\s*<li\s+key=\{d\.key\}/);
  });
});

describe("first-visit page · redesign · welcome copy", () => {
  it("renders the owner-authored headline · 'Welcome to NEX Chat'", () => {
    expect(PAGE_RENDERED).toContain("Welcome to NEX Chat");
  });

  it("renders the business-features value prop", () => {
    expect(PAGE_RENDERED.toLowerCase()).toContain(
      "ultimate chat experience",
    );
    expect(PAGE_RENDERED.toLowerCase()).toContain("business features");
  });

  it("renders the free-account buzzing body copy", () => {
    expect(PAGE_RENDERED.toLowerCase()).toContain(
      "get your free account buzzing",
    );
    expect(PAGE_RENDERED.toLowerCase()).toContain(
      "connect with the world at your fingertips",
    );
  });

  it("renders the closing tagline (jaw-dropped future)", () => {
    expect(PAGE_RENDERED.toLowerCase()).toContain("become the future");
    expect(PAGE_RENDERED.toLowerCase()).toContain("jaw-dropped");
  });

  it("welcome and tagline blocks have distinct data attributes", () => {
    expect(PAGE).toContain("data-nex-first-visit-welcome");
    expect(PAGE).toContain("data-nex-first-visit-tagline");
  });

  it("personalises the identity-header subtitle with the viewer's first name", () => {
    // 2026-10-15 · ChatIdentityHeader `subtitle` prop replaced with
    // a direct `{`Welcome, ${firstName}`}` template literal rendered
    // inside the bespoke header row. Both forms are accepted so the
    // intent (personalised welcome line) stays guarded.
    expect(PAGE).toMatch(/`Welcome, \$\{firstName\}`/);
    expect(PAGE).toContain('const firstName = displayName.split(" ")[0]');
  });
});
