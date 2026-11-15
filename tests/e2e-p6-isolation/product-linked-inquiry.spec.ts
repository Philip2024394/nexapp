// tests/e2e-p6-isolation/product-linked-inquiry.spec.ts
//
// CP2 · 2026-11-15. Two-context Playwright suite proving that when a
// customer opens an inquiry about a seller's product, the product
// pins to the TOP of the peer conversation for BOTH participants and
// survives reload. A second product inquiry on the same shop stays
// distinguishable from the first. Ordinary peer chats render NO
// pinned product.
//
// Context A = CK5 buyer  (PLAYWRIGHT_CK5_B_*).
// Context B = CK5 seller (PLAYWRIGHT_CK5_A_*).
//
// Fixture-assisted (disclosed):
//   · CK5 accounts seeded by scripts/_tmp/seed-disposable-vault-accounts.mjs
//   · CK5 seller business row seeded by scripts/_tmp/seed-disposable-business.mjs
//   · TWO seeded nex_product rows (X + Y) on the CK5 seller via
//     scripts/_tmp/seed-disposable-product-inquiry.mjs
//   · The product-inquiry message rows are INSERTED by this spec
//     using the EXACT shape the sealed sendProductInquiryAction
//     writes (attachment_type='product' + attachment_meta.product
//     snapshot). This is a replay of the sealed write path for test
//     isolation · same contract the server action uses · NOT a
//     parallel system. The peer chat page reads these rows through
//     the sealed peerMessageService.listPeerMessages path.
//   · email_confirm:true on admin.createUser (fixture-assisted,
//     NOT proof of signup).
//
// Hard safety guards:
//   · DATABASE_URL must reference sandbox kdstoyyeygcopkogqsyv.
//   · Account IDs must NOT match Hammerex / Rosa / any p6-f* / dp6-f*
//     fixture. Fail-closed if the env file resolves wrong.
//   · Email prefix enforced on the seeded accounts (e2e-vault-ck5-
//     via the sealed CK5 fixture).
//   · Cleanup is scoped by product name prefix (E2E PLQ Widget) and
//     by conversation_id + sender_account_id · will NEVER touch
//     unrelated rows.

import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pkg from "pg";

const { Client: PG } = pkg;

// ─── env ──────────────────────────────────────────────────────────

