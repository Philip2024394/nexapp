// src/lib/nex-native/attachment/chunked-encoder.ts
//
// Phase 2 Sprint 6 (DRAFT · not applied) · attachment chunked encoder.
//
// Splits an attachment (image · video · voice · document) into fixed-
// size chunks, encrypts each chunk to the recipient's device public
// key (reusing Sprint 4 primitives), and streams them to the caller
// for transmission over the WebRTC data channel.
//
// Sealed-invariant context:
//   · I-1 · chunks are CIPHERTEXT · never plaintext. NEX servers
//     never see the attachment bytes.
//   · Attachments travel PEER-TO-PEER via data channel (Sprint 3).
//     NEX storage buckets are never used (sealed C-1 for chat).
//
// Framing:
//   First chunk emits a HEADER record with the attachment's mime, size,
//   total chunk count, and attachment_id (opaque UUID).
//   Subsequent chunks emit DATA records with chunk index + encrypted
//   chunk bytes.
//   A final FOOTER record emits a SHA-256 of the full plaintext for
//   integrity verification on the receiver side.

import { encryptForRecipient } from "../crypto/encrypt-message";

/** Chunk size in bytes. Below WebRTC's 256 KB per-send limit; well
 *  within the data-channel backpressure threshold. */
export const CHUNK_SIZE_BYTES = 64 * 1024; // 64 KB

export interface AttachmentHeader {
  kind: "header";
  attachment_id: string;
  mime: string;
  total_bytes: number;
  total_chunks: number;
  recipient_device_id: string;
}

export interface AttachmentChunk {
  kind: "chunk";
  attachment_id: string;
  chunk_index: number;
  ciphertext_envelope: Awaited<ReturnType<typeof encryptForRecipient>>;
}

export interface AttachmentFooter {
  kind: "footer";
  attachment_id: string;
  plaintext_sha256_base64: string;
}

export type AttachmentRecord = AttachmentHeader | AttachmentChunk | AttachmentFooter;

export interface EncodeAttachmentInput {
  attachment_id: string;
  mime: string;
  plaintext: Uint8Array;
  recipientPublicKeyRaw: Uint8Array;
  recipient_device_id: string;
  sender_device_id?: string;
}

const subtle = globalThis.crypto?.subtle;

/**
 * Async generator yielding header + N chunks + footer. Caller is
 * expected to `send()` each yielded record over the data channel in
 * order. Yielding is lazy so we don't buffer everything · memory stays
 * bounded at ~2 chunks regardless of attachment size.
 */
export async function* encodeAttachment(
  input: EncodeAttachmentInput,
): AsyncGenerator<AttachmentRecord, void, unknown> {
  if (!subtle) throw new Error("WebCrypto subtle unavailable");

  const total_bytes = input.plaintext.byteLength;
  const total_chunks = Math.max(1, Math.ceil(total_bytes / CHUNK_SIZE_BYTES));

  yield {
    kind: "header",
    attachment_id: input.attachment_id,
    mime: input.mime,
    total_bytes,
    total_chunks,
    recipient_device_id: input.recipient_device_id,
  };

  for (let i = 0; i < total_chunks; i++) {
    const start = i * CHUNK_SIZE_BYTES;
    const end = Math.min(start + CHUNK_SIZE_BYTES, total_bytes);
    const chunk = input.plaintext.slice(start, end);
    const envelope = await encryptForRecipient({
      recipientPublicKeyRaw: input.recipientPublicKeyRaw,
      plaintext: chunk,
      additionalAuthenticatedData: new TextEncoder().encode(
        `${input.attachment_id}#${i}`,
      ),
      info: {
        senderDeviceId: input.sender_device_id,
        recipientDeviceId: input.recipient_device_id,
      },
    });
    yield {
      kind: "chunk",
      attachment_id: input.attachment_id,
      chunk_index: i,
      ciphertext_envelope: envelope,
    };
  }

  const plainDigest = await subtle.digest("SHA-256", input.plaintext);
  yield {
    kind: "footer",
    attachment_id: input.attachment_id,
    plaintext_sha256_base64: toBase64(new Uint8Array(plainDigest)),
  };
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
