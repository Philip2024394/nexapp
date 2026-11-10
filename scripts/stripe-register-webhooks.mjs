// scripts/stripe-register-webhooks.mjs
//
// Register the two NEX webhook endpoints at Stripe + print the signing
// secrets. Idempotent · if an endpoint already exists at the target URL,
// reports the existing endpoint instead of creating a duplicate.
//
// Pre-reqs:
//   · STRIPE_SECRET_KEY set in .env.local
//   · NEX_APP_PUBLIC_URL set in .env.local (the public HTTPS origin
//     Stripe can reach, e.g. https://nex.app or https://your-vercel-url
//     · for dev use an ngrok/cloudflared tunnel URL)
//
// Owner MUST copy the printed signing secrets back into .env.local:
//   STRIPE_WEBHOOK_SECRET=<platform-events signing secret>
//
// (The two endpoints share one STRIPE_WEBHOOK_SECRET env var per the
// current route code. If you want separate secrets per endpoint, split
// into STRIPE_WEBHOOK_SECRET_PLATFORM and STRIPE_WEBHOOK_SECRET_CONNECT
// env vars and update the two route files to read the matching one.)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v || null;
}

const secret = env("STRIPE_SECRET_KEY");
if (!secret) { console.error("STOP · STRIPE_SECRET_KEY missing"); process.exit(1); }
const publicUrl = env("NEX_APP_PUBLIC_URL");
if (!publicUrl) {
  console.error("STOP · NEX_APP_PUBLIC_URL missing. Set to the public HTTPS origin Stripe can POST to.");
  console.error("     For dev: install ngrok/cloudflared, run `ngrok http 3008`, set NEX_APP_PUBLIC_URL=<ngrok https url>");
  console.error("     For prod: set to https://<your deployed nex domain>");
  process.exit(2);
}
if (!publicUrl.startsWith("https://") && !publicUrl.startsWith("http://localhost")) {
  console.error(`STOP · NEX_APP_PUBLIC_URL must be HTTPS (or http://localhost for dev). Got: ${publicUrl}`);
  process.exit(3);
}

const headers = {
  Authorization: `Bearer ${secret}`,
  "Stripe-Version": "2024-06-20",
};

function urlencoded(obj, prefix = "") {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) => parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`));
    } else if (typeof v === "object") {
      parts.push(urlencoded(v, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join("&");
}

async function stripeCall(method, path, body) {
  const r = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
    body: body ? urlencoded(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} · ${r.status} · ${text}`);
  return JSON.parse(text);
}

const ENDPOINTS = [
  {
    label: "NEX platform (checkout + refunds)",
    url: `${publicUrl}/api/nex-native/stripe/webhook`,
    enabled_events: [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "charge.refunded",
      "charge.dispute.created",
      "charge.dispute.updated",
    ],
  },
  {
    label: "NEX subscriptions + Connect",
    url: `${publicUrl}/api/nex-native/billing/webhook/stripe`,
    enabled_events: [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_succeeded",
      "invoice.payment_failed",
      "invoice.upcoming",
      "account.updated",
      "account.application.authorized",
      "account.application.deauthorized",
    ],
  },
];

async function findExisting(targetUrl) {
  const list = await stripeCall("GET", "/v1/webhook_endpoints?limit=100");
  return (list.data ?? []).find((w) => w.url === targetUrl);
}

for (const ep of ENDPOINTS) {
  console.log(`\n--- ${ep.label} ---`);
  console.log(`URL: ${ep.url}`);
  const existing = await findExisting(ep.url);
  let registered;
  if (existing) {
    console.log(`  (already registered as ${existing.id} · status=${existing.status})`);
    // Signing secret is only returned on CREATE · to fetch the secret for
    // an existing endpoint, owner must reveal it manually in dashboard.
    console.log(`  → To get the signing secret for this endpoint:`);
    console.log(`     Stripe dashboard → Developers → Webhooks → ${existing.id} → Signing secret → Click to reveal`);
    registered = existing;
  } else {
    registered = await stripeCall("POST", "/v1/webhook_endpoints", {
      url: ep.url,
      enabled_events: ep.enabled_events,
      description: ep.label,
    });
    console.log(`  ✓ Registered · id=${registered.id}`);
    console.log(`  ✓ SIGNING SECRET (copy into .env.local):`);
    console.log(`\n  STRIPE_WEBHOOK_SECRET=${registered.secret}\n`);
  }
  console.log(`  Enabled events (${registered.enabled_events.length}):`);
  for (const e of registered.enabled_events) console.log(`    · ${e}`);
}

console.log(`\n✓ Done.`);
console.log(`\nIf signing secret printed above, paste it into .env.local as STRIPE_WEBHOOK_SECRET.`);
console.log(`If both endpoints already existed, reveal the secret from the Stripe dashboard.`);
console.log(`Note: this script uses ONE shared signing secret for both endpoints · route code reads STRIPE_WEBHOOK_SECRET.`);
console.log(`If you want separate secrets per endpoint, split env vars + update the two route files.`);
