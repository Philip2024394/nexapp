// src/lib/nex-native/hq-shop/shop-page-queries.ts
//
// Server-only helpers for the HQ per-shop page. Three queries:
//
//   · fetchTopViewedProducts        → top-N product views for a business
//   · fetchShopContactsMetadata     → counterparties that have a peer
//                                     conversation with the shop owner
//                                     (metadata only · never plaintext)
//   · fetchShopMessageInboxMeta     → recent peer-chat inbound message
//                                     metadata (counterparty + sent_at)
//                                     with body/ciphertext NEVER returned
//
// Doctrine
//   · nex_message + nex_peer_message BODIES are end-to-end encrypted
//     per the sealed 2026-11-09 device-only E2E architecture. HQ cannot
//     read plaintext without breaking that seal. These helpers only
//     surface metadata (who messaged, when, how many) so the HQ
//     operator has useful context without reading content.
//   · Service-role reads bypass RLS · callers MUST HQ-gate first.
//   · Bounded result sets · every query has a hard LIMIT.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import { NEX_HQ_SENTINEL_ACCOUNT_ID } from "../hq-direct-channel/hq-direct-service";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Top-viewed products ────────────────────────────────────────────

export interface TopProductRow {
  readonly productId: string;
  readonly productName: string | null;
  readonly views: number;
}

/** Return the top-N products by view count for a business over the
 *  given window (default 30 days). Honest counting: counts rows in
 *  nex_page_view where page_type='product'. Pre-migration-303 returns
 *  an empty list. */
export async function fetchTopViewedProducts(
  businessId: string,
  opts: { readonly days?: number; readonly limit?: number } = {},
): Promise<readonly TopProductRow[]> {
  if (!UUID_SHAPE.test(businessId)) return [];
  const days = Math.max(1, Math.min(opts.days ?? 30, 365));
  const limit = Math.max(1, Math.min(opts.limit ?? 10, 50));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Pull raw (product_id) rows for the window · aggregate in process.
  // Supabase REST does not expose GROUP BY directly; a RPC would be
  // nicer but we avoid one to keep this helper self-contained until
  // the owner authorises a migration adding a view/function.
  const { data, error } = await nexSupabaseAdmin
    .from("nex_page_view")
    .select("product_id")
    .eq("business_id", businessId)
    .eq("page_type", "product")
    .eq("bot_likely", false)
    .gte("viewed_at", since)
    .not("product_id", "is", null)
    .limit(10_000);
  if (error || !data) return [];

  const counts = new Map<string, number>();
  for (const r of data as Array<{ product_id: string | null }>) {
    if (!r.product_id) continue;
    counts.set(r.product_id, (counts.get(r.product_id) ?? 0) + 1);
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  if (ranked.length === 0) return [];

  const ids = ranked.map(([id]) => id);
  const prod = await nexSupabaseAdmin
    .from("nex_product")
    .select("id, title")
    .in("id", ids);
  const nameMap = new Map<string, string | null>();
  if (!prod.error && prod.data) {
    for (const r of prod.data as Array<{ id: string; title: string | null }>) {
      nameMap.set(r.id, r.title);
    }
  }

  return ranked.map(([productId, views]) => ({
    productId,
    productName: nameMap.get(productId) ?? null,
    views,
  }));
}

// ─── Shop contacts (counterparties) ─────────────────────────────────

export interface ShopContactRow {
  readonly accountId: string;
  readonly displayName: string | null;
  readonly nexHandle: string | null;
  readonly lastMessageAt: string | null;
}

/** Return every peer-chat counterparty of the shop owner, newest last-
 *  message first. METADATA ONLY · bodies are not returned per the E2E
 *  seal. The caller surfaces this list as a picker for founder-
 *  initiated chat.
 *
 *  `ownerAccountId` is the shop's owner_account_id. */
export async function fetchShopContactsMetadata(
  ownerAccountId: string,
  opts: { readonly limit?: number } = {},
): Promise<readonly ShopContactRow[]> {
  if (!UUID_SHAPE.test(ownerAccountId)) return [];
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));

  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .select("participant_a_id, participant_b_id, last_message_at")
    .or(
      `participant_a_id.eq.${ownerAccountId},participant_b_id.eq.${ownerAccountId}`,
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error || !data) return [];

  const counterparties: Array<{ id: string; lastMessageAt: string | null }> =
    [];
  const seen = new Set<string>();
  for (const r of data as Array<{
    participant_a_id: string;
    participant_b_id: string;
    last_message_at: string | null;
  }>) {
    const other =
      r.participant_a_id === ownerAccountId
        ? r.participant_b_id
        : r.participant_a_id;
    if (seen.has(other)) continue;
    seen.add(other);
    counterparties.push({ id: other, lastMessageAt: r.last_message_at });
  }
  if (counterparties.length === 0) return [];

  const ids = counterparties.map((c) => c.id);
  const accts = await nexSupabaseAdmin
    .from("nex_account")
    .select("id, display_name, nex_handle")
    .in("id", ids);
  const acctMap = new Map<
    string,
    { display_name: string | null; nex_handle: string | null }
  >();
  if (!accts.error && accts.data) {
    for (const r of accts.data as Array<{
      id: string;
      display_name: string | null;
      nex_handle: string | null;
    }>) {
      acctMap.set(r.id, {
        display_name: r.display_name,
        nex_handle: r.nex_handle,
      });
    }
  }

  return counterparties.map((c) => {
    const a = acctMap.get(c.id);
    return {
      accountId: c.id,
      displayName: a?.display_name ?? null,
      nexHandle: a?.nex_handle ?? null,
      lastMessageAt: c.lastMessageAt,
    };
  });
}

