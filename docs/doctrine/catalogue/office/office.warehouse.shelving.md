# office.warehouse.shelving — Warehouse Shelving

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.warehouse.shelving` · EN "Warehouse Shelving" · ID "Rak Gudang"
- Synonyms: industrial racking, pallet racking, boltless shelving, metal shelving
- Parent: Office → Warehouse Equipment → Shelving

## D2 Required
product name, brand, shelving_type enum (`boltless|pallet_racking|cantilever|mezzanine|wire_shelving|mobile_shelving`), overall_dimensions_wdh_mm, shelves_count, load_capacity_per_shelf_kg, total_load_capacity_kg, material (`steel|galvanised_steel|wire_coated_steel|aluminium`).

## D3 Optional
model, finish/colour, adjustable_shelves (bool), expandable (bool), seismic_rated (bool), fire_rated (bool), anti_tilt (bool).

## D4 Technical specs
width_mm, depth_mm, height_mm, weight_kg, load_capacity_per_shelf_kg, total_load_capacity_kg, shelves_count.

## D5 Variant axes
- `height` or `width` typically separate SKU.
- `shelves_count` can be variant (max 5).

## D6 Media
Min 3 / Max 8. Front assembled, structural detail, close-up of beam/pillar.

## D7 Commercial
Fixed. Returnable yes if sealed. Freight.

## D8 Compliance
- ISO 15635 (steel racking) [VERIFIED].
- ANSI MH16.1 (US) / EN 15635 (EU) racking safety [VERIFIED].
- Seismic rating in earthquake-prone jurisdictions (ID is relevant).

## D9 Search attributes
Facets: shelving_type, dimensions, load_capacity_per_shelf, material, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Rak Gudang | Warehouse Shelving |
| Rak Besi | Metal Shelving |
| Rak Pallet | Pallet Racking |

## D12 Unresolved
- Pallet racking vs light-duty shelving boundary — treat as same leaf with shelving_type axis.
- Seismic rating — important in ID; propose dedicated filter.
