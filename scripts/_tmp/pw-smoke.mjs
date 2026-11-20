// scripts/_tmp/pw-smoke.mjs — one-shot browser-capability probe.
// Launches a headless chromium against the already-running dev server
// on :3008 and reads the NEX splash. Writes NO repo files · leaves
// NO server state behind · does not touch Supabase.
import { chromium } from "playwright";

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext();
const page = await ctx.newPage();
const r = await page.goto("http://localhost:3008/nex-native", {
  waitUntil: "domcontentloaded",
  timeout: 20000,
});
console.log("status=" + (r?.status?.() ?? "null"));
console.log("url=" + page.url());
console.log("title=" + JSON.stringify(await page.title()));
const splashCount = await page.locator("img[alt='NEX · your world, one app']").count();
console.log("splash_image_count=" + splashCount);
await b.close();
console.log("OK");
