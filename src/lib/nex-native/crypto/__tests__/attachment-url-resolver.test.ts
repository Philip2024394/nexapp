// src/lib/nex-native/crypto/__tests__/attachment-url-resolver.test.ts
//
// P1.T05 2026-11-13 · owner-authorised build.
// -----------------------------------------------------------------------------
// Covers:
//   · Mint call: sends GET /api/nex-native/attachment/encrypted/signed
//     with the path encoded.
//   · Success: {ok:true, signed_url} returned → resolver returns the
//     signed URL.
//   · Wrong-recipient denial: 404 response → resolver returns null.
//   · Expired / not signed in: 401 response → null.
//   · Bucket unavailable: 503 → null.
//   · Sign failure: 500 → null.
//   · Malformed JSON: returns null, does not throw.
//   · Legacy envelope with storage_url only: returned as-is, no mint
//     call made (backwards compat).
//   · Neither path nor url: null.
//   · Retry after failure works (mint called again on second call).
//   · Ensures `credentials: "include"` is set so the session cookie
//     reaches the mint route.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCiphertextFetchUrl } from "@/lib/nex-native/crypto/attachment-url-resolver";

const MINT_ENDPOINT = "/api/nex-native/attachment/encrypted/signed";

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => vi.clearAllMocks());

describe("resolveCiphertextFetchUrl · private-bucket path", () => {
  it("mints a signed URL for storage_path (success)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          signed_url: "https://supabase.co/signed/abc?token=xyz",
          expires_at: "2026-12-01T00:00:00Z",
          ttl_seconds: 900,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const got = await resolveCiphertextFetchUrl(
      { storage_path: "enc/sender/1-abc.pdf" },
      { fetchFn },
    );
    expect(got).toBe("https://supabase.co/signed/abc?token=xyz");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(
      `${MINT_ENDPOINT}?path=${encodeURIComponent("enc/sender/1-abc.pdf")}`,
    );
    expect((init as RequestInit).method).toBe("GET");
    // Session cookie must reach the route.
    expect((init as RequestInit).credentials).toBe("include");
  });

  it("returns null on wrong-recipient denial (404)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    const got = await resolveCiphertextFetchUrl(
      { storage_path: "enc/other/9.pdf" },
      { fetchFn },
    );
    expect(got).toBeNull();
  });

  it("returns null on expired session / not signed in (401)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "not_signed_in" }), {
        status: 401,
      }),
    );
    const got = await resolveCiphertextFetchUrl(
      { storage_path: "enc/me/1.pdf" },
      { fetchFn },
    );
    expect(got).toBeNull();
  });

  it("returns null when the bucket is unavailable (503)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: false, error: "private_bucket_unavailable" }),
        { status: 503, headers: { "Retry-After": "60" } },
      ),
    );
    const got = await resolveCiphertextFetchUrl(
      { storage_path: "enc/me/2.pdf" },
      { fetchFn },
    );
    expect(got).toBeNull();
  });

  it("returns null on sign failure (500)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "sign_failed" }), {
        status: 500,
      }),
    );
    const got = await resolveCiphertextFetchUrl(
      { storage_path: "enc/me/3.pdf" },
      { fetchFn },
    );
    expect(got).toBeNull();
  });

  it("returns null on malformed JSON (no throw into caller)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response("not json at all", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const got = await resolveCiphertextFetchUrl(
      { storage_path: "enc/me/4.pdf" },
      { fetchFn },
    );
    expect(got).toBeNull();
  });

  it("returns null on {ok:true} without signed_url", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true /* no signed_url */ }), {
        status: 200,
      }),
    );
    const got = await resolveCiphertextFetchUrl(
      { storage_path: "enc/me/5.pdf" },
      { fetchFn },
    );
    expect(got).toBeNull();
  });

  it("returns null when fetch itself throws (network error)", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("offline"));
    const got = await resolveCiphertextFetchUrl(
      { storage_path: "enc/me/6.pdf" },
      { fetchFn },
    );
    expect(got).toBeNull();
  });

  it("encodes the storage path safely (special characters)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, signed_url: "https://x/y" }),
        { status: 200 },
      ),
    );
    await resolveCiphertextFetchUrl(
      { storage_path: "enc/me with space/??.pdf" },
      { fetchFn },
    );
    const [calledUrl] = fetchFn.mock.calls[0];
    expect(calledUrl).toBe(
      `${MINT_ENDPOINT}?path=${encodeURIComponent("enc/me with space/??.pdf")}`,
    );
  });
});

describe("resolveCiphertextFetchUrl · legacy / edge cases", () => {
  it("returns storage_url as-is when only storage_url is present (legacy envelope)", async () => {
    const fetchFn = vi.fn();
    const got = await resolveCiphertextFetchUrl(
      {
        storage_url:
          "https://supabase.co/storage/v1/object/public/nex-peer-chat-attachments/enc/old/1.bin",
      },
      { fetchFn },
    );
    expect(got).toBe(
      "https://supabase.co/storage/v1/object/public/nex-peer-chat-attachments/enc/old/1.bin",
    );
    // No mint call · legacy envelopes bypass the sealed endpoint.
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("prefers storage_path over storage_url when both are present", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, signed_url: "https://new/signed/url" }),
        { status: 200 },
      ),
    );
    const got = await resolveCiphertextFetchUrl(
      {
        storage_path: "enc/new/1.pdf",
        storage_url: "https://old/legacy/url",
      },
      { fetchFn },
    );
    expect(got).toBe("https://new/signed/url");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("returns null when neither path nor url is present", async () => {
    const fetchFn = vi.fn();
    const got = await resolveCiphertextFetchUrl({}, { fetchFn });
    expect(got).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns null for empty-string path or url", async () => {
    const fetchFn = vi.fn();
    expect(
      await resolveCiphertextFetchUrl({ storage_path: "" }, { fetchFn }),
    ).toBeNull();
    expect(
      await resolveCiphertextFetchUrl({ storage_url: "" }, { fetchFn }),
    ).toBeNull();
  });
});

describe("resolveCiphertextFetchUrl · retry semantics", () => {
  it("re-invokes the mint endpoint on every call (no caching)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false }), { status: 503 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, signed_url: "https://retry/ok" }),
          { status: 200 },
        ),
      );
    const envelope = { storage_path: "enc/me/retry.pdf" };
    const first = await resolveCiphertextFetchUrl(envelope, { fetchFn });
    expect(first).toBeNull();
    const second = await resolveCiphertextFetchUrl(envelope, { fetchFn });
    expect(second).toBe("https://retry/ok");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
