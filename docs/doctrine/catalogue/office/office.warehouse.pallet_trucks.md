# office.warehouse.pallet_trucks — Pallet Trucks

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.warehouse.pallet_trucks` · EN "Pallet Trucks" · ID "Hand Pallet / Troli Palet"
- Synonyms: hand pallet trucks, pump trucks, electric pallet jacks
- Parent: Office → Warehouse Equipment → Pallet Trucks

## D2 Required
product name, brand, drive_type (`manual_hydraulic|electric|semi_electric`), load_capacity_kg, fork_length_mm, fork_width_outer_mm, fork_width_each_mm, min_fork_height_mm, max_fork_lift_height_mm, wheel_type.

## D3 Optional
model, battery_type (electric only), battery_voltage, battery_capacity_ah, charging_time_hours, run_time_per_charge_hours, platform_width_depth_mm, warranty_months.

## D4 Technical specs
length_mm, width_mm, height_mm, weight_kg, load_capacity_kg, fork_length_mm, min_fork_height_mm, max_fork_lift_height_mm, battery_capacity_ah, battery_voltage.

## D5 Variant axes
- `load_capacity_kg` typically separate SKU.
- `fork_length_mm` can be variant (max 4).

## D6 Media
Min 3 / Max 8. Side profile, close-up of handle, pallet lifted view.

## D7 Commercial
Fixed. Returnable yes if sealed. Freight.

## D8 Compliance
- ISO 509 (pallet standards — adjacent) [VERIFIED].
- ISO 3691-5 (pedestrian industrial trucks) [VERIFIED].
- EN 1757-2 (pedestrian pallet trucks) [VERIFIED].
- Electric: UN 38.3 battery compliance; CE / FCC EMC; lithium shipping restrictions.

## D9 Search attributes
Facets: drive_type, load_capacity, fork_length, battery_type, brand, price. Sort: price, capacity.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Hand Pallet | Hand Pallet Truck |
| Pallet Jack | Pallet Jack |

## D12 Unresolved
- Lithium-battery shipping restrictions for electric models — air carriers often refuse.
- Service / maintenance kits — separate consumables leaf.
