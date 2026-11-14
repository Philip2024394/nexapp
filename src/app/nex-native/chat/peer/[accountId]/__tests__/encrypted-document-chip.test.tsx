// src/app/nex-native/chat/peer/[accountId]/__tests__/encrypted-document-chip.test.tsx
//
// P1.T04 Phase 3 · recipient UI integration tests · 2026-11-13.
// -----------------------------------------------------------------------------
// Node-only tests (the project's vitest runner does not install
// jsdom · see vitest.config.mts). Covers:
//
//   · Static render contract: the chip NEVER exposes the filename at
//     first paint, regardless of the envelope's encrypted filename.
//   · Size formatting helper (formatSize).
//   · Marks the correct data attributes for state-based styling.
//
// The deeper behaviour — fetch → unwrap → decrypt → download — is
// tested at the pure-function layer in
// `src/lib/nex-native/crypto/__tests__/encrypted-document-attachment.test.ts`
// which covers wrong-device rejection, Poly1305 tamper detection,
// malformed envelope, network-failure handling, and the filename
// privacy invariant. That test file is the source of truth for the
// crypto path · this file is the UI-contract check.

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  EncryptedDocumentChip,
  formatSize,
} from "../_encrypted-document-chip";
import {
  buildEnvelope,
  wrapContentKey,
  encryptSmallBytes,
} from "@/lib/nex-native/crypto/attachment-envelope";
import type { NexDeviceKey } from "@/lib/nex-native/crypto/device-key";

const SENDER_ACCOUNT = "sender-account-11111";

function makeDeviceKey(deviceId: string): NexDeviceKey {
  const pair = nacl.box.keyPair();
  return {
    deviceId,
    secretKey: pair.secretKey,
    publicKey: pair.publicKey,
    createdAt: Date.now(),
  };
}

function buildEnvelopeB64(opts: {
  filename: string;
  plaintextBytes: Uint8Array;
  sizeBytes?: number;
}): string {
  const sender = makeDeviceKey("sender-dev");
  const recipient = makeDeviceKey("recipient-dev");
  const contentKey = nacl.randomBytes(nacl.secretbox.keyLength);
  const contentNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const wrapped = wrapContentKey(
    contentKey,
    sender,
    "recipient-acc",
    recipient.deviceId,
    naclUtil.encodeBase64(recipient.publicKey),
  );
  const fn = encryptSmallBytes(
    new TextEncoder().encode(opts.filename),
    contentKey,
  );
  const envelope = buildEnvelope({
    storageUrl: "https://example.supabase.co/signed/doc.pdf",
    contentNonce,
    senderPublicKey: naclUtil.encodeBase64(sender.publicKey),
    senderDeviceId: sender.deviceId,
    wrappedKeys: [wrapped],
    contentType: "application/pdf",
    sizeBytes: opts.sizeBytes ?? opts.plaintextBytes.byteLength,
    encryptedFilename: fn.ciphertext,
    filenameNonce: fn.nonce,
  });
  return Buffer.from(JSON.stringify(envelope), "utf-8").toString("base64");
}

// ─── Static render contract ────────────────────────────────────────────

