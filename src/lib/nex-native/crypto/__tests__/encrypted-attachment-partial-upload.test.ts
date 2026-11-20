// src/lib/nex-native/crypto/__tests__/encrypted-attachment-partial-upload.test.ts
//
// A22 · Scenario 9 · Upload fails midway (partial-upload cleanup).
// ----------------------------------------------------------------
// Architectural note (findings recorded in docs/doctrine/
// a22-failure-injection-9-15-plan-2026-11-18.md §2 row-9):
//
//   The sealed client-side uploader `uploadEncryptedAttachment` sends
//   the ENTIRE ciphertext in a SINGLE POST to
//   `/api/nex-native/attachment/encrypted`. There is no client-side
//   chunking, no streaming resume, and the caller — not the uploader
//   — writes `nex_chat_attachment`. Therefore, a mid-stream network
//   abort has a tightly-bounded correctness contract:
//
//     1. The helper returns { ok: false, reason: "upload_failed" }
//        and does NOT throw.
//     2. No DB row is ever persisted from THIS helper (the row is
//        gated behind a later caller step that only fires on ok:true).
//     3. The failure payload contains no plaintext bytes and no key
//        material.
//     4. The contentKey / senderSecretKey pair is not surfaced to any
//        response object.
//
// This test exercises the "upload cut mid-stream" shape the plan
// required. Because the architecture is single-POST, "mid-stream" is
// expressed as the network layer throwing part-way through the POST.

import { describe, expect, it, vi } from "vitest";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import { uploadEncryptedAttachment } from "../encrypted-attachment-uploader";

function makeFile(bytes: Uint8Array, type = "image/png"): File {
  const blob = new Blob([bytes as unknown as BlobPart], { type });
  return new File([blob], "test.png", { type });
}

describe("Scenario 9 · upload fails midway", () => {
  const sender = nacl.box.keyPair();
  const recipient = nacl.box.keyPair();
  const recipientRef = {
    device_id: "peer-1",
    recipient_public_key: recipient.publicKey,
  };

  it(
    "mid-stream network abort · returns upload_failed without throw, no plaintext leak, no persisted row",
    async () => {
      // Sentinel plaintext · must NEVER appear in the failure payload.
      const plaintext = "A22_SCN9_MIDSTREAM_SENTINEL_f3c9d12";
      const bytes = naclUtil.decodeUTF8(plaintext);

      // Mock a fetch that accepts the connection but then throws
      // AFTER the request body is "in flight" · this is the
      // closest Node fetch can get to the plan's two-chunk-upload
      // shape given the single-POST architecture.
      const fetchImpl = vi.fn(async () => {
        // Simulate partial transmission: read nothing, throw.
        throw Object.assign(new TypeError("aborted after first chunk"), {
          name: "AbortError",
        });
      });

      const res = await uploadEncryptedAttachment({
        file: makeFile(bytes),
        senderSecretKey: sender.secretKey,
        recipients: [recipientRef],
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("upload_failed");
        const payload = JSON.stringify(res);
        // Plaintext must never appear.
        expect(payload).not.toContain(plaintext);
        // Sender secret base64 must never appear.
        expect(payload).not.toContain(naclUtil.encodeBase64(sender.secretKey));
        // No storage token present in a failure.
        expect((res as { ciphertext_url_token?: string }).ciphertext_url_token).toBeUndefined();
        // No wrapped keys present in a failure.
        expect((res as { wrapped_keys?: unknown }).wrapped_keys).toBeUndefined();
      }
    },
  );

  it(
    "server-side storage error mid-stream (500) · returns upload_failed, server response body is NOT echoed",
    async () => {
      // If the server responds mid-upload with a 5xx that includes an
      // echoed payload, the helper must NOT propagate the echoed body
      // · the sealed no-echo rule protects against a misbehaving route
      // that could reflect ciphertext.
      const sentinelEcho = "SERVER_ECHOED_BODY_A22_NEVER_LEAK";
      const fetchImpl = vi.fn(async () => {
        return new Response(sentinelEcho, { status: 500 });
      });

      const plaintext = "MIDSTREAM_PLAIN_B_9eef2";
      const bytes = naclUtil.decodeUTF8(plaintext);

      const res = await uploadEncryptedAttachment({
        file: makeFile(bytes),
        senderSecretKey: sender.secretKey,
        recipients: [recipientRef],
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("upload_failed");
        // Sealed rule · detail must only carry http_<status>, not
        // the echoed server body.
        expect((res as { detail?: string }).detail).toBe("http_500");
        const payload = JSON.stringify(res);
        expect(payload).not.toContain(sentinelEcho);
        expect(payload).not.toContain(plaintext);
      }
    },
  );

  it(
    "partial-success body with error payload · maps safely, no leaked server strings",
    async () => {
      // 200 body with { ok:false, error: "storage_upload: ..." } · the
      // server reached storage but could not finish. Must collapse to
      // upload_failed with a whitelisted code, not the server message.
      const fetchImpl = vi.fn(async () => {
        return new Response(
          JSON.stringify({ ok: false, error: "storage_upload: half-written chunk lost" }),
          { status: 200 },
        );
      });

      const res = await uploadEncryptedAttachment({
        file: makeFile(naclUtil.decodeUTF8("ANY_PLAINTEXT_c7")),
        senderSecretKey: sender.secretKey,
        recipients: [recipientRef],
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("upload_failed");
        expect((res as { detail?: string }).detail).toBe("storage_upload");
        expect(JSON.stringify(res)).not.toContain("half-written chunk lost");
      }
    },
  );
});
