// src/lib/nex-native/watches/watch-listing-types.ts
//
// Public type declarations for NEX Watches v1 · SAFE for client and
// server. No runtime side-effects, no server-only guard. Client
// components ("use client") import from here so the server-only
// chain in `watch-listing-service.ts` does not leak into the
// browser bundle.

export type NexUuid = string;

export type WatchListingStatus =
  | "draft"
  | "published"
  | "expired"
  | "removed";

export type WatchListingPricingMode =
  | "chat"
  | "price_only"
  | "shop_product"
  | "auction";

export type WatchListingEntitlementProvider =
  | "manual"
  | "xendit"
  | "midtrans"
  | "other";

/** Row shape · mirrors nex_watch_listing columns. */
export interface WatchListingRow {
  readonly id: NexUuid;
  readonly owner_account_id: NexUuid;
  readonly business_id: NexUuid | null;
  readonly status: WatchListingStatus;
  readonly entitlement_expires_at: string | null;
  readonly published_at: string | null;
  readonly removed_at: string | null;
  readonly pricing_mode: WatchListingPricingMode;
  readonly price_pence: number | null;
  readonly currency: string;
  readonly brand: string;
  readonly brand_is_custom: boolean;
  readonly model_name: string;
  readonly reference_number: string | null;
  readonly watch_type: string;
  readonly movement: string;
  readonly case_diameter_mm: number | null;
  readonly dial_color: string | null;
  readonly strap_material: string | null;
  readonly condition: string;
  readonly description: string | null;
  readonly case_shape: string | null;
  readonly case_material_category: string | null;
  readonly crystal_material: string | null;
  readonly clasp_type: string | null;
  readonly water_resistance_m: number | null;
  readonly bezel_style: string | null;
  readonly dial_finish: string | null;
  readonly hand_style: string | null;
  readonly case_finish: string | null;
  readonly style_audience: string | null;
  readonly strap_interchangeability: string | null;
  readonly lug_type: string | null;
  readonly crown_position: string | null;
  readonly case_size_category: string | null;
  readonly authenticity: string | null;
  readonly seller_type: string | null;
  readonly shipping_scope: string | null;
  readonly packaging_items: readonly string[] | null;
  readonly availability: string | null;
  readonly warranty_note: string | null;
  readonly provenance_note: string | null;
  readonly video_url: string | null;
  readonly cover_image_url: string | null;
  readonly gallery_image_urls: readonly string[] | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Directory projection row · mirrors watch_listing_directory_v. */
export interface WatchDirectoryTile {
  readonly id: NexUuid;
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
  readonly pricing_mode: WatchListingPricingMode;
  readonly business_id: NexUuid | null;
  readonly owner_account_id: NexUuid;
  readonly published_at: string | null;
  readonly entitlement_expires_at: string | null;
}
