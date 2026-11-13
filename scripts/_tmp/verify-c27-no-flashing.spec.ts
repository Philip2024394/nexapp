import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3019";

test("C27 · /contacts no longer flashes (retry loop fixed)", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: BASE },
  ]);

  // Count RSC fetches to /contacts to prove no retry loop.
  const rscHits: string[] = [];
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("/nex-native/contacts") && u.includes("_rsc")) {
      rscHits.push(u);
    }
  });

  await page.goto(`${BASE}/nex-native/contacts`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });

  // Give it 7 seconds to see if the loop fires.
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${testInfo.outputDir}/c27-contacts.png`, fullPage: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${testInfo.outputDir}/c27-contacts-2.png`, fullPage: true });

  console.log(`\n=== Check 27 · RSC fetches to /contacts in 7.5s ===`);
  console.log(`  total: ${rscHits.length}`);
  for (const u of rscHits.slice(0, 10)) console.log(`  ${u}`);

  // Pre-fix: 30+ identical fetches. Post-fix: should be ≤5.
  expect(rscHits.length, "retry-loop fix must reduce fetches below 10").toBeLessThan(10);
});
