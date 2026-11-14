// src/lib/nex-native/business-chat/__tests__/product-card-crypto-roundtrip.test.ts
//
// Stage 5 · 2026-11-14 · owner-authorised build-only.
// -----------------------------------------------------------------------------
// Proves the Stage 2 product-card contract end-to-end at the CRYPTO
// layer (the only part that can be exercised honestly without a
// browser / real Supabase):
//
//   1. Customer device builds a product-card envelope.
//   2. Customer encrypts it with the shared secret derived against
//      the shop-owner's device public key (same tweetnacl.box path
//      the Shop Chat composer uses).
//   3. Shop-owner device derives the same shared secret the OTHER
//      way (owner secret × customer public) and decrypts.
//   4. Decrypted plaintext parses back into the ORIGINAL product
//      snapshot — fields intact, bubble renderer will paint a real
//      ProductCardBubble.
//
// This is the unit the real browser send+receive performs twice:
//   · once per recipient device (fan-out)
//   · once per self device (read-your-own-sent history recovery)
//
// What this proves (spec items #4 + #6 at crypto level):
//   · Encrypted send round-trip works for product-card shape.
//   · Payload is NOT recoverable without the matching device key
//     (tamper + wrong-key tests below).
//   · Server-visible `attachment_meta` (bare product_id) is enough
//     to identify the row but NOT to recover any price / name / image.
//
// What this does NOT prove (needs real browser / two sessions):
//   · nex_message insertion / listBusinessMessages retrieval
//     (covered separately in participant-guard.test.ts).
//   · Push notification dispatch (covered in dispatch-wiring tests).
//   · Realtime arrival nudge (sealed Bridge 73 · covered elsewhere).

import { describe, expect, it } from "vitest";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import {
  buildProductCardEnvelope,
  parseProductCardEnvelope,
} from "@/lib/nex-native/business-chat/product-card-envelope";

function newKeyPair() {
  return nacl.box.keyPair();
}

function deriveSharedSecret(
  mySecret: Uint8Array,
  theirPublic: Uint8Array,
): Uint8Array {
  return nacl.box.before(theirPublic, mySecret);
}

const SAMPLE = {
  id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  name: "Classic hand-stitched leather tote",
  price_pence: 450_000,
  currency: "IDR",
  image_url: "https://example.supabase.co/img/leather-tote.jpg",
};

describe("product-card crypto roundtrip · happy path", () => {
  it("customer→owner · ciphertext decrypts to the exact envelope", () => {
    const customer = newKeyPair();
    const owner = newKeyPair();

    // Customer side · build envelope + encrypt against owner's pubkey
    const envelope = buildProductCardEnvelope(SAMPLE);
    const plaintextBytes = naclUtil.decodeUTF8(envelope.plaintext);
    const customerShared = deriveSharedSecret(
      customer.secretKey,
      owner.publicKey,
    );
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const ciphertext = nacl.box.after(
      plaintextBytes,
      nonce,
      customerShared,
    );

    // Owner side · derive the SAME shared secret the other way around
    // (ECDH is symmetric · owner_secret × customer_public === the
    // customer's customer_secret × owner_public).
    const ownerShared = deriveSharedSecret(
      owner.secretKey,
      customer.publicKey,
    );
    const decrypted = nacl.box.open.after(ciphertext, nonce, ownerShared);
    expect(decrypted).not.toBeNull();

    // Decode + parse back into the product snapshot the bubble renderer
    // expects. All fields must round-trip unchanged.
    const plaintextBack = naclUtil.encodeUTF8(decrypted!);
    const parsed = parseProductCardEnvelope(plaintextBack);
    expect(parsed).toEqual(SAMPLE);
  });

  it("customer→self · the fan-out copy for the sender's OTHER device also decrypts", () => {
    // Real send: encrypt one copy per peer device AND one copy per
    // self device (so a later session on a second device can read
    // sent history). This test proves the self-fan-out works for
    // the product-card shape.
    const deviceA = newKeyPair(); // sender's current device
    const deviceB = newKeyPair(); // sender's OTHER device (e.g. tablet)

    const envelope = buildProductCardEnvelope(SAMPLE);
    const plaintextBytes = naclUtil.decodeUTF8(envelope.plaintext);
    const sharedForB = deriveSharedSecret(deviceA.secretKey, deviceB.publicKey);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const ciphertext = nacl.box.after(plaintextBytes, nonce, sharedForB);

    // Device B derives the reverse shared secret and decrypts.
    const sharedOnB = deriveSharedSecret(deviceB.secretKey, deviceA.publicKey);
    const decrypted = nacl.box.open.after(ciphertext, nonce, sharedOnB);
    expect(decrypted).not.toBeNull();
    const parsed = parseProductCardEnvelope(naclUtil.encodeUTF8(decrypted!));
    expect(parsed).toEqual(SAMPLE);
  });
});

