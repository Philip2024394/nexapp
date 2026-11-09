// src/lib/nex-native/attachment/chunked-decoder.ts
//
// Phase 2 Sprint 6 (DRAFT · not applied) · attachment chunked decoder.
//
// Reassembles chunks from the data channel back into a plaintext
// attachment on the recipient device. Verifies the footer's SHA-256
// digest · rejects on mismatch (integrity check).

import { decryptForRecipient } from "../crypto/decrypt-message";
import type {
  AttachmentChunk,
  AttachmentFooter,
  AttachmentHeader,
  AttachmentRecord,
} from "./chunked-encoder";

const subtle = globalThis.crypto?.subtle;

export interface DecodeAttachmentInput {
  recipientPrivateKey: CryptoKey;
  records: AsyncIterable<AttachmentRecord>;
  recipient_device_id?: string;
  sender_device_id?: string;
}

export type DecodeAttachmentResult =
  | { ok: true; attachment_id: string; mime: string; plaintext: Uint8Array }
  | { ok: false; error: "no_header" | "missing_chunks" | "no_footer" | "integrity_fail" | "decrypt_fail"; detail?: string };

export async function decodeAttachment(
  input: DecodeAttachmentInput,
): Promise<DecodeAttachmentResult> {
  if (!subtle) throw new Error("WebCrypto subtle unavailable");

  let header: AttachmentHeader | null = null;
  const chunks = new Map<number, Uint8Array>();
  let footer: AttachmentFooter | null = null;

  for await (const record of input.records) {
    if (record.kind === "header") {
      header = record;
    } else if (record.kind === "chunk") {
      if (!header) continue;
      try {
        const plain = await decryptForRecipient({
          recipientPrivateKey: input.recipientPrivateKey,
          envelope: (record as AttachmentChunk).ciphertext_envelope,
          info: {
            senderDeviceId: input.sender_device_id,
            recipientDeviceId: input.recipient_device_id,
          },
        });
        chunks.set((record as AttachmentChunk).chunk_index, plain);
      } catch (e) {
        return {
          ok: false,
          error: "decrypt_fail",
          detail: e instanceof Error ? e.message : String(e),
        };
      }
    } else if (record.kind === "footer") {
      footer = record;
    }
  }

  if (!header) return { ok: false, error: "no_header" };
  if (!footer) return { ok: false, error: "no_footer" };

  if (chunks.size !== header.total_chunks) {
    return {
      ok: false,
      error: "missing_chunks",
      detail: `received ${chunks.size} · expected ${header.total_chunks}`,
    };
  }

  // Reassemble in order
  const out = new Uint8Array(header.total_bytes);
  let offset = 0;
  for (let i = 0; i < header.total_chunks; i++) {
    const c = chunks.get(i);
    if (!c) {
      return { ok: false, error: "missing_chunks", detail: `chunk ${i} missing` };
    }
    out.set(c, offset);
    offset += c.length;
  }

  // Integrity check
  const digest = new Uint8Array(await subtle.digest("SHA-256", out));
  const expected = fromBase64(footer.plaintext_sha256_base64);
  if (!equalBytes(digest, expected)) {
    return {
      ok: false,
      error: "integrity_fail",
      detail: "plaintext SHA-256 mismatch",
    };
  }

  return {
    ok: true,
    attachment_id: header.attachment_id,
    mime: header.mime,
    plaintext: out,
  };
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
