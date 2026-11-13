// src/lib/nex-native/seo/product-availability.ts
//
// NEX SEO · maps nex_product.stock_status → Schema.org availability vocab.
// Owner-authorised 2026-11-11 (B2 closeout).
// -----------------------------------------------------------------------------
// Hard rule: availability is NEVER inferred from a null / undefined /
// unknown stock_status. If the DB doesn't carry an explicit value, we emit
// no `availability` field — Google reads this as "unknown", not "in stock".

export type NexStockStatusInput =
  | "in_stock"
  | "low_stock"
  | "made_to_order"
  | "sold_out"
  | null
  | undefined;

export type SchemaAvailability =
  | "https://schema.org/InStock"
  | "https://schema.org/OutOfStock"
  | "https://schema.org/PreOrder";

export function mapNexStockToSchema(
  input: NexStockStatusInput,
): SchemaAvailability | null {
  switch (input) {
    case "in_stock":
    case "low_stock":
      return "https://schema.org/InStock";
    case "made_to_order":
      return "https://schema.org/PreOrder";
    case "sold_out":
      return "https://schema.org/OutOfStock";
    default:
      // Null, undefined, any unknown value → emit nothing.
      return null;
  }
}
