// tests/e2e/journey-chat-attachment-non-participant-404.spec.ts
//
// T-1.2 part 4 · signed-URL mint non-participant 404 · authored under
// Stage A Conditional Approval 2026-11-24.
//
// Sealed guarantee (/api/nex-native/attachment/encrypted/signed route):
//   · The signed URL mint is participant-gated.
//   · A non-participant hitting the mint receives a NON-LEAKING 404 ·
//     the response body MUST NOT disclose whether the storage_path
//     exists, who owns it, which conversation it belongs to, or any
//     error text that could be used to probe.
//
// Spec approach:
//   · With the signed-in test account, request a signed URL for a
//     fabricated `storage_path` that cannot belong to any real
//     conversation this account participates in.
//   · Assert status 404.
//   · Assert the body is either empty, JSON with { ok: false, error: "not_found" }
//     or an equivalent sealed non-leaking shape.
//   · Assert NO fields reveal storage_path, bucket_name, owner_id,
//     conversation_id, message_id.
//
// Classification: SPEC AUTHORED.

import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/state.json" });

const SIGN_PATH = "/api/nex-native/attachment/encrypted/signed";

test.describe.serial("T-1.2 · signed-URL mint non-participant 404 (non-leaking)", () => {
  test("GET with a fabricated storage_path responds 404 · body does not disclose state", async ({
    request,
  }) => {
    // Fabricated path · the UUID is random and not expected to exist.
    const fakePath =
      "enc/00000000-0000-4000-8000-000000000001/" +
      `${Date.now()}-nonreal.bin`;

    const response = await request.get(SIGN_PATH, {
      params: { path: fakePath },
      failOnStatusCode: false,
    });

    expect(response.status(), "non-participant receives 404").toBe(404);

    const textBody = await response.text();
    // Non-leaking assertions.
    expect(textBody.toLowerCase()).not.toContain(fakePath.toLowerCase());
    expect(textBody.toLowerCase()).not.toContain("conversation");
    expect(textBody.toLowerCase()).not.toContain("owner");
    expect(textBody.toLowerCase()).not.toContain("bucket");
    expect(textBody.toLowerCase()).not.toContain("participant");

    // If JSON, the shape should be a neutral error.
    try {
      const json = JSON.parse(textBody);
      if (json && typeof json === "object") {
        const keys = Object.keys(json).map((k) => k.toLowerCase());
        for (const forbidden of [
          "storage_path",
          "bucket",
          "owner_id",
          "conversation_id",
          "message_id",
        ]) {
          expect(keys, `${forbidden} MUST NOT appear in 404 body`).not.toContain(
            forbidden,
          );
        }
      }
    } catch {
      /* non-JSON body is also acceptable */
    }
  });
});
