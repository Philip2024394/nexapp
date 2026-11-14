// src/app/nex-native/chat/peer/[accountId]/__tests__/e2e-text-hook-prod-guard.test.ts
//
// Owner-authorised 2026-11-14 · Vault Privacy Completion Pass.
// -----------------------------------------------------------------
// Negative test · proves the dev/test-only composer text-insertion
// hook's guard predicate (shouldInstallE2eTextHook) returns FALSE in
// every configuration except the one that pairs a build-time env
// opt-in with an explicit `?e2e=1` URL param.
//
// Production bundles never carry NEXT_PUBLIC_NEX_E2E_HOOKS=1, so the
// predicate is false regardless of query-param manipulation · the
// `window.__NEX_E2E_INSERT_COMPOSER_TEXT__` global can never be
// installed from a production build.

import { describe, expect, test } from "vitest";
import { shouldInstallE2eTextHook } from "../_e2e-text-hook";

describe("E2eTextHook · production guard predicate", () => {
  test("refuses when env var is undefined (production-like)", () => {
    expect(shouldInstallE2eTextHook(undefined, "?e2e=1")).toBe(false);
    expect(shouldInstallE2eTextHook(undefined, "")).toBe(false);
  });

  test("refuses when env var is empty string", () => {
    expect(shouldInstallE2eTextHook("", "?e2e=1")).toBe(false);
  });

  test("refuses when env var is '0'", () => {
    expect(shouldInstallE2eTextHook("0", "?e2e=1")).toBe(false);
  });

  test("refuses when env var is 'true' (only literal '1' passes)", () => {
    expect(shouldInstallE2eTextHook("true", "?e2e=1")).toBe(false);
  });

  test("refuses when env is '1' but URL has no ?e2e=1", () => {
    expect(shouldInstallE2eTextHook("1", "")).toBe(false);
    expect(shouldInstallE2eTextHook("1", "?other=1")).toBe(false);
  });

  test("refuses when env is '1' and URL has ?e2e=0 or ?e2e=2", () => {
    expect(shouldInstallE2eTextHook("1", "?e2e=0")).toBe(false);
    expect(shouldInstallE2eTextHook("1", "?e2e=2")).toBe(false);
    expect(shouldInstallE2eTextHook("1", "?e2e=true")).toBe(false);
  });

  test("ALLOWS only when env is '1' AND URL has ?e2e=1", () => {
    expect(shouldInstallE2eTextHook("1", "?e2e=1")).toBe(true);
    expect(shouldInstallE2eTextHook("1", "?e2e=1&other=foo")).toBe(true);
    expect(shouldInstallE2eTextHook("1", "?other=foo&e2e=1")).toBe(true);
  });
});
