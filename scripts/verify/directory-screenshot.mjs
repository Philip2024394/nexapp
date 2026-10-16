// scripts/verify/directory-screenshot.mjs
// Visual proof of the repaired mock_seed cards.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const BASE_URL = "http://localhost:3008";
const OUT = "tests/e2e-screenshots/click-audit";

(async () => {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [name, w, h] of [
      ["mobile-390", 390, 844],
      ["desktop", 1280, 900],
    ]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/nex-native/directory`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForTimeout(1_000);
      await page.screenshot({
        path: `${OUT}/${name}-directory-mock-cards.png`,
        fullPage: false,
      });
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
})();
