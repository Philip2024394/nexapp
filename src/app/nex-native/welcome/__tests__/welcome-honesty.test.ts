// Static source-content tests for the sealed /nex-native/welcome page.
//
// Why this test exists:
//   The welcome page is the first thing a brand-new anonymous visitor
//   sees. The sealed load-bearing rule in welcome/page.tsx is:
//     "Does not show controls for features that do not work."
//   Phase 1 is a chat-first launch (see src/lib/nex-native/launch-flags.ts
//   NEX_COMMERCE_ENABLED), so the Bridge 99 "message a business without
//   signing up" entry point is gated behind the commerce flag and not
//   reachable from the welcome page today. Direct theme purchase is
//   unimplemented (migrations 191-196 are drafts). Any tile on the
//   welcome page that claims a feature which does not work would be
//   dishonest and must be caught at test time.
//
//   This file enforces the current honest state as a regression guard.
//   The welcome page can grow new tiles in future · each one must
//   point at a verified, guest-accessible NEX route AND must not
//   invent a chat / purchase / ownership surface that does not exist.
//
// Why this is a static source test (not a jsdom render test):
//   The page is a server component with a module-local inline
//   `insideCards` array. Extracting it to a separate exported module
//   would be a sealed-file edit for no runtime benefit. Reading the
//   source and asserting invariants against its text is the
//   lowest-blast-radius guard.
//
// Guardrails this test protects:
//   G1 · All three "insideCard" entries carry publicStatus: "open".
//        Guests MUST be able to reach every tile linked from here.
//   G2 · Every tile href starts with "/nex-native/" and points at
//        exactly one of the known guest-open NEX routes (library,
//        discover, community). No external URL, no payment URL, no
//        commerce-gated routes.
//   G3 · Primary + secondary CTAs route to the real sign-in and
//        create-account surfaces.
//   G4 · No tile text claims chat / purchase / ownership — these
//        features either exist elsewhere (chat requires signup
//        today) or do not exist yet (direct purchase is not wired).
//        A future refactor that adds a tile like "Start chatting
//        now" MUST either back it with a real guest-chat entry
//        AND update this allowlist, or the build fails here.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WELCOME_PAGE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "page.tsx",
);

const SOURCE = readFileSync(WELCOME_PAGE_PATH, "utf8");

// Known guest-open routes · a tile may ONLY point at one of these
// unless this allowlist is explicitly extended by a future authorised
// commit (in which case the matching route must prove guest-accessible
// with its own test).
// Canonical-directory doctrine 2026-10-17 · /nex-native/discover
// was a competing surface retired in favour of the one canonical
// /nex-native/directory/landing. The allowlist mirrors the server
// action's safeRedirects list.
const ALLOWED_TILE_HREFS: readonly string[] = [
  "/nex-native/chat-themes-library",
  "/nex-native/directory/landing",
  "/nex-native/community/feed",
  // Owner directive 2026-10-21 · the "Business NEX Chat" welcome
  // card now routes to a dedicated pre-signup intro that collects
  // business type + location. Mirror the server-side safeRedirects
  // list in _remember-intent-action.ts.
  "/nex-native/create-account/business-welcome",
  // Owner directive 2026-10-21 (iteration 15) · the "Free NEX Chat"
  // welcome card routes to the standard chat preview surface
  // (sealed nex-bubbles live-world theme). Mirror safeRedirects.
  "/nex-native/themes/nex-bubbles",
  // Owner directive 2026-10-21 (iteration 21) · splash intermediary.
  "/nex-native/welcome/entering-free-chat",
  // Owner directive 2026-10-21 (iteration 30 · rebuild) · standalone
  // minimal free chat surface.
  "/nex-native/free-chat",
] as const;

const PRIMARY_CTA_HREF = "/nex-native/create-account";
const SECONDARY_CTA_HREF = "/nex-native/sign-in";

// Phrases that would misrepresent the current product state. If any
// of these appears on the welcome page, something has gone wrong —
// direct theme purchase is not wired, guest chat is only reachable
// via commerce-gated business covers, and ownership is not granted
// without signup.
const FORBIDDEN_PHRASES: readonly string[] = [
  "buy now",
  "complete purchase",
  "pay now",
  "add to cart",
  "checkout",
  "you own",
  "payment success",
  "chat with anyone",
] as const;

// G4 refinement · owner-authorised 2026-10-20.
// The original forbidden list included the string "purchase theme" so
// a substring check would catch misleading CTAs like "Purchase Theme"
// (singular · implies the welcome page can buy one specific theme).
// The 2026-10-20 welcome rename introduces a tier BADGE labelled
// "PURCHASE THEMES" (plural · describes the category the user is
// about to visit, NOT an action available on the welcome page). The
// substring check collided with the plural, so the forbidden phrase
// was moved to this precision regex: catch singular "purchase theme"
// only (word boundary + negative lookahead for the trailing s). The
// semantic intent of G4 is preserved · no actual purchase CTA may
// appear on /welcome. */
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bpurchase theme\b(?!s)/i,
] as const;

