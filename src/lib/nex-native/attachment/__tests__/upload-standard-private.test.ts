// src/lib/nex-native/attachment/__tests__/upload-standard-private.test.ts
//
// P1.T06 · client helper tests. Owner-authorised 2026-11-13.
// -----------------------------------------------------------------------------
// Covers:
//   · Happy path · returns {ok:true, storagePath, contentType, sizeBytes}.
//   · 401 (session) · failure code "not_signed_in".
//   · 413 (oversize) · "too_large".
//   · 415 (MIME) · "unsupported_mime".
//   · 503 (bucket) · "private_bucket_unavailable".
//   · Malformed success JSON · "unknown".
//   · Network throw · "network".
//   · File is sent with the file's own MIME in Content-Type.
//   · credentials: "include" so session cookie flows.
//   · Fetch URL matches the sealed endpoint.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadStandardPrivate } from "@/lib/nex-native/attachment/upload-standard-private";

const ENDPOINT = "/api/nex-native/attachment/standard";

function mkFile(name: string, type: string, size = 1024): File {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = i & 0xff;
  return new File([bytes], name, { type });
}

const originalFetch = global.fetch;
beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.clearAllMocks();
});

describe("uploadStandardPrivate", () => {
  it("happy path · returns storagePath + contentType + sizeBytes", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          storage_path: "std/sender/1700-aaa.png",
          bucket: "nex-peer-chat-ciphertext",
          private: true,
          size_bytes: 128,
          content_type: "image/png",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const out = await uploadStandardPrivate({ file: mkFile("p.png", "image/png", 128) });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.storagePath).toBe("std/sender/1700-aaa.png");
      expect(out.contentType).toBe("image/png");
      expect(out.sizeBytes).toBe(128);
    }
  });

  it("sets Content-Type to the file's own MIME + credentials:include + hits the sealed endpoint", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          storage_path: "std/s/1-a.pdf",
          size_bytes: 10,
          content_type: "application/pdf",
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchFn;
    await uploadStandardPrivate({
      file: mkFile("r.pdf", "application/pdf"),
      extHint: "pdf",
    });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    const headers = init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/pdf");
    expect(headers["x-nex-enc-ext"]).toBe("pdf");
  });

  it("maps 401 to not_signed_in", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "not_signed_in" }), {
        status: 401,
      }),
    );
    const out = await uploadStandardPrivate({
      file: mkFile("x.png", "image/png"),
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("not_signed_in");
  });

  it("maps 413 to too_large", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "too_large" }), {
        status: 413,
      }),
    );
    const out = await uploadStandardPrivate({
      file: mkFile("x.png", "image/png"),
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("too_large");
  });

  it("maps 415 to unsupported_mime", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "unsupported_mime" }), {
        status: 415,
      }),
    );
    const out = await uploadStandardPrivate({
      file: mkFile("x.sh", "application/x-sh"),
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("unsupported_mime");
  });

  it("maps 503 to private_bucket_unavailable", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: false, error: "private_bucket_unavailable" }),
        { status: 503, headers: { "Retry-After": "60" } },
      ),
    );
    const out = await uploadStandardPrivate({
      file: mkFile("x.png", "image/png"),
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("private_bucket_unavailable");
  });

  it("returns 'unknown' on malformed success JSON", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true /* nothing else */ }), {
        status: 200,
      }),
    );
    const out = await uploadStandardPrivate({
      file: mkFile("x.png", "image/png"),
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("unknown");
  });

  it("returns 'network' when fetch throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));
    const out = await uploadStandardPrivate({
      file: mkFile("x.png", "image/png"),
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("network");
  });
});
