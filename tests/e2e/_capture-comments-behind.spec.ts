import { test, expect } from "@playwright/test";
test.use({ viewport: { width: 1280, height: 820 } });

test("CAPTURE · panel paints above comments overlay in root stacking", async ({
  page,
}) => {
  const dir = "tests/e2e-screenshots/comments-behind";

  await page.goto("/nex-native/dev/live-viewer", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(600);

  // Push a comment onto the overlay via the composer send so there's
  // something in the chat feed to test against.
  await page.evaluate(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "[data-nex-live-footer-text-input]",
    );
    if (!textarea) return;
    // The composer uses NexTextarea · simulate a value change via
    // React doesn't fire from direct DOM mutation. Instead, dispatch
    // an InputEvent after setting the native value.
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(textarea, "test comment");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(100);

  // Open panel.
  await page.locator("[data-nex-live-footer-more]").click();
  await page.waitForTimeout(260);

  const stacking = await page.evaluate(() => {
    const footer = document.querySelector<HTMLElement>(
      "[data-nex-live-viewer-footer]",
    );
    const panel = document.querySelector<HTMLElement>(
      "[data-nex-live-footer-extra-actions]",
    );
    const overlay = document.querySelector<HTMLElement>(
      "[data-nex-video-comments-overlay]",
    );
    const cs = (el: HTMLElement | null) =>
      el ? Number(getComputedStyle(el).zIndex) : null;
    return {
      footerZ: cs(footer),
      panelZ: cs(panel),
      overlayZ: cs(overlay),
      overlayExists: overlay !== null,
    };
  });
  console.log(JSON.stringify(stacking));

  // Footer root must strictly beat the overlay's zIndex in the root
  // stacking context (so panel + composer + action row all sit above).
  expect(stacking.footerZ).toBeGreaterThan(stacking.overlayZ ?? -1);
  // Panel's local zIndex (scoped inside the footer stacking context)
  // is unchanged · still above all other footer siblings.
  expect(stacking.panelZ).toBeGreaterThan(0);

  await page.screenshot({
    path: `${dir}/01-panel-above-comments.png`,
    fullPage: false,
  });
});
