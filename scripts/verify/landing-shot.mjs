import { chromium } from "@playwright/test";
const BASE = "http://localhost:3008";
const SHOTS = [
  { name: "root", url: "/" },
  { name: "nex-root", url: "/nex-native" },
  { name: "welcome", url: "/nex-native/welcome" },
  { name: "home", url: "/nex-native/home" },
  { name: "directory-landing", url: "/nex-native/directory/landing" },
];
(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 420, height: 909 } });
  const page = await ctx.newPage();
  for (const s of SHOTS) {
    await page.goto(`${BASE}${s.url}`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `tests/e2e-screenshots/landing-diag/${s.name}.png`, fullPage: false });
    console.log(`shot: ${s.name} ← ${page.url().replace(BASE, "")}`);
  }
  await ctx.close();
  await b.close();
})();
