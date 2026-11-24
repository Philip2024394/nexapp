// tests/e2e/journey-chat-attachment-encrypted-document.spec.ts
//
// T-1.2 part 2 · encrypted document attachment (pdf) · authored under
// Stage A Conditional Approval 2026-11-24.
//
// Same sealed privacy guarantees as the image path:
//   · Private bucket only · 503 on fail-safe when bucket missing.
//   · No public URL in the response.
//   · Path shape enc/<account>/<ts>-<rand>.<ext>.
//
// Classification: SPEC AUTHORED.

import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/state.json" });

const ENC_UPLOAD_PATH = "/api/nex-native/attachment/encrypted";
const EXPECTED_BUCKET = "nex-peer-chat-ciphertext";

test.describe.serial("T-1.2 · encrypted document attachment", () => {
  test("POST /api/nex-native/attachment/encrypted · pdf extension accepted", async ({
    request,
  }) => {
    // 4 bytes of PDF magic + enough padding to pass any min-size check.
    const payload = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.alloc(256, 0x20),
    ]);

    const response = await request.post(ENC_UPLOAD_PATH, {
      headers: {
        "content-type": "application/octet-stream",
        "x-nex-enc-ext": "pdf",
      },
      data: payload,
      failOnStatusCode: false,
    });

    const status = response.status();
    if (status === 503) {
      const body = await response.json().catch(() => ({}));
      expect(body.error).toBe("private_bucket_unavailable");
      test.skip(
        true,
        "BLOCKED-ON-0.1 · private bucket not provisioned in this sandbox",
      );
    }

    expect(status, "pdf upload succeeds when private bucket ready").toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.bucket).toBe(EXPECTED_BUCKET);
    expect(body.private).toBe(true);
    expect(body.storage_path).toMatch(/^enc\/[0-9a-f-]+\/\d+-[0-9a-z]+\.pdf$/);
    expect(body).not.toHaveProperty("url");
    expect(body).not.toHaveProperty("public_url");
  });
});
