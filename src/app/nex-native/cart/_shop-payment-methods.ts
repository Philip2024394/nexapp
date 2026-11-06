// src/app/nex-native/cart/_shop-payment-methods.ts
//
// Side-table for per-shop accepted payment methods + QR URL.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// The sealed NexCartItem in cart-types.ts intentionally doesn't carry
// shop policies (payment methods / QR code URL) — those are shop-
// level, not line-level. To keep CheckoutSheet 100% client-side
// without changing the sealed cart shape, we persist a small
// Record<shop_id, ShopPaymentMeta> under a secondary localStorage key.
//
// ProductDetailSheet writes to it at add-to-cart time (it already has
// the shop's accepted_payment_methods + QR URL in its props). Cart
// page reads it + passes the entries into CheckoutSheet.

const STORAGE_KEY = "nex_cart_shop_payment_methods_v1";
const EVENT_NAME = "nex-cart-shop-payment-methods-changed";

export interface ShopPaymentMeta {
  readonly methods: ReadonlyArray<string>;
  readonly qrUrl: string | null;
}

export type ShopPaymentMetaMap = Record<string, ShopPaymentMeta>;

export function readShopPaymentMeta(): ShopPaymentMetaMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as ShopPaymentMetaMap)
      : {};
  } catch {
    return {};
  }
}

export function writeShopPaymentMeta(
  shopId: string,
  meta: ShopPaymentMeta,
): void {
  if (typeof window === "undefined") return;
  try {
    const map = readShopPaymentMeta();
    map[shopId] = meta;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    /* fail-soft */
  }
}

export function getShopPaymentMeta(shopId: string): ShopPaymentMeta {
  const map = readShopPaymentMeta();
  return map[shopId] ?? { methods: [], qrUrl: null };
}
