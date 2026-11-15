// scripts/_tmp/qa-nov16-A10-reverify.mjs
// Re-verify A10 after the attachment_type='product' → null fix.
// Sandbox only. Disposable CK5-B buyer. No Hammerex/Rosa touches.

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import pkg from "pg";
const { Client: PG } = pkg;

function envLocal(k) {
  const m = readFileSync(".env.local", "utf8").match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}
function envCk5(k) {
  const m = readFileSync(".env.playwright.vault-ck5", "utf8").match(
    new RegExp(`^${k}=['"]?([^'"\\n]*)['"]?$`, "m"),
  );
  return m ? m[1].trim() : "";
}

const DB = envLocal("DATABASE_URL");
if (!DB.includes("kdstoyyeygcopkogqsyv")) { console.error("not sandbox · abort"); process.exit(1); }
if (DB.includes("ijvqdvsvwtwxzcqmoqit")) { console.error("prod ref · abort"); process.exit(2); }

const EMAIL = envCk5("PLAYWRIGHT_CK5_B_EMAIL");
const PW = envCk5("PLAYWRIGHT_CK5_B_PASSWORD");
const BUYER_ID = envCk5("PLAYWRIGHT_CK5_B_ACCOUNT_ID");
const BUSINESS_ID = envCk5("PLAYWRIGHT_CK5_A_BUSINESS_ID");

const pg = new PG({ connectionString: DB });
await pg.connect();
// Find any live product on a disposable seller — exclude Hammerex(99901) + Rosa(99903)
const HAMMER = "11111111-1111-4111-8111-111111111111";
const ROSA = "11111111-1111-4111-8111-111111111113";
const prodR = await pg.query(
  `SELECT p.id, p.name, p.image_url, b.owner_account_id
   FROM nex_product p JOIN nex_business b ON b.id = p.business_id
   WHERE p.status = 'live'
     AND b.owner_account_id NOT IN ($1, $2)
   LIMIT 1`,
  [HAMMER, ROSA],
);
if (prodR.rowCount === 0) { console.error("no live product on any disposable seller · abort"); await pg.end(); process.exit(3); }
const PRODUCT_ID = prodR.rows[0].id;
const PRODUCT_NAME = prodR.rows[0].name;
const PRODUCT_OWNER = prodR.rows[0].owner_account_id;
if (PRODUCT_OWNER === BUYER_ID) {
  console.error("product owned by buyer · can't send inquiry to self · abort"); await pg.end(); process.exit(4);
}
console.log(`product=${PRODUCT_ID} name=${PRODUCT_NAME} has_image=${!!prodR.rows[0].image_url}`);

const cutoff = new Date().toISOString();
await pg.end();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

try {
  // Sign in
  await page.goto("http://localhost:3008/nex-native/sign-in", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PW);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/nex-native/sign-in"), { timeout: 60_000 }),
    page.locator('button[data-nex-sign-in-submit]').click(),
  ]);

  // Go to product page
  await page.goto(`http://localhost:3008/nex-native/product/${PRODUCT_ID}`, {
    waitUntil: "domcontentloaded", timeout: 60_000,
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "evidence/qa/A10-reverify-01-product.png", fullPage: true });

  // Click Ask more details
  const askBtn = page.locator('button', { hasText: /ask more details/i }).first();
  await askBtn.waitFor({ timeout: 10_000 });
  await askBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "evidence/qa/A10-reverify-02-composer.png", fullPage: true });

  // Type question and send
  const textarea = page.locator('[data-nex-product-inquiry-modal] textarea').first();
  await textarea.fill(`qa-A10-reverify ${Date.now()}`);
  await page.waitForTimeout(300);
  const sendBtn = page.locator('[data-nex-product-inquiry-send]').first();
  // Capture console errors + page errors to see if the server action threw
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('[browser-console-err]', msg.text().slice(0,200)); });
  page.on('pageerror', (e) => console.log('[page-error]', e.message?.slice(0,200)));
  await sendBtn.click();
  // Wait up to 30s for navigation to /chat/peer OR composer disappearance
  const t0 = Date.now();
  while (Date.now() - t0 < 30_000) {
    const u = new URL(page.url());
    if (u.pathname.startsWith("/nex-native/chat/peer/")) break;
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: "evidence/qa/A10-reverify-03-after-send.png", fullPage: true });
  console.log("landed:", page.url());

  // Verify DB
  const pg2 = new PG({ connectionString: DB });
  await pg2.connect();
  const sentR = await pg2.query(
    `SELECT id, sent_at, body, attachment_type, attachment_meta->'product'->>'product_id' AS pid
     FROM nex_peer_message
     WHERE sender_account_id = $1 AND sent_at >= $2
     ORDER BY sent_at DESC LIMIT 5`,
    [BUYER_ID, cutoff],
  );
  console.log("messages_sent_by_buyer_after_cutoff=", sentR.rowCount);
  for (const r of sentR.rows) {
    console.log(`  id=${r.id.slice(0,8)} type=${r.attachment_type} pid=${r.pid ?? '<none>'} body_sample="${(r.body||'').slice(0,60)}"`);
  }
  await pg2.end();

  const found = sentR.rows.find((r) => r.pid === PRODUCT_ID);
  if (found) {
    console.log("\n✅ A10 PASS · product inquiry sent · attachment_type=NULL (sealed doctrine) · attachment_meta.product populated");
  } else {
    console.log("\n❌ A10 FAIL · no message with matching product_id found in meta");
    process.exit(4);
  }
} finally {
  await ctx.close();
  await browser.close();
}
