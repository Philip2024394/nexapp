// src/lib/nex-native/crypto/__tests__/encrypted-attachment-uploader.test.ts
//
// Tests the sealed client-side encrypted attachment uploader.
// -----------------------------------------------------------------
// 4 cases:
//   1. bucket-absent refusal (503 private_bucket_unavailable) →
//      { ok: false, reason: "ciphertext_bucket_not_applied" } · no
//      public-bucket fallback.
//   2. happy path · one wrapped key per recipient device.
//   3. upload network error → upload_failed · no plaintext in error.
//   4. error cases never leak the attachment key, content key, or
//      plaintext bytes in the failure payload.

import { describe, expect, it, vi } from "vitest";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import { uploadEncryptedAttachment } from "../encrypted-attachment-uploader";

function makeFile(bytes: Uint8Array, type = "image/png"): File {
  // Node 20's File shim accepts a BlobPart array. Cast through
  // ArrayBuffer so the Uint8Array is treated as a BlobPart.
  const blob = new Blob([bytes as unknown as BlobPart], { type });
  return new File([blob], "test.png", { type });
}

function senderKeypair() {
  return nacl.box.keyPair();
}

function makeRecipient(deviceId: string) {
  const kp = nacl.box.keyPair();
  return {
    device_id: deviceId,
    recipient_public_key: kp.publicKey,
  };
}

describe("encrypted-attachment-uploader", () => {
  it("case 1 · 503 bucket-absent refusal · never falls back to public bucket", async () => {
    const sender = senderKeypair();
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "private_bucket_unavailable",
          detail: "the private ciphertext bucket is not available",
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      );
    });
    const res = await uploadEncryptedAttachment({
      file: makeFile(new Uint8Array([1, 2, 3, 4])),
      senderSecretKey: sender.secretKey,
      recipients: [makeRecipient("peer-1")],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("ciphertext_bucket_not_applied");
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // Sanity · the single call went to the SEALED private-bucket route
    // · no second attempt at a public bucket exists.
    const call0 = fetchImpl.mock.calls[0] as unknown as [string, ...unknown[]] | undefined;
    const firstCall = call0?.[0] ?? "";
    expect(firstCall).toContain("/api/nex-native/attachment/encrypted");
  });

  it("case 2 · happy path · emits one wrapped key per recipient device", async () => {
    const sender = senderKeypair();
    const recipients = [
      makeRecipient("peer-1"),
      makeRecipient("peer-2"),
      makeRecipient("sender-dev-other"),
    ];
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          storage_path: "enc/acc-sender/123.bin",
          private: true,
          size_bytes: 24,
          bucket: "nex-peer-chat-ciphertext",
        }),
        { status: 200 },
      );
    });
    const res = await uploadEncryptedAttachment({
      file: makeFile(new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0])),
      senderSecretKey: sender.secretKey,
      recipients,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ciphertext_url_token).toBe("enc/acc-sender/123.bin");
      expect(Object.keys(res.wrapped_keys).sort()).toEqual([
        "peer-1",
        "peer-2",
        "sender-dev-other",
      ]);
      // Each wrapped key has the shape we expect.
      for (const dev of recipients) {
        const blob = res.wrapped_keys[dev.device_id]!;
        expect(typeof blob.nonce_b64).toBe("string");
        expect(typeof blob.ciphertext_b64).toBe("string");
        // Nonce is 24 bytes · base64 is 32 chars.
        expect(blob.nonce_b64.length).toBe(32);
      }
      // content_nonce_b64 is the file-encryption nonce · 24 bytes → 32 chars
      expect(res.content_nonce_b64.length).toBe(32);
    }
  });

  it("case 3 · upload network error · surfaces upload_failed without plaintext", async () => {
    const sender = senderKeypair();
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network down");
    });
    const plaintext = "PLAIN_SENTINEL_18F4C";
    const bytes = naclUtil.decodeUTF8(plaintext);
    const res = await uploadEncryptedAttachment({
      file: makeFile(bytes),
      senderSecretKey: sender.secretKey,
      recipients: [makeRecipient("peer-1")],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("upload_failed");
      // Never echo plaintext.
      expect(JSON.stringify(res)).not.toContain(plaintext);
    }
  });

  it("case 4 · error payloads never leak key material or plaintext", async () => {
    const sender = senderKeypair();
    // Craft a sentinel-rich plaintext · prove no sentinel appears in
    // any error result, regardless of where the pipeline fails.
    const sentinel = "KEY_CANARY_7C3A91";
    const bytes = naclUtil.decodeUTF8(sentinel);

    // Three failure modes in sequence · each must yield a safe payload.
    const modes: Array<{
      fetchImpl: () => Promise<Response>;
      expect_reason: string;
    }> = [
      {
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              ok: false,
              error: "private_bucket_unavailable",
            }),
            { status: 503 },
          ),
        expect_reason: "ciphertext_bucket_not_applied",
      },
      {
        fetchImpl: async () =>
          new Response("boom " + sentinel, { status: 500 }),
        expect_reason: "upload_failed",
      },
      {
        fetchImpl: async () =>
          new Response(
            JSON.stringify({ ok: false, error: "storage_upload: boom" }),
            { status: 200 },
          ),
        expect_reason: "upload_failed",
      },
    ];

    for (const m of modes) {
      const fetchImpl = vi.fn(m.fetchImpl);
      const res = await uploadEncryptedAttachment({
        file: makeFile(bytes),
        senderSecretKey: sender.secretKey,
        recipients: [makeRecipient("peer-1")],
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe(m.expect_reason);
        const serialized = JSON.stringify(res);
        // Plaintext must never appear.
        expect(serialized).not.toContain(sentinel);
        // base64 of the sender secret must never appear.
        const secretB64 = naclUtil.encodeBase64(sender.secretKey);
        expect(serialized).not.toContain(secretB64);
      }
    }
  });
});