// ─── Shop message inbox (metadata only) ─────────────────────────────

export interface ShopInboxRow {
  readonly conversationId: string;
  readonly senderAccountId: string;
  readonly senderDisplayName: string | null;
  readonly createdAt: string;
  readonly encrypted: boolean;
}

/** Most-recent peer-chat messages sent INTO the shop (metadata only).
 *
 *  Defect fix 2026-11-28 · previous revision read nex_conversation +
 *  nex_message (mig-004 business-chat system), but the shop chat FAB
 *  routes through nex_peer_conversation + nex_peer_message (mig-047
 *  Bridge 3 peer-chat system · sealed 2026-11-13 FAB redesign).
 *  Reading the wrong table rendered the inbox empty even when real
 *  customers had messaged the shop.
 *
 *  Architecture:
 *   · businessId → nex_business.owner_account_id → one side of every
 *     peer conversation.
 *   · Conversations are the (participant_a_id, participant_b_id) rows
 *     where owner is either side.
 *   · "Inbox" = inbound, so we exclude messages sent BY the owner
 *     (that's their outbox) and messages from the Nex HQ sentinel
 *     (that's HQ→customer, not customer→shop).
 *   · Body / ciphertext / nonce / sender_public_key columns are NEVER
 *     selected · the 2026-11-09 device-only E2E seal stands.
 *   · `encrypted` flag comes from mig-093 which added the dual-mode
 *     column on nex_peer_message. */
export async function fetchShopMessageInboxMeta(
  businessId: string,
  opts: { readonly limit?: number } = {},
): Promise<readonly ShopInboxRow[]> {
  if (!UUID_SHAPE.test(businessId)) return [];
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));

  // Resolve the shop owner · peer-chat is keyed on accounts, not
  // businesses, so we need the owner account id to query.
  const bizRes = await nexSupabaseAdmin
    .from("nex_business")
    .select("owner_account_id")
    .eq("id", businessId)
    .maybeSingle();
  const ownerAccountId = (bizRes.data as { owner_account_id: string | null } | null)
    ?.owner_account_id;
  if (bizRes.error || !ownerAccountId || !UUID_SHAPE.test(ownerAccountId)) {
    return [];
  }

  // Enumerate the owner's peer conversations · one row per canonical
  // pair per mig-047 schema.
  const conv = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .select("id, participant_a_id, participant_b_id")
    .or(
      `participant_a_id.eq.${ownerAccountId},participant_b_id.eq.${ownerAccountId}`,
    )
    .limit(500);
  if (conv.error || !conv.data || conv.data.length === 0) return [];
  const conversationIds = (
    conv.data as Array<{
      id: string;
      participant_a_id: string;
      participant_b_id: string;
    }>
  ).map((r) => r.id);

  // Fetch inbound messages · exclude owner's own outbound and the
  // Nex HQ sentinel's announcements (mig-301).
  const msgs = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("conversation_id, sender_account_id, sent_at, encrypted")
    .in("conversation_id", conversationIds)
    .neq("sender_account_id", ownerAccountId)
    .neq("sender_account_id", NEX_HQ_SENTINEL_ACCOUNT_ID)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (msgs.error || !msgs.data) return [];

  const rows = msgs.data as Array<{
    conversation_id: string;
    sender_account_id: string;
    sent_at: string;
    encrypted: boolean | null;
  }>;

  const senderIds = [...new Set(rows.map((r) => r.sender_account_id))];
  if (senderIds.length === 0) return [];
  const senders = await nexSupabaseAdmin
    .from("nex_account")
    .select("id, display_name")
    .in("id", senderIds);
  const senderMap = new Map<string, string | null>();
  if (!senders.error && senders.data) {
    for (const r of senders.data as Array<{
      id: string;
      display_name: string | null;
    }>) {
      senderMap.set(r.id, r.display_name);
    }
  }

  return rows.map((r) => ({
    conversationId: r.conversation_id,
    senderAccountId: r.sender_account_id,
    senderDisplayName: senderMap.get(r.sender_account_id) ?? null,
    createdAt: r.sent_at,
    encrypted: r.encrypted ?? false,
  }));
}
