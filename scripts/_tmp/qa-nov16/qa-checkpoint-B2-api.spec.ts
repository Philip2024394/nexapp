// QA · Stream B API probe · verify /api/nex-native/unread-count shape
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

function fromEnvFile(path: string, name: string): string {
  try {
    const m = readFileSync(path, "utf8").match(new RegExp(`^${name}=['"]?([^'"\\n]*)['"]?$`, "m"));
    return m ? m[1].trim() : "";
  } catch { return ""; }
}

const CK5 = ".env.playwright.vault-ck5";
const SELLER_EMAIL = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_EMAIL");
const SELLER_PASSWORD = fromEnvFile(CK5, "PLAYWRIGHT_CK5_A_PASSWORD");

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
test.setTimeout(120_000);

test.describe("QA · /api/nex-native/unread-count shape", () => {
  test("anonymous returns {count:0,chat:0,orders:0}", async ({ request }) => {
    const r = await request.get("/api/nex-native/unread-count");
    expect(r.status()).toBe(200);
    const body = await r.json();
    console.log("[anon unread-count]", JSON.stringify(body));
    expect(body).toMatchObject({ count: 0, chat: 0, orders: 0 });
  });

  test("signed-in seller sees chat+orders breakdown", async ({ page, context }) => {
    await signIn(page, SELLER_EMAIL, SELLER_PASSWORD, "/nex-native/manage");
    const body = await page.evaluate(async () => {
      const r = await fetch("/api/nex-native/unread-count", { credentials: "include" });
      return { status: r.status, body: await r.json() };
    });
    console.log("[signed-in unread-count]", JSON.stringify(body));
    expect(body.status).toBe(200);
    expect(body.body).toHaveProperty("count");
    expect(body.body).toHaveProperty("chat");
    expect(body.body).toHaveProperty("orders");
    expect(typeof body.body.chat).toBe("number");
    expect(typeof body.body.orders).toBe("number");
  });
});
