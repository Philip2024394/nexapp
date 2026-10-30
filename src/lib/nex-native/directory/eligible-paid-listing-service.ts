// src/lib/nex-native/directory/eligible-paid-listing-service.ts
//
// Directory Integration Fix 2026-10-26 · server-only reader for the
// two G3-amendment-compatible sources of eligible paid individual
// listings:
//
//   · nex_watch_listing_directory_v    (Migration 229 · NOT APPLIED)
//   · nex_live_post_directory_v        (Migration 233 · NOT APPLIED)
//
// Both are view-only projections that already carry their own
// eligibility predicates (published AND entitlement window AND
// price_pence > 0 for watches; open session AND business_id non-null
// AND actively featured AND product.price_pence > 0 for live posts).
// This file does NOT re-interpret or weaken those predicates.
//
// Fail posture
//   · FAIL-OPEN · if the view does not exist (migrations not applied)
//     or the query errors, the function returns []. The landing feed
//     continues to render shop-level cards from nex_business +
//     canonical.
//
// G3 compatibility
//   · This service never reads `nex_product`, `nex_menu_item`, or
//     `nex_service` directly. The two sealed views are the ONLY
//     surfaces we consume · the join from product → price_pence
//     lives inside the view (migration 233), so the service layer
//     respects the sealed "do not touch nex_product" boundary.
//   · One row per eligible paid individual listing · aligns with the
//     G3 amendment of 2026-10-26.
//
// Price rule
//   · Both views bake `price_pence > 0` into their WHERE clauses.
//     Chat-mode watches (price_pence IS NULL) and un-priced live
//     featured products are therefore structurally excluded from the
//     directory. Owner directive 2026-10-26 · "if product does not
//     have price added it does not get entered into the nex search
//     directory".

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListingCardViewModel } from "./landing-feed-service";

/** Lazy-load the Supabase admin client. Importing it eagerly causes
 *  tests that don't set NEX_SUPABASE_URL to crash at module-load
 *  time (supabase-admin throws if the env is missing). The lazy load
 *  keeps module import safe and defers the env check to call-time,
 *  where our fail-open catches a missing/broken client gracefully. */
async function getSupabaseAdmin(): Promise<SupabaseClient | null> {
  try {
    const mod = await import("@/lib/nex-native/supabase-admin");
    return mod.nexSupabaseAdmin;
  } catch {
    return null;
  }
}

export interface EligiblePaidListingPoolEntry {
  readonly card: ListingCardViewModel;
  /** Location fields are not available on the paid-listing views
   *  today. When the directory's distance filter is active, these
   *  rows are honestly excluded (null !== lat → fail the filter). */
  readonly location_lat: number | null;
  readonly location_lng: number | null;
}

/** Row shape returned by `watch_listing_directory_v`. Mirrors the
 *  SQL projection in Migration 229 verbatim. */
interface WatchListingDirectoryRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly category_label: string;
  readonly category_id: string;
  readonly category_accent: string;
  readonly category_icon_col: 0 | 1 | 2 | 3;
  readonly category_icon_row: 0 | 1;
  readonly image_url: string | null;
  readonly description: string | null;
  readonly featured_offering: string | null;
  readonly city: string | null;
  readonly href: string;
  readonly source: "watch_listing";
  readonly price_pence: number | null;
  readonly currency: string;
  readonly pricing_mode: string;
  readonly business_id: string | null;
  readonly owner_account_id: string;
  readonly published_at: string | null;
  readonly entitlement_expires_at: string | null;
}

interface LivePostDirectoryRow {
  readonly id: string;
  readonly session_id: string;
  readonly featured_product_id: string;
  readonly slug: string;
  readonly title: string;
  readonly category_label: string;
  readonly category_id: string;
  readonly category_accent: string;
  readonly category_icon_col: 0 | 1 | 2 | 3;
  readonly category_icon_row: 0 | 1;
  readonly image_url: string | null;
  readonly description: string | null;
  readonly featured_offering: string | null;
  readonly city: string | null;
  readonly href: string;
  readonly source: "live_post";
  readonly price_pence: number | null;
  readonly currency: string;
  readonly business_id: string;
  readonly broadcaster_account_id: string;
  readonly live_started_at: string;
  readonly featured_at: string;
}

/** Format pence into "Rp 30.000.000". Mirrors `formatIdrPence` from
 *  the watches namespace · duplicated here to avoid a cross-package
 *  import for a 3-line formatter. */
function formatIdrPence(pence: number | null | undefined): string | null {
  if (pence == null) return null;
  const major = Math.floor(pence / 100);
  return `Rp ${major.toLocaleString("id-ID")}`;
}

function toCard(row: WatchListingDirectoryRow | LivePostDirectoryRow): ListingCardViewModel {
  const priceLabel = formatIdrPence(row.price_pence);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    categoryLabel: row.category_label,
    categoryId: row.category_id,
    categoryAccent: row.category_accent,
    categoryIconCol: row.category_icon_col,
    categoryIconRow: row.category_icon_row,
    imageUrl: row.image_url,
    description: row.description,
    featuredOffering: row.featured_offering,
    city: row.city,
    href: row.href,
    source: row.source,
    priceAmountMinor: row.price_pence,
    priceCurrency: row.currency,
    priceNow: priceLabel,
    priceWas: null,
    discountLabel: null,
    sellerCountryIso: null,
    buyerLocalPrice: null,
    // Watch listings + live posts predate the Product System market
    // substrate (migration 239 et al). The view model keeps marketScope
    // null for these rows; the card renders exactly as before.
    marketScope: null,
  };
}

export interface ListPaidListingsArgs {
  /** Soft cap · the two views are small by construction (one row per
   *  eligible paid listing) so a 100-row cap is generous. */
  readonly limit?: number;
}

/** List eligible paid watch listings via the sealed Option Y view.
 *  Fail-open · returns [] when the view does not exist or the query
 *  errors. Never fabricates. */
export async function listPaidWatchListings(
  args: ListPaidListingsArgs = {},
): Promise<readonly EligiblePaidListingPoolEntry[]> {
  const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
  try {
    const admin = await getSupabaseAdmin();
    if (!admin) return [];
    const { data, error } = await admin
      .from("watch_listing_directory_v")
      .select("*")
      .order("entitlement_expires_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as unknown as readonly WatchListingDirectoryRow[]).map((row) => ({
      card: toCard(row),
      location_lat: null,
      location_lng: null,
    }));
  } catch {
    return [];
  }
}

/** List eligible paid live posts via the sealed Option Y view. */
export async function listPaidLivePosts(
  args: ListPaidListingsArgs = {},
): Promise<readonly EligiblePaidListingPoolEntry[]> {
  const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
  try {
    const admin = await getSupabaseAdmin();
    if (!admin) return [];
    const { data, error } = await admin
      .from("nex_live_post_directory_v")
      .select("*")
      .order("featured_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as unknown as readonly LivePostDirectoryRow[]).map((row) => ({
      card: toCard(row),
      location_lat: null,
      location_lng: null,
    }));
  } catch {
    return [];
  }
}
