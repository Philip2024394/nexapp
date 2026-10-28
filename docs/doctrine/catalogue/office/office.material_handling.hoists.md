# office.material_handling.hoists — Hoists

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.material_handling.hoists` · EN "Hoists" · ID "Hoist / Katrol"
- Synonyms: chain hoists, wire-rope hoists, electric hoists, pneumatic hoists
- Parent: Office → Material Handling → Hoists

## D2 Required
product name, brand, hoist_type enum (`manual_chain|lever|electric_chain|electric_wire_rope|pneumatic`), swl_wll_kg, lift_height_m, duty_class (ISO 4301 or FEM 9.511 — e.g. `M3`, `1Am`) [VERIFIED ISO 4301], voltage_v (electric), phase.

## D3 Optional
model, lifting_speed_m_per_min, limit_switch (bool), overload_protection (bool), chain_bag (bool), warranty_months, ip_rating.

## D4 Technical specs
dimensions_mm, weight_kg, swl_wll_kg, lift_height_m, voltage, phase, motor_power_w, lifting_speed_m_per_min.

## D5 Variant axes
- `swl_wll_kg` or `lift_height_m` typically separate SKU.

## D6 Media
Min 3 / Max 8.

## D7 Commercial
Fixed. Returnable yes if sealed. Freight.

## D8 Compliance
- ISO 4301 crane classification [VERIFIED]; FEM 9.511 duty [VERIFIED].
- Machinery Directive 2006/42/EC (EU); OSHA 1910.179 (US).
- Battery compliance for cordless (lithium UN 38.3).

## D9 Search attributes
Facets: hoist_type, swl_wll_kg, lift_height, duty_class, voltage, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Hoist Rantai | Chain Hoist |
| Hoist Listrik | Electric Hoist |

## D12 Unresolved
- Install / inspection recommendation copy for buyer safety.
