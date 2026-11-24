// tests/e2e/journey-chat-attachment-encrypted-image.spec.ts
//
// T-1.2 part 1 · encrypted image attachment · authored under Stage A
// Conditional Approval 2026-11-24.
//
// Owner safeguard (Stage A §3): a passing legacy-public-envelope test
// is NOT proof the legacy public bucket is safe. This spec exercises
// the ENCRYPTED pathway only · it does NOT verify legacy access control.
//
// Observable behaviour under test:
//   · The composer attachment CTA is reachable (file picker opens).
//   · POST /api/nex-native/attachment/encrypted accepts an image
//     body and responds with { ok: true, bucket: "nex-peer-chat-ciphertext",
//     storage_path: "enc/<account_id>/<ts>-<rand>.<ext>", private: true }.
//   · The response does NOT return a public URL.
//
// BLOCKED scenarios:
//   · Round-trip decrypt on the recipient side requires a second test
//     account with a device_key row · we author but SKIP that branch.
//
// Precondition flagged (honest):
//   · Running this spec against sandbox is BLOCKED until §12A.1 row 0.1
//     verifies private bucket provisioning + mig 295 applied.
//
// Classification: SPEC AUTHORED.

import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/state.json" });

const ENC_UPLOAD_PATH = "/api/nex-native/attachment/encrypted";
const EXPECTED_BUCKET = "nex-peer-chat-ciphertext";

test.describe.serial("T-1.2 · encrypted image attachment", () => {
  test("POST /api/nex-native/attachment/encrypted · returns private bucket path", async ({
    request,
  }) => {
    // Minimal PNG header bytes · the route stores raw bytes; it does
    // not validate PNG structure beyond MIME (and the encrypted route
    // accepts application/octet-stream exclusively per the sealed
    // upload design · the real ciphertext is produced on the client).
    const payload = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const response = await request.post(ENC_UPLOAD_PATH, {
      headers: {
        "content-type": "application/octet-stream",
        "x-nex-enc-ext": "png",
      },
      data: payload,
      failOnStatusCode: false,
    });

    // Honest branches:
    //   · 200 → private bucket available · assert body shape.
    //   · 503 → fail-safe branch (bucket missing in this sandbox) ·
    //          this is the sealed behaviour · recorded as BLOCKED-ON-0.1.
    const status = response.status();
    if (status === 503) {
      const body = await response.json().catch(() => ({}));
      expect(
        body.error,
        "503 branch reports private_bucket_unavailable (sealed fail-safe)",
      ).toBe("private_bucket_unavailable");
      test.skip(
        true,
        "BLOCKED-ON-0.1 · private bucket not provisioned in this sandbox",
      );
    }

    expect(status, "upload succeeds when private bucket is ready").toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.bucket).toBe(EXPECTED_BUCKET);
    expect(body.private).toBe(true);
    expect(body.storage_path).toMatch(/^enc\/[0-9a-f-]+\/\d+-[0-9a-z]+\.png$/);
    // CRITICAL: the response must NOT include a public URL.
    expect(body).not.toHaveProperty("url");
    expect(body).not.toHaveProperty("public_url");
  });

  test("round-trip decrypt · BLOCKED-PENDING-SECOND-TEST-ACCOUNT", async () => {
    test.skip(
      true,
      "BLOCKED-PENDING-SECOND-TEST-ACCOUNT · decrypt verification needs " +
        "a recipient device_key row",
    );
  });
});
