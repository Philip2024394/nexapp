# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shop-chat-journey.spec.ts >> Stage 5 · Shop Chat journey (signed-in 99901 · sandbox) >> Step 2 · product detail sheet opens with Buy Now + More Details
- Location: tests\e2e-stage5-shop-chat\shop-chat-journey.spec.ts:72:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-nex-product-detail-sheet="1a0eb693-4024-4a55-82d8-58ebe35d7b4a"]')
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('[data-nex-product-detail-sheet="1a0eb693-4024-4a55-82d8-58ebe35d7b4a"]') with timeout 30000ms
  - waiting for locator('[data-nex-product-detail-sheet="1a0eb693-4024-4a55-82d8-58ebe35d7b4a"]')
  - Test timeout of 30000ms exceeded.

```

```yaml
- main:
  - link "Handbags direct":
    - /url: /nex-native/handbags-direct
  - button "Open cart"
  - button "Go back to the previous page"
  - img "Classic hand-stitched leather tote"
  - heading "Classic hand-stitched leather tote" [level=1]
  - text: IDR 4,500 In Stock
  - region "Product description":
    - paragraph: Full-grain natural leather, hand-stitched edges, unlined interior with one slip pocket. Carries a laptop and a notebook.
  - button "Ask seller about this product": Ask Seller
  - button "Add to Cart"