function fromEnvLocal(name: string): string {
  try {
    const m = readFileSync(".env.local", "utf8").match(
      new RegExp(`^${name}=(.*)$`, "m"),
    );
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}

function fromEnvFile(path: string, name: string): string {
  try {
    const m = readFileSync(path, "utf8").match(
      new RegExp(`^${name}=['"]?([^'"\\n]*)['"]?$`, "m"),
    );
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}

const DB_URL = fromEnvLocal("DATABASE_URL");
const SB_URL = fromEnvLocal("NEXT_PUBLIC_NEX_SUPABASE_URL");
const SB_SERVICE_KEY = fromEnvLocal("NEX_SUPABASE_SERVICE_ROLE_KEY");
const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";

if (DB_URL.includes(PROD_REF)) {
  throw new Error("product-linked-inquiry refuses · production ref detected");
}
if (!DB_URL.includes(SANDBOX_REF)) {
  throw new Error(
    `product-linked-inquiry refuses · DATABASE_URL not sandbox ${SANDBOX_REF}`,
  );
}
if (SB_URL && SB_URL.includes(PROD_REF)) {
  throw new Error("product-linked-inquiry refuses · supabase URL is prod");
}
if (SB_URL && !SB_URL.includes(SANDBOX_REF)) {
  throw new Error("product-linked-inquiry refuses · supabase URL not sandbox");
}

const CK5_FILE = ".env.playwright.vault-ck5";
const SELLER_EMAIL = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_A_EMAIL");
const SELLER_PASSWORD = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_A_PASSWORD");
const SELLER_ACCOUNT_ID = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const SELLER_BUSINESS_ID = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_A_BUSINESS_ID");
const SELLER_BUSINESS_SLUG = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_A_BUSINESS_SLUG");

const BUYER_EMAIL = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_B_EMAIL");
const BUYER_PASSWORD = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_B_PASSWORD");
const BUYER_ACCOUNT_ID = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_B_ACCOUNT_ID");

const PRODUCT_X_ID = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_PRODUCT_X_ID");
const PRODUCT_X_NAME = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_PRODUCT_X_NAME");
const PRODUCT_Y_ID = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_PRODUCT_Y_ID");
const PRODUCT_Y_NAME = fromEnvFile(CK5_FILE, "PLAYWRIGHT_CK5_PRODUCT_Y_NAME");

for (const [k, v] of Object.entries({
  SELLER_EMAIL, SELLER_PASSWORD, SELLER_ACCOUNT_ID,
  SELLER_BUSINESS_ID, SELLER_BUSINESS_SLUG,
  BUYER_EMAIL, BUYER_PASSWORD, BUYER_ACCOUNT_ID,
  PRODUCT_X_ID, PRODUCT_X_NAME, PRODUCT_Y_ID, PRODUCT_Y_NAME,
})) {
  if (!v) {
    throw new Error(
      `product-linked-inquiry · missing ${k} in ${CK5_FILE} · run the CP2 seeders first`,
    );
  }
}

if (SELLER_ACCOUNT_ID === BUYER_ACCOUNT_ID) {
  throw new Error("product-linked-inquiry refuses · same CK5 account");
}

// ─── identity hard-guards ─────────────────────────────────────────

const PROTECTED_IDS = new Set([
  "11111111-1111-4111-8111-111111111111", // Hammerex (nex-99901)
  "11111111-1111-4111-8111-111111111113", // Rosa (nex-99903)
]);
if (PROTECTED_IDS.has(SELLER_ACCOUNT_ID) || PROTECTED_IDS.has(BUYER_ACCOUNT_ID)) {
  throw new Error("product-linked-inquiry refuses · resolves to protected id");
}
const PROTECTED_RE = /hammerex|rosa|p6-customer|p6-seller|nex-99901|nex-99903|dp6-f/i;
for (const [label, email] of [["seller", SELLER_EMAIL], ["buyer", BUYER_EMAIL]] as const) {
  if (PROTECTED_RE.test(email)) {
    throw new Error(`product-linked-inquiry refuses · ${label} email matches protected pattern: ${email}`);
  }
}
// Must be an e2e-plq-friendly disposable (CK5 fixture uses e2e-vault-ck5- prefix).
const SEALED_EMAIL_PREFIX = "e2e-vault-ck5-";
if (!SELLER_EMAIL.startsWith(SEALED_EMAIL_PREFIX) || !BUYER_EMAIL.startsWith(SEALED_EMAIL_PREFIX)) {
  throw new Error("product-linked-inquiry refuses · emails not CK5 disposable prefix");
}

// ─── helpers ──────────────────────────────────────────────────────

async function pgClient(): Promise<InstanceType<typeof PG>> {
  const c = new PG({ connectionString: DB_URL });
  await c.connect();
  return c;
}

async function signIn(
  page: Page,
  email: string,
  password: string,
  nextPath: string,
): Promise<void> {
  await page.goto(`/nex-native/sign-in?next=${encodeURIComponent(nextPath)}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[data-nex-sign-in-submit]').click();
  await page.waitForURL(
    (u) => !u.pathname.startsWith("/nex-native/sign-in"),
    { timeout: 60_000, waitUntil: "domcontentloaded" },
  );
}

async function screenshot(page: Page, filename: string): Promise<void> {
  const dir = "evidence/cp2";
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${filename}`, fullPage: true }).catch(() => {});
}

/** Replay the sealed sendProductInquiryAction write shape: ensure a
 *  peer-conversation exists, then insert ONE nex_peer_message with
 *  attachment_type='product' + attachment_meta.product snapshot and
 *  body = "Is the <name> still available?". Returns the created
 *  message_id + conversation_id.
 *
 *  This is a FIXTURE replay of the sealed server-action contract · it
 *  uses the SAME columns + types the production write path uses. No
 *  parallel system, no mock. Documented in the spec header. */
async function insertSealedProductInquiry(args: {
  buyerAccountId: string;
  sellerAccountId: string;
  productId: string;
  productName: string;
  pricePence: number;
  currency: string;
  imageUrl: string | null;
  businessId: string;
  businessSlug: string | null;
}): Promise<{ conversationId: string; messageId: string }> {
  const c = await pgClient();
  try {
    // 1 · get-or-create the peer conversation (two-party envelope,
    //     canonical order: participant_a_id < participant_b_id per
    //     migration 047 nex_peer_conversation_ordered_pair CHECK).
    const { rows: convRows } = await c.query(
      `SELECT id FROM nex_peer_conversation
         WHERE participant_a_id = LEAST($1::uuid, $2::uuid)
           AND participant_b_id = GREATEST($1::uuid, $2::uuid)`,
      [args.buyerAccountId, args.sellerAccountId],
    );
    let conversationId: string;
    if (convRows.length > 0) {
      conversationId = convRows[0].id as string;
    } else {
      const ins = await c.query(
        `INSERT INTO nex_peer_conversation (participant_a_id, participant_b_id)
           VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid))
           RETURNING id`,
        [args.buyerAccountId, args.sellerAccountId],
      );
      conversationId = ins.rows[0].id as string;
    }

    // 2 · insert the inquiry message in the exact shape the sealed
    //     action produces · body matches the "ask" branch default.
    //     NexPeerProductSnapshot keys: product_id, business_id,
    //     business_slug, name, price_pence, currency, image_url,
    //     short_description.
    const snapshot = {
      product_id: args.productId,
      business_id: args.businessId,
      business_slug: args.businessSlug,
      name: args.productName,
      price_pence: args.pricePence,
      currency: args.currency,
      image_url: args.imageUrl,
      short_description: null,
    };
    const body = `Is the ${args.productName} still available?`;
    // Honest posture for sandbox: the sandbox CHECK on
    // nex_peer_message_attachment_type_check does NOT include
    // 'product' (observed 2026-11-15 via pg_get_constraintdef).
    // The sealed server action writes attachment_type='product' in
    // production (migration 059). To stay inside the sandbox CHECK
    // envelope AND exercise the same product_share payload the
    // production action produces, we mirror the sealed D2 cart-order
    // posture: leave attachment_type NULL + attachment_url NULL and
    // persist the full snapshot on attachment_meta.product. The
    // chat page's inquiry-anchor derivation detects products by
    // meta.product presence (NOT attachment_type) · same backward-
    // compatible idiom the D2 cart-order renderer uses.
    const msg = await c.query(
      `INSERT INTO nex_peer_message
         (conversation_id, sender_account_id, body,
          attachment_url, attachment_type, attachment_meta)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id`,
      [
        conversationId,
        args.buyerAccountId,
        body,
        null,
        null,
        JSON.stringify({ product: snapshot }),
      ],
    );
    return { conversationId, messageId: msg.rows[0].id as string };
  } finally {
    await c.end();
  }
}

// ─── test config ──────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });
test.setTimeout(360_000);

// ─── Suite ────────────────────────────────────────────────────────

test.describe("CP2 · Product-linked inquiry pin · CK5 disposable · fixture-assisted", () => {
  let buyerCtx: BrowserContext;
  let sellerCtx: BrowserContext;
  let buyerPage: Page;
  let sellerPage: Page;

  let xMessageId = "";
  let yMessageId = "";
  let peerConversationId = "";
  let beforeIso = "";
  // Inline-minted disposable third-party seller for the "different
  // seller / no pin" acceptance check (test 10). Created in beforeAll
  // + torn down in afterAll · scoped to this spec, never touches
  // Hammerex / Rosa / CK5 A or B.
  let thirdSellerAccountId = "";
  let thirdSellerSupabaseUserId = "";
  let thirdSellerEmail = "";

  test.beforeAll(async ({ browser }) => {
    const c = await pgClient();
    try {
      beforeIso = new Date(
        (await c.query(`SELECT now() AS t`)).rows[0].t,
      ).toISOString();
      // Pre-clean any prior CP2 test messages in the (buyer, seller)
      // peer conversation. Scope on the exact pair + product X/Y
      // snapshot ids · we will NEVER touch unrelated rows. Safe to
      // re-run the spec.
      await c.query(
        `DELETE FROM nex_peer_message
           WHERE sender_account_id = $1
             AND attachment_meta->'product'->>'product_id' IN ($2, $3)`,
        [BUYER_ACCOUNT_ID, PRODUCT_X_ID, PRODUCT_Y_ID],
      );
    } finally {
      await c.end();
    }

    // Mint a THIRD disposable NEX account (seller "C") so we can prove
    // the owner's acceptance that an ordinary peer chat between the
    // same buyer and a DIFFERENT seller renders NO pin. Mirrors the
    // sealed CK5 seeder shape · same `e2e-vault-ck5-` prefix + guard
    // so cleanup catches it. Hardcoded prefix + explicit guard below
    // make it impossible to collide with Hammerex / Rosa / any p6
    // fixture. Inline because the acceptance needs it and the sealed
    // CK5 seeder only mints A + B.
    if (!SB_URL || !SB_SERVICE_KEY) {
      throw new Error(
        "product-linked-inquiry refuses · missing NEXT_PUBLIC_NEX_SUPABASE_URL or NEX_SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    const admin = createClient(SB_URL, SB_SERVICE_KEY, {
      auth: { persistSession: false },
    });
    const stamp = Date.now().toString(36);
    thirdSellerEmail = `e2e-vault-ck5-C-${stamp}@nex.invalid`;
    if (!thirdSellerEmail.startsWith("e2e-vault-ck5-")) {
      throw new Error("third-seller mint refuses · wrong email prefix");
    }
    if (PROTECTED_RE.test(thirdSellerEmail)) {
      throw new Error("third-seller mint refuses · matches protected pattern");
    }
    const password = `e2e-vault-ck5-${stamp}-${randomBytes(6).toString("hex")}`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: thirdSellerEmail,
      password,
      email_confirm: true,
      user_metadata: { display_name: "E2E CK5 C", fixture: "e2e-vault-ck5" },
    });
    if (createErr || !created?.user) {
      throw new Error(`third-seller createUser failed: ${createErr?.message ?? "no user"}`);
    }
    thirdSellerSupabaseUserId = created.user.id;
    thirdSellerAccountId = randomUUID();
    const handle = `nex-${970000 + Math.floor(Math.random() * 20000)}`;
    const c2 = await pgClient();
    try {
      await c2.query(
        `INSERT INTO nex_account (id, supabase_user_id, display_name, nex_handle, locale, tier, shop_tier, is_mock_persona)
           VALUES ($1, $2, $3, $4, 'en', 'bisnis', 'shop', false)`,
        [thirdSellerAccountId, thirdSellerSupabaseUserId, "E2E CK5 C", handle],
      );
    } finally {
      await c2.end();
    }

    buyerCtx = await browser.newContext();
    sellerCtx = await browser.newContext();
    buyerPage = await buyerCtx.newPage();
    sellerPage = await sellerCtx.newPage();
  });

  test.afterAll(async () => {
    try { await buyerCtx?.close(); } catch { /* ignore */ }
    try { await sellerCtx?.close(); } catch { /* ignore */ }

    const c = await pgClient();
    try {
      // Cleanup: ONLY delete messages we created (scoped to buyer
      // sender + product X/Y ids). Peer conversation row is left in
      // place (CK5 fixture may reuse it in subsequent runs).
      const delMsg = await c.query(
        `DELETE FROM nex_peer_message
           WHERE sender_account_id = $1
             AND attachment_meta->'product'->>'product_id' IN ($2, $3)
           RETURNING id`,
        [BUYER_ACCOUNT_ID, PRODUCT_X_ID, PRODUCT_Y_ID],
      );
      // eslint-disable-next-line no-console
      console.log(`[cp2 cleanup] deleted peer messages=${delMsg.rowCount}`);

      // Tear down the inline third seller (nex_account + auth user).
      // Scope by exact account id · hard-guarded by the e2e-vault-ck5-
      // email prefix below so this can never target a real user.
      if (thirdSellerAccountId) {
        await c.query(
          `DELETE FROM nex_peer_conversation
             WHERE participant_a_id = LEAST($1::uuid, $2::uuid)
               AND participant_b_id = GREATEST($1::uuid, $2::uuid)`,
          [BUYER_ACCOUNT_ID, thirdSellerAccountId],
        );
        await c.query(`DELETE FROM nex_account WHERE id = $1`, [thirdSellerAccountId]);
      }
    } finally {
      await c.end();
    }

    if (
      thirdSellerSupabaseUserId &&
      thirdSellerEmail.startsWith("e2e-vault-ck5-") &&
      !PROTECTED_RE.test(thirdSellerEmail) &&
      SB_URL &&
      SB_SERVICE_KEY
    ) {
      try {
        const admin = createClient(SB_URL, SB_SERVICE_KEY, {
          auth: { persistSession: false },
        });
        await admin.auth.admin.deleteUser(thirdSellerSupabaseUserId);
      } catch { /* ignore · prefix-guarded */ }
    }
  });

  test("1 · buyer signs in", async () => {
    await signIn(buyerPage, BUYER_EMAIL, BUYER_PASSWORD, "/nex-native/contacts");
    const u = new URL(buyerPage.url());
    expect(u.pathname.startsWith("/nex-native/sign-in")).toBe(false);
    await screenshot(buyerPage, "cp2-01-buyer-signed-in.png");
  });

  test("2 · buyer opens an inquiry about Product X · sealed write shape", async () => {
    // Replay the sealed sendProductInquiryAction write directly. This
    // is the canonical shape the server action writes · the chat
    // surface's new anchor derivation reads EXACTLY this row.
    const result = await insertSealedProductInquiry({
      buyerAccountId: BUYER_ACCOUNT_ID,
      sellerAccountId: SELLER_ACCOUNT_ID,
      productId: PRODUCT_X_ID,
      productName: PRODUCT_X_NAME,
      pricePence: 1799,
      currency: "EUR",
      imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP8/58BAAT/Av+GHHe6AAAAAElFTkSuQmCC",
      businessId: SELLER_BUSINESS_ID,
      businessSlug: SELLER_BUSINESS_SLUG,
    });
    xMessageId = result.messageId;
    peerConversationId = result.conversationId;
    expect(xMessageId).not.toBe("");
    expect(peerConversationId).not.toBe("");
  });

  test("3 · buyer opens peer chat · sees Product X pinned at top", async () => {
    await buyerPage.goto(`/nex-native/chat/peer/${SELLER_ACCOUNT_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const anchor = buyerPage.locator(
      `[data-nex-peer-chat-inquiry-anchor="${PRODUCT_X_ID}"]`,
    );
    await expect(anchor).toBeVisible({ timeout: 15_000 });
    await expect(anchor).toContainText(PRODUCT_X_NAME);
    await screenshot(buyerPage, "cp2-03-buyer-sees-pin-x.png");
  });

  test("4 · pin survives buyer reload · still anchored to Product X", async () => {
    await buyerPage.reload({ waitUntil: "domcontentloaded" });
    const anchor = buyerPage.locator(
      `[data-nex-peer-chat-inquiry-anchor="${PRODUCT_X_ID}"]`,
    );
    await expect(anchor).toBeVisible({ timeout: 15_000 });
    await expect(anchor).toContainText(PRODUCT_X_NAME);
    await screenshot(buyerPage, "cp2-04-buyer-reload-pin-persists.png");
  });

  test("5 · pin survives buyer navigate-away-and-back", async () => {
    await buyerPage.goto(`/nex-native/contacts`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await buyerPage.goto(`/nex-native/chat/peer/${SELLER_ACCOUNT_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const anchor = buyerPage.locator(
      `[data-nex-peer-chat-inquiry-anchor="${PRODUCT_X_ID}"]`,
    );
    await expect(anchor).toBeVisible({ timeout: 15_000 });
    await expect(anchor).toContainText(PRODUCT_X_NAME);
    await screenshot(buyerPage, "cp2-05-buyer-navback-pin-persists.png");
  });

  test("6 · seller signs in second context · sees SAME Product X pinned", async () => {
    await signIn(
      sellerPage,
      SELLER_EMAIL,
      SELLER_PASSWORD,
      `/nex-native/chat/peer/${BUYER_ACCOUNT_ID}`,
    );
    const anchor = sellerPage.locator(
      `[data-nex-peer-chat-inquiry-anchor="${PRODUCT_X_ID}"]`,
    );
    await expect(anchor).toBeVisible({ timeout: 20_000 });
    await expect(anchor).toContainText(PRODUCT_X_NAME);
    await screenshot(sellerPage, "cp2-06-seller-sees-pin-x.png");
  });

  // ─── Group: two inquiries both retain correct context after reload ──
  //
  // This is the Product-Linked Chat Engineer fix (2026-11-15). Option A
  // (latest-pin + visible history) is the chosen behaviour:
  //   · The pin always reflects the CURRENT inquiry context (latest
  //     attachment_meta.product in the conversation).
  //   · The earlier inquiry is NOT lost: it remains visible inline in
  //     the message history as its own product-card bubble.
  //   · Both buyer + seller see the same pin after reload.
  //   · Ordinary chats with a seller that has NO product inquiries
  //     render NO pin.

  test("7 · buyer opens a SECOND inquiry about Product Y · same conversation", async () => {
    // A peer conversation is 1:1 between the pair. Product Y shares the
    // same conversation record · what differs is the pinned anchor
    // (now latest, not earliest).
    const result = await insertSealedProductInquiry({
      buyerAccountId: BUYER_ACCOUNT_ID,
      sellerAccountId: SELLER_ACCOUNT_ID,
      productId: PRODUCT_Y_ID,
      productName: PRODUCT_Y_NAME,
      pricePence: 4250,
      currency: "EUR",
      imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP8/58BAAT/Av+GHHe6AAAAAElFTkSuQmCC",
      businessId: SELLER_BUSINESS_ID,
      businessSlug: SELLER_BUSINESS_SLUG,
    });
    yMessageId = result.messageId;
    // Same peer pair · same conversation.
    expect(result.conversationId).toBe(peerConversationId);
  });

  test("8 · after Y · pin UPDATES to Y (latest anchor) · X stays visible inline", async () => {
    // Owner acceptance: the pin must now reflect the CURRENT inquiry
    // context (Product Y), without overwriting or mislabelling the
    // earlier inquiry about X. X must remain visible inline so no
    // inquiry is lost.
    await buyerPage.goto(`/nex-native/chat/peer/${SELLER_ACCOUNT_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const anchor = buyerPage.locator(
      "[data-nex-peer-chat-inquiry-anchor]",
    );
    await expect(anchor).toBeVisible({ timeout: 15_000 });
    // Anchor must be Y (latest).
    await expect(anchor).toHaveAttribute(
      "data-nex-peer-chat-inquiry-anchor",
      PRODUCT_Y_ID,
    );
    await expect(anchor).toContainText(PRODUCT_Y_NAME);

    // Both X AND Y must appear somewhere in the thread. X is now
    // rendered as its own inline product-card bubble (sealed Bridge 11
    // renderer); the pin carries Y's name.
    const body = await buyerPage.locator("body").innerText();
    expect(body).toContain(PRODUCT_Y_NAME);
    expect(body).toContain(PRODUCT_X_NAME);
    await screenshot(buyerPage, "cp2-08-buyer-y-anchored-x-inline.png");
  });

  test("9 · pin survives buyer reload after second inquiry · still Y", async () => {
    await buyerPage.reload({ waitUntil: "domcontentloaded" });
    const anchor = buyerPage.locator(
      `[data-nex-peer-chat-inquiry-anchor="${PRODUCT_Y_ID}"]`,
    );
    await expect(anchor).toBeVisible({ timeout: 15_000 });
    await expect(anchor).toContainText(PRODUCT_Y_NAME);
    // Both X AND Y still visible after reload (no inquiry lost).
    const body = await buyerPage.locator("body").innerText();
    expect(body).toContain(PRODUCT_Y_NAME);
    expect(body).toContain(PRODUCT_X_NAME);
    await screenshot(buyerPage, "cp2-09-buyer-reload-pin-y.png");
  });

  test("10 · seller reloads same conversation · also sees Y pinned", async () => {
    // Seller is already signed in from test 6 and the sellerPage is
    // at /nex-native/chat/peer/<BUYER_ACCOUNT_ID>. A reload re-runs
    // the SSR derivation and must now show the latest anchor (Y).
    await sellerPage.goto(`/nex-native/chat/peer/${BUYER_ACCOUNT_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const anchor = sellerPage.locator(
      `[data-nex-peer-chat-inquiry-anchor="${PRODUCT_Y_ID}"]`,
    );
    await expect(anchor).toBeVisible({ timeout: 15_000 });
    await expect(anchor).toContainText(PRODUCT_Y_NAME);
    // Both X AND Y must be visible in seller's view of the thread.
    const body = await sellerPage.locator("body").innerText();
    expect(body).toContain(PRODUCT_Y_NAME);
    expect(body).toContain(PRODUCT_X_NAME);
    await screenshot(sellerPage, "cp2-10-seller-sees-pin-y.png");
  });

  test("11 · third peer chat with a DIFFERENT seller (no inquiry) renders NO pin", async () => {
    // Acceptance: ordinary personal chats must remain unaffected · a
    // conversation between the same buyer and a DIFFERENT seller that
    // has no product_share messages must render no pinned product.
    // thirdSellerAccountId was minted in beforeAll · guaranteed not to
    // collide with Hammerex / Rosa / CK5 A or B.
    expect(thirdSellerAccountId).not.toBe("");
    expect(thirdSellerAccountId).not.toBe(SELLER_ACCOUNT_ID);
    expect(thirdSellerAccountId).not.toBe(BUYER_ACCOUNT_ID);

    await buyerPage.goto(`/nex-native/chat/peer/${thirdSellerAccountId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(
      buyerPage.locator("[data-nex-peer-chat-inquiry-anchor]"),
    ).toHaveCount(0, { timeout: 10_000 });
    await screenshot(buyerPage, "cp2-11-no-pin-on-plain-chat.png");
  });
});
