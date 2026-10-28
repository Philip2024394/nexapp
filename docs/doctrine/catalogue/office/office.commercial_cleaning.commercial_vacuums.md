# office.commercial_cleaning.commercial_vacuums — Commercial Vacuums

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.commercial_cleaning.commercial_vacuums` · EN "Commercial Vacuums" · ID "Vakum Komersial"
- Synonyms: wet/dry vacuums, backpack vacuums, canister vacuums (commercial), hazardous-dust vacuums
- Parent: Office → Commercial Cleaning → Commercial Vacuums

## D2 Required
product name, brand, vacuum_type enum (`upright|canister|backpack|wet_dry|hepa_class_h|industrial_shop_vac`), filtration_class enum (`standard|hepa|ulpa|m_class|h_class`), capacity_litres, voltage_v, motor_power_w.

## D3 Optional
model, cord_length_m, noise_db, hose_length_m, variable_suction (bool), bag_type (`bagless|cartridge|paper_bag`).

## D4 Technical specs
dimensions_mm, weight_kg, capacity_litres, airflow_l_per_sec, suction_mbar, motor_power_w, voltage.

## D5 Variant axes
- `capacity_litres` or `filtration_class` typically separate SKU.

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- IEC 60335-2-2 vacuum cleaner safety [VERIFIED].
- EN 60335-2-69 wet/dry [VERIFIED].
- Hazardous-dust class H / M (EU) — must meet BGIA / IFA testing. Claim verification critical.
- HEPA class claim — EN 1822.

## D9 Search attributes
Facets: vacuum_type, filtration_class, capacity_litres, suction_mbar, motor_power, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Vakum | Vacuum Cleaner |
| Wet/Dry Vakum | Wet/Dry Vacuum |

## D12 Unresolved
- H-class / M-class hazardous-dust claim verification — safety-critical.
