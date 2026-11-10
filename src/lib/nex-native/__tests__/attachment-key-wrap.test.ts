// src/lib/nex-native/__tests__/attachment-key-wrap.test.ts
//
// NEX device-key chat · attachment-key wrap/unwrap unit tests.
// Owner-authorised 2026-11-10.
// -----------------------------------------------------------------
// Covers:
//   1. round-trip · wrap then unwrap recovers original key
//   2. tampered-ciphertext-rejected · flipping a byte returns null
//   3. tampered-nonce-rejected · flipping the nonce returns null
//   4. wrong-recipient-key-rejected · unwrapping with a different
//      recipient secret returns null
//   5. identical-input-identical-output-with-same-nonce · the wrap
//      function is deterministic when a nonce override is supplied
//      (used to prove wrap is a function of its inputs)

import { describe, expect, it } from "vitest";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import {
  ATTACHMENT_KEY_BYTES,
  WRAP_NONCE_BYTES,
  unwrapAttachmentKey,
  wrapAttachmentKey,
} from "../crypto/attachment-key-wrap";

function randomBytes(n: number): Uint8Array {
  return nacl.randomBytes(n);
}

describe("attachment-key-wrap", () => {
  it("round-trips a wrapped key through the recipient", () => {
    const sender = nacl.box.keyPair();
    const recipient = nacl.box.keyPair();
    const attachmentKey = randomBytes(ATTACHMENT_KEY_BYTES);
    const blob = wrapAttachmentKey({
      attachmentKey,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    });
    const unwrapped = unwrapAttachmentKey({
      blob,
      senderPublicKey: sender.publicKey,
      recipientSecretKey: recipient.secretKey,
    });
    expect(unwrapped).not.toBeNull();
    expect(Array.from(unwrapped!)).toEqual(Array.from(attachmentKey));
  });

  it("rejects a tampered ciphertext (Poly1305 tag fails)", () => {
    const sender = nacl.box.keyPair();
    const recipient = nacl.box.keyPair();
    const attachmentKey = randomBytes(ATTACHMENT_KEY_BYTES);
    const blob = wrapAttachmentKey({
      attachmentKey,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    });
    const rawCt = naclUtil.decodeBase64(blob.ciphertext_b64);
    rawCt[0] ^= 0x01;
    const tampered = {
      nonce_b64: blob.nonce_b64,
      ciphertext_b64: naclUtil.encodeBase64(rawCt),
    };
    const unwrapped = unwrapAttachmentKey({
      blob: tampered,
      senderPublicKey: sender.publicKey,
      recipientSecretKey: recipient.secretKey,
    });
    expect(unwrapped).toBeNull();
  });

  it("rejects a tampered nonce", () => {
    const sender = nacl.box.keyPair();
    const recipient = nacl.box.keyPair();
    const attachmentKey = randomBytes(ATTACHMENT_KEY_BYTES);
    const blob = wrapAttachmentKey({
      attachmentKey,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    });
    const rawNonce = naclUtil.decodeBase64(blob.nonce_b64);
    rawNonce[0] ^= 0x01;
    const tampered = {
      nonce_b64: naclUtil.encodeBase64(rawNonce),
      ciphertext_b64: blob.ciphertext_b64,
    };
    const unwrapped = unwrapAttachmentKey({
      blob: tampered,
      senderPublicKey: sender.publicKey,
      recipientSecretKey: recipient.secretKey,
    });
    expect(unwrapped).toBeNull();
  });

  it("rejects an unwrap attempt with the wrong recipient secret key", () => {
    const sender = nacl.box.keyPair();
    const recipient = nacl.box.keyPair();
    const attacker = nacl.box.keyPair();
    const attachmentKey = randomBytes(ATTACHMENT_KEY_BYTES);
    const blob = wrapAttachmentKey({
      attachmentKey,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    });
    const unwrapped = unwrapAttachmentKey({
      blob,
      senderPublicKey: sender.publicKey,
      recipientSecretKey: attacker.secretKey,
    });
    expect(unwrapped).toBeNull();
  });

  it("is deterministic when the same nonce is supplied", () => {
    const sender = nacl.box.keyPair();
    const recipient = nacl.box.keyPair();
    const attachmentKey = randomBytes(ATTACHMENT_KEY_BYTES);
    const nonce = randomBytes(WRAP_NONCE_BYTES);
    const blob1 = wrapAttachmentKey({
      attachmentKey,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
      nonceOverride: nonce,
    });
    const blob2 = wrapAttachmentKey({
      attachmentKey,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
      nonceOverride: nonce,
    });
    expect(blob1.ciphertext_b64).toBe(blob2.ciphertext_b64);
    expect(blob1.nonce_b64).toBe(blob2.nonce_b64);
  });
});
