// src/lib/nex-native/account-wall/__tests__/pending-action.test.ts
//
// NEX Account Wall · Phase 0 security seal.
// Tests the `isAllowedNextUrl` guard against open-redirect / path-
// confusion / smuggling attempts. These are the invariants the whole
// wall primitive leans on; drift here means a malicious page can
// redirect a freshly-signed-up user to a phishing clone.

import { describe, test, expect, vi } from "vitest";

// pending-action.ts imports "server-only" to block client-bundle use.
// Vitest doesn't ship a server/client split, so stub the module.
vi.mock("server-only", () => ({}));

import { isAllowedNextUrl } from "../pending-action";

describe("isAllowedNextUrl · security seal", () => {
  test("accepts the canonical post-signup return path", () => {
    expect(isAllowedNextUrl("/nex-native/home")).toBe(true);
    expect(isAllowedNextUrl("/nex-native/chat-themes-library")).toBe(true);
    expect(isAllowedNextUrl("/nex-native/themes/coffee")).toBe(true);
    expect(isAllowedNextUrl("/nex-native/community/feed?level=district")).toBe(true);
  });

  test("rejects non-/nex-native/ local paths", () => {
    expect(isAllowedNextUrl("/sign-in")).toBe(false);
    expect(isAllowedNextUrl("/api/malicious")).toBe(false);
    expect(isAllowedNextUrl("/")).toBe(false);
  });

  test("rejects protocol-relative URLs (//evil.com)", () => {
    expect(isAllowedNextUrl("//evil.example.com/phish")).toBe(false);
  });

  test("rejects full absolute URLs", () => {
    expect(isAllowedNextUrl("https://evil.example.com/")).toBe(false);
    expect(isAllowedNextUrl("http://localhost/nex-native/home")).toBe(false);
  });

  test("rejects javascript: URLs", () => {
    expect(isAllowedNextUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedNextUrl("javascript:/nex-native/home")).toBe(false);
  });

  test("rejects data: URLs", () => {
    expect(isAllowedNextUrl("data:text/html,<script>")).toBe(false);
  });

  test("rejects path traversal (..)", () => {
    expect(isAllowedNextUrl("/nex-native/../etc/passwd")).toBe(false);
    expect(isAllowedNextUrl("/nex-native/..")).toBe(false);
    expect(isAllowedNextUrl("/nex-native/foo/../../bar")).toBe(false);
  });

  test("rejects backslash path confusion (Windows-style)", () => {
    expect(isAllowedNextUrl("/nex-native\\evil")).toBe(false);
    expect(isAllowedNextUrl("\\\\evil.example.com\\path")).toBe(false);
  });

  test("rejects null/undefined/empty", () => {
    expect(isAllowedNextUrl(null)).toBe(false);
    expect(isAllowedNextUrl(undefined)).toBe(false);
    expect(isAllowedNextUrl("")).toBe(false);
  });

  test("rejects over-length nextUrl (anti-bloat)", () => {
    const long = "/nex-native/" + "a".repeat(500);
    expect(isAllowedNextUrl(long)).toBe(false);
  });

  test("rejects paths with spaces (encourage encoding)", () => {
    expect(isAllowedNextUrl("/nex-native/foo bar")).toBe(false);
  });

  test("accepts encoded query strings", () => {
    expect(
      isAllowedNextUrl("/nex-native/community/feed?level=district&m=hi"),
    ).toBe(true);
  });

  test("rejects double-slash within the path (ambiguous)", () => {
    expect(isAllowedNextUrl("/nex-native//sneaky")).toBe(false);
  });
});
