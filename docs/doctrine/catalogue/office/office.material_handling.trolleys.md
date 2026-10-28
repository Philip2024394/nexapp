# office.material_handling.trolleys — Material-Handling Trolleys

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.material_handling.trolleys` · EN "Trolleys" · ID "Troli"
- Synonyms: hand trucks, sack trucks, platform trucks, drum movers
- Parent: Office → Material Handling → Trolleys
- **Merge-candidate** with `office.warehouse.trolleys`. Pre-launch decision needed on canonical slot.

## D2 Required
product name, brand, trolley_type enum (`hand_truck|sack_truck|platform|dolly|drum_mover|stair_climber|convertible`), load_capacity_kg, base_or_platform_mm, wheel_type, wheel_diameter_mm.

## D3 Optional
model, foldable (bool), telescoping_handle (bool), toe_plate, pneumatic_wheels (bool), swivel_wheels, max_tilt_angle.

## D4 Technical specs
length_mm, width_mm, height_mm, weight_kg, load_capacity_kg, wheel_diameter_mm.

## D5 Variant axes
- `load_capacity_kg` or `trolley_type` typically separate SKU.

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
ISO 3691-5 (pedestrian industrial trucks).

## D9 Search attributes
Facets: trolley_type, load_capacity, foldable, wheel_type, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Troli | Trolley |

## D12 Unresolved
- **MERGE** with `office.warehouse.trolleys` — pre-launch resolution. Propose keep this (material_handling) as canonical.
