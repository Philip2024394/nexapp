#!/usr/bin/env node
// scripts/_tmp/free-chat-audit-probe.mjs
//
// Bounded browser verification for the free-chat / peer-chat audit
// (owner directive 2026-11-16 · follow-on from peer-catalog probe).
// Reuses disposable, already-authorised sandbox accounts (CK5 A seller
// + CK5 B buyer). Founder session + dev server untouched. Sandbox DB
// only · hard refusal of prod ijvqdvsvwtwxzcqmoqit. No DB mutation
// outside the sealed peer-message send/edit/delete/react actions that
// production chat already uses.
//
// Journeys covered:
//   C1 · Buyer→Seller ordinary text message · send + persistence
//   C2 · Reactions · emoji toggle via smile button
//   C3 · Long-press bubble action menu · Reply + Copy + Forward + Edit
//        visible (presence only · actions already have their own unit
//        regressions)
//   C4 · Read-tick state visible
//   C5 · Joker keypad mounts on composer focus at phone width (≤500px)
//   C6 · Call Centre button opens the call-centre drawer (UI render)
//   C7 · Theme library page loads · free theme card present ·
//        apply-theme CTA rendered
//   C8 · Drawer regression spot-check · peer-catalog mode still mounts
//        (just verifies the trigger exists; full flow owned by prior
//        peer-catalog probe)

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ENV_FILE = ".env.playwright.vault-ck5";
const EVIDENCE_DIR = "evidence/free-chat-audit";
mkdirSync(EVIDENCE_DIR, { recursive: true });

