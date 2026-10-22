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
 *  the honest "Price TBD" chips on cards. Owner directive 2026-10-22
 *  · renamed from "Theme / Intro / Shop" to the fuller product names
 *  so buyers see what each package covers: a chat theme, a chat
 *  intro, and the combined Chat Shop + App shop surface. */
export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  theme: "Chat Theme",
  intro: "Chat Intro",
  shop: "Chat Shop + App shop",
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

/** Owner directive 2026-10-22 · dispatch time · lets each product
 *  carry its own prep window so the buyer sees "Ready in 15 min"
 *  for food or "Dispatch 2 days" for physical goods. Honest-null:
 *  omit when the seller hasn't declared one · the display sites
 *  render nothing instead of a placeholder. */
export type DispatchKind = "minutes" | "days";

export function formatDispatchLabel(
  kind: DispatchKind | null | undefined,
  value: number | null | undefined,
): string | null {
  if (!kind) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return null;
  }
  const whole = Math.round(value);
  if (kind === "minutes") return `Ready in ${whole} min`;
  if (kind === "days") return whole === 1 ? "Dispatch in 1 day" : `Dispatch ${whole} days`;
  return null;
}
