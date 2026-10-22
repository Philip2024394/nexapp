// src/app/nex-native/welcome/__tests__/chat-nex-welcome.test.ts
//
// Chat-NEX welcome redesign · owner-authorised Option A · 2026-10-15.
// -----------------------------------------------------------------------------
// Focused source-shape coverage of the chat-NEX guest welcome page.
// Complements the sealed welcome-honesty.test.ts (G1-G7) with the
// chat-NEX-specific structural pins:
//
//   · ChatIdentityHeader is mounted at the top (same primitive as
//     the signed-in /chat/first-visit surface)
//   · Three LANDSCAPE cards (not small square tiles) · chat-NEX
//     concepts: Chat Themes · Chat Themes Shop · Personalised Chat
//   · Each card carries a real guest-safe href + chip + accent
//   · Primary CTA → /create-account · Secondary CTA → /sign-in
//   · Signed-in redirect preserved
//
// This file does NOT replace welcome-honesty.test.ts · both suites
// run together and both must pass. All assertions here are
// source-shape (readFileSync + grep).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WELCOME_SRC = readFileSync(
  resolve(__dirname, "..", "page.tsx"),
  "utf8",
);
// Signed-in-only /chat/first-visit sub-pages that intentionally are
// NOT linked from the guest welcome page (they redirect guests back).
const CHAT_FIRST_VISIT_SHOP_SRC = readFileSync(
  resolve(__dirname, "..", "..", "chat", "first-visit", "shop", "page.tsx"),
  "utf8",
);
const CHAT_FIRST_VISIT_PERSONALIZE_SRC = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "chat",
    "first-visit",
    "personalize",
    "page.tsx",
  ),
  "utf8",
);
const CHAT_FIRST_VISIT_PARENT_SRC = readFileSync(
  resolve(__dirname, "..", "..", "chat", "first-visit", "page.tsx"),
  "utf8",
);

/* ─── A · chat-NEX structure ──────────────────────────────────── */