describe("welcome page · honesty guardrails", () => {
  it("G1 · every insideCard tile carries publicStatus: 'open'", () => {
    // The sealed welcome page uses `publicStatus: "open"` for tiles
    // that are reachable without an account and `requires-account`
    // for anything else. Phase 1 should NEVER ship a tile marked
    // `requires-account` on the welcome page because that would
    // display a non-functional guest surface (sealed load-bearing
    // rule: "does not show controls for features that do not work").
    const openCount = (SOURCE.match(/publicStatus:\s*"open"/g) ?? []).length;
    const requiresAccountCount = (SOURCE.match(
      /publicStatus:\s*"requires-account"/g,
    ) ?? []).length;
    expect(requiresAccountCount).toBe(0);
    expect(openCount).toBeGreaterThanOrEqual(3);
  });

  it("G2 · every tile href is on the allowlist · no commerce-gated route, no external URL", () => {
    const hrefs = Array.from(
      SOURCE.matchAll(/href:\s*"(\/nex-native\/[^"]+)"/g),
    ).map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
    for (const href of hrefs) {
      expect(
        ALLOWED_TILE_HREFS.includes(href) ||
          href === PRIMARY_CTA_HREF ||
          href === SECONDARY_CTA_HREF ||
          href.startsWith("/nex-native/about/"),
        `href "${href}" is not on the welcome allowlist`,
      ).toBe(true);
    }
    // Explicit negative assertions on sealed commerce-gated routes.
    // (The business-slug route was retired 2026-11-06, so the matching
    //  entry was dropped from this fixture.)
    for (const commerceGated of [
      "/nex-native/cart",
      "/nex-native/orders",
      "/nex-native/manage/",
    ]) {
      expect(SOURCE.includes(`href: "${commerceGated}`)).toBe(false);
    }
  });

  it("G3 · primary CTA has two sealed shapes · guest → /create-account · signed-in → /home · secondary CTA → /sign-in (guest only)", () => {
    // Updated 2026-10-17 · owner-authorised welcome-as-landing · the
    // Welcome page now has TWO primary-CTA shapes selected at render:
    //   · Guest (viewer.kind !== "session"): the sealed "Create free
    //     account" link to PRIMARY_CTA_HREF (optionally carrying
    //     ?intent=<token> from the welcome-intent cookie) · plus the
    //     "Already have an account? Sign in" secondary.
    //   · Signed-in (viewer.kind === "session"): a "Continue to NEX"
    //     link to /nex-native/home · no secondary (user is already
    //     authenticated).
    // The invariants preserved from the earlier G3 are:
    //   · The guest-flow BASE URL is still /create-account (so the
    //     sealed signup chain is unchanged · intent is still a query
    //     param only).
    //   · The guest-flow secondary CTA is still the literal /sign-in
    //     href on the welcome allowlist.
    expect(SOURCE).toContain(PRIMARY_CTA_HREF);
    expect(SOURCE).toContain(`href="${SECONDARY_CTA_HREF}"`);
    // Guest-shape primary CTA still reads from the dynamic
    // createAccountHref variable (not hardcoded).
    expect(SOURCE).toMatch(/href=\{createAccountHref\}/);
    // Signed-in-shape primary CTA points at /nex-native/home.
    expect(SOURCE).toMatch(/href="\/nex-native\/home"/);
    // Both shapes must carry the sealed data-nex-welcome-primary-cta
    // identifier so Playwright and the welcome-intent instrumentation
    // can address them identically.
    expect(SOURCE).toMatch(/data-nex-welcome-primary-cta-shape="guest"/);
    expect(SOURCE).toMatch(/data-nex-welcome-primary-cta-shape="signed-in"/);
  });

  it("G4 · no forbidden purchase/ownership/chat phrases appear in the welcome source", () => {
    const haystack = SOURCE.toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(
        haystack.includes(phrase.toLowerCase()),
        `welcome page must not contain the phrase "${phrase}" · current product state does not back it`,
      ).toBe(false);
    }
    // Precision patterns · see FORBIDDEN_PATTERNS definition for the
    // 2026-10-20 refinement rationale (singular "purchase theme"
    // still forbidden · plural tier badge "purchase themes" allowed).
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(
        pattern.test(SOURCE),
        `welcome page must not match the pattern ${pattern} · current product state does not back it`,
      ).toBe(false);
    }
  });

  it("G5 · the sealed load-bearing rule is preserved in the file header", () => {
    // If a future refactor silently removes this comment, the test
    // flips red and surfaces the drift. The exact wording of the
    // rule can change · the gist cannot.
    expect(
      SOURCE.includes("Does not show controls for features that do not work"),
      "welcome page must preserve the sealed 'no fake controls' header rule",
    ).toBe(true);
  });

  it("G6 · signed-in branch is explicit · the welcome page distinguishes guest vs signed-in and never drops a signed-in viewer back into guest onboarding", () => {
    // Updated 2026-10-17 · owner-authorised welcome-as-landing. The
    // old invariant was "signed-in → redirect('/home')". The new
    // invariant is weaker but keeps the doctrine intact: a signed-in
    // viewer is routed through a signed-in branch (CTA → /home · no
    // signup secondary) · never through the guest signup CTA.
    expect(SOURCE).toMatch(/const\s+isSignedIn\s*=\s*viewer\.kind\s*===\s*["']session["']/);
    expect(SOURCE).toMatch(/\{isSignedIn\s*\?/);
  });

  it("G7 · the welcome page does NOT imply a theme-shop / buy-premium route (negative guard retained after blurb removal 2026-10-21)", () => {
    // Owner directive 2026-10-21 · the three welcome card blurbs
    // (including the "Chat Themes" card's "premium themes" mention)
    // were retired. The positive assertion ("blurb must contain
    // 'premium'") no longer applies because the blurb is empty.
    //
    // The NEGATIVE guard still matters: the dedicated "Theme Shop"
    // and "Premium Themes" routes do not exist today (sealed Phase 1
    // doctrine). A card or any other copy on this page that pointed
    // visitors there would be a dead-end. We now check the whole
    // SOURCE instead of a single blurb string so a future
    // reintroduction via title / chip / badge is also caught.
    const lower = SOURCE.toLowerCase();
    for (const phrase of ["theme shop", "shop premium", "buy premium"]) {
      expect(lower).not.toContain(phrase);
    }
  });
});
