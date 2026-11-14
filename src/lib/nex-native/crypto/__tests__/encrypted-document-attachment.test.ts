// src/lib/nex-native/crypto/__tests__/encrypted-document-attachment.test.ts
//
// P1.T04 Phase 3 · 2026-11-13 · owner-authorised build
// -----------------------------------------------------------------------------
// Proves the extended encrypted attachment pipeline supports documents
// end-to-end. Covers:
//
//   · MIME classification (classifyMime)
//   · Extension mapping (extForMime)
//   · Sender-side encryption + filename encryption via uploadEncryptedAttachment
//   · Recipient-side decryption + filename recovery via fetchAndDecryptDocument
//   · Wrong-device rejection
//   · Corrupt-ciphertext rejection (Poly1305 tag check)
//   · Malformed envelope rejection (one filename field present, other absent)
//   · No-regression: image/video/audio still classify + upload correctly
//   · No-silent-plaintext-fallback: upload MUST NOT bypass the encrypted
//     route when the server returns 503/4xx/malformed.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

vi.mock("server-only", () => ({}));

import {
  classifyMime,
  extForMime,
  SUPPORTED_DOCUMENT_MIMES,
  uploadEncryptedAttachment,
} from "@/lib/nex-native/crypto/encrypted-attachment-upload";
import {
  buildEnvelope,
  encryptSmallBytes,
  decryptSmallBytes,
  wrapContentKey,
  unwrapContentKey,
  type AttachmentEnvelope,
} from "@/lib/nex-native/crypto/attachment-envelope";
import {
  fetchAndDecryptDocument,
  sanitiseFilename,
  type DecryptedDocument,
} from "@/lib/nex-native/crypto/encrypted-document-download";
import type { NexDeviceKey } from "@/lib/nex-native/crypto/device-key";

// ─── Helpers ───────────────────────────────────────────────────────────

function makeDeviceKey(deviceId: string): NexDeviceKey {
  const pair = nacl.box.keyPair();
  return {
    deviceId,
    secretKey: pair.secretKey,
    publicKey: pair.publicKey,
    createdAt: Date.now(),
  };
}

function mkFile(name: string, mime: string, size = 1024): File {
  const bytes = new Uint8Array(size);
  // Fill with something non-trivial so the ciphertext isn't all zeros.
  for (let i = 0; i < size; i++) bytes[i] = (i * 7) & 0xff;
  return new File([bytes], name, { type: mime });
}

// ─── classifyMime ──────────────────────────────────────────────────────

describe("classifyMime · document extensions", () => {
  it.each([
    ["application/pdf", "document"],
    ["application/msword", "document"],
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "document",
    ],
    ["application/vnd.ms-excel", "document"],
    [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "document",
    ],
    ["application/vnd.ms-powerpoint", "document"],
    [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "document",
    ],
    ["text/plain", "document"],
    ["text/csv", "document"],
    ["application/csv", "document"],
    ["application/zip", "document"],
    ["application/x-zip-compressed", "document"],
  ])("classifies %s as document", (mime, expected) => {
    expect(classifyMime(mime)).toBe(expected);
  });

  it("preserves image/video/audio classification (no regression)", () => {
    expect(classifyMime("image/png")).toBe("image");
    expect(classifyMime("image/jpeg")).toBe("image");
    expect(classifyMime("video/mp4")).toBe("video");
    expect(classifyMime("video/webm")).toBe("video");
    expect(classifyMime("audio/mpeg")).toBe("audio");
    expect(classifyMime("audio/webm")).toBe("audio");
  });

  it("returns null for genuinely unsupported MIMEs", () => {
    expect(classifyMime("application/x-sh")).toBeNull();
    expect(classifyMime("application/x-executable")).toBeNull();
    expect(classifyMime("image/vnd.exotic+weird")).toBe("image"); // image/* catches
    expect(classifyMime("")).toBeNull();
  });

  it("SUPPORTED_DOCUMENT_MIMES contains every approved doc type", () => {
    const approved = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/zip",
    ];
    for (const m of approved) expect(SUPPORTED_DOCUMENT_MIMES.has(m)).toBe(true);
  });
});

// ─── extForMime ────────────────────────────────────────────────────────

