// src/app/nex-native/chat-themes-library/marketplace-prototype/_types.ts
//
// Owner-authorised 2026-10-21 (Marketplace Prototype build).

export type ProductType = "theme" | "intro" | "shop";

export interface CartItem {
  readonly themeId: string;
  readonly themeDisplayName: string;
  readonly productType: ProductType;
  /** For Shop items the user picks a specific layout; nullable
   *  for Theme + Intro which are 1:1 with the theme. */
  readonly shopLayoutId?: string | null;
  readonly addedAt: number;
}

/** Human-readable product-type labels used across the cart drawer +
 *  the honest "Price TBD" chips on cards. */
export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  theme: "Theme",
  intro: "Intro",
  shop: "Shop",
};

/** Icon glyph used on the round buttons and in the cart list. Kept
 *  as text/SVG so the surface stays zero-dependency. */
export const PRODUCT_TYPE_GLYPH: Record<ProductType, string> = {
  theme: "💬",
  intro: "▶",
  shop: "🏬",
};

export function cartKey(item: Pick<CartItem, "themeId" | "productType" | "shopLayoutId">): string {
  return item.productType === "shop"
    ? `${item.themeId}::shop::${item.shopLayoutId ?? "default"}`
    : `${item.themeId}::${item.productType}`;
}
