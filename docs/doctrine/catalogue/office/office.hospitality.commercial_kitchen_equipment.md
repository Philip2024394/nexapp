# office.hospitality.commercial_kitchen_equipment — Commercial Kitchen Equipment

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.hospitality.commercial_kitchen_equipment` · EN "Commercial Kitchen Equipment" · ID "Peralatan Dapur Komersial"
- Synonyms: restaurant kitchen appliances, catering equipment (hot), combi ovens, cookers, fryers
- Parent: Office → Hospitality & Catering → Commercial Kitchen Equipment

## D2 Required
product name, brand, equipment_type enum (`gas_range|electric_range|induction_range|combi_oven|convection_oven|deep_fryer|griddle|char_broiler|salamander|steamer|mixer_commercial|dishwasher_commercial|refrigerator_commercial|freezer_commercial|ice_machine`), fuel_or_power (`gas_lpg|gas_natural|electric|dual`), power_rating_kw or voltage_v + phase, capacity_or_dimensions.

## D3 Optional
model, nsf_certified (bool), energy_star_rated (bool), warranty_months, water_connection_required (bool), drain_connection_required (bool), extraction_hood_required (bool).

## D4 Technical specs
width_mm, depth_mm, height_mm, weight_kg, power_kw, voltage_v, phase, gas_input_kw, water_flow_l_per_min (dishwashers), ice_production_kg_per_24h.

## D5 Variant axes
- `fuel_or_power` typically separate SKU.
- `capacity` can be variant (max 5).

## D6 Media
Min 4 / Max 10. Front, back (connections), interior.

## D7 Commercial
Fixed. Returnable yes if sealed. Freight.

## D8 Compliance
- NSF/ANSI 2 (food zone contact) [VERIFIED]; NSF/ANSI 7 (commercial refrigeration).
- EN 203 (gas appliances for catering) [VERIFIED].
- CE marking (EU), SNI for ID.
- Gas-equipment installation + commissioning may require certified gas-engineer per jurisdiction.

## D9 Search attributes
Facets: equipment_type, fuel_or_power, power_rating/capacity, nsf_certified, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Peralatan Dapur Komersial | Commercial Kitchen Equipment |
| Oven Komersial | Commercial Oven |
| Kompor Gas Komersial | Commercial Gas Range |

## D12 Unresolved
- Gas-equipment installation copy — must advise certified installer.
- Combination dual-fuel safety.
