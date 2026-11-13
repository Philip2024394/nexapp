// src/lib/nex-native/seo/shop-product-json-ld.ts
//
// NEX SEO B2 closeout · build Product JSON-LD strings for a shop.
// Owner-authorised 2026-11-11.
// -----------------------------------------------------------------------------
// Pure function · takes products + slug, returns the JSON-LD strings the
// shop page emits. Isolated so the filter + mapping contract can be
// tested independently of the shop page's 300-line render tree.
//
// HARD RULES:
//   · Only products with status === "live" are considered.
//   · Private, draft, archived or unknown statuses NEVER emit.
//   · Prices only emit when price_pence is a finite number AND currency
//     is a non-empty string.
//   · Availability is ONLY emitted for known stock_status values · null /
//     undefined / unknown → omitted.
//   · Never invents brand, rating, review or sale fields.

import {
  buildProduct,
  renderJsonLd,
} from "./json-ld";
import {
  mapNexStockToSchema,
  type NexStockStatusInput,
} from "./product-availability";

export interface ShopProductRow {
  readonly id: string;
  readonly name: string | null;
  readonly description?: string | null;
  readonly image_url?: string | null;
  readonly status?: "draft" | "live" | "archived" | null;
  readonly price_pence?: number | null;
  readonly currency?: string | null;
  readonly stock_status?: NexStockStatusInput;
}

export function buildShopProductJsonLdStrings(
  businessSlug: string,
  products: readonly ShopProductRow[] | null | undefined,
): readonly string[] {
  if (!Array.isArray(products) || products.length === 0) return [];
  const out: string[] = [];
  for (const p of products) {
    if (p.status !== "live") continue;
    if (!p.id || typeof p.id !== "string") continue;
    if (!p.name || typeof p.name !== "string") continue;
    const price =
      typeof p.price_pence === "number" && Number.isFinite(p.price_pence)
        ? p.price_pence
        : null;
    const currency =
      typeof p.currency === "string" && p.currency.trim().length > 0
        ? p.currency
        : null;
    const payload = buildProduct({
      businessSlug,
      productId: p.id,
      name: p.name,
      description: p.description ?? null,
      imageUrl: p.image_url ?? null,
      priceMinor: price,
      currency,
      availability: mapNexStockToSchema(p.stock_status ?? null),
    });
    const body = renderJsonLd(payload);
    if (body) out.push(body);
  }
  return out;
}
