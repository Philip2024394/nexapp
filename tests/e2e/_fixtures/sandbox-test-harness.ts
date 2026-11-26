// tests/e2e/_fixtures/sandbox-test-harness.ts
//
// SANDBOX-ONLY Playwright fixture harness · authored 2026-11-25 under
// owner approval for T5-T10 journey coverage.
// ---------------------------------------------------------------------
// Shape:
//   · One module exposes four primitives:
//       - assertSandboxRef()        · sealed ref guard
//       - supabaseAdmin()           · service-role client (sandbox only)
//       - withPgClient(fn)          · pooler-URL direct Postgres client
//       - resolveSandboxDbUrl()     · pooler-URL resolution with ref guard
//   · And four lifecycle helpers:
//       - createTestAccount(label)  · auth.admin.createUser + nex_account
//       - createTestBusiness(acc, …) · nex_business
//       - createTestProduct(biz, …)  · nex_product
//       - teardownAll(handles)      · cleans in reverse FK order
//   · Each handle carries its uniquely-identifiable test marker so the
//     harness can detect leaked fixtures from prior failed runs and
//     reclaim them (`reclaimAbandonedTestRecords`).
//
// Safety invariants (any violation throws before any write):
//   1. assertSandboxRef() runs at module boundaries. The sealed prod
//      ref `ijvqdvsvwtwxzcqmoqit` is a hard-stop. An unknown ref is
//      also a hard-stop.
//   2. Every created record carries an `e2e-fixture-<nanoid>` marker in
//      display_name / name / slug / email, so leaked rows are obvious
//      in `SELECT * FROM nex_business WHERE slug LIKE 'e2e-fixture-%'`.
//   3. Teardown runs reverse-FK order: nex_product → nex_business →
//      nex_account (DELETE row, which cascades auth.users via FK).
//   4. Cleanup is unconditional in `finally` blocks of consuming specs.
//     `teardownAll` tolerates individual delete failures (logs + proceeds)
//     so one bad row does not strand the rest.
//   5. RLS is honoured. Writes go through the service-role admin client
//      (bypasses RLS by design), but nothing in this harness mutates
//      RLS policies, grants, or role memberships.
//   6. Never logs secrets, cookie values, or credential material.
//
// Boundaries honoured from the 2026-11-25 approval:
//   · No weakening of RLS or application permissions.
//   · No real payment credentials, no real charges.
//   · Uniquely identifiable test records only.
//   · Failed tests still trigger cleanup (consumer MUST wrap in
//     try/finally — see README in this directory).
// ---------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Sealed project refs — these are PUBLIC identifiers and not secrets.
const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";