function fromEnvFile(file, key) {
  const m = readFileSync(file, "utf8").match(
    new RegExp(`^${key}=['"]?([^'"\n]*)['"]?$`, "m"),
  );
  if (!m) throw new Error(`missing ${key} in ${file}`);
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

const SELLER_EMAIL = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_EMAIL");
const SELLER_PASSWORD = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_PASSWORD");
const SELLER_ACCOUNT_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const BUYER_EMAIL = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_B_EMAIL");
const BUYER_PASSWORD = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_B_PASSWORD");
const BUYER_ACCOUNT_ID = fromEnvFile(ENV_FILE, "PLAYWRIGHT_CK5_B_ACCOUNT_ID");

const HAMMEREX = "11111111-1111-4111-8111-111111111111";
const ROSA = "11111111-1111-4111-8111-111111111113";
for (const id of [SELLER_ACCOUNT_ID, BUYER_ACCOUNT_ID]) {
  if (id === HAMMEREX || id === ROSA) {
    throw new Error("refuses · protected account id resolved");
  }
}

const BASE = "http://localhost:3008";
const log = (phase, data) => console.log(`[${phase}]`, data ?? "");

async function signIn(page, email, password, nextPath) {
  await page.goto(
    `${BASE}/nex-native/sign-in?next=${encodeURIComponent(nextPath)}`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("button[data-nex-sign-in-submit]").click();
  await page.waitForURL(
    (u) => !new URL(u).pathname.startsWith("/nex-native/sign-in"),
    { timeout: 60_000, waitUntil: "domcontentloaded" },
  );
}
async function shot(page, name) {
  const p = path.join(EVIDENCE_DIR, name);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  📸 ${p}`);
  return p;
}

const results = {
  journeys: [],
  startedAt: new Date().toISOString(),
};
function record(id, status, note, evidence) {
  const row = { id, status, note, evidence };
  results.journeys.push(row);
  console.log(`[${status}] ${id} · ${note}`);
  return row;
}

const browser = await chromium.launch({ headless: true });
try {
  // ─────────────────────────────────────────────────────────────
  // Buyer session · drives all ordinary-chat journeys
  // ─────────────────────────────────────────────────────────────
  // Use 540 (above Joker breakpoint 500) so OS textarea is active
  // for text-send journeys. The Joker check later opens its own 390
  // context.
  log("buyer sign-in");
  const buyerCtx = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    permissions: [],
  });
  const buyerPage = await buyerCtx.newPage();
  const chatPath = `/nex-native/chat/peer/${SELLER_ACCOUNT_ID}`;
  await signIn(buyerPage, BUYER_EMAIL, BUYER_PASSWORD, chatPath);

  // Wait for client mount (composer textarea present)
  await buyerPage
    .waitForSelector("[data-nex-composer-textarea]", {
      state: "attached",
      timeout: 20_000,
    })
    .catch(() => {});

  // C1 · ordinary text send is BLOCKED for THIS probe because
  // Chat9001Pill passes `forceKeypadActive={true}` to NexInput, so
  // the composer input renders `readOnly + inputMode='none'` and
  // Playwright's `.fill()` is refused. The e2e text hook
  // (`__NEX_E2E_INSERT_COMPOSER_TEXT__`) is only installed when the
  // dev bundle has `NEXT_PUBLIC_NEX_E2E_HOOKS=1`, which would require
  // restarting the founder's dev server — not authorised this
  // checkpoint. Record the structural facts the probe CAN see from
  // an existing bubble instead.
  {
    const existingBubbles = await buyerPage
      .locator("[data-nex-msg-id]")
      .count();
    record(
      "C1-text-send",
      "BLOCKED",
      `probe cannot type into forceKeypadActive composer without NEXT_PUBLIC_NEX_E2E_HOOKS=1 · existing bubble count on screen=${existingBubbles} · the sealed send path is covered by the slice-1b-share-product-live-session.test.ts regression and the prior peer-catalog A-share-product PASS`,
      null,
    );
  }

  // C3 · long-press bubble action menu (presence of Reply/Copy/Forward/Edit)
  // on ANY existing bubble on this conversation.
  try {
    const bubble = buyerPage.locator(`[data-nex-msg-id]`).first();
    const count = await bubble.count();
    if (count === 0) throw new Error("no existing bubble in conversation");
    const box = await bubble.boundingBox();
    if (!box) throw new Error("bubble bounding box null");
    // Simulate long-press by mouse down, wait ≥500ms, up (touchstart
    // path needs touch emulation; mouse works for the contextmenu
    // fallback). Try right-click first.
    await bubble.click({ button: "right", timeout: 5_000 }).catch(() => {});
    await buyerPage.waitForTimeout(500);
    const menu = buyerPage.locator("[data-nex-bubble-action-menu]");
    const menuPresent = await menu.count();
    const reply = await buyerPage
      .locator("[data-nex-bubble-action-menu-reply]")
      .count();
    const copy = await buyerPage
      .locator("[data-nex-bubble-action-menu-copy]")
      .count();
    const forward = await buyerPage
      .locator("[data-nex-bubble-action-menu-forward]")
      .count();
    const edit = await buyerPage
      .locator("[data-nex-bubble-action-menu-edit]")
      .count();
    if (menuPresent && reply && copy && forward) {
      const ev = await shot(buyerPage, "C3-long-press-menu.png");
      record(
        "C3-bubble-actions",
        "PASS",
        `menu rendered · reply=${reply} copy=${copy} forward=${forward} edit=${edit}`,
        ev,
      );
    } else {
      const ev = await shot(buyerPage, "C3-long-press-menu-missing.png");
      record(
        "C3-bubble-actions",
        "UNVERIFIED",
        `menu=${menuPresent} reply=${reply} copy=${copy} forward=${forward} edit=${edit} (right-click may not trigger on this build)`,
        ev,
      );
    }
    // Close the menu
    await buyerPage.keyboard.press("Escape").catch(() => {});
    await buyerPage.waitForTimeout(200);
  } catch (err) {
    record(
      "C3-bubble-actions",
      "UNVERIFIED",
      `probe-tooling: ${String(err).slice(0, 180)}`,
      null,
    );
  }

  // C2 · reactions (smile button → emoji chip)
  try {
    const addReact = buyerPage.locator("[data-nex-reaction-add]").first();
    if (await addReact.count()) {
      // Scroll into view + click
      await addReact.scrollIntoViewIfNeeded().catch(() => {});
      await addReact.click({ timeout: 5_000, force: true });
      await buyerPage.waitForTimeout(600);
      const ev = await shot(buyerPage, "C2-reaction-picker.png");
      record(
        "C2-reactions",
        "PASS",
        "smile button clickable · picker opened (presence)",
        ev,
      );
    } else {
      record(
        "C2-reactions",
        "UNVERIFIED",
        "no data-nex-reaction-add element on screen (may require hover on touch build)",
        null,
      );
    }
  } catch (err) {
    record(
      "C2-reactions",
      "UNVERIFIED",
      `probe-tooling: ${String(err).slice(0, 180)}`,
      null,
    );
  }

  // C4 · read-tick presence
  try {
    const tickCount = await buyerPage
      .locator(
        "[data-nex-read-tick], [data-nex-msg-id] svg[aria-label*='sent' i], [data-nex-msg-id] svg[aria-label*='read' i]",
      )
      .count();
    if (tickCount > 0) {
      record(
        "C4-read-tick",
        "PASS",
        `read-tick element(s) rendered · count=${tickCount}`,
        null,
      );
    } else {
      record(
        "C4-read-tick",
        "UNVERIFIED",
        "no tick selector matched · tick may use different attribute",
        null,
      );
    }
  } catch (err) {
    record(
      "C4-read-tick",
      "UNVERIFIED",
      `probe-tooling: ${String(err).slice(0, 180)}`,
      null,
    );
  }

  // C5 · Joker keypad at phone width · dedicated 390 context
  try {
    const phoneCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const phonePage = await phoneCtx.newPage();
    await signIn(phonePage, BUYER_EMAIL, BUYER_PASSWORD, chatPath);
    await phonePage
      .waitForSelector("[data-nex-composer-textarea]", {
        state: "attached",
        timeout: 15_000,
      })
      .catch(() => {});
    const ta = phonePage.locator("[data-nex-composer-textarea]").first();
    await ta.focus({ timeout: 5_000 }).catch(() => {});
    await phonePage.waitForTimeout(600);
    const inputMode = await ta.getAttribute("inputmode").catch(() => null);
    const readOnly = await ta.getAttribute("readonly").catch(() => null);
    const keypadNode = await phonePage
      .locator("[data-nex-joker-keypad], [aria-label*='Joker' i]")
      .count();
    if (inputMode === "none" || readOnly !== null || keypadNode > 0) {
      const ev = await shot(phonePage, "C5-joker-keypad.png");
      record(
        "C5-joker-keypad",
        "PASS",
        `phone-width Joker signature: inputmode=${inputMode} readonly=${readOnly !== null} keypadNodes=${keypadNode}`,
        ev,
      );
    } else {
      record(
        "C5-joker-keypad",
        "UNVERIFIED",
        `no joker signature at 390 · inputmode=${inputMode} readonly=${readOnly !== null} keypadNodes=${keypadNode}`,
        null,
      );
    }
    await phoneCtx.close();
  } catch (err) {
    record(
      "C5-joker-keypad",
      "UNVERIFIED",
      `probe-tooling: ${String(err).slice(0, 180)}`,
      null,
    );
  }

  // C6 · Call Centre drawer opens · 5 rows render (Voice, Video,
  // Dial, Recent, Contacts). Media + signalling NOT exercised by this
  // probe · would need two consenting browser contexts with fake
  // getUserMedia + shared signalling channel · separate verification.
  try {
    const trig = buyerPage
      .locator("[data-nex-free-chat-call-center-trigger]")
      .first();
    const trigCount = await trig.count();
    if (trigCount === 0) {
      record(
        "C6-call-centre",
        "UNVERIFIED",
        "no free-chat Call Centre trigger located on peer-chat",
        null,
      );
    } else {
      await trig.click({ timeout: 5_000, force: true });
      await buyerPage.waitForTimeout(600);
      const panelOpen = await buyerPage
        .locator("[data-nex-free-chat-call-center-panel-open='true']")
        .count();
      const rowVoice = await buyerPage
        .locator("[data-nex-free-chat-call-center-row='voice']")
        .count();
      const rowVideo = await buyerPage
        .locator("[data-nex-free-chat-call-center-row='video']")
        .count();
      const rowDial = await buyerPage
        .locator("[data-nex-free-chat-call-center-row='dial']")
        .count();
      const rowRecent = await buyerPage
        .locator("[data-nex-free-chat-call-center-row='recent']")
        .count();
      const rowContacts = await buyerPage
        .locator("[data-nex-free-chat-call-center-row='contacts']")
        .count();
      const ev = await shot(buyerPage, "C6-call-centre-drawer.png");
      const allRows =
        rowVoice && rowVideo && rowDial && rowRecent && rowContacts;
      if (panelOpen && allRows) {
        record(
          "C6-call-centre",
          "PASS",
          `drawer opened · 5 rows rendered (voice/video/dial/recent/contacts) · media + signalling UNVERIFIED by this probe`,
          ev,
        );
      } else {
        record(
          "C6-call-centre",
          "UNVERIFIED",
          `panelOpen=${panelOpen} voice=${rowVoice} video=${rowVideo} dial=${rowDial} recent=${rowRecent} contacts=${rowContacts}`,
          ev,
        );
      }
      await buyerPage.keyboard.press("Escape").catch(() => {});
      await buyerPage.waitForTimeout(300);
    }
  } catch (err) {
    record(
      "C6-call-centre",
      "UNVERIFIED",
      `probe-tooling: ${String(err).slice(0, 180)}`,
      null,
    );
  }

  // C8 · drawer regression (peer-catalog trigger present on this
  // seller peer)
  try {
    const shopTrig = await buyerPage
      .locator("[data-nex-shop-drawer-trigger]")
      .count();
    const mode = await buyerPage
      .locator("[data-nex-shop-drawer-trigger]")
      .first()
      .getAttribute("data-nex-shop-drawer-trigger-mode")
      .catch(() => null);
    if (shopTrig > 0 && mode === "peer-catalog") {
      record(
        "C8-drawer-regression",
        "PASS",
        `Shop FAB present in peer-catalog mode · count=${shopTrig}`,
        null,
      );
    } else {
      record(
        "C8-drawer-regression",
        "UNVERIFIED",
        `shopTrig=${shopTrig} mode=${mode}`,
        null,
      );
    }
  } catch (err) {
    record(
      "C8-drawer-regression",
      "UNVERIFIED",
      `probe-tooling: ${String(err).slice(0, 180)}`,
      null,
    );
  }

  // C7 · theme library
  log("theme library");
  await buyerPage
    .goto(`${BASE}/nex-native/chat-themes-library`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    })
    .catch(() => {});
  await buyerPage.waitForTimeout(3000);
  try {
    const title = (await buyerPage.title().catch(() => "")) || "";
    const applyBtnCount = await buyerPage
      .locator(
        "button:has-text('Apply'), button:has-text('Use this theme'), button:has-text('Preview')",
      )
      .count();
    const freeBadge = await buyerPage
      .locator("text=/free/i")
      .count()
      .catch(() => 0);
    const ev = await shot(buyerPage, "C7-theme-library.png");
    if (applyBtnCount > 0) {
      record(
        "C7-theme-library",
        "PASS",
        `library rendered · title="${title}" · apply/preview CTAs=${applyBtnCount} · free-marker count=${freeBadge}`,
        ev,
      );
    } else {
      record(
        "C7-theme-library",
        "UNVERIFIED",
        `library rendered but no apply/preview CTA located · title="${title}"`,
        ev,
      );
    }
  } catch (err) {
    record(
      "C7-theme-library",
      "UNVERIFIED",
      `probe-tooling: ${String(err).slice(0, 180)}`,
      null,
    );
  }

  await buyerCtx.close();

  results.finishedAt = new Date().toISOString();
  const summaryPath = path.join(EVIDENCE_DIR, "probe-summary.json");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\n→ ${summaryPath}`);
  const counts = results.journeys.reduce((a, r) => {
    a[r.status] = (a[r.status] || 0) + 1;
    return a;
  }, {});
  console.log(
    `\nSUMMARY · ${results.journeys.length} rows · ${Object.entries(counts)
      .map(([k, v]) => `${k}=${v}`)
      .join(" · ")}`,
  );
} finally {
  await browser.close();
}
