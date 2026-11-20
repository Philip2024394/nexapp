// src/lib/nex-native/translation/client/__tests__/translation-cache.test.ts
//
// Deterministic unit tests for the in-memory translation cache.
// Owner-authorised 2026-11-17 · local verification only.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as cache from "../translation-cache";

const KEY = (overrides: Partial<cache.TranslationCacheKey> = {}) =>
  ({
    accountId: "acc-1",
    conversationId: "conv-1",
    messageId: "msg-1",
    contentVersion: "v1",
    targetLang: "id",
    ...overrides,
  }) satisfies cache.TranslationCacheKey;

const VALUE = (translation: string): cache.TranslationCacheValue => ({
  translation,
  detectedSourceLanguage: "en",
  fetchedAt: Date.now(),
});

describe("translation-cache · basic", () => {
  beforeEach(() => cache.clearAll());
  afterEach(() => cache.clearAll());

  it("stores and retrieves by full key", () => {
    cache.set(KEY(), VALUE("halo"));
    const hit = cache.get(KEY());
    expect(hit?.translation).toBe("halo");
  });

  it("different targetLang is a different entry", () => {
    cache.set(KEY({ targetLang: "id" }), VALUE("halo"));
    cache.set(KEY({ targetLang: "en" }), VALUE("hello"));
    expect(cache.get(KEY({ targetLang: "id" }))?.translation).toBe("halo");
    expect(cache.get(KEY({ targetLang: "en" }))?.translation).toBe("hello");
  });

  it("different contentVersion is a different entry (edit invalidation)", () => {
    cache.set(KEY({ contentVersion: "v1" }), VALUE("halo"));
    expect(cache.get(KEY({ contentVersion: "v2" }))).toBeUndefined();
  });
});

describe("translation-cache · isolation across accounts", () => {
  beforeEach(() => cache.clearAll());
  afterEach(() => cache.clearAll());

  it("clearForOtherAccounts purges only foreign-account entries", () => {
    cache.set(KEY({ accountId: "A" }), VALUE("halo-A"));
    cache.set(KEY({ accountId: "B" }), VALUE("halo-B"));
    cache.clearForOtherAccounts("A");
    expect(cache.get(KEY({ accountId: "A" }))?.translation).toBe("halo-A");
    expect(cache.get(KEY({ accountId: "B" }))).toBeUndefined();
  });
});

describe("translation-cache · dedup", () => {
  beforeEach(() => cache.clearAll());
  afterEach(() => cache.clearAll());

  it("coalesces identical in-flight keys into one call", async () => {
    let calls = 0;
    const slow = () =>
      new Promise<cache.TranslationCacheValue | null>((resolve) =>
        setTimeout(() => {
          calls += 1;
          resolve(VALUE("halo"));
        }, 20),
      );
    const [a, b] = await Promise.all([
      cache.dedup(KEY(), slow),
      cache.dedup(KEY(), slow),
    ]);
    expect(calls).toBe(1);
    expect(a?.translation).toBe("halo");
    expect(b?.translation).toBe("halo");
  });

  it("different keys do NOT coalesce", async () => {
    let calls = 0;
    const slow = () =>
      new Promise<cache.TranslationCacheValue | null>((resolve) =>
        setTimeout(() => {
          calls += 1;
          resolve(VALUE("halo"));
        }, 10),
      );
    await Promise.all([
      cache.dedup(KEY({ messageId: "m1" }), slow),
      cache.dedup(KEY({ messageId: "m2" }), slow),
    ]);
    expect(calls).toBe(2);
  });
});

describe("translation-cache · listKnownAccountIds", () => {
  beforeEach(() => cache.clearAll());
  afterEach(() => cache.clearAll());

  it("returns empty when cache is empty", () => {
    expect(cache.listKnownAccountIds()).toEqual([]);
  });

  it("returns unique account prefixes from stored entries", () => {
    cache.set(KEY({ accountId: "A", messageId: "m1" }), VALUE("halo-A-1"));
    cache.set(KEY({ accountId: "A", messageId: "m2" }), VALUE("halo-A-2"));
    cache.set(KEY({ accountId: "B" }), VALUE("halo-B"));
    const ids = cache.listKnownAccountIds().sort();
    expect(ids).toEqual(["A", "B"]);
  });

  it("includes accounts with only in-flight entries (no completed entry yet)", async () => {
    // Fire a slow dedup that stays in-flight when we snapshot.
    const slow = () =>
      new Promise<cache.TranslationCacheValue | null>((resolve) =>
        setTimeout(() => resolve(VALUE("halo-C")), 30),
      );
    const p = cache.dedup(KEY({ accountId: "C" }), slow);
    // While pending, listKnownAccountIds should still see C.
    const during = cache.listKnownAccountIds();
    expect(during).toContain("C");
    await p;
  });

  it("drops entries once cleared", () => {
    cache.set(KEY({ accountId: "A" }), VALUE("halo-A"));
    expect(cache.listKnownAccountIds()).toContain("A");
    cache.clearAll();
    expect(cache.listKnownAccountIds()).toEqual([]);
  });
});
