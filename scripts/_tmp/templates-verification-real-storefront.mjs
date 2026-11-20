#!/usr/bin/env node
// scripts/_tmp/templates-verification-real-storefront.mjs
//
// Master checkpoint · bounded REAL-storefront anonymous visit for the
// existing CK5 A shop (its persisted cover_layout_id). No session is
// created · fresh anonymous Playwright context · READ-ONLY.
//
// Guards:
//   · sandbox DB only (verified via DATABASE_URL · we only READ)
//   · no protected accounts opened
//   · no uploads · no writes · no deletes
//   · no founder-session interference

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import pkg from "pg";

const { Client: PG } = pkg;
const ENV_FILE = ".env.playwright.vault-ck5";
const EVIDENCE_DIR = "evidence/shop-templates-verification";
mkdirSync(EVIDENCE_DIR, { recursive: true });

function fromEnvFile(key) {
  const m = readFileSync(ENV_FILE, "utf8").match(
    new RegExp(`^${key}=['"]?([^'"\n]*)['"]?$`, "m"),
  );
  if (!m) throw new Error(`missing ${key}`);
  return m[1].trim();
}
function fromEnvLocal(key) {
  const m = readFileSync(".env.local", "utf8").match(
    new RegExp(`^${key}=(.*)$`, "m"),
  );
  return m ? m[1].trim() : "";
}
const DB_URL = fromEnvLocal("DATABASE_URL");
if (!DB_URL.includes("kdstoyyeygcopkogqsyv")) {
  throw new Error("refuses · DATABASE_URL not sandbox");
}
if (DB_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  throw new Error("refuses · DATABASE_URL points at prod");
}

const BUSINESS_SLUG = fromEnvFile("PLAYWRIGHT_CK5_A_BUSINESS_SLUG");
const BUSINESS_ID = fromEnvFile("PLAYWRIGHT_CK5_A_BUSINESS_ID");

const BASE = "http://localhost:3008";

async function main() {
  // Read current cover_layout_id · do NOT mutate.
  const pg = new PG({ connectionString: DB_URL });
  await pg.connect();
  const q = await pg.query(
    `SELECT cover_layout_id, shop_cover_image_url IS NOT NULL AS has_custom_bg,
            shop_cover_tint_hex IS NOT NULL AS has_custom_tint,
            display_name, slug, owner_account_id
     FROM nex_business WHERE id = $1`,
    [BUSINESS_ID],
  );
  const row = q.rows[0];
  console.log("[SHOP_ROW]", JSON.stringify(row));
  const productCount = await pg.query(
    `SELECT count(*) AS n FROM nex_product WHERE business_id = $1 AND status = 'live'`,
    [BUSINESS_ID],
  );
  console.log("[LIVE_PRODUCT_COUNT]", productCount.rows[0].n);
  await pg.end();

  const browser = await chromium.launch({ headless: true });
  const VIEWPORTS = [
    { label: "mobile-390", width: 390, height: 844 },
    { label: "desktop-1024", width: 1024, height: 900 },
  ];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await ctx.newPage();
    const url = `${BASE}/nex-native/${BUSINESS_SLUG}`;
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(500);
    // Detect key shared chrome.
    const cardLinks = await page.locator('a[href*="/nex-native/chat/peer/"]').count();
    const fabCount = await page.locator('[data-nex-shop-chat-fab], a[href*="/nex-native/chat/peer/"][style*="position"]').count();
    const burgerBtn = await page.locator('[data-nex-cover-burger], button:has-text("☰")').count();
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    const shotPath = path.join(
      EVIDENCE_DIR,
      `real-storefront-${BUSINESS_SLUG}-${vp.label}.png`,
    );
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(
      `[REAL_STOREFRONT] slug=${BUSINESS_SLUG} vp=${vp.label} http=${resp.status()} cards+fab=${cardLinks} burger=${burgerBtn} overflow=${overflow.scroll > overflow.client ? "YES" : "no"}`,
    );
    await ctx.close();
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
