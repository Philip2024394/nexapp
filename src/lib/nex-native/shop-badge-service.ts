// src/lib/nex-native/shop-badge-service.ts
//
// Shop badge reader · "does this account own a shop?"
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Joins nex_business by owner_account_id for any batch of account ids
// and returns a lightweight map the UI can render as a 🏪 badge next
// to the account's chat name across every surface (chat peer header ·
// contacts cards · search results · directory previews).
//
// Design choices:
//   · Batched by default (one query for N account ids) so N+1 lookups
//     don't crop up on contacts grids.
//   · Returns a Map<accountId, ShopBadgeInfo> · missing ids simply
//     aren't present in the map (not stored as null entries).
//   · Keeps the payload tiny — slug + display_name + logo_url is
//     enough to render the badge + deep-link to the shop. No columns
//     with buyer-visible policies here.
//
// Downstream rendering lives in:
//   · src/app/nex-native/chat/peer/[accountId]/page.tsx (header)
//   · src/app/nex-native/contacts/_card-variants/* (contact rows)
//   · src/components/nex-native/shop-badge.tsx (shared presenter)

import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export interface ShopBadgeInfo {
  readonly accountId: NexUuid;
  readonly businessId: NexUuid;
  readonly displayName: string;
  readonly slug: string;
  readonly logoUrl: string | null;
}

interface Row {
  id: NexUuid;
  owner_account_id: NexUuid;
  display_name: string;
  slug: string;
  logo_url: string | null;
}

/** Resolve shop badges for a batch of account ids. Returns a Map keyed
 *  by account id · absent ids mean "no shop" (not an error). Pass an
 *  empty array → empty Map · no Supabase round-trip. */
export async function resolveShopBadges(
  accountIds: ReadonlyArray<NexUuid>,
): Promise<Map<NexUuid, ShopBadgeInfo>> {
  const unique = Array.from(new Set(accountIds.filter((id) => id)));
  if (unique.length === 0) return new Map();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("id, owner_account_id, display_name, slug, logo_url")
    .in("owner_account_id", unique);
  if (error) {
    // Return empty on error so callers get a graceful "no badge" UI
    // instead of a crashed render. The error lands in server logs.
    console.error("shop-badge-service.resolveShopBadges", error);
    return new Map();
  }
  const map = new Map<NexUuid, ShopBadgeInfo>();
  for (const row of (data ?? []) as Row[]) {
    // Owner may have multiple businesses in future · take the first
    // one · the UI shows a single badge per account for now.
    if (map.has(row.owner_account_id)) continue;
    map.set(row.owner_account_id, {
      accountId: row.owner_account_id,
      businessId: row.id,
      displayName: row.display_name,
      slug: row.slug,
      logoUrl: row.logo_url,
    });
  }
  return map;
}

/** Single-account convenience wrapper · null when the account has no
 *  shop. Prefer resolveShopBadges when rendering a list. */
export async function resolveShopBadge(
  accountId: NexUuid,
): Promise<ShopBadgeInfo | null> {
  const batch = await resolveShopBadges([accountId]);
  return batch.get(accountId) ?? null;
}
