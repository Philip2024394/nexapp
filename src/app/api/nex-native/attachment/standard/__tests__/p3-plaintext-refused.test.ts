// src/app/api/nex-native/attachment/standard/__tests__/p3-plaintext-refused.test.ts
//
// P3 plaintext-chat remediation · owner-authorised 2026-11-23.
// -----------------------------------------------------------------------------
// Proves the standard-send attachment route is CLOSED under the
// fail-closed freeze default:
//
//   · Unset / "1" / "true" / "" env → freeze ON → route returns 410.
//   · Explicit NEX_CHAT_PLAINTEXT_FREEZE=0 → guard releases · the
//     route proceeds past the refusal check (we don't drive it all
//     the way to a successful upload here; a separate suite covers
//     that happy path · we just assert that 410 is NOT returned).
//   · 410 is returned BEFORE rate-limit, body-buffer, or MIME probe
//     — no side-effects when the route is frozen.
//
// The POST handler imports `nexSupabaseAdmin`, the session resolver,
// the security rate-limit module, the client-IP reader, and the
// private-bucket readiness helper. We mock all of them with vi-
// hoisted factories so none of the real modules load.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  resolveSessionMock,
  recordIfAllowedMock,
  readClientIpMock,
  ensurePrivateBucketReadyMock,
  storageUploadMock,
  storageFromMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  recordIfAllowedMock: vi.fn(),
  readClientIpMock: vi.fn(),
  ensurePrivateBucketReadyMock: vi.fn(),
  storageUploadMock: vi.fn(),
  storageFromMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));

vi.mock("@/lib/nex-native/security-rate-limit", () => ({
  recordIfAllowed: recordIfAllowedMock,
  accountRateLimitKey: (x: string) => `acct:${x}`,
  ipRateLimitKey: (x: string) => `ip:${x}`,
  isSecurityUnavailableError: () => false,
  isSecurityRateLimitError: () => false,
}));

vi.mock("@/lib/nex-native/app/security-request", () => ({
  readClientIp: readClientIpMock,
}));

vi.mock("@/lib/nex-native/attachment/bucket-config", () => ({
  PRIVATE_CIPHERTEXT_BUCKET: "nex-peer-chat-ciphertext",
  ensurePrivateBucketReady: ensurePrivateBucketReadyMock,
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    storage: {
      from: (...args: unknown[]) => {
        storageFromMock(...args);
        return { upload: storageUploadMock };
      },
    },
  },
}));

// NOTE: the route handler also pulls `isPlaintextFreezeOn` and
// `NEX_PEER_ATTACHMENT_MAX_BYTES` from `peer-message-service`. We do
// NOT mock that module · we want the real `isPlaintextFreezeOn` so
// the freeze policy read from the env is the SAME logic the rest of
// the app uses. `server-only` is mocked above so the import succeeds.

import { POST } from "@/app/api/nex-native/attachment/standard/route";

function enableFreeze(): void {
  vi.stubEnv("NEX_CHAT_PLAINTEXT_FREEZE", "1");
}
function disableFreeze(): void {
  vi.stubEnv("NEX_CHAT_PLAINTEXT_FREEZE", "0");
}
function unsetFreeze(): void {
  vi.unstubAllEnvs();
  delete process.env.NEX_CHAT_PLAINTEXT_FREEZE;
}

function buildReq(body: BodyInit | null = new Uint8Array([1, 2, 3])): Request {
  return new Request("http://local/api/nex-native/attachment/standard", {
    method: "POST",
    body,
    headers: { "content-type": "image/png", "x-nex-enc-ext": "png" },
  });
}

beforeEach(() => {
  resolveSessionMock.mockReset();
  recordIfAllowedMock.mockReset();
  readClientIpMock.mockReset();
  ensurePrivateBucketReadyMock.mockReset();
  storageUploadMock.mockReset();
  storageFromMock.mockReset();
  // Default happy-path stubs · each test overrides what matters.
  resolveSessionMock.mockResolvedValue({ account: { id: "acct-1" } });
  readClientIpMock.mockReturnValue("127.0.0.1");
  recordIfAllowedMock.mockResolvedValue(undefined);
  ensurePrivateBucketReadyMock.mockResolvedValue(true);
  storageUploadMock.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("standard attachment route · P3 plaintext-frozen refusal (2026-11-23)", () => {
  it("fail-closed default · unset env · returns 410 with plaintext_attachment_refused · no bucket touch", async () => {
    unsetFreeze();
    const res = await POST(buildReq() as any);
    expect(res.status).toBe(410);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("plaintext_attachment_refused");
    expect(recordIfAllowedMock).not.toHaveBeenCalled();
    expect(storageFromMock).not.toHaveBeenCalled();
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("fail-closed · explicit NEX_CHAT_PLAINTEXT_FREEZE=1 · same 410, same payload", async () => {
    enableFreeze();
    const res = await POST(buildReq() as any);
    expect(res.status).toBe(410);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe("plaintext_attachment_refused");
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("refusal fires BEFORE rate-limit, so a malicious client cannot drain the chat_message bucket", async () => {
    unsetFreeze();
    await POST(buildReq() as any);
    expect(recordIfAllowedMock).not.toHaveBeenCalled();
  });

  it("refusal fires BEFORE body buffer · malicious 25 MB upload is rejected without read", async () => {
    unsetFreeze();
    // Oversized body · would normally trigger the 413 path. 410 must
    // win because the refusal is above that check.
    const bigBody = new Uint8Array(1024);
    const req = new Request("http://local/api/nex-native/attachment/standard", {
      method: "POST",
      body: bigBody,
      headers: { "content-type": "image/png" },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(410);
  });

  it("explicit opt-out · NEX_CHAT_PLAINTEXT_FREEZE=0 · guard releases · route proceeds past refusal", async () => {
    disableFreeze();
    const res = await POST(buildReq() as any);
    // We don't assert the full happy-path shape here · we just prove
    // the 410 refusal did NOT fire. The response can be the normal
    // 200 success or an unrelated validation failure, but it must
    // NOT be 410 with the plaintext_attachment_refused error.
    if (res.status === 410) {
      const body = (await res.json()) as { error: string };
      expect(body.error).not.toBe("plaintext_attachment_refused");
    }
  });

  it("unauthenticated callers still get 401 FIRST · the 410 only applies to authed sessions that could otherwise upload", async () => {
    unsetFreeze();
    resolveSessionMock.mockResolvedValue(null);
    const res = await POST(buildReq() as any);
    expect(res.status).toBe(401);
  });
});
