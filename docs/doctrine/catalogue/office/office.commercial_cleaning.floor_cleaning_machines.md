# office.commercial_cleaning.floor_cleaning_machines — Floor Cleaning Machines

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.commercial_cleaning.floor_cleaning_machines` · EN "Floor Cleaning Machines" · ID "Mesin Pembersih Lantai"
- Synonyms: scrubber-driers, floor sweepers, floor polishers, buffer machines
- Parent: Office → Commercial Cleaning → Floor Cleaning Machines

## D2 Required
product name, brand, machine_type enum (`walk_behind_scrubber|ride_on_scrubber|floor_sweeper|floor_polisher|burnisher|single_disc`), power_source (`mains|battery|petrol`), cleaning_width_mm, water_tank_capacity_litres (scrubbers), voltage_v.

## D3 Optional
model, brush_type, brush_speed_rpm, run_time_minutes (battery), motor_power_w, warranty_months.

## D4 Technical specs
dimensions_mm, weight_kg, cleaning_width_mm, water_tank_capacity_litres, battery_capacity_ah, motor_power_w.

## D5 Variant axes
- `cleaning_width_mm` typically separate SKU.
- `power_source` separate SKU.

## D6 Media
Min 3 / Max 8.

## D7 Commercial
Fixed. Returnable yes if sealed. Freight.

## D8 Compliance
- IEC 60335-2-2 (vacuum cleaners — adjacent) [VERIFIED].
- Electrical safety; EMC per region.
- Battery UN 38.3.

## D9 Search attributes
Facets: machine_type, cleaning_width, water_tank, power_source, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Mesin Pembersih Lantai | Floor Cleaning Machine |
| Floor Scrubber | Scrubber |

## D12 Unresolved
- Petrol-powered: fuel-shipping restrictions.
