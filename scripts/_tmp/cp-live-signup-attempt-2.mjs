#!/usr/bin/env node
// scripts/_tmp/cp-live-signup-attempt-2.mjs
// Retry signup with network capture + proper hydration wait.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const OUT = "evidence/product-chat-cart-checkpoint";
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3008";

function rand(n = 4) { return randomBytes(n).toString("hex"); }
const TAG = "cp2026-11-17-v2";
const buyer = {
  role: "buyer",
  email: `${TAG}-buyer-${rand()}@nex-cpcheckpoint.invalid`,
  password: `cp-${rand(8)}-X!`,
  fullName: `CP Buyer V2 ${rand(2)}`,
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

const netEvents = [];
page.on("request", (req) => {
  if (req.method() !== "GET") netEvents.push({ type: "req", method: req.method(), url: req.url() });
});
page.on("response", async (res) => {
  const url = res.url();
  if (res.request().method() !== "GET") {
    netEvents.push({ type: "res", status: res.status(), url });
  } else if (/sign-in/.test(url)) {
    netEvents.push({ type: "res", status: res.status(), url });
  }
});
const consoleErr = [];
page.on("console", (m) => { if (m.type() === "error") consoleErr.push(m.text()); });
page.on("pageerror", (e) => consoleErr.push(String(e)));

console.log("[v2] goto signup");
await page.goto(`${BASE}/nex-native/sign-in?mode=signup`, {
  waitUntil: "networkidle",
  timeout: 30_000,
});
await page.waitForTimeout(2000);
console.log("[v2] form:", await page.locator("[data-nex-sign-up-form]").count());

// Check hydration — React hydration marker
const hydrated = await page.evaluate(() => {
  const btn = document.querySelector("[data-nex-sign-up-submit]");
  return { hasBtn: !!btn, btnText: btn?.textContent?.slice(0, 40) };
});
console.log("[v2] hydration:", JSON.stringify(hydrated));

console.log("[v2] filling");
await page.locator("input[name='full_name']").fill(buyer.fullName);
await page.locator("input[name='email']").fill(buyer.email);
await page.locator("input[name='password']").fill(buyer.password);
await page.waitForTimeout(400);

console.log("[v2] submitting + waiting for navigation");
const navP = page.waitForNavigation({ timeout: 20_000 }).catch((e) => ({ err: e.message }));
await page.locator("[data-nex-sign-up-submit]").click();
const navRes = await navP;
console.log("[v2] nav result:", navRes && navRes.err ? `ERR: ${navRes.err}` : "navigated");
await page.waitForTimeout(2000);
const postUrl = page.url();
console.log("[v2] post URL:", postUrl);
await page.screenshot({ path: path.join(OUT, "live-buyer-v2-after-submit.png") });

// Dump banner + cookies
const bannerC = await page.locator("[data-nex-sign-in-banner]").count();
let bannerCode = null, bannerText = null;
if (bannerC) {
  const h = page.locator("[data-nex-sign-in-banner]").first();
  bannerCode = await h.getAttribute("data-nex-sign-in-banner");
  bannerText = (await h.innerText()).replace(/\s+/g, " ").slice(0, 400);
}
const cookies = await ctx.cookies();
const sb = cookies.filter((c) => c.name.startsWith("sb-"));

console.log("[v2] banner:", bannerCode, "|", bannerText);
console.log("[v2] sb cookies:", sb.map((c) => c.name).join(","));
console.log("[v2] console errors:", consoleErr.length);
consoleErr.slice(0, 5).forEach((e) => console.log("  ·", e.slice(0, 200)));
console.log("[v2] non-GET net events:");
netEvents.slice(0, 20).forEach((e) => console.log("  ·", e.type, e.method || "", e.status || "", e.url.slice(-80)));

writeFileSync(path.join(OUT, "live-signup-v2-netlog.json"), JSON.stringify({ when: new Date().toISOString(), buyer, postUrl, bannerCode, bannerText, cookies: sb.map((c) => c.name), netEvents, consoleErr }, null, 2));

await ctx.close();
await browser.close();
console.log("[v2] done");
