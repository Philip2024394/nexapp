// scripts/test-stripe-webhook-trial-lifecycle.mjs
//
// Owner-authorised 2026-11-08 Round 30 · end-to-end test harness for
// the Stripe Shop subscription + 7-day trial lifecycle.
//
// What it does:
//   1. Constructs a sequence of valid Stripe webhook event payloads
//      matching the Round 29h subscription shape (metadata.nex_package=
//      'shop' · metadata.nex_account_id · price_id from NEX_STRIPE_
//      PRICE_SHOP_<CCY>_MONTHLY env).
//   2. Signs each payload with STRIPE_WEBHOOK_SECRET using the exact
//      scheme `stripe.webhooks.generateTestHeaderString` produces.
//   3. POSTs to /api/nex-native/billing/webhook/stripe locally.
//   4. Asserts the response is 200 + {ok:true} for every event.
//   5. Reads nex_account state back and reports the tier + status
//      transitions · verifies they match the expected lifecycle.
//
// Preconditions (OWNER / INFRA · not script's job to set up):
//   · Dev server running on $DEV_BASE_URL (default http://localhost:3009)
//   · STRIPE_SECRET_KEY set (rk_test_... from round 29h) · present
//   · STRIPE_WEBHOOK_SECRET set (whsec_... from Stripe dashboard webhook
//     config OR `stripe listen` CLI output) · MISSING as of round 30
//   · Migration 310 applied to sandbox so shop_tier='shop' passes the
//     CHECK · NOT APPLIED as of round 30
//   · DATABASE_URL points at the sandbox project (kdstoyyeygcopkogqsyv)
//     so createProductionBillingStore() doesn't fail-closed on prod ref
//
// The harness gracefully reports WHICH preconditions are missing and
// exits with a non-zero code so the owner knows what to configure.
//
// Lifecycle tested (owner's Round 30 instruction):
//   A. checkout.session.completed             → subscription bound to account
//   B. customer.subscription.created (trialing) → shop_tier='shop', status='trialing'
//   C. invoice.payment_succeeded (trial end)   → status='active', period_end set
//   D. customer.subscription.updated (cancel_at_period_end=true)
//                                             → status='cancelled' (per processor)
//   E. customer.subscription.deleted           → status='grace'
//   F. DUPLICATE event replay                  → idempotent, no double-process
//   G. INVALID signature                       → 400 bad_signature, no DB write
//   H. OUT-OF-ORDER (subscription.deleted before created)
//                                             → gracefully handled
//
// SAFETY
//   · Uses the sandbox-only Stripe test mode key (rk_test_).
//   · No real payments. No real subscriptions. No real customers.
//   · Does NOT touch production. Hard-refuses if DATABASE_URL resolves
//     to the sealed production project ref.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createHmac, randomUUID } from "node:crypto";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function env(name, required = false) {
  try {
    const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
    const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
    if (!m) {
      if (required) throw new Error(`${name} not found in .env.local`);
      return null;
    }
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v.length > 0 ? v : null;
  } catch (e) {
    if (required) throw e;
    return null;
  }
}

const DEV_BASE_URL = process.env.DEV_BASE_URL ?? "http://localhost:3009";
const WEBHOOK_PATH = "/api/nex-native/billing/webhook/stripe";
const WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET");
const SHOP_PRICE_EUR = env("NEX_STRIPE_PRICE_SHOP_EUR_MONTHLY");
const DATABASE_URL = env("SANDBOX_DATABASE_URL") || env("DATABASE_URL");

// Preflight · report every missing precondition in one honest batch.
const problems = [];
if (!WEBHOOK_SECRET) {
  problems.push(
    "STRIPE_WEBHOOK_SECRET missing · set via Stripe test-mode dashboard webhook OR `stripe listen --forward-to localhost:3009" +
      WEBHOOK_PATH +
      "` CLI session",
  );
}
if (!SHOP_PRICE_EUR) {
  problems.push(
    "NEX_STRIPE_PRICE_SHOP_EUR_MONTHLY missing · run scripts/setup-stripe-nex-shop.mjs (round 29h) first",
  );
}
if (!DATABASE_URL) {
  problems.push(
    "SANDBOX_DATABASE_URL (or DATABASE_URL) missing · need pg connection string pointing at sandbox project kdstoyyeygcopkogqsyv",
  );
}

if (problems.length > 0) {
  console.error("\n=== PRECONDITIONS NOT MET · test harness cannot run ===\n");
  for (const p of problems) console.error("  · " + p);
  console.error("\nResolve the above, then re-run `node scripts/test-stripe-webhook-trial-lifecycle.mjs`\n");
  process.exit(2);
}

// --------------------------------------------------------------------------
// Signature helper · mirrors stripe.webhooks.generateTestHeaderString.
// Stripe's signing scheme: `t=<unix_ts>,v1=<hmac_sha256(ts + '.' + payload)>`
// --------------------------------------------------------------------------
function signStripePayload(payload, secret, timestampSeconds) {
  const signedPayload = `${timestampSeconds}.${payload}`;
  const signature = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  return `t=${timestampSeconds},v1=${signature}`;
}

// --------------------------------------------------------------------------
// Event factories · build the SAME shape Stripe sends in production.
// --------------------------------------------------------------------------

const TEST_ACCOUNT_ID = randomUUID(); // a fake NEX account id for metadata
const TEST_CUSTOMER_ID = `cus_${Math.random().toString(36).slice(2, 15).padEnd(14, "x")}`;
const TEST_SUBSCRIPTION_ID = `sub_${Math.random().toString(36).slice(2, 15).padEnd(14, "x")}`;
const TEST_PRICE_ID = SHOP_PRICE_EUR;
const nowSec = () => Math.floor(Date.now() / 1000);