- alert
```

# Test source

```ts
  1   | // tests/e2e-stage5-shop-chat/shop-chat-journey.spec.ts
  2   | //
  3   | // Stage 5 · 2026-11-14 · owner-authorised build-only browser tests.
  4   | // -----------------------------------------------------------------------------
  5   | // Drives the Stages 1-4 Shop Chat customer journey against the running
  6   | // dev server at :3008 with dev-impersonation locked to `nex-99901`
  7   | // (set in `.env.local`). Fixtures come from the sealed sandbox
  8   | // (`kdstoyyeygcopkogqsyv`):
  9   | //
  10  | //   · Shop under test: handbags-direct (owned by Rosa · 99903)
  11  | //   · Product under test: 1a0eb693-… · Classic hand-stitched leather tote
  12  | //   · Foreign product (negative isolation test):
  13  | //     ebc88a97-… · belongs to irish-pride-shop, NOT handbags-direct
  14  | //
  15  | // Two Playwright-specific constraints shape the assertions below:
  16  | //
  17  | //   A. Next 16 dev server compiles routes on first hit · the default
  18  | //      `load` wait exceeds Playwright's 30s navigation timeout on
  19  | //      cold routes. We use `waitUntil: 'domcontentloaded'` plus
  20  | //      explicit element waits · same browser behaviour, honest
  21  | //      timing.
  22  | //
  23  | //   B. Each Playwright test gets a fresh BrowserContext (its own
  24  | //      localStorage / IndexedDB). The device key generated for Step
  25  | //      4's send does NOT persist into Step 5's browser · so Step 5
  26  | //      sees the muted "Product shared · open on this device to
  27  | //      view" placeholder, not the decrypted product name. That is
  28  | //      the SEALED device-only E2E contract working correctly · a
  29  | //      fresh browser SHOULD not decrypt old sent messages.
  30  | //
  31  | //      To verify the full sender-sees-own-bubble decryption path we
  32  | //      would need shared storage state across tests (new fixture
  33  | //      work · out of scope for this Stage 5 build). This spec asserts
  34  | //      on the muted placeholder (= row landed in nex_message) and
  35  | //      on the network POST shape (= Stage 2 contract fires), not
  36  | //      on the decrypted plaintext bubble.
  37  | 
  38  | import { expect, test } from "@playwright/test";
  39  | 
  40  | const SHOP_SLUG = "handbags-direct";
  41  | const PRODUCT_ID = "1a0eb693-4024-4a55-82d8-58ebe35d7b4a";
  42  | const FOREIGN_PRODUCT_ID = "ebc88a97-0323-4820-9cfd-27dd8c2bd4ff";
  43  | // Conversation id for 99901 ↔ handbags-direct · created by the
  44  | // pre-stage HTTP smoke · stable across runs because
  45  | // getOrCreateBusinessConversation is idempotent.
  46  | const CONVERSATION_ID = "b1bc59d2-ba8c-41f3-869e-6f08bdf01a27";
  47  | 
  48  | /** Navigate with Playwright-friendly wait semantics. Avoids the Next
  49  |  *  16 dev-mode compilation timeout on the default `load` wait. */
  50  | async function gotoFast(page: import("@playwright/test").Page, path: string) {
  51  |   await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
  52  | }
  53  | 
  54  | test.describe.configure({ mode: "serial" });
  55  | 
  56  | test.describe("Stage 5 · Shop Chat journey (signed-in 99901 · sandbox)", () => {
  57  |   test("Step 1 · shop page renders shop identity + products", async ({
  58  |     page,
  59  |   }) => {
  60  |     await gotoFast(page, `/nex-native/${SHOP_SLUG}`);
  61  |     // Shop name + product fixture both appear on the public shop
  62  |     // surface. Explicit `waitFor` (not toContainText timeout) so a
  63  |     // slow dev-mode first-paint doesn't flake the assertion.
  64  |     await expect(page.getByText("Handbags direct").first()).toBeVisible({
  65  |       timeout: 30_000,
  66  |     });
  67  |     await expect(
  68  |       page.getByText("Classic hand-stitched leather tote").first(),
  69  |     ).toBeVisible({ timeout: 30_000 });
  70  |   });
  71  | 
  72  |   test("Step 2 · product detail sheet opens with Buy Now + More Details", async ({
  73  |     page,
  74  |   }) => {
  75  |     await gotoFast(page, `/nex-native/${SHOP_SLUG}?product=${PRODUCT_ID}`);
  76  |     const sheet = page.locator(
  77  |       `[data-nex-product-detail-sheet="${PRODUCT_ID}"]`,
  78  |     );
> 79  |     await expect(sheet).toBeVisible({ timeout: 30_000 });
      |                         ^ Error: expect(locator).toBeVisible() failed
  80  |     await expect(
  81  |       page.locator(`[data-nex-product-sheet-buy-now="${PRODUCT_ID}"]`),
  82  |     ).toBeVisible();
  83  |     const moreDetails = page.locator(
  84  |       `[data-nex-product-sheet-more-details="${PRODUCT_ID}"]`,
  85  |     );
  86  |     await expect(moreDetails).toBeVisible();
  87  |     await expect(moreDetails).toHaveAttribute(
  88  |       "data-nex-product-sheet-more-details-mode",
  89  |       "submit",
  90  |     );
  91  |   });
  92  | 
  93  |   test("Step 3 · More Details routes to business chat with product chip pinned", async ({
  94  |     page,
  95  |   }) => {
  96  |     await gotoFast(page, `/nex-native/${SHOP_SLUG}?product=${PRODUCT_ID}`);
  97  |     await page
  98  |       .locator(`[data-nex-product-sheet-more-details="${PRODUCT_ID}"]`)
  99  |       .click();
  100 |     await page.waitForURL(/\/nex-native\/conversations\//, {
  101 |       timeout: 60_000,
  102 |       waitUntil: "commit",
  103 |     });
  104 |     await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
  105 |     await expect(
  106 |       page.locator(`[data-nex-biz-conv-pending-product="${PRODUCT_ID}"]`),
  107 |     ).toBeVisible({ timeout: 30_000 });
  108 |     await expect(
  109 |       page.locator("[data-nex-biz-conv-pending-product-send]"),
  110 |     ).toBeVisible();
  111 |     await expect(page.getByText("You selected").first()).toBeVisible();
  112 |   });
  113 | 
  114 |   test("Step 4 · Send flow · live send OR cooldown lock (both prove Stage 2)", async ({
  115 |     page,
  116 |   }) => {
  117 |     await gotoFast(
  118 |       page,
  119 |       `/nex-native/conversations/${CONVERSATION_ID}?product=${PRODUCT_ID}`,
  120 |     );
  121 |     const chip = page.locator(
  122 |       `[data-nex-biz-conv-pending-product="${PRODUCT_ID}"]`,
  123 |     );
  124 |     await expect(chip).toBeVisible({ timeout: 30_000 });
  125 |     const sendBtn = page.locator("[data-nex-biz-conv-pending-product-send]");
  126 |     await expect(sendBtn).toBeVisible();
  127 | 
  128 |     // Stage 2 product-share cooldown (task #69): once self sends a
  129 |     // product card, the Send button locks until the peer replies.
  130 |     // This Playwright run inherits whatever prior state exists in
  131 |     // the sandbox conversation · the test accepts BOTH branches as
  132 |     // valid Stage 2 behaviour and records which one fired.
  133 |     const isLocked =
  134 |       (await chip.getAttribute("data-nex-biz-conv-pending-product-locked")) ===
  135 |       "true";
  136 |     const btnDisabled = await sendBtn.isDisabled();
  137 | 
  138 |     if (isLocked || btnDisabled) {
  139 |       // Cooldown lock is active · this is DIRECT evidence that a
  140 |       // prior Stage 2 send succeeded (the cooldown derives from a
  141 |       // self product-share row in nex_message with no subsequent
  142 |       // peer reply). We verify the user-visible lock copy and the
  143 |       // disabled state · nothing clicked this run.
  144 |       await expect(sendBtn).toHaveText(/waiting for shop reply/i);
  145 |       test.info().annotations.push({
  146 |         type: "info",
  147 |         description:
  148 |           "Stage 2 cooldown ACTIVE this run · prior product share exists · sealed task #69 behaviour.",
  149 |       });
  150 |       return;
  151 |     }
  152 | 
  153 |     // Button is enabled · perform the live Stage 2 send and verify
  154 |     // the on-wire contract.
  155 |     const postPromise = page.waitForResponse(
  156 |       (resp) =>
  157 |         resp.url().includes("/api/nex-native/chat/encrypted") &&
  158 |         resp.request().method() === "POST",
  159 |       { timeout: 30_000 },
  160 |     );
  161 |     await sendBtn.click();
  162 |     const resp = await postPromise;
  163 |     expect(resp.status()).toBe(200);
  164 |     const sentJson = JSON.parse(resp.request().postData() ?? "{}") as {
  165 |       message_group_id: string;
  166 |       rows: Array<{
  167 |         attachment_type: string;
  168 |         attachment_meta?: { product_id?: string };
  169 |         body?: string | null;
  170 |         ciphertext_b64?: string;
  171 |       }>;
  172 |     };
  173 |     expect(sentJson.rows.length).toBeGreaterThan(0);
  174 |     for (const row of sentJson.rows) {
  175 |       expect(row.attachment_type).toBe("product");
  176 |       expect(row.attachment_meta?.product_id).toBe(PRODUCT_ID);
  177 |       expect(row.ciphertext_b64).toBeDefined();
  178 |       expect(typeof row.ciphertext_b64).toBe("string");
  179 |     }
```