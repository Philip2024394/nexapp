// src/app/api/nex-native/attachment/standard/__tests__/route.test.ts
//
// P1.T06 · server-route tests for the private standard-send upload
// path. Owner-authorised 2026-11-13.
// -----------------------------------------------------------------------------
// Covers:
//   · auth required (401 when session is null)
//   · MIME allowlist (415 for exotic/executable MIMEs)
//   · size cap (413 above 25 MB)
//   · empty body (400)
//   · private-bucket-unavailable fail-safe (503, no public fallback)
//   · successful upload lands in `std/<senderId>/...` under the sealed
//     private bucket
//   · response shape carries storage_path + content_type + size_bytes
//   · never touches the public `nex-peer-chat-attachments` bucket

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  resolveSessionMock,
  storageFromMock,
  uploadMock,
  ensurePrivateBucketReadyMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  storageFromMock: vi.fn(),
  uploadMock: vi.fn(),
  ensurePrivateBucketReadyMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));
vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    storage: {
      from: storageFromMock,
    },
  },
}));
vi.mock("@/lib/nex-native/attachment/bucket-config", () => ({
  PRIVATE_CIPHERTEXT_BUCKET: "nex-peer-chat-ciphertext",
  SIGNED_URL_TTL_SECONDS: 900,
  ensurePrivateBucketReady: ensurePrivateBucketReadyMock,
}));
vi.mock("@/lib/nex-native/peer-message-service", () => ({
  NEX_PEER_ATTACHMENT_MAX_BYTES: 25 * 1024 * 1024,
}));

import { POST } from "../route";

const SELF = "11111111-1111-1111-1111-111111111111";

function fakeSession(id = SELF) {
  return {
    supabaseUserId: "sb",
    email: "self@test",
    account: { id, display_name: "Self", supabase_user_id: "sb" },
  };
}

function makeRequest(bodyBytes: Uint8Array, headers: Record<string, string>): Request {
  return new Request("http://test/api/nex-native/attachment/standard", {
    method: "POST",
    headers,
    body: bodyBytes as unknown as BodyInit,
  });
}

beforeEach(() => {
  resolveSessionMock.mockReset();
  storageFromMock.mockReset();
  uploadMock.mockReset();
  ensurePrivateBucketReadyMock.mockReset();
  resolveSessionMock.mockResolvedValue(fakeSession());
  ensurePrivateBucketReadyMock.mockResolvedValue(true);
  uploadMock.mockResolvedValue({ error: null });
  storageFromMock.mockImplementation(() => ({ upload: uploadMock }));
});

afterEach(() => vi.clearAllMocks());

describe("POST /api/nex-native/attachment/standard · auth", () => {
  it("returns 401 when the session cannot be resolved", async () => {
    resolveSessionMock.mockResolvedValue(null);
    const resp = await POST(
      makeRequest(new Uint8Array([1, 2, 3]), {
        "content-type": "image/png",
      }) as never,
    );
    expect(resp.status).toBe(401);
    expect(storageFromMock).not.toHaveBeenCalled();
  });
});

