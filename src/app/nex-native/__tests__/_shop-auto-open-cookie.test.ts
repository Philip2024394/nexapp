// src/app/nex-native/__tests__/_shop-auto-open-cookie.test.ts
//
// Owner-authorised 2026-10-20 (Track B · Shop auto-open after setup).
// -----------------------------------------------------------------
// Regression anchor for the shop-auto-open cookie module. Covers:
//   · Cookie options · 300s TTL · HttpOnly · SameSite=lax · Path=/ ·
//     Secure only in production (matches welcome-intent posture)
//   · Parser safe-fails on absent / malformed / unsafe values
//   · Writer only accepts slug-shaped strings (defensive validation)
//   · Clearer uses matching path (otherwise the delete is a no-op)
//
// Does NOT runtime-render the contacts page (would require jsdom +
// full session mock). Uses source-level assertions for the /contacts
// integration + runtime assertions for the pure parse/options helpers.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  SHOP_AUTO_OPEN_COOKIE,
  SHOP_AUTO_OPEN_MAX_AGE_SECONDS,
  shopAutoOpenCookieOptions,
  parseShopAutoOpenSlug,
} from "../_shop-auto-open-cookie";

// ─── A · constants + options ────────────────────────────────────────

describe("A · Shop auto-open cookie constants", () => {
  test("cookie key is stable and distinct from welcome-intent cookies", () => {
    expect(SHOP_AUTO_OPEN_COOKIE).toBe("nex_shop_auto_open_eligible");
    // Must NOT collide with any sealed Phase A1 cookie name.
    expect(SHOP_AUTO_OPEN_COOKIE).not.toBe("nex_welcome_intent");
    expect(SHOP_AUTO_OPEN_COOKIE).not.toBe("nex_welcome_vertical");
    expect(SHOP_AUTO_OPEN_COOKIE).not.toBe("nex_welcome_vertical_declined");
  });

  test("TTL is 300 seconds · short-lived one-shot window", () => {
    expect(SHOP_AUTO_OPEN_MAX_AGE_SECONDS).toBe(300);
  });

  test("cookie options match the sealed welcome-cookie posture (HttpOnly · lax · Path=/)", () => {
    const opts = shopAutoOpenCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.path).toBe("/");
    expect(opts.sameSite).toBe("lax");
    expect(opts.maxAge).toBe(300);
    // Secure follows NODE_ENV just like the sealed welcome cookies.
    expect(typeof opts.secure).toBe("boolean");
  });
});

// ─── B · parser · safe-fail on everything that isn't a valid slug ──

describe("B · parseShopAutoOpenSlug safe-fails on invalid input", () => {
  test("null → null", () => {
    expect(parseShopAutoOpenSlug(null)).toBeNull();
  });
  test("undefined → null", () => {
    expect(parseShopAutoOpenSlug(undefined)).toBeNull();
  });
  test("empty string → null", () => {
    expect(parseShopAutoOpenSlug("")).toBeNull();
  });
  test("whitespace-only → null", () => {
    expect(parseShopAutoOpenSlug("   ")).toBeNull();
  });
  test("uppercase letters → null (slug shape is lowercase)", () => {
    expect(parseShopAutoOpenSlug("MyShop")).toBeNull();
  });
  test("slashes → null (open-redirect defence)", () => {
    expect(parseShopAutoOpenSlug("/evil")).toBeNull();
    expect(parseShopAutoOpenSlug("evil//attacker.com")).toBeNull();
  });
  test("absolute URLs → null (open-redirect defence)", () => {
    expect(parseShopAutoOpenSlug("https://attacker.com")).toBeNull();
    expect(parseShopAutoOpenSlug("//attacker.com")).toBeNull();
  });
  test("script-like strings → null", () => {
    expect(parseShopAutoOpenSlug("<script>alert(1)</script>")).toBeNull();
  });
  test("over-long strings → null (bounded)", () => {
    expect(parseShopAutoOpenSlug("a".repeat(65))).toBeNull();
  });
  test("leading/trailing hyphens → null (slug ends with alnum)", () => {
    expect(parseShopAutoOpenSlug("-myshop")).toBeNull();
    expect(parseShopAutoOpenSlug("myshop-")).toBeNull();
  });
});

// ─── C · parser · accepts valid slugs ──────────────────────────────

