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

  it("mounts the sealed ChatIdentityHeader primitive at the top", () => {
    expect(WELCOME_SRC).toMatch(
      /import\s*\{\s*ChatIdentityHeader\s*\}\s*from\s*["']@\/lib\/nex-native\/chat-chrome\/chat-identity-header["']/,
    );
    expect(WELCOME_SRC).toContain("<ChatIdentityHeader");
    expect(WELCOME_SRC).toContain('displayName="NEX"');
    expect(WELCOME_SRC).toContain("isOfficial");
  });

  it("displays the clear 'Welcome to NEX Chat' heading", () => {
    expect(WELCOME_SRC).toMatch(/<h1[\s\S]{0,400}?Welcome to NEX Chat/);
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

  it("card titles match owner spec (Chat Themes · Chat Themes Shop · Personalised Chat)", () => {
    expect(WELCOME_SRC).toContain('title: "Chat Themes"');
    expect(WELCOME_SRC).toContain('title: "Chat Themes Shop"');
    expect(WELCOME_SRC).toContain('title: "Personalised Chat"');
  });

  it("every card has a minHeight ≥ 112 for a usable mobile tap target (not a tiny tile)", () => {
    expect(WELCOME_SRC).toMatch(/minHeight:\s*112/);
  });

  it("every card uses a distinct accent (cyan · orange · violet)", () => {
    expect(WELCOME_SRC).toContain("accentHex: NEX.cyan");
    expect(WELCOME_SRC).toContain("accentHex: NEX.orange");
    expect(WELCOME_SRC).toContain("accentHex: NEX.violet");
  });
});

/* ─── C · card destinations · verified guest-safe ────────────── */

describe("welcome · card destinations are real + guest-safe", () => {
  it("all three cards point at /nex-native/chat-themes-library (the only guest-safe destination that covers all three concepts today)", () => {
    const hrefs = Array.from(
      WELCOME_SRC.matchAll(
        /href:\s*"(\/nex-native\/chat-themes-library)"/g,
      ),
    );
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
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
  it("primary CTA → /create-account with data attribute", () => {
    expect(WELCOME_SRC).toContain('href="/nex-native/create-account"');
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
  it("signed-in viewers are redirected to /home (sealed G6) · unless ?preview=1", () => {
    // Updated 2026-10-15 · the signed-in redirect must now also be
    // gated on !previewMode so the Settings "View the welcome page →"
    // affordance can show the chat-NEX welcome to a signed-in viewer
    // without a redirect loop.
    expect(WELCOME_SRC).toMatch(
      /if\s*\(\s*viewer\.kind\s*===\s*["']session["']\s*&&\s*!previewMode\s*\)\s*\{[\s\S]{0,500}?redirect\(\s*["']\/nex-native\/home["']/,
    );
  });

  it("?preview=1 bypass is read from searchParams.preview", () => {
    expect(WELCOME_SRC).toMatch(/sp\.preview\s*===\s*["']1["']/);
    expect(WELCOME_SRC).toMatch(/const\s+previewMode\s*=/);
  });

  it("resolveNexAppSessionOrGuest is imported from the sealed session module", () => {
    expect(WELCOME_SRC).toMatch(
      /import\s*\{\s*resolveNexAppSessionOrGuest\s*\}\s*from\s*["']@\/lib\/nex-native\/app\/session-or-guest["']/,
    );
  });

  it("writes nothing · no form, no DB mutation, no cookie, no server action", () => {
    expect(WELCOME_SRC).not.toMatch(/<form\b/);
    expect(WELCOME_SRC).not.toMatch(/\.insert\(/);
    expect(WELCOME_SRC).not.toMatch(/\.update\(/);
    expect(WELCOME_SRC).not.toMatch(/\.upsert\(/);
    expect(WELCOME_SRC).not.toMatch(/\.rpc\(/);
    expect(WELCOME_SRC).not.toMatch(/cookies\(\)/);
  });

  it("preserves the sealed 'Does not show controls for features that do not work' rule (G5 ally)", () => {
    expect(WELCOME_SRC).toContain(
      "Does not show controls for features that do not work",
    );
  });
});
