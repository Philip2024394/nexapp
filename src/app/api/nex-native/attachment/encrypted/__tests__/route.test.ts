// src/app/api/nex-native/attachment/encrypted/__tests__/route.test.ts
//
// Owner-authorised 2026-11-08 Priority 2 · verifies the upload route
// no longer silently falls back to the public bucket when the private
// bucket is unavailable.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const state = vi.hoisted(() => ({
  session: { account: { id: "11111111-1111-1111-1111-111111111111" } } as
    | null
    | { account: { id: string } },
  privateReady: true,
  uploadError: null as null | { message: string },
  lastUploadBucket: null as string | null,
  lastUploadPath: null as string | null,
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: () => Promise.resolve(state.session),
}));

vi.mock("@/lib/nex-native/attachment/bucket-config", () => ({
  PRIVATE_CIPHERTEXT_BUCKET: "nex-peer-chat-ciphertext",
  PUBLIC_ATTACHMENT_BUCKET: "nex-peer-chat-attachments",
  SIGNED_URL_TTL_SECONDS: 900,
  ensurePrivateBucketReady: () => Promise.resolve(state.privateReady),
}));

vi.mock("@/lib/nex-native/peer-message-service", () => ({
  NEX_PEER_ATTACHMENT_MAX_BYTES: 25 * 1024 * 1024,
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    storage: {
      from(bucket: string) {
        state.lastUploadBucket = bucket;
        return {
          upload(path: string, _bytes: unknown, _opts: unknown) {
            state.lastUploadPath = path;
            return Promise.resolve({
              data: { path },
              error: state.uploadError,
            });
          },
          getPublicUrl(_path: string) {
            return {
              data: { publicUrl: "https://should-not-be-called.example" },
            };
          },
        };
      },
    },
  },
}));

function makeReq(body: Uint8Array | string) {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  return new Request(
    "http://localhost/api/nex-native/attachment/encrypted",
    {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-nex-enc-ext": "bin",
      },
      body: bytes,
    },
  ) as never;
}

const { POST } = await import("../route");

describe("POST /api/nex-native/attachment/encrypted · Priority 2 · private-bucket-only", () => {
  beforeEach(() => {
    state.session = { account: { id: "11111111-1111-1111-1111-111111111111" } };
    state.privateReady = true;
    state.uploadError = null;
    state.lastUploadBucket = null;
    state.lastUploadPath = null;
  });

  it("unauthenticated → 401 · no upload attempted", async () => {
    state.session = null;
    const res = await POST(makeReq("ciphertext bytes"));
    expect(res.status).toBe(401);
    expect(state.lastUploadBucket).toBeNull();
  });

  it("empty body → 400 · no upload attempted", async () => {
    const res = await POST(makeReq(new Uint8Array(0)));
    expect(res.status).toBe(400);
    expect(state.lastUploadBucket).toBeNull();
  });

  it("happy path · private bucket ready → uploads to PRIVATE bucket · returns storage_path · no storage_url", async () => {
    const res = await POST(makeReq("real ciphertext"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      storage_path: string;
      storage_url?: string;
      bucket: string;
      private: boolean;
    };
    expect(body.ok).toBe(true);
    expect(body.bucket).toBe("nex-peer-chat-ciphertext");
    expect(body.private).toBe(true);
    expect(body.storage_path).toMatch(/^enc\//);
    expect(body.storage_url).toBeUndefined();
    expect(state.lastUploadBucket).toBe("nex-peer-chat-ciphertext");
  });

  it("private bucket unavailable → 503 fail-safe · NO upload to public · NO storage_url leaked", async () => {
    state.privateReady = false;
    const res = await POST(makeReq("real ciphertext"));
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("60");
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("private_bucket_unavailable");
    // Critical invariant · the upload route must NOT have written
    // anything to the public bucket.
    expect(state.lastUploadBucket).toBeNull();
    expect(state.lastUploadPath).toBeNull();
  });

  it("upload error on private bucket → 500 · not a silent fallback", async () => {
    state.uploadError = { message: "storage backend down" };
    const res = await POST(makeReq("real ciphertext"));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toContain("storage_upload");
    // Did attempt the private bucket · did NOT fall back
    expect(state.lastUploadBucket).toBe("nex-peer-chat-ciphertext");
  });
});
