// src/app/nex-native/home/__tests__/first-visit-invitation.test.ts
//
// B9/B10 follow-up · Option 1 · first-visit entry wire-up · 2026-10-14.
//
// Two layers of coverage:
//
//   (A) Pure predicate · shouldShowFirstVisitInvitation(count)
//       Exhaustive truth-table against the brief's requirements:
//         "A reliably loaded account with zero conversations sees it"
//         "An account with one or more conversations does not"
//         "Loading and error states do not incorrectly classify as new"
//
//   (B) Source-shape integration on home/page.tsx
//       Locks the following invariants so a future refactor cannot
//       silently detach the invitation from its reliable count source:
//         · peer-conversation-service imported
//         · listPeerConversationsForAccount added to the Promise.all
//         · .catch returns null (fail-safe)
//         · showFirstVisitInvitation derived from the shared predicate
//         · the conditional render guards the invitation node
//         · no automatic redirect to /first-visit introduced
//         · no DB mutation introduced
//
// The pure-predicate tests inject a plain number · they do not touch
// Supabase, process.env, cookies, or any real session. The source-
// shape tests use readFileSync + grep-style assertions.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  shouldShowFirstVisitInvitation,
  FIRST_VISIT_DESTINATION,
} from "../_first-visit-invitation";

const HOME_SRC = readFileSync(
  resolve(__dirname, "..", "page.tsx"),
  "utf8",
);
const INVITATION_SRC = readFileSync(
  resolve(__dirname, "..", "_first-visit-invitation.tsx"),
  "utf8",
);

// ─── Layer A · pure predicate ────────────────────────────────────

