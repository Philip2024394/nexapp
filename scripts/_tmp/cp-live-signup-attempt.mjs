#!/usr/bin/env node
// scripts/_tmp/cp-live-signup-attempt.mjs
//
// Bounded verification checkpoint · LIVE SIGNUP ATTEMPT · 2026-11-17.
// -----------------------------------------------------------------
// Explicitly NOT a workaround. We drive the real /nex-native/sign-in
// surface in TWO isolated browser contexts (buyer + seller), post
// through the real createNexAccountAction, and record exactly what
// comes back. If Supabase sandbox returns email_confirmation_required,
// that is the exact observed step that blocks disposable account
// creation without mailbox access — we capture the redirect+banner
// and screenshot it rather than predicting it.
//
// Not touched: Hammerex / Rosa / 99901 / any sealed persona.
// Not touched: founder's cookies / server / storage.
// Email domain: nex-cpcheckpoint-2026-11-17.invalid (RFC 2606 reserved).

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const OUT = "evidence/product-chat-cart-checkpoint";
mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:3008";
const VIEWPORT = { width: 390, height: 844 };

function rand(n = 4) {
  return randomBytes(n).toString("hex");
}

const TAG = "cp2026-11-17";
const buyer = {
  role: "buyer",
  email: `${TAG}-buyer-${rand()}@nex-cpcheckpoint-2026-11-17.invalid`,
  password: `cp-${rand(8)}!`,
  fullName: `CP Buyer ${rand(2)}`,
};
const seller = {
  role: "seller",
  email: `${TAG}-seller-${rand()}@nex-cpcheckpoint-2026-11-17.invalid`,
  password: `cp-${rand(8)}!`,
  fullName: `CP Seller ${rand(2)}`,
};

console.log("[cp-live-signup] FIXTURE RECORD");
console.log("  buyer email:", buyer.email);
console.log("  seller email:", seller.email);

const browser = await chromium.launch({ headless: true });

async function attemptSignup(fix, labelPrefix) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") pageErrors.push(m.text());
  });

  // Step 1 · open the sign-in surface in signup mode.
  await page.goto(`${BASE}/nex-native/sign-in?mode=signup`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(OUT, `${labelPrefix}-01-signup-form.png`),
    fullPage: false,
  });

  // Step 2 · inspect the form fields that are actually present.
  const form = await page.locator("[data-nex-sign-up-form]").count();
  const nameInputCount = await page.locator("input[name='full_name']").count();
  const emailInputCount = await page.locator("input[name='email']").count();
  const passwordInputCount = await page.locator("input[name='password']").count();
  const phoneCountryCount = await page.locator("select[name='phone_country_code'], input[name='phone_country_code']").count();
  const phoneNumberCount = await page.locator("input[name='phone_national_number']").count();
  const countyCount = await page.locator("select[name='county_zone_id']").count();
  const submitBtnCount = await page.locator("[data-nex-sign-up-form] button[type='submit'], [data-nex-sign-up-form] button").count();

  console.log(`  ${fix.role} form fields present:`);
  console.log(`    signup-form:${form} name:${nameInputCount} email:${emailInputCount} password:${passwordInputCount}`);
  console.log(`    phone-cc:${phoneCountryCount} phone-num:${phoneNumberCount} county:${countyCount} submit:${submitBtnCount}`);

  if (!form) {
    console.log(`  ${fix.role} STOP · signup form not found on the surface`);
    await ctx.close();
    return { outcome: "no_form", pageErrors };
  }

  // Step 3 · fill required fields honestly.
  await page.locator("input[name='full_name']").fill(fix.fullName);
  await page.locator("input[name='email']").fill(fix.email);
  await page.locator("input[name='password']").fill(fix.password);
  await page.screenshot({
    path: path.join(OUT, `${labelPrefix}-02-signup-filled.png`),
    fullPage: false,
  });

  // Step 4 · submit. Capture the post-submit URL + any banner.
  const submitBtn = page.locator("[data-nex-sign-up-form] button[type='submit']").first();
  const submitVisible = await submitBtn.count();
  if (!submitVisible) {
    console.log(`  ${fix.role} STOP · submit button not found`);
    await ctx.close();
    return { outcome: "no_submit", pageErrors };
  }

  try {
    await Promise.all([
      page.waitForURL(() => true, { timeout: 15_000 }),
      submitBtn.click(),
    ]);
  } catch (e) {
    console.log(`  ${fix.role} submit wait caught:`, e.message);
  }
  await page.waitForTimeout(1500);
  const postUrl = page.url();
  console.log(`  ${fix.role} post-submit URL:`, postUrl);
  await page.screenshot({
    path: path.join(OUT, `${labelPrefix}-03-after-submit.png`),
    fullPage: false,
  });

  // Step 5 · read any banner the server surfaced back.
  const bannerHandle = await page.locator("[data-nex-sign-in-banner]").first();
  const bannerExists = await bannerHandle.count();
  let bannerCode = null;
  let bannerText = null;
  if (bannerExists) {
    bannerCode = await bannerHandle.getAttribute("data-nex-sign-in-banner");
    bannerText = (await bannerHandle.innerText()).replace(/\s+/g, " ").slice(0, 300);
  }
  console.log(`  ${fix.role} banner-code:`, bannerCode);
  console.log(`  ${fix.role} banner-text:`, bannerText);

  // Step 6 · check cookies for a real session (sb-* access_token).
  const cookies = await ctx.cookies();
  const sbCookies = cookies.filter((c) => c.name.startsWith("sb-"));
  const hasAuthCookie = sbCookies.some((c) => c.name.includes("auth-token"));
  console.log(`  ${fix.role} sb-* cookies:`, sbCookies.map((c) => c.name).join(","));
  console.log(`  ${fix.role} session-cookie-present:`, hasAuthCookie);

  await ctx.close();

  const outcome = hasAuthCookie
    ? "signed_in"
    : bannerCode === "email_confirmation_required"
      ? "email_confirmation_required"
      : bannerCode
        ? `error:${bannerCode}`
        : /\/contacts|\/welcome|\/free-chat/.test(postUrl)
          ? "redirected_in_app"
          : "unknown";

  return {
    outcome,
    postUrl,
    bannerCode,
    bannerText,
    hasAuthCookie,
    pageErrors,
  };
}

const results = {};
results.buyer = await attemptSignup(buyer, "live-buyer");
results.seller = await attemptSignup(seller, "live-seller");

writeFileSync(
  path.join(OUT, "live-signup-fixture-record.json"),
  JSON.stringify({ when: new Date().toISOString(), buyer, seller, results }, null, 2),
);

console.log("[cp-live-signup] FINAL");
console.log("  buyer  ·", results.buyer.outcome);
console.log("  seller ·", results.seller.outcome);

await browser.close();
