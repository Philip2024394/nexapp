#!/usr/bin/env node
// Try signup with a realistic TLD (not .invalid) to isolate whether
// Supabase blocks on TLD or on email confirmation.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const OUT = "evidence/product-chat-cart-checkpoint";
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3008";

function rand(n = 4) { return randomBytes(n).toString("hex"); }

// Try several domain shapes. Record outcome for each.
const CANDIDATES = [
  // Shape A · .com fake domain
  { label: "com-fake", email: `cpbuyer-${rand()}@cpcheckpoint-nex-sandbox.com`, pw: `cp-${rand(8)}-X!`, name: "CP Com-Fake" },
  // Shape B · .test (reserved TLD per RFC 2606 like .invalid — may also fail)
  { label: "test-tld", email: `cpbuyer-${rand()}@cpcheckpoint.test`, pw: `cp-${rand(8)}-X!`, name: "CP Test-TLD" },
  // Shape C · subdomain of example.com
  { label: "example-com", email: `cpbuyer-${rand()}@nex.example.com`, pw: `cp-${rand(8)}-X!`, name: "CP Example" },
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const cand of CANDIDATES) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  console.log(`\n[${cand.label}] email:`, cand.email);
  await page.goto(`${BASE}/nex-native/sign-in?mode=signup`, {
    waitUntil: "networkidle",
    timeout: 30_000,
  });
  await page.waitForTimeout(1500);
  if (!(await page.locator("[data-nex-sign-up-form]").count())) {
    console.log("  no form");
    await ctx.close();
    continue;
  }
  await page.locator("input[name='full_name']").fill(cand.name);
  await page.locator("input[name='email']").fill(cand.email);
  await page.locator("input[name='password']").fill(cand.pw);
  const navP = page.waitForNavigation({ timeout: 20_000 }).catch(() => null);
  await page.locator("[data-nex-sign-up-submit]").click();
  await navP;
  await page.waitForTimeout(1500);
  const url = page.url();
  const bannerC = await page.locator("[data-nex-sign-in-banner]").count();
  let code = null, text = null;
  if (bannerC) {
    const h = page.locator("[data-nex-sign-in-banner]").first();
    code = await h.getAttribute("data-nex-sign-in-banner");
    text = (await h.innerText()).replace(/\s+/g, " ").slice(0, 300);
  }
  const cookies = await ctx.cookies();
  const sb = cookies.filter((c) => c.name.startsWith("sb-"));
  const hasAuth = sb.some((c) => c.name.endsWith("auth-token") || c.name.includes("auth-token.0"));
  console.log("  postURL:", url.slice(0, 120));
  console.log("  banner:", code, "|", (text || "").slice(0, 160));
  console.log("  sb cookies:", sb.map((c) => c.name).join(","));
  console.log("  has-session-cookie:", hasAuth);
  await page.screenshot({ path: path.join(OUT, `live-signup-${cand.label}.png`) });
  results.push({ label: cand.label, email: cand.email, url, bannerCode: code, bannerText: text, cookies: sb.map((c) => c.name), hasAuth });
  await ctx.close();
}

writeFileSync(path.join(OUT, "live-signup-domain-probe.json"), JSON.stringify({ when: new Date().toISOString(), results }, null, 2));
await browser.close();
console.log("\n[done]");
