// src/lib/nex-native/attachment/__tests__/chunked.test.ts

import { describe, expect, it } from "vitest";
import {
  encodeAttachment,
  CHUNK_SIZE_BYTES,
  type AttachmentRecord,
} from "../chunked-encoder";
import { decodeAttachment } from "../chunked-decoder";

async function generateP256KeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits", "deriveKey"],
  );
}

async function exportRawPublic(kp: CryptoKeyPair): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
}

async function collect(
  iter: AsyncGenerator<AttachmentRecord, void, unknown>,
): Promise<AttachmentRecord[]> {
  const out: AttachmentRecord[] = [];
  for await (const r of iter) out.push(r);
  return out;
}

/** crypto.getRandomValues has a 65536-byte cap · fill in chunks. */
function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const CHUNK = 65_536;
  for (let i = 0; i < n; i += CHUNK) {
    const end = Math.min(i + CHUNK, n);
    crypto.getRandomValues(out.subarray(i, end));
  }
  return out;
}

async function* fromArray(
  arr: AttachmentRecord[],
): AsyncIterable<AttachmentRecord> {
  for (const r of arr) yield r;
}

describe("encodeAttachment + decodeAttachment", () => {
  it("round-trips a small attachment (< 1 chunk)", async () => {
    const recipient = await generateP256KeyPair();
    const pub = await exportRawPublic(recipient);
    const plaintext = new TextEncoder().encode("hello attachment");

    const records = await collect(
      encodeAttachment({
        attachment_id: "att-1",
        mime: "text/plain",
        plaintext,
        recipientPublicKeyRaw: pub,
        recipient_device_id: "dev-b",
      }),
    );

    expect(records.filter((r) => r.kind === "header")).toHaveLength(1);
    expect(records.filter((r) => r.kind === "footer")).toHaveLength(1);
    expect(records.filter((r) => r.kind === "chunk")).toHaveLength(1);

    const result = await decodeAttachment({
      recipientPrivateKey: recipient.privateKey,
      records: fromArray(records),
      recipient_device_id: "dev-b",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(new TextDecoder().decode(result.plaintext)).toBe("hello attachment");
  });

  it("round-trips a 200 KB attachment (multiple chunks)", async () => {
    const recipient = await generateP256KeyPair();
    const pub = await exportRawPublic(recipient);
    const plaintext = randomBytes(200 * 1024);

    const records = await collect(
      encodeAttachment({
        attachment_id: "att-big",
        mime: "application/octet-stream",
        plaintext,
        recipientPublicKeyRaw: pub,
        recipient_device_id: "dev-b",
      }),
    );

    const expectedChunks = Math.ceil(plaintext.byteLength / CHUNK_SIZE_BYTES);
    expect(records.filter((r) => r.kind === "chunk")).toHaveLength(expectedChunks);

    const result = await decodeAttachment({
      recipientPrivateKey: recipient.privateKey,
      records: fromArray(records),
      recipient_device_id: "dev-b",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.plaintext).toEqual(plaintext);
  });

  it("rejects on missing chunk (integrity + completeness)", async () => {
    const recipient = await generateP256KeyPair();
    const pub = await exportRawPublic(recipient);
    const plaintext = randomBytes(128 * 1024);

    const records = await collect(
      encodeAttachment({
        attachment_id: "att-tamper",
        mime: "application/octet-stream",
        plaintext,
        recipientPublicKeyRaw: pub,
        recipient_device_id: "dev-b",
      }),
    );
    // Drop one chunk
    const chunks = records.filter((r) => r.kind === "chunk");
    const dropped = chunks[0];
    const tampered = records.filter((r) => r !== dropped);

    const result = await decodeAttachment({
      recipientPrivateKey: recipient.privateKey,
      records: fromArray(tampered),
      recipient_device_id: "dev-b",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not ok");
    expect(result.error).toBe("missing_chunks");
  });

  it("rejects on missing footer", async () => {
    const recipient = await generateP256KeyPair();
    const pub = await exportRawPublic(recipient);
    const records = await collect(
      encodeAttachment({
        attachment_id: "att",
        mime: "text/plain",
        plaintext: new Uint8Array([1, 2, 3]),
        recipientPublicKeyRaw: pub,
        recipient_device_id: "dev-b",
      }),
    );
    const noFooter = records.filter((r) => r.kind !== "footer");
    const result = await decodeAttachment({
      recipientPrivateKey: recipient.privateKey,
      records: fromArray(noFooter),
      recipient_device_id: "dev-b",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not ok");
    expect(result.error).toBe("no_footer");
  });

  it("I-1 compliance · encoded records contain NO plaintext bytes", async () => {
    const recipient = await generateP256KeyPair();
    const pub = await exportRawPublic(recipient);
    const signalText = "SECRET_ATTACHMENT_MARKER_XYZ";
    const plaintext = new TextEncoder().encode(signalText);

    const records = await collect(
      encodeAttachment({
        attachment_id: "att",
        mime: "text/plain",
        plaintext,
        recipientPublicKeyRaw: pub,
        recipient_device_id: "dev-b",
      }),
    );

    const serialised = JSON.stringify(records);
    expect(serialised.includes(signalText)).toBe(false);
  });
});
