# office.warehouse.trolleys — Warehouse Trolleys

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.warehouse.trolleys` · EN "Warehouse Trolleys" · ID "Troli Gudang"
- Synonyms: hand trucks, sack trucks, platform trucks, dollies
- Parent: Office → Warehouse Equipment → Trolleys

## D2 Required
product name, brand, trolley_type enum (`hand_truck|sack_truck|platform_truck|dolly|convertible|stair_climber`), load_capacity_kg, platform_or_base_dimensions_mm, wheel_type, wheel_diameter_mm.

## D3 Optional
model, foldable (bool), telescoping_handle (bool), toe_plate_dimensions, pneumatic_wheels (bool), swivel_wheels (count).

## D4 Technical specs
length_mm, width_mm, height_mm, weight_kg, load_capacity_kg, wheel_diameter_mm.

## D5 Variant axes
- `load_capacity_kg` or `size` typically separate SKU.

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
ISO 3691-5 pedestrian industrial trucks.

## D9 Search attributes
Facets: trolley_type, load_capacity, foldable, wheel_type, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Troli | Trolley |
| Hand Truck | Hand Truck |

## D12 Unresolved
- **Merge candidate**: `office.material_handling.trolleys` is the same category. Recommend merge pre-launch — propose canonical slot = `office.material_handling.trolleys` (handling-centric); keep this leaf as alias OR drop.
