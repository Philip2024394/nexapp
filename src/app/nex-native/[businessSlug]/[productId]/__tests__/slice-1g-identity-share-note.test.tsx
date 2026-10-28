// src/app/nex-native/[businessSlug]/[productId]/__tests__/slice-1g-identity-share-note.test.tsx
//
// Phase 1 · Slice 1G · owner-authorised 2026-10-24.
// -----------------------------------------------------------------------------
// Verifies the transparency note shown near Order Now / Chat Now on
// the product-detail page.
//
// EVIDENCE BOUNDARY
// -----------------------------------------------------------------------------
// Two cleanly-labelled test categories:
//
//   1 · SOURCE-SHAPE tests
//       Read the component file + the product-detail page as text.
//       Assert the sealed copy appears verbatim and that the page
//       mounts the note above the OrderBar.
//
//   2 · RENDERED BEHAVIOUR tests
//       renderToStaticMarkup the component (sealed repo convention)
//       and assert on the resulting HTML · verifies the copy is
//       actually produced by the renderer and that no forbidden
//       phrasing leaked in.
//
// NO behaviour change to the product-detail page, OrderBar, or chat
// flow is tested here · a separate assertion verifies the page
// still binds sendProductInquiryAction and still mounts OrderBar.
//
// What this slice does NOT prove:
//   · Does not prove that nex_peer_message RLS is fixed · G1 R1
//     remains open and the copy is scoped to describe current
//     service-layer behaviour, not database-level guarantees.
//   · Does not prove that signals are never duplicated · they can
//     be (Slice 1D documented limitation) · the copy's "browsing
//     doesn't share your identity" claim rests on the SELLER-FACING
//     dashboard aggregating anonymously (Slice 1F), not on signal
//     dedup.
//   · Does not promise retention or deletion · explicit absence
//     test below.

