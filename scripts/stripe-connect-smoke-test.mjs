// scripts/stripe-connect-smoke-test.mjs
//
// Stripe Connect Express end-to-end smoke test · no webhook required.
//
// Flow:
//   1. Creates a test Connect Express account (country IE by default).
//   2. Generates an onboarding AccountLink · prints URL for owner click.
//   3. Polls /v1/accounts/<id> for `details_submitted` + `charges_enabled`
//      + `payouts_enabled` every 10s (max 10 min) so the owner can
//      complete onboarding in the browser.
//   4. Reports final state + mirrors it into a local file for review.
//   5. Cleans up test account on exit.
//
// Doctrine · this never touches production. Hard-refuses if the Stripe
// account is live mode without explicit `--live` opt-in flag.
//
// Usage:
//   node scripts/stripe-connect-smoke-test.mjs
//   node scripts/stripe-connect-smoke-test.mjs --no-cleanup  (keep test account)
//   node scripts/stripe-connect-smoke-test.mjs --poll-only <accountId>  (resume poll)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

const argv = process.argv.slice(2);
const flags = {
  live: argv.includes("--live"),
  noCleanup: argv.includes("--no-cleanup"),
  pollOnlyIdx: argv.indexOf("--poll-only"),
};
const pollOnlyId = flags.pollOnlyIdx >= 0 ? argv[flags.pollOnlyIdx + 1] : null;

const secret = env("STRIPE_SECRET_KEY");
if (!secret) { console.error("STOP · STRIPE_SECRET_KEY missing"); process.exit(1); }
const isLive = secret.startsWith("sk_live_") || secret.startsWith("rk_live_");
if (isLive && !flags.live) {
  console.error("STOP · Stripe key appears to be LIVE mode. Pass --live to acknowledge the risk of creating a real Connect account.");
  process.exit(2);
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
    if (typeof v === "object" && !Array.isArray(v)) {
      parts.push(urlencoded(v, key));
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join("&");
}

async function stripeCall(method, path, body) {
  const resp = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
    body: body ? urlencoded(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`${method} ${path} · ${resp.status} · ${text}`);
  return JSON.parse(text);
}

// Create a test Express account
async function createAccount() {
  console.log(`\n[1/3] Creating Stripe Connect Express account (country=IE, type=express)...`);
  const acct = await stripeCall("POST", "/v1/accounts", {
    type: "express",
    country: "IE",
    email: `nex-test-${Date.now()}@example.com`,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
    metadata: {
      source: "nex-smoke-test",
      created_at: new Date().toISOString(),
    },
  });
  console.log(`  ✓ Created · id=${acct.id} · country=${acct.country} · charges_enabled=${acct.charges_enabled}`);
  return acct;
}

async function createAccountLink(accountId) {
  console.log(`\n[2/3] Generating onboarding AccountLink...`);
  const publicUrl = env("NEX_APP_PUBLIC_URL") || "http://localhost:3008";
  const link = await stripeCall("POST", "/v1/account_links", {
    account: accountId,
    refresh_url: `${publicUrl}/manage/shop/payments/setup?refresh=1`,
    return_url: `${publicUrl}/manage/shop/payments/setup?return=1`,
    type: "account_onboarding",
  });
  console.log(`  ✓ AccountLink created · expires_at=${new Date(link.expires_at * 1000).toISOString()}`);
  console.log(`\n  ┌────────────────────────────────────────────────────────────────`);
  console.log(`  │ OWNER · click this link in a browser to complete test onboarding:`);
  console.log(`  │`);
  console.log(`  │   ${link.url}`);
  console.log(`  │`);
  console.log(`  └────────────────────────────────────────────────────────────────`);
  return link;
}

async function pollStatus(accountId, maxMinutes = 10) {
  console.log(`\n[3/3] Polling account status · max ${maxMinutes} min · ctrl-c to stop...\n`);
  const deadline = Date.now() + maxMinutes * 60_000;
  let lastSummary = "";
  while (Date.now() < deadline) {
    const acct = await stripeCall("GET", `/v1/accounts/${accountId}`);
    const summary = `details_submitted=${acct.details_submitted} · charges_enabled=${acct.charges_enabled} · payouts_enabled=${acct.payouts_enabled} · currently_due=${acct.requirements?.currently_due?.length ?? 0}`;
    if (summary !== lastSummary) {
      console.log(`  [${new Date().toISOString().slice(11, 19)}] ${summary}`);
      lastSummary = summary;
    }
    if (acct.details_submitted && acct.charges_enabled && acct.payouts_enabled) {
      console.log(`\n  ✓ Full onboarding complete.`);
      return acct;
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.log(`\n  ! Poll window expired · final state recorded.`);
  return await stripeCall("GET", `/v1/accounts/${accountId}`);
}

async function writeResult(acct) {
  const outDir = resolve(repoRoot, "scripts/_tmp");
  try { mkdirSync(outDir, { recursive: true }); } catch {}
  const outFile = resolve(outDir, `stripe-connect-smoke-result-${Date.now()}.json`);
  writeFileSync(outFile, JSON.stringify(acct, null, 2));
  console.log(`\n  ✓ Full account state written to ${outFile}`);
}

async function cleanup(accountId) {
  if (flags.noCleanup) {
    console.log(`\n(skipping cleanup per --no-cleanup · account ${accountId} remains)`);
    return;
  }
  console.log(`\nCleaning up test account ${accountId}...`);
  try {
    await stripeCall("DELETE", `/v1/accounts/${accountId}`);
    console.log(`  ✓ Deleted`);
  } catch (e) {
    console.log(`  ! Delete failed (${e.message.slice(0, 80)}) · rejected if any charges/transfers exist · owner can delete via dashboard`);
  }
}

// ─── Main ───

try {
  if (pollOnlyId) {
    const final = await pollStatus(pollOnlyId);
    await writeResult(final);
    process.exit(0);
  }
  const acct = await createAccount();
  await createAccountLink(acct.id);
  const final = await pollStatus(acct.id);
  await writeResult(final);
  await cleanup(acct.id);
  console.log(`\n✓ Smoke test complete.`);
} catch (e) {
  console.error(`\n✗ Smoke test failed: ${e.message}`);
  process.exit(3);
}
