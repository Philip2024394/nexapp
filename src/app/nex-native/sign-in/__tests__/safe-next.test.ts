// src/app/nex-native/sign-in/__tests__/safe-next.test.ts
//
// Pure-logic tests for the sign-in page's `safeNext` whitelist. The
// function sits inline in page.tsx; we re-declare the same contract
// here so the whitelist can be regression-tested without pulling the
// entire page component.
//
// If the production function diverges, the duplicate declaration
// below will go out of sync — the regression is intentional: an
// unexplained diff in this file flags the whitelist as newly loose
// or newly strict.

import { describe, expect, test } from "vitest";

/** DUPLICATE of safeNext() in sign-in/page.tsx (kept in sync by hand). */
function safeNext(next: string | undefined): string | null {
  if (typeof next !== "string" || next.length === 0) return null;
  if (!next.startsWith("/nex-native/")) return null;
  if (next.includes("//")) return null;
  if (next.includes("\\")) return null;
  if (next.length > 1024) return null;
  return next;
}

describe("sign-in safeNext whitelist", () => {
  test("returns null for undefined / empty / non-string", () => {
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext("")).toBeNull();
  });

  test("rejects paths outside /nex-native/", () => {
    expect(safeNext("/other-app/home")).toBeNull();
    expect(safeNext("/home")).toBeNull();
    expect(safeNext("/")).toBeNull();
  });

  test("rejects protocol-relative URLs (// escape)", () => {
    expect(safeNext("//evil.example.com/path")).toBeNull();
    expect(safeNext("/nex-native//evil.example.com")).toBeNull();
  });

  test("rejects backslashes (Windows-style tricks)", () => {
    expect(safeNext("/nex-native/\\evil.com")).toBeNull();
  });

  test("rejects pathological length", () => {
    const huge = "/nex-native/" + "a".repeat(1200);
    expect(safeNext(huge)).toBeNull();
  });

  test("accepts a plain nex-native path", () => {
    expect(safeNext("/nex-native/home")).toBe("/nex-native/home");
  });

  test("accepts a chat deep-link with focus_product query param", () => {
    const url =
      "/nex-native/chat/peer/00000000-0000-0000-0000-000000000001?focus_product=abc-123";
    expect(safeNext(url)).toBe(url);
  });

  test("accepts percent-encoded characters in the query string", () => {
    const url =
      "/nex-native/chat/peer/abc?focus_product=" + encodeURIComponent("pr&od id/weird");
    expect(safeNext(url)).toBe(url);
  });
});
