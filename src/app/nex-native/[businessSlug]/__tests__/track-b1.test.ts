// src/app/nex-native/[businessSlug]/__tests__/track-b1.test.ts
//
// Track B.1 · NEX Bisnis end-to-end · 2026-10-14.
// -----------------------------------------------------------------------------
// Focused source-shape coverage of the Track B.1 scope:
//   · PersonaliseInvitation component · owner-only · honest copy
//   · Shop page mutually-exclusive banner selection
//     (SetupCompleteBanner when ?setup=complete, PersonaliseInvitation
//     otherwise, nothing for non-owners)
//   · No completion-state derivation from chat_theme or cover_layout_id
//   · No new DB column / migration / cookie / flag
//   · Sealed createFirstProductAction redirect byte-identical
//
// All assertions are source-shape (readFileSync + grep-style). No DB,
// no mocks of sealed services, no Supabase, no DOM.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const INVITATION_SRC = readFileSync(
  resolve(__dirname, "..", "_personalise-invitation.tsx"),
  "utf8",
);
const SHOP_PAGE_SRC = readFileSync(
  resolve(__dirname, "..", "page.tsx"),
  "utf8",
);
const BANNER_SRC = readFileSync(
  resolve(__dirname, "..", "_setup-complete-banner.tsx"),
  "utf8",
);
const SEALED_ACTIONS_SRC = readFileSync(
  resolve(__dirname, "..", "..", "_actions.ts"),
  "utf8",
);

/* ─── A · PersonaliseInvitation structure + honesty ──────────── */

