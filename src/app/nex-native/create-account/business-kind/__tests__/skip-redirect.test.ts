// src/app/nex-native/create-account/business-kind/__tests__/skip-redirect.test.ts
//
// NEX · R1 regression · prove the business-kind "Skip" link does
// not create an infinite redirect loop with pick-theme.
// Owner-authorised corrective patch 2026-10-20.
// -----------------------------------------------------------------------------
// Original bug · a shop-intent user on /business-kind clicked "Skip
// for now · pick a theme" (a plain <Link href="/pick-theme">) · the
// user landed on /pick-theme which detected `intent=shop && !vertical`
// and redirected back to /business-kind · infinite ping-pong with
// no server-side state change to break it.
//
// Fix · the skip control is now a <form> that POSTs to
// `skipVerticalPickerAction` which writes a short-lived decline
// sentinel cookie. pick-theme now considers the sentinel in its
// redirect condition so skippers reach the theme picker.
//
// These are pure source-shape tests · they do NOT exercise the full
// Next.js stack because the integration between cookies, server
// actions, and the redirect() helper is best proven by Playwright.
// What we CAN pin here is: the exact code shape that breaks the
// loop, so a well-meaning future hand can't accidentally revive
// the <Link> or weaken the pick-theme gate.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseVerticalDeclined,
  WELCOME_VERTICAL_DECLINE_COOKIE,
  WELCOME_VERTICAL_DECLINE_MAX_AGE_SECONDS,
  WELCOME_VERTICAL_DECLINE_VALUE,
  welcomeVerticalDeclineCookieOptions,
} from "../../../welcome/_welcome-intent";

const BUSINESS_KIND_SRC = readFileSync(
  resolve(__dirname, "../page.tsx"),
  "utf8",
);
const SKIP_ACTION_SRC = readFileSync(
  resolve(__dirname, "../_skip-action.ts"),
  "utf8",
);
const PICK_THEME_SRC = readFileSync(
  resolve(__dirname, "../../pick-theme/page.tsx"),
  "utf8",
);

describe("R1 · decline sentinel · contract", () => {
  it("cookie name is the sealed 'nex_welcome_vertical_declined'", () => {
    expect(WELCOME_VERTICAL_DECLINE_COOKIE).toBe(
      "nex_welcome_vertical_declined",
    );
  });

  it("the max-age is short-lived (1 hour) per owner requirement", () => {
    expect(WELCOME_VERTICAL_DECLINE_MAX_AGE_SECONDS).toBe(60 * 60);
  });

  it("the single accepted value is '1' · parse rejects every other string", () => {
    expect(WELCOME_VERTICAL_DECLINE_VALUE).toBe("1");
    expect(parseVerticalDeclined(WELCOME_VERTICAL_DECLINE_VALUE)).toBe(true);
    for (const bad of ["0", "true", "", null, undefined, " 1", "1 ", "yes"]) {
      expect(parseVerticalDeclined(bad as string | null | undefined)).toBe(
        false,
      );
    }
  });

  it("cookie options are http-only / sameSite lax / path / correct max-age", () => {
    const opts = welcomeVerticalDeclineCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.maxAge).toBe(WELCOME_VERTICAL_DECLINE_MAX_AGE_SECONDS);
    expect(typeof opts.secure).toBe("boolean");
  });
});

describe("R1 · business-kind skip is a form POST, NOT a plain Link", () => {
  it("skip control is a <form action={skipVerticalPickerAction}>", () => {
    expect(BUSINESS_KIND_SRC).toMatch(
      /<form[\s\S]{0,200}?action=\{skipVerticalPickerAction\}/,
    );
  });

  it("skip control is a <button type='submit'> inside the form", () => {
    // The form wraps a button · a plain anchor would reintroduce the
    // original bug. Enforcing the button tag + submit type pins the
    // fix shape so a future refactor can't downgrade to a <Link>.
    expect(BUSINESS_KIND_SRC).toMatch(
      /<form[\s\S]{0,400}?<button[\s\S]{0,120}?type="submit"[\s\S]{0,120}?data-nex-business-kind-skip/,
    );
  });

  it("business-kind imports the skip server action", () => {
    expect(BUSINESS_KIND_SRC).toMatch(
      /import\s*\{\s*skipVerticalPickerAction\s*\}\s*from\s*["']\.\/_skip-action["']/,
    );
  });

  it("REGRESSION · business-kind must NOT contain a <Link href='/pick-theme'> for the skip control (the trap)", () => {
    // Non-skip Links are allowed · we specifically guard that the
    // skip control is not a <Link>. The data-attribute marker proves
    // we're inspecting the skip control.
    const skipRegion = BUSINESS_KIND_SRC.match(
      /data-nex-business-kind-skip[\s\S]{0,400}/,
    );
    expect(skipRegion).not.toBeNull();
    expect(skipRegion?.[0] ?? "").not.toMatch(/<Link\s/);
  });
});

describe("R1 · skip server action writes the sentinel then redirects", () => {
  it("is a 'use server' module", () => {
    expect(SKIP_ACTION_SRC.trim().startsWith('"use server"')).toBe(true);
  });

  it("writes the sentinel via writeVerticalDeclined()", () => {
    expect(SKIP_ACTION_SRC).toContain("writeVerticalDeclined()");
    expect(SKIP_ACTION_SRC).toMatch(
      /import\s*\{\s*writeVerticalDeclined\s*\}\s*from\s*["']\.\.\/\.\.\/welcome\/_welcome-intent["']/,
    );
  });

  it("redirects to /pick-theme AFTER writing the sentinel", () => {
    // Order matters · a redirect before the write would never
    // persist the cookie (Next's redirect throws). The regex pins
    // write → redirect ordering.
    expect(SKIP_ACTION_SRC).toMatch(
      /writeVerticalDeclined\(\)[\s\S]{0,400}?redirect\(\s*PICK_THEME_HREF\s*\)/,
    );
  });

  it("does NOT invent a subtype · never calls getPreset or writes WELCOME_VERTICAL_COOKIE", () => {
    expect(SKIP_ACTION_SRC).not.toContain("getPreset");
    expect(SKIP_ACTION_SRC).not.toContain("WELCOME_VERTICAL_COOKIE");
    expect(SKIP_ACTION_SRC).not.toContain('subtype:');
  });
});

describe("R1 · pick-theme redirect gate consults the decline sentinel", () => {
  it("reads the sentinel via readVerticalDeclined()", () => {
    expect(PICK_THEME_SRC).toContain("readVerticalDeclined");
    expect(PICK_THEME_SRC).toMatch(
      /const\s+declined\s*=\s*await\s+readVerticalDeclined\(\)/,
    );
  });

  it("REGRESSION · the redirect condition includes !declined so skippers are not bounced", () => {
    // Previously: `if (intent === "shop" && !vertical) redirect(...)`
    // Now:        `if (intent === "shop" && !vertical && !declined) redirect(...)`
    expect(PICK_THEME_SRC).toMatch(
      /intent\s*===\s*"shop"\s*&&\s*!vertical\s*&&\s*!declined/,
    );
  });

  it("the redirect still targets /business-kind for non-declined shop-no-vertical users (business-first journey preserved)", () => {
    // The owner-authorised behaviour is: a FRESH shop-intent user
    // with no decline still gets the business-first journey. Only
    // the explicit decline bypasses it. Non-shop intents are
    // never affected (gate requires intent === "shop").
    expect(PICK_THEME_SRC).toContain(
      '"/nex-native/create-account/business-kind"',
    );
  });
});
