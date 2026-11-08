// src/app/api/nex-native/attachment/encrypted/signed/__tests__/route.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const SENDER = "11111111-1111-1111-1111-111111111111";
const OUTSIDER = "33333333-3333-3333-3333-333333333333";
const VALID_PATH = `enc/${SENDER}/1730000000-abc123.bin`;

const state = vi.hoisted(() => ({
  session: null as null | { account: { id: string } },
  participantResult: "participant" as
    | "participant"
    | "not-found"
    | "not-participant",
  bucketReady: true,
  signResult: {
    data: { signedUrl: "https://sandbox.supabase.co/signed?token=abc" } as
      | { signedUrl: string }
      | null,
    error: null as { message: string } | null,
  },
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: () => Promise.resolve(state.session),
}));

vi.mock("@/lib/nex-native/attachment/attachment-participant", () => ({
  isValidCiphertextPath: (p: string) =>
    /^enc\/[0-9a-f-]{32,36}\/\d{10,16}-[a-z0-9]{6,12}\.[a-z0-9]{1,8}$/.test(p),
  verifyParticipantForCiphertext: () => Promise.resolve(state.participantResult),
}));

vi.mock("@/lib/nex-native/attachment/bucket-config", () => ({
  PRIVATE_CIPHERTEXT_BUCKET: "nex-peer-chat-ciphertext",
  SIGNED_URL_TTL_SECONDS: 900,
  ensurePrivateBucketReady: () => Promise.resolve(state.bucketReady),
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    storage: {
      from(_bucket: string) {
        return {
          createSignedUrl: () =>
            Promise.resolve({
              data: state.signResult.data,
              error: state.signResult.error,
            }),
        };
      },
    },
  },
}));

const { GET } = await import("../route");

function makeReq(path: string) {
  return new Request(
    `http://localhost/api/nex-native/attachment/encrypted/signed?path=${encodeURIComponent(path)}`,
    { method: "GET" },
  ) as never;
}

describe("GET /api/nex-native/attachment/encrypted/signed", () => {
  beforeEach(() => {
    state.session = { account: { id: SENDER } };
    state.participantResult = "participant";
    state.bucketReady = true;
    state.signResult = {
      data: { signedUrl: "https://sandbox.supabase.co/signed?token=abc" },
      error: null,
    };
  });

  it("unauthenticated → 401", async () => {
    state.session = null;
    const res = await GET(makeReq(VALID_PATH));
    expect(res.status).toBe(401);
  });

  it("malformed path → 404 (not-revealing)", async () => {
    const res = await GET(makeReq("bogus"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_found");
  });

  it("missing path query → 404", async () => {
    const res = await GET(makeReq(""));
    expect(res.status).toBe(404);
  });

  it("non-participant → 404 (collapses to not-found · no existence leak)", async () => {
    state.participantResult = "not-participant";
    state.session = { account: { id: OUTSIDER } };
    const res = await GET(makeReq(VALID_PATH));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_found");
  });

  it("not-found → 404", async () => {
    state.participantResult = "not-found";
    const res = await GET(makeReq(VALID_PATH));
    expect(res.status).toBe(404);
  });

  it("bucket unavailable → 503 + Retry-After", async () => {
    state.bucketReady = false;
    const res = await GET(makeReq(VALID_PATH));
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("happy path · participant → 200 + signed_url + expires_at + ttl_seconds", async () => {
    const res = await GET(makeReq(VALID_PATH));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      signed_url: string;
      expires_at: string;
      ttl_seconds: number;
    };
    expect(body.ok).toBe(true);
    expect(body.signed_url).toBe(
      "https://sandbox.supabase.co/signed?token=abc",
    );
    expect(body.ttl_seconds).toBe(900);
    const expMs = new Date(body.expires_at).getTime();
    expect(expMs).toBeGreaterThan(Date.now());
    expect(expMs - Date.now()).toBeLessThanOrEqual(900_000 + 2_000);
  });

  it("supabase createSignedUrl error → 500", async () => {
    state.signResult = {
      data: null,
      error: { message: "sign backend down" },
    };
    const res = await GET(makeReq(VALID_PATH));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe("sign_failed");
  });
});
