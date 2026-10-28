# office.warehouse.storage_bins — Storage Bins

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.warehouse.storage_bins` · EN "Storage Bins" · ID "Keranjang Penyimpanan"
- Synonyms: picking bins, parts bins, totes, stacking bins
- Parent: Office → Warehouse Equipment → Storage Bins

## D2 Required
product name, brand, bin_type enum (`picking|parts|tote|lidded|hopper_front|stackable_container`), external_dimensions_wdh_mm, capacity_litres, material (`polypropylene|polyethylene|hdpe|metal`), colour.

## D3 Optional
model, nestable (bool), stackable (bool), lid_included (bool), lid_sold_separately (bool), chemical_resistant (bool), uv_stabilised (bool), max_load_kg.

## D4 Technical specs
width_mm, depth_mm, height_mm, weight_kg, capacity_litres, max_load_kg.

## D5 Variant axes
- `size` typically separate SKU.
- `colour` (max 10).
- `pack_count` (max 5).

## D6 Media
Min 2 / Max 5.

## D7 Commercial
Fixed. Bulk pricing.

## D8 Compliance
None default.

## D9 Search attributes
Facets: bin_type, capacity_litres, dimensions, material, colour, stackable, pack_count, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kontainer Penyimpanan | Storage Container |
| Keranjang | Basket / Bin |

## D12 Unresolved
- Food-safe bins vs industrial bins — may need boolean `food_contact_safe`.