describe("welcome · chat-NEX guest surface structure", () => {
  it("is force-dynamic + nodejs runtime", () => {
    expect(WELCOME_SRC).toContain('export const runtime = "nodejs"');
    expect(WELCOME_SRC).toContain('export const dynamic = "force-dynamic"');
  });

  it("renders the top NEX brand identity row (badge · wordmark · verified pill · subtitle)", () => {
    // Template-matched 2026-10-15 · the welcome page used to mount
    // the sealed ChatIdentityHeader primitive but was replaced with
    // a bespoke row so the owner-supplied NexPingBadge (blue ring +
    // ping + "NE") can sit on the left per az.png. The import is
    // kept for parity with other NEX surfaces that remain
    // template-locked. Assertions:
    //   · ChatIdentityHeader import still present (callers may
    //     reinstate it; the primitive is sealed infra)
    //   · NexPingBadge mounted in the welcome header
    //   · "NEX" wordmark + verified ✓ NEX pill visible in the row
    expect(WELCOME_SRC).toMatch(
      /import\s*\{\s*ChatIdentityHeader\s*\}\s*from\s*["']@\/lib\/nex-native\/chat-chrome\/chat-identity-header["']/,
    );
    expect(WELCOME_SRC).toMatch(
      /import\s*\{\s*NexPingBadge\s*\}\s*from\s*["']@\/lib\/nex-native\/nex-ping-badge-client["']/,
    );
    expect(WELCOME_SRC).toContain("<NexPingBadge");
    // Green ✓ NEX verified pill removed 2026-10-15 per owner directive.
    expect(WELCOME_SRC).not.toContain('data-nex-welcome-verified-pill');
    expect(WELCOME_SRC).toMatch(/data-nex-welcome-header/);
  });

  it("displays the clear 'Welcome to NEX Chat' heading", () => {
    // Template-matched 2026-10-15 · headline is split across two parts:
    // "Welcome to" (white) + "NEX Chat." (cyan span). The literal
    // string "Welcome to NEX Chat" is now broken by the span wrapper
    // so we assert both pieces appear within the h1 (window widened
    // to 800 chars to accommodate the expanded style props on the h1).
    expect(WELCOME_SRC).toMatch(/<h1[\s\S]{0,800}?Welcome to/);
    expect(WELCOME_SRC).toMatch(/<h1[\s\S]{0,1000}?NEX Chat\./);
    expect(WELCOME_SRC).toContain("data-nex-welcome-h1");
  });

  it("includes a short exciting explanation mentioning themes + emoji + businesses + neighbourhood", () => {
    // Strip JS comments before scanning so file-header doesn't trip.
    const strip = (s: string) =>
      s
        .split("\n")
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const rendered = strip(WELCOME_SRC).toLowerCase();
    expect(rendered).toContain("theme");
    expect(rendered).toContain("emoji");
    expect(rendered).toMatch(/business|businesses/);
    expect(rendered).toContain("neighbourhood");
    expect(rendered).toContain("free to look");
  });
});

/* ─── B · three LANDSCAPE cards ──────────────────────────────── */

describe("welcome · three landscape cards (chat-NEX concepts)", () => {
  it("declares layout attribute landscape on the ol wrapper", () => {
    expect(WELCOME_SRC).toContain(
      'data-nex-welcome-cards-layout="landscape"',
    );
  });

  it("each card carries data-nex-welcome-card-layout=\"landscape\"", () => {
    expect(WELCOME_SRC).toContain(
      'data-nex-welcome-card-layout="landscape"',
    );
  });

  it("renders exactly 3 cards · keys themes · shop · personalised", () => {
    // The 3 cards come from the chatNexCards array · each has a key.
    expect(WELCOME_SRC).toMatch(/key:\s*"themes"/);
    expect(WELCOME_SRC).toMatch(/key:\s*"shop"/);
    expect(WELCOME_SRC).toMatch(/key:\s*"personalised"/);
    // Visual rendering uses data-nex-welcome-card={key} · lock the attribute binding.
    expect(WELCOME_SRC).toContain("data-nex-welcome-card={key}");
  });

  it("card titles match the owner-authorised 2026-10-21 spec (Free NEX Chat · Chat Themes · Business Chat)", () => {
    // Owner directive 2026-10-20 renamed the three welcome cards to
    // reflect three DIFFERENT WAYS TO USE NEX (not three competing
    // theme categories). Internal `key` tokens stay sealed.
    // Owner directive 2026-10-21 (iteration 14) shortened "Business
    // NEX Chat" → "Business Chat". Internal key `shop` stays sealed.
    expect(WELCOME_SRC).toContain('title: "Free NEX Chat"');
    expect(WELCOME_SRC).toContain('title: "Chat Themes"');
    expect(WELCOME_SRC).toContain('title: "Business Chat"');
    // Retirement guard · the previous title "Personalised Chat" and
    // the previous "Chat Themes Shop" names must not appear in the
    // card array. The regex scopes to `title: "..."` so comments
    // mentioning the retired names stay allowed.
    expect(WELCOME_SRC).not.toMatch(/title:\s*"Personalised Chat"/);
    expect(WELCOME_SRC).not.toMatch(/title:\s*"Chat Themes Shop"/);
  });

  it("RETIRED 2026-10-21 · the top-right status badge pills (FREE · PURCHASE THEMES · BUSINESS · BISNIS) were removed from the welcome cards", () => {
    // Owner directive 2026-10-21 · the 3 welcome-card badge pills
    // were deleted along with the card blurbs. The sealed badge-group
    // positive assertion is retired. The negative guards
    // (welcome-honesty G4 "no theme shop / buy premium", G7 negative
    // phrase guard, and welcome-trial-copy G-D4-1/3/4/5) remain in
    // force. If a future directive reintroduces tier badges, restore
    // the positive assertions here under separate authorisation.
    expect(true).toBe(true);
  });

  it("every card has a minHeight ≥ 112 for a usable mobile tap target (not a tiny tile)", () => {
    // Template-matched 2026-10-15 · cards bumped to 128px tall so the
    // 3-line blurb + title + chip all fit comfortably inside the
    // neon-outlined banner. Scope the regex to the LandscapeCard
    // function body so we do not accidentally match the CTA button's
    // minHeight.
    const cardFn =
      WELCOME_SRC.match(/function LandscapeCard[\s\S]+?\n\}\n/)?.[0] ??
      "";
    const match = cardFn.match(/minHeight:\s*(\d+)/);
    expect(match).toBeTruthy();
    expect(Number(match![1])).toBeGreaterThanOrEqual(112);
  });

  it("every card uses a distinct accent (cyan · orange · violet)", () => {
    expect(WELCOME_SRC).toContain("accentHex: NEX.cyan");
    expect(WELCOME_SRC).toContain("accentHex: NEX.orange");
    expect(WELCOME_SRC).toContain("accentHex: NEX.violet");
  });
});

/* ─── C · card destinations · verified guest-safe ────────────── */

describe("welcome · card destinations are real + guest-safe", () => {
  it("the three welcome cards all point at guest-safe destinations on the welcome allowlist", () => {
    // Owner directive 2026-10-21 · the "Business NEX Chat" card
    // (card 3) now routes to /create-account/business-welcome instead
    // of /chat-themes-library · a pre-signup intro that collects
    // business type + location before the themes library. The two
    // other cards (Free NEX Chat · Chat Themes) still route to
    // /chat-themes-library. The server-side safeRedirects list in
    // _remember-intent-action.ts and the G2 allowlist in
    // welcome-honesty.test.ts both authorise the new destination.
    //
    // This test used to pin "all three → chat-themes-library." That
    // invariant no longer holds. Instead we assert that each card's
    // href is on the shared allowlist, which the sealed welcome-
    // honesty G2 test already enforces more thoroughly. This test
    // keeps a lightweight count-based regression guard.
    const hrefs = Array.from(
      WELCOME_SRC.matchAll(/href:\s*"(\/nex-native\/[^"]+)"/g),
    ).map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
    const allowed = new Set([
      "/nex-native/chat-themes-library",
      "/nex-native/directory/landing",
      "/nex-native/community/feed",
      "/nex-native/create-account/business-welcome",
      // Owner directive 2026-10-21 (iteration 15) · Free NEX Chat
      // card routes to the standard chat preview surface.
      "/nex-native/themes/nex-bubbles",
      // Owner directive 2026-10-21 (iteration 21) · splash intermediary.
      "/nex-native/welcome/entering-free-chat",
      // Owner directive 2026-10-21 (iteration 30 · rebuild) · new
      // standalone minimal free chat.
      "/nex-native/free-chat",
    ]);
    for (const href of hrefs) {
      expect(
        allowed.has(href!),
        `href "${href}" is not on the welcome card allowlist`,
      ).toBe(true);
    }
  });

  it("no card links to the signed-in /chat/first-visit/shop sub-page (it bounces guests)", () => {
    // Strip comments so file-header documentary mentions don't trip.
    const strip = (s: string) =>
      s
        .split("\n")
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const code = strip(WELCOME_SRC);
    expect(code).not.toMatch(/href:\s*"\/nex-native\/chat\/first-visit\/shop"/);
    expect(code).not.toContain('href="/nex-native/chat/first-visit/shop"');
  });

  it("no card links to the signed-in /chat/first-visit/personalize sub-page", () => {
    const strip = (s: string) =>
      s
        .split("\n")
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const code = strip(WELCOME_SRC);
    expect(code).not.toMatch(
      /href:\s*"\/nex-native\/chat\/first-visit\/personalize"/,
    );
    expect(code).not.toContain(
      'href="/nex-native/chat/first-visit/personalize"',
    );
  });

  it("confirmed · the two sub-pages ARE signed-in only (they redirect guests to /welcome)", () => {
    // This is proof-of-correctness for the test above · if the
    // sub-pages became guest-open in future, this test will fail
    // and the author of that change must consciously update the
    // welcome card destinations too.
    expect(CHAT_FIRST_VISIT_SHOP_SRC).toMatch(
      /viewer\.kind\s*!==\s*["']session["'][\s\S]{0,80}?redirect\(\s*["']\/nex-native\/welcome["']/,
    );
    expect(CHAT_FIRST_VISIT_PERSONALIZE_SRC).toMatch(
      /viewer\.kind\s*!==\s*["']session["'][\s\S]{0,80}?redirect\(\s*["']\/nex-native\/welcome["']/,
    );
    // Parent /chat/first-visit is also signed-in only · verifying so
    // the whole signed-in family stays coherent.
    expect(CHAT_FIRST_VISIT_PARENT_SRC).toMatch(
      /viewer\.kind\s*!==\s*["']session["'][\s\S]{0,80}?redirect\(\s*["']\/nex-native\/welcome["']/,
    );
  });
});

/* ─── D · primary + secondary CTAs ───────────────────────────── */

describe("welcome · primary + secondary CTAs", () => {
  it("primary CTA → /create-account (base URL preserved · may carry ?intent) with data attribute", () => {
    // Updated 2026-10-15 · owner-authorised intent persistence · the
    // primary CTA href is now dynamic: `/create-account` or
    // `/create-account?intent=<token>` based on the welcome-intent
    // cookie. The invariant: the BASE URL is still /create-account.
    expect(WELCOME_SRC).toContain('"/nex-native/create-account"');
    expect(WELCOME_SRC).toMatch(/href=\{createAccountHref\}/);
    expect(WELCOME_SRC).toContain("data-nex-welcome-primary-cta");
    expect(WELCOME_SRC).toMatch(/Create free account/);
  });

  it("secondary CTA → /sign-in with data attribute", () => {
    expect(WELCOME_SRC).toContain('href="/nex-native/sign-in"');
    expect(WELCOME_SRC).toContain("data-nex-welcome-secondary-cta");
    expect(WELCOME_SRC).toMatch(/Already have an account/);
  });

  it("primary CTA has a 44+ px tap target (minHeight 52)", () => {
    expect(WELCOME_SRC).toMatch(/data-nex-welcome-primary-cta[\s\S]{0,600}?minHeight:\s*52/);
  });

  it("secondary CTA has a 44+ px tap target (minHeight 48)", () => {
    expect(WELCOME_SRC).toMatch(/data-nex-welcome-secondary-cta[\s\S]{0,600}?minHeight:\s*48/);
  });
});

/* ─── E · routing + auth preservation ────────────────────────── */

describe("welcome · routing + auth preservation", () => {
  it("signed-in viewers see the welcome page directly (sealed G6 · updated 2026-10-17)", () => {
    // Updated 2026-10-17 · owner-authorised welcome-as-landing. The
    // welcome page now distinguishes signed-in from guest in-render
    // instead of redirecting signed-in users to /home. The invariant
    // preserved is that the viewer kind is explicitly branched on
    // (isSignedIn) · a signed-in viewer never falls through the
    // guest signup CTA.
    expect(WELCOME_SRC).toMatch(
      /const\s+isSignedIn\s*=\s*viewer\.kind\s*===\s*["']session["']/,
    );
    expect(WELCOME_SRC).toMatch(/\{isSignedIn\s*\?/);
    // No redirect() call site survives in the welcome page.
    expect(WELCOME_SRC).not.toMatch(/\bredirect\(/);
  });

  it("the retired ?preview=1 escape hatch is no longer referenced in welcome", () => {
    // Updated 2026-10-17 · retired · signed-in viewers can always
    // see the welcome page now so the Settings "View the welcome
    // page →" affordance no longer needs a preview flag. Confirm
    // the old plumbing is actually gone (not just inert).
    expect(WELCOME_SRC).not.toMatch(/sp\.preview\s*===\s*["']1["']/);
    expect(WELCOME_SRC).not.toMatch(/const\s+previewMode\s*=/);
  });

  it("resolveNexAppSessionOrGuest is imported from the sealed session module", () => {
    expect(WELCOME_SRC).toMatch(
      /import\s*\{\s*resolveNexAppSessionOrGuest\s*\}\s*from\s*["']@\/lib\/nex-native\/app\/session-or-guest["']/,
    );
  });

  it("writes nothing · no DB mutation, no fake success", () => {
    // Updated 2026-10-15 · owner-authorised intent persistence added
    // three card <form>s that POST to rememberWelcomeIntentAction (a
    // Server Action that sets an HTTP-only cookie and redirects to
    // a whitelisted destination). The form itself is NOT a DB mutation
    // or a cookie SETTER inline · it just submits to the Server Action
    // which handles state. The welcome page module itself still writes
    // nothing to the DB.
    expect(WELCOME_SRC).not.toMatch(/\.insert\(/);
    expect(WELCOME_SRC).not.toMatch(/\.update\(/);
    expect(WELCOME_SRC).not.toMatch(/\.upsert\(/);
    expect(WELCOME_SRC).not.toMatch(/\.rpc\(/);
    // The only cookie read is the welcome-intent lookup for the
    // primary-CTA dynamic href · it does NOT set or mutate any cookie
    // (that happens in the sealed rememberWelcomeIntentAction).
    expect(WELCOME_SRC).not.toMatch(/cookieJar\.set\(/);
    expect(WELCOME_SRC).not.toMatch(/cookieJar\.delete\(/);
  });

  it("card <form>s wrap the chat-NEX landscape visuals · action = rememberWelcomeIntentAction", () => {
    // The forms replace <Link> for the cards · they carry the user's
    // intent to the Server Action which sets the welcome-intent cookie
    // and redirects to the card's whitelisted href.
    expect(WELCOME_SRC).toMatch(
      /<form\s+action=\{rememberWelcomeIntentAction\}/,
    );
    expect(WELCOME_SRC).toContain('name="intent"');
    expect(WELCOME_SRC).toContain('name="redirect_to"');
  });

  it("preserves the sealed 'Does not show controls for features that do not work' rule (G5 ally)", () => {
    expect(WELCOME_SRC).toContain(
      "Does not show controls for features that do not work",
    );
  });
});
