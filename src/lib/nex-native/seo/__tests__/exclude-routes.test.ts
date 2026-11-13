// src/lib/nex-native/seo/__tests__/exclude-routes.test.ts

import { describe, expect, it } from "vitest";
import { isPrivatePath, PRIVATE_PATH_PREFIXES } from "../exclude-routes";

describe("isPrivatePath", () => {
  it("rejects empty / non-string", () => {
    expect(isPrivatePath("")).toBe(false);
    // @ts-expect-error · runtime guard
    expect(isPrivatePath(null)).toBe(false);
  });

  it("flags private manage routes", () => {
    expect(isPrivatePath("/nex-native/manage")).toBe(true);
    expect(isPrivatePath("/nex-native/manage/shop")).toBe(true);
    expect(isPrivatePath("/nex-native/manage/orders/abc")).toBe(true);
  });

  it("flags chat/attachments/HQ/vault", () => {
    expect(isPrivatePath("/nex-native/chat")).toBe(true);
    expect(isPrivatePath("/nex-native/chat/peer/xyz")).toBe(true);
    expect(isPrivatePath("/nex-native/hq")).toBe(true);
    expect(isPrivatePath("/nex-native/vault")).toBe(true);
    expect(isPrivatePath("/nex-native/free-chat/call/abc")).toBe(true);
  });

  it("flags auth surfaces", () => {
    expect(isPrivatePath("/sign-in")).toBe(true);
    expect(isPrivatePath("/sign-out")).toBe(true);
    expect(isPrivatePath("/auth/foo")).toBe(true);
  });

  it("flags API", () => {
    expect(isPrivatePath("/api")).toBe(true);
    expect(isPrivatePath("/api/nex-native/foo")).toBe(true);
  });

  it("does NOT flag public marketing routes", () => {
    expect(isPrivatePath("/nex-native")).toBe(false);
    expect(isPrivatePath("/nex-native/directory")).toBe(false);
    expect(isPrivatePath("/nex-native/directory/landing")).toBe(false);
    expect(isPrivatePath("/nex-native/pricing")).toBe(false);
    expect(isPrivatePath("/nex-native/about")).toBe(false);
    expect(isPrivatePath("/nex-native/for-sellers")).toBe(false);
    expect(isPrivatePath("/nex-native/for-creators")).toBe(false);
    expect(isPrivatePath("/nex-native/features/shops")).toBe(false);
    expect(isPrivatePath("/nex-native/developers")).toBe(false);
    expect(isPrivatePath("/nex-native/free-chat")).toBe(false);
    expect(isPrivatePath("/nex-native/ireland-entry")).toBe(false);
  });

  it("does not collide on prefix substrings", () => {
    // /aboutness should not be blocked by any /about prefix (none added · sanity check)
    expect(isPrivatePath("/nex-native/about-nex")).toBe(false);
    // /chat-themes-library must stay public even though prefix list has /chat
    expect(isPrivatePath("/nex-native/chat-themes-library")).toBe(false);
  });

  it("normalises missing leading slash", () => {
    expect(isPrivatePath("nex-native/manage")).toBe(true);
    expect(isPrivatePath("nex-native/pricing")).toBe(false);
  });

  it("has at least 10 sealed prefixes", () => {
    expect(PRIVATE_PATH_PREFIXES.length).toBeGreaterThanOrEqual(10);
  });
});