describe("POST · MIME allowlist", () => {
  it("rejects application/x-sh (415)", async () => {
    const resp = await POST(
      makeRequest(new Uint8Array([1]), {
        "content-type": "application/x-sh",
      }) as never,
    );
    expect(resp.status).toBe(415);
    expect(storageFromMock).not.toHaveBeenCalled();
  });

  it("accepts image/png", async () => {
    const resp = await POST(
      makeRequest(new Uint8Array([1, 2, 3, 4]), {
        "content-type": "image/png",
      }) as never,
    );
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("accepts video/mp4", async () => {
    const resp = await POST(
      makeRequest(new Uint8Array([1, 2, 3, 4]), {
        "content-type": "video/mp4",
      }) as never,
    );
    expect(resp.status).toBe(200);
  });

  it("accepts audio/mpeg", async () => {
    const resp = await POST(
      makeRequest(new Uint8Array([1, 2, 3, 4]), {
        "content-type": "audio/mpeg",
      }) as never,
    );
    expect(resp.status).toBe(200);
  });

  it("accepts application/pdf", async () => {
    const resp = await POST(
      makeRequest(new Uint8Array([1, 2, 3, 4]), {
        "content-type": "application/pdf",
      }) as never,
    );
    expect(resp.status).toBe(200);
  });

  it("accepts text/plain with charset suffix (strips suffix for MIME check)", async () => {
    const resp = await POST(
      makeRequest(new Uint8Array([1, 2]), {
        "content-type": "text/plain; charset=utf-8",
      }) as never,
    );
    expect(resp.status).toBe(200);
  });
});

describe("POST · size + body guards", () => {
  it("rejects empty body (400)", async () => {
    const resp = await POST(
      makeRequest(new Uint8Array(0), {
        "content-type": "image/png",
      }) as never,
    );
    expect(resp.status).toBe(400);
  });

  it("rejects oversize body (413)", async () => {
    const overCap = new Uint8Array(25 * 1024 * 1024 + 2048);
    const resp = await POST(
      makeRequest(overCap, { "content-type": "image/png" }) as never,
    );
    expect(resp.status).toBe(413);
    expect(storageFromMock).not.toHaveBeenCalled();
  });
});

describe("POST · private bucket fail-safe", () => {
  it("returns 503 when the private bucket is unavailable · never falls back to public", async () => {
    ensurePrivateBucketReadyMock.mockResolvedValue(false);
    const resp = await POST(
      makeRequest(new Uint8Array([1, 2]), {
        "content-type": "image/png",
      }) as never,
    );
    expect(resp.status).toBe(503);
    expect(storageFromMock).not.toHaveBeenCalled();
    const body = (await resp.json()) as { error: string };
    expect(body.error).toBe("private_bucket_unavailable");
  });

  it("surfaces supabase storage errors (500)", async () => {
    uploadMock.mockResolvedValueOnce({ error: { message: "disk full" } });
    const resp = await POST(
      makeRequest(new Uint8Array([1, 2]), {
        "content-type": "image/png",
      }) as never,
    );
    expect(resp.status).toBe(500);
  });
});

describe("POST · success path", () => {
  it("writes to the PRIVATE bucket (nex-peer-chat-ciphertext), NEVER to the public chat bucket", async () => {
    await POST(
      makeRequest(new Uint8Array([1, 2, 3]), {
        "content-type": "image/png",
      }) as never,
    );
    expect(storageFromMock).toHaveBeenCalledTimes(1);
    const bucket = storageFromMock.mock.calls[0][0];
    expect(bucket).toBe("nex-peer-chat-ciphertext");
    expect(bucket).not.toBe("nex-peer-chat-attachments");
  });

  it("writes to a `std/<senderId>/...` path, never `enc/` or anything else", async () => {
    await POST(
      makeRequest(new Uint8Array([1, 2, 3]), {
        "content-type": "image/png",
      }) as never,
    );
    const [objectPath] = uploadMock.mock.calls[0];
    expect(objectPath).toMatch(/^std\//);
    expect(objectPath).toContain(SELF);
    expect(objectPath).not.toMatch(/^enc\//);
  });

  it("uploads with application/octet-stream (bucket policy compat), preserving the real MIME in the response", async () => {
    await POST(
      makeRequest(new Uint8Array([1, 2, 3]), {
        "content-type": "image/png",
      }) as never,
    );
    const [, , uploadOpts] = uploadMock.mock.calls[0];
    expect(uploadOpts.contentType).toBe("application/octet-stream");
    expect(uploadOpts.upsert).toBe(false);
  });

  it("returns ok + storage_path + content_type + size_bytes + bucket marker", async () => {
    const resp = await POST(
      makeRequest(new Uint8Array([1, 2, 3, 4]), {
        "content-type": "image/png",
      }) as never,
    );
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as {
      ok: boolean;
      storage_path: string;
      bucket: string;
      private: boolean;
      size_bytes: number;
      content_type: string;
    };
    expect(body.ok).toBe(true);
    expect(body.storage_path).toMatch(/^std\//);
    expect(body.bucket).toBe("nex-peer-chat-ciphertext");
    expect(body.private).toBe(true);
    expect(body.size_bytes).toBe(4);
    expect(body.content_type).toBe("image/png");
  });

  it("honours the x-nex-enc-ext hint with the same safe allowlist", async () => {
    await POST(
      makeRequest(new Uint8Array([1, 2]), {
        "content-type": "application/pdf",
        "x-nex-enc-ext": "pdf",
      }) as never,
    );
    const [objectPath] = uploadMock.mock.calls[0];
    expect(objectPath).toMatch(/\.pdf$/);
  });

  it("falls back to .bin ext when the hint is not on the whitelist", async () => {
    await POST(
      makeRequest(new Uint8Array([1]), {
        "content-type": "image/png",
        "x-nex-enc-ext": "../evil",
      }) as never,
    );
    const [objectPath] = uploadMock.mock.calls[0];
    expect(objectPath).toMatch(/\.bin$/);
  });
});
