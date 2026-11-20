// src/lib/nex-native/translation/__tests__/azure-translator-adapter.test.ts
//
// Deterministic unit tests for the Azure Translator adapter.
// Owner-authorised 2026-11-17 · local verification only.
//
// IMPORTANT: Every `fetch` used in this suite is a MOCK. No real
// Azure endpoint is contacted. The suite verifies our adapter's
// request shape, retry policy, timeout handling, and error-mapping
// without exercising any live provider.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  translateText,
  isTrustedAzureTranslatorHost,
  validateAzureTranslatorEndpoint,
  _resetIgnoredAzureEnvWarnedForTest,
} from "../azure-translator-adapter";

const BASE_ENV = {
  AZURE_TRANSLATOR_KEY: "fake-key-DO-NOT-USE",
  AZURE_TRANSLATOR_REGION: "eastus",
  AZURE_TRANSLATOR_ENDPOINT:
    "https://api.cognitive.microsofttranslator.com",
};

function withEnv(): void {
  vi.stubEnv("AZURE_TRANSLATOR_KEY", BASE_ENV.AZURE_TRANSLATOR_KEY);
  vi.stubEnv("AZURE_TRANSLATOR_REGION", BASE_ENV.AZURE_TRANSLATOR_REGION);
  vi.stubEnv("AZURE_TRANSLATOR_ENDPOINT", BASE_ENV.AZURE_TRANSLATOR_ENDPOINT);
}

