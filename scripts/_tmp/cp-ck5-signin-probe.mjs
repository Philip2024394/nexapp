#!/usr/bin/env node
// Attempt supported normal sign-in with pre-existing authorized CK5
// disposable identities (seller A + buyer B). These are NOT Hammerex,
// Rosa, 99901 or linked accounts (hard-guarded). No signup, no admin
// API, no new provisioning. Just the standard /nex-native/sign-in form.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";

const OUT = "evidence/product-chat-cart-checkpoint";
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3008";

// Read CK5 fixture env.
const ck5Raw = readFileSync(".env.playwright.vault-ck5", "utf8");
function g(name) {
  const m = ck5Raw.match(new RegExp(`^${name}=['"]?([^'"\\n]*)['"]?$`, "m"));
  return m ? m[1].trim() : null;
}

const SELLER = {
  role: "seller",
  email: g("PLAYWRIGHT_CK5_A_EMAIL"),
  pw: g("PLAYWRIGHT_CK5_A_PASSWORD"),
  handle: g("PLAYWRIGHT_CK5_A_HANDLE"),
  accountId: g("PLAYWRIGHT_CK5_A_ACCOUNT_ID"),
  businessId: g("PLAYWRIGHT_CK5_A_BUSINESS_ID"),
  businessSlug: g("PLAYWRIGHT_CK5_A_BUSINESS_SLUG"),
};
const BUYER = {
  role: "buyer",
  email: g("PLAYWRIGHT_CK5_B_EMAIL"),
  pw: g("PLAYWRIGHT_CK5_B_PASSWORD"),
  handle: g("PLAYWRIGHT_CK5_B_HANDLE"),
  accountId: g("PLAYWRIGHT_CK5_B_ACCOUNT_ID"),
};

// Hard guard: never run against Hammerex/Rosa/99901 even if env is wrong.
const PROTECTED = /hammerex|rosa|99901|99903/i;
if (!SELLER.email || !BUYER.email) throw new Error("missing CK5 env");
if (PROTECTED.test(SELLER.email) || PROTECTED.test(BUYER.email)) {
  throw new Error("REFUSE · protected identity");
}
if (!SELLER.email.startsWith("e2e-vault-ck5-") || !BUYER.email.startsWith("e2e-vault-ck5-")) {
  throw new Error("REFUSE · unexpected email prefix");
}

const browser = await chromium.launch({ headless: true });
const results = [];

for (const who of [SELLER, BUYER]) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const consoleErr = [];
  page.on("pageerror", (e) => consoleErr.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") consoleErr.push(m.text().slice(0, 200)); });

  const label = who.role;
  console.log(`\n[${label}] email: ${who.email}`);

  await page.goto(`${BASE}/nex-native/sign-in`, {
    waitUntil: "networkidle",
    timeout: 30_000,
  });
  await page.waitForTimeout(1500);

  const formC = await page.locator("[data-nex-sign-in-form]").count();
  if (!formC) {
    console.log(`  [${label}] NO SIGN-IN FORM`);
    results.push({ label, email: who.email, error: "no form on /sign-in" });
    await ctx.close();
    continue;
  }

  await page.locator("input[name='email']").fill(who.email);
  await page.locator("input[name='password']").fill(who.pw);
  await page.screenshot({ path: path.join(OUT, `ck5-${label}-01-filled.png`) });

  const navP = page.waitForNavigation({ timeout: 20_000 }).catch(() => null);
  await page.locator("[data-nex-sign-in-submit]").click();
  await navP;
  await page.waitForTimeout(1500);

  const postUrl = page.url();
  const bannerC = await page.locator("[data-nex-sign-in-banner]").count();
  let bannerCode = null, bannerText = null;
  if (bannerC) {
    const h = page.locator("[data-nex-sign-in-banner]").first();
    bannerCode = await h.getAttribute("data-nex-sign-in-banner");
    bannerText = (await h.innerText()).replace(/\s+/g, " ").slice(0, 300);
  }
  const cookies = await ctx.cookies();
  const sb = cookies.filter((c) => c.name.startsWith("sb-"));
  const sandboxCookies = sb.filter((c) => c.name.includes("kdstoyyeygcopkogqsyv"));
  const hasAuth = sb.some((c) => /auth-token(\.0)?$/.test(c.name));

  console.log(`  [${label}] postURL: ${postUrl}`);
  console.log(`  [${label}] banner: ${bannerCode} | ${(bannerText || "").slice(0, 150)}`);
  console.log(`  [${label}] sb cookies: ${sb.map(c => c.name).join(",")}`);
  console.log(`  [${label}] sandbox-ref cookies: ${sandboxCookies.length}`);
  console.log(`  [${label}] has auth-token cookie: ${hasAuth}`);

  await page.screenshot({ path: path.join(OUT, `ck5-${label}-02-post.png`) });

  results.push({
    label,
    email: who.email,
    handle: who.handle,
    businessSlug: who.businessSlug || null,
    postUrl,
    bannerCode,
    bannerText,
    sbCookies: sb.map((c) => c.name),
    sandboxRefCookieCount: sandboxCookies.length,
    hasAuthToken: hasAuth,
    consoleErr,
  });

  // Save storage state for reuse if session worked.
  if (hasAuth) {
    const statePath = path.join(OUT, `ck5-${label}-storage-state.json`);
    await ctx.storageState({ path: statePath });
    console.log(`  [${label}] storage state saved → ${statePath}`);
  }

  await ctx.close();
}

writeFileSync(path.join(OUT, "ck5-signin-probe.json"), JSON.stringify({ when: new Date().toISOString(), results }, null, 2));

await browser.close();
console.log("\n[done]");
