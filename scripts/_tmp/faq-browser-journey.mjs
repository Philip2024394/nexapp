// scripts/_tmp/faq-browser-journey.mjs
// One-off Playwright probe for FAQ customer surfaces.
// Does NOT restart the server · uses the already-running :3008 instance.
//
// Pre: FAQ data seeded on business e2e-ck5-seller-shop-mwhyjc0c by the
//      sibling node script. This one only runs the browser leg and
//      captures DOM facts + screenshots.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("evidence/faq-browser-journey");
fs.mkdirSync(OUT, { recursive: true });

const SLUG = "e2e-ck5-seller-shop-mwhyjc0c";
const PEER_HANDLE = "nex-986294";

const log = (k, v) => console.log(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGEERROR:", e.message));

try {
  // ===== Customer visits shop =====
  const shopURL = `http://localhost:3008/nex-native/${SLUG}`;
  const resp = await page.goto(shopURL, { waitUntil: "domcontentloaded", timeout: 20000 });
  log("shop_status", resp?.status() ?? "null");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "01-shop-landing.png"), fullPage: false });

  // Burger-menu trigger: look for aria-label contains "menu" or the hamburger icon button.
  const burgerCount = await page.getByRole("button", { name: /menu|more|options/i }).count();
  log("burger_candidate_count", burgerCount);

  // Try a conservative set of selectors to open the burger sheet.
  const burgerSelectors = [
    "[data-nex-cover-burger-trigger]",
    "[data-nex-burger-trigger]",
    'button[aria-label*="menu" i]',
    'button[aria-label*="more" i]',
    'button[aria-label*="options" i]',
  ];
  let opened = false;
  for (const sel of burgerSelectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0) {
      await loc.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(400);
      opened = true;
      log("burger_opened_with", sel);
      break;
    }
  }
  if (!opened) log("burger_opened_with", "NONE_FOUND");

  await page.screenshot({ path: path.join(OUT, "02-after-burger.png"), fullPage: false });

  // Look for the FAQ sheet row by its visible label.
  const faqRow = page.getByText(/^FAQ$/i).first();
  const faqRowCount = await faqRow.count();
  log("faq_row_count", faqRowCount);

  if (faqRowCount > 0) {
    await faqRow.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "03-faq-sheet-open.png"), fullPage: false });
    // Expect the seeded question text to appear
    const shipQn = await page.getByText("Do you ship internationally?").count();
    const hoursQn = await page.getByText("What are your hours?").count();
    const hiddenQn = await page.getByText("Do you accept returns?").count(); // disabled · should NOT render
    log("faq_sheet_question_ship", shipQn);
    log("faq_sheet_question_hours", hoursQn);
    log("faq_sheet_question_hidden_should_be_0", hiddenQn);
  } else {
    log("faq_sheet_rendered", "no_FAQ_row");
  }

  // ===== Customer opens peer chat with the shop owner =====
  const chatURL = `http://localhost:3008/nex-native/chat/peer/${PEER_HANDLE}`;
  const r2 = await page.goto(chatURL, { waitUntil: "domcontentloaded", timeout: 20000 });
  log("chat_status", r2?.status() ?? "null");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "04-chat-landing.png"), fullPage: false });

  // Did the FAQ pill strip mount?
  const strip = page.locator("[data-nex-chat-faq-strip]");
  const stripCount = await strip.count();
  log("chat_faq_strip_count", stripCount);

  const pills = page.locator("[data-nex-chat-faq-pill]");
  const pillCount = await pills.count();
  log("chat_faq_pill_count", pillCount);

  if (pillCount > 0) {
    const pillTexts = await pills.allTextContents();
    log("chat_faq_pill_texts", pillTexts);
    // Click the first pill and observe the FaqAnswerCard
    await pills.first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(400);
    const card = page.locator("[data-nex-chat-faq-card]");
    log("chat_faq_card_count", await card.count());
    const fromText = await page.getByText(/^From .+ FAQ$/).count();
    log("chat_faq_card_from_label", fromText);
    await page.screenshot({ path: path.join(OUT, "05-chat-pill-card.png"), fullPage: false });
  }
} finally {
  await browser.close();
}