describe("extForMime · document extensions", () => {
  it.each([
    ["application/pdf", "pdf"],
    ["application/msword", "doc"],
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "docx",
    ],
    ["application/vnd.ms-excel", "xls"],
    [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "xlsx",
    ],
    ["application/vnd.ms-powerpoint", "ppt"],
    [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "pptx",
    ],
    ["text/plain", "txt"],
    ["text/csv", "csv"],
    ["application/zip", "zip"],
  ])("maps %s → %s", (mime, expected) => {
    expect(extForMime(mime)).toBe(expected);
  });

  it("preserves image/video/audio extension mapping", () => {
    expect(extForMime("image/png")).toBe("png");
    expect(extForMime("video/mp4")).toBe("mp4");
    expect(extForMime("audio/mpeg")).toBe("mp3");
  });

  it("falls back to bin for unknown MIMEs", () => {
    expect(extForMime("application/x-unknown-weird")).toBe("bin");
  });
});

// ─── uploadEncryptedAttachment ─────────────────────────────────────────

describe("uploadEncryptedAttachment · document path", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Factory per-call · Response.body is one-shot so multiple
    // awaits on the SAME Response throw "Body has already been read".
    global.fetch = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            storage_url: "https://example.supabase.co/storage/v1/sign/foo.bin",
            storage_path: "enc/sender/123-abc.pdf",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("uploads a PDF as ciphertext and returns kind='document' + encrypted filename fields", async () => {
    const file = mkFile("employment-contract.pdf", "application/pdf", 2048);
    const result = await uploadEncryptedAttachment({ file });
    expect(result.kind).toBe("document");
    expect(result.contentType).toBe("application/pdf");
    expect(result.sizeBytes).toBe(2048);
    expect(result.contentKey).toBeInstanceOf(Uint8Array);
    expect(result.contentNonce).toBeInstanceOf(Uint8Array);
    // Phase 3 · document-specific fields must be present.
    expect(result.encryptedFilename).toBeInstanceOf(Uint8Array);
    expect(result.filenameNonce).toBeInstanceOf(Uint8Array);
    expect(result.encryptedFilename!.byteLength).toBeGreaterThan(0);
    expect(result.filenameNonce!.byteLength).toBe(nacl.secretbox.nonceLength);
  });

  it("decrypts the filename roundtrip with the same content key", async () => {
    const file = mkFile("payslip-november.pdf", "application/pdf", 512);
    const result = await uploadEncryptedAttachment({ file });
    const decoded = decryptSmallBytes(
      naclUtil.encodeBase64(result.encryptedFilename!),
      naclUtil.encodeBase64(result.filenameNonce!),
      result.contentKey,
    );
    expect(decoded).not.toBeNull();
    const filename = new TextDecoder("utf-8").decode(decoded!);
    expect(filename).toBe("payslip-november.pdf");
  });

  it("image/video/audio paths DO NOT include filename encryption (no regression)", async () => {
    const png = mkFile("photo.png", "image/png", 2048);
    const r1 = await uploadEncryptedAttachment({ file: png });
    expect(r1.kind).toBe("image");
    expect(r1.encryptedFilename).toBeUndefined();
    expect(r1.filenameNonce).toBeUndefined();

    const mp4 = mkFile("clip.mp4", "video/mp4", 2048);
    const r2 = await uploadEncryptedAttachment({ file: mp4 });
    expect(r2.kind).toBe("video");
    expect(r2.encryptedFilename).toBeUndefined();

    const ogg = mkFile("voice.ogg", "audio/ogg", 2048);
    const r3 = await uploadEncryptedAttachment({ file: ogg });
    expect(r3.kind).toBe("audio");
    expect(r3.encryptedFilename).toBeUndefined();
  });

  it("rejects truly unsupported MIMEs before touching bytes (no plaintext upload)", async () => {
    const file = mkFile("shell.sh", "application/x-sh");
    await expect(uploadEncryptedAttachment({ file })).rejects.toThrow(
      /unsupported attachment MIME/,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("surfaces the server's 503 as a thrown error with status code (no silent fallback)", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response("private bucket unavailable", { status: 503 }));
    const file = mkFile("report.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    await expect(uploadEncryptedAttachment({ file })).rejects.toThrow(
      /encrypted upload failed: 503/,
    );
  });

  it("P1.T05 · accepts the sealed private-bucket response (storage_path, no storage_url)", async () => {
    // Sealed 2026-11-13 · the private-bucket route returns
    // storage_path only · clients used to require storage_url too and
    // this made every encrypted upload throw. Confirm the new client
    // accepts the sealed response shape and populates only
    // storagePath (no storageUrl) on the result.
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          storage_path: "enc/x/1.pdf",
          bucket: "nex-peer-chat-ciphertext",
          private: true,
          size_bytes: 1024,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const file = mkFile("report.pdf", "application/pdf");
    const result = await uploadEncryptedAttachment({ file });
    expect(result.storagePath).toBe("enc/x/1.pdf");
    expect(result.storageUrl).toBeUndefined();
    expect(result.kind).toBe("document");
  });

  it("rejects a malformed server success payload (ok=true, storage_path ALSO missing)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true /* no storage_path AND no storage_url */ }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const file = mkFile("report.pdf", "application/pdf");
    await expect(uploadEncryptedAttachment({ file })).rejects.toThrow(
      /unknown_upload_error/,
    );
  });

  it("surfaces the server's own error string when ok=false", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: false, error: "too_large" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const file = mkFile("huge.pdf", "application/pdf");
    await expect(uploadEncryptedAttachment({ file })).rejects.toThrow(/too_large/);
  });

  it("sends application/octet-stream and x-nex-enc-ext=pdf for a PDF", async () => {
    const file = mkFile("note.pdf", "application/pdf");
    await uploadEncryptedAttachment({ file });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/nex-native/attachment/encrypted");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/octet-stream");
    expect(headers["x-nex-enc-ext"]).toBe("pdf");
  });
});

