// probe: validate STRIPE_SECRET_KEY + NEX package prices exist
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v || null;
}

const secret = env("STRIPE_SECRET_KEY");
if (!secret) { console.error("STOP · STRIPE_SECRET_KEY not set"); process.exit(1); }
const mode = secret.startsWith("sk_live_") ? "LIVE" : secret.startsWith("sk_test_") ? "TEST" : "UNKNOWN";
console.log(`STRIPE_SECRET_KEY mode: ${mode}`);

const headers = {
  Authorization: `Bearer ${secret}`,
  "Stripe-Version": "2024-06-20",
};

// Account info
const acctResp = await fetch("https://api.stripe.com/v1/account", { headers });
if (!acctResp.ok) {
  console.error(`✗ /v1/account failed · ${acctResp.status} · ${await acctResp.text()}`);
  process.exit(2);
}
const acct = await acctResp.json();
console.log(`✓ Account id: ${acct.id} · country=${acct.country} · email=${acct.email ?? "n/a"} · charges_enabled=${acct.charges_enabled} · payouts_enabled=${acct.payouts_enabled} · details_submitted=${acct.details_submitted}`);

// Platform (NEX) info
if (acct.settings?.dashboard?.display_name) {
  console.log(`  display name: ${acct.settings.dashboard.display_name}`);
}

// NEX package product + prices
const product = env("NEX_STRIPE_PRODUCT_SHOP");
if (product) {
  const pr = await fetch(`https://api.stripe.com/v1/products/${product}`, { headers });
  if (pr.ok) {
    const p = await pr.json();
    console.log(`\n✓ NEX Shop product · ${p.id} · ${p.name} · active=${p.active}`);
  } else {
    console.log(`\n✗ NEX Shop product ${product} NOT found · ${pr.status}`);
  }
}
for (const code of ["EUR", "GBP", "USD", "IDR"]) {
  const pid = env(`NEX_STRIPE_PRICE_SHOP_${code}_MONTHLY`);
  if (!pid) { console.log(`✗ NEX_STRIPE_PRICE_SHOP_${code}_MONTHLY not set`); continue; }
  const r = await fetch(`https://api.stripe.com/v1/prices/${pid}`, { headers });
  if (r.ok) {
    const p = await r.json();
    console.log(`  ${code}: ${pid} · ${p.unit_amount} ${p.currency.toUpperCase()} · ${p.recurring?.interval ?? "one-time"} · active=${p.active}`);
  } else {
    console.log(`  ${code}: ${pid} · ✗ NOT FOUND (${r.status})`);
  }
}

// Stripe Connect capability
console.log(`\n--- Stripe Connect readiness ---`);
const connectCapResp = await fetch("https://api.stripe.com/v1/accounts?limit=1", { headers });
if (connectCapResp.ok) {
  const list = await connectCapResp.json();
  console.log(`✓ /v1/accounts LIST works · Connect is enabled on this account · existing connected accounts: ${list.data?.length ?? 0}`);
} else if (connectCapResp.status === 400 || connectCapResp.status === 403) {
  const body = await connectCapResp.text();
  if (/not activated|cannot access|connect.*disabled/i.test(body)) {
    console.log(`✗ Connect NOT activated on this platform · enable at https://dashboard.stripe.com/settings/connect`);
  } else {
    console.log(`✗ Connect check inconclusive · ${connectCapResp.status} · ${body.slice(0, 200)}`);
  }
} else {
  console.log(`? /v1/accounts returned ${connectCapResp.status} · ${(await connectCapResp.text()).slice(0, 200)}`);
}

// Webhook endpoints
console.log(`\n--- Webhook endpoints registered on this Stripe account ---`);
const whResp = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=10", { headers });
if (whResp.ok) {
  const whs = await whResp.json();
  if ((whs.data?.length ?? 0) === 0) {
    console.log(`  (no webhook endpoints registered yet)`);
  }
  for (const w of whs.data ?? []) {
    console.log(`  - ${w.url} · ${w.enabled_events?.length ?? 0} events · status=${w.status}`);
  }
} else {
  console.log(`? webhook list failed · ${whResp.status}`);
}

// Env var completeness
console.log(`\n--- Env var completeness ---`);
const wantedEnv = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "NEX_APP_PUBLIC_URL"];
for (const name of wantedEnv) {
  const val = env(name);
  console.log(`  ${name}: ${val ? "SET" : "EMPTY"}`);
}
