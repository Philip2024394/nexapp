// src/lib/nex-native/merchant-qr/__tests__/qr-validation-service.test.ts
//
// P5 · QR validation tests. Uses sharp to produce real PNG inputs in
// memory and qrcode to generate real QR payloads. No fixtures on
// disk · fully reproducible.

import { describe, expect, it } from "vitest";
import sharp from "sharp";
import QRCode from "qrcode";
import { validateQrBytes, MAX_BYTES } from "../qr-validation-service";

async function makeQrPng(payload: string, sizePx = 400): Promise<Buffer> {
  // qrcode-node produces a PNG buffer at the requested width
  return await QRCode.toBuffer(payload, { type: "png", width: sizePx });
}

async function makeSolidPng(width: number, height: number): Promise<Buffer> {
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .png()
    .toBuffer();
}

describe("qr-validation-service · P5", () => {
  it("valid 400x400 PNG QR · ok", async () => {
    const png = await makeQrPng("https://pay.example/abc123", 400);
    const r = await validateQrBytes(png, "image/png");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mime).toBe("image/png");
    expect(r.widthPx).toBe(400);
    expect(r.heightPx).toBe(400);
    expect(r.sha256Hex).toHaveLength(64);
    expect(r.qrPayloadHint).toBe("https://pay.example/abc123");
  });

  it("MIME outside allow-list · mime_rejected", async () => {
    const png = await makeQrPng("x", 400);
    const r = await validateQrBytes(png, "image/gif");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("mime_rejected");
  });

  it("MIME claim vs decoded format mismatch · mime_rejected", async () => {
    const png = await makeQrPng("x", 400);
    // Lie about the MIME · claim JPEG, upload a PNG.
    const r = await validateQrBytes(png, "image/jpeg");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("mime_rejected");
    expect(r.detail).toMatch(/decoded format/);
  });

  it("empty buffer · decode_failed", async () => {
    const r = await validateQrBytes(Buffer.alloc(0), "image/png");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("decode_failed");
  });

  it("over-size upload · too_large", async () => {
    // Fake a > 2MB buffer by padding. sharp will fail to decode a
    // random 2MB blob · but the size check runs before decode.
    const tooBig = Buffer.alloc(MAX_BYTES + 1);
    const r = await validateQrBytes(tooBig, "image/png");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("too_large");
  });

  it("below minimum dimension · dimensions_rejected", async () => {
    // Build a real 150x150 PNG. Below the 200-px floor.
    const small = await sharp({
      create: { width: 150, height: 150, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const r = await validateQrBytes(small, "image/png");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("dimensions_rejected");
  });

  it("above maximum dimension · dimensions_rejected", async () => {
    const big = await sharp({
      create: { width: 2500, height: 2500, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const r = await validateQrBytes(big, "image/png");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("dimensions_rejected");
  });

  it("valid dimensions but not a QR · not_a_qr", async () => {
    const png = await makeSolidPng(500, 500);
    const r = await validateQrBytes(png, "image/png");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("not_a_qr");
  });

  it("sha256 is deterministic for identical bytes", async () => {
    const png = await makeQrPng("same-payload", 400);
    const a = await validateQrBytes(png, "image/png");
    const b = await validateQrBytes(png, "image/png");
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.sha256Hex).toBe(b.sha256Hex);
  });

  it("qrPayloadHint is clamped to 64 chars", async () => {
    const long = "A".repeat(200);
    const png = await makeQrPng(long, 600);
    const r = await validateQrBytes(png, "image/png");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.qrPayloadHint.length).toBeLessThanOrEqual(64);
  });
});
