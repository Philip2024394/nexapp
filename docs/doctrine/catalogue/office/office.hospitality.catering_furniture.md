# office.hospitality.catering_furniture — Catering Furniture

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.hospitality.catering_furniture` · EN "Catering Furniture" · ID "Furnitur Katering"
- Synonyms: banquet tables, folding chairs (event), portable bars, buffet tables, chafing dishes stands
- Parent: Office → Hospitality & Catering → Catering Furniture
- **Umbrella leaf.**

## D2 Required
product name, item_type enum (`banquet_table_folding|round_banquet_table|folding_chair|stackable_chair|portable_bar|buffet_table|chafing_stand|bar_stool_commercial`), seating_capacity (where applicable), dimensions_mm, material.

## D3 Optional
model, foldable, stackable, waterproof (bool), outdoor_rated (bool), colour.

## D4 Technical specs
dimensions_mm, weight_kg, weight_capacity_kg.

## D5 Variant axes
- `size` typically separate SKU.
- `colour`/`fabric` (max 10).

## D6 Media
Min 3 / Max 8.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- BIFMA where applicable.
- Flame-retardancy for upholstered pieces.

## D9 Search attributes
Facets: item_type, seating_capacity, dimensions, material, foldable, colour, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Meja Banket | Banquet Table |
| Kursi Lipat | Folding Chair |

## D12 Unresolved
- Low-confidence umbrella.