function okFetch(payload: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

function statusFetch(status: number): typeof fetch {
  return vi.fn(async () =>
    new Response("{}", {
      status,
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

describe("azure-translator-adapter · request validation", () => {
  beforeEach(() => withEnv());
  afterEach(() => vi.unstubAllEnvs());

  it("rejects empty input", async () => {
    const r = await translateText({ text: "   ", to: "en" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("input_empty");
  });

  it("rejects too-long input", async () => {
    const r = await translateText({ text: "a".repeat(5000), to: "en" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("input_too_long");
  });

  it("rejects unsupported target language", async () => {
    const r = await translateText({
      text: "hello",
      to: "fr" as unknown as "en",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unsupported_language");
  });
});

describe("azure-translator-adapter · credentials", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("surfaces credentials_missing without touching fetch", async () => {
    vi.stubEnv("AZURE_TRANSLATOR_KEY", "");
    vi.stubEnv("AZURE_TRANSLATOR_REGION", "");
    vi.stubEnv("AZURE_TRANSLATOR_ENDPOINT", "");
    const fetchSpy = vi.fn();
    const r = await translateText({
      text: "hello",
      to: "id",
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("credentials_missing");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("azure-translator-adapter · request shape", () => {
  beforeEach(() => withEnv());
  afterEach(() => vi.unstubAllEnvs());

  it("builds the v3 URL with to/from and sends auth headers", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      seen.url = url;
      seen.init = init;
      return new Response(
        JSON.stringify([
          {
            translations: [{ text: "halo", to: "id" }],
            detectedLanguage: { language: "en", score: 0.98 },
          },
        ]),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const r = await translateText({
      text: "hello",
      from: "en",
      to: "id",
      fetchImpl,
    });
    expect(r.ok).toBe(true);
    expect(seen.url).toMatch(/api-version=3\.0/);
    expect(seen.url).toMatch(/to=id/);
    expect(seen.url).toMatch(/from=en/);
    const headers = (seen.init?.headers ?? {}) as Record<string, string>;
    expect(headers["Ocp-Apim-Subscription-Key"]).toBe(BASE_ENV.AZURE_TRANSLATOR_KEY);
    expect(headers["Ocp-Apim-Subscription-Region"]).toBe(
      BASE_ENV.AZURE_TRANSLATOR_REGION,
    );
  });

  it("passes detected source language through when present", async () => {
    const r = await translateText({
      text: "hello",
      to: "id",
      fetchImpl: okFetch([
        {
          translations: [{ text: "halo", to: "id" }],
          detectedLanguage: { language: "en", score: 0.9 },
        },
      ]),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.detectedSourceLanguage).toBe("en");
  });

  it("flags malformed provider responses", async () => {
    const r = await translateText({
      text: "hello",
      to: "id",
      fetchImpl: okFetch([{ translations: [{ foo: 1 }] }]),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("provider_malformed_response");
  });
});

describe("azure-translator-adapter · error mapping", () => {
  beforeEach(() => withEnv());
  afterEach(() => vi.unstubAllEnvs());

  it("401 → provider_auth_failed", async () => {
    const r = await translateText({
      text: "hello",
      to: "id",
      fetchImpl: statusFetch(401),
      retryOnce: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("provider_auth_failed");
  });

  it("429 → provider_rate_limited", async () => {
    const r = await translateText({
      text: "hello",
      to: "id",
      fetchImpl: statusFetch(429),
      retryOnce: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("provider_rate_limited");
  });

  it("502 → provider_unavailable", async () => {
    const r = await translateText({
      text: "hello",
      to: "id",
      fetchImpl: statusFetch(502),
      retryOnce: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("provider_unavailable");
  });

  it("retries once on 502 then recovers on success", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n === 1) return new Response("{}", { status: 502 });
      return new Response(
        JSON.stringify([{ translations: [{ text: "halo" }] }]),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const r = await translateText({
      text: "hello",
      to: "id",
      fetchImpl,
    });
    expect(n).toBe(2);
    expect(r.ok).toBe(true);
  });

  it("does not retry on a non-transient 401", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      return new Response("{}", { status: 401 });
    }) as unknown as typeof fetch;
    const r = await translateText({
      text: "hello",
      to: "id",
      fetchImpl,
    });
    expect(n).toBe(1);
    expect(r.ok).toBe(false);
  });

  it("aborts on timeout → provider_timeout", async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const e = new Error("aborted");
            (e as Error & { name: string }).name = "AbortError";
            reject(e);
          });
        }
      });
    }) as unknown as typeof fetch;
    const r = await translateText({
      text: "hello",
      to: "id",
      fetchImpl,
      timeoutMs: 5,
      retryOnce: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("provider_timeout");
  });
});

describe("azure-translator-adapter · endpoint trust", () => {
  it("accepts the documented global host", () => {
    expect(isTrustedAzureTranslatorHost("api.cognitive.microsofttranslator.com")).toBe(true);
  });

  it("accepts regional hosts under the translator suffix", () => {
    expect(isTrustedAzureTranslatorHost("api-eastus.cognitive.microsofttranslator.com")).toBe(true);
    expect(isTrustedAzureTranslatorHost("API-EUROPE.cognitive.microsofttranslator.com")).toBe(true);
  });

  it("accepts private custom-resource hosts under cognitiveservices.azure.com", () => {
    expect(isTrustedAzureTranslatorHost("myresource.cognitiveservices.azure.com")).toBe(true);
  });

  it("rejects unrelated hosts", () => {
    expect(isTrustedAzureTranslatorHost("api.example.com")).toBe(false);
    expect(isTrustedAzureTranslatorHost("microsofttranslator.com.evil.example")).toBe(false);
    expect(isTrustedAzureTranslatorHost("microsofttranslator.com")).toBe(false);
  });

  it("validateAzureTranslatorEndpoint rejects non-HTTPS", () => {
    const r = validateAzureTranslatorEndpoint("http://api.cognitive.microsofttranslator.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("endpoint_not_https");
  });

  it("validateAzureTranslatorEndpoint rejects invalid URLs", () => {
    const r = validateAzureTranslatorEndpoint("not a url");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("endpoint_not_a_url");
  });

  it("validateAzureTranslatorEndpoint rejects untrusted host even over HTTPS", () => {
    const r = validateAzureTranslatorEndpoint("https://evil.example.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("endpoint_host_not_trusted");
  });

  it("validateAzureTranslatorEndpoint accepts the documented global URL", () => {
    const r = validateAzureTranslatorEndpoint("https://api.cognitive.microsofttranslator.com");
    expect(r.ok).toBe(true);
  });
});

describe("azure-translator-adapter · invalid_endpoint pre-network refusal", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses an http:// endpoint with invalid_endpoint, providerAttempts 0, and no fetch", async () => {
    vi.stubEnv("AZURE_TRANSLATOR_KEY", "k");
    vi.stubEnv("AZURE_TRANSLATOR_REGION", "eastus");
    vi.stubEnv("AZURE_TRANSLATOR_ENDPOINT", "http://api.cognitive.microsofttranslator.com");
    const fetchSpy = vi.fn();
    const r = await translateText({
      text: "hello",
      to: "id",
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("invalid_endpoint");
      expect(r.providerAttempts).toBe(0);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses an untrusted HTTPS host", async () => {
    vi.stubEnv("AZURE_TRANSLATOR_KEY", "k");
    vi.stubEnv("AZURE_TRANSLATOR_REGION", "eastus");
    vi.stubEnv("AZURE_TRANSLATOR_ENDPOINT", "https://evil.example.com");
    const fetchSpy = vi.fn();
    const r = await translateText({
      text: "hello",
      to: "id",
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_endpoint");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("azure-translator-adapter · ignored-env diagnostic", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetIgnoredAzureEnvWarnedForTest();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("warns ONCE when NEX_AZURE_TRANSLATOR_* is set but canonical is missing", async () => {
    vi.stubEnv("AZURE_TRANSLATOR_KEY", "");
    vi.stubEnv("AZURE_TRANSLATOR_REGION", "");
    vi.stubEnv("AZURE_TRANSLATOR_ENDPOINT", "");
    vi.stubEnv("NEX_AZURE_TRANSLATOR_KEY", "x");
    vi.stubEnv("NEX_AZURE_TRANSLATOR_REGION", "eastus");

    await translateText({ text: "hello", to: "id" });
    await translateText({ text: "hello", to: "id" });

    const calls = warnSpy.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("azure-translator-adapter"),
    );
    expect(calls.length).toBe(1);
    const msg = calls[0]?.[0] as string;
    // Names only · never values.
    expect(msg).toContain("NEX_AZURE_TRANSLATOR_KEY");
    expect(msg).not.toContain("x");
  });

  it("does NOT warn when canonical env is fully set (even if NEX_AZURE_* is also set)", async () => {
    vi.stubEnv("AZURE_TRANSLATOR_KEY", "k");
    vi.stubEnv("AZURE_TRANSLATOR_REGION", "eastus");
    vi.stubEnv("AZURE_TRANSLATOR_ENDPOINT", "https://api.cognitive.microsofttranslator.com");
    vi.stubEnv("NEX_AZURE_TRANSLATOR_KEY", "nope");

    await translateText({ text: "hello", to: "id", fetchImpl: vi.fn(async () =>
      new Response(JSON.stringify([{ translations: [{ text: "halo", to: "id" }] }]), { status: 200 }),
    ) as unknown as typeof fetch });

    const calls = warnSpy.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("azure-translator-adapter"),
    );
    expect(calls.length).toBe(0);
  });
});
