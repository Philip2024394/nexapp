// tests/e2e/diagnostic-ask-seller-send-handler.spec.ts
//
// Cycle 10 · 2026-11-24 · DIAGNOSTIC ONE-SHOT · root-cause probe for
// the BROKEN non-owner Ask Seller send handler.
//
// Scope: capture network + console + DOM state during the click to
// identify the actual failure branch. This spec is NOT a regression
// test · it exists to uncover the root cause. Once root cause is
// found it will be removed or converted into a proper test.
//
// No mutations, no new accounts, no body plaintext inspection.

import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import path from "node:path";

const SLUG = process.env.NEX_E2E_SEED_SHOP_SLUG;
const PRODUCT_ID = process.env.NEX_E2E_SEED_PRODUCT_ID;
const SEEDED = typeof SLUG === "string" && typeof PRODUCT_ID === "string";

test.use({ storageState: "tests/e2e/.auth/state.json" });

test("DIAGNOSTIC · capture send-path state", async ({ page }) => {
  test.skip(!SEEDED, "BLOCKED-PENDING-SEED-FIXTURE");

  interface NetEvent {
    phase: "request" | "response";
    url: string;
    method?: string;
    status?: number;
    ok?: boolean;
    body?: string;
  }
  const networkLog: NetEvent[] = [];
  const consoleLog: Array<{ type: string; text: string }> = [];
  const pageErrors: string[] = [];

  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/api/nex-native/")) {
      networkLog.push({
        phase: "request",
        url: url.replace(/^https?:\/\/[^/]+/, ""),
        method: req.method(),
      });
    }
  });
  page.on("response", async (resp) => {
    const url = resp.url();
    if (url.includes("/api/nex-native/")) {
      let body = "";
      try {
        const txt = await resp.text();
        // Redact anything that looks like base64 ciphertext or device
        // public keys. Keep status/error strings only.
        body = txt.length > 400 ? txt.slice(0, 400) + "…[truncated]" : txt;
      } catch {
        body = "[unreadable]";
      }
      networkLog.push({
        phase: "response",
        url: url.replace(/^https?:\/\/[^/]+/, ""),
        status: resp.status(),
        ok: resp.ok(),
        body,
      });
    }
  });
  page.on("console", (msg) => {
    consoleLog.push({ type: msg.type(), text: msg.text().slice(0, 500) });
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message.slice(0, 500));
  });

  // Step 1 · enter conversation.
  const r = await page.goto(
    `/nex-native/${SLUG}?open-chat=1&product=${PRODUCT_ID}`,
    { waitUntil: "domcontentloaded" },
  );
  expect(r?.status()).toBeLessThan(500);

  await expect
    .poll(() => page.url(), { timeout: 10_000 })
    .toMatch(
      new RegExp(
        `/nex-native/conversations/[0-9a-f-]+\\?product=${PRODUCT_ID}`,
        "i",
      ),
    );

  const chip = page.locator(
    `[data-nex-biz-conv-pending-product="${PRODUCT_ID}"]`,
  );
  await expect(chip).toBeVisible({ timeout: 10_000 });

  const sendBtn = page.locator("[data-nex-biz-conv-pending-product-send]").first();
  await expect(sendBtn).toBeVisible({ timeout: 10_000 });

  const chipAttrsBefore = {
    sending: await chip.getAttribute("data-nex-biz-conv-pending-product-sending"),
    locked: await chip.getAttribute("data-nex-biz-conv-pending-product-locked"),
  };
  const btnDisabledBefore = await sendBtn.getAttribute("disabled");

  // Clear the network log of everything PRE-click · we only want the
  // send-path requests.
  const preClickNet = networkLog.splice(0, networkLog.length);

  // Step 2 · click send.
  await sendBtn.click();

  // Step 3 · poll for any terminal state OR 15s · DO NOT fail if
  // none — this is a diagnostic. Capture whatever happens.
  const endBy = Date.now() + 15_000;
  const states: Array<{ t: number; sending: string | null; chipPresent: boolean; errLabelPresent: boolean }> = [];
  while (Date.now() < endBy) {
    const chipStill = page.locator(
      `[data-nex-biz-conv-pending-product="${PRODUCT_ID}"]`,
    );
    const chipCount = await chipStill.count();
    const sending =
      chipCount > 0
        ? await chipStill.getAttribute("data-nex-biz-conv-pending-product-sending")
        : null;
    const errLabel = await page
      .locator("[data-nex-biz-conv-pending-product-error]")
      .count();
    states.push({
      t: Date.now() - (endBy - 15_000),
      sending,
      chipPresent: chipCount > 0,
      errLabelPresent: errLabel > 0,
    });
    if (chipCount === 0 || errLabel > 0) break;
    await page.waitForTimeout(500);
  }

  const chipAttrsAfter = (await page
    .locator(`[data-nex-biz-conv-pending-product="${PRODUCT_ID}"]`)
    .count())
    ? {
        sending: await chip.getAttribute(
          "data-nex-biz-conv-pending-product-sending",
        ),
        locked: await chip.getAttribute(
          "data-nex-biz-conv-pending-product-locked",
        ),
      }
    : null;

  const errLabelText = await page
    .locator("[data-nex-biz-conv-pending-product-error]")
    .first()
    .textContent()
    .catch(() => null);

  const report = {
    timestamp: new Date().toISOString(),
    url_final: page.url(),
    chip_attrs_before: chipAttrsBefore,
    chip_attrs_after: chipAttrsAfter,
    btn_disabled_before: btnDisabledBefore,
    err_label_text: errLabelText,
    pre_click_api_calls: preClickNet,
    post_click_api_calls: networkLog,
    state_snapshots: states,
    console_log: consoleLog.filter(
      (m) =>
        m.type === "error" ||
        m.type === "warning" ||
        /nex|chat|device|key|encrypted|send/i.test(m.text),
    ),
    page_errors: pageErrors,
  };

  const outPath = path.join(
    process.cwd(),
    "test-results",
    "diagnostic-ask-seller-send-handler.json",
  );
  try {
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  } catch {
    /* best-effort */
  }
  // Also attach the report to the test for the HTML reporter.
  await test.info().attach("diagnostic-report.json", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });

  // Intentionally succeed so the artifact is preserved alongside the
  // existing failing journey spec. The diagnostic's job is to report.
  expect(report.timestamp).toBeTruthy();
});
