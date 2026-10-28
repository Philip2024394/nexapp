import { test } from "@playwright/test";
import { devices } from "@playwright/test";

test.use({ ...devices["Pixel 7"], baseURL: "http://localhost:3008" });

test("arrowdown · instrumented", async ({ page }) => {
  const consoleMsgs: string[] = [];
  page.on("console", (msg) => consoleMsgs.push(msg.type() + ":" + msg.text()));

  await page.goto("/nex-native/videos/dev-video-1", { waitUntil: "domcontentloaded" });
  await page.locator("[data-nex-video-viewer]").waitFor({ timeout: 5000 });
  await page.waitForTimeout(1000);

  // Instrument: hook into window and see what's going on
  const diagnostics = await page.evaluate(() => {
    const results: Record<string, unknown> = {};

    // Count keydown listeners currently on window (best-effort heuristic)
    results.locationBefore = window.location.href;

    // Dispatch synthetic keydown and capture whether default was prevented
    const ev = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    const dispatched = window.dispatchEvent(ev);
    results.dispatchReturned = dispatched;
    results.defaultPrevented = ev.defaultPrevented;

    return results;
  });
  console.log("diag: " + JSON.stringify(diagnostics));

  await page.waitForTimeout(2000);
  const after = page.url();
  console.log("after=" + after);
  console.log("--- console msgs ---");
  for (const m of consoleMsgs) console.log(m);
});
