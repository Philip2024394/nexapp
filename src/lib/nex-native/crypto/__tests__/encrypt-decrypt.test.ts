// src/lib/nex-native/crypto/__tests__/encrypt-decrypt.test.ts
//
// Phase 2 Sprint 4 (DRAFT) · round-trip crypto tests using Node 18+'s
// WebCrypto polyfill (available at globalThis.crypto.subtle).

import { describe, expect, it } from "vitest";
import { encryptForRecipient, toBase64Url, fromBase64Url, type EncryptedEnvelope } from "../encrypt-message";
import { decryptForRecipient } from "../decrypt-message";

async function generateP256KeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits", "deriveKey"],
  );
}

async function exportRawPublic(keyPair: CryptoKeyPair): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
}

describe("encrypt-decrypt round-trip", () => {
  it("round-trips a short plaintext", async () => {
    const recipient = await generateP256KeyPair();
    const recipientPub = await exportRawPublic(recipient);

    const plaintext = new TextEncoder().encode("hello nex");
    const envelope = await encryptForRecipient({
      recipientPublicKeyRaw: recipientPub,
      plaintext,
    });

    const decrypted = await decryptForRecipient({
      recipientPrivateKey: recipient.privateKey,
      envelope,
    });

    expect(new TextDecoder().decode(decrypted)).toBe("hello nex");
  });

  it("round-trips 1 KB of random bytes", async () => {
    const recipient = await generateP256KeyPair();
    const recipientPub = await exportRawPublic(recipient);

    const plaintext = crypto.getRandomValues(new Uint8Array(1024));
    const envelope = await encryptForRecipient({
      recipientPublicKeyRaw: recipientPub,
      plaintext,
    });
    const decrypted = await decryptForRecipient({
      recipientPrivateKey: recipient.privateKey,
      envelope,
    });
    expect(decrypted).toEqual(plaintext);
  });

  it("round-trips with AAD binding", async () => {
    const recipient = await generateP256KeyPair();
    const recipientPub = await exportRawPublic(recipient);
    const plaintext = new TextEncoder().encode("secret");
    const aad = new TextEncoder().encode("conversation-id-xyz");

    const envelope = await encryptForRecipient({
      recipientPublicKeyRaw: recipientPub,
      plaintext,
      additionalAuthenticatedData: aad,
    });

    const decrypted = await decryptForRecipient({
      recipientPrivateKey: recipient.privateKey,
      envelope,
    });

    expect(new TextDecoder().decode(decrypted)).toBe("secret");
  });

  it("fails to decrypt if AAD is tampered", async () => {
    const recipient = await generateP256KeyPair();
    const recipientPub = await exportRawPublic(recipient);
    const plaintext = new TextEncoder().encode("secret");

    const envelope = await encryptForRecipient({
      recipientPublicKeyRaw: recipientPub,
      plaintext,
      additionalAuthenticatedData: new TextEncoder().encode("A"),
    });
    const tampered: EncryptedEnvelope = { ...envelope, aad: toBase64Url(new TextEncoder().encode("B")) };

    await expect(
      decryptForRecipient({ recipientPrivateKey: recipient.privateKey, envelope: tampered }),
    ).rejects.toThrow();
  });

  it("fails to decrypt with a different recipient private key", async () => {
    const recipient = await generateP256KeyPair();
    const other = await generateP256KeyPair();
    const recipientPub = await exportRawPublic(recipient);

    const envelope = await encryptForRecipient({
      recipientPublicKeyRaw: recipientPub,
      plaintext: new TextEncoder().encode("hello"),
    });

    await expect(
      decryptForRecipient({ recipientPrivateKey: other.privateKey, envelope }),
    ).rejects.toThrow();
  });

  it("I-1 compliance · ciphertext envelope contains no plaintext bytes", async () => {
    const recipient = await generateP256KeyPair();
    const recipientPub = await exportRawPublic(recipient);
    const plaintext = new TextEncoder().encode("SECRET_SIGNAL_123");

    const envelope = await encryptForRecipient({
      recipientPublicKeyRaw: recipientPub,
      plaintext,
    });

    const serialised = JSON.stringify(envelope);
    expect(serialised.includes("SECRET_SIGNAL_123")).toBe(false);
  });

  it("forward secrecy · two encryptions of the same plaintext produce different envelopes", async () => {
    const recipient = await generateP256KeyPair();
    const recipientPub = await exportRawPublic(recipient);
    const plaintext = new TextEncoder().encode("same");

    const e1 = await encryptForRecipient({ recipientPublicKeyRaw: recipientPub, plaintext });
    const e2 = await encryptForRecipient({ recipientPublicKeyRaw: recipientPub, plaintext });

    expect(e1.epk).not.toBe(e2.epk);
    expect(e1.iv).not.toBe(e2.iv);
    expect(e1.ct).not.toBe(e2.ct);
  });

  it("rejects non-65-byte recipient public key", async () => {
    await expect(
      encryptForRecipient({
        recipientPublicKeyRaw: new Uint8Array(32),
        plaintext: new Uint8Array([1]),
      }),
    ).rejects.toThrow(/65 bytes/);
  });

  it("rejects non-Uint8Array plaintext", async () => {
    const recipient = await generateP256KeyPair();
    const recipientPub = await exportRawPublic(recipient);
    await expect(
      encryptForRecipient({
        recipientPublicKeyRaw: recipientPub,
        plaintext: "string-not-bytes" as unknown as Uint8Array,
      }),
    ).rejects.toThrow(/plaintext/i);
  });
});

describe("base64url helpers", () => {
  it("round-trips arbitrary bytes", () => {
    const input = new Uint8Array([0, 1, 2, 250, 253, 255]);
    expect(fromBase64Url(toBase64Url(input))).toEqual(input);
  });

  it("produces URL-safe output (no + / =)", () => {
    const input = new Uint8Array([0xff, 0xff, 0xff]);
    const out = toBase64Url(input);
    expect(out).not.toMatch(/[+/=]/);
  });
});
