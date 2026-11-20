// src/lib/nex-native/translation/__tests__/translate-service.test.ts
//
// Deterministic unit tests for the server-side translation service.
// Owner-authorised 2026-11-17 · local verification only.
//
// IMPORTANT: Session resolution and the admin gate are MOCKED. No
// network IO occurs — the Azure fetch is a MOCK. These tests do not
// exercise real Azure, real auth, or real sessions.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const resolveMock = vi.fn();
const isAdminMock = vi.fn();

vi.mock("@/lib/nex-native/app/dev-impersonation", () => ({
  resolveSessionWithDevOverride: () => resolveMock(),
}));
vi.mock("@/lib/nex-native/app/admin", () => ({
  isAdminSession: (s: unknown) => isAdminMock(s),
}));

import {
  translateIncomingMessage,
  _resetRateLimiterForTests,
} from "../translate-service";

const FOUNDER = {
  account: { id: "acc-founder" },
  email: "owner@example.com",
};
const NON_FOUNDER = {
  account: { id: "acc-outsider" },
  email: "stranger@example.com",
};

function installLiveEnv(): void {
  vi.stubEnv("NEX_CHAT_TRANSLATION_ENABLED", "true");
  vi.stubEnv("AZURE_TRANSLATOR_KEY", "fake-key");
  vi.stubEnv("AZURE_TRANSLATOR_REGION", "eastus");
  vi.stubEnv(
    "AZURE_TRANSLATOR_ENDPOINT",
    "https://api.cognitive.microsofttranslator.com",
  );
  vi.stubEnv("NEX_ADMIN_EMAILS", "owner@example.com");
}

function okFetch(text: string): typeof fetch {
  return vi.fn(async () =>
    new Response(
      JSON.stringify([
        {
          translations: [{ text }],
          detectedLanguage: { language: "en", score: 0.95 },
        },
      ]),
      { status: 200 },
    ),
  ) as unknown as typeof fetch;
}

describe("translate-service · gates (feature + auth + founder)", () => {
  beforeEach(() => {
    _resetRateLimiterForTests();
    resolveMock.mockReset();
    isAdminMock.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("feature_disabled when env flag is off", async () => {
    vi.stubEnv("NEX_CHAT_TRANSLATION_ENABLED", "");
    resolveMock.mockResolvedValue(FOUNDER);
    isAdminMock.mockReturnValue(true);
    const r = await translateIncomingMessage({
      text: "hello world",
      to: "id",
      mode: "manual",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("feature_disabled");
  });

  it("not_signed_in when session is null", async () => {
    installLiveEnv();
    resolveMock.mockResolvedValue(null);
    isAdminMock.mockReturnValue(false);
    const r = await translateIncomingMessage({
      text: "hello world",
      to: "id",
      mode: "manual",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_signed_in");
  });

  it("not_founder when session is a non-admin", async () => {
    installLiveEnv();
    resolveMock.mockResolvedValue(NON_FOUNDER);
    isAdminMock.mockReturnValue(false);
    const r = await translateIncomingMessage({
      text: "hello world",
      to: "id",
      mode: "manual",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_founder");
  });
});

describe("translate-service · input validation", () => {
  beforeEach(() => {
    _resetRateLimiterForTests();
    installLiveEnv();
    resolveMock.mockReset();
    resolveMock.mockResolvedValue(FOUNDER);
    isAdminMock.mockReset();
    isAdminMock.mockReturnValue(true);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects empty text", async () => {
    const r = await translateIncomingMessage({
      text: "   ",
      to: "id",
      mode: "manual",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("input_empty");
  });

  it("same_language when from === to", async () => {
    const r = await translateIncomingMessage({
      text: "hello world",
      from: "id",
      to: "id",
      mode: "manual",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("same_language");
  });

  it("ambiguous_short_text only in auto mode", async () => {
    const auto = await translateIncomingMessage({
      text: "hi",
      to: "id",
      mode: "auto",
    });
    expect(auto.ok).toBe(false);
    if (!auto.ok) expect(auto.reason).toBe("ambiguous_short_text");

    // Manual mode on short text proceeds to the provider.
    const manual = await translateIncomingMessage({
      text: "hi",
      to: "id",
      mode: "manual",
      testing: { fetchImpl: okFetch("halo") },
    });
    expect(manual.ok).toBe(true);
  });
});

describe("translate-service · happy path (mocked fetch)", () => {
  beforeEach(() => {
    _resetRateLimiterForTests();
    installLiveEnv();
    resolveMock.mockReset();
    resolveMock.mockResolvedValue(FOUNDER);
    isAdminMock.mockReset();
    isAdminMock.mockReturnValue(true);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("translates EN → ID", async () => {
    const r = await translateIncomingMessage({
      text: "good morning",
      from: "en",
      to: "id",
      mode: "manual",
      testing: { fetchImpl: okFetch("selamat pagi") },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.translation).toBe("selamat pagi");
      expect(r.detectedSourceLanguage).toBe("en");
    }
  });

  it("translates ID → EN", async () => {
    const r = await translateIncomingMessage({
      text: "selamat pagi",
      from: "id",
      to: "en",
      mode: "manual",
      testing: { fetchImpl: okFetch("good morning") },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.translation).toBe("good morning");
  });
});

describe("translate-service · in-process rate limits", () => {
  beforeEach(() => {
    _resetRateLimiterForTests();
    installLiveEnv();
    resolveMock.mockReset();
    resolveMock.mockResolvedValue(FOUNDER);
    isAdminMock.mockReset();
    isAdminMock.mockReturnValue(true);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rate_limited_local after exceeding per-minute cap", async () => {
    const t0 = 1_000_000;
    // Fire 60 "successful-enough" calls to fill the ring.
    for (let i = 0; i < 60; i += 1) {
      const r = await translateIncomingMessage({
        text: "hello world",
        to: "id",
        mode: "manual",
        testing: {
          fetchImpl: okFetch("halo"),
          now: () => t0 + i,
        },
      });
      expect(r.ok).toBe(true);
    }
    const r = await translateIncomingMessage({
      text: "hello world",
      to: "id",
      mode: "manual",
      testing: { fetchImpl: okFetch("halo"), now: () => t0 + 60 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("rate_limited_local");
  });
});