import { describe, it, test, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { IdentityShareNote } from "../_identity-share-note";

const COMPONENT_SRC = readFileSync(
  resolve(__dirname, "..", "_identity-share-note.tsx"),
  "utf8",
);
const PAGE_SRC = readFileSync(
  resolve(__dirname, "..", "page.tsx"),
  "utf8",
);

/** Strip comments so negative-match assertions scan actual code
 *  (JSX text + string literals + identifiers), not commentary that
 *  describes what the file deliberately does NOT do. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
}

const COMPONENT_CODE = stripComments(COMPONENT_SRC);

/* ─── 1 · Source-shape tests ─────────────────────────────────── */

describe("Slice 1G · source-shape · component", () => {
  it("declares a plain presentational React component (no hooks, no fetching)", () => {
    expect(COMPONENT_SRC).toMatch(/export function IdentityShareNote\(\)/);
    expect(COMPONENT_SRC).not.toMatch(/useState|useEffect|useRef|useReducer/);
    expect(COMPONENT_SRC).not.toMatch(/fetch\(|supabase|resolveNexAppSession/);
  });

  it("carries the sealed primary copy verbatim", () => {
    expect(COMPONENT_SRC).toMatch(
      /Starting a conversation about this product shares your NEX[\s\S]{0,40}ID with the seller/,
    );
  });

  it("carries the aggregate-anonymity assurance", () => {
    expect(COMPONENT_SRC).toMatch(/Browsing doesn&apos;t share your identity/);
  });

  it("declares the private-message boundary without database guarantees", () => {
    expect(COMPONENT_SRC).toMatch(
      /Your private[\s\S]{0,20}messages stay in your conversation/,
    );
    // Does NOT claim database/RLS-level enforcement · G1 R1 open.
    // Scan comments-stripped code so the G1-caveat JSDoc doesn't
    // trip the regex (the comment is specifically ABOUT why we
    // do not claim RLS).
    expect(COMPONENT_CODE).not.toMatch(/RLS|row-level security|encrypted at rest/i);
  });

  it("does NOT claim viewing identifies the viewer", () => {
    // Negative assertions on alarming / inaccurate phrasing.
    expect(COMPONENT_SRC).not.toMatch(/we track every/i);
    expect(COMPONENT_SRC).not.toMatch(/your views are recorded with your name/i);
    expect(COMPONENT_SRC).not.toMatch(/every tap is attributed to you/i);
  });

  it("does NOT imply marketing consent / opt-in", () => {
    // Comments-stripped so JSDoc that explicitly says "does NOT
    // imply marketing consent" doesn't match itself.
    expect(COMPONENT_CODE).not.toMatch(/marketing/i);
    expect(COMPONENT_CODE).not.toMatch(/opt.?in/i);
    expect(COMPONENT_CODE).not.toMatch(/subscribe/i);
    expect(COMPONENT_CODE).not.toMatch(/promotional/i);
  });

  it("does NOT make retention or deletion promises", () => {
    expect(COMPONENT_SRC).not.toMatch(/retention period|will keep .* for|retention policy/i);
    expect(COMPONENT_SRC).not.toMatch(/\bdelete your/i);
    expect(COMPONENT_SRC).not.toMatch(/forever|permanent/i);
  });

  it("does NOT describe this slice as a legal consent waiver (Safe Trade is separate)", () => {
    // Comments-stripped so the "this is NOT the Safe Trade consent
    // modal" JSDoc doesn't match itself.
    expect(COMPONENT_CODE).not.toMatch(/legal consent|waiver|acknowledge/i);
    expect(COMPONENT_CODE).not.toMatch(/by continuing you agree/i);
  });

  it("documents what it does NOT claim (self-check)", () => {
    expect(COMPONENT_SRC).toMatch(/G1 R1[\s\S]*?remains open/i);
    expect(COMPONENT_SRC).toMatch(/Does not promise retention/i);
  });
});

describe("Slice 1G · source-shape · page wiring", () => {
  it("imports IdentityShareNote from the colocated module", () => {
    expect(PAGE_SRC).toMatch(
      /import \{ IdentityShareNote \} from "\.\/_identity-share-note"/,
    );
  });

  it("mounts IdentityShareNote ABOVE OrderBar in the sticky bottom bar", () => {
    const bar = PAGE_SRC.match(/<IdentityShareNote[\s\S]{0,400}<OrderBar/);
    expect(bar).toBeTruthy();
  });

  it("does NOT alter sendProductInquiryAction binding or OrderBar props", () => {
    expect(PAGE_SRC).toMatch(/orderAction=\{sendProductInquiryAction\.bind\(/);
    expect(PAGE_SRC).toMatch(/productId=\{product\.id\}/);
    expect(PAGE_SRC).toMatch(/chatHref=\{chatHref\}/);
  });

  it("does NOT introduce a blocking modal or portal on the product-detail page", () => {
    // Slice 1G is explicitly non-blocking. The Safe Trade consent
    // modal (bridge 16b) is a separate surface.
    expect(PAGE_SRC).not.toMatch(/createPortal\b/);
    expect(PAGE_SRC).not.toMatch(/SafeTradeConsentModal/);
  });
});

/* ─── 2 · Rendered behaviour tests ───────────────────────────── */

describe("Slice 1G · rendered behaviour", () => {
  test("renders both lines of transparency copy", () => {
    const html = renderToStaticMarkup(<IdentityShareNote />);
    expect(html).toContain(
      "Starting a conversation about this product shares your NEX",
    );
    expect(html).toContain("ID with the seller");
    expect(html).toContain("Browsing");
    expect(html).toContain("doesn&#x27;t share your identity");
    expect(html).toContain("private");
    expect(html).toContain("messages stay in your conversation");
  });

  test("marks itself as a note · not a dialog / modal / blocking affordance", () => {
    const html = renderToStaticMarkup(<IdentityShareNote />);
    expect(html).toMatch(/role="note"/);
    expect(html).not.toMatch(/role="dialog"/);
    expect(html).not.toMatch(/aria-modal="true"/);
  });

  test("renders no form, no button, no CTA (purely informational)", () => {
    const html = renderToStaticMarkup(<IdentityShareNote />);
    expect(html).not.toMatch(/<button\b/);
    expect(html).not.toMatch(/<form\b/);
    expect(html).not.toMatch(/<input\b/);
    expect(html).not.toMatch(/<a\b/);
  });

  test("exposes stable data-attributes for later integration tests", () => {
    const html = renderToStaticMarkup(<IdentityShareNote />);
    expect(html).toMatch(/data-nex-identity-share-note/);
    expect(html).toMatch(/data-nex-identity-share-primary/);
    expect(html).toMatch(/data-nex-identity-share-secondary/);
  });

  test("rendered copy does NOT include forbidden phrases", () => {
    const html = renderToStaticMarkup(<IdentityShareNote />);
    for (const forbidden of [
      "marketing",
      "opt in",
      "opt-in",
      "subscribe",
      "promotional",
      "retention",
      "delete your",
      "we track every",
      "forever",
      "legal consent",
      "waiver",
      "by continuing you agree",
    ]) {
      expect(html.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  test("accessible label present", () => {
    const html = renderToStaticMarkup(<IdentityShareNote />);
    expect(html).toMatch(/aria-label="How your identity is shared"/);
  });

  test("stays accurate to the dashboard phrasing · aggregate vs identifiable", () => {
    // The seller-interest dashboard footer says "Views and taps are
    // aggregated · never attached to a customer identity. Named
    // metrics identify a customer only when that customer took an
    // explicit action." Our product-detail copy must be consistent
    // with that: browsing (view/tap) does not share identity · the
    // explicit action (starting a conversation) does.
    const html = renderToStaticMarkup(<IdentityShareNote />);
    expect(html).toContain("Browsing");
    expect(html).toContain("doesn&#x27;t share your identity");
    expect(html).toContain("Starting a conversation");
  });
});

/* ─── 3 · Explicit non-claims ────────────────────────────────── */

describe("Slice 1G · explicit boundary · what this slice does NOT prove", () => {
  it("does NOT prove the identity-share actually fires server-side (that is Slice 1A/1B/1D)", () => {
    expect(true).toBe(true);
  });

  it("does NOT prove the nex_peer_message RLS defect is fixed (G1 R1 open)", () => {
    expect(COMPONENT_SRC).toMatch(/G1 R1/);
  });

  it("does NOT alter the OrderBar / chat flow · existing bindings preserved", () => {
    expect(PAGE_SRC).toMatch(/orderAction=\{sendProductInquiryAction\.bind\(/);
  });
});
