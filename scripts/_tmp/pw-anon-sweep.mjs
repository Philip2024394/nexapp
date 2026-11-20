// scripts/_tmp/pw-anon-sweep.mjs — browser-tier anonymous-flow sweep.
//
// Drives a headless chromium against the running :3008 dev server with
// NO sign-in and NO dev-impersonation env set on the server. Records
// per-route: final URL after redirects, HTTP status, page title, and
// presence of key markers. Writes a JSON evidence file.
//
// Non-destructive · no POSTs · no storage writes · no DB mutations.
// All target routes are intended for anonymous visitors OR expected to
// redirect anonymous visitors to /sign-in · both outcomes are evidence.

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = "http://localhost:3008";
const routes = [
  { path: "/", label: "root-splash" },
  { path: "/nex-native", label: "nex-splash" },
  { path: "/nex-native/sign-in", label: "sign-in" },
  { path: "/nex-native/sign-in?mode=signup", label: "sign-up" },
  { path: "/nex-native/free-chat", label: "free-chat" },
  { path: "/nex-native/free-chat?show-themes=1", label: "free-chat-themes" },
  { path: "/nex-native/directory", label: "directory" },
  { path: "/nex-native/chat", label: "chat-locked" },
  { path: "/nex-native/contacts", label: "contacts-locked" },
  { path: "/nex-native/vault/home", label: "vault-locked" },
  { path: "/nex-native/manage", label: "manage-locked" },
  { path: "/nex-native/chat-themes-library", label: "themes-library" },
];

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({
  viewport: { width: 400, height: 844 },
  userAgent:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.6099.230",
});
const page = await ctx.newPage();

const results = [];
for (const r of routes) {
  const row = { label: r.label, requested: r.path };
  try {
    const resp = await page.goto(BASE + r.path, {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });
    row.status = resp?.status?.() ?? null;
    row.final_url = page.url();
    row.title = await page.title();
    // Allow any client-side route to settle a moment, THEN re-read URL.
    await page.waitForTimeout(600);
    row.settled_url = page.url();
    row.has_main = (await page.locator("main").count()) > 0;
    row.has_sign_in_marker = /sign-in/.test(page.url());
    row.body_len = (await page.content()).length;
  } catch (e) {
    row.error = String((e && e.message) || e);
  }
  results.push(row);
}

await b.close();

mkdirSync("scripts/_tmp/evidence", { recursive: true });
const out = {
  when: new Date().toISOString(),
  server: BASE,
  node: process.version,
  routes: results,
};
writeFileSync(
  "scripts/_tmp/evidence/anon-sweep-" +
    new Date().toISOString().replace(/[:.]/g, "-") +
    ".json",
  JSON.stringify(out, null, 2),
);
for (const r of results) {
  console.log(
    `${r.label.padEnd(20)} ${String(r.status ?? "?").padEnd(4)} ` +
      `requested=${r.requested}`.padEnd(42) +
      ` final=${r.final_url ?? r.error ?? "?"}`,
  );
}
console.log("\nOK · evidence written to scripts/_tmp/evidence/");