describe("EncryptedDocumentChip · static render", () => {
  it("initial render NEVER exposes the encrypted filename plaintext", () => {
    const SECRET_FILENAME = "payslip-confidential-redacted.pdf";
    const envelopeB64 = buildEnvelopeB64({
      filename: SECRET_FILENAME,
      plaintextBytes: new Uint8Array([1, 2, 3, 4, 5]),
    });
    const html = renderToStaticMarkup(
      <EncryptedDocumentChip
        envelopeB64={envelopeB64}
        senderAccountId={SENDER_ACCOUNT}
        sizeBytes={2048}
      />,
    );
    expect(html).not.toContain(SECRET_FILENAME);
    expect(html).not.toContain("payslip");
    expect(html).not.toContain("confidential");
    expect(html.toLowerCase()).toContain("encrypted document");
    expect(html.toLowerCase()).toContain("tap to download");
    expect(html).toContain("2 KB");
  });

  it("envelope filename-ciphertext base64 does NOT contain the plaintext name", () => {
    // Belt-and-braces · even the rendered envelope attribute is base64
    // of the JSON which carries only ciphertext for the filename.
    // Decoding the base64 should NOT yield the plaintext filename.
    const SECRET_FILENAME = "redacted-source.pdf";
    const envelopeB64 = buildEnvelopeB64({
      filename: SECRET_FILENAME,
      plaintextBytes: new Uint8Array([1, 2]),
    });
    const jsonStr = Buffer.from(envelopeB64, "base64").toString("utf-8");
    // The envelope JSON contains encrypted_filename_b64 (ciphertext)
    // but NOT the plaintext filename.
    expect(jsonStr).not.toContain(SECRET_FILENAME);
    expect(jsonStr).not.toContain("redacted-source");
    expect(jsonStr).toContain("encrypted_filename_b64");
    expect(jsonStr).toContain("filename_nonce_b64");
  });

  it("omits the size label when sizeBytes is null", () => {
    const envelopeB64 = buildEnvelopeB64({
      filename: "doc.pdf",
      plaintextBytes: new Uint8Array([1]),
    });
    const html = renderToStaticMarkup(
      <EncryptedDocumentChip
        envelopeB64={envelopeB64}
        senderAccountId={SENDER_ACCOUNT}
      />,
    );
    expect(html.toLowerCase()).toContain("encrypted document");
    expect(html).not.toContain("KB");
    expect(html).not.toContain("MB");
  });

  it("renders the chip + idle state data attributes", () => {
    const envelopeB64 = buildEnvelopeB64({
      filename: "quick.pdf",
      plaintextBytes: new Uint8Array([1]),
    });
    const html = renderToStaticMarkup(
      <EncryptedDocumentChip
        envelopeB64={envelopeB64}
        senderAccountId={SENDER_ACCOUNT}
        sizeBytes={500}
      />,
    );
    expect(html).toContain("data-nex-encrypted-doc-chip");
    expect(html).toContain('data-nex-encrypted-doc-state="idle"');
  });

  it("the rendered attribute carries only ciphertext (no readable filename substring)", () => {
    // Pull the envelopeB64 out of the rendered markup, base64-decode,
    // and ensure the plaintext filename is not reconstructable from
    // the DOM payload.
    const SECRET_FILENAME = "do-not-leak-this.pdf";
    const envelopeB64 = buildEnvelopeB64({
      filename: SECRET_FILENAME,
      plaintextBytes: new Uint8Array([9, 9, 9]),
    });
    const html = renderToStaticMarkup(
      <EncryptedDocumentChip
        envelopeB64={envelopeB64}
        senderAccountId={SENDER_ACCOUNT}
        sizeBytes={10}
      />,
    );
    // The chip doesn't echo the envelope into a data-attribute · the
    // envelope stays in React state only · but we still assert no
    // plaintext filename appears anywhere in the markup for safety.
    expect(html).not.toContain(SECRET_FILENAME);
    expect(html).not.toContain("do-not-leak");
  });

  it("does NOT render any hyperlink to a public URL", () => {
    // A plaintext fallback path would surface an <a href> pointing at
    // the storage URL · the chip is a <button>, not a link.
    const envelopeB64 = buildEnvelopeB64({
      filename: "ok.pdf",
      plaintextBytes: new Uint8Array([1]),
    });
    const html = renderToStaticMarkup(
      <EncryptedDocumentChip
        envelopeB64={envelopeB64}
        senderAccountId={SENDER_ACCOUNT}
      />,
    );
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href=");
    expect(html).toContain("<button");
    expect(html).not.toContain("nex-peer-chat-attachments");
  });
});

describe("formatSize", () => {
  it("formats bytes / KB / MB sensibly", () => {
    expect(formatSize(0)).toBeNull();
    expect(formatSize(null)).toBeNull();
    expect(formatSize(400)).toBe("400 B");
    expect(formatSize(2048)).toBe("2 KB");
    expect(formatSize(1_500_000)).toBe("1.4 MB");
    expect(formatSize(20_000_000)).toBe("19 MB");
  });
});
