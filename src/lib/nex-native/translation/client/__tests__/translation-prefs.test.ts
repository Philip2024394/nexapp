// src/lib/nex-native/translation/client/__tests__/translation-prefs.test.ts
//
// Deterministic unit tests for device-local translation preferences.
// Owner-authorised 2026-11-17 · local verification only.
//
// These tests install a minimal in-memory localStorage shim so the
// prefs module (which runs in the browser in production) is unit-
// testable in the Node vitest runner.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

function installLocalStorageShim(): void {
  const store = new Map<string, string>();
  const shim = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  // @ts-expect-error — jsdom isn't enabled; we provide a minimal shim.
  globalThis.window = {
    localStorage: shim,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function removeLocalStorageShim(): void {
  // @ts-expect-error — teardown of the shim.
  delete globalThis.window;
}

import {
  acceptConsent,
  clearTranslationPrefsForAccount,
  readTranslationPrefs,
  revokeConsent,
  setAutoForConversation,
  setReadingLanguage,
  writeTranslationPrefs,
} from "../translation-prefs";

describe("translation-prefs · device-local storage", () => {
  beforeEach(() => installLocalStorageShim());
  afterEach(() => removeLocalStorageShim());

  it("defaults to empty snapshot", () => {
    const s = readTranslationPrefs("acc-1");
    expect(s.readingLang).toBeNull();
    expect(s.consentAcceptedAt).toBeNull();
    expect(Object.keys(s.autoByConversationId).length).toBe(0);
  });

  it("round-trips reading language", () => {
    setReadingLanguage("acc-1", "id");
    expect(readTranslationPrefs("acc-1").readingLang).toBe("id");
    setReadingLanguage("acc-1", null);
    expect(readTranslationPrefs("acc-1").readingLang).toBeNull();
  });

  it("drops unknown languages on read (safe-parse)", () => {
    writeTranslationPrefs("acc-1", {
      readingLang: "fr" as unknown as "en",
      autoByConversationId: Object.freeze({}),
      consentAcceptedAt: null,
    });
    expect(readTranslationPrefs("acc-1").readingLang).toBeNull();
  });

  it("per-conversation auto toggle isolated per conversation", () => {
    setAutoForConversation("acc-1", "conv-A", true);
    setAutoForConversation("acc-1", "conv-B", false);
    const s = readTranslationPrefs("acc-1");
    expect(s.autoByConversationId["conv-A"]).toBe(true);
    expect(s.autoByConversationId["conv-B"]).toBe(false);
  });

  it("revokeConsent clears consentAcceptedAt and all auto toggles", () => {
    setAutoForConversation("acc-1", "conv-A", true);
    acceptConsent("acc-1", "2026-11-17T00:00:00.000Z");
    expect(readTranslationPrefs("acc-1").consentAcceptedAt).toBe(
      "2026-11-17T00:00:00.000Z",
    );
    revokeConsent("acc-1");
    const s = readTranslationPrefs("acc-1");
    expect(s.consentAcceptedAt).toBeNull();
    expect(Object.keys(s.autoByConversationId).length).toBe(0);
  });

  it("accounts have independent prefs (no cross-account bleed)", () => {
    setReadingLanguage("acc-1", "en");
    setReadingLanguage("acc-2", "id");
    expect(readTranslationPrefs("acc-1").readingLang).toBe("en");
    expect(readTranslationPrefs("acc-2").readingLang).toBe("id");
  });

  it("clearTranslationPrefsForAccount wipes a single account", () => {
    setReadingLanguage("acc-1", "en");
    setReadingLanguage("acc-2", "id");
    clearTranslationPrefsForAccount("acc-1");
    expect(readTranslationPrefs("acc-1").readingLang).toBeNull();
    expect(readTranslationPrefs("acc-2").readingLang).toBe("id");
  });
});
