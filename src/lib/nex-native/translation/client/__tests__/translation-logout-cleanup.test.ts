// src/lib/nex-native/translation/client/__tests__/translation-logout-cleanup.test.ts
//
// Regression coverage for the prefs-less-account cleanup fix.
// Owner-authorised 2026-11-17 continuation 3 addendum-2 round · local
// verification only.
//
// Scenario proved here: an account that signed in and acquired cached
// translations but NEVER saved a translation preference (no
// `nex.translation.prefs.v1.<id>` localStorage key) must still receive
// an `account_logged_out` broadcast at logout. Before the fix,
// `discoverKnownAccountIds()` only enumerated localStorage prefs keys
// and silently missed these accounts. The fix unions the localStorage
// enumeration with `cache.listKnownAccountIds()`.
//
// The test installs the same minimal localStorage shim used by the
// translation-prefs test and intercepts `publishConsentEvent` by
// swapping the module cache. BroadcastChannel is not provided so the
// publisher's channel path becomes a no-op; the same-tab local
// listeners path (tested elsewhere) is covered via module mocking.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Shared shim bookkeeping.
type Shim = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
  clear: () => void;
  key: (i: number) => string | null;
  length: number;
};

function installWindowShim(): Shim {
  const store = new Map<string, string>();
  const shim: Shim = {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Shim;
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: shim,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  (globalThis as unknown as { document: unknown }).document = {
    querySelectorAll: () => ({ forEach: () => {} }),
  };
  return shim;
}

function uninstallWindowShim(): void {
  delete (globalThis as unknown as { window?: unknown }).window;
  delete (globalThis as unknown as { document?: unknown }).document;
}

// Capture broadcasts without touching the real channel implementation.
const broadcasts: Array<{ kind: string; accountId: string }> = [];
vi.mock("../translation-consent-channel", () => ({
  publishConsentEvent: (e: { kind: string; accountId: string }) => {
    broadcasts.push({ kind: e.kind, accountId: e.accountId });
  },
}));

describe("translation-logout-cleanup · prefs-less-account coverage", () => {
  beforeEach(() => {
    broadcasts.length = 0;
    installWindowShim();
    vi.resetModules();
  });
  afterEach(() => {
    uninstallWindowShim();
  });

  it("broadcasts for an account with cached entries but NO saved prefs", async () => {
    const cache = await import("../translation-cache");
    const { runTranslationLogoutCleanup } = await import(
      "../translation-logout-cleanup"
    );

    cache.clearAll();
    // Account X has cached translations but zero localStorage prefs.
    cache.set(
      {
        accountId: "acct-X",
        conversationId: "c1",
        messageId: "m1",
        contentVersion: "v1",
        targetLang: "id",
      },
      { translation: "halo", detectedSourceLanguage: "en", fetchedAt: 0 },
    );

    runTranslationLogoutCleanup(null);

    const accts = broadcasts.map((b) => b.accountId);
    expect(accts).toContain("acct-X");
    expect(broadcasts.every((b) => b.kind === "account_logged_out")).toBe(true);
  });

  it("broadcasts for an account with prefs key only (no cached entries)", async () => {
    const { runTranslationLogoutCleanup } = await import(
      "../translation-logout-cleanup"
    );

    window.localStorage.setItem("nex.translation.prefs.v1.acct-Y", "{}");

    runTranslationLogoutCleanup(null);

    const accts = broadcasts.map((b) => b.accountId);
    expect(accts).toContain("acct-Y");
  });

  it("dedupes accounts present in BOTH prefs + cache", async () => {
    const cache = await import("../translation-cache");
    const { runTranslationLogoutCleanup } = await import(
      "../translation-logout-cleanup"
    );

    cache.clearAll();
    cache.set(
      {
        accountId: "acct-Z",
        conversationId: "c1",
        messageId: "m1",
        contentVersion: "v1",
        targetLang: "id",
      },
      { translation: "halo", detectedSourceLanguage: "en", fetchedAt: 0 },
    );
    window.localStorage.setItem("nex.translation.prefs.v1.acct-Z", "{}");

    runTranslationLogoutCleanup(null);

    const zCount = broadcasts.filter((b) => b.accountId === "acct-Z").length;
    expect(zCount).toBe(1);
  });

  it("explicit accountId takes precedence (single broadcast, no fallback scan)", async () => {
    const cache = await import("../translation-cache");
    const { runTranslationLogoutCleanup } = await import(
      "../translation-logout-cleanup"
    );

    cache.clearAll();
    // Noise accounts in cache + prefs that must NOT be broadcast when
    // an explicit id is supplied.
    cache.set(
      {
        accountId: "noise-cache",
        conversationId: "c1",
        messageId: "m1",
        contentVersion: "v1",
        targetLang: "id",
      },
      { translation: "halo", detectedSourceLanguage: "en", fetchedAt: 0 },
    );
    window.localStorage.setItem("nex.translation.prefs.v1.noise-prefs", "{}");

    runTranslationLogoutCleanup("acct-explicit");

    expect(broadcasts).toEqual([
      { kind: "account_logged_out", accountId: "acct-explicit" },
    ]);
  });

  it("clears the cache even when no accounts are discoverable", async () => {
    const cache = await import("../translation-cache");
    const { runTranslationLogoutCleanup } = await import(
      "../translation-logout-cleanup"
    );

    cache.set(
      {
        accountId: "stale",
        conversationId: "c1",
        messageId: "m1",
        contentVersion: "v1",
        targetLang: "id",
      },
      { translation: "halo", detectedSourceLanguage: "en", fetchedAt: 0 },
    );
    // Capture size before + wipe localStorage so prefs enumeration
    // returns nothing.
    window.localStorage.clear();

    // Even here, the cache row seeds a discovered id ("stale"), so a
    // broadcast still fires AND the cache ends up empty.
    runTranslationLogoutCleanup(null);
    expect(cache._debugSize()).toBe(0);
    expect(broadcasts.map((b) => b.accountId)).toContain("stale");
  });
});
