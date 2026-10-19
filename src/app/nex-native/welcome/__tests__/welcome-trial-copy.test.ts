// src/app/nex-native/welcome/__tests__/welcome-trial-copy.test.ts
//
// NEX · D4 · "Chat Themes Shop" card copy regression guard.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Why this test exists
//
//   Pre-D4 copy at src/app/nex-native/welcome/page.tsx said:
//     "Browse premium themes · 7 days free when you join."
//
//   That phrase implied the 7-day themes trial starts automatically
//   on signup (and / or on tapping the Shop intent card). In reality
//   the trial is a one-shot, lifetime-per-account action gated by
//   the sealed `startThemesTrial` server action (Bridge 56g at
//   src/lib/nex-native/account-service.ts:353). Signup, Shop-intent
//   selection, and S2's Building step all deliberately leave the
//   trial UNTOUCHED.
//
// What this test pins
//
//   G-D4-1 · The welcome page source does NOT contain the retired
//            "7 days free when you join" phrase (or close variants
//            that would re-introduce the auto-start promise).
//   G-D4-2 · The welcome page source DOES contain the new honest
//            copy that calls the trial optional AND notes the
//            one-per-account cap.
//   G-D4-3 · The welcome page source does NOT contain phrasing
//            that promises the trial starts automatically ("free
//            with signup", "free when you sign up", "trial starts
//            automatically", "trial activated on signup").
//   G-D4-4 · The welcome page source does NOT claim universal
//            eligibility ("every user gets", "guaranteed free").
//
// Static source-content check · same pattern the sealed
// `welcome-honesty.test.ts` uses · zero DOM, zero React render.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const WELCOME_PAGE_PATH = path.resolve(
  process.cwd(),
  "src/app/nex-native/welcome/page.tsx",
);

function readWelcomeSource(): string {
  return fs.readFileSync(WELCOME_PAGE_PATH, "utf8");
}

// Strip code comments before matching so a correctly-written
// doctrine comment ("the old '7 days free when you join' phrase
// was retired") doesn't false-positive on G-D4-1.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("Welcome · Chat Themes Shop · trial copy honesty · D4", () => {
  test("G-D4-1 · the retired 'X days free when you join' phrase is gone from live code", () => {
    const code = stripComments(readWelcomeSource());
    // Match any digit · the retired copy was "7 days free when you
    // join" but we guard against a near-identical reintroduction.
    expect(code).not.toMatch(/\d+\s+days?\s+free\s+when\s+you\s+join/i);
    // Also guard against "free when you sign up" variants.
    expect(code).not.toMatch(/free\s+when\s+you\s+sign\s*up/i);
    expect(code).not.toMatch(/free\s+when\s+you\s+join/i);
  });

  test("G-D4-2 · new copy describes the trial as OPTIONAL · 7-DAY · BISNIS · ONE-PER-ACCOUNT", () => {
    const code = stripComments(readWelcomeSource());
    // Owner directive 2026-10-18 · the trial unlocks the Bisnis
    // tier via `effectiveTier` returning "bisnis" during the
    // window · the welcome copy must disclose that explicitly so
    // "free trial" cannot be read as a generic always-on freebie.
    expect(code).toMatch(/optional\s+7-day\s+free\s+bisnis\s+trial/i);
    expect(code).toMatch(/one\s+per\s+account/i);
  });

  test("G-D4-3 · no phrase promises auto-start on signup / Shop intent", () => {
    const code = stripComments(readWelcomeSource());
    expect(code).not.toMatch(/trial\s+starts\s+automatically/i);
    expect(code).not.toMatch(/trial\s+activated\s+on\s+signup/i);
    expect(code).not.toMatch(/automatically\s+start.{0,20}trial/i);
    expect(code).not.toMatch(/trial\s+begins\s+when\s+you/i);
    // "free with signup" and "signup includes" are also sneaky
    // reintroductions · forbid them.
    expect(code).not.toMatch(/free\s+with\s+signup/i);
    expect(code).not.toMatch(/signup\s+includes.{0,15}trial/i);
  });

  test("G-D4-4 · no phrase claims universal / guaranteed eligibility", () => {
    const code = stripComments(readWelcomeSource());
    expect(code).not.toMatch(/every\s+user\s+gets.{0,25}trial/i);
    expect(code).not.toMatch(/guaranteed\s+free/i);
    expect(code).not.toMatch(/anyone\s+can\s+start.{0,20}trial/i);
  });

  test("G-D4-5 · doctrine anchor · live code never consumes trial time implicitly", () => {
    const code = stripComments(readWelcomeSource());
    // The welcome page must not import or invoke the sealed trial
    // starter · consuming a trial from an anonymous welcome surface
    // would violate the one-per-account rule AND silently burn the
    // user's trial without consent.
    expect(code).not.toMatch(/\bstartThemesTrial\s*\(/);
    expect(code).not.toMatch(
      /from\s+["'][^"']*account-service[^"']*["'][\s\S]{0,200}startThemesTrial/,
    );
  });
});
