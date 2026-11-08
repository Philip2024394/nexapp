// scripts/setup-stripe-nex-shop.mjs
//
// Owner-authorised 2026-11-08 (round 29h) · Stripe product + price
// setup for the new single Shop package (sealed 2026-11-08).
//
// What it does:
//   1. Verifies STRIPE_SECRET_KEY can authenticate.
//   2. Looks up (or creates) a Product called "NEX Shop".
//   3. Looks up (or creates) monthly recurring Prices for each
//      launch currency (EUR, GBP, USD, IDR).
//   4. Prints the price IDs so they can be added to .env.local.
//
// Safe to re-run · all upsert operations are idempotent (search by
// name/currency before create).
//
// Usage:
//   node scripts/setup-stripe-nex-shop.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Stripe from "stripe";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found in .env.local`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const secretKey = env("STRIPE_SECRET_KEY");
if (!secretKey) {
  console.error("STRIPE_SECRET_KEY empty");
  process.exit(2);
}
const testMode = secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_");
console.log(`Stripe key mode: ${testMode ? "TEST" : "LIVE"}`);
if (!testMode) {
  console.error("Refusing to run setup against a LIVE key. Switch to test mode first.");
  process.exit(3);
}

const stripe = new Stripe(secretKey, {
  apiVersion: "2024-06-20",
});

// Single Shop package (sealed 2026-11-08) · per-market monthly amounts
// in Stripe minor units. Trial behaviour is set on the subscription at
// Checkout time (not on the Price), so no trial_period_days here.
const PRODUCT_NAME = "NEX Shop";
const PRODUCT_DESCRIPTION =
  "One global Shop package · 10 products · 3 videos · 1 GB storage · Vault bundled · Chat Themes included · 0% commission · 7-day free trial";

const MARKETS = [
  { currency: "eur", unitAmount: 499, label: "Europe €4.99 / month" },
  { currency: "gbp", unitAmount: 499, label: "United Kingdom £4.99 / month" },
  { currency: "usd", unitAmount: 499, label: "United States $4.99 / month" },
  // Indonesia IDR · zero-decimal currency · amount is the full number
  { currency: "idr", unitAmount: 89000, label: "Indonesia Rp 89,000 / month" },
];

async function upsertProduct() {
  const list = await stripe.products.list({ active: true, limit: 100 });
  const existing = list.data.find((p) => p.name === PRODUCT_NAME);
  if (existing) {
    console.log(`✓ Product exists · ${existing.id} · ${existing.name}`);
    if (existing.description !== PRODUCT_DESCRIPTION) {
      await stripe.products.update(existing.id, { description: PRODUCT_DESCRIPTION });
      console.log(`  · description updated`);
    }
    return existing.id;
  }
  const created = await stripe.products.create({
    name: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    tax_code: "txcd_10103001", // SaaS / software-as-a-service
  });
  console.log(`✓ Product CREATED · ${created.id} · ${created.name}`);
  return created.id;
}

async function upsertPriceForMarket(productId, market) {
  const prices = await stripe.prices.list({
    product: productId,
    currency: market.currency,
    active: true,
    limit: 25,
  });
  const existing = prices.data.find(
    (p) =>
      p.recurring?.interval === "month" &&
      p.unit_amount === market.unitAmount,
  );
  if (existing) {
    console.log(`  ${market.label.padEnd(36)} · ${existing.id} (exists)`);
    return { currency: market.currency, priceId: existing.id, created: false };
  }
  const created = await stripe.prices.create({
    product: productId,
    currency: market.currency,
    unit_amount: market.unitAmount,
    recurring: { interval: "month" },
    nickname: `NEX Shop · ${market.currency.toUpperCase()} monthly`,
  });
  console.log(`  ${market.label.padEnd(36)} · ${created.id} (CREATED)`);
  return { currency: market.currency, priceId: created.id, created: true };
}

async function main() {
  console.log("\n=== NEX Shop · Stripe setup ===\n");

  // 1 · Permission probe · list products needs `read` on products.
  try {
    await stripe.products.list({ limit: 1 });
    console.log("✓ Key can list products");
  } catch (e) {
    console.error(`✗ Key failed to list products: ${e.message}`);
    console.error(`  · Restricted keys need: Products read+write, Prices read+write, Checkout Sessions write.`);
    process.exit(4);
  }

  // 2 · Upsert product
  const productId = await upsertProduct();

  // 3 · Upsert per-market monthly prices
  console.log("\nPrices (monthly recurring):");
  const results = [];
  for (const market of MARKETS) {
    results.push(await upsertPriceForMarket(productId, market));
  }

  // 4 · Print env-var block
  console.log("\n\n--- Add these to .env.local (replace any old NEX_SHOP_* lines) ---\n");
  console.log(`# NEX Shop single package · sealed 2026-11-08 · Stripe test mode`);
  console.log(`NEX_STRIPE_PRODUCT_SHOP=${productId}`);
  for (const r of results) {
    console.log(
      `NEX_STRIPE_PRICE_SHOP_${r.currency.toUpperCase()}_MONTHLY=${r.priceId}`,
    );
  }
  console.log("\nDONE · Shop product + prices ready in Stripe test mode\n");
}

main().catch((e) => {
  console.error("Setup failed:", e?.message ?? e);
  process.exit(1);
});