// ─── Recipient-side decryption + filename recovery ─────────────────────

describe("fetchAndDecryptDocument · roundtrip", () => {
  it("decrypts the file bytes and recovers the original filename via the private bucket envelope", async () => {
    // Sender + recipient device keys.
    const sender = makeDeviceKey("sender-dev-1");
    const recipient = makeDeviceKey("recipient-dev-1");
    const senderAccountId = "sender-account";
    const recipientAccountId = "recipient-account";

    // Sender runs the upload helper.
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          storage_url: "https://example.supabase.co/signed/url",
          storage_path: "enc/sender/1-abc.pdf",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const file = mkFile("Q3-report.pdf", "application/pdf", 1024);
    const uploaded = await uploadEncryptedAttachment({ file });

    // Build the envelope as the client would at send time.
    const senderPubB64 = naclUtil.encodeBase64(sender.publicKey);
    const wrapped = wrapContentKey(
      uploaded.contentKey,
      sender,
      recipientAccountId,
      recipient.deviceId,
      naclUtil.encodeBase64(recipient.publicKey),
    );
    const envelope = buildEnvelope({
      storageUrl: uploaded.storageUrl,
      contentNonce: uploaded.contentNonce,
      senderPublicKey: senderPubB64,
      senderDeviceId: sender.deviceId,
      wrappedKeys: [wrapped],
      contentType: uploaded.contentType,
      sizeBytes: uploaded.sizeBytes,
      encryptedFilename: uploaded.encryptedFilename,
      filenameNonce: uploaded.filenameNonce,
    });

    // Capture the ciphertext the upload helper would have sent (we
    // can reconstruct deterministically from the known plaintext +
    // contentKey + contentNonce).
    const rawBytes = new Uint8Array(await file.arrayBuffer());
    const ciphertext = nacl.secretbox(
      rawBytes,
      uploaded.contentNonce,
      uploaded.contentKey,
    );

    // Recipient-side mock fetch returns that ciphertext.
    const recipientFetch = vi.fn().mockResolvedValue(
      new Response(ciphertext as unknown as BodyInit, { status: 200 }),
    );
    const got = await fetchAndDecryptDocument(
      envelope,
      recipient,
      senderAccountId,
      { fetchFn: recipientFetch as unknown as typeof fetch },
    );
    expect(got).not.toBeNull();
    expect(got!.filename).toBe("Q3-report.pdf");
    expect(got!.contentType).toBe("application/pdf");
    expect(got!.bytes.byteLength).toBe(1024);
    // Byte-exact roundtrip.
    expect(Array.from(got!.bytes).slice(0, 8)).toEqual(
      Array.from(rawBytes).slice(0, 8),
    );
  });

  it("returns null when the wrapped key is for a DIFFERENT device (wrong-device rejection)", async () => {
    const sender = makeDeviceKey("sender-dev-A");
    const intended = makeDeviceKey("intended-dev");
    const wrongDevice = makeDeviceKey("wrong-dev");

    const contentKey = nacl.randomBytes(nacl.secretbox.keyLength);
    const contentNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const bytes = new TextEncoder().encode("Hello world document body");
    const ciphertext = nacl.secretbox(bytes, contentNonce, contentKey);
    const wrapped = wrapContentKey(
      contentKey,
      sender,
      "intended-acc",
      intended.deviceId,
      naclUtil.encodeBase64(intended.publicKey),
    );

    // Also encrypt a filename.
    const fn = encryptSmallBytes(
      new TextEncoder().encode("secret.pdf"),
      contentKey,
    );
    const envelope = buildEnvelope({
      storageUrl: "https://example/signed/url",
      contentNonce,
      senderPublicKey: naclUtil.encodeBase64(sender.publicKey),
      senderDeviceId: sender.deviceId,
      wrappedKeys: [wrapped],
      contentType: "application/pdf",
      sizeBytes: bytes.byteLength,
      encryptedFilename: fn.ciphertext,
      filenameNonce: fn.nonce,
    });

    const recipientFetch = vi.fn().mockResolvedValue(
      new Response(ciphertext as unknown as BodyInit, { status: 200 }),
    );
    const got = await fetchAndDecryptDocument(
      envelope,
      wrongDevice, // wrong device key
      "sender-acc",
      { fetchFn: recipientFetch as unknown as typeof fetch },
    );
    expect(got).toBeNull();
  });

  it("returns null on corrupt ciphertext (Poly1305 tag check)", async () => {
    const sender = makeDeviceKey("sender-dev-B");
    const recipient = makeDeviceKey("recipient-dev-B");

    const contentKey = nacl.randomBytes(nacl.secretbox.keyLength);
    const contentNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const bytes = new TextEncoder().encode("plaintext document");
    const ciphertext = nacl.secretbox(bytes, contentNonce, contentKey);
    // Flip one byte.
    ciphertext[ciphertext.length - 1] ^= 0xff;

    const wrapped = wrapContentKey(
      contentKey,
      sender,
      "rec-acc",
      recipient.deviceId,
      naclUtil.encodeBase64(recipient.publicKey),
    );
    const fn = encryptSmallBytes(new TextEncoder().encode("ok.pdf"), contentKey);
    const envelope = buildEnvelope({
      storageUrl: "https://example/signed/url",
      contentNonce,
      senderPublicKey: naclUtil.encodeBase64(sender.publicKey),
      senderDeviceId: sender.deviceId,
      wrappedKeys: [wrapped],
      contentType: "application/pdf",
      sizeBytes: bytes.byteLength,
      encryptedFilename: fn.ciphertext,
      filenameNonce: fn.nonce,
    });

    const recipientFetch = vi.fn().mockResolvedValue(
      new Response(ciphertext as unknown as BodyInit, { status: 200 }),
    );
    const got = await fetchAndDecryptDocument(envelope, recipient, "sender-acc", {
      fetchFn: recipientFetch as unknown as typeof fetch,
    });
    expect(got).toBeNull();
  });

  it("rejects a malformed envelope (filename ciphertext without nonce)", async () => {
    const sender = makeDeviceKey("sender-mal");
    const recipient = makeDeviceKey("rec-mal");
    const contentKey = nacl.randomBytes(nacl.secretbox.keyLength);
    const contentNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const bytes = new TextEncoder().encode("doc");
    const ciphertext = nacl.secretbox(bytes, contentNonce, contentKey);
    const wrapped = wrapContentKey(
      contentKey,
      sender,
      "rec",
      recipient.deviceId,
      naclUtil.encodeBase64(recipient.publicKey),
    );
    const env: AttachmentEnvelope = {
      version: 1,
      storage_url: "https://example/signed/url",
      content_nonce_b64: naclUtil.encodeBase64(contentNonce),
      sender_public_key: naclUtil.encodeBase64(sender.publicKey),
      sender_device_id: sender.deviceId,
      wrapped_keys: [wrapped],
      content_type: "application/pdf",
      size_bytes: bytes.byteLength,
      encrypted_filename_b64: "AQIDBA==",
      // filename_nonce_b64 intentionally omitted → malformed
    };
    const recipientFetch = vi.fn().mockResolvedValue(
      new Response(ciphertext as unknown as BodyInit, { status: 200 }),
    );
    const got = await fetchAndDecryptDocument(env, recipient, "sender-acc", {
      fetchFn: recipientFetch as unknown as typeof fetch,
    });
    expect(got).toBeNull();
  });

  it("returns null on a non-2xx network response (upload/download failure handling)", async () => {
    const sender = makeDeviceKey("sender-net");
    const recipient = makeDeviceKey("rec-net");
    const contentKey = nacl.randomBytes(nacl.secretbox.keyLength);
    const contentNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const wrapped = wrapContentKey(
      contentKey,
      sender,
      "rec",
      recipient.deviceId,
      naclUtil.encodeBase64(recipient.publicKey),
    );
    const fn = encryptSmallBytes(new TextEncoder().encode("doc.pdf"), contentKey);
    const envelope = buildEnvelope({
      storageUrl: "https://example/missing",
      contentNonce,
      senderPublicKey: naclUtil.encodeBase64(sender.publicKey),
      senderDeviceId: sender.deviceId,
      wrappedKeys: [wrapped],
      contentType: "application/pdf",
      sizeBytes: 0,
      encryptedFilename: fn.ciphertext,
      filenameNonce: fn.nonce,
    });
    const recipientFetch = vi.fn().mockResolvedValue(
      new Response("not found", { status: 404 }),
    );
    const got = await fetchAndDecryptDocument(envelope, recipient, "sender-acc", {
      fetchFn: recipientFetch as unknown as typeof fetch,
    });
    expect(got).toBeNull();
  });

  it("returns a safe fallback filename when the envelope omits filename blob (image case)", async () => {
    const sender = makeDeviceKey("sender-img");
    const recipient = makeDeviceKey("rec-img");
    const contentKey = nacl.randomBytes(nacl.secretbox.keyLength);
    const contentNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const ciphertext = nacl.secretbox(bytes, contentNonce, contentKey);
    const wrapped = wrapContentKey(
      contentKey,
      sender,
      "rec",
      recipient.deviceId,
      naclUtil.encodeBase64(recipient.publicKey),
    );
    const envelope = buildEnvelope({
      storageUrl: "https://example/signed/img",
      contentNonce,
      senderPublicKey: naclUtil.encodeBase64(sender.publicKey),
      senderDeviceId: sender.deviceId,
      wrappedKeys: [wrapped],
      contentType: "image/png",
      sizeBytes: 5,
      // no encryptedFilename · image case
    });
    const recipientFetch = vi.fn().mockResolvedValue(
      new Response(ciphertext as unknown as BodyInit, { status: 200 }),
    );
    const got = await fetchAndDecryptDocument(envelope, recipient, "sender-acc", {
      fetchFn: recipientFetch as unknown as typeof fetch,
    });
    expect(got).not.toBeNull();
    expect(got!.filename).toBe("attachment");
  });
});

