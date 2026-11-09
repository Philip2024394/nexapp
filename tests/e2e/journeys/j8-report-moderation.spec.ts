// tests/e2e/journeys/j8-report-moderation.spec.ts
//
// Phase E · Journey J-8 · DRAFT.
// User reports another user · HQ moderation queue picks it up.

import { test, expect } from "@playwright/test";

test.describe("J-8 · report → moderation queue", () => {
  test("user A reports user B · report appears in HQ queue", async ({ page }) => {
    // Visit a community notice we'll report (fixture required)
    const noticeId = "notice-fixture-j8";
    await page.goto(`/nex-native/community/notices/${noticeId}`, { waitUntil: "networkidle" });

    const reportButton = page.getByRole("button", { name: /report|flag/i });
    if ((await reportButton.count()) === 0) {
      test.skip(true, "notice fixture not seeded · skipping");
    }
    await reportButton.click();

    await page.getByRole("radio", { name: /spam|abusive|misleading/i }).first().check();
    await page.getByRole("button", { name: /submit report/i }).click();

    await expect(page.getByText(/report submitted|thank you/i)).toBeVisible({ timeout: 10_000 });

    // HQ queue verification requires admin session · deferred to J-8b
    // companion that uses storageState for an HQ admin.
  });
});
