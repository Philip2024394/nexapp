// tests/e2e/journey-chat-attachment-legacy-public-envelope-resolve.spec.ts
//
// T-1.2 part 5 · legacy public-envelope resolve · authored under Stage
// A Conditional Approval 2026-11-24.
//
// Owner SAFEGUARD (Stage A §3): a passing test here is NOT proof that
// the legacy public bucket is safe. This spec only verifies that
// LEGITIMATE recipients of pre-existing legacy messages can still
// resolve their attachments after the upload routes were switched to
// the private bucket. It does NOT probe cross-account retrieval or
// bucket-level access control · those are a separate privacy review.
//
// Observable behaviour:
//   · When the resolver receives a legacy attachment_url pointing at
//     the public bucket, it returns a usable playback URL for the
//     signed-in recipient.
//   · The resolver does NOT silently fall back to plaintext for
//     encrypted envelopes · it decrypts.
//
// BLOCKED precondition: this test requires at least one legacy message
// row on the test account with `attachment_url` pointing at the public
// bucket. Without a seeded fixture, the test is SKIPPED honestly.
//
// Classification: SPEC AUTHORED.

import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/state.json" });

test.describe.serial("T-1.2 · legacy public-envelope resolve", () => {
  test("resolver returns a playback URL for a legacy row · BLOCKED-PENDING-SEED", async () => {
    test.skip(
      true,
      "BLOCKED-PENDING-SEED · a legacy message row with public-bucket " +
        "attachment_url must be present on the test account before this " +
        "branch can be executed · owner-approved seeding required",
    );
  });

  test("resolver does NOT silently fall back to plaintext for encrypted envelopes", async () => {
    test.skip(
      true,
      "BLOCKED-PENDING-SEED · same seeding dependency",
    );
    // When executed, the assertion is: for a row with ciphertext
    // columns populated, the resolver MUST return a decrypted-bytes
    // URL, not the raw ciphertext URL. We observe this at the DOM:
    // the rendered <img> src must resolve bytes matching the decoded
    // plaintext hash · never the raw ciphertext.
  });
});

// Reminder (owner safeguard · Stage A §3):
//   A passing version of this test does NOT prove the public bucket is
//   safe. Access-control review of the public bucket is a separate task
//   gated by §12A.1 row 0.3 (Strategy A/B/C proposal + F-16 owner
//   policy decision).