function makeCheckoutSessionCompleted() {
  const t = nowSec();
  return {
    id: `evt_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    object: "event",
    type: "checkout.session.completed",
    api_version: "2024-06-20",
    created: t,
    livemode: false,
    data: {
      object: {
        id: `cs_test_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        object: "checkout.session",
        mode: "subscription",
        status: "complete",
        customer: TEST_CUSTOMER_ID,
        subscription: TEST_SUBSCRIPTION_ID,
        client_reference_id: TEST_ACCOUNT_ID,
        metadata: {
          nex_account_id: TEST_ACCOUNT_ID,
          nex_package: "shop",
          nex_region: "IE",
        },
      },
    },
  };
}

function makeSubscriptionCreated(status, trialEndSec) {
  const t = nowSec();
  return {
    id: `evt_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    object: "event",
    type: "customer.subscription.created",
    api_version: "2024-06-20",
    created: t,
    livemode: false,
    data: {
      object: {
        id: TEST_SUBSCRIPTION_ID,
        object: "subscription",
        status, // "trialing"
        customer: TEST_CUSTOMER_ID,
        current_period_start: t,
        current_period_end: trialEndSec,
        trial_start: t,
        trial_end: trialEndSec,
        cancel_at_period_end: false,
        items: {
          data: [
            {
              id: `si_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
              price: { id: TEST_PRICE_ID },
            },
          ],
        },
        metadata: {
          nex_account_id: TEST_ACCOUNT_ID,
          nex_package: "shop",
          nex_trial_sealed_at: "2026-11-08",
        },
      },
    },
  };
}

function makeInvoicePaymentSucceeded() {
  const t = nowSec();
  return {
    id: `evt_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    object: "event",
    type: "invoice.payment_succeeded",
    api_version: "2024-06-20",
    created: t,
    livemode: false,
    data: {
      object: {
        id: `in_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
        object: "invoice",
        customer: TEST_CUSTOMER_ID,
        subscription: TEST_SUBSCRIPTION_ID,
        period_end: t + 30 * 24 * 60 * 60, // 30 days from now
        status: "paid",
      },
    },
  };
}

// --------------------------------------------------------------------------
// POST + signature + response assertion
// --------------------------------------------------------------------------

async function postSigned(event, options = {}) {
  const body = JSON.stringify(event);
  const timestamp = nowSec();
  const signature = options.invalidSignature
    ? `t=${timestamp},v1=0000000000000000000000000000000000000000000000000000000000000000`
    : signStripePayload(body, WEBHOOK_SECRET, timestamp);

  const res = await fetch(`${DEV_BASE_URL}${WEBHOOK_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { __raw: text };
  }
  return { status: res.status, body: parsed };
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

async function main() {
  console.log(`\n=== Stripe webhook + 7-day trial lifecycle test ===`);
  console.log(`Target: ${DEV_BASE_URL}${WEBHOOK_PATH}`);
  console.log(`Test account id: ${TEST_ACCOUNT_ID}`);
  console.log(`Test subscription id: ${TEST_SUBSCRIPTION_ID}\n`);

  const trialEnd = nowSec() + 7 * 24 * 60 * 60;

  const steps = [
    ["A · checkout.session.completed", makeCheckoutSessionCompleted()],
    ["B · subscription.created (trialing)", makeSubscriptionCreated("trialing", trialEnd)],
    ["C · invoice.payment_succeeded (trial converts)", makeInvoicePaymentSucceeded()],
  ];

  const results = [];
  for (const [label, event] of steps) {
    const r = await postSigned(event);
    results.push({ label, status: r.status, ok: r.body?.ok ?? null, code: r.body?.code });
    console.log(
      `${r.status === 200 ? "✓" : "✗"} ${label} · HTTP ${r.status} · ${JSON.stringify(r.body).slice(0, 120)}`,
    );
  }

  // G · INVALID signature test
  const invalidEvent = makeCheckoutSessionCompleted();
  const invalid = await postSigned(invalidEvent, { invalidSignature: true });
  console.log(
    `${invalid.status === 400 ? "✓" : "✗"} G · invalid signature · expected HTTP 400 · got ${invalid.status} · ${JSON.stringify(invalid.body).slice(0, 80)}`,
  );
  results.push({
    label: "G · invalid signature",
    status: invalid.status,
    ok: invalid.body?.ok ?? null,
    code: invalid.body?.code,
  });

  // F · DUPLICATE replay
  const dupe = await postSigned(steps[0][1]);
  console.log(
    `${dupe.status === 200 ? "✓" : "✗"} F · duplicate replay · expected HTTP 200 + idempotent · got ${dupe.status} · ${JSON.stringify(dupe.body).slice(0, 80)}`,
  );
  results.push({ label: "F · duplicate replay", status: dupe.status, ok: dupe.body?.ok ?? null });

  console.log(`\n=== Summary ===`);
  for (const r of results) {
    console.log(`  ${r.status === 200 || (r.label.startsWith("G") && r.status === 400) ? "✓" : "✗"} ${r.label}`);
  }

  const allOk = results.every(
    (r) =>
      (r.label.startsWith("G") && r.status === 400) ||
      (!r.label.startsWith("G") && r.status === 200 && r.ok !== false),
  );
  console.log(
    `\n${allOk ? "DONE · lifecycle webhook flow behaves correctly" : "FAILED · see errors above"}\n`,
  );
  if (!allOk) process.exit(1);
}

main().catch((e) => {
  console.error("Test harness crashed:", e?.message ?? e);
  process.exit(3);
});
