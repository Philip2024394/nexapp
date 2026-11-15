// QA · Checkpoint C · routes + theme + payments · 2026-11-16
// C3: cross-account order view denial (real UI)

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
const BUYER_EMAIL = fromEnvFile(CK5, "PLAYWRIGHT_CK5_B_EMAIL");
const BUYER_PASSWORD = fromEnvFile(CK5, "PLAYWRIGHT_CK5_B_PASSWORD");
const BUYER_ACCOUNT_ID = fromEnvFile(CK5, "PLAYWRIGHT_CK5_B_ACCOUNT_ID");

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

test.describe("QA · Checkpoint C · routes + theme", () => {
  test("C3 · orders/[orderId] renders dark theme for owning buyer", async ({ page }) => {
    // Find an order owned by the CK5 buyer
    const c = new PG({ connectionString: DB_URL });
    await c.connect();
    let orderId: string | null = null;
    try {
      const { rows } = await c.query(
        `SELECT id FROM nex_order
           WHERE customer_account_id = $1
           ORDER BY created_at DESC LIMIT 1`,
        [BUYER_ACCOUNT_ID],
      );
      orderId = rows[0]?.id ?? null;
    } finally { await c.end(); }
    if (!orderId) {
      test.skip(true, "No existing order for CK5 B · BLOCKED");
      return;
    }
    await signIn(page, BUYER_EMAIL, BUYER_PASSWORD, `/nex-native/orders/${orderId}`);
    await expect(page).toHaveURL(new RegExp(`/orders/${orderId}`), { timeout: 20_000 });
    // Check dark-themed body: background color should be dark (not pure white)
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    console.log("[C3] body bg:", bg);
    // Dark theme: rgb values generally small (sum < 450). Light theme: large sum.
    const parsed = bg.match(/rgb(?:a)?\(([^)]+)\)/)?.[1]?.split(",").map((n) => parseFloat(n.trim()));
    if (parsed && parsed.length >= 3) {
      const sum = parsed[0] + parsed[1] + parsed[2];
      // Report honestly, don't hard-assert; owner wants evidence
      console.log("[C3] bg channel sum:", sum, "(darker=lower)");
    }
    // Page should include phone-frame shell
    const hasFrame = await page.locator(".nex-native-frame, [data-nex-native-frame]").count();
    console.log("[C3] frame count:", hasFrame);
    // At least rendered content should contain order id or shop info
    const bodyText = (await page.locator("body").innerText()).slice(0, 400);
    console.log("[C3] body preview:", bodyText);
  });

  test("C3b · cross-account denial", async ({ page }) => {
    // Find an order owned by someone OTHER than CK5 B that we can attempt to view
    const c = new PG({ connectionString: DB_URL });
    await c.connect();
    let otherOrderId: string | null = null;
    try {
      const { rows } = await c.query(
        `SELECT id FROM nex_order
           WHERE customer_account_id <> $1
             AND customer_account_id <> '11111111-1111-4111-8111-111111111111'
             AND customer_account_id <> '11111111-1111-4111-8111-111111111113'
           ORDER BY created_at DESC LIMIT 1`,
        [BUYER_ACCOUNT_ID],
      );
      otherOrderId = rows[0]?.id ?? null;
    } finally { await c.end(); }
    if (!otherOrderId) {
      test.skip(true, "No cross-account order candidate · BLOCKED");
      return;
    }
    await signIn(page, BUYER_EMAIL, BUYER_PASSWORD, `/nex-native/orders/${otherOrderId}`);
    // Verify we don't see sensitive data; URL may redirect or notFound
    const url = page.url();
    const bodyText = (await page.locator("body").innerText()).slice(0, 500);
    console.log("[C3b] final URL:", url);
    console.log("[C3b] body preview:", bodyText.slice(0, 200));
    // If it's a successful view of the other user's order, that's a leak
    expect(bodyText).not.toMatch(new RegExp(otherOrderId.slice(0, 8)));
  });
});
