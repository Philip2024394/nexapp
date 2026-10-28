# office.packaging_shipping.protective_packaging — Protective Packaging (Umbrella)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.packaging_shipping.protective_packaging` · EN "Protective Packaging" · ID "Pelindung Kemasan"
- Synonyms: foam inserts, air pillows, corner protectors, void fill, kraft paper fill
- Parent: Office → Packaging & Shipping → Protective Packaging
- **Umbrella leaf.**

## D2 Required
product name, item_type enum (`foam_sheet|foam_insert|air_pillow|corner_protector|edge_protector|packing_peanut|void_fill_paper|kraft_wrapping_paper`), dimensions_or_quantity, pack_count.

## D3 Optional
material (`polyethylene|polyurethane|biodegradable|paper|recycled_paper`), thickness, density, biodegradable_certified (bool).

## D4 Technical specs
dimensions_mm, pack_count, pack_weight_kg.

## D5 Variant axes
- `size` or `pack_count` (max 5).

## D6 Media
Min 1 / Max 4.

## D7 Commercial
Fixed. Bulk pricing.

## D8 Compliance
Biodegradable certification claims.

## D9 Search attributes
Facets: item_type, material, dimensions, pack_count, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Pelindung Kemasan | Protective Packaging |
| Styrofoam | Foam |

## D12 Unresolved
- Umbrella — may split post-launch into foam / fills / rigid-protectors.