describe("_personalise-invitation.tsx · structure", () => {
  it("is server-render-safe (no 'use client')", () => {
    expect(INVITATION_SRC.trimStart().startsWith('"use client"')).toBe(false);
  });

  it("exports PersonaliseInvitation and typed props", () => {
    expect(INVITATION_SRC).toContain(
      "export function PersonaliseInvitation",
    );
    expect(INVITATION_SRC).toContain(
      "export interface PersonaliseInvitationProps",
    );
  });

  it("links to the sealed Phase 2 Step 1 route with businessId", () => {
    expect(INVITATION_SRC).toMatch(
      /\/nex-native\/business-setup\/make-it-yours\/theme\?businessId=\$\{encodeURIComponent\(business\.id\)\}/,
    );
  });

  it("exposes a data-attribute for e2e selectors", () => {
    expect(INVITATION_SRC).toContain("data-nex-personalise-invitation");
    expect(INVITATION_SRC).toContain("data-nex-personalise-invitation-cta");
    expect(INVITATION_SRC).toContain(
      "data-nex-personalise-invitation-headline",
    );
  });

  it("reads only PUBLIC fields from the business row", () => {
    // Strip comments before scanning so file-header disclaimers don't trip.
    const strip = (s: string) =>
      s
        .split("\n")
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const code = strip(INVITATION_SRC);
    // Public reads: id, slug, display_name. These are all customer-facing.
    expect(code).toContain("business.id");
    expect(code).toContain("business.display_name");
    // Must NOT read sensitive / private-potential fields.
    for (const forbidden of [
      "business.profile.",
      "business.owner_account_id",
      "business.phone",
      "business.email",
      "business.description",
    ]) {
      expect(code.includes(forbidden), `must not read ${forbidden}`).toBe(
        false,
      );
    }
  });

  it("does NOT infer completion from chat_theme or cover_layout_id (owner's rule)", () => {
    const strip = (s: string) =>
      s
        .split("\n")
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const code = strip(INVITATION_SRC);
    expect(code).not.toMatch(/chat_theme/);
    expect(code).not.toMatch(/cover_layout_id/);
  });

  it("honest copy · no 'setup incomplete' or 'setup complete' claim", () => {
    const strip = (s: string) =>
      s
        .split("\n")
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const rendered = strip(INVITATION_SRC).toLowerCase();
    expect(rendered).not.toMatch(/setup incomplete/);
    expect(rendered).not.toMatch(/not yet set up/);
    expect(rendered).not.toMatch(/you haven't completed/);
    expect(rendered).not.toMatch(/setup complete/);
    expect(rendered).toContain("always optional");
  });

  it("writes nothing · no form, no mutation, no cookie, no server action bypass", () => {
    // Strip comments before scanning so file-header disclaimers
    // referencing sealed server actions don't trip the regex.
    const strip = (s: string) =>
      s
        .split("\n")
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const code = strip(INVITATION_SRC);
    expect(code).not.toMatch(/<form\b/);
    expect(code).not.toMatch(/\.insert\(/);
    expect(code).not.toMatch(/\.update\(/);
    expect(code).not.toMatch(/\.upsert\(/);
    expect(code).not.toMatch(/\.rpc\(/);
    expect(code).not.toMatch(/cookies\(\)/);
    expect(code).not.toMatch(/createFirstProductAction/);
    expect(code).not.toMatch(/createBusinessAction/);
  });

  it("mobile tap target · CTA has minHeight >= 32 (36 recommended for 44 total with padding)", () => {
    expect(INVITATION_SRC).toMatch(/minHeight:\s*36/);
  });
});

/* ─── B · Shop page mutually-exclusive banner selection ─────── */

describe("[businessSlug]/page.tsx · owner-only banner selection", () => {
  it("imports both banner candidates lazily inside the gate", () => {
    expect(SHOP_PAGE_SRC).toContain('./_setup-complete-banner');
    expect(SHOP_PAGE_SRC).toContain('./_personalise-invitation');
    // Lazy / dynamic imports to keep the shop page RSC bundle small
    expect(SHOP_PAGE_SRC).toMatch(
      /const\s*\{\s*SetupCompleteBanner\s*\}\s*=\s*await\s+import/,
    );
    expect(SHOP_PAGE_SRC).toMatch(
      /const\s*\{\s*PersonaliseInvitation\s*\}\s*=\s*await\s+import/,
    );
  });

  it("mutually exclusive · ?setup=complete branch mounts SetupCompleteBanner · else branch mounts PersonaliseInvitation", () => {
    // The sp.setup === "complete" branch must mount SetupCompleteBanner.
    expect(SHOP_PAGE_SRC).toMatch(
      /if\s*\(\s*sp\.setup\s*===\s*["']complete["']\s*\)[\s\S]{0,400}?SetupCompleteBanner/,
    );
    // The else branch must mount PersonaliseInvitation.
    expect(SHOP_PAGE_SRC).toMatch(
      /\}\s*else\s*\{[\s\S]{0,400}?PersonaliseInvitation/,
    );
  });

  it("both banner mounts owner-gate via account.id === owner_account_id", () => {
    // Both mounts are inside their own session + ownership guard.
    const matches = SHOP_PAGE_SRC.match(
      /\.account\.id\s*===\s*business\.owner_account_id/g,
    );
    expect(matches, "both setup + invitation guards must exist").not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves the sealed commerce gate before the owner check", () => {
    // The commerce redirect must run BEFORE the banner logic.
    expect(SHOP_PAGE_SRC).toMatch(
      /commerceEnabledForRequest\(sp\)[\s\S]{0,200}?redirect\(\s*["']\/nex-native\/home["']/,
    );
  });

  it("still injects {setupBanner} above the cover-A render path (Track B pin preserved)", () => {
    expect(SHOP_PAGE_SRC).toMatch(
      /\{setupBanner\}[\s\S]{0,200}?<CoverThemeSkin/,
    );
  });

  it("still injects {setupBanner} above the legacy landing render path (Track B pin preserved)", () => {
    expect(SHOP_PAGE_SRC).toMatch(/\{setupBanner\}[\s\S]{0,100}?TOP HEADER/);
  });
});

/* ─── C · owner-only · non-owners never see the invitation ─── */

describe("[businessSlug]/page.tsx · ownership gate on PersonaliseInvitation", () => {
  it("session resolution happens inside the else branch · guest arrives at null", () => {
    expect(SHOP_PAGE_SRC).toMatch(
      /\}\s*else\s*\{[\s\S]{0,200}?resolveNexAppSessionFromContext/,
    );
  });

  it("the invitation mount is guarded by inviteSession presence AND ownership", () => {
    // The gate must require BOTH a non-null session AND the owner-check.
    expect(SHOP_PAGE_SRC).toMatch(
      /inviteSession\s*&&[\s\S]{0,80}?inviteSession\.account\.id\s*===\s*business\.owner_account_id/,
    );
  });
});

/* ─── D · sealed surfaces preserved ─────────────────────────── */

describe("sealed surfaces · untouched by Track B.1", () => {
  it("createFirstProductAction terminal redirect to /{slug} preserved", () => {
    // Walking the sealed action's redirect contract. The redirect
    // target `/nex-native/${business.slug}` must still be the terminal
    // step of createFirstProductAction (sealed 2026-10-01).
    expect(SEALED_ACTIONS_SRC).toMatch(
      /createFirstProductAction[\s\S]{0,5000}?redirect\(\s*`\/nex-native\/\$\{business\.slug\}`?/,
    );
  });

  it("setup-complete banner source untouched by this track", () => {
    // The deriveVisibility helper must still be exported with the
    // same contract (Track B pin).
    expect(BANNER_SRC).toContain("export function deriveVisibility");
    expect(BANNER_SRC).toContain("data-nex-setup-complete-banner");
  });

  it("sealed createBusinessAction terminal redirect preserved", () => {
    expect(SEALED_ACTIONS_SRC).toMatch(
      /redirect\([\s\S]{0,40}?`\/nex-native\/onboarding\/first-product\?slug=\$\{encodeURIComponent\(business\.slug\)\}`/,
    );
  });
});