// ─── Filename sanitisation ─────────────────────────────────────────────

describe("sanitiseFilename", () => {
  it("strips directory separators", () => {
    // "../../etc/passwd" · each '/' becomes '_' · dots are kept.
    expect(sanitiseFilename("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(sanitiseFilename("sub\\dir\\file.pdf")).toBe("sub_dir_file.pdf");
  });

  it("strips control chars and null bytes", () => {
    expect(sanitiseFilename("good\x00bad.pdf")).toBe("goodbad.pdf");
    expect(sanitiseFilename("tab\x09sep.pdf")).toBe("tabsep.pdf");
  });

  it("returns 'attachment' for empty / whitespace-only input", () => {
    expect(sanitiseFilename("")).toBe("attachment");
    expect(sanitiseFilename("    ")).toBe("attachment");
  });

  it("bounds length to 256 chars", () => {
    const long = "a".repeat(400) + ".pdf";
    expect(sanitiseFilename(long).length).toBe(256);
  });

  it("preserves normal filenames unchanged", () => {
    expect(sanitiseFilename("report Q3 2026.pdf")).toBe("report Q3 2026.pdf");
    expect(sanitiseFilename("payslip-nov.pdf")).toBe("payslip-nov.pdf");
  });
});

// ─── Belt-and-braces: filename ciphertext does not leak the plaintext ──

describe("P1.T04 Phase 3 · filename privacy invariant", () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            storage_url: "https://example.supabase.co/storage/v1/sign/foo.bin",
            storage_path: "enc/sender/123-abc.pdf",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("encrypted filename ciphertext does NOT contain the plaintext name", async () => {
    const file = mkFile("confidential-salary.pdf", "application/pdf", 128);
    const result = await uploadEncryptedAttachment({ file });
    const ciphertextB64 = naclUtil.encodeBase64(result.encryptedFilename!);
    expect(ciphertextB64).not.toContain("confidential-salary");
    // Base64 of ciphertext doesn't contain "confidential" substring
    // under any reasonable encoding.
    expect(ciphertextB64.toLowerCase()).not.toContain("confidential");
  });
});
