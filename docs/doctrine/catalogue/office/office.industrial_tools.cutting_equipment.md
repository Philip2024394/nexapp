# office.industrial_tools.cutting_equipment — Cutting Equipment

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.industrial_tools.cutting_equipment` · EN "Cutting Equipment" · ID "Peralatan Pemotong"
- Synonyms: angle grinders, cut-off saws, plasma cutters, utility knives (industrial), band saws
- Parent: Office → Industrial Tools → Cutting Equipment

## D2 Required
product name, brand, cutting_tech enum (`angle_grinder|circular_saw|band_saw|reciprocating_saw|plasma_cutter|oxy_fuel|laser_cutter|water_jet|utility_knife_industrial`), power_source (`corded|cordless_battery|pneumatic|hydraulic|manual`), max_cutting_capacity, voltage_v (if applicable), motor_power_w (if applicable).

## D3 Optional
model, blade_diameter_mm, battery_voltage_v, battery_capacity_ah, variable_speed (bool), guard_type, dust_extraction_port (bool), safety_class, warranty_months.

## D4 Technical specs
dimensions, weight_kg, voltage, motor_power_w, max_cutting_depth_mm, no_load_rpm.

## D5 Variant axes
- `power_source` typically separate SKU.
- `blade_diameter` can be variant.

## D6 Media
Min 3 / Max 8. Full tool, blade close-up, guard detail.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- IEC 62841 power-tool safety [VERIFIED].
- Bladed-item age-gate: 18+ in many jurisdictions (UK Offensive Weapons Act, several others) [UNRESOLVED — jurisdictional].
- CE marking for EU; FCC for US; SNI for ID.
- Battery UN 38.3 for lithium.

## D9 Search attributes
Facets: cutting_tech, power_source, max_cutting_capacity, blade_diameter, voltage, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Gerinda | Grinder |
| Gergaji Mesin | Power Saw |
| Pemotong Plasma | Plasma Cutter |

## D12 Unresolved
- **Age-gate** for bladed power tools — needs policy. ID has no uniform rule but international orders may require.
- Plasma / laser cutters — significant electrical + heat hazards. Buyer-safety copy.