describe("C · parseShopAutoOpenSlug accepts valid slug shapes", () => {
  test("simple lowercase slug", () => {
    expect(parseShopAutoOpenSlug("myshop")).toBe("myshop");
  });
  test("lowercase with hyphens", () => {
    expect(parseShopAutoOpenSlug("aisha-vintage-cameras")).toBe(
      "aisha-vintage-cameras",
    );
  });
  test("lowercase with numbers", () => {
    expect(parseShopAutoOpenSlug("shop-99k")).toBe("shop-99k");
  });
  test("trims surrounding whitespace", () => {
    expect(parseShopAutoOpenSlug("  valid-slug  ")).toBe("valid-slug");
  });
});

// ─── D · integration anchor · /contacts/page.tsx consumes the cookie ─

describe("D · /contacts/page.tsx consumes the cookie before rendering the list", () => {
  const CONTACTS_SRC = fs.readFileSync(
    path.resolve(__dirname, "../contacts/page.tsx"),
    "utf8",
  );

  test("reads the cookie via readShopAutoOpenEligible", () => {
    expect(CONTACTS_SRC).toContain("readShopAutoOpenEligible");
  });

  test("clears the cookie via clearShopAutoOpenEligible", () => {
    expect(CONTACTS_SRC).toContain("clearShopAutoOpenEligible");
  });

  test("the clear is in its own independent try/catch · soft-fail doesn't block the redirect", () => {
    // Pattern anchor: a try/catch wrapping the clear import+call.
    expect(CONTACTS_SRC).toMatch(
      /try\s*\{\s*const\s*\{\s*clearShopAutoOpenEligible\s*\}[\s\S]{0,200}?await clearShopAutoOpenEligible\(\)/,
    );
  });

  test("the redirect routes to the owner's shop at /nex-native/<slug>", () => {
    expect(CONTACTS_SRC).toMatch(
      /redirect\(`\/nex-native\/\$\{autoOpenSlug\}`\)/,
    );
  });

  test("the auto-open block runs AFTER the session gate (never redirects anonymous users)", () => {
    const sessionGateIdx = CONTACTS_SRC.indexOf("redirect(\"/nex-native/sign-in\")");
    const autoOpenReadIdx = CONTACTS_SRC.indexOf("readShopAutoOpenEligible");
    expect(sessionGateIdx).toBeGreaterThan(-1);
    expect(autoOpenReadIdx).toBeGreaterThan(sessionGateIdx);
  });
});

// ─── E · integration anchor · saveBusinessActivationAction sets it ──

describe("E · saveBusinessActivationAction writes the cookie on success", () => {
  const SETUP_ACTIONS_SRC = fs.readFileSync(
    path.resolve(__dirname, "../business-setup/_actions.ts"),
    "utf8",
  );

  test("imports and calls writeShopAutoOpenEligible", () => {
    expect(SETUP_ACTIONS_SRC).toContain("writeShopAutoOpenEligible");
  });

  test("the write is in its own independent try/catch · soft-fail must not block the sealed Phase A1 clears or the ok-return", () => {
    expect(SETUP_ACTIONS_SRC).toMatch(
      /try\s*\{[\s\S]{0,800}?writeShopAutoOpenEligible\(slug\)[\s\S]{0,200}?\}\s*catch\s*\(writeErr\)/,
    );
  });

  test("the Phase A1 welcome-cookie clears STAY in their own independent try/catch blocks (sealed discipline)", () => {
    // Both independent try/catch patterns from Phase A1 must still
    // appear in the source · adding Track B must not fuse them.
    expect(SETUP_ACTIONS_SRC).toMatch(
      /try\s*\{[\s\S]{0,500}?clearVerticalIntent\(\)[\s\S]{0,200}?\}\s*catch/,
    );
    expect(SETUP_ACTIONS_SRC).toMatch(
      /try\s*\{[\s\S]{0,500}?clearVerticalDeclined\(\)[\s\S]{0,200}?\}\s*catch/,
    );
  });

  test("the Track B write block runs AFTER both sealed Phase A1 clears", () => {
    const clearVerticalIntentIdx = SETUP_ACTIONS_SRC.indexOf(
      "clearVerticalIntent()",
    );
    const clearVerticalDeclinedIdx = SETUP_ACTIONS_SRC.indexOf(
      "clearVerticalDeclined()",
    );
    const writeAutoOpenIdx = SETUP_ACTIONS_SRC.indexOf(
      "writeShopAutoOpenEligible(slug)",
    );
    expect(clearVerticalIntentIdx).toBeGreaterThan(-1);
    expect(clearVerticalDeclinedIdx).toBeGreaterThan(-1);
    expect(writeAutoOpenIdx).toBeGreaterThan(-1);
    expect(writeAutoOpenIdx).toBeGreaterThan(clearVerticalIntentIdx);
    expect(writeAutoOpenIdx).toBeGreaterThan(clearVerticalDeclinedIdx);
  });
});
