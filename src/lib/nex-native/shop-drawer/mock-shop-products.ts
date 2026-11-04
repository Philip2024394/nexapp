// src/lib/nex-native/shop-drawer/mock-shop-products.ts
//
// NEX · Shop Drawer · Phase 1 mock product data.
// Owner-authorised 2026-11-05.
// -----------------------------------------------------------------------------
// Mocked product list for the Phase 1 ShopDrawer prototype. Lets the
// owner evaluate the "tap product → share to chat" UX before the drawer
// is wired to real nex_product rows.
//
// Phase 2 (NOT authorised yet) will replace this file's exports with a
// server-resolved query against `nex_product` scoped to the viewer's
// `nex_business`. The TYPES below are the contract the drawer consumes ·
// they stay stable across the mock → real migration.
//
// Important · the drawer's product card tap does NOT include the
// product object in the send form · it sends only the product_id.
// The server action resolves the product server-side (price + image +
// shop name snapshot) when the peer-message row is created, preserving
// the existing shareProductToContactAction integrity model.

export interface ShopProduct {
  readonly id: string;
  readonly name: string;
  /** Pre-formatted display label (e.g. "€39.00", "€12.50 · each").
   *  Formatted on the server in production · hardcoded here for the
   *  prototype so the drawer doesn't need its own currency helpers. */
  readonly priceLabel: string;
  /** Square product image URL. For the prototype we use solid-colour
   *  data URIs so the drawer renders without any external assets. */
  readonly imageUrl: string;
  /** Short category tag · rendered as a sage chip under the title.
   *  Optional · omit for products that don't categorise meaningfully. */
  readonly tag?: string;
}

// Owner note · the mock set below describes an imagined Irish-stay +
// Irish-goods shop so the drawer reads honestly on the Aoife prototype.
// Phase 2 will replace these with the viewer's real `nex_product` rows.
export const MOCK_SHOP_PRODUCTS: ReadonlyArray<ShopProduct> = [
  {
    id: "mock-prod-01",
    name: "Treaty Bar Hoodie",
    priceLabel: "€48.00",
    imageUrl: solidTile("#1F3A2A", "TBH"),
    tag: "Apparel",
  },
  {
    id: "mock-prod-02",
    name: "Dublin Print · A3",
    priceLabel: "€22.00",
    imageUrl: solidTile("#2A3A1F", "D·3"),
    tag: "Print",
  },
  {
    id: "mock-prod-03",
    name: "Roasted Blend · 250g",
    priceLabel: "€14.50",
    imageUrl: solidTile("#3A2A1F", "RB"),
    tag: "Coffee",
  },
  {
    id: "mock-prod-04",
    name: "Session Fiddle Strings",
    priceLabel: "€28.00",
    imageUrl: solidTile("#2F2A3A", "FS"),
    tag: "Music",
  },
  {
    id: "mock-prod-05",
    name: "Connemara Weekend Print",
    priceLabel: "€32.00",
    imageUrl: solidTile("#1F2A3A", "CW"),
    tag: "Print",
  },
  {
    id: "mock-prod-06",
    name: "Seaglass Brooch · hand-set",
    priceLabel: "€64.00",
    imageUrl: solidTile("#2A3A3A", "SG"),
    tag: "Jewellery",
  },
  {
    id: "mock-prod-07",
    name: "Harbour Mug · stoneware",
    priceLabel: "€18.00",
    imageUrl: solidTile("#3A1F2A", "HM"),
    tag: "Ceramics",
  },
  {
    id: "mock-prod-08",
    name: "Trad Nights · session pass",
    priceLabel: "€12.00",
    imageUrl: solidTile("#1F3A3A", "TN"),
    tag: "Event",
  },
];

/** Tiny inline SVG placeholder so the drawer renders without external
 *  image assets in the prototype. Returns a data URI square tile with
 *  the given background and short label. */
function solidTile(bg: string, label: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">` +
    `<rect width="220" height="220" fill="${bg}"/>` +
    `<text x="110" y="120" text-anchor="middle" font-family="Inter, sans-serif" ` +
    `font-size="48" font-weight="700" fill="#AFC5B5" letter-spacing="2">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
