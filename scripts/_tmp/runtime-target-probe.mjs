#!/usr/bin/env node
/**
 * Runtime target probe · read-only.
 *
 * Opens the sign-in page in a throwaway Playwright context, lets the
 * client bundle initialise, and records every unique Supabase host the
 * live :3008 process tells the browser to call. No sign-in attempt, no
 * writes, no credentials printed.
 */

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "evidence/product-chat-cart-checkpoint/addendum-6";
mkdirSync(OUT, { recursive: true });

const hosts = new Set();
const byType = { fetch: new Set(), xhr: new Set(), ws: new Set(), other: new Set() };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on("request", (req) => {
  try {
    const u = new URL(req.url());
    if (u.host.endsWith(".supabase.co") || u.host.endsWith(".supabase.in")) {
      hosts.add(u.host);
      const t = req.resourceType();
      if (t === "fetch") byType.fetch.add(u.host);
      else if (t === "xhr") byType.xhr.add(u.host);
      else if (t === "websocket") byType.ws.add(u.host);
      else byType.other.add(u.host);
    }
  } catch {}
});

// Also observe WebSocket upgrades (realtime).
page.on("websocket", (ws) => {
  try {
    const u = new URL(ws.url().replace(/^wss?:/, "https:"));
    if (u.host.endsWith(".supabase.co") || u.host.endsWith(".supabase.in")) {
      hosts.add(u.host);
      byType.ws.add(u.host);
    }
  } catch {}
});

const result = { when: new Date().toISOString(), visited: [] };

async function visit(path) {
  try {
    await page.goto(`http://localhost:3008${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    // Let realtime/auth clients spin up briefly.
    await page.waitForTimeout(2500);
    result.visited.push({ path, url: page.url(), status: "ok" });
  } catch (e) {
    result.visited.push({ path, error: String(e.message || e).slice(0, 180) });
  }
}

// Low-impact surfaces that should initialise the Supabase client.
await visit("/nex-native/sign-in");
await visit("/nex-native");
// Data-rendering surfaces · product page and shop page SSR and hydrate
// with sandbox rows; storage URLs for images will be live Supabase hosts.
await visit("/nex-native/product/47bdf78e-84a9-4ca5-b33f-0676981df65b");
await visit("/nex-native/shop/e2e-ck5-seller-shop-mwhyjc0c");
await visit("/directory");

await browser.close();

result.supabase_hosts = Array.from(hosts).sort();
result.by_resource_type = Object.fromEntries(
  Object.entries(byType).map(([k, v]) => [k, Array.from(v).sort()]),
);
// Positive match check.
result.sandbox_ref = "kdstoyyeygcopkogqsyv";
result.prod_ref = "ijvqdvsvwtwxzcqmoqit";
result.positive_sandbox_match = result.supabase_hosts.some((h) =>
  h.startsWith("kdstoyyeygcopkogqsyv."),
);
result.any_prod_contact = result.supabase_hosts.some((h) =>
  h.startsWith("ijvqdvsvwtwxzcqmoqit."),
);

writeFileSync(`${OUT}/runtime-target-probe.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
