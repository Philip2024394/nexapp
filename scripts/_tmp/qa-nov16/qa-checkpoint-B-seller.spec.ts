// QA · Checkpoint B · seller flow · 2026-11-16
// Stream B unread + control drawer + accommodation + upload rejection

import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import pkg from "pg";
const { Client: PG } = pkg;

function fromEnvLocal(name: string): string {
  try {
    const m = readFileSync(".env.local", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    return m ? m[1].trim() : "";
  } catch { return ""; }
}
function fromEnvFile(path: string, name: string): string {
  try {
    const m = readFileSync(path, "utf8").match(new RegExp(`^${name}=['"]?([^'"\\n]*)['"]?$`, "m"));
    return m ? m[1].trim() : "";
  } catch { return ""; }
}
const DB_URL = fromEnvLocal("DATABASE_URL");
if (!DB_URL.includes("kdstoyyeygcopkogqsyv")) throw new Error("QA sandbox only");

const CK5 = ".env.playwright.vault-ck5";
const SELLER_EMAIL = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_EMAIL");
const SELLER_PASSWORD = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_PASSWORD");
const SELLER_ACCOUNT_ID = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_ACCOUNT_ID");

async function signIn(page: Page, email: string, password: string, nextPath: string) {
  await page.goto(`/nex-native/sign-in?next=${encodeURIComponent(nextPath)}`, {
    waitUntil: "domcontentloaded", timeout: 60_000,
  });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[data-nex-sign-in-submit]').click();
  await page.waitForURL(
    (u) => !u.pathname.startsWith("/nex-native/sign-in"),
    { timeout: 60_000, waitUntil: "domcontentloaded" },
  );
}

test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

test.describe("QA · Checkpoint B · seller flow", () => {
  test("B1 · baseline order count for CK5 A", async () => {
    const c = new PG({ connectionString: DB_URL });
    await c.connect();
    try {
      const { rows } = await c.query(
        `SELECT count(*)::int AS n, state FROM nex_order
           WHERE business_id IN (SELECT id FROM nex_business WHERE owner_account_id = $1)
           GROUP BY state`,
        [SELLER_ACCOUNT_ID],
      );
      console.log("[B1] seller orders:", JSON.stringify(rows));
    } finally { await c.end(); }
  });

  test("B2+B3 · /manage visit shows inbox-unread badge + drawer orders entry", async ({ page }) => {
    await signIn(page, SELLER_EMAIL, SELLER_PASSWORD, "/nex-native/manage");
    // Wait for page
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    // Look for the InboxUnreadBadge in the header
    const badge = page.locator("[data-nex-inbox-unread-badge], [data-nex-inbox-unread-badge-link]");
    const badgeCount = await badge.count();
    console.log("[B2] inbox badge count:", badgeCount);
    // Open the drawer (three-dot trigger) — look for well-known selector
    const drawerTriggers = await page.locator("[data-nex-notification-drawer-trigger], [aria-label*='notification' i], button:has-text('notifications')").count();
    console.log("[B2] drawer triggers:", drawerTriggers);
  });

  test("B8a · product upload rejects oversize file", async ({ page }) => {
    await signIn(page, SELLER_EMAIL, SELLER_PASSWORD, "/nex-native/manage");
    const bizId = "099b2fca-dbaf-4a09-aa28-a2433a7b70fd";
    const result = await page.evaluate(async (bid) => {
      const bigBuf = new Uint8Array(2.2 * 1024 * 1024);
      for (let i = 0; i < bigBuf.length; i++) bigBuf[i] = 255;
      const blob = new Blob([bigBuf], { type: "image/png" });
      const fd = new FormData();
      fd.append("file", blob, "big.png");
      fd.append("business_id", bid);
      const r = await fetch("/api/nex-native/product/upload-image", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const text = await r.text();
      return { status: r.status, body: text.slice(0, 300) };
    }, bizId);
    console.log("[B8a] oversize result:", JSON.stringify(result));
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.body).toMatch(/file-too-large/i);
  });

  test("B8b · product upload rejects unsupported type", async ({ page }) => {
    await signIn(page, SELLER_EMAIL, SELLER_PASSWORD, "/nex-native/manage");
    const bizId = "099b2fca-dbaf-4a09-aa28-a2433a7b70fd";
    const result = await page.evaluate(async (bid) => {
      const blob = new Blob([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], { type: "application/x-msdownload" });
      const fd = new FormData();
      fd.append("file", blob, "payload.exe");
      fd.append("business_id", bid);
      const r = await fetch("/api/nex-native/product/upload-image", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const text = await r.text();
      return { status: r.status, body: text.slice(0, 300) };
    }, bizId);
    console.log("[B8b] exe result:", JSON.stringify(result));
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.body).toMatch(/unsupported-type/i);
  });

  test("B7 · accommodation page refuses invalid id", async ({ page }) => {
    const bogus = "00000000-0000-4000-8000-000000000000";
    await signIn(page, SELLER_EMAIL, SELLER_PASSWORD, `/nex-native/manage/accommodation/${bogus}`);
    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    console.log("[B7] final URL for bogus accommodation id:", url);
    // Expect either a redirect away from the bogus id OR a 404-like page
    expect(url).not.toMatch(/accommodation\/00000000-0000-4000-8000-000000000000$/);
  });
});
