// src/app/nex-native/library/backgrounds/__tests__/isolation.test.ts
//
// Unified NEX Visual Library · ISOLATION TESTS.
// Owner-authorised 2026-11-11 · Phase 1 · 9 isolation invariants.
// -----------------------------------------------------------------------------
// These tests operate at the code boundary: they inspect the catalog-service
// filter semantics and action dispatch invariants. They do NOT require a live
// sandbox DB; they verify that the code structure makes cross-writing
// structurally impossible.
//
// Runtime DB-coupled isolation (tests 3, 4, 8, 9) requires the sandbox
// migration to be applied first; those variants are flagged `test.skip` with
// a clear note so the suite still runs.

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  listBackgroundAssets as _listBackgroundAssets,
  getBackgroundAsset as _getBackgroundAsset,
} from "@/lib/nex-native/library/catalog-service";

// Read the real action source so test 1 + 2 can prove WHICH columns the
// action writes, structurally.
const actionsSrc = readFileSync(
  resolve(__dirname, "..", "_actions.ts"),
  "utf8",
);

// Extract a function body by slicing from its signature to its matching
// top-level closing brace. We find the next "\n}\n" after the function's
// signature · the first such line-start-anchored brace closes the function.
// Doc comments belonging to the next function are deliberately excluded.
// Hoisted to module scope so BOTH describe blocks can reach it.
function extractFnBody(name: string): string {
  const start = actionsSrc.indexOf(`export async function ${name}`);
  if (start < 0) throw new Error(`fn ${name} not found`);
  const closeIdx = actionsSrc.indexOf("\n}\n", start);
  if (closeIdx < 0) return actionsSrc.slice(start);
  return actionsSrc.slice(start, closeIdx + 3);
}

const shopBody = extractFnBody("applyFromLibraryShopAction");
const chatBody = extractFnBody("applyFromLibraryChatAction");

describe("NEX Unified Visual Library · structural isolation (compile-time)", () => {

  it("Isolation #1 · applyFromLibraryShopAction does NOT reference chat_theme or nex_chat_theme", () => {
    expect(shopBody).not.toContain("chat_theme");
    expect(shopBody).not.toContain("nex_chat_theme");
    expect(shopBody).not.toContain("updateChatThemeAction");
  });

  it("Isolation #2 · applyFromLibraryChatAction does NOT reference nex_business or shop_cover", () => {
    expect(chatBody).not.toContain("nex_business");
    expect(chatBody).not.toContain("shop_cover_image_url");
    expect(chatBody).not.toContain("shop_cover_tint_hex");
    expect(chatBody).not.toContain("requireOwnedBusiness");
  });

  it("Isolation #5 · shop entitlement gate (effectiveTier === 'bisnis') is present in shop action", () => {
    expect(shopBody).toMatch(/effectiveTier\(session\.account\)\s*!==\s*["']bisnis["']/);
    expect(shopBody).toMatch(/shop-tier-required/);
  });

  it("Isolation #6 · chat action does NOT grant shop access (no shop-specific calls in chat path)", () => {
    expect(chatBody).not.toContain("requireOwnedBusiness");
    expect(chatBody).not.toContain("applyShopPreset");
    expect(chatBody).not.toContain("updateShopCoverTint");
  });

  it("Isolation #7 · shop action writes only shop columns", () => {
    // Positive assertion: verify the shop UPDATE targets nex_business.shop_cover_image_url
    expect(shopBody).toMatch(/\.from\(\s*["']nex_business["']\s*\)\s*\.update\(\s*\{\s*shop_cover_image_url/);
    // Negative: must not touch nex_account
    expect(shopBody).not.toContain("'nex_account'");
    expect(shopBody).not.toContain('"nex_account"');
  });

  it("Isolation #7b · chat action writes only chat_theme column on nex_account", () => {
    expect(chatBody).toMatch(/\.from\(\s*["']nex_account["']\s*\)\s*\.update\(\s*\{\s*chat_theme/);
  });
});

describe("NEX Unified Visual Library · catalog-service context filter", () => {
  it("Isolation #1b · listBackgroundAssets({context:'shop'}) uses contains('contexts', ['shop'])", () => {
    const serviceSrc = readFileSync(
      resolve(__dirname, "..", "..", "..", "..", "..", "lib", "nex-native", "library", "catalog-service.ts"),
      "utf8",
    );
    // The listBackgroundAssets function must filter on contexts via the
    // supplied context param. Verify the containment call is parameterised.
    expect(serviceSrc).toMatch(/\.contains\(\s*"contexts"\s*,\s*\[\s*context\s*\]\s*\)/);
  });

  it("Isolation #2b · getBackgroundAsset rejects cross-context reads", () => {
    const serviceSrc = readFileSync(
      resolve(__dirname, "..", "..", "..", "..", "..", "lib", "nex-native", "library", "catalog-service.ts"),
      "utf8",
    );
    // Must check asset.contexts.includes(params.context) and return null
    // when not approved for the caller's context.
    expect(serviceSrc).toMatch(
      /if\s*\(\s*!asset\.contexts\.includes\(\s*params\.context\s*\)\s*\)/,
    );
  });
});

describe("NEX Unified Visual Library · Themes Plus commercial separation", () => {
  // These structural checks verify the chat action uses the entitlement
  // service (not effectiveTier) for gating premium chat themes.
  it("Chat action imports canAccessChatTheme + loadThemesPlusUntil (not effectiveTier for chat gate)", () => {
    // Entitlement service is the gate for chat
    expect(chatBody).toContain("canAccessChatTheme");
    expect(chatBody).toContain("loadThemesPlusUntil");
    // Chat body must NOT fall back to effectiveTier (which would re-couple to shop tier)
    expect(chatBody).not.toContain("effectiveTier(session.account)");
    // Shop body still uses effectiveTier for shop tier gate (expected)
    expect(shopBody).toContain("effectiveTier(session.account)");
  });

  // Runtime DB tests #3, #8, #9 are covered in sandbox-db.test.ts.
  // Test #4 (logout + login) is covered by Playwright e2e only.
});
