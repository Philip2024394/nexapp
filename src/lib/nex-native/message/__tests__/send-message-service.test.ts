// src/lib/nex-native/message/__tests__/send-message-service.test.ts

import { describe, expect, it } from "vitest";
import { sendMessage, type SendMessageInput } from "../send-message-service";
import { toBase64Url } from "../../crypto/encrypt-message";

async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits", "deriveKey"],
  );
}

async function exportPublicB64(kp: CryptoKeyPair): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)));
}

function makeInput(partial: Partial<SendMessageInput> = {}): SendMessageInput {
  return {
    kind: "peer_chat",
    conversation_id: "conv-1",
    sender_device_id: "sender-dev-1",
    recipient_devices: [],
    plaintext_utf8: "hello",
    sent_at: Date.now(),
    ...partial,
  };
}

describe("sendMessage", () => {
  it("returns no_active_recipient_device when recipient list empty (I-2 defer)", async () => {
    const r = await sendMessage(makeInput({ recipient_devices: [] }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected not ok");
    expect(r.error).toBe("no_active_recipient_device");
  });

  it("rejects invalid plaintext_utf8", async () => {
    const r = await sendMessage(makeInput({ plaintext_utf8: "" }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected not ok");
    expect(r.error).toBe("invalid_input");
  });

  it("rejects when only ECDSA-P256 keys (no ECDH)", async () => {
    const r = await sendMessage(
      makeInput({
        recipient_devices: [
          {
            device_id: "dev-a",
            public_key_base64: "A".repeat(80),
            key_algorithm: "ECDSA-P256",
          },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected not ok");
    expect(r.error).toBe("unsupported_key_algorithm");
  });

  it("encrypts to a single ECDH recipient", async () => {
    const kp = await generateECDHKeyPair();
    const pub = await exportPublicB64(kp);
    const r = await sendMessage(
      makeInput({
        recipient_devices: [
          {
            device_id: "dev-recv-1",
            public_key_base64: pub,
            key_algorithm: "ECDH-P256",
          },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.envelopes).toHaveLength(1);
    expect(r.delivered_to_device_ids).toEqual(["dev-recv-1"]);
    expect(r.envelopes[0].envelope.v).toBe(1);
  });

  it("encrypts to multiple ECDH recipients (fan-out across devices)", async () => {
    const [a, b, c] = await Promise.all([generateECDHKeyPair(), generateECDHKeyPair(), generateECDHKeyPair()]);
    const r = await sendMessage(
      makeInput({
        recipient_devices: [
          { device_id: "da", public_key_base64: await exportPublicB64(a), key_algorithm: "ECDH-P256" },
          { device_id: "db", public_key_base64: await exportPublicB64(b), key_algorithm: "ECDH-P256" },
          { device_id: "dc", public_key_base64: await exportPublicB64(c), key_algorithm: "ECDH-P256" },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.envelopes).toHaveLength(3);
    // Each envelope must differ (fresh ephemeral + fresh IV)
    const epks = new Set(r.envelopes.map((e) => e.envelope.epk));
    expect(epks.size).toBe(3);
  });

  it("skips ECDSA keys but keeps ECDH keys in a mixed list", async () => {
    const kp = await generateECDHKeyPair();
    const pub = await exportPublicB64(kp);
    const r = await sendMessage(
      makeInput({
        recipient_devices: [
          { device_id: "ecdsa-dev", public_key_base64: "A".repeat(80), key_algorithm: "ECDSA-P256" },
          { device_id: "ecdh-dev", public_key_base64: pub, key_algorithm: "ECDH-P256" },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.delivered_to_device_ids).toEqual(["ecdh-dev"]);
  });

  it("supports all four MessageKinds uniformly (I-3 compliance)", async () => {
    const kp = await generateECDHKeyPair();
    const pub = await exportPublicB64(kp);
    const kinds: SendMessageInput["kind"][] = [
      "peer_chat",
      "business_chat",
      "nex_official",
      "hq_direct_channel",
    ];
    for (const kind of kinds) {
      const r = await sendMessage(
        makeInput({
          kind,
          recipient_devices: [
            { device_id: "dev", public_key_base64: pub, key_algorithm: "ECDH-P256" },
          ],
        }),
      );
      expect(r.ok).toBe(true);
    }
  });

  it("I-1 compliance · envelope payload contains no plaintext bytes", async () => {
    const kp = await generateECDHKeyPair();
    const pub = await exportPublicB64(kp);
    const r = await sendMessage(
      makeInput({
        plaintext_utf8: "SECRET_MSG_MARKER_ABCDEF",
        recipient_devices: [
          { device_id: "dev", public_key_base64: pub, key_algorithm: "ECDH-P256" },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    const serialised = JSON.stringify(r.envelopes);
    expect(serialised.includes("SECRET_MSG_MARKER_ABCDEF")).toBe(false);
  });

  it("returns a fresh message_id each call", async () => {
    const kp = await generateECDHKeyPair();
    const pub = await exportPublicB64(kp);
    const [r1, r2] = await Promise.all([
      sendMessage(makeInput({
        recipient_devices: [{ device_id: "d", public_key_base64: pub, key_algorithm: "ECDH-P256" }],
      })),
      sendMessage(makeInput({
        recipient_devices: [{ device_id: "d", public_key_base64: pub, key_algorithm: "ECDH-P256" }],
      })),
    ]);
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) throw new Error("expected ok");
    expect(r1.message_id).not.toBe(r2.message_id);
  });
});