/** Read a single key from `.env.local`. Strips surrounding quotes. Never logs. */
function envVar(name: string): string {
  const raw = readFileSync("./.env.local", "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} missing from .env.local`);
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v;
}

/**
 * Expose the sandbox Supabase URL + anon key for specs that need to
 * exercise the public/anon REST surface (e.g. RLS leak probes). Never
 * logs. The anon key is a public identifier; the service-role key is
 * NOT exposed through this harness.
 */
export function sandboxSupabaseUrl(): string {
  return envVar("NEXT_PUBLIC_NEX_SUPABASE_URL");
}

export function sandboxAnonKey(): string | null {
  try {
    return envVar("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
  } catch {
    try {
      return envVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    } catch {
      return null;
    }
  }
}

/** Hard-stop if NEXT_PUBLIC_NEX_SUPABASE_URL is prod or unknown. */
export function assertSandboxRef(): void {
  const url = envVar("NEXT_PUBLIC_NEX_SUPABASE_URL");
  const ref = new URL(url).hostname.split(".")[0];
  if (ref === PROD_REF) {
    throw new Error("STOP · production Supabase ref detected · harness refuses to run");
  }
  if (ref !== SANDBOX_REF) {
    throw new Error(`STOP · unknown Supabase ref '${ref}' · harness refuses to run`);
  }
}

/**
 * Prefer the pooler URL (`DATABASE_URL`) when its username-encoded ref
 * matches the sealed sandbox ref. The direct URL `SANDBOX_DATABASE_URL`
 * is IPv6-only on Supabase projects without the IPv4 add-on and times
 * out from IPv4-only hosts.
 */
export function resolveSandboxDbUrl(): string {
  try {
    const pooler = envVar("DATABASE_URL");
    const u = new URL(pooler);
    const dotIdx = u.username.indexOf(".");
    const refInUser = dotIdx > -1 ? u.username.slice(dotIdx + 1) : "";
    if (refInUser === SANDBOX_REF) return pooler;
  } catch {
    // fall through to direct URL
  }
  return envVar("SANDBOX_DATABASE_URL");
}

export function supabaseAdmin(): SupabaseClient {
  assertSandboxRef();
  return createClient(
    envVar("NEXT_PUBLIC_NEX_SUPABASE_URL"),
    envVar("NEX_SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function withPgClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  assertSandboxRef();
  const c = new Client({ connectionString: resolveSandboxDbUrl() });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

// ---------------------------------------------------------------------
// Fixture handles
// ---------------------------------------------------------------------

/** Nano-ish unique id · time-based with a short random tail. No crypto. */
function fixtureSuffix(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 7);
  return `${t}-${r}`;
}

/** Marker that proves a row was created by this harness. */
export const E2E_FIXTURE_PREFIX = "e2e-fixture-";

/** Shape of a created test account. */
export interface TestAccountHandle {
  readonly kind: "account";
  readonly supabaseUserId: string;
  readonly nexAccountId: string;
  readonly email: string;
  readonly displayName: string;
}

/** Shape of a created test business. */
export interface TestBusinessHandle {
  readonly kind: "business";
  readonly businessId: string;
  readonly ownerAccountId: string;
  readonly slug: string;
  readonly displayName: string;
}

/** Shape of a created test product. */
export interface TestProductHandle {
  readonly kind: "product";
  readonly productId: string;
  readonly businessId: string;
  readonly name: string;
}

/** Shape of a created test order (mig 005 · nex_order). */
export interface TestOrderHandle {
  readonly kind: "order";
  readonly orderId: string;
  readonly customerAccountId: string;
  readonly businessId: string;
  readonly productId: string;
  readonly pricePence: number;
  readonly currency: string;
  readonly state:
    | "created"
    | "pending"
    | "paid"
    | "completed"
    | "cancelled"
    | "refunded";
}

/**
 * Shape of a seeded chat-peer fixture · one nex_peer_conversation row
 * + one nex_peer_message row with an embedded product snapshot on
 * attachment_meta.product (per mig 059 · attachment_type stays NULL
 * because the sealed CHECK on attachment_type does not accept
 * 'product'; the shell detects product bubbles via meta presence).
 *
 * The underlying FK graph CASCADES on nex_account delete, so the
 * standard teardownAll(handles) path removes the conversation +
 * message implicitly when the merchant/peer accounts are torn down.
 * We expose handles here so specs can address the rows directly
 * (for example to assert SSR text contains the bubble's messageId).
 */
export interface ChatPeerHandle {
  readonly kind: "chat-peer";
  readonly conversationId: string;
  readonly merchantAccountId: string;
  readonly peerAccountId: string;
  readonly messageId: string;
  readonly messageSentAtIso: string;
  readonly messageBodyPricePence: number;
  readonly messageBodyCurrency: "IDR" | "GBP" | "USD";
}

export type FixtureHandle =
  | TestAccountHandle
  | TestBusinessHandle
  | TestProductHandle
  | TestOrderHandle
  | ChatPeerHandle;

// ---------------------------------------------------------------------
// Create: fresh test account
// ---------------------------------------------------------------------

/**
 * Creates an auth user via admin API, then inserts the matching
 * nex_account row (admin trigger may or may not exist · we create
 * explicitly for determinism).
 *
 * Email: `e2e-fixture-<suffix>@sandbox.invalid` — never a real inbox.
 * Password: random per invocation. By default NOT returned (kept
 * opaque). Pass `{ returnPassword: true }` to retrieve it · required
 * only by browser-side sign-in helpers like signInAsFixtureInBrowser
 * which must drive the sealed sign-in form end-to-end. The password
 * is never logged and lives only in test-process memory.
 */
export async function createTestAccount(
  labelOrOpts?: string | { label?: string; returnPassword?: boolean },
  _legacyReturnPassword?: never,
): Promise<TestAccountHandle & { _password?: string }> {
  assertSandboxRef();
  const sb = supabaseAdmin();
  const suffix = fixtureSuffix();
  const label =
    typeof labelOrOpts === "string"
      ? labelOrOpts
      : (labelOrOpts?.label ?? "");
  const returnPassword =
    typeof labelOrOpts === "object" && labelOrOpts?.returnPassword === true;
  const slug = label
    ? `${E2E_FIXTURE_PREFIX}${label}-${suffix}`
    : `${E2E_FIXTURE_PREFIX}${suffix}`;
  const email = `${slug}@sandbox.invalid`;
  const displayName = `E2E Fixture ${label || suffix}`;
  // Short-lived password: returned only when the caller opts in.
  const password = `TestPass!${suffix}!${Math.random().toString(36).slice(2, 10)}`;

  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { fixture: true, label },
  });
  if (createErr || !created?.user?.id) {
    throw new Error(
      `createTestAccount: auth.admin.createUser failed · ${createErr?.message ?? "no user returned"}`,
    );
  }
  const supabaseUserId = created.user.id;

  // Insert the nex_account row via service-role (bypasses RLS by design).
  // The "created" supabase user id is unique and the FK target.
  const { data: accRow, error: accErr } = await sb
    .from("nex_account")
    .insert({ supabase_user_id: supabaseUserId, display_name: displayName })
    .select("id")
    .single();
  if (accErr || !accRow?.id) {
    // Rollback: delete the orphan auth user before surfacing.
    await sb.auth.admin.deleteUser(supabaseUserId).catch(() => undefined);
    throw new Error(
      `createTestAccount: insert nex_account failed · ${accErr?.message ?? "no row returned"}`,
    );
  }

  const handle: TestAccountHandle & { _password?: string } = {
    kind: "account",
    supabaseUserId,
    nexAccountId: accRow.id as string,
    email,
    displayName,
  };
  if (returnPassword) handle._password = password;
  return handle;
}

// ---------------------------------------------------------------------
// Browser-side sign-in helper (2026-11-26 · T5 real journey enablement)
// ---------------------------------------------------------------------

/**
 * Drives the sealed sign-in form (`data-nex-sign-in-form`) for a fixture
 * account so Playwright specs can exercise real authenticated journeys
 * (not just DB-contract checks). This does NOT weaken authentication:
 * it uses the same `signInAction` path a normal user takes, with a
 * password we just created in-process. No bypass of RLS, no bypass of
 * email confirmation (fixtures are born with `email_confirm: true`),
 * no bypass of the dev-server's sandbox-only env guard.
 *
 * Returns nothing · success is observed by the caller via the resulting
 * URL + cookie state. Throws if a sign-in banner appears.
 *
 * Caller contract:
 *   · Must pass a handle created with `createTestAccount({ returnPassword: true })`.
 *   · Playwright context is used exclusively · no side channel.
 *   · Never logs the password.
 */
export async function signInAsFixtureInBrowser(
  page: import("@playwright/test").Page,
  account: TestAccountHandle & { _password?: string },
): Promise<void> {
  if (!account._password) {
    throw new Error(
      "signInAsFixtureInBrowser · handle has no _password · create the " +
        "account with `createTestAccount({ returnPassword: true })`",
    );
  }
  assertSandboxRef();
  await page.goto("/nex-native/sign-in", { waitUntil: "domcontentloaded" });
  // The form is on the sign-in route; find it by data attr.
  const form = page.locator("[data-nex-sign-in-form]").first();
  await form.waitFor({ state: "visible", timeout: 10_000 });
  // Fill fields by name attribute (sealed in page.tsx).
  await form.locator('input[name="email"]').fill(account.email);
  await form.locator('input[name="password"]').fill(account._password);
  // Submit via the sealed submit button and wait for redirect off sign-in.
  await Promise.all([
    page.waitForURL(
      (u) => !/\/nex-native\/sign-in(?:[/?#]|$)/.test(u.pathname),
      { timeout: 20_000, waitUntil: "domcontentloaded" },
    ),
    page.locator("[data-nex-sign-in-submit]").first().click(),
  ]);
  // If the server bounced us back with an error, surface the banner.
  const banner = page.locator("[data-nex-sign-in-banner]");
  if ((await banner.count()) > 0) {
    const code = (await banner.first().getAttribute("data-nex-sign-in-banner")) ?? "unknown";
    throw new Error(
      `signInAsFixtureInBrowser · sign-in failed · banner code='${code}'`,
    );
  }
}

// ---------------------------------------------------------------------
// Seed: fixture-account device key (2026-11-26 · T7 success-path
// enablement, owner-approved priority 1 fix)
// ---------------------------------------------------------------------

/**
 * Publishes a public device key for a fixture account into
 * `nex_account_device_key`. This simulates the precondition that a real
 * merchant has previously opened NEX once — the sealed
 * `sendEncryptedBusinessMessage` path returns `no_peer_devices` without
 * at least one key on the recipient side, and that message surfaces to
 * the buyer as *"This shop hasn't set up encryption yet"*.
 *
 * Why this does NOT weaken encryption, authentication, or privacy:
 *   · Only the PUBLIC half of a 32-byte NaCl X25519 keypair is written
 *     to the DB (the same shape `upsertDeviceKeyAction` accepts, same
 *     table, same unique-key constraint on `(account_id, device_id)`).
 *   · The matching private key exists only transiently in test-process
 *     memory and is DISCARDED on return — the fixture merchant truly
 *     cannot decrypt anything, which is the honest post-condition for
 *     a "merchant set up keys once but is offline during this test"
 *     scenario. RLS unchanged; no bypass of client-side encryption.
 *   · The fixture buyer side already has published device keys via
 *     the real Dev Pass sign-in (`auth.setup.ts`) which lands on
 *     /free-chat and mounts DeviceKeyHub as a normal user would. We
 *     only ever seed the peer side here.
 *   · Written through service-role admin, same pattern as every other
 *     harness write. assertSandboxRef() runs first so this is
 *     structurally impossible to execute against production.
 *
 * Returned `deviceId` lets the caller assert the row exists / is
 * cleaned up. Never log it; it is non-secret but still fixture state.
 */
export async function seedDeviceKeyForFixtureAccount(
  account: TestAccountHandle,
): Promise<{ deviceId: string; publicKey: string }> {
  assertSandboxRef();
  const sb = supabaseAdmin();
  // 32 random bytes is a syntactically valid X25519 public key (any
  // 32-byte value is a valid Curve25519 point after clamping on the
  // private half, which is not performed on the public side). We never
  // retain the matching private key — the fixture merchant cannot
  // decrypt, which is the correct honest state.
  const publicKey = randomBytes(32).toString("base64");
  const deviceId = randomUUID();
  const now = new Date().toISOString();
  const { error } = await sb
    .from("nex_account_device_key")
    .upsert(
      {
        account_id: account.nexAccountId,
        device_id: deviceId,
        public_key: publicKey,
        last_seen_at: now,
      },
      { onConflict: "account_id,device_id" },
    );
  if (error) {
    throw new Error(
      `seedDeviceKeyForFixtureAccount: upsert nex_account_device_key failed · ${error.message}`,
    );
  }
  return { deviceId, publicKey };
}

// ---------------------------------------------------------------------
// Create: test business
// ---------------------------------------------------------------------

export async function createTestBusiness(
  owner: TestAccountHandle,
  opts: { label?: string } = {},
): Promise<TestBusinessHandle> {
  assertSandboxRef();
  const sb = supabaseAdmin();
  const suffix = fixtureSuffix();
  const label = opts.label ?? "";
  // nex_business.slug check: `^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?$`
  const slugRaw = label
    ? `${E2E_FIXTURE_PREFIX}${label}-${suffix}`
    : `${E2E_FIXTURE_PREFIX}${suffix}`;
  const slug = slugRaw.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60);
  const displayName = `E2E Fixture Business ${label || suffix}`;

  const { data: bizRow, error: bizErr } = await sb
    .from("nex_business")
    .insert({
      owner_account_id: owner.nexAccountId,
      display_name: displayName,
      slug,
    })
    .select("id")
    .single();
  if (bizErr || !bizRow?.id) {
    throw new Error(
      `createTestBusiness: insert nex_business failed · ${bizErr?.message ?? "no row returned"}`,
    );
  }

  return {
    kind: "business",
    businessId: bizRow.id as string,
    ownerAccountId: owner.nexAccountId,
    slug,
    displayName,
  };
}

// ---------------------------------------------------------------------
// Create: test product
// ---------------------------------------------------------------------

export async function createTestProduct(
  business: TestBusinessHandle,
  opts: {
    name?: string;
    pricePence?: number;
    currency?: string;
    status?: "draft" | "live" | "archived";
    departmentId?: string;
    categoryId?: string;
  } = {},
): Promise<TestProductHandle> {
  assertSandboxRef();
  const sb = supabaseAdmin();
  const suffix = fixtureSuffix();
  const name = opts.name ?? `${E2E_FIXTURE_PREFIX}product-${suffix}`;
  const pricePence = opts.pricePence ?? 999;
  const currency = opts.currency ?? "GBP";
  const status = opts.status ?? "live";
  // Migration 239 added NOT NULL department_id + category_id to nex_product
  // with a CHECK constraint against the sealed 30-dept taxonomy
  // (src/lib/nex-native/catalogue/departments.ts). The sealed fallback
  // values are `everything_else` / `other`. Callers can override via opts.
  const departmentId = opts.departmentId ?? "everything_else";
  const categoryId = opts.categoryId ?? "other";

  const { data: prodRow, error: prodErr } = await sb
    .from("nex_product")
    .insert({
      business_id: business.businessId,
      name,
      price_pence: pricePence,
      currency,
      status,
      department_id: departmentId,
      category_id: categoryId,
    })
    .select("id")
    .single();
  if (prodErr || !prodRow?.id) {
    throw new Error(
      `createTestProduct: insert nex_product failed · ${prodErr?.message ?? "no row returned"}`,
    );
  }

  return {
    kind: "product",
    productId: prodRow.id as string,
    businessId: business.businessId,
    name,
  };
}

// ---------------------------------------------------------------------
// Create: test order (mig 005 · nex_order)
// ---------------------------------------------------------------------

/**
 * Creates a nex_order row via service-role admin (bypasses RLS by
 * Supabase design). Price + currency snapshot is captured from the
 * supplied TestProductHandle at call time, matching the sealed order-
 * creation semantics (mig 005 · "Frozen snapshots · captured at INSERT
 * · NEVER updated after creation"). The initial `state` defaults to
 * `created` — that's the only legal starting state per mig 005 CHECK.
 *
 * A matching nex_order_event row is NOT inserted here · the sealed
 * contract says "every transition writes an event row" and admin
 * creation is service-role-only. Consumers that assert the event trail
 * should insert the 'created' event themselves via admin (an ORM-level
 * trigger does not exist for this table per mig 005 · see 322/355/etc
 * for evolving event conventions).
 */
export async function createTestOrder(
  customer: TestAccountHandle,
  business: TestBusinessHandle,
  product: TestProductHandle,
  opts: {
    pricePence?: number;
    currency?: string;
    state?: TestOrderHandle["state"];
    sourceConversationId?: string | null;
    idempotencyKey?: string;
  } = {},
): Promise<TestOrderHandle> {
  assertSandboxRef();
  const sb = supabaseAdmin();
  const pricePence = opts.pricePence ?? 999;
  const currency = opts.currency ?? "GBP";
  const state = opts.state ?? "created";

  const insertPayload: Record<string, unknown> = {
    customer_account_id: customer.nexAccountId,
    business_id: business.businessId,
    product_id: product.productId,
    price_pence: pricePence,
    currency,
    state,
  };
  if (opts.sourceConversationId !== undefined) {
    insertPayload.source_conversation_id = opts.sourceConversationId;
  }
  if (opts.idempotencyKey !== undefined) {
    insertPayload.idempotency_key = opts.idempotencyKey;
  }

  const { data: ordRow, error: ordErr } = await sb
    .from("nex_order")
    .insert(insertPayload)
    .select("id")
    .single();
  if (ordErr || !ordRow?.id) {
    throw new Error(
      `createTestOrder: insert nex_order failed · ${ordErr?.message ?? "no row returned"}`,
    );
  }

  return {
    kind: "order",
    orderId: ordRow.id as string,
    customerAccountId: customer.nexAccountId,
    businessId: business.businessId,
    productId: product.productId,
    pricePence,
    currency,
    state,
  };
}

// ---------------------------------------------------------------------
// Chat peer helpers (2026-11-27 · L-043 Portrait Bloom hydration
// regression enablement)
// ---------------------------------------------------------------------

/**
 * Create a `nex_peer_conversation` between two fixture accounts.
 *
 * Writes through the service-role admin client (bypasses RLS by
 * design, same pattern as every other harness write). The CHECK
 * constraint `participant_a_id < participant_b_id` (mig 047) is
 * honoured by UUID string-sort below so the insert never fails on
 * the ordered-pair invariant.
 *
 * Does NOT weaken RLS, encryption, or ownership. The resulting row
 * is still read-gated by the sealed participant policies on
 * nex_peer_conversation and nex_peer_message · the browser session
 * that reads it must be one of the two participants. Device-only
 * chat storage + E2E encryption are unaffected · this row stays
 * plaintext (encrypted=false by default) which is the legacy mode
 * the shell happily renders when no device keys are present.
 */
export async function createTestConversation(
  merchant: TestAccountHandle,
  peer: TestAccountHandle,
): Promise<{
  conversationId: string;
  participantAId: string;
  participantBId: string;
}> {
  assertSandboxRef();
  const sb = supabaseAdmin();
  // Canonical ordering · mig 047 CHECK requires strict string-sort.
  const [a, b] = [merchant.nexAccountId, peer.nexAccountId].sort();
  const { data, error } = await sb
    .from("nex_peer_conversation")
    .insert({ participant_a_id: a, participant_b_id: b })
    .select("id")
    .single();
  if (error || !data?.id) {
    throw new Error(
      `createTestConversation: insert nex_peer_conversation failed · ${error?.message ?? "no row returned"}`,
    );
  }
  return {
    conversationId: data.id as string,
    participantAId: a,
    participantBId: b,
  };
}

/**
 * Insert a single plaintext `nex_peer_message` row into an existing
 * conversation. `encrypted=false` keeps the row in the legacy
 * plaintext mode that pre-dates mig 093; the sealed
 * `nex_peer_message_encrypted_shape` CHECK is satisfied because all
 * ciphertext columns stay NULL (mig 093 lines 64-72). Body must be
 * non-empty because this row carries no attachment_url
 * (`nex_peer_message_body_or_attachment_check`, mig 054 line 72).
 *
 * `productSnapshot` is projected onto `attachment_meta.product` so
 * the shell's `attachment_product` branch (page.tsx:1004-1016)
 * resolves to a product bubble on render. `attachment_type` stays
 * NULL because the sealed CHECK (mig 306:56-59) allows NULL or
 * image/video/audio/call_invite · 'product' is intentionally
 * absent from that enum (product bubbles are meta-detected).
 *
 * `sent_at` is explicitly overridden so SSR vs. browser timezone
 * divergence is deterministic for the hydration regression.
 */
export async function createTestMessage(
  opts: {
    readonly conversationId: string;
    readonly sender: TestAccountHandle;
    readonly body: string;
    readonly sentAtIso: string;
    readonly productSnapshot?: {
      readonly product_id: string;
      readonly business_id: string;
      readonly business_slug: string | null;
      readonly name: string;
      readonly price_pence: number;
      readonly currency: string;
      readonly image_url: string | null;
      readonly short_description: string | null;
    };
  },
): Promise<{ messageId: string }> {
  assertSandboxRef();
  const sb = supabaseAdmin();
  const insertPayload: Record<string, unknown> = {
    conversation_id: opts.conversationId,
    sender_account_id: opts.sender.nexAccountId,
    body: opts.body,
    sent_at: opts.sentAtIso,
    encrypted: false,
  };
  if (opts.productSnapshot) {
    insertPayload.attachment_meta = { product: opts.productSnapshot };
  }
  const { data, error } = await sb
    .from("nex_peer_message")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !data?.id) {
    throw new Error(
      `createTestMessage: insert nex_peer_message failed · ${error?.message ?? "no row returned"}`,
    );
  }
  return { messageId: data.id as string };
}

/**
 * Composite helper that stitches together:
 *   1. createTestConversation(merchant, peer)
 *   2. createTestMessage(...) with an embedded product snapshot
 *      sized to trigger the L-043 group-separator hydration case
 *      (IDR 100,000,000 pence = Rp 1,000,000 · the comma-vs-dot
 *      locale divergence the fix pinned to "en-US").
 *
 * Returns a `ChatPeerHandle` compatible with `teardownAll` and the
 * residual-check contract. The standard teardown path deletes the
 * two fixture accounts last; both `nex_peer_conversation` and
 * `nex_peer_message` CASCADE on `nex_account.id` delete (mig 047:50,
 * 047:75-76), so the chat rows are cleaned implicitly. No special
 * handling is required in teardownAll beyond ignoring the
 * `"chat-peer"` kind.
 */
export async function seedChatPeer(opts: {
  readonly merchant: TestAccountHandle;
  readonly peer: TestAccountHandle;
  readonly businessId: string;
  readonly messageSentAtIso: string;
  readonly pricePence: number;
  readonly currency: "IDR" | "GBP" | "USD";
  /** Optional overrides · defaults produce a renderable product card. */
  readonly productName?: string;
  readonly productShortDescription?: string | null;
  readonly productImageUrl?: string | null;
  readonly businessSlug?: string | null;
  readonly body?: string;
}): Promise<ChatPeerHandle> {
  assertSandboxRef();
  const conv = await createTestConversation(opts.merchant, opts.peer);
  const productId = randomUUID();
  const { messageId } = await createTestMessage({
    conversationId: conv.conversationId,
    sender: opts.merchant,
    body: opts.body ?? "Hello from the fixture merchant.",
    sentAtIso: opts.messageSentAtIso,
    productSnapshot: {
      product_id: productId,
      business_id: opts.businessId,
      business_slug: opts.businessSlug ?? null,
      name: opts.productName ?? "Fixture product",
      price_pence: opts.pricePence,
      currency: opts.currency,
      image_url: opts.productImageUrl ?? null,
      short_description: opts.productShortDescription ?? null,
    },
  });
  return {
    kind: "chat-peer",
    conversationId: conv.conversationId,
    merchantAccountId: opts.merchant.nexAccountId,
    peerAccountId: opts.peer.nexAccountId,
    messageId,
    messageSentAtIso: opts.messageSentAtIso,
    messageBodyPricePence: opts.pricePence,
    messageBodyCurrency: opts.currency,
  };
}

// ---------------------------------------------------------------------
// Teardown · reverse FK order · tolerant
// ---------------------------------------------------------------------

/**
 * Deletes everything in the supplied handles in correct FK order.
 * Resilient: a failure on one row logs a warning and proceeds. The
 * intent is that a failed test must still end in a clean DB.
 *
 * Caller contract: pass handles in creation order; teardown reverses.
 */
export async function teardownAll(handles: FixtureHandle[]): Promise<void> {
  if (handles.length === 0) return;
  assertSandboxRef();
  const sb = supabaseAdmin();

  // Orders first — nex_order_event has FK RESTRICT on order_id and
  // nex_order has FK RESTRICT on product_id. Delete events then orders
  // before we attempt to delete the products or businesses they point at.
  //
  // Ledger cleanup extension (2026-11-26 · owner directive after T8 UI
  // loop surfaced `nex_ledger_entry_order_id_fkey` block). The
  // `commerce-service.markOrderPaid` action writes one `nex_ledger_entry`
  // and two `nex_ledger_line` rows per paid order; both FKs are
  // `ON DELETE RESTRICT`. If a spec marks an order paid (or completed)
  // the order delete would fail without first clearing lines then
  // entries. We use the service-role Supabase-js client because neither
  // ledger table carries an immutability trigger · a plain DELETE
  // suffices. The deletes are no-ops when the order had no ledger
  // activity, so this is safe to run for every order handle.
  const orders = handles.filter((h): h is TestOrderHandle => h.kind === "order");
  for (const o of orders) {
    // 1. Ledger lines (child of nex_ledger_entry) must go first.
    const { data: entryRows, error: entryFindErr } = await sb
      .from("nex_ledger_entry")
      .select("id")
      .eq("order_id", o.orderId);
    if (entryFindErr) {
      // eslint-disable-next-line no-console
      console.warn(
        `[teardown] ledger-entry lookup ${o.orderId}: ${entryFindErr.message}`,
      );
    }
    const entryIds = (entryRows ?? [])
      .map((r) => (r as { id: string }).id)
      .filter(Boolean);
    if (entryIds.length > 0) {
      const { error: lineErr } = await sb
        .from("nex_ledger_line")
        .delete()
        .in("entry_id", entryIds);
      if (lineErr) {
        // eslint-disable-next-line no-console
        console.warn(`[teardown] ledger lines ${o.orderId}: ${lineErr.message}`);
      }
      const { error: entryDelErr } = await sb
        .from("nex_ledger_entry")
        .delete()
        .in("id", entryIds);
      if (entryDelErr) {
        // eslint-disable-next-line no-console
        console.warn(
          `[teardown] ledger entries ${o.orderId}: ${entryDelErr.message}`,
        );
      }
    }

    // 2. Order events.
    const { error: evErr } = await sb
      .from("nex_order_event")
      .delete()
      .eq("order_id", o.orderId);
    if (evErr) {
      // eslint-disable-next-line no-console
      console.warn(`[teardown] order events ${o.orderId}: ${evErr.message}`);
    }
    // 3. Order row itself.
    const { error: ordErr } = await sb
      .from("nex_order")
      .delete()
      .eq("id", o.orderId);
    if (ordErr) {
      // eslint-disable-next-line no-console
      console.warn(`[teardown] order ${o.orderId}: ${ordErr.message}`);
    }
  }

  // Products next (no downstream FK issues after orders are gone).
  const products = handles.filter((h): h is TestProductHandle => h.kind === "product");
  for (const p of products) {
    const { error } = await sb.from("nex_product").delete().eq("id", p.productId);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(`[teardown] product ${p.productId}: ${error.message}`);
    }
  }

  // Businesses next — RESTRICT on products, so we must have deleted products
  // (of the same business) above. We do NOT try to cascade — leaked
  // products are a test bug, not something teardown should silently paper.
  //
  // Conversation cleanup (2026-11-26 · owner directive after T7 run
  // surfaced `nex_conversation_business_id_fkey` block). Flows like the
  // non-owner Ask Seller journey create a `nex_conversation` row with
  // `business_id = fixture_business.id` and append `nex_message` rows
  // under it. `nex_conversation.business_id` is ON DELETE RESTRICT and
  // `nex_message.conversation_id` is RESTRICT, so neither cascades on
  // business delete and leaves the business row stranded.
  //
  // Strict-ownership rule: we ONLY touch conversations whose business_id
  // is a fixture business we're tearing down. Never broad-delete user
  // conversations. nex_message carries no DELETE policy for any role but
  // service-role bypasses RLS by design, so admin DELETE succeeds.
  //
  // FKs that CASCADE on nex_conversation delete and do not need manual
  // work: nex_conversation_participant.conversation_id (CASCADE),
  // nex_generation_job.conversation_id (CASCADE). nex_order.
  // source_conversation_id is ON DELETE SET NULL. Only nex_message has
  // RESTRICT, so that is what the loop below handles.
  const businesses = handles.filter(
    (h): h is TestBusinessHandle => h.kind === "business",
  );
  if (businesses.length > 0) {
    const businessIds = businesses.map((b) => b.businessId);
    // 1. Find every conversation attached to our fixture businesses.
    const { data: convRows, error: convFindErr } = await sb
      .from("nex_conversation")
      .select("id")
      .in("business_id", businessIds);
    if (convFindErr) {
      // eslint-disable-next-line no-console
      console.warn(
        `[teardown] find conversations for fixture businesses: ${convFindErr.message}`,
      );
    }
    const convIds = (convRows ?? [])
      .map((r) => (r as { id: string }).id)
      .filter(Boolean);

    if (convIds.length > 0) {
      // 2. Delete messages for those conversations.
      //
      // 2026-11-26 · trigger-bypass fix for defect #74 priority-1 work.
      // nex_message carries a BEFORE DELETE trigger
      // (`trg_nex_message_no_delete` → nex_reject_message_mutation) that
      // enforces the sealed "messages are immutable" architectural
      // invariant. The trigger fires for every role including
      // Supabase service-role in standard operation, which is why the
      // earlier Supabase-js delete returned
      // *"nex_message is immutable · DELETE rejected"*.
      //
      // To clean up fixture conversations without weakening production
      // guarantees we open a direct pooled Postgres connection via
      // `withPgClient` (sandbox-ref-guarded) and wrap the DELETE in a
      // transaction with `SET LOCAL session_replication_role = replica`.
      // Postgres skips firing an "origin" trigger (`tgenabled='O'`)
      // when the session is in replica mode. The setting is scoped to
      // the transaction — the connection ends immediately after, and
      // nothing else in the project sees this mode change. The
      // immutability trigger continues to block every non-superuser
      // delete in every other context (REST, service-role via
      // Supabase-js, user sessions, API routes) and production is
      // completely unaffected (resolveSandboxDbUrl + assertSandboxRef
      // refuse to run against the sealed prod ref). This is sandbox
      // teardown only.
      try {
        await withPgClient(async (pg) => {
          await pg.query("BEGIN");
          await pg.query("SET LOCAL session_replication_role = replica");
          await pg.query(
            "DELETE FROM public.nex_message WHERE conversation_id = ANY($1::uuid[])",
            [convIds],
          );
          await pg.query("COMMIT");
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(
          `[teardown] messages for ${convIds.length} fixture conversations: ${(e as Error).message}`,
        );
      }

      // 3. Delete the conversations (participants + generation_jobs CASCADE).
      const { error: convDelErr } = await sb
        .from("nex_conversation")
        .delete()
        .in("id", convIds);
      if (convDelErr) {
        // eslint-disable-next-line no-console
        console.warn(
          `[teardown] conversations for fixture businesses: ${convDelErr.message}`,
        );
      }
    }
  }

  for (const b of businesses) {
    const { error } = await sb.from("nex_business").delete().eq("id", b.businessId);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(`[teardown] business ${b.businessId}: ${error.message}`);
    }
  }

  // Accounts last — RESTRICT on businesses. Delete nex_account first, then
  // auth.users (ON DELETE CASCADE on supabase_user_id triggers nothing in
  // the reverse direction, so we delete auth.users explicitly).
  //
  // Defence-in-depth (2026-11-26): if a fixture account is still a
  // participant in any non-fixture conversation (should not happen in
  // our current flows, but a stray leak would block account delete via
  // nex_conversation_participant.account_id RESTRICT or nex_message.
  // sender_account_id RESTRICT), surface + remove ONLY that account's
  // own rows. Strict-ownership rule honoured: never delete another
  // user's data, only the fixture account's own messages + own
  // participant rows. Peer-chat FKs CASCADE on nex_account delete so
  // nothing to do for nex_peer_* tables.
  const accounts = handles.filter(
    (h): h is TestAccountHandle => h.kind === "account",
  );
  for (const a of accounts) {
    // Remove fixture-account-owned messages in any remaining conversations
    // (business conversations whose business was NOT a fixture biz we
    // tore down above). nex_message has no DELETE policy; service-role
    // bypasses RLS by design.
    const { error: ownMsgErr } = await sb
      .from("nex_message")
      .delete()
      .eq("sender_account_id", a.nexAccountId);
    if (ownMsgErr) {
      // eslint-disable-next-line no-console
      console.warn(
        `[teardown] own messages for fixture account ${a.nexAccountId}: ${ownMsgErr.message}`,
      );
    }
    // Remove fixture-account participant rows (never touches other users).
    const { error: partErr } = await sb
      .from("nex_conversation_participant")
      .delete()
      .eq("account_id", a.nexAccountId);
    if (partErr) {
      // eslint-disable-next-line no-console
      console.warn(
        `[teardown] participant rows for fixture account ${a.nexAccountId}: ${partErr.message}`,
      );
    }

    // Remove any device_key rows seeded for this fixture account (T7
    // success-path enablement, 2026-11-26). A fixture account is the
    // ONLY owner of its device keys, so this touches no other user's
    // data. nex_account_device_key.account_id is RESTRICT; without
    // this delete the account row cannot be removed.
    const { error: dkErr } = await sb
      .from("nex_account_device_key")
      .delete()
      .eq("account_id", a.nexAccountId);
    if (dkErr) {
      // eslint-disable-next-line no-console
      console.warn(
        `[teardown] device_keys for fixture account ${a.nexAccountId}: ${dkErr.message}`,
      );
    }

    const { error: accErr } = await sb
      .from("nex_account")
      .delete()
      .eq("id", a.nexAccountId);
    if (accErr) {
      // eslint-disable-next-line no-console
      console.warn(`[teardown] nex_account ${a.nexAccountId}: ${accErr.message}`);
    }
    const r = await sb.auth.admin.deleteUser(a.supabaseUserId);
    if (r.error && !/not.?found/i.test(r.error.message)) {
      // eslint-disable-next-line no-console
      console.warn(`[teardown] auth user ${a.supabaseUserId}: ${r.error.message}`);
    }
  }
}

// ---------------------------------------------------------------------
// Post-teardown residual verification (quality gate, 2026-11-26)
// ---------------------------------------------------------------------

/**
 * Proves that every handle passed in was actually removed. Returns the
 * list of residual rows (empty = clean). Owner directive 2026-11-26:
 * a test that leaves fixture records behind is NOT a clean PASS.
 * Spec authors should assert the returned array is empty at the end of
 * each `finally` block.
 *
 * SELECT-only. Never deletes. Service-role so it sees everything.
 */
export async function assertNoResidualFixtures(
  handles: FixtureHandle[],
): Promise<{
  orders: string[];
  products: string[];
  businesses: string[];
  conversations: string[];
  participants: string[];
  messages: string[];
  deviceKeys: string[];
  accounts: string[];
  authUsers: string[];
}> {
  if (handles.length === 0) {
    return {
      orders: [],
      products: [],
      businesses: [],
      conversations: [],
      participants: [],
      messages: [],
      deviceKeys: [],
      accounts: [],
      authUsers: [],
    };
  }
  assertSandboxRef();
  const sb = supabaseAdmin();

  const orderIds = handles
    .filter((h): h is TestOrderHandle => h.kind === "order")
    .map((h) => h.orderId);
  const productIds = handles
    .filter((h): h is TestProductHandle => h.kind === "product")
    .map((h) => h.productId);
  const businessIds = handles
    .filter((h): h is TestBusinessHandle => h.kind === "business")
    .map((h) => h.businessId);
  const accountIds = handles
    .filter((h): h is TestAccountHandle => h.kind === "account")
    .map((h) => h.nexAccountId);
  const supabaseUserIds = handles
    .filter((h): h is TestAccountHandle => h.kind === "account")
    .map((h) => h.supabaseUserId);

  const residualOrders = orderIds.length
    ? ((await sb.from("nex_order").select("id").in("id", orderIds)).data ?? []).map(
        (r) => (r as { id: string }).id,
      )
    : [];
  const residualProducts = productIds.length
    ? (
        (await sb.from("nex_product").select("id").in("id", productIds)).data ?? []
      ).map((r) => (r as { id: string }).id)
    : [];
  const residualBusinesses = businessIds.length
    ? (
        (await sb.from("nex_business").select("id").in("id", businessIds)).data ?? []
      ).map((r) => (r as { id: string }).id)
    : [];
  const residualConversations = businessIds.length
    ? (
        (
          await sb
            .from("nex_conversation")
            .select("id")
            .in("business_id", businessIds)
        ).data ?? []
      ).map((r) => (r as { id: string }).id)
    : [];
  const residualParticipants = accountIds.length
    ? (
        (
          await sb
            .from("nex_conversation_participant")
            .select("conversation_id")
            .in("account_id", accountIds)
        ).data ?? []
      ).map((r) => (r as { conversation_id: string }).conversation_id)
    : [];
  const residualMessages = accountIds.length
    ? (
        (
          await sb
            .from("nex_message")
            .select("id")
            .in("sender_account_id", accountIds)
        ).data ?? []
      ).map((r) => (r as { id: string }).id)
    : [];
  const residualDeviceKeys = accountIds.length
    ? (
        (
          await sb
            .from("nex_account_device_key")
            .select("id")
            .in("account_id", accountIds)
        ).data ?? []
      ).map((r) => (r as { id: string }).id)
    : [];
  const residualAccounts = accountIds.length
    ? (
        (await sb.from("nex_account").select("id").in("id", accountIds)).data ?? []
      ).map((r) => (r as { id: string }).id)
    : [];

  // Auth users: admin API doesn't let us pass a filter list, so probe
  // each supabaseUserId by getUserById.
  const residualAuthUsers: string[] = [];
  for (const uid of supabaseUserIds) {
    const { data, error } = await sb.auth.admin.getUserById(uid);
    if (!error && data?.user?.id === uid) residualAuthUsers.push(uid);
  }

  return {
    orders: residualOrders,
    products: residualProducts,
    businesses: residualBusinesses,
    conversations: residualConversations,
    participants: residualParticipants,
    messages: residualMessages,
    deviceKeys: residualDeviceKeys,
    accounts: residualAccounts,
    authUsers: residualAuthUsers,
  };
}

// ---------------------------------------------------------------------
// Reclaim stranded fixtures (safe cleanup for prior-run leaks)
// ---------------------------------------------------------------------

/**
 * Hunts for rows whose slug/name/email carries our E2E_FIXTURE_PREFIX.
 * A row older than `olderThanMs` (default 1 hour) is considered abandoned
 * and cleaned up. Never touches rows without the marker.
 *
 * Use at test-suite start to keep the sandbox tidy — e2e failures that
 * skipped `finally` cleanup can accumulate otherwise.
 */
export async function reclaimAbandonedTestRecords(
  olderThanMs: number = 60 * 60 * 1000,
): Promise<{ products: number; businesses: number; accounts: number }> {
  assertSandboxRef();
  const sb = supabaseAdmin();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();

  // Products
  const { data: prods } = await sb
    .from("nex_product")
    .select("id")
    .like("name", `${E2E_FIXTURE_PREFIX}%`)
    .lt("created_at", cutoff);
  for (const p of prods ?? []) {
    await sb.from("nex_product").delete().eq("id", (p as { id: string }).id);
  }

  // Businesses
  const { data: bizes } = await sb
    .from("nex_business")
    .select("id")
    .like("slug", `${E2E_FIXTURE_PREFIX}%`)
    .lt("created_at", cutoff);
  for (const b of bizes ?? []) {
    await sb.from("nex_business").delete().eq("id", (b as { id: string }).id);
  }

  // Accounts — find by display_name prefix, then supabase_user_id
  const { data: accs } = await sb
    .from("nex_account")
    .select("id, supabase_user_id")
    .like("display_name", "E2E Fixture %")
    .lt("created_at", cutoff);
  for (const a of accs ?? []) {
    const row = a as { id: string; supabase_user_id: string | null };
    await sb.from("nex_account").delete().eq("id", row.id);
    if (row.supabase_user_id) {
      await sb.auth.admin.deleteUser(row.supabase_user_id).catch(() => undefined);
    }
  }

  return {
    products: prods?.length ?? 0,
    businesses: bizes?.length ?? 0,
    accounts: accs?.length ?? 0,
  };
}