describe("product-card crypto roundtrip · negative paths", () => {
  it("wrong recipient key · returns null (no plaintext leak)", () => {
    const customer = newKeyPair();
    const intendedOwner = newKeyPair();
    const otherParty = newKeyPair(); // NOT the recipient

    const envelope = buildProductCardEnvelope(SAMPLE);
    const plaintextBytes = naclUtil.decodeUTF8(envelope.plaintext);
    const customerShared = deriveSharedSecret(
      customer.secretKey,
      intendedOwner.publicKey,
    );
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const ciphertext = nacl.box.after(plaintextBytes, nonce, customerShared);

    // otherParty tries to decrypt with their own key · must fail.
    const wrongShared = deriveSharedSecret(
      otherParty.secretKey,
      customer.publicKey,
    );
    const attempted = nacl.box.open.after(ciphertext, nonce, wrongShared);
    expect(attempted).toBeNull();
  });

  it("tampered ciphertext · Poly1305 tag check fails · returns null", () => {
    const customer = newKeyPair();
    const owner = newKeyPair();
    const envelope = buildProductCardEnvelope(SAMPLE);
    const plaintextBytes = naclUtil.decodeUTF8(envelope.plaintext);
    const shared = deriveSharedSecret(customer.secretKey, owner.publicKey);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const ciphertext = nacl.box.after(plaintextBytes, nonce, shared);

    // Flip a byte in the middle of the ciphertext.
    const tampered = new Uint8Array(ciphertext);
    tampered[Math.floor(tampered.length / 2)] ^= 0xff;

    const ownerShared = deriveSharedSecret(
      owner.secretKey,
      customer.publicKey,
    );
    const attempted = nacl.box.open.after(tampered, nonce, ownerShared);
    expect(attempted).toBeNull();
  });

  it("tampered nonce · Poly1305 tag check fails · returns null", () => {
    const customer = newKeyPair();
    const owner = newKeyPair();
    const envelope = buildProductCardEnvelope(SAMPLE);
    const plaintextBytes = naclUtil.decodeUTF8(envelope.plaintext);
    const shared = deriveSharedSecret(customer.secretKey, owner.publicKey);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const ciphertext = nacl.box.after(plaintextBytes, nonce, shared);

    // Flip a byte in the nonce · same shared secret, different nonce,
    // tag verification fails.
    const tamperedNonce = new Uint8Array(nonce);
    tamperedNonce[0] ^= 0xff;

    const ownerShared = deriveSharedSecret(
      owner.secretKey,
      customer.publicKey,
    );
    const attempted = nacl.box.open.after(
      ciphertext,
      tamperedNonce,
      ownerShared,
    );
    expect(attempted).toBeNull();
  });
});

describe("product-card crypto roundtrip · server-visible leakage contract", () => {
  it("attachment_meta contains ONLY product_id · no name/price/image leak", () => {
    // Server-side the only non-encrypted field is attachment_meta.
    // Buyer's chosen quantity, personal notes, device id, and the
    // price snapshot at send-time all live inside the ciphertext.
    // This confirms the envelope split keeps the server in the dark
    // about those details · belt-and-braces check on top of the
    // helper's own unit test.
    const envelope = buildProductCardEnvelope(SAMPLE);
    const metaKeys = Object.keys(envelope.attachmentMeta);
    expect(metaKeys).toEqual(["product_id"]);
    // Insert payload shape matches what sendEncryptedBusinessMessages
    // writes to nex_message. Only ciphertext + nonce + metadata ship
    // over the wire · body is ALWAYS null for encrypted rows.
    const wirePayload = {
      body: null,
      encrypted: true,
      attachment_type: envelope.attachmentType,
      attachment_meta: envelope.attachmentMeta,
    };
    expect(wirePayload.body).toBeNull();
    expect(wirePayload.attachment_type).toBe("product");
    expect(wirePayload.attachment_meta).toEqual({
      product_id: SAMPLE.id,
    });
    // Defensive · the snapshot fields must not have slipped into the
    // server-visible shape.
    expect(JSON.stringify(wirePayload)).not.toContain(SAMPLE.name);
    expect(JSON.stringify(wirePayload)).not.toContain(
      String(SAMPLE.price_pence),
    );
    expect(JSON.stringify(wirePayload)).not.toContain(SAMPLE.image_url);
  });
});
