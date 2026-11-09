// src/lib/nex-native/device/__tests__/key-generation-client.test.ts
//
// Phase 2 Sprint 1 · unit tests for the client-side public-key format
// validator. Key GENERATION itself requires WebCrypto which is browser-only
// · covered by Phase E journey J-1 integration test (post Phase D Sprint 1).

import { describe, expect, it } from "vitest";
import { isPublicKeyBase64Valid } from "../key-generation-client";

describe("isPublicKeyBase64Valid", () => {
  it("accepts a well-formed base64 public key", () => {
    expect(
      isPublicKeyBase64Valid("BASE64_PUBLIC_KEY_ROUGHLY_FORTY_FIVE_CHARS_LONG_X"),
    ).toBe(true);
  });

  it("rejects non-string", () => {
    expect(isPublicKeyBase64Valid(123 as unknown)).toBe(false);
    expect(isPublicKeyBase64Valid(null)).toBe(false);
    expect(isPublicKeyBase64Valid(undefined)).toBe(false);
  });

  it("rejects strings under 32 chars", () => {
    expect(isPublicKeyBase64Valid("short")).toBe(false);
  });

  it("rejects strings over 2048 chars", () => {
    expect(isPublicKeyBase64Valid("A".repeat(2049))).toBe(false);
  });

  it("rejects strings with whitespace or unicode", () => {
    expect(isPublicKeyBase64Valid(" " + "A".repeat(40))).toBe(false);
    expect(isPublicKeyBase64Valid("🔑" + "A".repeat(40))).toBe(false);
  });
});
