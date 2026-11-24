// tests/e2e/journey-chat-theme-first-free-apply.spec.ts
//
// T-3.1 part 2 · first-free apply writes nex_theme_ownership with
// source='first_free' · authored under Stage A Conditional Approval
// 2026-11-24.
//
// Sealed (project_nex_themes_plus_sealed_2026_11_13): the first paid
// theme applied by a user with no Themes+ subscription writes a
// `nex_theme_ownership` row of source='first_free'. This grants
// permanent entitlement to that specific theme even after Themes+
// expires.
//
// Observable behaviour:
//   · Signed-in account with NO existing nex_theme_ownership rows and
//     NO active Themes+ subscription can apply ONE paid theme without
//     a paywall.
//   · The second paid-theme apply attempt triggers the paywall / subscribe
//     prompt instead.
//
// Classification: SPEC AUTHORED.

import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/state.json" });

test.describe.serial("T-3.1 · first-free apply", () => {
  test("first paid-theme apply · completes without paywall", async () => {
    test.skip(
      true,
      "BLOCKED-PENDING-FIXTURE · verifying first-free requires a test " +
        "account in a known clean state (no ownership rows, no sub) · " +
        "seeding mutates state for subsequent runs · owner must approve " +
        "the fixture convention before this executes",
    );
  });

  test("second paid-theme apply · triggers Themes+ subscribe prompt", async () => {
    test.skip(
      true,
      "BLOCKED-PENDING-FIXTURE · same seed dependency as the first " +
        "assertion · intentionally not weakened",
    );
  });
});