describe("shouldShowFirstVisitInvitation · pure predicate", () => {
  // Positive case · the ONLY truthy case.
  it("returns true for an integer 0 (zero conversations)", () => {
    expect(shouldShowFirstVisitInvitation(0)).toBe(true);
  });

  // Negative cases · positive integers (existing conversations).
  it("returns false for 1 (user has one conversation)", () => {
    expect(shouldShowFirstVisitInvitation(1)).toBe(false);
  });

  it("returns false for 2 / 5 / 100 / Number.MAX_SAFE_INTEGER", () => {
    expect(shouldShowFirstVisitInvitation(2)).toBe(false);
    expect(shouldShowFirstVisitInvitation(5)).toBe(false);
    expect(shouldShowFirstVisitInvitation(100)).toBe(false);
    expect(shouldShowFirstVisitInvitation(Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  // Loading / error · must never classify as new.
  it("returns false for null (query errored or not yet resolved)", () => {
    expect(shouldShowFirstVisitInvitation(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(shouldShowFirstVisitInvitation(undefined)).toBe(false);
  });

  // Adversarial · pathological / malformed numeric inputs.
  it("returns false for negative integers (impossible count)", () => {
    expect(shouldShowFirstVisitInvitation(-1)).toBe(false);
    expect(shouldShowFirstVisitInvitation(-100)).toBe(false);
  });

  it("returns false for NaN / Infinity / -Infinity", () => {
    expect(shouldShowFirstVisitInvitation(Number.NaN)).toBe(false);
    expect(shouldShowFirstVisitInvitation(Number.POSITIVE_INFINITY)).toBe(false);
    expect(shouldShowFirstVisitInvitation(Number.NEGATIVE_INFINITY)).toBe(false);
  });

  it("returns false for non-integer finite numbers (defensive)", () => {
    expect(shouldShowFirstVisitInvitation(0.5)).toBe(false);
    expect(shouldShowFirstVisitInvitation(1.5)).toBe(false);
    expect(shouldShowFirstVisitInvitation(-0.1)).toBe(false);
  });

  it("returns false for non-number types (type-system escape hatch)", () => {
    // These shapes should not reach this helper at runtime because
    // the TS signature constrains to `number | null | undefined`.
    // But the function hardens defensively against any accidental
    // widening (e.g. a Supabase row shape bug returning `"0"` as a
    // string).
    const bad: unknown[] = ["0", "", {}, [], true, false];
    for (const v of bad) {
      expect(
        shouldShowFirstVisitInvitation(v as unknown as number),
        `must be false for ${JSON.stringify(v)}`,
      ).toBe(false);
    }
  });

  it("exports the canonical destination constant", () => {
    expect(FIRST_VISIT_DESTINATION).toBe("/nex-native/chat/first-visit");
  });
});

// ─── Layer B · home page integration (source-shape) ──────────────

describe("home/page.tsx · retired-redirect contract (no integration left)", () => {
  // Owner directive 2026-10-19 · /nex-native/home as a standalone
  // surface is retired. page.tsx is now a thin permanentRedirect to
  // /nex-native/contacts. The sealed `shouldShowFirstVisitInvitation`
  // predicate + `_first-visit-invitation.tsx` component continue to
  // live as reusable modules consumed by /contacts (covered by the
  // pure-predicate block above + the component block below). The
  // tests here just lock the retired-redirect contract so the shim
  // does not silently rot.

  it("uses permanentRedirect from next/navigation", () => {
    expect(HOME_SRC).toMatch(
      /import\s*\{\s*permanentRedirect\s*\}\s*from\s*["']next\/navigation["']/,
    );
    expect(HOME_SRC).toContain("permanentRedirect(");
  });

  it("redirects to /nex-native/contacts (not /chat/first-visit, not any new surface)", () => {
    expect(HOME_SRC).toContain('permanentRedirect("/nex-native/contacts")');
    expect(HOME_SRC).not.toMatch(/permanentRedirect\(["']\/nex-native\/chat/);
  });

  it("does NOT re-introduce the retired FirstVisitInvitation render path", () => {
    expect(HOME_SRC).not.toContain("FirstVisitInvitation");
    expect(HOME_SRC).not.toContain("shouldShowFirstVisitInvitation");
    expect(HOME_SRC).not.toContain("listPeerConversationsForAccount");
  });

  it("does NOT introduce a new cookie set, DB write, or RPC call", () => {
    expect(HOME_SRC).not.toMatch(/cookies\(\)\.set\(/);
    expect(HOME_SRC).not.toMatch(/\.insert\(/);
    expect(HOME_SRC).not.toMatch(/\.update\(/);
    expect(HOME_SRC).not.toMatch(/\.upsert\(/);
    expect(HOME_SRC).not.toMatch(/\.rpc\(/);
  });

  it("preserves the force-dynamic + nodejs runtime", () => {
    expect(HOME_SRC).toContain('export const runtime = "nodejs"');
    expect(HOME_SRC).toContain('export const dynamic = "force-dynamic"');
  });
});

// ─── Layer C · invitation component (source-shape) ───────────────

describe("_first-visit-invitation.tsx · structure", () => {
  it("links to the canonical first-visit destination", () => {
    expect(INVITATION_SRC).toMatch(
      /href=\{FIRST_VISIT_DESTINATION\}/,
    );
    expect(INVITATION_SRC).toContain(
      'export const FIRST_VISIT_DESTINATION = "/nex-native/chat/first-visit"',
    );
  });

  it("is a server-render-only module (no 'use client' directive)", () => {
    expect(INVITATION_SRC).not.toMatch(/^\s*"use client"/m);
  });

  it("declares an aria-label for keyboard / screen-reader users", () => {
    expect(INVITATION_SRC).toMatch(/aria-label="Take a quick tour of NEX themes/);
  });

  it("exposes a data attribute so e2e selectors can hook in later", () => {
    expect(INVITATION_SRC).toContain("data-nex-home-first-visit-invitation");
  });

  it("does NOT set state (no cookies, no form, no onClick)", () => {
    expect(INVITATION_SRC).not.toMatch(/cookies\(\)/);
    expect(INVITATION_SRC).not.toMatch(/<form\b/);
    expect(INVITATION_SRC).not.toMatch(/onClick=/);
    expect(INVITATION_SRC).not.toMatch(/onSubmit=/);
  });

  it("does NOT reference any sealed service module", () => {
    for (const bad of [
      "tier-gate",
      "product-service",
      "account-service",
      "launch-flags",
      "recordIfAllowed",
      "vault-",
    ]) {
      expect(INVITATION_SRC.includes(bad), `must not reference ${bad}`).toBe(false);
    }
  });

  it("accepts an optional accent prop with a sensible NEX-cyan default", () => {
    expect(INVITATION_SRC).toMatch(/accent\?:\s*string/);
    expect(INVITATION_SRC).toContain('accent = "#00AFFF"');
  });

  it("mobile-first styles · explicit max-content-column friendliness", () => {
    // The home content column is sealed at `maxWidth: 420`. The
    // invitation card renders inside and must not overflow.
    expect(INVITATION_SRC).toMatch(/overflow:\s*"hidden"/);
    expect(INVITATION_SRC).toContain("minWidth: 0");
  });
});
